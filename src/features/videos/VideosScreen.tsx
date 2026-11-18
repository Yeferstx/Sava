import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { optimizarFoto } from '../../shared/fotos';
import type { Business } from '../business/types';
import { useEvent } from 'expo';
import { Esqueleto } from '../../shared/components/Esqueleto';
import { useAlVolver } from '../../shared/useAlVolver';
import { ImagePlus, MessageCircle, Play, Plus, Share2, Sparkles, Upload, Volume2, VolumeX, X } from 'lucide-react-native';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { createLocalId, getActiveBusinessId } from '../../infrastructure/database/database';
import { colors } from '../../shared/theme';
import { limpiarTelefono } from '../../shared/validaciones';

type PublicVideo = { id: string; business_id: string; title: string; category: string; video_path: string; created_at: string; thumb_path?: string | null; business: { name: string; municipality: string; phone: string } | null };
// videos del campo: cosechas, insumos, consejos y recetas
const categories = ['Todos', 'Cosechas', 'Insumos', 'Consejos del campo', 'Recetas', 'Otros'];
const videoCategories = categories.slice(1);
const fechaCorta = (value: string) => new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

type Props = { canPublish?: boolean; onVender?: () => void; onOpenMaria?: () => void; onOpenProductor?: (business: Business) => void };

// videos por tanda: se cargan de a pocos, no todos a la vez
const TANDA = 8;

