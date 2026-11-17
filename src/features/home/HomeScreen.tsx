import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronRight, MapPin, Moon, Play, Search, ShoppingBasket, Sprout, Sun, WifiOff } from 'lucide-react-native';
import CategoriaIcono from './components/CategoriaIcono';
import AsistenteOrbe from '../chat/components/AsistenteOrbe';
import { TarjetaEsqueleto } from '../../shared/components/Esqueleto';
import { detectarMunicipio, guardarMunicipio, leerMunicipioGuardado } from '../../shared/ubicacion';
import { LocateFixed } from 'lucide-react-native';
import type { Business } from '../business/types';
import type { Product } from '../inventory/types';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { cargarMercado, leerCopia, municipioDe, negocioDe, type Mercado } from '../marketplace/data/mercadoRepository';
import ProductCard from './components/ProductCard';
import SavaLogo from '../../shared/components/SavaLogo';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import ApoyoGobernacion from '../../shared/components/ApoyoGobernacion';
import { colors } from '../../shared/theme';
import { municipios } from '../../shared/validaciones';
import { categoriasAgricolas, categoriasInsumos, categoriaVisible, esInsumo } from '../../shared/agro';

type Seccion = 'cosechas' | 'insumos';

type Props = {
  municipioInicial?: string;
  seccionInicial?: Seccion;
  mostrarInvitacion: boolean;
  onProductPress: (product: Product, business: Business | null) => void;
  onVender: () => void;
  onOpenMaria: () => void;
  onOpenVideos: () => void;
};

// saludo segun la hora del dia
function saludo() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const vacio: Mercado = { products: [], negocios: [] };

