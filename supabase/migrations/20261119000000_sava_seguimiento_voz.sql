-- seguimiento de ventas y notas de voz

-- 1. contactos: cada vez que alguien le escribe a un vendedor por whatsapp desde sava.
-- despues la app le pregunta al vendedor que paso con esa venta
create table if not exists public.contactos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  buyer_id uuid references auth.users(id) on delete set null,
  resultado text check (resultado in ('vendido', 'no_vendido')),
  cantidad numeric(12, 3) check (cantidad is null or cantidad > 0),
  total_cop bigint check (total_cop is null or total_cop >= 0),
  preguntar_desde timestamptz not null default now() + interval '3 hours',
  created_at timestamptz not null default now()
);

create index if not exists contactos_negocio_idx on public.contactos(business_id, resultado, preguntar_desde);

alter table public.contactos enable row level security;
revoke all on public.contactos from anon, authenticated;
grant select on public.contactos to authenticated;
grant update (resultado, cantidad, total_cop, preguntar_desde) on public.contactos to authenticated;

drop policy if exists "duenos leen sus contactos" on public.contactos;
drop policy if exists "duenos responden sus contactos" on public.contactos;
create policy "duenos leen sus contactos" on public.contactos for select to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
);
create policy "duenos responden sus contactos" on public.contactos for update to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
);

-- se registra con una funcion para que el comprador no pueda escribir otros datos.
-- funciona tambien sin cuenta (explorar sin cuenta)
create or replace function public.registrar_contacto(p_product_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid;
begin
  select p.business_id into v_business from public.products p
  where p.id = p_product_id and p.is_published = true;
  if not found then return; end if;
  -- el vendedor no se cuenta a si mismo
  if exists (select 1 from public.businesses b where b.id = v_business and b.owner_id = auth.uid()) then return; end if;
  -- la misma persona sobre el mismo producto solo una vez al dia
  if auth.uid() is not null and exists (
    select 1 from public.contactos c where c.product_id = p_product_id and c.buyer_id = auth.uid() and c.created_at > now() - interval '1 day'
  ) then return; end if;
  -- limite para contactos sin cuenta (evita llenar la tabla)
  if auth.uid() is null and (
    select count(*) from public.contactos c where c.product_id = p_product_id and c.buyer_id is null and c.created_at > now() - interval '1 hour'
  ) >= 5 then return; end if;
  insert into public.contactos(product_id, business_id, buyer_id) values (p_product_id, v_business, auth.uid());
end;
$$;

revoke all on function public.registrar_contacto(uuid) from public;
grant execute on function public.registrar_contacto(uuid) to anon, authenticated;

-- 2. notas de voz dentro de una consulta (comprador y vendedor se pueden responder con voz)
create table if not exists public.notas_voz (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  audio_path text not null,
  duracion_seg integer not null default 0 check (duracion_seg between 0 and 120),
  created_at timestamptz not null default now()
);

create index if not exists notas_voz_consulta_idx on public.notas_voz(order_id, created_at);

alter table public.notas_voz enable row level security;
revoke all on public.notas_voz from anon, authenticated;
grant select, insert on public.notas_voz to authenticated;

drop policy if exists "partes de la consulta leen notas" on public.notas_voz;
drop policy if exists "partes de la consulta crean notas" on public.notas_voz;
create policy "partes de la consulta leen notas" on public.notas_voz for select to authenticated using (
  exists (
    select 1 from public.orders o left join public.businesses b on b.id = o.business_id
    where o.id = order_id and (o.customer_id = (select auth.uid()) or b.owner_id = (select auth.uid()))
  )
);
create policy "partes de la consulta crean notas" on public.notas_voz for insert to authenticated with check (
  autor_id = (select auth.uid()) and exists (
    select 1 from public.orders o left join public.businesses b on b.id = o.business_id
    where o.id = order_id and (o.customer_id = (select auth.uid()) or b.owner_id = (select auth.uid()))
  )
);

-- 3. el almacenamiento acepta audios (m4a de iphone y android)
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg']
where id = 'sava-media';
