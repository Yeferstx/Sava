-- version 1.1: la gobernacion de casanare es la responsable del tratamiento (cambio sustancial: se pide autorizar de nuevo)
insert into public.politica_versiones (version, publicada_en) values ('1.1', '2026-11-18') on conflict (version) do nothing;
