-- validaciones extra para los pedidos (cantidad entera y telefono valido)

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
  -- unidad y servicio no se venden por partes
  if v_product.unit in ('unidad', 'servicio') and p_quantity <> trunc(p_quantity) then
    raise exception 'Para este producto la cantidad debe ser un número entero.';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) < 3 then
    raise exception 'Escribe tu nombre completo.';
  end if;
  if regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g') !~ '^(57)?(3[0-9]{9}|60[0-9]{8})$' then
    raise exception 'Escribe un teléfono de 10 dígitos.';
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
