import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, Check, Pencil } from 'lucide-react-native';
import { colors } from '../theme';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { getDatabase } from '../../infrastructure/database/database';
import { preguntarOrigen, tomarOElegirFoto } from '../fotos';
import { useAlVolver } from '../useAlVolver';

const PENDIENTE = 'foto_perfil_pendiente';

async function leerPendiente() {
  const db = await getDatabase();
  const fila = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', PENDIENTE);
  return fila ? fila.value : null;
}
async function guardarPendiente(valor: string | null) {
  const db = await getDatabase();
  if (valor === null) await db.runAsync('DELETE FROM app_settings WHERE key = ?', PENDIENTE);
  else await db.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', PENDIENTE, valor);
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'S';
  return (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
}

// foto de perfil y nombre. la foto se achica antes de subirla; sin senal queda guardada y se sube despues.
// "quitar" usa una marca especial para borrar la foto del servidor cuando haya senal
export default function FotoPerfil({ subtitulo = '' }: { subtitulo?: string }) {
  const [nombre, setNombre] = useState('');
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [pendiente, setPendiente] = useState(false);

  const cargar = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const usuario = data.session?.user;
    if (!usuario) return;
    const meta = (usuario.user_metadata ?? {}) as { nombre?: string; avatar_path?: string };
    setNombre(meta.nombre ?? '');
    const local = await leerPendiente().catch(() => null);
    if (local) { setPendiente(true); setFoto(local === 'quitar' ? null : local); return; }
    setPendiente(false);
    setFoto(meta.avatar_path ? supabase.storage.from('sava-media').getPublicUrl(meta.avatar_path).data.publicUrl : null);
  }, []);

  // sube lo pendiente (foto nueva o quitarla)
  const enviar = useCallback(async () => {
    const supabase = getSupabaseClient();
    const local = await leerPendiente().catch(() => null);
    if (!supabase || !local) return;
    const { data } = await supabase.auth.getSession();
    const usuario = data.session?.user;
    if (!usuario) return;
    setSubiendo(true);
    try {
      if (local === 'quitar') {
        const { error } = await supabase.auth.updateUser({ data: { avatar_path: null } });
        if (error) throw error;
      } else {
        const respuesta = await fetch(local);
        const bytes = await respuesta.arrayBuffer();
        const ruta = usuario.id + '/perfil/foto-' + Date.now() + '.jpg';
        const subida = await supabase.storage.from('sava-media').upload(ruta, bytes, { contentType: 'image/jpeg', upsert: true });
        if (subida.error) throw subida.error;
        const { error } = await supabase.auth.updateUser({ data: { avatar_path: subida.data.path } });
        if (error) throw error;
      }
      await guardarPendiente(null);
      await cargar();
    } catch { /* se reintenta cuando vuelva la senal */ }
    finally { setSubiendo(false); }
  }, [cargar]);

  useEffect(() => { void cargar().then(enviar); }, [cargar, enviar]);
  useAlVolver(() => { void enviar(); });

  function cambiarFoto() {
    preguntarOrigen('Foto de perfil', (origen) => {
      void tomarOElegirFoto(origen, true, 512).then(async (uri) => {
        if (!uri) return;
        await guardarPendiente(uri);
        setFoto(uri); setPendiente(true);
        void enviar();
      });
    }, foto ? () => { void guardarPendiente('quitar').then(() => { setFoto(null); setPendiente(true); void enviar(); }); } : undefined);
  }

  async function guardarNombre() {
    const limpio = borrador.trim();
    if (limpio.length < 3) { Alert.alert('Revisa tu nombre', 'Escribe al menos 3 letras.'); return; }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ data: { nombre: limpio } });
    if (error) { Alert.alert('No se pudo guardar', 'Para cambiar tu nombre necesitas conexión. Intenta cuando tengas señal.'); return; }
    setNombre(limpio); setEditando(false);
  }

  return (
    <View style={styles.caja}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" onPress={cambiarFoto} style={styles.avatar}>
        {foto ? <Image source={{ uri: foto }} style={styles.imagen} /> : <Text style={styles.iniciales}>{iniciales(nombre)}</Text>}
        <View style={styles.camara}>{subiendo ? <ActivityIndicator size="small" color={colors.white} /> : <Camera size={13} color={colors.white} />}</View>
      </Pressable>
      <View style={styles.flex}>
        {editando ? <View style={styles.filaNombre}>
          <TextInput value={borrador} onChangeText={setBorrador} autoFocus maxLength={60} style={styles.input} placeholder="Tu nombre" placeholderTextColor={colors.muted} onSubmitEditing={() => void guardarNombre()} />
          <Pressable accessibilityRole="button" accessibilityLabel="Guardar nombre" onPress={() => void guardarNombre()} style={styles.guardar}><Check size={18} color={colors.white} /></Pressable>
        </View> : <Pressable accessibilityRole="button" accessibilityLabel="Editar tu nombre" onPress={() => { setBorrador(nombre); setEditando(true); }} style={styles.filaNombre}>
          <Text style={styles.nombre} numberOfLines={1}>{nombre || 'Tu nombre'}</Text>
          <Pencil size={14} color={colors.verde} />
        </Pressable>}
        {subtitulo !== '' && <Text style={styles.subtitulo} numberOfLines={1}>{subtitulo}</Text>}
        {pendiente && !subiendo && <Text style={styles.pendiente}>La foto se sube cuando haya señal</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  caja: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' },
  imagen: { width: 64, height: 64, borderRadius: 32 },
  iniciales: { color: colors.verde, fontSize: 22, fontWeight: '900' },
  camara: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  filaNombre: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nombre: { color: colors.grafito, fontSize: 18, fontWeight: '900', flexShrink: 1 },
  subtitulo: { color: colors.muted, fontSize: 13, marginTop: 2 },
  pendiente: { color: '#775D50', fontSize: 12, fontWeight: '700', marginTop: 3 },
  input: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.crema, paddingHorizontal: 10, paddingVertical: 7, fontSize: 15, color: colors.grafito },
  guardar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center' },
});
