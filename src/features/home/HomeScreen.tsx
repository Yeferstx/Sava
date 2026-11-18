import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, Animated, Easing, LayoutAnimation, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, GraduationCap, LocateFixed, MapPin, MessageCircle, Mic, MoonStar, Search, Sprout, Sun, Sunrise, Sunset, WifiOff } from 'lucide-react-native';
import { ordenInicio, registrarInteres, type Interes } from '../../shared/intereses';
import { ChipCategoria } from './components/CategoriaIcono';
import AsistenteOrbe from '../chat/components/AsistenteOrbe';
import { Esqueleto, TarjetaEsqueleto } from '../../shared/components/Esqueleto';
import { detectarMunicipio, guardarMunicipio, leerMunicipioGuardado, municipioEsManual, permisoUbicacionDado } from '../../shared/ubicacion';
import { pedirReducirMovimiento } from '../../shared/movimiento';
import { useAlVolver } from '../../shared/useAlVolver';
import { getActiveBusinessId } from '../../infrastructure/database/database';
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
  onAprender?: () => void;
  onEscribir: () => void;
};

// saludo segun la hora del dia
function saludo() {
  const hora = new Date().getHours();
  if (hora < 5) return '¡Buenas noches!';
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
export default function HomeScreen({ municipioInicial = '', seccionInicial = 'cosechas', onProductPress, onVender, onHablar, onEscribir, onAprender }: Props) {
  // inicio: las dos secciones; o «ver todas» de una de ellas
  const [vista, setVista] = useState<'inicio' | Seccion>('inicio');
  // orden de las secciones (cosechas primero hasta que la persona muestre otro interes)
  const [orden, setOrden] = useState<Interes[]>(['cosechas', 'insumos']);
  useEffect(() => { void ordenInicio().then(setOrden); }, []);
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState('');
  const [municipio, setMunicipio] = useState(municipioInicial);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [verMunicipios, setVerMunicipios] = useState(false);
  const [ayudaVoz, setAyudaVoz] = useState(false);
  // la ubicacion detectada no coincide con la elegida a mano: se pregunta, no se cambia sola
  const [sugerido, setSugerido] = useState('');
  const [avisoUbicacion, setAvisoUbicacion] = useState('');
  // el inicio es para descubrir lo de otros: tus publicaciones estan en «Mis cosechas»
  const [propio, setPropio] = useState('');
  useEffect(() => { void getActiveBusinessId().then(setPropio).catch(() => undefined); }, []);
  const [mercado, setMercado] = useState<Mercado>(vacio);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [copiaDe, setCopiaDe] = useState('');
  const buscador = useRef<ComponentRef<typeof TextInput>>(null);
  // aparicion suave y escalonada de cada bloque de la pantalla
  const entrada = useRef(Array.from({ length: BLOQUES }, () => new Animated.Value(0))).current;
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
    // lo ultimo que se vio aparece al instante mientras llega lo nuevo (no se espera a internet)
    const primera = await leerCopia().catch(() => null);
    if (primera) {
      setMercado((antes) => (antes === vacio ? primera : antes));
      setCargando(false);
    }
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
  // sin senal se muestra lo guardado; al volver el internet se actualiza solo
  useAlVolver(() => { void refreshFeed(); });

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

  function elegirCategoria(item: string) {
    if (categoria === item) setCategoria('');
    else setCategoria(item);
  }

  // el microfono del buscador: abre el teclado para dictar
  function usarMicrofono() {
    setAyudaVoz(true);
    if (buscador.current) buscador.current.focus();
  }

  function abrirVista(nueva: 'inicio' | Seccion) {
    suavizar();
    setCategoria('');
    setVista(nueva);
    // tocar «ver todas» muestra interes en esa seccion
    if (nueva !== 'inicio') void registrarInteres(nueva, 1);
  }

  // abrir una publicacion cuenta como interes (una sola vez no cambia el orden)
  function abrirProducto(product: Product) {
    if (product.business_id !== propio) void registrarInteres(esInsumo(product.category) ? 'insumos' : 'cosechas', 1);
    onProductPress(product, negocioDe(mercado, product));
  }

  // ampliar: ver todo casanare sin cambiar el municipio guardado
  function ampliar() { suavizar(); setMunicipio(''); }

  const texto = query.trim().toLowerCase();

  // publicaciones de otros con cantidad disponible, separadas en cerca (el municipio) y otros municipios
  function separar(seccion: Seccion | null, conCategoria: boolean) {
    const cerca: Product[] = [];
    const otros: Product[] = [];
    // las publicaciones propias van al final (el inicio es primero para ver lo de otros)
    const propias: Product[] = [];
    for (const product of mercado.products) {
      if (product.stock <= 0) continue;
      const insumo = esInsumo(product.category);
      if (seccion === 'insumos' && !insumo) continue;
      if (seccion === 'cosechas' && insumo) continue;
      if (conCategoria && categoria !== '' && categoriaVisible(product.category) !== categoria) continue;
      if (texto !== '') {
        const negocio = negocioDe(mercado, product);
        const todo = (product.name + ' ' + product.category + ' ' + product.description + ' ' + (negocio ? negocio.name : '')).toLowerCase();
        if (!todo.includes(texto)) continue;
      }
      if (propio !== '' && product.business_id === propio) propias.push(product);
      else if (municipio === '' || municipioDe(mercado, product) === municipio) cerca.push(product);
      else otros.push(product);
    }
    return { cerca, otros, propias };
  }

  // la busqueda tambien cuenta como interes, segun lo que encontro
  function alBuscar() {
    const { cerca, otros } = separar(null, false);
    const todos = cerca.concat(otros);
    if (todos.length === 0) return;
    let insumos = 0;
    for (const p of todos) { if (esInsumo(p.category)) insumos += 1; }
    void registrarInteres(insumos > todos.length / 2 ? 'insumos' : 'cosechas', 1);
  }

  let nombreMunicipio = 'Todo Casanare';
  if (municipio !== '') nombreMunicipio = municipio;

  function tarjeta(product: Product, enGrilla: boolean) {
    const negocio = negocioDe(mercado, product);
    return <ProductCard key={product.id} enGrilla={enGrilla} propia={product.business_id === propio} product={product} municipio={municipioDe(mercado, product)} vendedor={negocio ? negocio.name : ''} onPress={() => abrirProducto(product)} />;
  }

  const nombres: Record<Seccion, { titulo: string; palabra: string; publicadas: string }> = {
    cosechas: { titulo: 'Cosechas', palabra: 'cosechas', publicadas: 'publicadas' },
    insumos: { titulo: 'Insumos', palabra: 'insumos', publicadas: 'publicados' },
  };

  // salidas cuando no hay nada: ver todo casanare o preguntarle a aru. nunca se inventa nada
  function sinResultados(textoVacio: string, conAmpliar: boolean) {
    return <View style={styles.vacioCaja}>
      <Text style={styles.vacioTexto}>{textoVacio}</Text>
      <View style={styles.vacioBotones}>
        {conAmpliar && <Pressable accessibilityRole="button" onPress={ampliar} style={({ pressed }) => [styles.vacioBoton, pressed && styles.presionado]}><MapPin size={16} color={colors.verde} /><Text style={styles.vacioBotonTexto}>Ver todo Casanare</Text></Pressable>}
        <Pressable accessibilityRole="button" onPress={onEscribir} style={({ pressed }) => [styles.vacioBoton, pressed && styles.presionado]}><MessageCircle size={16} color={colors.verde} /><Text style={styles.vacioBotonTexto}>Pregúntale a Aru</Text></Pressable>
      </View>
    </View>;
  }

  // una seccion del inicio: lo cercano en una fila; si no hay, lo de otros municipios
  function fila(seccion: Seccion) {
    const n = nombres[seccion];
    const { cerca, otros, propias } = separar(seccion, false);
    const hayCerca = cerca.length > 0;
    const deOtros = hayCerca ? cerca : otros;
    const lista = deOtros.concat(propias);
    let titulo = n.titulo + ' cerca de ti';
    if (municipio === '') titulo = n.titulo + ' en Casanare';
    if (!hayCerca && otros.length > 0) titulo = n.titulo + ' en otros municipios';
    if (deOtros.length === 0 && propias.length > 0) titulo = 'Tus ' + n.palabra;
    return <View key={seccion} style={styles.fila}>
      <View style={styles.filaTitulo}>
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{titulo}</Text>
          {hayCerca && municipio !== '' && <Text style={styles.filaSub}>En {municipio}</Text>}
          {!hayCerca && otros.length > 0 && municipio !== '' && <Text style={styles.filaSub}>En {municipio} todavía no hay {n.palabra} {n.publicadas}.</Text>}
          {deOtros.length === 0 && propias.length > 0 && <Text style={styles.filaSub}>Por ahora solo están las tuyas.</Text>}
        </View>
        {lista.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={'Ver todas las ' + n.palabra} hitSlop={8} onPress={() => abrirVista(seccion)} style={styles.verTodas}><Text style={styles.verTodasTexto}>Ver todas</Text><ChevronRight size={16} color={colors.verde} /></Pressable>}
      </View>
      {lista.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={174} snapToAlignment="start" style={styles.carrusel} contentContainerStyle={styles.carruselContenido}>
        {lista.slice(0, 10).map((p) => tarjeta(p, false))}
      </ScrollView> : sinResultados('Todavía no hay ' + n.palabra + ' ' + n.publicadas + (municipio !== '' ? ' en ' + municipio : ' en Casanare') + '. Cuando alguien publique, aparecerá aquí.', false)}
    </View>;
  }

  const hora = new Date().getHours();
  // amanecer en la manana, sol en la tarde, atardecer cerca de las 6 y luna en la noche
  let IconoSaludo = Sunrise;
  if (hora >= 12) IconoSaludo = Sun;
  if (hora >= 17) IconoSaludo = Sunset;
  if (hora >= 19 || hora < 5) IconoSaludo = MoonStar;

  // contenido segun lo que se esta viendo: busqueda, «ver todas» o las dos secciones
  let contenido: React.ReactNode = null;
  // mientras carga: las dos filas con la forma de las tarjetas (sin rueda girando)
  if (cargando) contenido = <View accessibilityLabel="Cargando publicaciones">{[0, 1].map((fila) => <View key={fila} style={styles.fila}>
    <View style={styles.filaTitulo}><Esqueleto ancho={fila === 0 ? 190 : 160} alto={18} /></View>
    <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carruselContenido}>{[1, 2, 3].map((n) => <View key={n} style={styles.esqueleto}><TarjetaEsqueleto /></View>)}</ScrollView>
  </View>)}</View>;
  else if (error !== '') contenido = <View style={styles.errorBox}>
    <WifiOff size={22} color={colors.verde} /><Text style={styles.errorText}>{error}</Text>
    {getSupabaseClient() !== null && <Pressable onPress={() => { setCargando(true); void refreshFeed(); }} style={styles.retry}><Text style={styles.retryText}>Intentar de nuevo</Text></Pressable>}
  </View>;
  else if (texto !== '') {
    const { cerca, otros, propias } = separar(null, false);
    contenido = <View>
      <Text style={[styles.sectionTitle, styles.resultadosTitulo]}>Resultados para «{query.trim()}»</Text>
      {cerca.length > 0 && <View style={styles.grid}>{cerca.map((p) => tarjeta(p, true))}</View>}
      {otros.length > 0 && <>
        <Text style={[styles.filaSub, styles.otrosTitulo]}>{cerca.length === 0 && municipio !== '' ? 'En ' + municipio + ' no hay. Esto es de otros municipios:' : 'En otros municipios de Casanare:'}</Text>
        <View style={styles.grid}>{otros.map((p) => tarjeta(p, true))}</View>
      </>}
      {propias.length > 0 && <><Text style={[styles.filaSub, styles.otrosTitulo]}>Tus publicaciones:</Text><View style={styles.grid}>{propias.map((p) => tarjeta(p, true))}</View></>}
      {cerca.length === 0 && otros.length === 0 && propias.length === 0 && sinResultados('No encontramos «' + query.trim() + '» en Sava todavía. Aru te puede ayudar a buscar algo parecido.', false)}
    </View>;
  } else if (vista !== 'inicio') {
    const n = nombres[vista];
    const lista = vista === 'insumos' ? categoriasInsumos : categoriasAgricolas;
    const { cerca, otros, propias } = separar(vista, true);
    contenido = <View>
      <Pressable accessibilityRole="button" onPress={() => abrirVista('inicio')} style={styles.volverInicio}><ArrowLeft size={18} color={colors.verde} /><Text style={styles.volverInicioTexto}>Volver al inicio</Text></Pressable>
      <Text style={styles.sectionTitle}>{n.titulo}{municipio !== '' ? ' en ' + municipio : ' en Casanare'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsFila} contentContainerStyle={styles.chips}>
        <ChipCategoria nombre="" etiqueta="Todo" elegida={categoria === ''} onPress={() => setCategoria('')} />
        {lista.map((item) => <ChipCategoria key={item} nombre={item} etiqueta={item} elegida={categoria === item} onPress={() => elegirCategoria(item)} />)}
      </ScrollView>
      {cerca.length > 0 && <View style={styles.grid}>{cerca.map((p) => tarjeta(p, true))}</View>}
      {otros.length > 0 && <>
        <Text style={[styles.filaSub, styles.otrosTitulo]}>{cerca.length === 0 ? 'En ' + municipio + ' no hay. Esto es de otros municipios:' : 'En otros municipios de Casanare:'}</Text>
        <View style={styles.grid}>{otros.map((p) => tarjeta(p, true))}</View>
      </>}
      {propias.length > 0 && <><Text style={[styles.filaSub, styles.otrosTitulo]}>Tus publicaciones:</Text><View style={styles.grid}>{propias.map((p) => tarjeta(p, true))}</View></>}
      {cerca.length === 0 && otros.length === 0 && propias.length === 0 && sinResultados('Todavía no hay ' + n.palabra + (categoria !== '' ? ' de «' + categoria + '»' : '') + ' ' + n.publicadas + (municipio !== '' ? ' en ' + municipio : '') + '.', municipio !== '')}
    </View>;
  } else contenido = <>{orden.map((seccion) => fila(seccion))}</>;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refreshFeed()} tintColor={colors.verde} />}>
      {/* encabezado compacto: logo, municipio y saludo en poco espacio */}
      <Animated.View style={[styles.header, aparecer(0)]}>
        <View style={styles.headerLado}>
          <View style={styles.saludoFila}><IconoSaludo size={16} color={colors.arcilla} strokeWidth={2} /><Text style={styles.greeting} numberOfLines={1}>{saludo()}</Text></View>
        </View>
        <SavaLogo size="regular" centrado />
        <View style={[styles.headerLado, styles.headerDerecha]}>
          <Pressable accessibilityRole="button" accessibilityLabel={'Buscando en ' + nombreMunicipio + '. Toca para cambiar el municipio'} onPress={() => { suavizar(); setVerMunicipios(!verMunicipios); }} style={({ pressed }) => [styles.location, pressed && styles.presionado]}>
            <MapPin size={15} color={colors.verde} />
            <Text style={styles.locationText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{buscandoUbicacion ? 'Buscando…' : municipio === '' ? 'Casanare' : municipio}</Text>
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

      {/* buscador: busca en cosechas e insumos a la vez */}
      <Animated.View style={aparecer(1)}>
        <Animated.View style={[styles.search, { borderColor: foco.interpolate({ inputRange: [0, 1], outputRange: [colors.line, colors.verde] }), shadowOpacity: foco.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.14] }) }]}>
          <Search size={20} color={colors.verde} />
          <TextInput ref={buscador} accessibilityLabel="Buscar cosechas e insumos" value={query} onChangeText={setQuery} onSubmitEditing={alBuscar} placeholder="Busca piña, abono, semillas…" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" maxLength={60} onFocus={() => Animated.timing(foco, { toValue: 1, duration: 180, useNativeDriver: false }).start()} onBlur={() => { setAyudaVoz(false); Animated.timing(foco, { toValue: 0, duration: 220, useNativeDriver: false }).start(); }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Buscar hablando" onPress={usarMicrofono} style={({ pressed }) => [styles.micBoton, pressed && styles.presionado]}><Mic size={20} color={colors.verde} /></Pressable>
        </Animated.View>
        {ayudaVoz && <Text style={styles.ayudaVoz}>Toca el micrófono de tu teclado y di lo que buscas.</Text>}
      </Animated.View>

      {copiaDe !== '' && <View style={styles.copia}><WifiOff size={16} color="#775D50" /><Text style={styles.copiaTexto}>Sin internet. Ves lo que se cargó el {copiaDe}; puede haber cambiado.</Text></View>}

      {/* lo principal: las publicaciones reales */}
      <Animated.View style={aparecer(2)}>{contenido}</Animated.View>

      {vista === 'inicio' && texto === '' && <>
        <View style={styles.vender}>
          <Sprout size={26} color={colors.crema} strokeWidth={1.8} />
          <View style={styles.flex}>
            <Text style={styles.venderTitulo}>¿Tienes cosecha para mostrar?</Text>
            <Text style={styles.venderTexto}>Publícala gratis y encuentra compradores.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onVender} style={({ pressed }) => [styles.venderBoton, pressed && styles.presionado]}><Text style={styles.venderBotonTexto}>Publicar</Text></Pressable>
        </View>

        {!!onAprender && <Pressable accessibilityRole="button" onPress={onAprender} style={({ pressed }) => [styles.aprende, pressed && styles.presionado]}>
          <GraduationCap size={22} color={colors.verde} />
          <View style={styles.flex}><Text style={styles.aprendeTitulo}>Aprende con Sava</Text><Text style={styles.aprendeTexto}>Fotos, descripciones, costos y cuentas</Text></View>
          <ChevronRight size={20} color={colors.verde} />
        </Pressable>}
      </>}

      <View style={styles.apoyo}><ApoyoGobernacion /></View>
    </ScrollView>
  );
}

