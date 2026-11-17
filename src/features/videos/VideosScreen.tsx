import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ImagePlus, Play, Upload, X } from 'lucide-react-native';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { createLocalId, getActiveBusinessId } from '../../infrastructure/database/database';
import { colors } from '../../shared/theme';

type PublicVideo = { id: string; business_id: string; title: string; category: string; video_path: string; created_at: string; business: { name: string; municipality: string } | null };
const categories = ['Todos', 'Comida', 'Agro', 'Tecnología', 'Servicios', 'Otros'];
const videoCategories = categories.slice(1);
const moneylessDate = (value: string) => new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

export default function VideosScreen({ canPublish = false }: { canPublish?: boolean }) {
  const [category, setCategory] = useState('Todos');
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState('Comida');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) { setVideos([]); setLoading(false); return; }
    try {
      const { data, error } = await supabase.from('videos').select('id,business_id,title,category,video_path,created_at,business:businesses(name,municipality)').eq('is_published', true).order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      setVideos((data ?? []) as unknown as PublicVideo[]);
    } catch (error) {
      Alert.alert('No pudimos cargar los videos', error instanceof Error ? error.message : 'Revisa tu conexión e intenta de nuevo.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function chooseVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso para tus videos', 'Permite el acceso a la fototeca para elegir un video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 60, quality: 1 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
      Alert.alert('El video pesa demasiado', 'El límite por video es 50 MB. Elige un clip más corto o liviano.');
      return;
    }
    setDraftUri(asset.uri);
    setDraftTitle(asset.fileName?.replace(/\.[^.]+$/, '') ?? '');
    setShowComposer(true);
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
      if (!user) throw new Error('Inicia sesión como negocio para publicar videos.');
      const response = await fetch(draftUri);
      if (!response.ok) throw new Error('No pudimos leer el video guardado en este dispositivo.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 50 * 1024 * 1024) throw new Error('El video supera el límite de 50 MB.');
      const extension = draftUri.toLowerCase().split('?')[0]?.endsWith('.mov') ? 'mov' : 'mp4';
      const contentType = extension === 'mov' ? 'video/quicktime' : 'video/mp4';
      const videoId = createLocalId('video');
      const videoPath = `${user.id}/${businessId}/videos/${videoId}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('sava-media').upload(videoPath, bytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('videos').insert({ id: videoId, business_id: businessId, title: draftTitle.trim(), category: draftCategory, video_path: videoPath, is_published: true });
      if (insertError) {
        await supabase.storage.from('sava-media').remove([videoPath]);
        throw insertError;
      }
      setDraftUri(null); setDraftTitle(''); setShowComposer(false);
      await refresh();
      Alert.alert('Video publicado', 'Ya aparece en los videos locales de Sava.');
    } catch (error) {
      Alert.alert('No se pudo publicar', error instanceof Error ? error.message : 'Revisa tu conexión e intenta de nuevo.');
    } finally { setSaving(false); }
  }

  const visibleVideos = videos.filter((video) => category === 'Todos' || video.category === category);
  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void refresh(); }} tintColor={colors.brown} />}>
    <Text style={styles.eyebrow}>DESCUBRE LO QUE SE HACE CERCA</Text>
    <Text style={styles.title}>Videos locales</Text>
    <Text style={styles.subtitle}>Conoce productos, recetas y emprendimientos de Casanare.</Text>
    {canPublish && !showComposer && <Pressable accessibilityRole="button" onPress={() => void chooseVideo()} style={styles.publishButton}><Upload size={17} color="#fff" /><Text style={styles.publishButtonText}>Publicar un video</Text></Pressable>}
    {showComposer && <View style={styles.composer}>
      <View style={styles.composerHeader}><Text style={styles.composerTitle}>Prepara tu video</Text><Pressable accessibilityRole="button" onPress={() => { setShowComposer(false); setDraftUri(null); }}><X size={19} color={colors.muted} /></Pressable></View>
      {draftUri ? <VideoPreview uri={draftUri} /> : <Pressable onPress={() => void chooseVideo()} style={styles.chooseVideo}><ImagePlus size={22} color={colors.brown} /><Text style={styles.chooseVideoText}>Elegir video del celular</Text></Pressable>}
      <Text style={styles.label}>Título</Text><TextInput value={draftTitle} onChangeText={setDraftTitle} placeholder="Ej. Así preparamos nuestro producto" style={styles.input} maxLength={80} />
      <Text style={styles.label}>Categoría</Text><View style={styles.draftCategories}>{videoCategories.map((item) => <Pressable key={item} onPress={() => setDraftCategory(item)} style={[styles.chip, draftCategory === item && styles.selectedChip]}><Text style={[styles.chipText, draftCategory === item && styles.selectedChipText]}>{item}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void publishVideo()} style={[styles.publishButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#fff" /> : <Upload size={16} color="#fff" />}<Text style={styles.publishButtonText}>{saving ? 'Subiendo video…' : 'Publicar'}</Text></Pressable>
      <Text style={styles.limit}>Máximo 60 segundos y 50 MB. Requiere conexión a internet.</Text>
    </View>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.selectedChip]}><Text style={[styles.chipText, category === item && styles.selectedChipText]}>{item}</Text></Pressable>)}</ScrollView>
    {visibleVideos.map((video) => <PublishedVideo key={video.id} video={video} />)}
    {!loading && visibleVideos.length === 0 && <View style={styles.empty}><Play size={28} color={colors.brown} /><Text style={styles.emptyTitle}>{videos.length ? 'No hay videos en esta categoría' : 'Todavía no hay videos'}</Text><Text style={styles.emptyText}>{canPublish ? 'Publica el primer video de tu negocio y compártelo con Casanare.' : 'Pronto los negocios de Casanare compartirán sus productos y servicios aquí.'}</Text></View>}
  </ScrollView>;
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; });
  return <VideoView player={player} style={styles.preview} nativeControls fullscreenOptions={{ enable: true }} contentFit="contain" />;
}

function PublishedVideo({ video }: { video: PublicVideo }) {
  const supabase = getSupabaseClient();
  const uri = supabase?.storage.from('sava-media').getPublicUrl(video.video_path).data.publicUrl;
  if (!uri) return null;
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; });
  return <View style={styles.videoCard}>
    <View style={styles.videoFrame}><VideoView player={player} style={styles.player} nativeControls fullscreenOptions={{ enable: true }} contentFit="cover" /></View>
    <View style={styles.videoInfo}><View style={styles.videoTag}><Text style={styles.videoTagText}>{video.category.toUpperCase()}</Text></View><Text style={styles.videoTitle}>{video.title}</Text><Text style={styles.seller}>{video.business?.name ?? 'Negocio local'} · {video.business?.municipality ?? 'Casanare'} · {moneylessDate(video.created_at)}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 20, paddingTop: 38, paddingBottom: 36 }, eyebrow: { color: '#636A64', fontSize: 9, fontWeight: '800', letterSpacing: 1 }, title: { color: colors.ink, fontSize: 27, fontWeight: '900', marginTop: 5 }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }, publishButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 23, backgroundColor: colors.brown, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 15 }, publishButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 }, disabled: { opacity: 0.55 }, composer: { backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: colors.line, padding: 13, marginTop: 14 }, composerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, composerTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 }, chooseVideo: { height: 150, borderRadius: 13, backgroundColor: '#E8F2EE', alignItems: 'center', justifyContent: 'center', gap: 7 }, chooseVideoText: { color: colors.brown, fontSize: 11, fontWeight: '700' }, preview: { height: 180, borderRadius: 12, backgroundColor: '#26332F' }, label: { color: colors.ink, fontWeight: '800', fontSize: 11, marginTop: 12, marginBottom: 5 }, input: { minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 11, color: colors.ink, fontSize: 12 }, draftCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, categories: { gap: 8, paddingVertical: 16 }, chip: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#F0E9DF' }, selectedChip: { backgroundColor: colors.brown }, chipText: { color: colors.ink, fontSize: 11, fontWeight: '600' }, selectedChipText: { color: '#fff' }, limit: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 8 }, videoCard: { overflow: 'hidden', backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 19, marginBottom: 13 }, videoFrame: { height: 260, backgroundColor: '#26332F' }, player: { width: '100%', height: '100%' }, videoInfo: { padding: 12 }, videoTag: { alignSelf: 'flex-start', backgroundColor: '#E8F2EE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 11 }, videoTagText: { color: colors.brown, fontWeight: '800', fontSize: 8, letterSpacing: 0.5 }, videoTitle: { color: colors.ink, fontWeight: '800', fontSize: 13, marginTop: 8 }, seller: { color: colors.muted, fontSize: 10, marginTop: 4 }, empty: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 22, alignItems: 'center' }, emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 14, marginTop: 9 }, emptyText: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 },
});
