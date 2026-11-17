import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { cacheRemoteSales } from '../features/sales/data/salesRepository';
import VideosScreen from '../features/videos/VideosScreen';
import OrderCheckoutScreen from '../features/orders/OrderCheckoutScreen';
import OrdersScreen from '../features/orders/OrdersScreen';
import TabBar from '../shared/components/TabBar';
import { colors } from '../shared/theme';
import type { AppTab } from './types';

type AppStage = 'loading' | 'demo' | 'guest' | 'signedOut' | 'checkingBusiness' | 'setupBusiness' | 'signedIn' | 'error';
type OrderIntent = { product: Product; business: Business; quantity: number };

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
  const chat = useAssistantChat();
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
        if (!business) { if (!merchantIntent) setActiveTab('Inicio'); setStage(merchantIntent ? 'setupBusiness' : 'guest'); return; }
        phase = 'preparar el negocio guardado en el dispositivo';
        await setActiveBusinessId(business.id);
        await cacheRemoteBusiness(business);
        phase = 'sincronizar los cambios pendientes';
        await syncPendingChanges();
        phase = 'cargar los productos del negocio';
        const { data: products, error: productError } = await supabase.from('products').select('id,business_id,name,category,description,price_cop,stock,unit,photo_path,is_published,updated_at').eq('business_id', business.id).order('created_at', { ascending: false });
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

  useEffect(() => {
    if (stage !== 'signedIn') return;
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void syncPendingChanges().catch(() => undefined); });
    return () => subscription.remove();
  }, [stage]);

  function navigate(tab: AppTab) { setSelectedBusiness(null); setSelectedProduct(null); setActiveTab(tab); if (tab === 'Pedidos') setOrdersMode('business'); }
  function startOrder(product: Product, business: Business, quantity: number) {
    setMerchantIntent(false);
    setOrderIntent({ product, business, quantity });
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
    if (user) { setStage('setupBusiness'); return; }
    setStage('signedOut');
  }
  function continueAsGuest() { setMerchantIntent(false); setActiveTab('Inicio'); setStage('guest'); }
  function openChat(prompt?: string) { if (prompt) chat.sendMessage(prompt); setActiveTab('María'); }
  async function confirmProductDraft() {
    if (!chat.draft) return;
    try { const { createProduct } = await import('../features/inventory/data/inventoryRepository'); await createProduct(chat.draft); chat.confirmDraft(); }
    catch { Alert.alert('No se pudo guardar', 'El borrador sigue aquí. Intenta de nuevo.'); }
  }
  function editProductDraft() { if (chat.draft) { setDraftForPublish(chat.draft); setActiveTab('Publicar'); } }
  async function onBusinessCreated(business: RemoteBusiness) {
    await setActiveBusinessId(business.id);
    await cacheRemoteBusiness(business);
    setStage('signedIn');
    void syncPendingChanges().catch(() => undefined);
  }
  async function signOut() { const { error } = await supabase?.auth.signOut() ?? { error: null }; if (error) Alert.alert('No se pudo cerrar sesión', error.message); }

  if (stage === 'loading' || stage === 'checkingBusiness') return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><View style={styles.loading}><Text style={styles.brand}>Sava</Text><ActivityIndicator color={colors.brown} style={styles.spinner} /><Text style={styles.loadingText}>{stage === 'checkingBusiness' ? 'Conectando tu negocio…' : 'Preparando tu espacio…'}</Text></View></SafeAreaView>;
  if (stage === 'signedOut') return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><AuthScreen onContinueGuest={continueAsGuest} purpose={orderIntent ? 'buyer' : merchantIntent ? 'seller' : 'general'} /></SafeAreaView>;
  if (stage === 'setupBusiness' && user) return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><BusinessSetupScreen user={user} onCreated={(business) => { void onBusinessCreated(business).catch((error) => { setStartupError(error instanceof Error ? error.message : 'No se pudo preparar el negocio.'); setStage('error'); }); }} /></SafeAreaView>;
  if (stage === 'error') return <SafeAreaView style={styles.safe}><View style={styles.errorScreen}><Text style={styles.brand}>Sava</Text><Text style={styles.errorTitle}>No pudimos conectar</Text><Text style={styles.loadingText}>{startupError}</Text><Pressable onPress={() => setStage(user ? 'checkingBusiness' : 'signedOut')} style={styles.retry}><Text style={styles.retryText}>Intentar de nuevo</Text></Pressable>{!!user && <Pressable onPress={() => void signOut()} style={styles.signOut}><Text style={styles.signOutText}>Cerrar sesión</Text></Pressable>}</View></SafeAreaView>;

  if (orderIntent && user && (stage === 'guest' || stage === 'signedIn')) return <SafeAreaView style={styles.safe}><OrderCheckoutScreen product={orderIntent.product} business={orderIntent.business} quantity={orderIntent.quantity} user={user} onBack={() => setOrderIntent(null)} onCreated={orderCreated} /></SafeAreaView>;
  const isChat = activeTab === 'María';
  const isTransient = isChat || activeTab === 'Ventas' || activeTab === 'Pedidos' || activeTab === 'Editar negocio';
  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle={isChat ? 'light-content' : 'dark-content'} />
    {selectedProduct ? <ProductDetailScreen product={selectedProduct.product} business={selectedProduct.business} onBack={() => setSelectedProduct(null)} onOpenBusiness={(business) => { setSelectedProduct(null); setSelectedBusiness(business); }} onPlaceOrder={startOrder} />
      : selectedBusiness ? <BusinessDetailScreen business={selectedBusiness} onBack={() => setSelectedBusiness(null)} />
      : isChat ? <ChatScreen messages={chat.messages} draft={chat.draft} onSend={chat.sendMessage} onReset={chat.resetChat} onBack={() => setActiveTab('Inicio')} onConfirmDraft={() => void confirmProductDraft()} onEditDraft={editProductDraft} />
      : activeTab === 'Inicio' || activeTab === 'Explorar' ? <HomeScreen exploring={activeTab === 'Explorar'} guest={stage === 'guest' || stage === 'demo'} onOpenChat={openChat} onBusinessPress={setSelectedBusiness} onProductPress={(product, business) => setSelectedProduct({ product, business })} onOpenVideos={() => setActiveTab('Videos')} />
      : activeTab === 'Inventario' ? <InventoryScreen onAddProduct={() => setActiveTab('Publicar')} onOpenSales={() => setActiveTab('Ventas')} />
      : activeTab === 'Publicar' ? stage === 'guest' ? <AuthScreen onContinueGuest={continueAsGuest} /> : <PublishScreen initialDraft={draftForPublish} onBack={() => setActiveTab(draftForPublish ? 'María' : 'Inicio')} onCreated={() => { if (draftForPublish) chat.confirmDraft(); setDraftForPublish(null); setActiveTab('Inventario'); }} />
      : activeTab === 'Videos' ? <VideosScreen canPublish={stage === 'signedIn'} />
      : activeTab === 'Ventas' ? <SalesScreen onBack={() => setActiveTab('Mi negocio')} />
      : activeTab === 'Pedidos' ? <OrdersScreen mode={ordersMode} userId={user?.id} onBack={() => setActiveTab('Mi negocio')} />
      : activeTab === 'Editar negocio' ? <ProfileScreen onBack={() => setActiveTab('Mi negocio')} />
      : stage === 'guest' && activeTab === 'Mi negocio' && user ? <OrdersScreen mode={'customer'} userId={user.id} onBack={() => setActiveTab('Inicio')} onSignOut={() => void signOut()} />
      : stage === 'guest' ? <AuthScreen onContinueGuest={continueAsGuest} /> : <BusinessDashboardScreen onNavigate={navigate} onRegisterBusiness={() => setActiveTab('Editar negocio')} onSignOut={stage === 'signedIn' ? () => void signOut() : undefined} />}
    {!isTransient && !selectedBusiness && !selectedProduct && <TabBar active={activeTab} onChange={(tab) => {
      if (stage === 'guest' && tab === 'Publicar') { startMerchantFlow(); return; }
      if (stage === 'guest' && tab === 'Mi negocio' && !user) { setMerchantIntent(false); setStage('signedOut'); return; }
      navigate(tab);
    }} guest={stage === 'guest'} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.paper }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, brand: { color: colors.brown, fontSize: 35, fontWeight: '900' }, spinner: { marginTop: 22 }, loadingText: { color: colors.muted, fontSize: 12, marginTop: 12, textAlign: 'center' }, errorScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 }, errorTitle: { color: colors.ink, fontWeight: '900', fontSize: 21, marginTop: 26 }, retry: { backgroundColor: colors.brown, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 23, marginTop: 20 }, retryText: { color: '#fff', fontWeight: '800', fontSize: 12 }, signOut: { padding: 12, marginTop: 7 }, signOutText: { color: colors.brown, fontWeight: '700', fontSize: 11 } });
