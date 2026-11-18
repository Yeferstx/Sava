-- pedido minimo de una cosecha (0 = vende cualquier cantidad).
-- el precio 0 ya se permite y significa "precio a convenir"
alter table public.products add column if not exists min_order numeric not null default 0;

alter table public.products drop constraint if exists products_min_order_check;
alter table public.products add constraint products_min_order_check check (min_order >= 0 and min_order <= stock or stock = 0);
