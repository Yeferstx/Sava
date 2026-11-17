import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, MapPin, Search, Sprout, WifiOff } from 'lucide-react-native';
import type { Business } from '../business/types';
import type { Product } from '../inventory/types';
import { desdeRemoto, type RemoteProduct } from '../inventory/data/inventoryRepository';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import ProductCard from './components/ProductCard';
import SavaLogo from '../../shared/components/SavaLogo';
import { colors } from '../../shared/theme';
import { municipios } from '../../shared/validaciones';
import { categoriasAgricolas, categoriaVisible } from '../../shared/agro';

type Props = {
  municipioInicial?: string;
  mostrarInvitacion: boolean;
  onProductPress: (product: Product, business: Business | null) => void;
  onVender: () => void;
};

// inicio del comprador: solo muestra cosechas reales publicadas en supabase
export default function HomeScreen({ municipioInicial = '', mostrarInvitacion, onProductPress, onVender }: Props) {
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState('');
  const [municipio, setMunicipio] = useState(municipioInicial);
  const [verMunicipios, setVerMunicipios] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [negocios, setNegocios] = useState<Business[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const refreshFeed = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Sava no está conectada al servidor, así que no hay publicaciones reales para mostrar.');
      setCargando(false);
      return;
    }
    setError('');
    try {
      // select * para que no falle si la migracion de cosechas aun no esta aplicada
      const respuesta = await supabase.from('products').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(100);
      if (respuesta.error) throw respuesta.error;
      const lista: Product[] = [];
      const ids: string[] = [];
      for (const fila of respuesta.data) {
        const producto = desdeRemoto(fila as RemoteProduct);
        if (producto.retired === 1) continue;
        lista.push(producto);
        if (!ids.includes(producto.business_id)) ids.push(producto.business_id);
      }
      let fincas: Business[] = [];
      if (ids.length > 0) {
        const respuestaFincas = await supabase.from('businesses').select('id,name,category,description,phone,municipality').in('id', ids);
        if (respuestaFincas.error) throw respuestaFincas.error;
        fincas = respuestaFincas.data;
      }
      setProducts(lista);
      setNegocios(fincas);
    } catch {
      setError('No pudimos cargar las publicaciones. Revisa tu conexión a internet e intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { void refreshFeed(); }, [refreshFeed]);

  function negocioDe(product: Product) {
    for (const negocio of negocios) {
      if (negocio.id === product.business_id) return negocio;
    }
    return null;
  }

  function municipioDe(product: Product) {
    if (product.municipality) return product.municipality;
    const negocio = negocioDe(product);
    if (negocio && negocio.municipality) return negocio.municipality;
    return '';
  }

  // filtros: texto, municipio y categoria. solo se muestran con cantidad disponible
  const texto = query.trim().toLowerCase();
  const filtrados: Product[] = [];
  for (const product of products) {
    if (product.stock <= 0) continue;
    if (municipio !== '' && municipioDe(product) !== municipio) continue;
    if (categoria !== '' && categoriaVisible(product.category) !== categoria) continue;
    if (texto !== '') {
      const negocio = negocioDe(product);
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

  let vacio = 'Todavía no hay cosechas publicadas.';
  if (municipio !== '') vacio = 'Todavía no hay cosechas publicadas en ' + municipio + '.';
  if (texto !== '' || categoria !== '') vacio = 'No encontramos cosechas con esa búsqueda.';

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

      <Text style={styles.greeting}>Cosechas de Casanare</Text>
      <Text style={styles.subGreeting}>Compra directo a los productores de la región.</Text>
      <View style={styles.search}>
        <Search size={19} color={colors.ink} />
        <TextInput accessibilityLabel="Buscar cosechas" value={query} onChangeText={setQuery} placeholder="Buscar piña, yuca, plátano…" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" maxLength={60} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {categoriasAgricolas.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: categoria === item }} key={item} onPress={() => { if (categoria === item) setCategoria(''); else setCategoria(item); }} style={[styles.chip, categoria === item && styles.chipSelected]}><Text style={[styles.chipText, categoria === item && styles.chipTextSelected]}>{item}</Text></Pressable>)}
      </ScrollView>

      {mostrarInvitacion && <Pressable accessibilityRole="button" onPress={onVender} style={styles.invite}>
        <Sprout size={24} color={colors.verdeClaro} />
        <View style={styles.flex}><Text style={styles.inviteTitle}>Tu cosecha merece encontrar compradores</Text><Text style={styles.inviteBody}>¿Eres agricultor? Publica lo que tienes disponible.</Text></View>
      </Pressable>}

      {cargando && <ActivityIndicator color={colors.brown} style={styles.loading} />}
      {!cargando && error !== '' && <View style={styles.errorBox}>
        <WifiOff size={22} color={colors.brown} /><Text style={styles.errorText}>{error}</Text>
        {getSupabaseClient() !== null && <Pressable onPress={() => { setCargando(true); void refreshFeed(); }} style={styles.retry}><Text style={styles.retryText}>Intentar de nuevo</Text></Pressable>}
      </View>}

      {!cargando && error === '' && recientes.length > 0 && <>
        <Text style={styles.sectionTitle}>Recién publicado</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {recientes.map((product) => <ProductCard key={product.id} product={product} municipio={municipioDe(product)} onPress={() => onProductPress(product, negocioDe(product))} />)}
        </ScrollView>
      </>}

      {!cargando && error === '' && <>
        <Text style={styles.sectionTitle}>Cosechas disponibles</Text>
        <View style={styles.grid}>
          {filtrados.map((product) => <ProductCard key={product.id} enGrilla product={product} municipio={municipioDe(product)} onPress={() => onProductPress(product, negocioDe(product))} />)}
        </View>
        {filtrados.length === 0 && <Text style={styles.empty}>{vacio}</Text>}
      </>}
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
  subGreeting: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 16 },
  search: { height: 50, backgroundColor: colors.white, borderRadius: 25, paddingHorizontal: 16, alignItems: 'center', flexDirection: 'row', gap: 9, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  categories: { paddingTop: 14, paddingBottom: 16, gap: 8 },
  chip: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.brown, borderColor: colors.brown },
  chipText: { fontSize: 12, color: colors.ink, fontWeight: '600' },
  chipTextSelected: { color: colors.white, fontWeight: '800' },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.brown, borderRadius: 18, padding: 15, marginBottom: 20 },
  inviteTitle: { color: colors.white, fontWeight: '800', fontSize: 14 },
  inviteBody: { color: colors.verdeClaro, fontSize: 12, marginTop: 3 },
  loading: { marginTop: 30 },
  errorBox: { alignItems: 'center', gap: 10, padding: 20, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginTop: 6 },
  errorText: { color: colors.ink, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { backgroundColor: colors.brown, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 11, marginTop: 4 },
  row: { gap: 10, paddingBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  empty: { color: colors.muted, fontSize: 13, paddingVertical: 16 },
});
