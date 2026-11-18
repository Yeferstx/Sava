-- hasta 3 fotos adicionales por publicacion (la principal sigue en photo_path)
alter table public.products add column if not exists photo_paths text[] not null default '{}';
alter table public.products drop constraint if exists products_photo_paths_check;
alter table public.products add constraint products_photo_paths_check check (cardinality(photo_paths) <= 3);
