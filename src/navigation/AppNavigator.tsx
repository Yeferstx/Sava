import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, BackHandler, Easing, PanResponder, Platform, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { User } from '@supabase/supabase-js';
import ChatScreen from '../features/chat/ChatScreen';
import { useAssistantChat } from '../features/chat/hooks/useAssistantChat';
import HomeScreen from '../features/home/HomeScreen';
import BusinessDetailScreen from '../features/business/BusinessDetailScreen';
import type { Business } from '../features/business/types';
import ProductDetailScreen from '../features/marketplace/ProductDetailScreen';
import type { Product } from '../features/inventory/types';
import BusinessDashboardScreen from '../features/account/BusinessDashboardScreen';
import ProfileScreen from '../features/account/ProfileScreen';
import AuthScreen from '../features/auth/AuthScreen';
import BusinessSetupScreen, { type RemoteBusiness } from '../features/auth/BusinessSetupScreen';
import { cacheRemoteBusiness } from '../features/business/data/businessRepository';
import { cacheRemoteProducts } from '../features/inventory/data/inventoryRepository';
import InventoryScreen from '../features/inventory/InventoryScreen';
import PublishScreen from '../features/inventory/PublishScreen';
import { getActiveBusinessId, getDatabase, setActiveBusinessId } from '../infrastructure/database/database';
import { getSupabaseClient } from '../infrastructure/supabase/client';
import { estadoSincronizacion, syncPendingChanges } from '../infrastructure/sync/syncService';
import { borrarDatosPrivados } from '../infrastructure/database/database';
import CuadernoScreen from '../features/cuaderno/CuadernoScreen';
import PedirCuenta from '../shared/components/PedirCuenta';
import AvisoConexion from '../shared/components/AvisoConexion';
import FotoPerfil from '../shared/components/FotoPerfil';
import NotificacionesScreen from '../features/notificaciones/NotificacionesScreen';
import { alCambiarNotificaciones, borrarNotificaciones, contarSinLeer, contarSinLeerDe, crearNotificacion, revisarNovedades } from '../features/notificaciones/notificacionesRepository';
import AprendeScreen from '../features/aprende/AprendeScreen';
import PromocionarScreen from '../features/promocion/PromocionarScreen';
import { escucharSenal } from '../features/chat/pendientes';
import { getBusinessProfile } from '../features/business/data/businessRepository';
import SalesScreen from '../features/sales/SalesScreen';
import RoleScreen from '../features/auth/RoleScreen';
import { CATEGORIA_TIENDA, type Rol } from '../shared/roles';
import GuardadosScreen from '../features/favoritos/GuardadosScreen';
import LegalScreen from '../features/legal/LegalScreen';
import { cacheRemoteSales } from '../features/sales/data/salesRepository';
import VideosScreen from '../features/videos/VideosScreen';
import MariaFlotante from '../features/chat/MariaFlotante';
import SeguimientoModal from '../features/seguimiento/SeguimientoModal';
import { pendientesDeSeguimiento, type Seguimiento } from '../features/seguimiento/seguimientoRepository';
import OrderCheckoutScreen from '../features/orders/OrderCheckoutScreen';
import OrdersScreen from '../features/orders/OrdersScreen';
import TabBar, { alturaBarra } from '../shared/components/TabBar';
import { colors } from '../shared/theme';
import SavaLogo from '../shared/components/SavaLogo';
import type { AppTab } from './types';

type AppStage = 'loading' | 'demo' | 'guest' | 'signedOut' | 'checkingBusiness' | 'chooseRole' | 'setupBusiness' | 'signedIn' | 'error';
type OrderIntent = { product: Product; business: Business; quantity: number };

// rol y municipio que la persona eligio al crear la cuenta
function datoUsuario(user: User | null, campo: string) {
  if (!user || !user.user_metadata) return '';
  const valor = user.user_metadata[campo];
  if (typeof valor === 'string') return valor;
  return '';
}

function describeError(error: unknown) {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const details = [value.message, value.details, value.hint, value.code].filter((part) => typeof part === 'string' && part.length > 0);
    if (details.length) return details.join(' · ');
    try { return JSON.stringify(error); } catch { return 'Error desconocido'; }
  }
  return error instanceof Error ? error.message : 'Error desconocido';
}

// cada pantalla entra con un desvanecido corto al cambiar de seccion
function PantallaAnimada({ children }: { children: React.ReactNode }) {
  const valor = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(valor, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, []);
  return <Animated.View style={{ flex: 1, opacity: valor }}>{children}</Animated.View>;
}

