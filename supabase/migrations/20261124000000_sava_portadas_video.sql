-- portada de cada video: imagen pequena que se muestra mientras el video carga
alter table public.videos add column if not exists thumb_path text;
