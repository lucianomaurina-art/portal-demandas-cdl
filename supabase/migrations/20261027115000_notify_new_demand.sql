-- Dispara a notificação de nova demanda no próprio banco.
-- Idempotente: pode ser reaplicada sem duplicar o trigger.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_demand_by_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
begin
  perform net.http_post(
    url := 'https://uswsagujxwcfvauulhzq.supabase.co/functions/v1/notificar-nova-demanda',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_WjKdUuVCm_fdgE67M4sEUA_BbPwvB-c',
      'Authorization', 'Bearer sb_publishable_WjKdUuVCm_fdgE67M4sEUA_BbPwvB-c'
    ),
    body := jsonb_build_object('protocol', new.protocol)
  );
  return new;
exception
  when others then
    -- O cadastro da demanda nunca deve falhar por causa do e-mail.
    raise warning 'Falha ao agendar notificação da demanda %: %', new.protocol, sqlerrm;
    return new;
end;
$$;

drop trigger if exists notify_new_demand_after_insert on public.demands;
create trigger notify_new_demand_after_insert
after insert on public.demands
for each row
execute function public.notify_new_demand_by_email();

revoke all on function public.notify_new_demand_by_email() from public;
