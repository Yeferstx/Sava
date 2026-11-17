import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, BadgeCheck, Clock3, MapPin, Phone, Store, XCircle } from 'lucide-react-native';
import type { OrderStatus, OrderSummary } from './types';
import { listBusinessOrders, listCustomerOrders, updateOrderStatus } from './data/ordersRepository';
import { colors } from '../../shared/theme';

type Props = { mode: 'customer' | 'business'; userId?: string; onBack?: () => void; onSignOut?: () => void };
const money = (value: number) => `$${Number(value).toLocaleString('es-CO')}`;
const statusCopy: Record<OrderStatus, string> = { pending: 'Pendiente', accepted: 'Aceptado', rejected: 'No disponible', completed: 'Completado' };

export default function OrdersScreen({ mode, userId, onBack, onSignOut }: Props) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setOrders(mode === 'business' ? await listBusinessOrders() : await listCustomerOrders(userId ?? '')); }
    catch (error) { Alert.alert('No pudimos cargar los pedidos', error instanceof Error ? error.message : 'Revisa tu conexión e intenta de nuevo.'); }
    finally { setLoading(false); }
  }, [mode, userId]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function changeStatus(orderId: string, status: OrderStatus) {
    setUpdating(orderId);
    try { await updateOrderStatus(orderId, status); await refresh(); }
    catch (error) { Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Intenta de nuevo.'); }
    finally { setUpdating(null); }
  }

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void refresh(); }} tintColor={colors.brown} />}>
    {!!onBack && <Pressable onPress={onBack} style={styles.back}><ArrowLeft size={17} color={colors.brown} /><Text style={styles.backText}>{mode === 'business' ? 'Mi negocio' : 'Volver a Sava'}</Text></Pressable>}
    <Text style={styles.eyebrow}>{mode === 'business' ? 'VENTAS LOCALES' : 'TU ACTIVIDAD EN SAVA'}</Text>
    <Text style={styles.title}>{mode === 'business' ? 'Pedidos recibidos' : 'Mis pedidos'}</Text>
    <Text style={styles.subtitle}>{mode === 'business' ? 'Revisa las solicitudes y confirma con cada cliente.' : 'Consulta el estado de tus solicitudes a negocios locales.'}</Text>
    {orders.length === 0 && !loading ? <View style={styles.empty}><Store size={29} color={colors.brown} /><Text style={styles.emptyTitle}>Todavía no hay pedidos</Text><Text style={styles.emptyText}>{mode === 'business' ? 'Cuando un cliente solicite un producto, lo verás aquí.' : 'Los pedidos que hagas desde el catálogo aparecerán aquí.'}</Text></View> : orders.map((order) => <OrderCard key={order.id} order={order} mode={mode} busy={updating === order.id} onStatus={(status) => void changeStatus(order.id, status)} />)}
    {mode === 'customer' && !!onSignOut && <Pressable onPress={onSignOut} style={styles.signOut}><Text style={styles.signOutText}>Cerrar sesión</Text></Pressable>}
  </ScrollView>;
}

