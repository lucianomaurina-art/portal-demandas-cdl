import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const maxBytes = 2_000_000;
const origin = "https://lucianomaurina-art.github.io";
const fileTypes: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
};
const driveApi = "https://www.googleapis.com/drive/v3";
const columns = "upload_id,item_id,uploaded_by,supplier_name,gross_cents,discount_cents,file_name,file_sha256,drive_id,completed_at";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function signatureMatches(bytes: Uint8Array, mime: string) {
  const starts = (header: number[]) => header.every((b, i) => bytes[i] === b);
  if (mime === "application/pdf") return starts([37, 80, 68, 70, 45]);
  if (mime === "image/jpeg") return starts([255, 216, 255]);
  return starts([137, 80, 78, 71, 13, 10, 26, 10]);
}

async function googleToken() {
  const client_id = Deno.env.get("PURCHASE_GOOGLE_CLIENT_ID");
  const client_secret = Deno.env.get("PURCHASE_GOOGLE_CLIENT_SECRET");
  const refresh_token = Deno.env.get("PURCHASE_GOOGLE_REFRESH_TOKEN");
  if (!client_id || !client_secret || !refresh_token) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
  });
  if (!response.ok) return null;
  const { access_token } = await response.json();
  return typeof access_token === "string" ? access_token : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });
  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json(401, { error: "Entre no portal." });
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser(authorization.slice(7));
    if (authError || !user) return json(401, { error: "Sessão inválida." });
    const { data: profile } = await userClient.from("profiles").select("active,role").eq("id", user.id).maybeSingle();
    if (!profile?.active) return json(403, { error: "Perfil interno ativo obrigatório." });
    const length = Number(request.headers.get("Content-Length"));
    if (length > maxBytes + 16384) return json(413, { error: "Use um arquivo de até 2 MB." });
    const reader = request.body?.getReader();
    if (!reader) return json(400, { error: "Envie o arquivo da cotação." });
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes + 16384) {
        await reader.cancel();
        return json(413, { error: "Use um arquivo de até 2 MB." });
      }
      chunks.push(new Uint8Array(value));
    }
    const form = await new Response(new Blob(chunks), {
      headers: { "Content-Type": request.headers.get("Content-Type") || "" },
    }).formData();
    const uploadId = String(form.get("upload_id") || "");
    const itemId = String(form.get("item_id") || "");
    const supplier = String(form.get("supplier_name") || "").trim();
    const gross = Number(form.get("gross_cents"));
    const discount = Number(form.get("discount_cents") || 0);
    const file = form.get("file");
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(uploadId) ||
      !/^[1-9]\d{0,17}$/.test(itemId) || !supplier || supplier.length > 180 ||
      !Number.isSafeInteger(gross) || !Number.isSafeInteger(discount) || discount < 0 || gross <= discount ||
      !(file instanceof File) || !file.size || file.size > maxBytes) {
      return json(400, { error: "Confira item, fornecedor, valores e arquivo de até 2 MB." });
    }
    const fileName = file.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 180);
    const mime = fileTypes[fileName.split(".").pop()?.toLowerCase() || ""];
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!mime || !signatureMatches(bytes, mime)) return json(400, { error: "Envie PDF, JPG ou PNG válido." });
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((value) => value.toString(16).padStart(2, "0")).join("");
    const { data: item } = await userClient.from("purchase_request_items")
      .select("id,purchase_requests(created_by,status)").eq("id", itemId).maybeSingle();
    const parent = item?.purchase_requests as { created_by: string; status: string } | null | undefined;
    if (!parent || (parent.created_by !== user.id && profile.role !== "admin")) {
      return json(403, { error: "Você não pode anexar cotações a este item." });
    }
    const client = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const lookup = () => client.from("purchase_quote_documents").select(columns).eq("upload_id", uploadId).maybeSingle();
    let { data: record, error } = await lookup();
    if (error) return json(503, { error: "Não foi possível consultar a cotação." });
    const matches = () => record && String(record.item_id) === itemId && record.uploaded_by === user.id &&
      record.supplier_name === supplier && Number(record.gross_cents) === gross &&
      Number(record.discount_cents) === discount && record.file_name === fileName && record.file_sha256 === hash;
    const result = () => json(200, {
      upload_id: uploadId,
      drive_url: "https://drive.google.com/file/d/" + record!.drive_id + "/view",
      final_cents: gross - discount,
    });
    if (record && !matches()) return json(409, { error: "O identificador já foi usado para outro arquivo ou valor." });
    if (record?.completed_at) return result();
    if (!["draft", "returned"].includes(parent.status)) return json(409, { error: "A solicitação já foi enviada para triagem." });
    const folder = Deno.env.get("PURCHASE_DRIVE_QUOTES_FOLDER_ID");
    const token = await googleToken();
    if (!folder || !token) return json(503, { error: "A conta do Google Drive ainda precisa ser autorizada." });
    const headers = { Authorization: "Bearer " + token };
    if (!record) {
      const generated = await fetch(driveApi + "/files/generateIds?count=1&space=drive", { headers });
      if (!generated.ok) return json(502, { error: "O Drive não conseguiu preparar o arquivo." });
      const { ids } = await generated.json();
      const driveId = ids?.[0];
      if (typeof driveId !== "string" || !/^[A-Za-z0-9_-]+$/.test(driveId)) {
        return json(502, { error: "O Drive não devolveu um identificador válido." });
      }
      const inserted = await client.from("purchase_quote_documents").insert({
        upload_id: uploadId, item_id: itemId, uploaded_by: user.id, supplier_name: supplier,
        gross_cents: gross, discount_cents: discount, file_name: fileName, file_sha256: hash, drive_id: driveId,
      }).select(columns).single();
      record = inserted.data;
      if (inserted.error?.code === "23505") ({ data: record } = await lookup());
      if (!matches()) return json(409, { error: "O vínculo não pôde ser registrado. Atualize a solicitação e tente novamente." });
      if (record?.completed_at) return result();
    }
    const boundary = "cdl_" + crypto.randomUUID().replaceAll("-", "");
    const metadata = JSON.stringify({ id: record!.drive_id, name: "Item-" + itemId + " - " + fileName, parents: [folder] });
    const multipart = new Blob([
      "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + metadata + "\r\n",
      "--" + boundary + "\r\nContent-Type: " + mime + "\r\n\r\n", bytes, "\r\n--" + boundary + "--\r\n",
    ]);
    const uploaded = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
      method: "POST", headers: { ...headers, "Content-Type": "multipart/related; boundary=" + boundary }, body: multipart,
    });
    if (!uploaded.ok && uploaded.status !== 409) return json(502, { error: "Falha ao salvar no Drive. Tente novamente com o mesmo arquivo." });
    const verified = await fetch(driveApi + "/files/" + record!.drive_id + "?fields=id,parents,trashed&supportsAllDrives=true", { headers });
    if (!verified.ok) return json(502, { error: "O arquivo ainda não pôde ser confirmado no Drive. Tente novamente." });
    const remote = await verified.json();
    if (remote.id !== record!.drive_id || remote.trashed || !remote.parents?.includes(folder)) {
      return json(502, { error: "O arquivo não está na pasta de Cotações." });
    }
    const completed = await client.from("purchase_quote_documents")
      .update({ completed_at: new Date().toISOString() }).eq("upload_id", uploadId).is("completed_at", null);
    if (completed.error) return json(409, { error: "O arquivo está no Drive, mas a cotação ainda precisa ser vinculada." });
    return result();
  } catch {
    return json(500, { error: "Não foi possível processar a cotação." });
  }
});
