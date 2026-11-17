create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null default '',
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'completed')),
  total_cop bigint not null check (total_cop >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null,
  unit_price_cop bigint not null check (unit_price_cop >= 0),
  line_total_cop bigint not null check (line_total_cop >= 0)
);

create index if not exists orders_customer_date_idx on public.orders(customer_id, created_at desc);
create index if not exists orders_business_status_idx on public.orders(business_id, status, created_at desc);

revoke insert, delete on public.orders, public.order_items from anon, authenticated;
grant select on public.orders to authenticated;
grant update (status, updated_at) on public.orders to authenticated;
grant select on public.order_items to authenticated;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "customers and businesses read orders" on public.orders;
drop policy if exists "customers create their orders" on public.orders;
drop policy if exists "business owners update orders" on public.orders;
drop policy if exists "customers and businesses read order items" on public.order_items;
drop policy if exists "customers create order items" on public.order_items;

create policy "customers and businesses read orders" on public.orders for select to authenticated using (
  customer_id = (select auth.uid()) or exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())
  )
);
create policy "customers create their orders" on public.orders for insert to authenticated with check (
  customer_id = (select auth.uid())
);
create policy "business owners update orders" on public.orders for update to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
);
create policy "customers and businesses read order items" on public.order_items for select to authenticated using (
  exists (
    select 1 from public.orders o left join public.businesses b on b.id = o.business_id
    where o.id = order_id and (o.customer_id = (select auth.uid()) or b.owner_id = (select auth.uid()))
  )
);
create policy "customers create order items" on public.order_items for insert to authenticated with check (
  exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()))
);

create or replace function public.place_order(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text default '',
  p_note text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_product record;
  v_total bigint;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para hacer un pedido.'; end if;
  if p_quantity <= 0 then raise exception 'La cantidad debe ser mayor que cero.'; end if;
  select p.id, p.name, p.price_cop, p.stock, p.unit into v_product
  from public.products p
  join public.businesses b on b.id = p.business_id and b.is_published = true
  where p.id = p_product_id and p.business_id = p_business_id and p.is_published = true;
  if not found then raise exception 'El producto ya no está disponible.'; end if;
  if v_product.stock < p_quantity then raise exception 'No hay existencias suficientes para esa cantidad.'; end if;
  if length(trim(p_customer_name)) = 0 or length(trim(p_customer_phone)) = 0 then
    raise exception 'Escribe tu nombre y teléfono de contacto.';
  end if;
  v_total := round(v_product.price_cop * p_quantity)::bigint;
  insert into public.orders(business_id, customer_id, customer_name, customer_phone, delivery_address, note, total_cop)
  values (p_business_id, auth.uid(), trim(p_customer_name), trim(p_customer_phone), coalesce(trim(p_delivery_address), ''), coalesce(trim(p_note), ''), v_total)
  returning id into v_order_id;
  insert into public.order_items(order_id, product_id, product_name, quantity, unit, unit_price_cop, line_total_cop)
  values (v_order_id, v_product.id, v_product.name, p_quantity, v_product.unit, v_product.price_cop, v_total);
  return v_order_id;
end;
$$;

revoke all on function public.place_order(uuid, uuid, numeric, text, text, text, text) from public, anon;
grant execute on function public.place_order(uuid, uuid, numeric, text, text, text, text) to authenticated;
