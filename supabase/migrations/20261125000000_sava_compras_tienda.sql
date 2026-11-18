-- las tiendas registran compras de mercancia en el cuaderno
alter table public.movimientos drop constraint if exists movimientos_tipo_check;
alter table public.movimientos add constraint movimientos_tipo_check check (tipo in ('cosecha', 'venta', 'gasto', 'perdida', 'cobro', 'compra'));
