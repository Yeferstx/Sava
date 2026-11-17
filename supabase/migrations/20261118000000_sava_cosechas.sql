-- datos de las cosechas: municipio, fecha de disponibilidad, entrega y publicaciones retiradas
alter table public.products add column if not exists municipality text not null default 'Yopal';
alter table public.products add column if not exists available_from date not null default current_date;
alter table public.products add column if not exists delivery text not null default 'A convenir';
alter table public.products add column if not exists retired boolean not null default false;

-- los productos viejos toman el municipio de su negocio
update public.products p set municipality = b.municipality
from public.businesses b
where b.id = p.business_id and p.municipality = 'Yopal' and b.municipality <> 'Yopal';

-- una publicacion retirada nunca se muestra al publico
drop policy if exists "published products are visible" on public.products;
create policy "published products are visible" on public.products for select using (is_published and not retired);

create index if not exists products_municipality_idx on public.products(municipality, created_at desc) where is_published and not retired;
