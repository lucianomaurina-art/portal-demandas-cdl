create table public.purchase_kanban_quote_uploads (
  upload_id uuid primary key,
  uploaded_by uuid not null,
  item_id bigint not null,
  file_name text not null,
  file_sha256 text not null,
  drive_id text not null unique,
  completed_at timestamptz
);

alter table public.purchase_kanban_quote_uploads enable row level security;
revoke all on public.purchase_kanban_quote_uploads from public, anon, authenticated;
grant select, insert on public.purchase_kanban_quote_uploads to service_role;
grant update (completed_at) on public.purchase_kanban_quote_uploads to service_role;
