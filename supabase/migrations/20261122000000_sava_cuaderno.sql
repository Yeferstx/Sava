-- cuaderno del campo: cosechas, ventas, gastos, perdidas y cobros de cada negocio.
-- son datos privados: solo el dueno del negocio los puede ver o crear
create table if not exists public.movimientos (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  tipo text not null check (tipo in ('cosecha', 'venta', 'gasto', 'perdida', 'cobro')),
  product_id uuid references public.products(id) on delete set null,
  producto text not null default '',
  cantidad numeric not null default 0 check (cantidad >= 0),
  unidad text not null default '',
  monto bigint not null default 0 check (monto >= 0),
  pagado boolean not null default true,
  ref_id uuid,
  persona text not null default '',
  nota text not null default '',
  fecha timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists movimientos_business_idx on public.movimientos(business_id, fecha desc);

alter table public.movimientos enable row level security;

drop policy if exists "dueno ve sus movimientos" on public.movimientos;
create policy "dueno ve sus movimientos" on public.movimientos for select
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

drop policy if exists "dueno crea sus movimientos" on public.movimientos;
create policy "dueno crea sus movimientos" on public.movimientos for insert
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- el upsert por id necesita permiso de update; solo sobre sus propios movimientos
drop policy if exists "dueno actualiza sus movimientos" on public.movimientos;
create policy "dueno actualiza sus movimientos" on public.movimientos for update
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- nadie borra movimientos desde la app (el historial se conserva)