// mercado: cosechas de los campesinos e insumos de las tiendas del campo.
// solo muestra publicaciones reales de supabase
export default function HomeScreen({ municipioInicial = '', seccionInicial = 'cosechas', mostrarInvitacion, onProductPress, onVender, onOpenMaria, onOpenVideos }: Props) {
  const [seccion, setSeccion] = useState<Seccion>(seccionInicial);
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState('');
  const [municipio, setMunicipio] = useState(municipioInicial);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [porUbicacion, setPorUbicacion] = useState(false);
  const [verMunicipios, setVerMunicipios] = useState(false);
  const [mercado, setMercado] = useState<Mercado>(vacio);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [copiaDe, setCopiaDe] = useState('');

  const refreshFeed = useCallback(async () => {
    if (!getSupabaseClient()) {
      setError('Sava no está conectada al servidor, así que no hay publicaciones reales para mostrar.');
      setCargando(false);
      return;
    }
    setError('');
    try {
      setMercado(await cargarMercado());
      setCopiaDe('');
    } catch {
      // sin internet: se muestra lo ultimo que se vio, avisando la fecha
      const copia = await leerCopia().catch(() => null);
      if (copia) {
        setMercado(copia);
        setCopiaDe(new Date(copia.fecha).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
      } else {
        setError('No pudimos cargar las publicaciones. Revisa tu conexión a internet e intenta de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { void refreshFeed(); }, [refreshFeed]);

  // la primera vez la app busca sola en que municipio esta la persona.
  // despues recuerda lo que eligio
  useEffect(() => {
    void leerMunicipioGuardado().then((guardado) => {
      if (guardado !== null) { setMunicipio(guardado); return; }
      void usarUbicacion(false);
    }).catch(() => undefined);
  }, []);

  async function usarUbicacion(avisar: boolean) {
    setBuscandoUbicacion(true);
    const resultado = await detectarMunicipio();
    setBuscandoUbicacion(false);
    if (resultado.motivo === 'ok') {
      setMunicipio(resultado.municipio);
      setPorUbicacion(true);
      setVerMunicipios(false);
      void guardarMunicipio(resultado.municipio).catch(() => undefined);
      return;
    }
    if (!avisar) return;
    if (resultado.motivo === 'sin-permiso') Alert.alert('Ubicación apagada', 'Permite que Sava use tu ubicación o elige tu municipio de la lista.');
    else if (resultado.motivo === 'fuera') Alert.alert('Estás fuera de Casanare', 'Elige de la lista el municipio donde quieres buscar.');
    else Alert.alert('No encontramos tu ubicación', 'Revisa que el GPS esté prendido o elige tu municipio de la lista.');
  }

  function elegirMunicipio(item: string) {
    setMunicipio(item);
    setPorUbicacion(false);
    setVerMunicipios(false);
    void guardarMunicipio(item).catch(() => undefined);
  }

  function cambiarSeccion(nueva: Seccion) {
    setSeccion(nueva);
    setCategoria('');
  }

  let listaCategorias = categoriasAgricolas;
  if (seccion === 'insumos') listaCategorias = categoriasInsumos;

  // filtros: seccion, texto, municipio y categoria. solo con cantidad disponible
  const texto = query.trim().toLowerCase();
  const filtrados: Product[] = [];
  for (const product of mercado.products) {
    if (product.stock <= 0) continue;
    const insumo = esInsumo(product.category);
    if (seccion === 'insumos' && !insumo) continue;
    if (seccion === 'cosechas' && insumo) continue;
    if (municipio !== '' && municipioDe(mercado, product) !== municipio) continue;
    if (categoria !== '' && categoriaVisible(product.category) !== categoria) continue;
    if (texto !== '') {
      const negocio = negocioDe(mercado, product);
      let nombreNegocio = '';
      if (negocio) nombreNegocio = negocio.name;
      const todo = (product.name + ' ' + product.category + ' ' + product.description + ' ' + nombreNegocio).toLowerCase();
      if (!todo.includes(texto)) continue;
    }
    filtrados.push(product);
  }

  // recien publicado: las 5 mas nuevas de los ultimos 14 dias, solo sin filtros
  const recientes: Product[] = [];
  const hace14Dias = Date.now() - 14 * 24 * 60 * 60 * 1000;
  if (texto === '' && categoria === '') {
    for (const product of filtrados) {
      if (recientes.length === 5) break;
      let fecha = product.created_at;
      if (!fecha) fecha = product.updated_at;
      if (new Date(fecha).getTime() >= hace14Dias) recientes.push(product);
    }
  }

  let nombreMunicipio = 'Todo Casanare';
  if (municipio !== '') nombreMunicipio = municipio;
  let queCosa = 'cosechas';
  if (seccion === 'insumos') queCosa = 'insumos';
  let mensajeVacio = 'Todavía no hay ' + queCosa + ' publicados.';
  if (seccion === 'cosechas') mensajeVacio = 'Todavía no hay cosechas publicadas.';
  if (municipio !== '') mensajeVacio = mensajeVacio.replace('.', ' en ' + municipio + '.');
  if (texto !== '' || categoria !== '') mensajeVacio = 'No encontramos nada con esa búsqueda.';

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refreshFeed()} tintColor={colors.brown} />}>
      <View style={styles.header}>
        <SavaLogo size="medio" />
        <Pressable accessibilityRole="button" accessibilityLabel={'Buscando en ' + nombreMunicipio + '. Toca para cambiar'} onPress={() => setVerMunicipios(!verMunicipios)} style={styles.location}>
          {porUbicacion ? <LocateFixed size={17} color={colors.brown} /> : <MapPin size={17} color={colors.brown} />}
          <View>
            <Text style={styles.locationSmall}>{buscandoUbicacion ? 'Buscando…' : porUbicacion ? 'Estás en' : 'Buscando en'}</Text>
            <Text style={styles.locationText}>{nombreMunicipio}</Text>
          </View>
          <ChevronDown size={16} color={colors.brown} />
        </Pressable>
      </View>
      {verMunicipios && <View style={styles.municipiosCaja}>
        <Pressable accessibilityRole="button" onPress={() => void usarUbicacion(true)} style={styles.miUbicacion}>
          <LocateFixed size={20} color={colors.white} /><Text style={styles.miUbicacionTexto}>{buscandoUbicacion ? 'Buscando dónde estás…' : 'Usar mi ubicación'}</Text>
        </Pressable>
        <Text style={styles.municipiosTitulo}>O elige dónde buscar:</Text>
        <View style={styles.municipios}>
          {[''].concat(municipios).map((item) => {
            let nombre = item;
            if (item === '') nombre = 'Todo Casanare';
            return <Pressable key={nombre} onPress={() => elegirMunicipio(item)} style={[styles.chip, municipio === item && styles.chipSelected]}><Text style={[styles.chipText, municipio === item && styles.chipTextSelected]}>{nombre}</Text></Pressable>;
          })}
        </View>
      </View>}

      <View style={styles.saludoFila}>
        {new Date().getHours() < 19 ? <Sun size={26} color={colors.arcilla} /> : <Moon size={24} color={colors.arcilla} />}
        <Text style={styles.greeting}>{saludo()}</Text>
      </View>
      <Text style={styles.subGreeting}>¿Qué buscas hoy del campo casanareño?</Text>

      {/* dos botones grandes: lo que se cosecha y lo que se usa para cultivar */}
      <View accessibilityRole="tablist" style={styles.secciones}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: seccion === 'cosechas' }} onPress={() => cambiarSeccion('cosechas')} style={[styles.seccion, seccion === 'cosechas' && styles.seccionActiva]}>
          <Sprout size={24} color={seccion === 'cosechas' ? colors.white : colors.verde} /><Text style={[styles.seccionTexto, seccion === 'cosechas' && styles.seccionTextoActivo]}>Cosechas</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: seccion === 'insumos' }} onPress={() => cambiarSeccion('insumos')} style={[styles.seccion, seccion === 'insumos' && styles.seccionActiva]}>
          <ShoppingBasket size={24} color={seccion === 'insumos' ? colors.white : colors.verde} /><Text style={[styles.seccionTexto, seccion === 'insumos' && styles.seccionTextoActivo]}>Insumos</Text>
        </Pressable>
      </View>

      <View style={styles.search}>
        <Search size={19} color={colors.ink} />
        <TextInput accessibilityLabel="Buscar" value={query} onChangeText={setQuery} placeholder={seccion === 'insumos' ? 'Buscar abono, semillas, veneno…' : 'Buscar piña, yuca, plátano…'} placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" maxLength={60} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categorias}>
        {listaCategorias.map((item, i) => <CategoriaIcono key={item} nombre={item} posicion={i} elegida={categoria === item} onPress={() => { if (categoria === item) setCategoria(''); else setCategoria(item); }} />)}
      </ScrollView>

      <Pressable accessibilityRole="button" onPress={onOpenMaria} style={({ pressed }) => [styles.maria, pressed && styles.presionado]}>
        <View style={styles.mariaIcono}><AsistenteOrbe estado="reposo" tamano={44} quieto /></View>
        <View style={styles.flex}><Text style={styles.mariaTitulo}>¿No lo encuentras? Pregúntale a María</Text><Text style={styles.mariaTexto}>Dile «necesito plátano en Yopal» y te dice quién lo vende.</Text></View>
        <ChevronRight size={20} color={colors.verde} />
      </Pressable>

      {mostrarInvitacion && <Pressable accessibilityRole="button" onPress={onVender} style={styles.invite}>
        <Sprout size={26} color={colors.verdeClaro} />
        <View style={styles.flex}><Text style={styles.inviteTitle}>Tu cosecha merece encontrar compradores</Text><Text style={styles.inviteBody}>¿Eres campesino o tienes tienda del campo? Toca aquí para vender.</Text></View>
      </Pressable>}

      {copiaDe !== '' && <View style={styles.copia}><WifiOff size={16} color="#775D50" /><Text style={styles.copiaTexto}>Sin internet. Ves lo que se cargó el {copiaDe}; puede haber cambiado.</Text></View>}

      {cargando && <View style={styles.grid}>{[1, 2, 3, 4].map((n) => <TarjetaEsqueleto key={n} enGrilla />)}</View>}
      {!cargando && error !== '' && <View style={styles.errorBox}>
        <WifiOff size={22} color={colors.brown} /><Text style={styles.errorText}>{error}</Text>
        {getSupabaseClient() !== null && <Pressable onPress={() => { setCargando(true); void refreshFeed(); }} style={styles.retry}><Text style={styles.retryText}>Intentar de nuevo</Text></Pressable>}
      </View>}

      {!cargando && error === '' && recientes.length > 0 && <>
        <Text style={styles.sectionTitle}>Recién publicado</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {recientes.map((product) => <ProductCard key={product.id} product={product} municipio={municipioDe(mercado, product)} onPress={() => onProductPress(product, negocioDe(mercado, product))} />)}
        </ScrollView>
      </>}

      {!cargando && error === '' && <>
        <Pressable accessibilityRole="button" onPress={onOpenVideos} style={({ pressed }) => [styles.videos, pressed && styles.presionado]}>
          <View style={styles.videosPlay}><Play size={20} color={colors.white} fill={colors.white} /></View>
          <View style={styles.flex}><Text style={styles.videosTitulo}>Videos del campo</Text><Text style={styles.videosTexto}>Mira cosechas, insumos y consejos de Casanare.</Text></View>
          <ChevronRight size={20} color={colors.white} />
        </Pressable>
        <View style={styles.tituloFila}><Text style={styles.sectionTitle}>{seccion === 'insumos' ? 'Insumos disponibles' : 'Cosechas disponibles'}</Text><BotonEscuchar etiqueta="" texto={'Hay ' + filtrados.length + (seccion === 'insumos' ? ' insumos' : ' cosechas') + ' disponibles. Toca una para ver el precio y escribirle al vendedor.'} /></View>
        <View style={styles.grid}>
          {filtrados.map((product) => <ProductCard key={product.id} enGrilla product={product} municipio={municipioDe(mercado, product)} onPress={() => onProductPress(product, negocioDe(mercado, product))} />)}
        </View>
        {filtrados.length === 0 && <Text style={styles.empty}>{mensajeVacio}</Text>}
      </>}

      <View style={styles.apoyo}><ApoyoGobernacion /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: colors.verdeClaro },
  locationText: { color: colors.brown, fontWeight: '900', fontSize: 14 },
  locationSmall: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  municipiosCaja: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 16 },
  miUbicacion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 25, backgroundColor: colors.verde },
  miUbicacionTexto: { color: colors.white, fontSize: 15, fontWeight: '900' },
  municipiosTitulo: { color: colors.grafito, fontSize: 13, fontWeight: '800', marginTop: 12, marginBottom: 8 },
  municipios: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  saludoFila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  greeting: { color: colors.ink, fontSize: 27, fontWeight: '900' },
  categorias: { paddingTop: 14, paddingBottom: 12, gap: 4 },
  presionado: { transform: [{ scale: 0.97 }] },
  maria: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1.5, borderColor: colors.salvia, padding: 14, marginBottom: 18 },
  mariaIcono: { width: 60, height: 52, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mariaTitulo: { color: colors.grafito, fontSize: 15, fontWeight: '900' }, mariaTexto: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  videos: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.grafito, borderRadius: 18, padding: 14, marginBottom: 20 },
  videosPlay: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.arcilla, alignItems: 'center', justifyContent: 'center' },
  videosTitulo: { color: colors.white, fontSize: 15, fontWeight: '900' }, videosTexto: { color: colors.verdeClaro, fontSize: 13, marginTop: 2 },
  subGreeting: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 14 },
  secciones: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  seccion: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 56, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  seccionActiva: { backgroundColor: colors.verde, borderColor: colors.verde },
  seccionTexto: { color: colors.verde, fontSize: 16, fontWeight: '800', flexShrink: 1 }, seccionTextoActivo: { color: colors.white },
  search: { height: 50, backgroundColor: colors.white, borderRadius: 25, paddingHorizontal: 16, alignItems: 'center', flexDirection: 'row', gap: 9, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  categories: { paddingTop: 14, paddingBottom: 16, gap: 8 },
  chip: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.brown, borderColor: colors.brown },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  chipTextSelected: { color: colors.white, fontWeight: '800' },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.brown, borderRadius: 18, padding: 15, marginBottom: 20 },
  inviteTitle: { color: colors.white, fontWeight: '800', fontSize: 15 },
  inviteBody: { color: colors.verdeClaro, fontSize: 13, marginTop: 3 },
  copia: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5E7E2', borderRadius: 12, padding: 11, marginBottom: 14 },
  copiaTexto: { color: '#775D50', fontSize: 13, flex: 1, lineHeight: 18 },
  loading: { marginTop: 30 },
  errorBox: { alignItems: 'center', gap: 10, padding: 20, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginTop: 6 },
  errorText: { color: colors.ink, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { backgroundColor: colors.brown, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  tituloFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 11, marginTop: 4 },
  row: { gap: 10, paddingBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: 16 },
  apoyo: { marginTop: 24 },
});