// videos a pantalla completa, uno debajo del otro, como tiktok.
// se desliza hacia arriba para ver el siguiente y se toca para pausar
export default function VideosScreen({ canPublish = false, onVender, onOpenMaria, onOpenProductor }: Props) {
  const [category, setCategory] = useState('Todos');
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [alto, setAlto] = useState(0);
  const [actual, setActual] = useState(0);
  const [silencio, setSilencio] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState('Cosechas');
  const [saving, setSaving] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [hayMas, setHayMas] = useState(true);
  const cargandoMas = useRef(false);
  // al volver la senal, los videos que fallaron se intentan de nuevo solos
  const [reintento, setReintento] = useState(0);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) { setVideos([]); setLoading(false); return; }
    try {
      // select * para que no falle si la migracion de portadas aun no esta aplicada
      const { data, error } = await supabase.from('videos').select('*, business:businesses(name,municipality,phone)').eq('is_published', true).order('created_at', { ascending: false }).range(0, TANDA - 1);
      if (error) throw error;
      setVideos((data ?? []) as unknown as PublicVideo[]);
      setHayMas((data ?? []).length === TANDA);
      setErrorCarga(false);
    } catch {
      setErrorCarga(true);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useAlVolver(() => { setReintento((n) => n + 1); if (videos.length === 0) void refresh(); });

  // la siguiente tanda se pide cuando faltan pocos videos por ver
  async function cargarMas() {
    const supabase = getSupabaseClient();
    if (!supabase || !hayMas || cargandoMas.current || videos.length === 0) return;
    cargandoMas.current = true;
    try {
      const { data, error } = await supabase.from('videos').select('*, business:businesses(name,municipality,phone)').eq('is_published', true).order('created_at', { ascending: false }).range(videos.length, videos.length + TANDA - 1);
      if (error) throw error;
      const nuevos = (data ?? []) as unknown as PublicVideo[];
      setVideos((actuales) => actuales.concat(nuevos.filter((n) => !actuales.some((a) => a.id === n.id))));
      setHayMas(nuevos.length === TANDA);
    } catch { /* se intenta de nuevo al seguir bajando */ }
    finally { cargandoMas.current = false; }
  }

  // cual video se ve en pantalla: ese es el que suena
  const alCambiarVisible = useRef(({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
    if (viewableItems.length > 0 && typeof viewableItems[0].index === 'number') setActual(viewableItems[0].index);
  }).current;

  async function chooseVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso para tus videos', 'Permite el acceso a tus fotos y videos para elegir uno.');
      return;
    }
    // se comprime a 960x540 (h264): pesa menos, carga rapido y se ve en android y iphone
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 60, videoExportPreset: ImagePicker.VideoExportPreset.H264_960x540, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
      Alert.alert('El video pesa demasiado', 'El límite por video es 50 MB. Elige un video más corto.');
      return;
    }
    setDraftUri(asset.uri);
    let titulo = '';
    if (asset.fileName) titulo = asset.fileName.replace(/\.[^.]+$/, '');
    setDraftTitle(titulo);
  }

  function cerrarComposer() {
    setShowComposer(false);
    setDraftUri(null);
    setDraftTitle('');
  }

  async function publishVideo() {
    if (!draftUri || !draftTitle.trim()) {
      Alert.alert('Completa el video', 'Elige un video y escribe un título.');
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) { Alert.alert('No hay conexión', 'Conecta Sava con Supabase para publicar videos.'); return; }
    setSaving(true);
    try {
      const [{ data: { user }, error: userError }, businessId] = await Promise.all([supabase.auth.getUser(), getActiveBusinessId()]);
      if (userError) throw userError;
      if (!user) throw new Error('Inicia sesión para publicar videos.');
      const response = await fetch(draftUri);
      if (!response.ok) throw new Error('No pudimos leer el video guardado en este celular.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 50 * 1024 * 1024) throw new Error('El video supera el límite de 50 MB.');
      let extension = 'mp4';
      if (draftUri.toLowerCase().split('?')[0].endsWith('.mov')) extension = 'mov';
      let contentType = 'video/mp4';
      if (extension === 'mov') contentType = 'video/quicktime';
      const videoId = createLocalId('video');
      const videoPath = user.id + '/' + businessId + '/videos/' + videoId + '.' + extension;
      const { error: uploadError } = await supabase.storage.from('sava-media').upload(videoPath, bytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;
      // portada: una imagen del segundo 1, pequena, para mostrar mientras carga el video
      let thumbPath: string | null = null;
      try {
        const miniatura = await VideoThumbnails.getThumbnailAsync(draftUri, { time: 1000, quality: 0.7 });
        const portada = await optimizarFoto(miniatura.uri, 720);
        const bytesPortada = await (await fetch(portada)).arrayBuffer();
        const rutaPortada = user.id + '/' + businessId + '/videos/' + videoId + '.jpg';
        const subida = await supabase.storage.from('sava-media').upload(rutaPortada, bytesPortada, { contentType: 'image/jpeg', upsert: true });
        if (!subida.error) thumbPath = subida.data.path;
      } catch { /* sin portada el video igual se publica */ }
      let { error: insertError } = await supabase.from('videos').insert({ id: videoId, business_id: businessId, title: draftTitle.trim(), category: draftCategory, video_path: videoPath, is_published: true, thumb_path: thumbPath });
      // si falta la columna de portada (migracion sin aplicar) se publica sin ella
      if (insertError && insertError.code === 'PGRST204') insertError = (await supabase.from('videos').insert({ id: videoId, business_id: businessId, title: draftTitle.trim(), category: draftCategory, video_path: videoPath, is_published: true })).error;
      if (insertError) {
        await supabase.storage.from('sava-media').remove([videoPath]);
        throw insertError;
      }
      cerrarComposer();
      await refresh();
      setActual(0);
      Alert.alert('Video publicado', 'Ya lo pueden ver en Sava.');
    } catch (error) {
      Alert.alert('No se pudo publicar', error instanceof Error ? error.message : 'Revisa tu conexión e intenta de nuevo.');
    } finally { setSaving(false); }
  }

  const visibles: PublicVideo[] = [];
  for (const video of videos) {
    if (category === 'Todos' || video.category === category) visibles.push(video);
  }

  let vacioTitulo = 'Todavía no hay videos';
  if (videos.length > 0) vacioTitulo = 'No hay videos de ' + category.toLowerCase();

  return <View style={styles.pantalla} onLayout={(e) => setAlto(e.nativeEvent.layout.height)}>
    {loading && <View style={styles.esqueleto}>
      <View style={styles.esqueletoInfo}><Esqueleto oscuro ancho="35%" alto={12} /><Esqueleto oscuro ancho="80%" alto={20} /><Esqueleto oscuro ancho="60%" alto={12} /></View>
      <View style={styles.esqueletoAcciones}><Esqueleto oscuro ancho={46} alto={46} radio={23} /><Esqueleto oscuro ancho={46} alto={46} radio={23} /><Esqueleto oscuro ancho={46} alto={46} radio={23} /></View>
    </View>}

    {!loading && visibles.length > 0 && alto > 0 && <FlatList
      data={visibles}
      keyExtractor={(item) => item.id}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={alCambiarVisible}
      viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
      getItemLayout={(_, index) => ({ length: alto, offset: alto * index, index })}
      windowSize={3}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      removeClippedSubviews
      onRefresh={() => { setLoading(true); void refresh(); }}
      refreshing={false}
      renderItem={({ item, index }) => <VideoCompleto video={item} alto={alto} activo={index === actual} silencio={silencio} onSilencio={() => setSilencio(!silencio)} onOpenMaria={onOpenMaria} onOpenProductor={onOpenProductor} reintento={reintento} />}
      onEndReached={() => void cargarMas()}
      onEndReachedThreshold={2}
    />}

    {!loading && errorCarga && videos.length === 0 && <View style={styles.vacio}>
      <Text style={styles.vacioTitulo}>No pudimos cargar los videos</Text>
      <Text style={styles.vacioTexto}>Revisa tu señal. Cuando vuelva el internet se cargan solos.</Text>
      <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void refresh(); }} style={styles.vacioBoton}><Text style={styles.vacioBotonTexto}>Intentar de nuevo</Text></Pressable>
    </View>}
    {!loading && !(errorCarga && videos.length === 0) && visibles.length === 0 && <View style={styles.vacio}>
      <View style={styles.vacioIcono}><Play size={34} color={colors.white} fill={colors.white} /></View>
      <Text style={styles.vacioTitulo}>{vacioTitulo}</Text>
      <Text style={styles.vacioTexto}>{canPublish ? 'Sube el primer video: muestra tu cosecha o tus productos.' : 'Pronto los campesinos y tiendas de Casanare mostrarán aquí su trabajo.'}</Text>
      {canPublish && <Pressable accessibilityRole="button" onPress={() => setShowComposer(true)} style={styles.vacioBoton}><Upload size={18} color={colors.grafito} /><Text style={styles.vacioBotonTexto}>Subir un video</Text></Pressable>}
      {!canPublish && !!onVender && <Pressable accessibilityRole="button" onPress={onVender} style={styles.vacioBoton}><Upload size={18} color={colors.grafito} /><Text style={styles.vacioBotonTexto}>¿Vendes? Regístrate y sube videos</Text></Pressable>}
    </View>}

    {/* arriba: titulo, boton de subir y categorias encima del video */}
    <View pointerEvents="box-none" style={styles.arriba}>
      <View style={styles.arribaFila}>
        <Text style={styles.titulo}>Videos del campo</Text>
        {canPublish && <Pressable accessibilityRole="button" accessibilityLabel="Subir un video" onPress={() => setShowComposer(true)} style={styles.subir}><Plus size={18} color={colors.grafito} /><Text style={styles.subirTexto}>Subir</Text></Pressable>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categorias}>
        {categories.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => { setCategory(item); setActual(0); }} style={[styles.chip, category === item && styles.chipActivo]}><Text style={[styles.chipTexto, category === item && styles.chipTextoActivo]}>{item}</Text></Pressable>)}
      </ScrollView>
    </View>

    <Modal visible={showComposer} animationType="slide" presentationStyle="pageSheet" onRequestClose={cerrarComposer}>
      <ScrollView style={styles.composer} contentContainerStyle={styles.composerContenido} keyboardShouldPersistTaps="handled">
        <View style={styles.composerHeader}><Text style={styles.composerTitle}>Subir un video</Text><Pressable accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10} onPress={cerrarComposer}><X size={24} color={colors.grafito} /></Pressable></View>
        {draftUri ? <VideoPreview uri={draftUri} /> : <Pressable accessibilityRole="button" onPress={() => void chooseVideo()} style={styles.chooseVideo}><ImagePlus size={30} color={colors.verde} /><Text style={styles.chooseVideoText}>Elegir video del celular</Text><Text style={styles.limit}>Hasta 60 segundos. Mejor grabado de forma vertical.</Text></Pressable>}
        {!!draftUri && <Pressable onPress={() => void chooseVideo()}><Text style={styles.cambiar}>Cambiar video</Text></Pressable>}
        <Text style={styles.label}>¿De qué trata?</Text>
        <TextInput value={draftTitle} onChangeText={setDraftTitle} placeholder="Ej. Así cosechamos la piña en Aguazul" placeholderTextColor={colors.muted} style={styles.input} maxLength={80} />
        <Text style={styles.label}>Categoría</Text>
        <View style={styles.draftCategories}>{videoCategories.map((item) => <Pressable key={item} onPress={() => setDraftCategory(item)} style={[styles.draftChip, draftCategory === item && styles.draftChipActivo]}><Text style={[styles.draftChipTexto, draftCategory === item && styles.draftChipTextoActivo]}>{item}</Text></Pressable>)}</View>
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void publishVideo()} style={[styles.publicar, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.white} /> : <Upload size={18} color={colors.white} />}<Text style={styles.publicarTexto}>{saving ? 'Subiendo video…' : 'Publicar video'}</Text></Pressable>
        <Text style={styles.limit}>Máximo 60 segundos y 50 MB. Necesita internet.</Text>
      </ScrollView>
    </Modal>
  </View>;
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => { instance.loop = true; });
  return <VideoView player={player} style={styles.preview} nativeControls contentFit="contain" />;
}

