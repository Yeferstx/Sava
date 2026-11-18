import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronRight, FileText, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../shared/theme';
import LegalScreen from './LegalScreen';
import { Casilla } from './components/BloqueAutorizacion';
import { AUTORIZACIONES, POLITICA_VERSION, type TipoAutorizacion } from './politica';
import { autorizoComunicaciones, autorizoIA, enviarSolicitud, historialAutorizaciones, misSolicitudes, registrarAutorizacion, type TipoSolicitud } from './autorizaciones';

const SOLICITUDES: Array<{ tipo: TipoSolicitud; titulo: string }> = [
  { tipo: 'consulta', titulo: 'Conocer qué datos míos tiene Sava' },
  { tipo: 'actualizacion', titulo: 'Actualizar mis datos' },
  { tipo: 'rectificacion', titulo: 'Corregir un dato' },
  { tipo: 'supresion', titulo: 'Eliminar mi cuenta y mis datos' },
  { tipo: 'revocacion', titulo: 'Revocar mi autorización' },
  { tipo: 'prueba_autorizacion', titulo: 'Recibir prueba de mi autorización' },
];

const NOMBRE_TIPO: Record<TipoAutorizacion, string> = { tratamiento_datos: 'Tratamiento de datos', comunicaciones: 'Comunicaciones', ia_externa: 'Preguntas a Gemini' };