export default function AppNavigator() {
  const [activeTab, setActiveTab] = useState<AppTab>('Inicio');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<{ product: Product; business: Business | null } | null>(null);
  const [orderIntent, setOrderIntent] = useState<OrderIntent | null>(null);
  const [ordersMode, setOrdersMode] = useState<'customer' | 'business'>('business');
  const [draftForPublish, setDraftForPublish] = useState<import('../features/chat/types').ProductDraft | null>(null);
  const [stage, setStage] = useState<AppStage>('loading');
  const [merchantIntent, setMerchantIntent] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [startupError, setStartupError] = useState('');
  const [productoEditar, setProductoEditar] = useState<Product | null>(null);
  const [volverLegal, setVolverLegal] = useState<AppTab>('Inicio');
  const [volverDeMaria, setVolverDeMaria] = useState<AppTab>('Inicio');
  const [modoChat, setModoChat] = useState<'voz' | 'texto' | 'publicar' | ''>('');
  // ventas que la app le pregunta al vendedor si se hicieron
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [verSeguimiento, setVerSeguimiento] = useState(false);
  // promocionar con sava: la publicacion elegida y los datos de la finca
  const [promocion, setPromocion] = useState<{ product: Product; business: Business | null } | null>(null);
  const [volverAprende, setVolverAprende] = useState<AppTab>('Inicio');
  // visitante: se explica por que hace falta cuenta y, al entrar, se vuelve a lo que estaba haciendo
  const [pedirCuenta, setPedirCuenta] = useState<{ motivo: string; destino: AppTab } | null>(null);
  const [despuesDeEntrar, setDespuesDeEntrar] = useState<AppTab | null>(null);
  const [modoAuth, setModoAuth] = useState<'signIn' | 'signUp'>('signIn');
  // notificaciones sin leer (campana y numero en la barra)
  const [sinLeer, setSinLeer] = useState(0);
  const [consultasNuevas, setConsultasNuevas] = useState(0);
  const ultimaPregunta = useRef(0);
  // quien vende: campesino (finca) o tienda del campo
  const [tipoNegocio, setTipoNegocio] = useState<'agricultor' | 'tienda'>('agricultor');
  let tipoChat: 'agricultor' | 'tienda' | '' = '';
  if (stage === 'signedIn') tipoChat = tipoNegocio;
  const chat = useAssistantChat(tipoChat, { onPromocionar: (product) => void abrirPromocion(product), onAprender: () => abrirAprende('María') });
  const bordes = useSafeAreaInsets();
  const pantallaAncho = useWindowDimensions().width;
  const supabase = getSupabaseClient();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await getDatabase();
        if (!supabase) { if (active) setStage('demo'); return; }
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        setUser(data.session?.user ?? null);
        setStage(data.session ? 'checkingBusiness' : 'guest');
      } catch (error) {
        if (active) { setStartupError(error instanceof Error ? error.message : 'No pudimos iniciar Sava.'); setStage('error'); }
      }
    })();
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); setMerchantIntent(false); setActiveTab('Inicio'); setStage('guest'); }
      else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') { setUser(session?.user ?? null); setStage(session ? 'checkingBusiness' : 'signedOut'); }
    }).data.subscription;
    return () => { active = false; subscription?.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    if (stage !== 'checkingBusiness' || !user || !supabase) return;
    let active = true;
    void (async () => {
      let phase = 'consultar el negocio de tu cuenta';
      try {
        const { data: business, error } = await supabase.from('businesses').select('id,owner_id,name,category,description,phone,municipality,is_published').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (error) throw error;
        if (!active) return;
        if (!business) {
          const rol = datoUsuario(user, 'rol');
          setActiveTab('Inicio');
          if (rol === 'tienda') setTipoNegocio('tienda');
          else setTipoNegocio('agricultor');
          if (merchantIntent || rol === 'agricultor' || rol === 'tienda') setStage('setupBusiness');
          else if (rol === 'comprador') setStage('guest');
          else setStage('chooseRole');
          return;
        }
        if (business.category === CATEGORIA_TIENDA) setTipoNegocio('tienda');
        else setTipoNegocio('agricultor');
        phase = 'preparar el negocio guardado en el dispositivo';
        await setActiveBusinessId(business.id);
        await cacheRemoteBusiness(business);
        phase = 'sincronizar los cambios pendientes';
        await syncPendingChanges();
        phase = 'cargar los productos del negocio';
        // select * para que no falle si la migracion de cosechas aun no esta aplicada
        const { data: products, error: productError } = await supabase.from('products').select('*').eq('business_id', business.id).order('created_at', { ascending: false });
        if (productError) throw productError;
        await cacheRemoteProducts(products ?? []);
        phase = 'cargar las ventas del negocio';
        const { data: sales, error: salesError } = await supabase.from('sales').select('id,business_id,total_cop,sold_at').eq('business_id', business.id).order('sold_at', { ascending: false }).limit(100);
        if (salesError) throw salesError;
        const saleIds = (sales ?? []).map((sale) => sale.id);
        phase = 'cargar los productos de las ventas';
        const { data: items, error: itemsError } = saleIds.length ? await supabase.from('sale_items').select('id,sale_id,product_id,quantity,unit_price_cop').in('sale_id', saleIds) : { data: [], error: null };
        if (itemsError) throw itemsError;
        phase = 'guardar las ventas en el dispositivo';
        await cacheRemoteSales(sales ?? [], items ?? []);
        if (active) setStage('signedIn');
      } catch (error) {
        if (active) { setStartupError(`Falló al ${phase}: ${describeError(error)}`); setStage('error'); }
      }
    })();
    return () => { active = false; };
  }, [stage, user, supabase, merchantIntent]);

  // al entrar y al volver a abrir la app se revisa si hay ventas por confirmar.
  // la ventana sale sola maximo cada 4 horas para no molestar
  function revisarSeguimiento(mostrar: boolean) {
    void pendientesDeSeguimiento().then((lista) => {
      setSeguimientos(lista);
      const ahora = Date.now();
      if (mostrar && lista.length > 0 && ahora - ultimaPregunta.current > 4 * 60 * 60 * 1000) {
        ultimaPregunta.current = ahora;
        setVerSeguimiento(true);
      }
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (stage !== 'signedIn') return;
    const espera = setTimeout(() => revisarSeguimiento(true), 3500);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') { void syncPendingChanges().catch(() => undefined); revisarSeguimiento(true); }
    });
    return () => { clearTimeout(espera); subscription.remove(); };
  }, [stage]);

  function seguimientoListo(id: string) {
    const quedan = seguimientos.filter((item) => item.id !== id);
    setSeguimientos(quedan);
    if (quedan.length === 0) setVerSeguimiento(false);
  }

  function navigate(tab: AppTab) {
    if (tab === 'María') { openChat(); return; }
    setSelectedBusiness(null); setSelectedProduct(null); setProductoEditar(null); setActiveTab(tab);
    if (tab === 'Pedidos') setOrdersMode('business');
  }
  async function abrirPromocion(product: Product) {
    let business: Business | null = null;
    try {
      const finca = await getBusinessProfile();
      if (finca) business = { id: finca.id, name: finca.name, category: finca.category, description: finca.description, phone: finca.phone, municipality: finca.city } as Business;
    } catch { /* se promociona sin el nombre de la finca */ }
    setPromocion({ product, business });
    setActiveTab('Promocionar');
  }
  function elegirComoPublicar() {
    Alert.alert('¿Cómo quieres publicar?', 'Puedes escribir los datos o decírselos a tu asistente.', [
      { text: 'Decirlo con mi voz', onPress: publicarConVoz },
      { text: 'Escribir los datos', onPress: () => navigate('Publicar') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }
  function publicarConVoz() {
    chat.iniciarPublicacion();
    openChat('publicar');
  }
  function abrirAprende(volver: AppTab) { setVolverAprende(volver); setActiveTab('Aprende'); }
  function abrirLegal(volver: AppTab) { setVolverLegal(volver); setActiveTab('Legal'); }
  function editarCosecha(product: Product) { setProductoEditar(product); setDraftForPublish(null); setActiveTab('Publicar'); }
  function rolElegido(rol: Rol) {
    if (rol === 'agricultor' || rol === 'tienda') { setTipoNegocio(rol); setStage('setupBusiness'); return; }
    setMerchantIntent(false);
    setActiveTab('Inicio');
    setStage('guest');
  }
  function volverDePublicar() {
    let volver: AppTab = 'Inicio';
    if (draftForPublish) volver = 'María';
    if (productoEditar) volver = 'Inventario';
    setProductoEditar(null);
    setActiveTab(volver);
  }
  // volver a la pantalla anterior (boton atras de android y gesto de deslizar en iphone).
  // devuelve false si ya no hay a donde volver
  function volverAtras() {
    if (orderIntent) { setOrderIntent(null); return true; }
    if (selectedProduct) { setSelectedProduct(null); return true; }
    if (selectedBusiness) { setSelectedBusiness(null); return true; }
    if (activeTab === 'María') { setActiveTab(volverDeMaria); return true; }
    if (activeTab === 'Legal') { setActiveTab(volverLegal); return true; }
    // en el formulario se pregunta antes de salir para no perder lo escrito
    if (activeTab === 'Publicar') {
      Alert.alert('¿Salir sin publicar?', 'Lo que escribiste en el formulario se pierde.', [{ text: 'Seguir aquí', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: volverDePublicar }]);
      return true;
    }
    if (activeTab === 'Ventas' || activeTab === 'Pedidos' || activeTab === 'Editar negocio' || activeTab === 'Cuaderno') { setActiveTab('Mi negocio'); return true; }
    if (activeTab === 'Aprende') { setActiveTab(volverAprende); return true; }
    if (activeTab === 'Notificaciones') { setActiveTab('Mi negocio'); return true; }
    if (activeTab === 'Promocionar') { setActiveTab('Inventario'); return true; }
    return false;
  }
  const volverRef = useRef(volverAtras);
  volverRef.current = volverAtras;

  // android: el boton o gesto atras del sistema. en el inicio deja salir de la app como siempre
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (volverRef.current()) return true;
      return false;
    });
    return () => sub.remove();
  }, []);

  // iphone: deslizar desde el borde izquierdo hacia la derecha. la pantalla sigue el dedo
  const arrastre = useRef(new Animated.Value(0)).current;
  const gestoVolver = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_e, g) => g.x0 < 24 && g.dx > 12 && Math.abs(g.dy) < g.dx * 0.6,
    onPanResponderMove: (_e, g) => { arrastre.setValue(Math.max(0, g.dx)); },
    onPanResponderRelease: (_e, g) => {
      if (g.dx > 90 || g.vx > 0.6) {
        Animated.timing(arrastre, { toValue: 420, duration: 160, useNativeDriver: true }).start(() => { volverRef.current(); arrastre.setValue(0); });
      } else Animated.spring(arrastre, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => { Animated.spring(arrastre, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(); },
  })).current;

  function startOrder(product: Product, business: Business) {
    setMerchantIntent(false);
    setOrderIntent({ product, business, quantity: 1 });
    if (!user) { setModoAuth('signIn'); setStage('signedOut'); }
  }
  function orderCreated() {
    setOrderIntent(null);
    setSelectedProduct(null);
    setOrdersMode('customer');
    setActiveTab(stage === 'guest' ? 'Mi negocio' : 'Pedidos');
  }
  function startMerchantFlow() {
    setSelectedBusiness(null);
    setMerchantIntent(true);
    // un comprador que quiere vender: primero elige si es campesino o tienda
    if (user) { setStage('chooseRole'); return; }
    setMerchantIntent(false);
    setPedirCuenta({ motivo: 'Para guardar tu cosecha y administrarla, primero necesitamos crear tu cuenta. Es gratis y toma un minuto.', destino: 'Publicar' });
  }
  function irACuenta(modo: 'signIn' | 'signUp') {
    if (!pedirCuenta) return;
    setModoAuth(modo);
    setDespuesDeEntrar(pedirCuenta.destino);
    if (pedirCuenta.destino === 'Publicar') setMerchantIntent(true);
    setPedirCuenta(null);
    setStage('signedOut');
  }
  function continueAsGuest() { setMerchantIntent(false); setDespuesDeEntrar(null); setActiveTab('Inicio'); setStage('guest'); }

  // despues de entrar o registrarse se vuelve a la accion que se queria hacer
  useEffect(() => {
    if (!despuesDeEntrar || !user) return;
    if (stage === 'signedIn') { setActiveTab(despuesDeEntrar); setDespuesDeEntrar(null); }
    else if (stage === 'guest') { setActiveTab(despuesDeEntrar === 'Publicar' ? 'Inicio' : despuesDeEntrar); setDespuesDeEntrar(null); }
  }, [stage, user, despuesDeEntrar]);
  // maria se abre desde cualquier pantalla y al cerrar vuelve a donde estaba
  // modo voz: maria responde en voz alta y se abre el microfono. modo texto: se abre el teclado
  function openChat(modo: 'voz' | 'texto' | 'publicar' | '' = '') {
    if (activeTab !== 'María') setVolverDeMaria(activeTab);
    setModoChat(modo);
    if ((modo === 'voz' || modo === 'publicar') && !chat.leerEnVoz) chat.cambiarVoz();
    setActiveTab('María');
    chat.alAbrir();
  }
  async function confirmProductDraft() {
    if (!chat.draft) return;
    try { const { createProduct } = await import('../features/inventory/data/inventoryRepository'); await createProduct(chat.draft); chat.confirmDraft(); }
    // si falla, el borrador sigue en pantalla
    catch (error) { Alert.alert('No se pudo guardar', error instanceof Error ? error.message + ' Toca Editar para corregir el borrador.' : 'El borrador sigue aquí. Intenta de nuevo.'); }
  }
  function editProductDraft() { if (chat.draft) { setDraftForPublish(chat.draft); setActiveTab('Publicar'); } }
  async function onBusinessCreated(business: RemoteBusiness) {
    await setActiveBusinessId(business.id);
    await cacheRemoteBusiness(business);
    setStage('signedIn');
    void syncPendingChanges().catch(() => undefined);
  }
  // cerrar sesion: si hay registros sin enviar se avisa antes; nunca se borran sin preguntar
  async function signOut() {
    const estado = await estadoSincronizacion().catch(() => null);
    const sinEnviar = estado ? estado.pendientes + estado.conflictos : 0;
    if (sinEnviar > 0) {
      Alert.alert('Tienes registros sin enviar', 'Hay ' + sinEnviar + (sinEnviar === 1 ? ' movimiento guardado' : ' movimientos guardados') + ' solo en este celular. Si cierras sesión ahora se borran de aquí y no llegarán al servidor.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar primero', onPress: () => { void syncPendingChanges().then(() => Alert.alert('Listo', 'Tus registros se enviaron. Ya puedes cerrar sesión.')).catch(() => Alert.alert('Sin conexión', 'Conéctate a internet y vuelve a intentarlo. Tus registros siguen guardados.')); } },
        { text: 'Cerrar y borrar', style: 'destructive', onPress: () => void cerrarSesion() },
      ]);
      return;
    }
    await cerrarSesion();
  }
  async function cerrarSesion() {
    // los datos privados no quedan en el celular para la siguiente persona
    try { await borrarDatosPrivados(); await borrarNotificaciones(); } catch { /* se intenta cerrar igual */ }
    chat.resetChat();
    const { error } = await supabase?.auth.signOut() ?? { error: null };
    if (error) Alert.alert('No se pudo cerrar sesión', error.message);
  }

  // cuando vuelve la senal se envia lo pendiente; si se envio algo guardado sin senal, se avisa una vez
  useEffect(() => escucharSenal((conSenal) => {
    if (!conSenal) return;
    void syncPendingChanges().then((r) => {
      if (r.synced > 0) void crearNotificacion({ id: 'sync-' + new Date().toISOString().slice(0, 13), tipo: 'sincronizacion', titulo: 'Tus registros se enviaron', texto: 'Se enviaron ' + r.synced + (r.synced === 1 ? ' registro guardado' : ' registros guardados') + ' sin señal. Todo está actualizado.', product_id: null }).then(contarNotificaciones);
    }).catch(() => undefined);
  }), []);

  // novedades reales del servidor: al abrir, al volver a la app o la senal, y cada minuto mientras esta abierta
  function contarNotificaciones() {
    void contarSinLeer().then(setSinLeer).catch(() => undefined);
    void contarSinLeerDe('consulta').then(setConsultasNuevas).catch(() => undefined);
  }
  useEffect(() => {
    if (!user) { setSinLeer(0); setConsultasNuevas(0); return; }
    const vendedor = stage === 'signedIn';
    const revisar = () => { void revisarNovedades(vendedor).then(contarNotificaciones); };
    revisar();
    const cada = setInterval(() => { if (AppState.currentState === 'active') revisar(); }, 60000);
    const app = AppState.addEventListener('change', (estado) => { if (estado === 'active') revisar(); });
    const senal = escucharSenal((conSenal) => { if (conSenal) revisar(); });
    const cambios = alCambiarNotificaciones(contarNotificaciones);
    return () => { clearInterval(cada); app.remove(); senal(); cambios(); };
  }, [user, stage]);

  if (stage === 'loading' || stage === 'checkingBusiness') return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><View style={styles.loading}><SavaLogo size="large" centrado /><ActivityIndicator color={colors.brown} style={styles.spinner} /><Text style={styles.loadingText}>{stage === 'checkingBusiness' ? 'Entrando a tu cuenta…' : 'Preparando tu espacio…'}</Text></View></SafeAreaView>;
  if (stage === 'chooseRole') return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><RoleScreen onElegido={rolElegido} onSignOut={() => void signOut()} /></SafeAreaView>;
  if (stage === 'signedOut') return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><AuthScreen key={modoAuth} modoInicial={modoAuth} onContinueGuest={continueAsGuest} purpose={orderIntent ? 'buyer' : merchantIntent ? 'seller' : 'general'} /></SafeAreaView>;
  if (stage === 'setupBusiness' && user) return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><BusinessSetupScreen user={user} tipo={tipoNegocio} onCreated={(business) => { void onBusinessCreated(business).catch((error) => { setStartupError(error instanceof Error ? error.message : 'No se pudo preparar el negocio.'); setStage('error'); }); }} /></SafeAreaView>;
  if (stage === 'error') return <SafeAreaView style={styles.safe}><View style={styles.errorScreen}><SavaLogo size="large" centrado /><Text style={styles.errorTitle}>No pudimos conectar</Text><Text style={styles.loadingText}>{startupError}</Text><Pressable onPress={() => setStage(user ? 'checkingBusiness' : 'signedOut')} style={styles.retry}><Text style={styles.retryText}>Intentar de nuevo</Text></Pressable>{!!user && <Pressable onPress={() => void signOut()} style={styles.signOut}><Text style={styles.signOutText}>Cerrar sesión</Text></Pressable>}</View></SafeAreaView>;

  if (orderIntent && user && (stage === 'guest' || stage === 'signedIn')) return <SafeAreaView style={styles.safe} {...(Platform.OS === 'ios' ? gestoVolver.panHandlers : {})}><OrderCheckoutScreen product={orderIntent.product} business={orderIntent.business} quantity={orderIntent.quantity} user={user} onBack={() => setOrderIntent(null)} onCreated={orderCreated} /></SafeAreaView>;
  const isChat = activeTab === 'María' && !pedirCuenta;
  const isTransient = activeTab === 'Ventas' || activeTab === 'Pedidos' || activeTab === 'Editar negocio' || activeTab === 'Legal' || activeTab === 'Cuaderno' || activeTab === 'Aprende' || activeTab === 'Promocionar' || activeTab === 'Notificaciones' || productoEditar !== null;
  const esAgricultor = stage === 'signedIn';
  const municipioComprador = datoUsuario(user, 'municipio');
  const abrirProducto = (product: Product, business: Business | null) => setSelectedProduct({ product, business });

  // cada pestana muestra una pantalla distinta segun el rol
  let pantalla;
  if (isChat) pantalla = <ChatScreen key={'chat-' + modoChat} modoInicial={modoChat} messages={chat.messages} draft={chat.draft} venta={chat.venta} pensando={chat.pensando} leerEnVoz={chat.leerEnVoz} conIA={chat.conIA} sinSenal={chat.sinSenal} enEspera={chat.enEspera} tipo={tipoChat} onSend={(texto, audio) => void chat.sendMessage(texto, audio)} onReset={chat.resetChat} onBack={() => setActiveTab(volverDeMaria)} onCambiarVoz={chat.cambiarVoz} onConfirmDraft={() => void confirmProductDraft()} onEditDraft={editProductDraft} onConfirmarVenta={() => void chat.confirmarVenta()} onCancelarVenta={chat.cancelarVenta} onOpenProduct={(product, business) => { setActiveTab(volverDeMaria); abrirProducto(product, business); }} />;
  else if (selectedProduct) pantalla = <ProductDetailScreen product={selectedProduct.product} business={selectedProduct.business} onBack={() => setSelectedProduct(null)} onOpenBusiness={(business) => { setSelectedProduct(null); setSelectedBusiness(business); }} onConsultar={startOrder} onOpenProduct={abrirProducto} />;
  else if (selectedBusiness) pantalla = <BusinessDetailScreen business={selectedBusiness} onBack={() => setSelectedBusiness(null)} />;
  else if (activeTab === 'Legal') pantalla = <LegalScreen onBack={() => setActiveTab(volverLegal)} />;
  else if (activeTab === 'Videos') pantalla = <VideosScreen onOpenProductor={(business) => setSelectedBusiness(business)} canPublish={esAgricultor} onVender={startMerchantFlow} onOpenMaria={openChat} />;
  else if (esAgricultor && activeTab === 'Mi negocio') pantalla = <BusinessDashboardScreen sinLeer={sinLeer} consultasNuevas={consultasNuevas} porConfirmar={seguimientos.length} onConfirmarVentas={() => setVerSeguimiento(true)} tipo={tipoNegocio} onNavigate={navigate} onEditFinca={() => setActiveTab('Editar negocio')} onLegal={() => abrirLegal('Mi negocio')} onSignOut={() => void signOut()} />;
  else if (esAgricultor && activeTab === 'Inventario') pantalla = <InventoryScreen tipo={tipoNegocio} onAddProduct={() => navigate('Publicar')} onEdit={editarCosecha} onOpenSales={() => setActiveTab('Ventas')} onPromocionar={(product) => void abrirPromocion(product)} />;
  else if (esAgricultor && activeTab === 'Publicar') pantalla = <PublishScreen onUsarVoz={productoEditar ? undefined : publicarConVoz} key={productoEditar ? productoEditar.id : 'nueva'} tipo={tipoNegocio} producto={productoEditar} initialDraft={draftForPublish} onBack={volverDePublicar} onCreated={() => { if (draftForPublish) chat.confirmDraft(); setDraftForPublish(null); setProductoEditar(null); setActiveTab('Inventario'); }} />;
  else if (activeTab === 'Notificaciones') pantalla = <NotificacionesScreen onBack={() => setActiveTab('Mi negocio')} onAbrir={(n) => {
    if (n.tipo === 'consulta') { setOrdersMode('business'); setActiveTab(esAgricultor ? 'Pedidos' : 'Mi negocio'); }
    else if (n.tipo === 'contacto') setActiveTab(esAgricultor ? 'Inventario' : 'Mi negocio');
    else if (n.tipo === 'sincronizacion') setActiveTab(esAgricultor ? 'Cuaderno' : 'Mi negocio');
    else setActiveTab('Mi negocio');
  }} />;
  else if (activeTab === 'Aprende') pantalla = <AprendeScreen onBack={() => setActiveTab(volverAprende)} onPreguntar={() => openChat('texto')} />;
  else if (esAgricultor && activeTab === 'Cuaderno') pantalla = <CuadernoScreen onBack={() => setActiveTab('Mi negocio')} onNuevaCosecha={() => navigate('Publicar')} />;
  else if (esAgricultor && activeTab === 'Promocionar' && promocion) pantalla = <PromocionarScreen product={promocion.product} business={promocion.business} tipo={tipoNegocio} onBack={() => setActiveTab('Inventario')} />;
  else if (esAgricultor && activeTab === 'Ventas') pantalla = <SalesScreen onBack={() => setActiveTab('Mi negocio')} />;
  else if (esAgricultor && activeTab === 'Pedidos') pantalla = <OrdersScreen mode={ordersMode} userId={user?.id} onBack={() => setActiveTab('Mi negocio')} />;
  else if (esAgricultor && activeTab === 'Editar negocio') pantalla = <ProfileScreen onBack={() => setActiveTab('Mi negocio')} />;
  else if (activeTab === 'Guardados') pantalla = <GuardadosScreen onProductPress={abrirProducto} />;
  else if (activeTab === 'Mi negocio' && user) pantalla = <OrdersScreen mode={'customer'} userId={user.id} encabezado={<View><FotoPerfil subtitulo="Comprador en Sava" /><Pressable accessibilityRole="button" onPress={() => setActiveTab('Notificaciones')} style={styles.avisosComprador}><Text style={styles.avisosCompradorTexto}>{sinLeer > 0 ? '🔔 ' + sinLeer + (sinLeer === 1 ? ' notificación nueva' : ' notificaciones nuevas') : '🔔 Notificaciones'}</Text></Pressable></View>} onLegal={() => abrirLegal('Mi negocio')} onSignOut={() => void signOut()} />;
  else if (activeTab === 'Mi negocio' || activeTab === 'Publicar') pantalla = <AuthScreen onContinueGuest={continueAsGuest} />;
  if (pedirCuenta) pantalla = <PedirCuenta motivo={pedirCuenta.motivo} onCrear={() => irACuenta('signUp')} onEntrar={() => irACuenta('signIn')} onAhoraNo={() => setPedirCuenta(null)} />;
  else if (!pantalla) pantalla = <HomeScreen key={municipioComprador + tipoChat} municipioInicial={municipioComprador} seccionInicial={tipoChat === 'agricultor' ? 'insumos' : 'cosechas'} onProductPress={abrirProducto} onVender={() => { if (esAgricultor) navigate('Publicar'); else startMerchantFlow(); }} onHablar={() => openChat('voz')} onEscribir={() => openChat('texto')} onAprender={() => abrirAprende('Inicio')} />;

  // el boton de maria se ve en las pantallas principales y en el detalle de un producto
  const conBarra = !isTransient && !selectedBusiness && !selectedProduct;
  // en videos maria esta en los botones de la derecha, no hace falta el flotante
  const enVideos = activeTab === 'Videos' && conBarra;
  // en el inicio el asistente ya esta en su tarjeta: no se pone el boton flotante encima
  const enInicio = conBarra && (activeTab === 'Inicio' || activeTab === 'Explorar');
  const verMaria = !isChat && !enVideos && !enInicio && (conBarra || !!selectedProduct || !!selectedBusiness);
  // la barra de abajo llega hasta el borde del celular; maria queda encima de ella
  let alturaMaria = 20 + bordes.bottom;
  if (conBarra) alturaMaria = alturaBarra(pantallaAncho, bordes.bottom) + 12;

  const hayAtras = !!selectedProduct || !!selectedBusiness || ['María', 'Legal', 'Publicar', 'Ventas', 'Pedidos', 'Editar negocio', 'Cuaderno', 'Aprende', 'Promocionar', 'Notificaciones'].includes(activeTab);
  // solo se respeta el borde de arriba: abajo la barra de pestanas pinta hasta el final
  return <SafeAreaView edges={conBarra ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']} style={[styles.safe, enVideos && styles.oscuro]}>
    <StatusBar barStyle={enVideos ? 'light-content' : 'dark-content'} />
    {!isChat && activeTab !== 'Cuaderno' && <AvisoConexion />}
    {/* en iphone se puede volver deslizando desde el borde izquierdo (solo si hay a donde volver) */}
    <Animated.View style={[styles.flex, { transform: [{ translateX: arrastre }] }]} {...(Platform.OS === 'ios' && hayAtras ? gestoVolver.panHandlers : {})}>
      <PantallaAnimada key={activeTab + (selectedProduct ? '-p' + selectedProduct.product.id : '') + (selectedBusiness ? '-n' + selectedBusiness.id : '')}>{pantalla}</PantallaAnimada>
    </Animated.View>
    {verMaria && <MariaFlotante abajo={alturaMaria} onPress={openChat} />}
    {esAgricultor && <SeguimientoModal visible={verSeguimiento} pendientes={seguimientos} leerEnVoz={chat.leerEnVoz} onListo={seguimientoListo} onCerrar={() => setVerSeguimiento(false)} />}
    {!isTransient && !selectedBusiness && !selectedProduct && <TabBar active={activeTab} onChange={(tab) => {
      if (!esAgricultor && tab === 'Publicar') { startMerchantFlow(); return; }
      // publicar: escribir los datos o decirlos con la voz (el asistente llena el formulario)
      if (tab === 'Publicar' && activeTab !== 'Publicar') { elegirComoPublicar(); return; }
      if (!esAgricultor && tab === 'Mi negocio' && !user) { setPedirCuenta({ motivo: 'Para ver tus consultas, tu cuaderno y tu negocio necesitas una cuenta. Así tus datos quedan guardados y solo tú los ves.', destino: 'Mi negocio' }); return; }
      setPedirCuenta(null);
      navigate(tab);
    }} guest={!esAgricultor} tienda={tipoNegocio === 'tienda'} oscuro={enVideos} insignia={sinLeer} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, avisosComprador: { padding: 12, borderRadius: 14, backgroundColor: colors.salvia, marginBottom: 12 }, avisosCompradorTexto: { color: colors.verde, fontSize: 14, fontWeight: '800' }, safe: { flex: 1, backgroundColor: colors.paper }, oscuro: { backgroundColor: colors.grafito }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, brand: { color: colors.brown, fontSize: 35, fontWeight: '900' }, spinner: { marginTop: 22 }, loadingText: { color: colors.muted, fontSize: 12, marginTop: 12, textAlign: 'center' }, errorScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 }, errorTitle: { color: colors.ink, fontWeight: '900', fontSize: 21, marginTop: 26 }, retry: { backgroundColor: colors.brown, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 23, marginTop: 20 }, retryText: { color: '#fff', fontWeight: '800', fontSize: 12 }, signOut: { padding: 12, marginTop: 7 }, signOutText: { color: colors.brown, fontWeight: '700', fontSize: 11 } });