type ItemProps = { video: PublicVideo; alto: number; activo: boolean; silencio: boolean; onSilencio: () => void; onOpenMaria?: () => void; onOpenProductor?: (business: Business) => void; reintento: number };

// un video a pantalla completa. la lista solo deja montados los videos cercanos,
// asi no se descargan todos a la vez
function VideoCompleto({ video, alto, activo, silencio, onSilencio, onOpenMaria, onOpenProductor, reintento }: ItemProps) {
  const [pausado, setPausado] = useState(false);
  const [intento, setIntento] = useState(0);
  const supabase = getSupabaseClient();
  let uri = '';
  if (supabase) uri = supabase.storage.from('sava-media').getPublicUrl(video.video_path).data.publicUrl;
  // el numero de intento cambia la fuente para volver a cargar si fallo
  let fuente = null;
  if (uri !== '') {
    let direccion = uri;
    if (intento > 0) direccion = uri + '?intento=' + intento;
    fuente = { uri: direccion };
  }
  const player = useVideoPlayer(fuente, (instance) => {
    instance.loop = true;
    instance.muted = silencio;
    // empezar a reproducir con poco video descargado (conexiones lentas del campo)
    instance.bufferOptions = { preferredForwardBufferDuration: 6, waitsToMinimizeStalling: false, minBufferForPlayback: 1 };
  });
  // estado del video: cargando, listo o con error
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    player.muted = silencio;
  }, [player, silencio]);

  // solo suena el video que se esta viendo, y apenas este listo
  useEffect(() => {
    if (activo && !pausado && status === 'readyToPlay') player.play();
    if (!activo || pausado) player.pause();
  }, [player, activo, pausado, status]);

  // al pasar a otro video se quita la pausa
  useEffect(() => { if (!activo) setPausado(false); }, [activo]);
  // volvio la senal: si este video habia fallado, se intenta otra vez
  useEffect(() => { if (reintento > 0 && status === 'error') setIntento((n) => n + 1); }, [reintento]);
  const portada = video.thumb_path && supabase ? supabase.storage.from('sava-media').getPublicUrl(video.thumb_path).data.publicUrl : null;

  let vendedor = 'Vendedor de Casanare';
  let municipio = 'Casanare';
  let telefono = '';
  if (video.business) { vendedor = video.business.name; municipio = video.business.municipality; telefono = video.business.phone; }

  async function escribir() {
    if (telefono === '') { Alert.alert('Contacto no disponible', 'Este vendedor no tiene teléfono registrado.'); return; }
    const mensaje = 'Hola, vi tu video «' + video.title + '» en Sava y quisiera más información.';
    try { await Linking.openURL('https://wa.me/57' + limpiarTelefono(telefono) + '?text=' + encodeURIComponent(mensaje)); }
    catch { Alert.alert('No se pudo abrir WhatsApp', 'Revisa que WhatsApp esté instalado.'); }
  }

  async function compartir() {
    try { await Share.share({ message: 'Mira este video en Sava: «' + video.title + '» de ' + vendedor + ', ' + municipio + '.' }); }
    catch { /* la persona cerro el menu */ }
  }

  return <View style={[styles.item, { height: alto }]}>
    {/* contain: se ve el video completo, sin cortarlo */}
    {fuente !== null && <VideoView player={player} style={styles.video} nativeControls={false} contentFit="contain" />}
    {/* portada mientras carga: nunca queda la pantalla vacia */}
    {!!portada && status !== 'readyToPlay' && <Image source={{ uri: portada }} style={styles.video} resizeMode="contain" accessibilityElementsHidden />}
    <Pressable accessibilityRole="button" accessibilityLabel={pausado ? 'Reproducir video' : 'Pausar video'} onPress={() => setPausado(!pausado)} style={styles.toque}>
      {status === 'loading' && activo && <View style={styles.cargandoVideo}><ActivityIndicator size="large" color={colors.white} /><Text style={styles.cargandoTexto}>Cargando video…</Text></View>}
      {status === 'error' && <View style={styles.cargandoVideo}><Text style={styles.cargandoTexto}>No se pudo cargar este video.</Text><Pressable accessibilityRole="button" onPress={() => setIntento(intento + 1)} style={styles.reintentar}><Text style={styles.reintentarTexto}>Intentar de nuevo</Text></Pressable></View>}
      {pausado && status === 'readyToPlay' && <View style={styles.pausa}><Play size={40} color={colors.white} fill={colors.white} /></View>}
    </Pressable>

    <View pointerEvents="box-none" style={styles.info}>
      <Text style={styles.etiquetaTexto}>{video.category}</Text>
      <Text style={styles.videoTitulo} numberOfLines={2}>{video.title}</Text>
      {/* quien lo publico: abre su perfil */}
      <Pressable accessibilityRole="button" accessibilityLabel={'Ver perfil de ' + vendedor} disabled={!onOpenProductor || !video.business} onPress={() => { if (onOpenProductor && video.business) onOpenProductor({ id: video.business_id, name: video.business.name, category: '', description: '', municipality: video.business.municipality, phone: video.business.phone }); }} style={styles.productor}>
        <Text style={styles.vendedor} numberOfLines={1}>{vendedor} · {municipio} · {fechaCorta(video.created_at)}</Text>
        {!!onOpenProductor && !!video.business && <Text style={styles.verPerfil}>Ver perfil ›</Text>}
      </Pressable>
    </View>

    <View style={styles.acciones}>
      <Pressable accessibilityRole="button" accessibilityLabel="Escribir al vendedor por WhatsApp" onPress={() => void escribir()} style={styles.accion}>
        <View style={[styles.accionCirculo, styles.accionVerde]}><MessageCircle size={22} color={colors.white} /></View><Text style={styles.accionTexto}>Escribir</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Compartir video" onPress={() => void compartir()} style={styles.accion}>
        <View style={styles.accionCirculo}><Share2 size={20} color={colors.white} /></View><Text style={styles.accionTexto}>Compartir</Text>
      </Pressable>
      {!!onOpenMaria && <Pressable accessibilityRole="button" accessibilityLabel="Preguntarle a Aru" onPress={onOpenMaria} style={styles.accion}>
        <View style={[styles.accionCirculo, styles.accionArcilla]}><Sparkles size={20} color={colors.grafito} /></View><Text style={styles.accionTexto}>Aru</Text>
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={silencio ? 'Activar sonido' : 'Quitar sonido'} onPress={onSilencio} style={styles.accion}>
        <View style={styles.accionCirculo}>{silencio ? <VolumeX size={20} color={colors.white} /> : <Volume2 size={20} color={colors.white} />}</View><Text style={styles.accionTexto}>{silencio ? 'Mudo' : 'Sonido'}</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.grafito },
  esqueleto: { flex: 1, justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end', padding: 14, paddingBottom: 20, gap: 14 },
  esqueletoInfo: { flex: 1, gap: 8 },
  esqueletoAcciones: { gap: 14 },
  cargandoVideo: { alignItems: 'center', gap: 10 },
  cargandoTexto: { color: colors.white, fontSize: 14, fontWeight: '700' },
  reintentar: { backgroundColor: colors.arcilla, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  reintentarTexto: { color: colors.grafito, fontSize: 14, fontWeight: '900' },
  item: { width: '100%', backgroundColor: colors.grafito },
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  productor: { alignSelf: 'flex-start', marginTop: 2 },
  verPerfil: { color: colors.arcilla, fontSize: 13, fontWeight: '900', marginTop: 2 },
  toque: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pausa: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(38,51,47,0.55)', alignItems: 'center', justifyContent: 'center', paddingLeft: 6 },
  info: { position: 'absolute', left: 14, right: 84, bottom: 16, padding: 10, borderRadius: 14, backgroundColor: 'rgba(38,51,47,0.55)' },
  etiquetaTexto: { color: colors.arcilla, fontSize: 12, fontWeight: '900', marginBottom: 2 },
  videoTitulo: { color: colors.white, fontSize: 16, fontWeight: '900', lineHeight: 21 },
  vendedor: { color: colors.verdeClaro, fontSize: 12, fontWeight: '600', marginTop: 4 },
  acciones: { position: 'absolute', right: 10, bottom: 16, alignItems: 'center', gap: 12 },
  accion: { alignItems: 'center', gap: 4 },
  accionCirculo: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(38,51,47,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  accionVerde: { backgroundColor: colors.verde, borderColor: colors.verde },
  accionArcilla: { backgroundColor: colors.arcilla, borderColor: colors.arcilla },
  accionTexto: { color: colors.white, fontSize: 11, fontWeight: '800', textShadowColor: 'rgba(38,51,47,0.8)', textShadowRadius: 4 },
  arriba: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 8 },
  arribaFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  titulo: { color: colors.white, fontSize: 20, fontWeight: '900', textShadowColor: 'rgba(38,51,47,0.8)', textShadowRadius: 6 },
  subir: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.arcilla, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  subirTexto: { color: colors.grafito, fontSize: 14, fontWeight: '900' },
  categorias: { gap: 6, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(38,51,47,0.55)' },
  chipActivo: { backgroundColor: colors.white, borderColor: colors.white },
  chipTexto: { color: colors.white, fontSize: 12, fontWeight: '700' }, chipTextoActivo: { color: colors.grafito, fontWeight: '900' },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 10 },
  vacioIcono: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center', paddingLeft: 5 },
  vacioTitulo: { color: colors.white, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  vacioTexto: { color: colors.verdeClaro, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  vacioBoton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.arcilla, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 13, marginTop: 8 },
  vacioBotonTexto: { color: colors.grafito, fontSize: 15, fontWeight: '900' },
  composer: { flex: 1, backgroundColor: colors.crema },
  composerContenido: { padding: 22, paddingTop: 26, paddingBottom: 40 },
  composerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  composerTitle: { color: colors.grafito, fontSize: 24, fontWeight: '900' },
  chooseVideo: { height: 220, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.verde, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  chooseVideoText: { color: colors.verde, fontSize: 16, fontWeight: '900' },
  preview: { width: '100%', height: 320, borderRadius: 20, backgroundColor: colors.grafito },
  cambiar: { color: colors.verde, fontSize: 14, fontWeight: '800', textAlign: 'center', padding: 10 },
  label: { color: colors.grafito, fontSize: 14, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: colors.grafito, fontSize: 15 },
  draftCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  draftChip: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  draftChipActivo: { backgroundColor: colors.verde, borderColor: colors.verde },
  draftChipTexto: { color: colors.grafito, fontSize: 13, fontWeight: '700' }, draftChipTextoActivo: { color: colors.white },
  publicar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, borderRadius: 27, backgroundColor: colors.verde, marginTop: 24 },
  publicarTexto: { color: colors.white, fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  limit: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