function fecha(valor: string) {
  return new Date(valor).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// "tus datos y privacidad": politica, permisos opcionales, prueba de la autorizacion y derechos
export default function PrivacidadScreen({ usuario, onBack }: { usuario: string | null; onBack: () => void }) {
  const [verPolitica, setVerPolitica] = useState(false);
  const [ia, setIA] = useState(false);
  const [comunicaciones, setComunicaciones] = useState(false);
  const [historial, setHistorial] = useState<Awaited<ReturnType<typeof historialAutorizaciones>> | undefined>(undefined);
  const [solicitudes, setSolicitudes] = useState<Awaited<ReturnType<typeof misSolicitudes>>>([]);
  const [tipo, setTipo] = useState<TipoSolicitud | null>(null);
  const [detalle, setDetalle] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  async function cargar() {
    if (!usuario) return;
    setIA(await autorizoIA(usuario));
    setComunicaciones(await autorizoComunicaciones(usuario));
    setHistorial(await historialAutorizaciones().catch(() => null));
    setSolicitudes(await misSolicitudes().catch(() => []));
  }
  useEffect(() => { void cargar(); }, [usuario]);

  async function cambiar(cual: 'ia_externa' | 'comunicaciones', valor: boolean) {
    if (!usuario) return;
    setMensaje('');
    try {
      await registrarAutorizacion(usuario, cual, valor);
      if (cual === 'ia_externa') setIA(valor); else setComunicaciones(valor);
      setHistorial(await historialAutorizaciones().catch(() => null));
    } catch (e) { setMensaje(e instanceof Error ? e.message : 'No se pudo guardar.'); }
  }

  async function enviar() {
    if (!usuario || !tipo) return;
    setTrabajando(true); setMensaje('');
    try {
      await enviarSolicitud(usuario, tipo, detalle);
      setTipo(null); setDetalle('');
      setMensaje('Recibimos tu solicitud. Te responderemos en los plazos de la ley: hasta 10 días hábiles para consultas y 15 para reclamos.');
      setSolicitudes(await misSolicitudes().catch(() => []));
    } catch (e) { setMensaje(e instanceof Error ? e.message : 'No se pudo enviar.'); } finally { setTrabajando(false); }
  }

  if (verPolitica) return <LegalScreen onBack={() => setVerPolitica(false)} />;

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onBack}><Text style={styles.back}>‹  Volver</Text></Pressable>
    <View style={styles.cabeza}>
      <View style={styles.icono}><ShieldCheck size={26} color={colors.verde} /></View>
      <View style={styles.flex}><Text style={styles.title}>Tus datos y privacidad</Text><Text style={styles.sub}>Política vigente: versión {POLITICA_VERSION}</Text></View>
    </View>

    <Pressable accessibilityRole="button" onPress={() => setVerPolitica(true)} style={({ pressed }) => [styles.fila, pressed && styles.presionado]}>
      <FileText size={20} color={colors.verde} />
      <Text style={styles.filaTexto}>Leer aviso y Política de Tratamiento de Datos Personales</Text>
      <ChevronRight size={20} color={colors.verde} />
    </Pressable>
    <Text style={styles.nota}>Se puede leer sin internet.</Text>

    {!usuario && <Text style={styles.body}>Para ver tus autorizaciones o hacer una solicitud, inicia sesión.</Text>}

    {!!usuario && <>
      <Text style={styles.section}>Autorizaciones opcionales</Text>
      <Text style={styles.body}>Son independientes de la autorización principal. Marcarlas o quitarlas necesita internet y queda registrado.</Text>
      <View style={styles.tarjeta}>
        <Casilla marcada={ia} onCambiar={(v) => void cambiar('ia_externa', v)} texto={AUTORIZACIONES.ia_externa.texto} opcional />
        <Text style={styles.nota}>Si no lo autorizas, Aru responde solo con las reglas del celular.</Text>
        <Casilla marcada={comunicaciones} onCambiar={(v) => void cambiar('comunicaciones', v)} texto={AUTORIZACIONES.comunicaciones.texto} opcional />
      </View>

      <Text style={styles.section}>Permisos del celular</Text>
      <Text style={styles.body}>Ubicación (saber tu municipio), cámara y fotos (fotos de tus productos), micrófono (hablarle a Aru y notas de voz) y notificaciones (avisos de consultas y cobros). El celular los pide aparte la primera vez que los usas, y puedes quitarlos en los ajustes del celular. Sava funciona aunque no los des.</Text>

      <Text style={styles.section}>Prueba de tu autorización</Text>
      {historial === undefined && <ActivityIndicator color={colors.verde} />}
      {historial === null && <Text style={styles.body}>Sin internet no podemos mostrar el registro. Intenta cuando vuelva la señal.</Text>}
      {!!historial && historial.length === 0 && <Text style={styles.body}>Todavía no hay registros.</Text>}
      {!!historial && historial.slice(0, 8).map((fila) => <View key={fila.id} style={styles.registro}>
        <Text style={styles.registroTitulo}>{NOMBRE_TIPO[fila.tipo]}: {fila.otorgada ? 'autorizada' : 'no autorizada'}</Text>
        <Text style={styles.registroTexto}>{fecha(fila.creado_en)} · política {fila.version_politica} · texto {fila.version_texto}</Text>
      </View>)}

      <Text style={styles.section}>Ejercer mis derechos</Text>
      <Text style={styles.body}>Elige qué quieres pedir. Tu nombre, foto y los datos del negocio también los puedes corregir tú mismo en la app.</Text>
      {SOLICITUDES.map((item) => <Pressable key={item.tipo} accessibilityRole="radio" accessibilityState={{ checked: tipo === item.tipo }} onPress={() => setTipo(item.tipo)} style={[styles.opcion, tipo === item.tipo && styles.opcionElegida]}>
        <Text style={[styles.opcionTexto, tipo === item.tipo && styles.opcionTextoElegida]}>{item.titulo}</Text>
      </Pressable>)}
      {!!tipo && <>
        <TextInput value={detalle} onChangeText={setDetalle} placeholder="Cuéntanos el detalle (opcional)" placeholderTextColor={colors.muted} multiline maxLength={1000} style={styles.input} />
        <Pressable accessibilityRole="button" disabled={trabajando} onPress={() => void enviar()} style={styles.boton}>
          {trabajando ? <ActivityIndicator color={colors.white} /> : <Text style={styles.botonTexto}>Enviar solicitud</Text>}
        </Pressable>
      </>}
      {mensaje !== '' && <Text accessibilityRole="alert" style={styles.mensaje}>{mensaje}</Text>}
      {solicitudes.length > 0 && <>
        <Text style={styles.subtitulo}>Tus solicitudes</Text>
        {solicitudes.map((s) => <Text key={s.id} style={styles.registroTexto}>{fecha(s.creado_en)} · {SOLICITUDES.find((x) => x.tipo === s.tipo)?.titulo ?? s.tipo} · {s.estado === 'recibida' ? 'Recibida' : s.estado === 'en_tramite' ? 'En trámite' : 'Respondida'}</Text>)}
      </>}
      <Text style={styles.nota}>Si no quedas conforme con la respuesta, puedes acudir a la Superintendencia de Industria y Comercio (SIC).</Text>
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 22, paddingTop: 14, paddingBottom: 48 },
  back: { color: colors.brown, fontWeight: '700', fontSize: 15, marginBottom: 18 },
  cabeza: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  icono: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.verde, fontSize: 22, fontWeight: '900' },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.verdeClaro, borderRadius: 16, padding: 14 },
  filaTexto: { flex: 1, color: colors.verde, fontSize: 14, fontWeight: '800' },
  presionado: { opacity: 0.85 },
  tarjeta: { backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line },
  section: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 6 },
  subtitulo: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 14, marginBottom: 4 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  nota: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 4 },
  registro: { borderLeftWidth: 3, borderLeftColor: colors.verde, paddingLeft: 10, marginBottom: 8 },
  registroTitulo: { color: colors.grafito, fontSize: 14, fontWeight: '700' },
  registroTexto: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  opcion: { borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 8 },
  opcionElegida: { borderColor: colors.verde, backgroundColor: colors.verdeClaro },
  opcionTexto: { color: colors.grafito, fontSize: 14, fontWeight: '600' },
  opcionTextoElegida: { color: colors.verde, fontWeight: '800' },
  input: { minHeight: 80, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, padding: 12, fontSize: 14, color: colors.ink, textAlignVertical: 'top', marginTop: 4 },
  boton: { height: 50, borderRadius: 25, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  botonTexto: { color: colors.white, fontSize: 16, fontWeight: '800' },
  mensaje: { color: colors.verde, fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 10 },
});
