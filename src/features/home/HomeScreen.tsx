import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronRight, ChevronUp, LocateFixed, MapPin, MessageCircle, Mic, Moon, Search, ShoppingBasket, Sprout, Sun, WifiOff } from 'lucide-react-native';
import CategoriaIcono from './components/CategoriaIcono';
import AsistenteOrbe from '../chat/components/AsistenteOrbe';
import { TarjetaEsqueleto } from '../../shared/components/Esqueleto';
import { detectarMunicipio, guardarMunicipio, leerMunicipioGuardado } from '../../shared/ubicacion';
import { pedirReducirMovimiento } from '../../shared/movimiento';
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
  onProductPress: (product: Product, business: Business | null) => void;
  // publicar: lleva al flujo de publicacion que ya existe (o a registrarse si no vende)
  onVender: () => void;
  // abre el asistente en modo voz o en modo texto
  onHablar: () => void;
  onEscribir: () => void;
};

// saludo segun la hora del dia
function saludo() {
  const hora = new Date().getHours();
  if (hora < 12) return '¡Buenos días!';
  if (hora < 19) return '¡Buenas tardes!';
  return '¡Buenas noches!';
}

// cuatro categorias rapidas con nombre corto (la categoria completa se usa para filtrar)
const rapidas: Record<Seccion, Array<{ corto: string; categoria: string }>> = {
  cosechas: [
    { corto: 'Plátano', categoria: 'Plátano y banano' },
    { corto: 'Yuca', categoria: 'Yuca y tubérculos' },
    { corto: 'Piña', categoria: 'Piña' },
    { corto: 'Papaya', categoria: 'Papaya' },
  ],
  insumos: [
    { corto: 'Semillas', categoria: 'Semillas' },
    { corto: 'Abonos', categoria: 'Abonos y fertilizantes' },
    { corto: 'Agroquímicos', categoria: 'Agroquímicos' },
    { corto: 'Herramientas', categoria: 'Herramientas' },
  ],
};

const vacio: Mercado = { products: [], negocios: [] };
const BLOQUES = 7;