function OrderCard({ order, mode, busy, onStatus }: { order: OrderSummary; mode: Props['mode']; busy: boolean; onStatus: (status: OrderStatus) => void }) {
  const status = order.status;
  const StatusIcon = status === 'accepted' || status === 'completed' ? BadgeCheck : status === 'rejected' ? XCircle : Clock3;
  const stamp = new Date(order.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return <View style={styles.card}>
    <View style={styles.cardTop}><View style={styles.orderTitleWrap}><Text style={styles.cardTitle}>{order.order_items?.[0]?.product_name ?? 'Pedido'}</Text><Text style={styles.orderDate}>{stamp}</Text></View><View style={[styles.badge, status === 'accepted' || status === 'completed' ? styles.badgeGood : status === 'rejected' ? styles.badgeBad : styles.badgePending]}><StatusIcon size={12} color={status === 'accepted' || status === 'completed' ? '#477147' : status === 'rejected' ? '#a64430' : '#8b6a3a'} /><Text style={styles.badgeText}>{statusCopy[status]}</Text></View></View>
    {mode === 'customer' && order.business && <Text style={styles.merchant}>{order.business.name} · {order.business.municipality}</Text>}
    <Text style={styles.itemLine}>{order.order_items?.map((item) => `${item.quantity} ${item.unit} × ${money(item.unit_price_cop)}`).join('\n')}</Text>
    <View style={styles.totalRow}><Text style={styles.meta}>Total solicitado</Text><Text style={styles.total}>{money(order.total_cop)}</Text></View>
    {mode === 'business' && <><View style={styles.customer}><Text style={styles.customerName}>{order.customer_name}</Text><Pressable accessibilityRole="button" onPress={() => void Linking.openURL(`tel:${order.customer_phone}`)} style={styles.phone}><Phone size={13} color={colors.brown} /><Text style={styles.phoneText}>{order.customer_phone}</Text></Pressable>{!!order.delivery_address && <Text style={styles.meta}><MapPin size={12} color={colors.muted} />  {order.delivery_address}</Text>}{!!order.note && <Text style={styles.note}>Nota: {order.note}</Text>}</View>
      {status === 'pending' && <View style={styles.actions}><Pressable disabled={busy} onPress={() => onStatus('rejected')} style={styles.reject}><Text style={styles.rejectText}>{busy ? 'Actualizando…' : 'No disponible'}</Text></Pressable><Pressable disabled={busy} onPress={() => onStatus('accepted')} style={styles.accept}><Text style={styles.acceptText}>Aceptar pedido</Text></Pressable></View>}
      {status === 'accepted' && <Pressable disabled={busy} onPress={() => onStatus('completed')} style={styles.complete}><Text style={styles.acceptText}>{busy ? 'Actualizando…' : 'Marcar como completado'}</Text></Pressable>}</>}
  </View>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 21, paddingTop: 32, paddingBottom: 38 }, back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }, backText: { color: colors.brown, fontSize: 12, fontWeight: '700' }, eyebrow: { color: '#9c8876', fontSize: 9, letterSpacing: 1.2, fontWeight: '800' }, title: { color: colors.ink, fontSize: 27, fontWeight: '900', marginTop: 4 }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 17 }, empty: { alignItems: 'center', backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 24, marginTop: 6 }, emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 10 }, emptyText: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 14, marginBottom: 10 }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 }, orderTitleWrap: { flex: 1 }, cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, orderDate: { color: colors.muted, fontSize: 10, marginTop: 3 }, badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 }, badgeGood: { backgroundColor: '#e8efdc' }, badgeBad: { backgroundColor: '#f8e7df' }, badgePending: { backgroundColor: '#f6efdf' }, badgeText: { color: colors.ink, fontSize: 9, fontWeight: '700' }, merchant: { color: colors.muted, fontSize: 11, marginTop: 7 }, itemLine: { color: colors.ink, fontSize: 11, lineHeight: 17, marginTop: 9 }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 9 }, meta: { color: colors.muted, fontSize: 10 }, total: { color: colors.brown, fontSize: 14, fontWeight: '900' }, customer: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 9, gap: 6 }, customerName: { color: colors.ink, fontSize: 11, fontWeight: '800' }, phone: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }, phoneText: { color: colors.brown, fontSize: 10, fontWeight: '700' }, note: { color: colors.muted, fontSize: 10, lineHeight: 15 }, actions: { flexDirection: 'row', gap: 8, marginTop: 12 }, reject: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', padding: 10 }, rejectText: { color: colors.muted, fontWeight: '700', fontSize: 10 }, accept: { flex: 1, borderRadius: 18, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center', padding: 10 }, complete: { borderRadius: 18, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center', padding: 11, marginTop: 12 }, acceptText: { color: '#fff', fontWeight: '800', fontSize: 10 }, signOut: { alignItems: 'center', padding: 18, marginTop: 8 }, signOutText: { color: '#a64430', fontWeight: '700', fontSize: 11 } });
