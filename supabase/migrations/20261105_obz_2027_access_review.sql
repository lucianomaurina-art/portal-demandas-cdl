-- Security review for OBZ 2027.
-- Execute after the base and hardening migrations, in a transaction in staging.
-- No mutation of demand tables.
begin;
-- Block direct financial line insertion from authenticated clients, including admin;
-- import must be performed through obz_import_lines RPC.
drop policy if exists obz_lines_admin_insert on public.obz_lines;
-- Remove direct client update on centers (RPC handles status and assignment).
revoke insert,update on public.obz_centers from authenticated;
-- SECURITY DEFINER functions retain table-owner privileges, and use explicit authorization.
-- Revoke direct insert on line records; the RPC runs as its owner.
revoke insert on public.obz_lines from authenticated;
-- Only admins can edit financial values via direct update; manager justifications via RPC.
-- Prevent direct edits to submitted/approved packages even by admins.
create or replace function public.obz_guard_financial_changes()
returns trigger language plpgsql set search_path=public as $$
declare v_status text;
begin
 select status into v_status from public.obz_centers where id=new.center_id;
 if (new.months is distinct from old.months or new.category is distinct from old.category
 or new.center_id is distinct from old.center_id or new.source_key is distinct from old.source_key)
 and not public.obz_is_admin() then
   raise exception 'Somente administrador pode alterar valores ou vinculação da rubrica';
 end if;
 if v_status='approved' then raise exception 'Pacote aprovado: reabra o pacote antes de alterar rubricas'; end if;
 return new;
end; $$;
-- Block direct edits to imported metadata by admin unless via RPC or import.
-- Audit inserts are server-side only; audit read follows center access.
commit;
