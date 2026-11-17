-- limite diario de mensajes con inteligencia artificial por persona (para cuidar el saldo)
create table if not exists public.uso_maria (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null default current_date,
  mensajes integer not null default 0,
  primary key (user_id, dia)
);

alter table public.uso_maria enable row level security;
revoke all on public.uso_maria from anon, authenticated;

-- suma un mensaje y dice si todavia esta dentro del limite.
-- la persona no puede escribir la tabla directamente, solo por esta funcion
create or replace function public.usar_ia_maria(p_limite integer) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mensajes integer;
begin
  if auth.uid() is null then return false; end if;
  insert into public.uso_maria(user_id, dia, mensajes) values (auth.uid(), current_date, 1)
  on conflict (user_id, dia) do update set mensajes = public.uso_maria.mensajes + 1
  returning mensajes into v_mensajes;
  return v_mensajes <= least(greatest(p_limite, 1), 100);
end;
$$;

revoke all on function public.usar_ia_maria(integer) from public, anon;
grant execute on function public.usar_ia_maria(integer) to authenticated;