const sombraSuave = { shadowColor: '#26332F', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 };

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  headerLado: { flex: 1 },
  headerDerecha: { alignItems: 'flex-end' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 7, borderRadius: 18, backgroundColor: colors.salvia },
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
  saludoFila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  greeting: { color: colors.verde, fontSize: 14, fontWeight: '900', flexShrink: 1 },
  presionado: { transform: [{ scale: 0.97 }] },
  search: { minHeight: 50, backgroundColor: colors.white, borderRadius: 25, paddingLeft: 16, paddingRight: 5, alignItems: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: colors.line, ...sombraSuave },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 8 },
  micBoton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' },
  ayudaVoz: { color: colors.verde, fontSize: 13, fontWeight: '700', marginTop: 6, marginLeft: 6 },
  secciones: { flexDirection: 'row', gap: 8, marginTop: 10 },
  seccion: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  seccionActiva: { backgroundColor: colors.verde, borderColor: colors.verde },
  seccionTexto: { color: colors.verde, fontSize: 15, fontWeight: '900' }, seccionTextoActivo: { color: colors.white },
  chipsFila: { marginTop: 8, marginBottom: 12, marginHorizontal: -16 },
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
  fila: { marginTop: 14 },
  filaTitulo: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  filaSub: { color: colors.muted, fontSize: 13, marginTop: 1 },
  verTodas: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  verTodasTexto: { color: colors.verde, fontSize: 14, fontWeight: '900' },
  carrusel: { marginHorizontal: -16 },
  carruselContenido: { gap: 10, paddingHorizontal: 16, paddingBottom: 4 },
  esqueleto: { width: 164 },
  vacioCaja: { padding: 14, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 10 },
  vacioTexto: { color: colors.grafito, fontSize: 14, lineHeight: 20 },
  vacioBotones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vacioBoton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.salvia },
  vacioBotonTexto: { color: colors.verde, fontSize: 13, fontWeight: '800' },
  resultadosTitulo: { marginTop: 14, marginBottom: 10 },
  otrosTitulo: { marginTop: 14, marginBottom: 8 },
  volverInicio: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, marginTop: 6 },
  volverInicioTexto: { color: colors.verde, fontSize: 14, fontWeight: '800' },
  aprende: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 12 },
  aprendeTitulo: { color: colors.grafito, fontSize: 15, fontWeight: '900' },
  aprendeTexto: { color: colors.muted, fontSize: 13, marginTop: 1 },
});
