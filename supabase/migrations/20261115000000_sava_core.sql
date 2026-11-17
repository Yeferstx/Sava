create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  description text not null default '',
  phone text not null default '',
  municipality text not null default 'Yopal',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null,
  description text not null default '',
  price_cop bigint not null check (price_cop >= 0),
  stock numeric(12, 3) not null default 0 check (stock >= 0),
  unit text not null default 'unidad',
  photo_path text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  total_cop bigint not null check (total_cop >= 0),
  customer_name text,
  notes text not null default '',
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price_cop bigint not null check (unit_price_cop >= 0)
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  category text not null,
  video_path text not null,
  thumbnail_path text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists products_public_feed_idx on public.products(category, created_at desc) where is_published;
create index if not exists sales_business_date_idx on public.sales(business_id, sold_at desc);
create index if not exists videos_public_feed_idx on public.videos(category, created_at desc) where is_published;

grant usage on schema public to anon, authenticated;
grant select on public.businesses, public.products, public.videos to anon, authenticated;
grant insert, update, delete on public.businesses, public.products, public.videos to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update on public.sale_items to authenticated;

alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.videos enable row level security;

drop policy if exists "published businesses are visible" on public.businesses;
drop policy if exists "owners manage their businesses" on public.businesses;
drop policy if exists "published products are visible" on public.products;
drop policy if exists "owners manage their products" on public.products;
drop policy if exists "owners manage their sales" on public.sales;
drop policy if exists "owners read sale items" on public.sale_items;
drop policy if exists "owners create sale items" on public.sale_items;
drop policy if exists "owners update sale items" on public.sale_items;
drop policy if exists "published videos are visible" on public.videos;
drop policy if exists "owners manage their videos" on public.videos;
drop policy if exists "public can view published media" on storage.objects;
drop policy if exists "authenticated owners upload media to their folder" on storage.objects;
drop policy if exists "owners update their media" on storage.objects;
drop policy if exists "owners delete their media" on storage.objects;

create policy "published businesses are visible" on public.businesses for select using (is_published);
create policy "owners manage their businesses" on public.businesses for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "published products are visible" on public.products for select using (is_published);
create policy "owners manage their products" on public.products for all to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
);

create policy "owners manage their sales" on public.sales for all to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
);

create policy "owners read sale items" on public.sale_items for select to authenticated using (
  exists (select 1 from public.sales s join public.businesses b on b.id = s.business_id where s.id = sale_id and b.owner_id = (select auth.uid()))
);
create policy "owners create sale items" on public.sale_items for insert to authenticated with check (
  exists (select 1 from public.sales s join public.businesses b on b.id = s.business_id where s.id = sale_id and b.owner_id = (select auth.uid()))
);
create policy "owners update sale items" on public.sale_items for update to authenticated using (
  exists (select 1 from public.sales s join public.businesses b on b.id = s.business_id where s.id = sale_id and b.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.sales s join public.businesses b on b.id = s.business_id where s.id = sale_id and b.owner_id = (select auth.uid()))
);

create policy "published videos are visible" on public.videos for select using (is_published);
create policy "owners manage their videos" on public.videos for all to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sava-media', 'sava-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

create policy "public can view published media" on storage.objects for select using (bucket_id = 'sava-media');
create policy "authenticated owners upload media to their folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'sava-media' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "owners update their media" on storage.objects for update to authenticated using (
  bucket_id = 'sava-media' and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'sava-media' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "owners delete their media" on storage.objects for delete to authenticated using (
  bucket_id = 'sava-media' and (storage.foldername(name))[1] = (select auth.uid())::text
);