// inicio: el mercado de cosechas e insumos de casanare.
// solo muestra publicaciones reales de supabase
export default function HomeScreen({ municipioInicial = '', seccionInicial = 'cosechas', onProductPress, onVender, onHablar, onEscribir }: Props) {
  const [seccion, setSeccion] = useState<Seccion>(seccionInicial);
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState('');
  const [verTodas, setVerTodas] = useState(false);
  const [municipio, setMunicipio] = useState(municipioInicial);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [verMunicipios, setVerMunicipios] = useState(false);
  const [ayudaVoz, setAyudaVoz] = useState(false);
  const [mercado, setMercado] = useState<Mercado>(vacio);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [copiaDe, setCopiaDe] = useState('');
  const buscador = useRef<ComponentRef<typeof TextInput>>(null);
  // aparicion suave y escalonada de cada bloque de la pantalla
  const entrada = useRef(Array.from({ length: BLOQUES }, () => new Animated.Value(0))).current;
  const cambioSeccion = useRef(new Animated.Value(1)).current;
  const reducir = useRef(false);

  useEffect(() => {
    void pedirReducirMovimiento().then((valor) => {
      reducir.current = valor;
      if (valor) { for (const item of entrada) item.setValue(1); return; }
      Animated.stagger(70, entrada.map((item) => Animated.timing(item, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }))).start();
    });
  }, []);

  function aparecer(i: number) {
    const subir = entrada[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
    return { opacity: entrada[i], transform: [{ translateY: subir }] };
  }

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
    setVerMunicipios(false);
    void guardarMunicipio(item).catch(() => undefined);
  }

  // al cambiar entre cosechas e insumos las categorias aparecen con un desvanecido corto
  function cambiarSeccion(nueva: Seccion) {
    if (nueva === seccion) return;
    setSeccion(nueva);
    setCategoria('');
    setVerTodas(false);
    if (reducir.current) return;
    cambioSeccion.setValue(0);
    Animated.timing(cambioSeccion, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }

  function elegirCategoria(item: string) {
    if (categoria === item) setCategoria('');
    else setCategoria(item);
  }

  // el microfono del buscador: abre el teclado para dictar.
  // cuando la app tenga reconocimiento de voz propio, aqui se conecta
  function usarMicrofono() {
    setAyudaVoz(true);
    if (buscador.current) buscador.current.focus();
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

  // recien publicado: las 6 mas nuevas de los ultimos 14 dias
  const recientes: Product[] = [];
  const hace14Dias = Date.now() - 14 * 24 * 60 * 60 * 1000;
  for (const product of filtrados) {
    if (recientes.length === 6) break;
    let fecha = product.created_at;
    if (!fecha) fecha = product.updated_at;
    if (new Date(fecha).getTime() >= hace14Dias) recientes.push(product);
  }

  let nombreMunicipio = 'Todo Casanare';
  if (municipio !== '') nombreMunicipio = municipio;
  let mensajeVacio = 'Todavía no hay cosechas publicadas.';
  if (seccion === 'insumos') mensajeVacio = 'Todavía no hay insumos publicados.';
  if (municipio !== '') mensajeVacio = mensajeVacio.replace('.', ' en ' + municipio + '.');
  if (texto !== '' || categoria !== '') mensajeVacio = 'No encontramos nada con esa búsqueda.';

  function tarjeta(product: Product, enGrilla: boolean) {
    const negocio = negocioDe(mercado, product);
    return <ProductCard key={product.id} enGrilla={enGrilla} product={product} municipio={municipioDe(mercado, product)} vendedor={negocio ? negocio.name : ''} conCategoria onPress={() => onProductPress(product, negocio)} />;
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refreshFeed()} tintColor={colors.brown} />}>
      {/* encabezado: logo y municipio */}
      <Animated.View style={[styles.header, aparecer(0)]}>
        <SavaLogo size="small" />
        <Pressable accessibilityRole="button" accessibilityLabel={'Buscando en ' + nombreMunicipio + '. Toca para cambiar el municipio'} onPress={() => setVerMunicipios(!verMunicipios)} style={({ pressed }) => [styles.location, pressed && styles.presionado]}>
          <MapPin size={18} color={colors.verde} />
          <Text style={styles.locationText} numberOfLines={1}>{buscandoUbicacion ? 'Buscando…' : nombreMunicipio}</Text>
          {verMunicipios ? <ChevronUp size={18} color={colors.verde} /> : <ChevronDown size={18} color={colors.verde} />}
        </Pressable>
      </Animated.View>
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

      {/* saludo segun la hora */}
      <Animated.View style={aparecer(1)}>
        <View style={styles.saludoFila}>
          {new Date().getHours() < 19 ? <Sun size={28} color={colors.arcilla} /> : <Moon size={26} color={colors.arcilla} />}
          <Text style={styles.greeting}>{saludo()}</Text>
        </View>
        <Text style={styles.subGreeting}>¿Qué necesitas encontrar hoy?</Text>
      </Animated.View>

      {/* cosechas o insumos, mismo ancho */}
      <Animated.View accessibilityRole="tablist" style={[styles.secciones, aparecer(2)]}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: seccion === 'cosechas' }} onPress={() => cambiarSeccion('cosechas')} style={({ pressed }) => [styles.seccion, seccion === 'cosechas' && styles.seccionActiva, pressed && styles.presionado]}>
          <Sprout size={24} color={seccion === 'cosechas' ? colors.white : colors.verde} /><Text style={[styles.seccionTexto, seccion === 'cosechas' && styles.seccionTextoActivo]}>Cosechas</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: seccion === 'insumos' }} onPress={() => cambiarSeccion('insumos')} style={({ pressed }) => [styles.seccion, seccion === 'insumos' && styles.seccionActiva, pressed && styles.presionado]}>
          <ShoppingBasket size={24} color={seccion === 'insumos' ? colors.white : colors.verde} /><Text style={[styles.seccionTexto, seccion === 'insumos' && styles.seccionTextoActivo]}>Insumos</Text>
        </Pressable>
      </Animated.View>

      {/* buscador con microfono */}
      <Animated.View style={aparecer(3)}>
        <View style={styles.search}>
          <Search size={22} color={colors.verde} />
          <TextInput ref={buscador} accessibilityLabel="Buscar" value={query} onChangeText={setQuery} placeholder={seccion === 'insumos' ? 'Busca abono, semillas, veneno…' : 'Busca piña, yuca, plátano…'} placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" maxLength={60} onBlur={() => setAyudaVoz(false)} />
          <Pressable accessibilityRole="button" accessibilityLabel="Buscar hablando" onPress={usarMicrofono} style={({ pressed }) => [styles.micBoton, pressed && styles.presionado]}><Mic size={22} color={colors.verde} /></Pressable>
        </View>
        {ayudaVoz && <Text style={styles.ayudaVoz}>Toca el micrófono de tu teclado y di lo que buscas.</Text>}
      </Animated.View>

      {/* cuatro categorias rapidas y el boton para ver todas */}
      <Animated.View style={[aparecer(4), { opacity: Animated.multiply(entrada[4], cambioSeccion) }]}>
        <View style={styles.rapidas}>
          {rapidas[seccion].map((item, i) => <CategoriaIcono key={item.categoria} nombre={item.categoria} etiqueta={item.corto} posicion={i} elegida={categoria === item.categoria} enGrilla onPress={() => elegirCategoria(item.categoria)} />)}
        </View>
        <Pressable accessibilityRole="button" onPress={() => setVerTodas(!verTodas)} style={styles.verMas}>
          <Text style={styles.verMasTexto}>{verTodas ? 'Ver menos' : 'Ver más productos'}</Text>
          {verTodas ? <ChevronUp size={18} color={colors.verde} /> : <ChevronRight size={18} color={colors.verde} />}
        </Pressable>
        {verTodas && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.todas}>
          {listaCategorias.map((item, i) => <CategoriaIcono key={item} nombre={item} posicion={i} elegida={categoria === item} onPress={() => elegirCategoria(item)} />)}
        </ScrollView>}
      </Animated.View>

      {/* tarjeta del asistente */}
      <Animated.View style={[styles.asistente, aparecer(5)]}>
        <View style={styles.asistenteOrbe}><AsistenteOrbe estado="reposo" tamano={78} /></View>
        <View style={styles.separador} />
        <View style={styles.flex}>
          <Text style={styles.asistenteTitulo}>¿No lo encuentras?</Text>
          <Text style={styles.asistenteTexto}>Tu asistente te ayuda a buscarlo.</Text>
          <View style={styles.asistenteBotones}>
            <Pressable accessibilityRole="button" accessibilityLabel="Hablar con tu asistente" onPress={onHablar} style={({ pressed }) => [styles.botonHablar, pressed && styles.presionado]}><Mic size={18} color={colors.verde} /><Text style={styles.botonTexto} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Hablar</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Escribirle a tu asistente" onPress={onEscribir} style={({ pressed }) => [styles.botonEscribir, pressed && styles.presionado]}><MessageCircle size={18} color={colors.verde} /><Text style={styles.botonTexto} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Escribir</Text></Pressable>
          </View>
        </View>
      </Animated.View>

      {/* seccion para vendedores */}
      <Animated.View style={[styles.vender, aparecer(6)]}>
        <View style={styles.venderIcono}><Sprout size={40} color={colors.crema} strokeWidth={1.8} /></View>
        <View style={styles.separadorClaro} />
        <View style={styles.flex}>
          <Text style={styles.venderTitulo}>¿Tienes productos para vender?</Text>
          <Text style={styles.venderTexto}>Encuentra compradores en Casanare.</Text>
          <Pressable accessibilityRole="button" onPress={onVender} style={({ pressed }) => [styles.venderBoton, pressed && styles.presionado]}><Text style={styles.venderBotonTexto}>Publicar mi producto</Text></Pressable>
        </View>
      </Animated.View>

      {copiaDe !== '' && <View style={styles.copia}><WifiOff size={16} color="#775D50" /><Text style={styles.copiaTexto}>Sin internet. Ves lo que se cargó el {copiaDe}; puede haber cambiado.</Text></View>}

      {cargando && <>
        <Text style={styles.sectionTitle}>Recién publicado</Text>
        <View style={styles.grid}>{[1, 2].map((n) => <TarjetaEsqueleto key={n} enGrilla />)}</View>
      </>}
      {!cargando && error !== '' && <View style={styles.errorBox}>
        <WifiOff size={22} color={colors.brown} /><Text style={styles.errorText}>{error}</Text>
        {getSupabaseClient() !== null && <Pressable onPress={() => { setCargando(true); void refreshFeed(); }} style={styles.retry}><Text style={styles.retryText}>Intentar de nuevo</Text></Pressable>}
      </View>}

      {!cargando && error === '' && recientes.length > 0 && <>
        <Text style={styles.sectionTitle}>Recién publicado</Text>
        <View style={styles.grid}>{recientes.map((product) => tarjeta(product, true))}</View>
      </>}

      {!cargando && error === '' && <>
        <View style={styles.tituloFila}><Text style={styles.sectionTitle}>{seccion === 'insumos' ? 'Todos los insumos' : 'Todas las cosechas'}</Text><BotonEscuchar etiqueta="" texto={'Hay ' + filtrados.length + (seccion === 'insumos' ? ' insumos' : ' cosechas') + ' disponibles. Toca una para ver el precio y escribirle al vendedor.'} /></View>
        <View style={styles.grid}>{filtrados.map((product) => tarjeta(product, true))}</View>
        {filtrados.length === 0 && <Text style={styles.empty}>{mensajeVacio}</Text>}
      </>}

      <View style={styles.apoyo}><ApoyoGobernacion /></View>
    </ScrollView>
  );
}

