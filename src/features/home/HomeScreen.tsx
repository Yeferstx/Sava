import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, Animated, Easing, LayoutAnimation, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, LocateFixed, MapPin, MessageCircle, Mic, MoonStar, Search, ShoppingBasket, Sprout, Sun, Sunset, WifiOff } from 'lucide-react-native';
import { ChipCategoria } from './components/CategoriaIcono';
import AsistenteOrbe from '../chat/components/AsistenteOrbe';
import { TarjetaEsqueleto } from '../../shared/components/Esqueleto';
import { detectarMunicipio, guardarMunicipio, leerMunicipioGuardado, municipioEsManual, permisoUbicacionDado } from '../../shared/ubicacion';
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



const vacio: Mercado = { products: [], negocios: [] };

// abrir o cerrar secciones (municipios, mas categorias) con una transicion suave
function suavizar() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}
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
  // la ubicacion detectada no coincide con la elegida a mano: se pregunta, no se cambia sola
  const [sugerido, setSugerido] = useState('');
  const [avisoUbicacion, setAvisoUbicacion] = useState('');
  const [mercado, setMercado] = useState<Mercado>(vacio);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [copiaDe, setCopiaDe] = useState('');
  const buscador = useRef<ComponentRef<typeof TextInput>>(null);
  // aparicion suave y escalonada de cada bloque de la pantalla
  const entrada = useRef(Array.from({ length: BLOQUES }, () => new Animated.Value(0))).current;
  const cambioSeccion = useRef(new Animated.Value(1)).current;
  // el buscador responde al tocarlo: borde verde y sombra un poco mayor
  const foco = useRef(new Animated.Value(0)).current;
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

  // al abrir la app se revisa otra vez donde esta la persona.
  // si eligio el municipio a mano, se respeta y solo se sugiere el detectado
  useEffect(() => {
    void (async () => {
      const guardado = await leerMunicipioGuardado().catch(() => null);
      const manual = await municipioEsManual().catch(() => false);
      if (guardado !== null) setMunicipio(guardado);
      if (manual) {
        if (!(await permisoUbicacionDado())) return;
        const resultado = await detectarMunicipio();
        if (resultado.motivo === 'ok' && resultado.municipio !== guardado) setSugerido(resultado.municipio);
        return;
      }
      setBuscandoUbicacion(true);
      const resultado = await detectarMunicipio();
      setBuscandoUbicacion(false);
      if (resultado.motivo === 'ok') {
        setMunicipio(resultado.municipio);
        void guardarMunicipio(resultado.municipio, false).catch(() => undefined);
      } else if (guardado !== null && guardado !== '') {
        setAvisoUbicacion('No pudimos confirmar tu ubicación. Te mostramos ' + guardado + '.');
      }
    })();
  }, []);

  async function usarUbicacion(avisar: boolean) {
    setBuscandoUbicacion(true);
    const resultado = await detectarMunicipio();
    setBuscandoUbicacion(false);
    if (resultado.motivo === 'ok') {
      setMunicipio(resultado.municipio);
      setVerMunicipios(false);
      setSugerido('');
      setAvisoUbicacion('');
      void guardarMunicipio(resultado.municipio, false).catch(() => undefined);
      return;
    }
    if (!avisar) return;
    if (resultado.motivo === 'sin-permiso') Alert.alert('Ubicación apagada', 'Permite que Sava use tu ubicación o elige tu municipio de la lista.');
    else if (resultado.motivo === 'fuera') Alert.alert('Estás fuera de Casanare', 'Elige de la lista el municipio donde quieres buscar.');
    else Alert.alert('No encontramos tu ubicación', 'Revisa que el GPS esté prendido o elige tu municipio de la lista.');
  }

  function elegirMunicipio(item: string) {
    suavizar();
    setMunicipio(item);
    setVerMunicipios(false);
    setSugerido('');
    setAvisoUbicacion('');
    void guardarMunicipio(item, true).catch(() => undefined);
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

  const texto = query.trim().toLowerCase();

  // cerca de ti: lo del municipio elegido primero; lo demas de casanare despues
  const cerca: Product[] = [];
  const otros: Product[] = [];
  for (const product of mercado.products) {
    if (product.stock <= 0) continue;
    const insumo = esInsumo(product.category);
    if (seccion === 'insumos' && !insumo) continue;
    if (seccion === 'cosechas' && insumo) continue;
    if (categoria !== '' && categoriaVisible(product.category) !== categoria) continue;
    if (texto !== '') {
      const negocio = negocioDe(mercado, product);
      const todo = (product.name + ' ' + product.category + ' ' + product.description + ' ' + (negocio ? negocio.name : '')).toLowerCase();
      if (!todo.includes(texto)) continue;
    }
    if (municipio === '' || municipioDe(mercado, product) === municipio) cerca.push(product);
    else otros.push(product);
  }

  let nombreMunicipio = 'Todo Casanare';
  if (municipio !== '') nombreMunicipio = municipio;
  const palabra = seccion === 'insumos' ? 'insumos' : 'cosechas';
  let tituloCerca = seccion === 'insumos' ? 'Insumos disponibles' : 'Cosechas disponibles';
  if (municipio !== '') tituloCerca = (seccion === 'insumos' ? 'Insumos en ' : 'Cosechas en ') + municipio;
  let mensajeVacio = 'Todavía no hay ' + palabra + ' publicadas' + (seccion === 'insumos' ? '' : '') + '.';
  if (seccion === 'insumos') mensajeVacio = 'Todavía no hay insumos publicados.';
  if (municipio !== '') mensajeVacio = mensajeVacio.replace('.', ' en ' + municipio + '.') + (otros.length > 0 ? ' Mira más abajo lo de otros municipios.' : '');
  if (texto !== '' || categoria !== '') mensajeVacio = 'No encontramos nada con esa búsqueda' + (municipio !== '' ? ' en ' + municipio : '') + '.';

  function tarjeta(product: Product) {
    const negocio = negocioDe(mercado, product);
    return <ProductCard key={product.id} enGrilla product={product} municipio={municipioDe(mercado, product)} vendedor={negocio ? negocio.name : ''} onPress={() => onProductPress(product, negocio)} />;
  }

  const hora = new Date().getHours();
  let IconoSaludo = Sun;
  if (hora >= 17 && hora < 19) IconoSaludo = Sunset;
  if (hora >= 19 || hora < 5) IconoSaludo = MoonStar;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refreshFeed()} tintColor={colors.verde} />}>
      {/* 1. logo centrado y municipio a la derecha, compacto */}
      <Animated.View style={[styles.header, aparecer(0)]}>
        <View style={styles.headerLado} />
        <SavaLogo size="encabezado" centrado />
        <View style={[styles.headerLado, styles.headerDerecha]}>
          <Pressable accessibilityRole="button" accessibilityLabel={'Buscando en ' + nombreMunicipio + '. Toca para cambiar el municipio'} onPress={() => { suavizar(); setVerMunicipios(!verMunicipios); }} style={({ pressed }) => [styles.location, pressed && styles.presionado]}>
            <MapPin size={15} color={colors.verde} />
            <Text style={styles.locationText} numberOfLines={1}>{buscandoUbicacion ? 'Buscando…' : municipio === '' ? 'Casanare' : municipio}</Text>
            {verMunicipios ? <ChevronUp size={15} color={colors.verde} /> : <ChevronDown size={15} color={colors.verde} />}
          </Pressable>
        </View>
      </Animated.View>
      {verMunicipios && <View style={styles.municipiosCaja}>
        <Pressable accessibilityRole="button" onPress={() => void usarUbicacion(true)} style={styles.miUbicacion}>
          <LocateFixed size={20} color={colors.white} /><Text style={styles.miUbicacionTexto}>{buscandoUbicacion ? 'Buscando dónde estás…' : 'Usar mi ubicación actual'}</Text>
        </Pressable>
        <Text style={styles.municipiosTitulo}>O elige dónde buscar (se queda fijo):</Text>
        <View style={styles.municipios}>
          {[''].concat(municipios).map((item) => {
            let nombre = item;
            if (item === '') nombre = 'Todo Casanare';
            return <Pressable key={nombre} onPress={() => elegirMunicipio(item)} style={[styles.chip, municipio === item && styles.chipSelected]}><Text style={[styles.chipText, municipio === item && styles.chipTextSelected]}>{nombre}</Text></Pressable>;
          })}
        </View>
      </View>}
      {sugerido !== '' && <View style={styles.sugerencia}>
        <LocateFixed size={16} color={colors.verde} />
        <Text style={styles.sugerenciaTexto}>Parece que estás en {sugerido}. ¿Buscar ahí?</Text>
        <Pressable accessibilityRole="button" onPress={() => elegirMunicipio(sugerido)} style={styles.sugerenciaSi}><Text style={styles.sugerenciaSiTexto}>Sí</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setSugerido('')} hitSlop={8}><Text style={styles.sugerenciaNo}>No</Text></Pressable>
      </View>}
      {avisoUbicacion !== '' && <Text style={styles.avisoUbicacion}>{avisoUbicacion}</Text>}

      {/* 2. saludo breve */}
      <Animated.View style={[styles.saludoFila, aparecer(1)]}>
        <IconoSaludo size={22} color={colors.arcilla} strokeWidth={1.8} />
        <Text style={styles.greeting}>{saludo()}</Text>
      </Animated.View>

      {/* 3. buscador con microfono */}
      <Animated.View style={aparecer(2)}>
        <Animated.View style={[styles.search, { borderColor: foco.interpolate({ inputRange: [0, 1], outputRange: [colors.line, colors.verde] }), shadowOpacity: foco.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.14] }) }]}>
          <Search size={20} color={colors.verde} />
          <TextInput ref={buscador} accessibilityLabel="Buscar" value={query} onChangeText={setQuery} placeholder={seccion === 'insumos' ? 'Busca abono, semillas…' : 'Busca piña, yuca, plátano…'} placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" maxLength={60} onFocus={() => Animated.timing(foco, { toValue: 1, duration: 180, useNativeDriver: false }).start()} onBlur={() => { setAyudaVoz(false); Animated.timing(foco, { toValue: 0, duration: 220, useNativeDriver: false }).start(); }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Buscar hablando" onPress={usarMicrofono} style={({ pressed }) => [styles.micBoton, pressed && styles.presionado]}><Mic size={20} color={colors.verde} /></Pressable>
        </Animated.View>
        {ayudaVoz && <Text style={styles.ayudaVoz}>Toca el micrófono de tu teclado y di lo que buscas.</Text>}
      </Animated.View>

      {/* 4. cosechas o insumos */}
      <Animated.View accessibilityRole="tablist" style={[styles.secciones, aparecer(3)]}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: seccion === 'cosechas' }} onPress={() => cambiarSeccion('cosechas')} style={({ pressed }) => [styles.seccion, seccion === 'cosechas' && styles.seccionActiva, pressed && styles.presionado]}>
          <Sprout size={19} color={seccion === 'cosechas' ? colors.white : colors.verde} /><Text style={[styles.seccionTexto, seccion === 'cosechas' && styles.seccionTextoActivo]}>Cosechas</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: seccion === 'insumos' }} onPress={() => cambiarSeccion('insumos')} style={({ pressed }) => [styles.seccion, seccion === 'insumos' && styles.seccionActiva, pressed && styles.presionado]}>
          <ShoppingBasket size={19} color={seccion === 'insumos' ? colors.white : colors.verde} /><Text style={[styles.seccionTexto, seccion === 'insumos' && styles.seccionTextoActivo]}>Insumos</Text>
        </Pressable>
      </Animated.View>

      {/* 5. categorias compactas en una fila */}
      <Animated.View style={[aparecer(4), { opacity: Animated.multiply(entrada[4], cambioSeccion) }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsFila} contentContainerStyle={styles.chips}>
          <ChipCategoria nombre="" etiqueta="Todo" elegida={categoria === ''} onPress={() => setCategoria('')} />
          {listaCategorias.map((item) => <ChipCategoria key={item} nombre={item} etiqueta={item} elegida={categoria === item} onPress={() => elegirCategoria(item)} />)}
        </ScrollView>
      </Animated.View>

      {copiaDe !== '' && <View style={styles.copia}><WifiOff size={16} color="#775D50" /><Text style={styles.copiaTexto}>Sin internet. Ves lo que se cargó el {copiaDe}; puede haber cambiado.</Text></View>}

      {/* 6. lo disponible cerca */}
      <Animated.View style={aparecer(5)}>
        <View style={styles.tituloFila}>
          <Text style={styles.sectionTitle}>{tituloCerca}</Text>
          {!cargando && error === '' && <BotonEscuchar etiqueta="" texto={'Hay ' + cerca.length + ' ' + palabra + ' disponibles' + (municipio !== '' ? ' en ' + municipio : '') + '. Toca una para conocerla y contactar al productor.'} />}
        </View>
        {cargando && <View style={styles.grid}>{[1, 2].map((n) => <TarjetaEsqueleto key={n} enGrilla />)}</View>}
        {!cargando && error !== '' && <View style={styles.errorBox}>
          <WifiOff size={22} color={colors.verde} /><Text style={styles.errorText}>{error}</Text>
          {getSupabaseClient() !== null && <Pressable onPress={() => { setCargando(true); void refreshFeed(); }} style={styles.retry}><Text style={styles.retryText}>Intentar de nuevo</Text></Pressable>}
        </View>}
        {!cargando && error === '' && <>
          <View style={styles.grid}>{cerca.slice(0, 6).map((product) => tarjeta(product))}</View>
          {cerca.length === 0 && <Text style={styles.empty}>{mensajeVacio}</Text>}
        </>}
      </Animated.View>

      {/* 7. el asistente, compacto */}
      <Animated.View style={[styles.asistente, aparecer(6)]}>
        <View style={styles.asistenteOrbe}><AsistenteOrbe estado="reposo" tamano={60} /></View>
        <View style={styles.flex}>
          <Text style={styles.asistenteTitulo}>¿No lo encuentras?</Text>
          <Text style={styles.asistenteTexto}>Tu asistente te ayuda a buscar o a publicar.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Hablar con tu asistente" onPress={onHablar} style={({ pressed }) => [styles.asistenteBoton, pressed && styles.presionado]}><Mic size={19} color={colors.white} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Escribirle a tu asistente" onPress={onEscribir} style={({ pressed }) => [styles.asistenteBoton, styles.asistenteBotonSuave, pressed && styles.presionado]}><MessageCircle size={19} color={colors.verde} /></Pressable>
      </Animated.View>

      {/* 8. mas publicaciones y productores */}
      {!cargando && error === '' && (cerca.length > 6 || otros.length > 0) && <>
        <Text style={[styles.sectionTitle, styles.masTitulo]}>{municipio !== '' ? 'Más ' + palabra + ' en Casanare' : 'Más ' + palabra}</Text>
        <View style={styles.grid}>{cerca.slice(6).concat(otros).map((product) => tarjeta(product))}</View>
      </>}

      <View style={styles.vender}>
        <Sprout size={26} color={colors.crema} strokeWidth={1.8} />
        <View style={styles.flex}>
          <Text style={styles.venderTitulo}>¿Tienes cosecha para mostrar?</Text>
          <Text style={styles.venderTexto}>Publícala gratis y encuentra compradores.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onVender} style={({ pressed }) => [styles.venderBoton, pressed && styles.presionado]}><Text style={styles.venderBotonTexto}>Publicar</Text></Pressable>
      </View>

      <View style={styles.apoyo}><ApoyoGobernacion /></View>
    </ScrollView>
  );
}

