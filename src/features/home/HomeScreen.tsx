import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, MapPin, Search, ShoppingBasket, Sprout, WifiOff } from 'lucide-react-native';
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
};

const vacio: Mercado = { products: [], negocios: [] };

// mercado: cosechas de los campesinos e insumos de las tiendas del campo.
// solo muestra publicaciones reales de supabase
export default function HomeScreen({ municipioInicial = '', seccionInicial = 'cosechas', mostrarInvitacion, onProductPress, onVender }: Props) {
  const [seccion, setSeccion] = useState<Seccion>(seccionInicial);
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState('');
  const [municipio, setMunicipio] = useState(municipioInicial);
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
        <SavaLogo size="small" />
        <Pressable accessibilityRole="button" accessibilityLabel="Elegir municipio" onPress={() => setVerMunicipios(!verMunicipios)} style={styles.location}>
          <MapPin size={15} color={colors.brown} /><Text style={styles.locationText}>{nombreMunicipio}</Text><ChevronDown size={15} color={colors.brown} />
        </Pressable>
      </View>
      {verMunicipios && <View style={styles.municipios}>
        {[''].concat(municipios).map((item) => {
          let nombre = item;
          if (item === '') nombre = 'Todo Casanare';
          return <Pressable key={nombre} onPress={() => { setMunicipio(item); setVerMunicipios(false); }} style={[styles.chip, municipio === item && styles.chipSelected]}><Text style={[styles.chipText, municipio === item && styles.chipTextSelected]}>{nombre}</Text></Pressable>;
        })}
      </View>}

      <Text style={styles.greeting}>Del campo casanareño</Text>
      <Text style={styles.subGreeting}>Compra directo a quien produce y a las tiendas del campo.</Text>

      {/* dos botones grandes: lo que se cosecha y lo que se usa para cultivar */}
      <View accessibilityRole="tablist" style={styles.secciones}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: seccion === 'cosechas' }} onPress={() => cambiarSeccion('cosechas')} style={[styles.seccion, seccion === 'cosechas' && styles.seccionActiva]}>
          <Sprout size={24} color={seccion === 'cosechas' ? colors.white : colors.verde} /><Text style={[styles.seccionTexto, seccion === 'cosechas' && styles.seccionTextoActivo]}>Cosechas</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: seccion === 'insumos' }} onPress={() => cambiarSeccion('insumos')} style={[styles.seccion, seccion === 'insumos' && styles.seccionActiva]}>
          <ShoppingBasket size={24} color={seccion === 'insumos' ? colors.white : colors.verde} /><Text style={[styles.seccionTexto, seccion === 'insumos' && styles.seccionTextoActivo]}>Insumos para el campo</Text>
        </Pressable>
      </View>

      <View style={styles.search}>
        <Search size={19} color={colors.ink} />
        <TextInput accessibilityLabel="Buscar" value={query} onChangeText={setQuery} placeholder={seccion === 'insumos' ? 'Buscar abono, semillas, veneno…' : 'Buscar piña, yuca, plátano…'} placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" maxLength={60} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {listaCategorias.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: categoria === item }} key={item} onPress={() => { if (categoria === item) setCategoria(''); else setCategoria(item); }} style={[styles.chip, categoria === item && styles.chipSelected]}><Text style={[styles.chipText, categoria === item && styles.chipTextSelected]}>{item}</Text></Pressable>)}
      </ScrollView>

      {mostrarInvitacion && <Pressable accessibilityRole="button" onPress={onVender} style={styles.invite}>
        <Sprout size={26} color={colors.verdeClaro} />
        <View style={styles.flex}><Text style={styles.inviteTitle}>Tu cosecha merece encontrar compradores</Text><Text style={styles.inviteBody}>¿Eres campesino o tienes tienda del campo? Toca aquí para vender.</Text></View>
      </Pressable>}

      {copiaDe !== '' && <View style={styles.copia}><WifiOff size={16} color="#775D50" /><Text style={styles.copiaTexto}>Sin internet. Ves lo que se cargó el {copiaDe}; puede haber cambiado.</Text></View>}

      {cargando && <ActivityIndicator color={colors.brown} style={styles.loading} />}
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
  flex: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.verdeClaro },
  locationText: { color: colors.brown, fontWeight: '800', fontSize: 12 },
  municipios: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  greeting: { color: colors.ink, fontSize: 26, fontWeight: '900', marginTop: 6 },
  subGreeting: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 14 },
  secciones: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  seccion: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 56, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  seccionActiva: { backgroundColor: colors.verde, borderColor: colors.verde },
  seccionTexto: { color: colors.verde, fontSize: 14, fontWeight: '800', flexShrink: 1 }, seccionTextoActivo: { color: colors.white },
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