const sombraSuave = { shadowColor: '#26332F', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 };

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '58%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, backgroundColor: colors.salvia, ...sombraSuave },
  locationText: { color: colors.verde, fontWeight: '900', fontSize: 16, flexShrink: 1 },
  municipiosCaja: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 16 },
  miUbicacion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 25, backgroundColor: colors.verde },
  miUbicacionTexto: { color: colors.white, fontSize: 15, fontWeight: '900' },
  municipiosTitulo: { color: colors.grafito, fontSize: 13, fontWeight: '800', marginTop: 12, marginBottom: 8 },
  municipios: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  saludoFila: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  greeting: { color: colors.verde, fontSize: 30, fontWeight: '900', flexShrink: 1 },
  subGreeting: { color: colors.muted, fontSize: 16, marginTop: 2, marginBottom: 16 },
  presionado: { transform: [{ scale: 0.97 }] },
  secciones: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  seccion: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 58, paddingHorizontal: 10, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, ...sombraSuave },
  seccionActiva: { backgroundColor: colors.verde, borderColor: colors.verde },
  seccionTexto: { color: colors.verde, fontSize: 17, fontWeight: '900', flexShrink: 1 }, seccionTextoActivo: { color: colors.white },
  search: { minHeight: 58, backgroundColor: colors.white, borderRadius: 29, paddingLeft: 18, paddingRight: 6, alignItems: 'center', flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: colors.line, ...sombraSuave },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 8 },
  micBoton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' },
  ayudaVoz: { color: colors.verde, fontSize: 13, fontWeight: '700', marginTop: 8, marginLeft: 6 },
  rapidas: { flexDirection: 'row', marginTop: 16 },
  verMas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  verMasTexto: { color: colors.grafito, fontSize: 15, fontWeight: '800' },
  todas: { gap: 4, paddingBottom: 6 },
  asistente: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 24, paddingVertical: 14, paddingLeft: 4, paddingRight: 14, marginTop: 8, marginBottom: 14, ...sombraSuave },
  asistenteOrbe: { width: 86, height: 96, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  separador: { width: 1, alignSelf: 'stretch', backgroundColor: colors.line, marginVertical: 8 },
  asistenteTitulo: { color: colors.grafito, fontSize: 19, fontWeight: '900' },
  asistenteTexto: { color: colors.muted, fontSize: 14, marginTop: 2, lineHeight: 19 },
  asistenteBotones: { flexDirection: 'row', gap: 8, marginTop: 10 },
  botonHablar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.salvia },
  botonEscribir: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.crema },
  botonTexto: { color: colors.verde, fontSize: 15, fontWeight: '900' },
  vender: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.verde, borderRadius: 24, padding: 16, marginBottom: 20, ...sombraSuave },
  venderIcono: { width: 52, alignItems: 'center' },
  separadorClaro: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(240,233,223,0.35)' },
  venderTitulo: { color: colors.white, fontSize: 17, fontWeight: '900' },
  venderTexto: { color: colors.verdeClaro, fontSize: 14, marginTop: 3 },
  venderBoton: { alignItems: 'center', backgroundColor: colors.crema, borderRadius: 22, paddingVertical: 11, marginTop: 12 },
  venderBotonTexto: { color: colors.verde, fontSize: 15, fontWeight: '900' },
  chip: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.brown, borderColor: colors.brown },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  chipTextSelected: { color: colors.white, fontWeight: '800' },
  copia: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5E7E2', borderRadius: 12, padding: 11, marginBottom: 14 },
  copiaTexto: { color: '#775D50', fontSize: 13, flex: 1, lineHeight: 18 },
  errorBox: { alignItems: 'center', gap: 10, padding: 20, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginTop: 6 },
  errorText: { color: colors.ink, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { backgroundColor: colors.brown, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  tituloFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  sectionTitle: { color: colors.grafito, fontSize: 21, fontWeight: '900', marginBottom: 12, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: 16 },
  apoyo: { marginTop: 24 },
});
