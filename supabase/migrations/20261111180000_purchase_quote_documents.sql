begin;

create table public.purchase_quote_documents (
  upload_id uuid primary key,
  item_id bigint not null references public.purchase_request_items(id) on delete restrict,
  uploaded_by uuid not null,
  supplier_name text not null check (char_length(btrim(supplier_name)) between 1 and 180),
  gross_cents bigint not null check (gross_cents > 0),
  discount_cents bigint not null check (discount_cents >= 0 and discount_cents < gross_cents),
  final_cents bigint generated always as (gross_cents - discount_cents) stored,
  file_name text not null check (char_length(file_name) between 1 and 180),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  drive_id text not null unique check (drive_id ~ '^[A-Za-z0-9_-]+$'),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index purchase_quote_documents_item_idx on public.purchase_quote_documents(item_id);
alter table public.purchase_quote_documents enable row level security;
revoke all on public.purchase_quote_documents from public,anon,authenticated;
grant select (upload_id,item_id,supplier_name,gross_cents,discount_cents,final_cents,file_name,drive_id,completed_at)
on public.purchase_quote_documents to authenticated;
grant select,insert on public.purchase_quote_documents to service_role;
grant update (completed_at) on public.purchase_quote_documents to service_role;
create policy purchase_quote_documents_read on public.purchase_quote_documents
for select to authenticated using (
  completed_at is not null
  and exists(select 1 from public.purchase_request_items i where i.id=item_id)
);

create function cdl_purchase_private.check_quote_upload() returns trigger
language plpgsql security definer set search_path=''
as $$
declare request_owner uuid; request_status text; profile_role text;
begin
  select p.role into profile_role from public.profiles p where p.id=new.uploaded_by and p.active;
  if not found then raise exception 'Perfil interno ativo obrigatório.' using errcode='42501'; end if;
  select r.created_by,r.status into request_owner,request_status
  from public.purchase_request_items i
  join public.purchase_requests r on r.id=i.request_id
  where i.id=new.item_id for update of r;
  if not found or (request_owner<>new.uploaded_by and profile_role<>'admin') then
    raise exception 'Cotação restrita ao registrante ou administrador.' using errcode='42501';
  end if;
  if request_status not in ('draft','returned') then
    raise exception 'A cotação só pode ser anexada antes do envio para triagem.';
  end if;
  return new;
end;
$$;
revoke all on function cdl_purchase_private.check_quote_upload() from public,anon,authenticated;
create trigger check_purchase_quote_upload before insert or update on public.purchase_quote_documents
for each row execute function cdl_purchase_private.check_quote_upload();

notify pgrst,'reload schema';
commit;
