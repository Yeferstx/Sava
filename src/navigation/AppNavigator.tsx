import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
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
import { syncPendingChanges } from '../infrastructure/sync/syncService';
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
import TabBar from '../shared/components/TabBar';
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
  // ventas que la app le pregunta al vendedor si se hicieron
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [verSeguimiento, setVerSeguimiento] = useState(false);
  const ultimaPregunta = useRef(0);
  // quien vende: campesino (finca) o tienda del campo
  const [tipoNegocio, setTipoNegocio] = useState<'agricultor' | 'tienda'>('agricultor');
  let tipoChat: 'agricultor' | 'tienda' | '' = '';
  if (stage === 'signedIn') tipoChat = tipoNegocio;
  const chat = useAssistantChat(tipoChat);
  const bordes = useSafeAreaInsets();
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
  function startOrder(product: Product, business: Business) {
    setMerchantIntent(false);
    setOrderIntent({ product, business, quantity: 1 });
    if (!user) setStage('signedOut');
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
    setStage('signedOut');
  }
  function continueAsGuest() { setMerchantIntent(false); setActiveTab('Inicio'); setStage('guest'); }
  // maria se abre desde cualquier pantalla y al cerrar vuelve a donde estaba
  function openChat() {
    if (activeTab !== 'María') setVolverDeMaria(activeTab);
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
  async function signOut() { const { error } = await supabase?.auth.signOut() ?? { error: null }; if (error) Alert.alert('No se pudo cerrar sesión', error.message); }

  if (stage === 'loading' || stage === 'checkingBusiness') return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><View style={styles.loading}><SavaLogo size="large" centrado /><ActivityIndicator color={colors.brown} style={styles.spinner} /><Text style={styles.loadingText}>{stage === 'checkingBusiness' ? 'Entrando a tu cuenta…' : 'Preparando tu espacio…'}</Text></View></SafeAreaView>;
  if (stage === 'chooseRole') return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><RoleScreen onElegido={rolElegido} onSignOut={() => void signOut()} /></SafeAreaView>;
  if (stage === 'signedOut') return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><AuthScreen onContinueGuest={continueAsGuest} purpose={orderIntent ? 'buyer' : merchantIntent ? 'seller' : 'general'} /></SafeAreaView>;
  if (stage === 'setupBusiness' && user) return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><BusinessSetupScreen user={user} tipo={tipoNegocio} onCreated={(business) => { void onBusinessCreated(business).catch((error) => { setStartupError(error instanceof Error ? error.message : 'No se pudo preparar el negocio.'); setStage('error'); }); }} /></SafeAreaView>;
  if (stage === 'error') return <SafeAreaView style={styles.safe}><View style={styles.errorScreen}><SavaLogo size="large" centrado /><Text style={styles.errorTitle}>No pudimos conectar</Text><Text style={styles.loadingText}>{startupError}</Text><Pressable onPress={() => setStage(user ? 'checkingBusiness' : 'signedOut')} style={styles.retry}><Text style={styles.retryText}>Intentar de nuevo</Text></Pressable>{!!user && <Pressable onPress={() => void signOut()} style={styles.signOut}><Text style={styles.signOutText}>Cerrar sesión</Text></Pressable>}</View></SafeAreaView>;

  if (orderIntent && user && (stage === 'guest' || stage === 'signedIn')) return <SafeAreaView style={styles.safe}><OrderCheckoutScreen product={orderIntent.product} business={orderIntent.business} quantity={orderIntent.quantity} user={user} onBack={() => setOrderIntent(null)} onCreated={orderCreated} /></SafeAreaView>;
  const isChat = activeTab === 'María';
  const isTransient = isChat || activeTab === 'Ventas' || activeTab === 'Pedidos' || activeTab === 'Editar negocio' || activeTab === 'Legal' || productoEditar !== null;
  const esAgricultor = stage === 'signedIn';
  const municipioComprador = datoUsuario(user, 'municipio');
  const abrirProducto = (product: Product, business: Business | null) => setSelectedProduct({ product, business });

  // cada pestana muestra una pantalla distinta segun el rol
  let pantalla;
  if (isChat) pantalla = <ChatScreen messages={chat.messages} draft={chat.draft} venta={chat.venta} pensando={chat.pensando} leerEnVoz={chat.leerEnVoz} conIA={chat.conIA} tipo={tipoChat} onSend={(texto) => void chat.sendMessage(texto)} onReset={chat.resetChat} onBack={() => setActiveTab(volverDeMaria)} onCambiarVoz={chat.cambiarVoz} onConfirmDraft={() => void confirmProductDraft()} onEditDraft={editProductDraft} onConfirmarVenta={() => void chat.confirmarVenta()} onCancelarVenta={chat.cancelarVenta} onOpenProduct={(product, business) => { setActiveTab(volverDeMaria); abrirProducto(product, business); }} />;
  else if (selectedProduct) pantalla = <ProductDetailScreen product={selectedProduct.product} business={selectedProduct.business} onBack={() => setSelectedProduct(null)} onOpenBusiness={(business) => { setSelectedProduct(null); setSelectedBusiness(business); }} onConsultar={startOrder} />;
  else if (selectedBusiness) pantalla = <BusinessDetailScreen business={selectedBusiness} onBack={() => setSelectedBusiness(null)} />;
  else if (activeTab === 'Legal') pantalla = <LegalScreen onBack={() => setActiveTab(volverLegal)} />;
  else if (activeTab === 'Videos') pantalla = <VideosScreen canPublish={esAgricultor} onVender={startMerchantFlow} onOpenMaria={openChat} />;
  else if (esAgricultor && activeTab === 'Mi negocio') pantalla = <BusinessDashboardScreen porConfirmar={seguimientos.length} onConfirmarVentas={() => setVerSeguimiento(true)} tipo={tipoNegocio} onNavigate={navigate} onEditFinca={() => setActiveTab('Editar negocio')} onLegal={() => abrirLegal('Mi negocio')} onSignOut={() => void signOut()} />;
  else if (esAgricultor && activeTab === 'Inventario') pantalla = <InventoryScreen tipo={tipoNegocio} onAddProduct={() => navigate('Publicar')} onEdit={editarCosecha} onOpenSales={() => setActiveTab('Ventas')} />;
  else if (esAgricultor && activeTab === 'Publicar') pantalla = <PublishScreen key={productoEditar ? productoEditar.id : 'nueva'} tipo={tipoNegocio} producto={productoEditar} initialDraft={draftForPublish} onBack={volverDePublicar} onCreated={() => { if (draftForPublish) chat.confirmDraft(); setDraftForPublish(null); setProductoEditar(null); setActiveTab('Inventario'); }} />;
  else if (esAgricultor && activeTab === 'Ventas') pantalla = <SalesScreen onBack={() => setActiveTab('Mi negocio')} />;
  else if (esAgricultor && activeTab === 'Pedidos') pantalla = <OrdersScreen mode={ordersMode} userId={user?.id} onBack={() => setActiveTab('Mi negocio')} />;
  else if (esAgricultor && activeTab === 'Editar negocio') pantalla = <ProfileScreen onBack={() => setActiveTab('Mi negocio')} />;
  else if (activeTab === 'Guardados') pantalla = <GuardadosScreen onProductPress={abrirProducto} />;
  else if (activeTab === 'Mi negocio' && user) pantalla = <OrdersScreen mode={'customer'} userId={user.id} onLegal={() => abrirLegal('Mi negocio')} onSignOut={() => void signOut()} />;
  else if (activeTab === 'Mi negocio' || activeTab === 'Publicar') pantalla = <AuthScreen onContinueGuest={continueAsGuest} />;
  else pantalla = <HomeScreen key={municipioComprador + tipoChat} municipioInicial={municipioComprador} seccionInicial={tipoChat === 'agricultor' ? 'insumos' : 'cosechas'} mostrarInvitacion={!esAgricultor} onProductPress={abrirProducto} onVender={startMerchantFlow} onOpenMaria={openChat} onOpenVideos={() => navigate('Videos')} />;

  // el boton de maria se ve en las pantallas principales y en el detalle de un producto
  const conBarra = !isTransient && !selectedBusiness && !selectedProduct;
  // en videos maria esta en los botones de la derecha, no hace falta el flotante
  const enVideos = activeTab === 'Videos' && conBarra;
  const verMaria = !isChat && !enVideos && (conBarra || !!selectedProduct || !!selectedBusiness);
  // la barra de abajo llega hasta el borde del celular; maria queda encima de ella
  let alturaMaria = 20 + bordes.bottom;
  if (conBarra) alturaMaria = 82 + bordes.bottom;

  // solo se respeta el borde de arriba: abajo la barra de pestanas pinta hasta el final
  return <SafeAreaView edges={conBarra ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']} style={[styles.safe, enVideos && styles.oscuro]}>
    <StatusBar barStyle={isChat || enVideos ? 'light-content' : 'dark-content'} />
    {pantalla}
    {verMaria && <MariaFlotante abajo={alturaMaria} onPress={openChat} />}
    {esAgricultor && <SeguimientoModal visible={verSeguimiento} pendientes={seguimientos} leerEnVoz={chat.leerEnVoz} onListo={seguimientoListo} onCerrar={() => setVerSeguimiento(false)} />}
    {!isTransient && !selectedBusiness && !selectedProduct && <TabBar active={activeTab} onChange={(tab) => {
      if (!esAgricultor && tab === 'Publicar') { startMerchantFlow(); return; }
      if (!esAgricultor && tab === 'Mi negocio' && !user) { setMerchantIntent(false); setStage('signedOut'); return; }
      navigate(tab);
    }} guest={!esAgricultor} tienda={tipoNegocio === 'tienda'} oscuro={enVideos} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.paper }, oscuro: { backgroundColor: colors.grafito }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, brand: { color: colors.brown, fontSize: 35, fontWeight: '900' }, spinner: { marginTop: 22 }, loadingText: { color: colors.muted, fontSize: 12, marginTop: 12, textAlign: 'center' }, errorScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 }, errorTitle: { color: colors.ink, fontWeight: '900', fontSize: 21, marginTop: 26 }, retry: { backgroundColor: colors.brown, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 23, marginTop: 20 }, retryText: { color: '#fff', fontWeight: '800', fontSize: 12 }, signOut: { padding: 12, marginTop: 7 }, signOutText: { color: colors.brown, fontWeight: '700', fontSize: 11 } });
