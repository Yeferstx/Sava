import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowLeft,
  BadgeCheck,
  ClipboardList,
  Clock3,
  MapPin,
  MessageCircle,
  XCircle,
} from 'lucide-react-native';
import type { OrderStatus, OrderSummary } from './types';
import { listBusinessOrders, listCustomerOrders, updateOrderStatus } from './data/ordersRepository';
import { recordSale } from '../sales/data/salesRepository';
import { enviarNotaVoz, listarNotasVoz, urlNotaVoz, type NotaVoz as Nota } from './data/notasVozRepository';
import NotaVoz from '../../shared/components/NotaVoz';
import { FilaEsqueleto } from '../../shared/components/Esqueleto';
import GrabadorVoz from '../../shared/components/GrabadorVoz';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { Mic } from 'lucide-react-native';
import { colors } from '../../shared/theme';
import { dinero } from '../../shared/contacto';
import { limpiarTelefono, mostrarCantidad, textoUnidad } from '../../shared/validaciones';

type Props = {
  mode: 'customer' | 'business';
  userId?: string;
  onBack?: () => void;
  onSignOut?: () => void;
  onLegal?: () => void;
  encabezado?: React.ReactNode;
};

// nombres sencillos para cada estado de la consulta
function textoEstado(status: OrderStatus, mode: Props['mode']) {
  if (status === 'pending' && mode === 'customer') return 'Enviada';
  if (status === 'pending') return 'Nueva';
  if (status === 'accepted') return 'En conversación';
  if (status === 'rejected') return 'No disponible';
  return 'Vendida';
}

async function abrirWhatsApp(telefono: string, mensaje: string) {
  try {
    await Linking.openURL(
      'https://wa.me/57' + limpiarTelefono(telefono) + '?text=' + encodeURIComponent(mensaje),
    );
  } catch {
    Alert.alert('No se pudo abrir WhatsApp', 'Revisa que WhatsApp esté instalado.');
  }
}

