-- autorizacion de tratamiento de datos personales (ley 1581 de 2012, decreto 1074 de 2015).
-- se guarda evidencia verificable: quien, que texto (version), de que politica, cuando y desde donde.
-- el registro se valida en el servidor: sin autorizacion no se crea la cuenta.

create table if not exists public.politica_versiones (
  version text primary key,
  publicada_en date not null,
  requiere_nueva_autorizacion boolean not null default true
);

create table if not exists public.autorizacion_textos (
  version text primary key,
  tipo text not null check (tipo in ('tratamiento_datos', 'comunicaciones', 'ia_externa')),
  texto text not null,
  creado_en timestamptz not null default now()
);

insert into public.politica_versiones (version, publicada_en) values ('1.0', '2026-11-18') on conflict (version) do nothing;
insert into public.autorizacion_textos (version, tipo, texto) values
  ('datos-1.0', 'tratamiento_datos', 'Autorizo de manera previa, expresa e informada el tratamiento de mis datos personales para las finalidades indicadas en el aviso y la Política de Tratamiento de Datos Personales.'),
  ('comunicaciones-1.0', 'comunicaciones', 'Acepto recibir mensajes con novedades y comunicaciones de Sava que no son necesarias para usar la app (opcional).'),
  ('ia-1.0', 'ia_externa', 'Autorizo que, cuando Aru no entienda mi pregunta con sus reglas, envíe el texto de mi pregunta y de los últimos mensajes del chat a Gemini (Google) para responderme. No se envían mis cuentas, ventas, inventario ni datos de contacto.')
on conflict (version) do nothing;

-- historial de autorizaciones: cada cambio (otorgar o revocar) es una fila nueva. nunca se edita
create table if not exists public.autorizaciones_datos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('tratamiento_datos', 'comunicaciones', 'ia_externa')),
  otorgada boolean not null,
  version_politica text not null references public.politica_versiones(version),
  version_texto text not null references public.autorizacion_textos(version),
  origen text not null default 'app' check (origen in ('registro', 'app', 'chat')),
  creado_en timestamptz not null default now()
);
create index if not exists autorizaciones_usuario_idx on public.autorizaciones_datos(user_id, tipo, creado_en desc);

alter table public.politica_versiones enable row level security;
alter table public.autorizacion_textos enable row level security;
alter table public.autorizaciones_datos enable row level security;

drop policy if exists "versiones visibles" on public.politica_versiones;
create policy "versiones visibles" on public.politica_versiones for select using (true);
drop policy if exists "textos visibles" on public.autorizacion_textos;
create policy "textos visibles" on public.autorizacion_textos for select using (true);
-- cada persona solo ve sus autorizaciones. nadie las crea ni cambia directo: solo con la funcion de abajo
drop policy if exists "titular ve sus autorizaciones" on public.autorizaciones_datos;
create policy "titular ve sus autorizaciones" on public.autorizaciones_datos for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.autorizaciones_datos from anon, authenticated;

-- registrar una autorizacion desde la app (con sesion). no duplica: si el ultimo estado es igual, no hace nada
create or replace function public.registrar_autorizacion(p_tipo text, p_otorgada boolean, p_version_politica text, p_version_texto text, p_origen text default 'app')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid := auth.uid();
  v_ultima public.autorizaciones_datos%rowtype;
begin
  if v_usuario is null then raise exception 'Se necesita una sesión'; end if;
  if p_origen not in ('app', 'chat') then raise exception 'Origen no válido'; end if;
  if not exists (select 1 from public.politica_versiones where version = p_version_politica) then raise exception 'Versión de política no válida'; end if;
  if not exists (select 1 from public.autorizacion_textos where version = p_version_texto and tipo = p_tipo) then raise exception 'Texto de autorización no válido'; end if;
  select * into v_ultima from public.autorizaciones_datos where user_id = v_usuario and tipo = p_tipo order by creado_en desc limit 1;
  if found and v_ultima.otorgada = p_otorgada and v_ultima.version_politica = p_version_politica and v_ultima.version_texto = p_version_texto then return; end if;
  insert into public.autorizaciones_datos (user_id, tipo, otorgada, version_politica, version_texto, origen)
  values (v_usuario, p_tipo, p_otorgada, p_version_politica, p_version_texto, p_origen);
end $$;
revoke all on function public.registrar_autorizacion(text, boolean, text, text, text) from public, anon;
grant execute on function public.registrar_autorizacion(text, boolean, text, text, text) to authenticated;

-- al crear la cuenta: el servidor exige la autorizacion y guarda la evidencia (aunque la app fallara)
create or replace function public.autorizacion_al_registrarse()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_politica text := v_meta->>'politica_version';
  v_texto text := v_meta->>'autorizacion_version';
begin
  if coalesce(v_meta->>'autoriza_datos', 'false') <> 'true' then
    raise exception 'SAVA_SIN_AUTORIZACION: se requiere la autorización de tratamiento de datos personales';
  end if;
  if not exists (select 1 from public.politica_versiones where version = v_politica)
     or not exists (select 1 from public.autorizacion_textos where version = v_texto and tipo = 'tratamiento_datos') then
    raise exception 'SAVA_SIN_AUTORIZACION: versión de la política no válida';
  end if;
  insert into public.autorizaciones_datos (user_id, tipo, otorgada, version_politica, version_texto, origen)
  values (new.id, 'tratamiento_datos', true, v_politica, v_texto, 'registro');
  if coalesce(v_meta->>'autoriza_comunicaciones', 'false') = 'true' then
    insert into public.autorizaciones_datos (user_id, tipo, otorgada, version_politica, version_texto, origen)
    values (new.id, 'comunicaciones', true, v_politica, 'comunicaciones-1.0', 'registro');
  end if;
  if coalesce(v_meta->>'autoriza_ia', 'false') = 'true' then
    insert into public.autorizaciones_datos (user_id, tipo, otorgada, version_politica, version_texto, origen)
    values (new.id, 'ia_externa', true, v_politica, 'ia-1.0', 'registro');
  end if;
  return new;
end $$;
drop trigger if exists sava_autorizacion_registro on auth.users;
create trigger sava_autorizacion_registro after insert on auth.users for each row execute function public.autorizacion_al_registrarse();

-- solicitudes de los titulares (consultas y reclamos) hechas desde la app
create table if not exists public.solicitudes_titular (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('consulta', 'actualizacion', 'rectificacion', 'supresion', 'revocacion', 'prueba_autorizacion')),
  detalle text not null default '' check (char_length(detalle) <= 1000),
  estado text not null default 'recibida' check (estado in ('recibida', 'en_tramite', 'respondida')),
  creado_en timestamptz not null default now()
);
alter table public.solicitudes_titular enable row level security;
drop policy if exists "titular crea solicitudes" on public.solicitudes_titular;
create policy "titular crea solicitudes" on public.solicitudes_titular for insert to authenticated with check (user_id = (select auth.uid()) and estado = 'recibida');
drop policy if exists "titular ve sus solicitudes" on public.solicitudes_titular;
create policy "titular ve sus solicitudes" on public.solicitudes_titular for select to authenticated using (user_id = (select auth.uid()));