const sombraSuave = { shadowColor: '#26332F', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 };

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerLado: { flex: 1 },
  headerDerecha: { alignItems: 'flex-end' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 18, backgroundColor: colors.salvia },
  locationText: { color: colors.verde, fontWeight: '900', fontSize: 13, flexShrink: 1 },
  municipiosCaja: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 12 },
  miUbicacion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 24, backgroundColor: colors.verde },
  miUbicacionTexto: { color: colors.white, fontSize: 15, fontWeight: '900' },
  municipiosTitulo: { color: colors.grafito, fontSize: 13, fontWeight: '800', marginTop: 12, marginBottom: 8 },
  municipios: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  sugerencia: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.salvia, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8 },
  sugerenciaTexto: { flex: 1, color: colors.verde, fontSize: 13, fontWeight: '700' },
  sugerenciaSi: { backgroundColor: colors.verde, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  sugerenciaSiTexto: { color: colors.white, fontWeight: '900', fontSize: 13 },
  sugerenciaNo: { color: colors.verde, fontWeight: '800', fontSize: 13 },
  avisoUbicacion: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  saludoFila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  greeting: { color: colors.verde, fontSize: 22, fontWeight: '900', flexShrink: 1 },
  presionado: { transform: [{ scale: 0.97 }] },
  search: { minHeight: 50, backgroundColor: colors.white, borderRadius: 25, paddingLeft: 16, paddingRight: 5, alignItems: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: colors.line, ...sombraSuave },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 8 },
  micBoton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' },
  ayudaVoz: { color: colors.verde, fontSize: 13, fontWeight: '700', marginTop: 6, marginLeft: 6 },
  secciones: { flexDirection: 'row', gap: 8, marginTop: 10 },
  seccion: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  seccionActiva: { backgroundColor: colors.verde, borderColor: colors.verde },
  seccionTexto: { color: colors.verde, fontSize: 15, fontWeight: '900' }, seccionTextoActivo: { color: colors.white },
  chipsFila: { marginTop: 10, marginHorizontal: -16 },
  chips: { gap: 7, paddingHorizontal: 16 },
  tituloFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  sectionTitle: { color: colors.grafito, fontSize: 19, fontWeight: '900', flexShrink: 1 },
  masTitulo: { marginTop: 4, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  empty: { color: colors.muted, fontSize: 14, lineHeight: 20, paddingVertical: 12 },
  asistente: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 22, paddingVertical: 8, paddingLeft: 4, paddingRight: 10, marginTop: 16, marginBottom: 14, ...sombraSuave },
  asistenteOrbe: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  asistenteTitulo: { color: colors.grafito, fontSize: 16, fontWeight: '900' },
  asistenteTexto: { color: colors.muted, fontSize: 13, marginTop: 1, lineHeight: 17 },
  asistenteBoton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center' },
  asistenteBotonSuave: { backgroundColor: colors.salvia },
  vender: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.verde, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, marginTop: 18 },
  venderTitulo: { color: colors.white, fontSize: 15, fontWeight: '900' },
  venderTexto: { color: colors.verdeClaro, fontSize: 13, marginTop: 2 },
  venderBoton: { backgroundColor: colors.crema, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  venderBotonTexto: { color: colors.verde, fontSize: 14, fontWeight: '900' },
  chip: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.verde, borderColor: colors.verde },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  chipTextSelected: { color: colors.white, fontWeight: '800' },
  copia: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5E7E2', borderRadius: 12, padding: 10, marginTop: 10 },
  copiaTexto: { color: '#775D50', fontSize: 13, flex: 1, lineHeight: 18 },
  errorBox: { alignItems: 'center', gap: 10, padding: 20, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  errorText: { color: colors.ink, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { backgroundColor: colors.verde, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  apoyo: { marginTop: 18 },
});