// consultas que los compradores envian a los vendedores
export default function OrdersScreen({ mode, userId, onBack, onSignOut, onLegal, encabezado }: Props) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [miId, setMiId] = useState('');
  // consulta en la que se esta grabando una respuesta de voz
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [grabacion, setGrabacion] = useState<{ uri: string; segundos: number } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const refresh = useCallback(async () => {
    try {
      let lista: OrderSummary[] = [];
      if (mode === 'business') lista = await listBusinessOrders();
      else lista = await listCustomerOrders(userId ?? '');
      setOrders(lista);
      const ids: string[] = [];
      for (const order of lista) ids.push(order.id);
      setNotas(await listarNotasVoz(ids));
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data.user) setMiId(data.user.id);
      }
    } catch (error) {
      Alert.alert(
        'No pudimos cargar las consultas',
        error instanceof Error ? error.message : 'Revisa tu conexión e intenta de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  }, [mode, userId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function changeStatus(orderId: string, status: OrderStatus) {
    setUpdating(orderId);
    try {
      await updateOrderStatus(orderId, status);
      await refresh();
    } catch (error) {
      Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setUpdating(null);
    }
  }

  // el vendedor contesta por whatsapp y la consulta pasa a "en conversacion"
  function responder(order: OrderSummary) {
    let producto = 'tu consulta';
    if (order.order_items && order.order_items.length > 0) producto = order.order_items[0].product_name;
    void abrirWhatsApp(
      order.customer_phone,
      'Hola ' + order.customer_name + ', te escribo por tu consulta de ' + producto + ' en Sava.',
    );
    if (order.status === 'pending') void changeStatus(order.id, 'accepted');
  }

  // solo cuando el vendedor confirma se registra la venta y baja el inventario
  function yaVendi(order: OrderSummary) {
    if (!order.order_items || order.order_items.length === 0) return;
    const item = order.order_items[0];
    Alert.alert(
      'Registrar venta',
      '¿Le vendiste ' +
        mostrarCantidad(item.quantity) +
        ' ' +
        textoUnidad(item.quantity, item.unit) +
        ' de ' +
        item.product_name +
        ' a ' +
        order.customer_name +
        ' por ' +
        dinero(Number(item.line_total_cop)) +
        '?\n\nSe descontará de tu inventario.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, vendí', onPress: () => void registrar(order) },
      ],
    );
  }

  async function registrar(order: OrderSummary) {
    const item = order.order_items[0];
    setUpdating(order.id);
    try {
      await recordSale(item.product_id, Number(item.quantity), Number(item.unit_price_cop));
      await updateOrderStatus(order.id, 'completed');
      await refresh();
      Alert.alert('Venta registrada', 'Se descontó de tu inventario.');
    } catch (error) {
      Alert.alert('No se pudo registrar', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setUpdating(null);
    }
  }

  async function enviarRespuesta(orderId: string) {
    if (!grabacion) return;
    setEnviando(true);
    try {
      await enviarNotaVoz(orderId, grabacion.uri, grabacion.segundos);
      setRespondiendo(null);
      setGrabacion(null);
      await refresh();
    } catch (error) {
      Alert.alert(
        'No se pudo enviar',
        error instanceof Error ? error.message : 'Revisa tu conexión e intenta de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  function noTengo(order: OrderSummary) {
    Alert.alert('No disponible', '¿Le avisamos a ' + order.customer_name + ' que no tienes este producto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sí', onPress: () => void changeStatus(order.id, 'rejected') },
    ]);
  }

  const esVendedor = mode === 'business';
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            setLoading(true);
            void refresh();
          }}
          tintColor={colors.brown}
        />
      }
    >
      {encabezado}
      {!!onBack && (
        <Pressable onPress={onBack} style={styles.back}>
          <ArrowLeft size={18} color={colors.brown} />
          <Text style={styles.backText}>Volver</Text>
        </Pressable>
      )}
      <Text style={styles.title}>{esVendedor ? 'Consultas de compradores' : 'Mis consultas'}</Text>
      <Text style={styles.subtitle}>
        {esVendedor
          ? 'Personas interesadas en lo que publicaste. Escríbeles y, si les vendes, toca «Ya le vendí».'
          : 'Lo que le preguntaste a los vendedores. Ellos te contactan para acordar.'}
      </Text>
      {orders.length === 0 && loading && (
        <>
          <FilaEsqueleto />
          <FilaEsqueleto />
        </>
      )}
      {orders.length === 0 && !loading && (
        <View style={styles.empty}>
          <ClipboardList size={30} color={colors.brown} />
          <Text style={styles.emptyTitle}>Todavía no hay consultas</Text>
          <Text style={styles.emptyText}>
            {esVendedor
              ? 'Cuando alguien pregunte por tu producto, aparecerá aquí.'
              : 'Abre una publicación y toca «Enviar consulta».'}
          </Text>
        </View>
      )}
      {orders.map((order) => {
        const status = order.status;
        const bien = status === 'accepted' || status === 'completed';
        let Icono = Clock3;
        if (bien) Icono = BadgeCheck;
        if (status === 'rejected') Icono = XCircle;
        const fecha = new Date(order.created_at).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        const busy = updating === order.id;
        let producto = 'Consulta';
        let detalle = '';
        if (order.order_items && order.order_items.length > 0) {
          const item = order.order_items[0];
          producto = item.product_name;
          detalle =
            mostrarCantidad(Number(item.quantity)) +
            ' ' +
            textoUnidad(Number(item.quantity), item.unit) +
            ' × ' +
            dinero(Number(item.unit_price_cop));
        }
        return (
          <View key={order.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{producto}</Text>
                <Text style={styles.meta}>{fecha}</Text>
              </View>
              <View
                style={[styles.badge, bien && styles.badgeGood, status === 'rejected' && styles.badgeBad]}
              >
                <Icono size={13} color={bien ? colors.verde : '#775D50'} />
                <Text style={styles.badgeText}>{textoEstado(status, mode)}</Text>
              </View>
            </View>
            {!esVendedor && order.business && (
              <Text style={styles.merchant}>
                {order.business.name} · {order.business.municipality}
              </Text>
            )}
            <Text style={styles.itemLine}>{detalle}</Text>
            <View style={styles.totalRow}>
              <Text style={styles.meta}>Valor aproximado</Text>
              <Text style={styles.total}>{dinero(Number(order.total_cop))}</Text>
            </View>

            {esVendedor && (
              <View style={styles.customer}>
                <Text style={styles.customerName}>
                  {order.customer_name} · {order.customer_phone}
                </Text>
                {!!order.delivery_address && (
                  <View style={styles.lugar}>
                    <MapPin size={13} color={colors.muted} />
                    <Text style={styles.meta}>{order.delivery_address}</Text>
                  </View>
                )}
                {!!order.note && <Text style={styles.note}>«{order.note}»</Text>}
              </View>
            )}

            {notas
              .filter((nota) => nota.order_id === order.id)
              .map((nota) => {
                const mia = nota.autor_id === miId;
                let autor = 'Tú';
                if (!mia && esVendedor) autor = order.customer_name;
                if (!mia && !esVendedor) autor = 'Vendedor';
                return (
                  <View key={nota.id} style={[styles.nota, mia ? styles.notaMia : styles.notaOtro]}>
                    <NotaVoz
                      uri={urlNotaVoz(nota.audio_path)}
                      segundos={nota.duracion_seg}
                      deOtro={!mia}
                      autor={autor}
                    />
                  </View>
                );
              })}

            {respondiendo === order.id && (
              <View style={styles.responder}>
                <GrabadorVoz onListo={setGrabacion} texto="Grabar respuesta" />
                <View style={styles.fila}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setRespondiendo(null);
                      setGrabacion(null);
                    }}
                    style={styles.reject}
                  >
                    <Text style={styles.rejectText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!grabacion || enviando}
                    onPress={() => void enviarRespuesta(order.id)}
                    style={[styles.accept, (!grabacion || enviando) && styles.apagado]}
                  >
                    <Text style={styles.acceptText}>{enviando ? 'Enviando…' : 'Enviar'}</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {respondiendo !== order.id && status !== 'rejected' && status !== 'completed' && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setRespondiendo(order.id);
                  setGrabacion(null);
                }}
                style={styles.voz}
              >
                <Mic size={17} color={colors.verde} />
                <Text style={styles.vozTexto}>Responder con nota de voz</Text>
              </Pressable>
            )}

            {esVendedor && (status === 'pending' || status === 'accepted') && (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => responder(order)}
                  style={styles.whatsapp}
                >
                  <MessageCircle size={17} color={colors.white} />
                  <Text style={styles.whatsappText}>Escribirle</Text>
                </Pressable>
                <View style={styles.fila}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => noTengo(order)}
                    style={styles.reject}
                  >
                    <Text style={styles.rejectText}>No tengo</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => yaVendi(order)}
                    style={styles.accept}
                  >
                    <Text style={styles.acceptText}>{busy ? 'Guardando…' : 'Ya le vendí'}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {!esVendedor &&
              status !== 'rejected' &&
              status !== 'completed' &&
              !!order.business &&
              !!order.business.phone && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void abrirWhatsApp(
                      order.business ? order.business.phone : '',
                      'Hola, te escribo por mi consulta de ' + producto + ' en Sava.',
                    )
                  }
                  style={styles.whatsapp}
                >
                  <MessageCircle size={17} color={colors.white} />
                  <Text style={styles.whatsappText}>Escribirle al vendedor</Text>
                </Pressable>
              )}
          </View>
        );
      })}
      {!!onLegal && (
        <Pressable onPress={onLegal} style={styles.signOut}>
          <Text style={styles.linkText}>Tus datos y privacidad</Text>
        </Pressable>
      )}
      {!esVendedor && !!onSignOut && (
        <Pressable onPress={onSignOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingTop: 14, paddingBottom: 96 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  backText: { color: colors.brown, fontSize: 14, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 16 },
  empty: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
  },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 4 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    marginBottom: 11,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#F5E7E2',
  },
  badgeGood: { backgroundColor: colors.verdeClaro },
  badgeBad: { backgroundColor: '#F5E7E2' },
  badgeText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  merchant: { color: colors.verde, fontSize: 13, fontWeight: '700', marginTop: 6 },
  itemLine: { color: colors.ink, fontSize: 14, marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  total: { color: colors.verde, fontSize: 17, fontWeight: '900' },
  customer: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 11, paddingTop: 10, gap: 4 },
  customerName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  lugar: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  note: { color: colors.ink, fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  actions: { gap: 8, marginTop: 12 },
  fila: { flexDirection: 'row', gap: 8 },
  whatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.verde,
    marginTop: 4,
  },
  whatsappText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  reject: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5E7E2',
  },
  rejectText: { color: '#775D50', fontSize: 14, fontWeight: '800' },
  accept: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.verdeClaro,
  },
  acceptText: { color: colors.verde, fontSize: 14, fontWeight: '900' },
  nota: { marginTop: 8, maxWidth: '92%' },
  notaMia: { alignSelf: 'flex-end' },
  notaOtro: { alignSelf: 'flex-start' },
  responder: { gap: 8, marginTop: 10 },
  apagado: { opacity: 0.5 },
  voz: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.verde,
    marginTop: 10,
  },
  vozTexto: { color: colors.verde, fontSize: 14, fontWeight: '800' },
  signOut: { alignItems: 'center', padding: 14 },
  signOutText: { color: '#775D50', fontWeight: '700', fontSize: 14 },
  linkText: { color: colors.verde, fontWeight: '700', fontSize: 14 },
});
