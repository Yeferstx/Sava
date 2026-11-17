import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ClipboardList, Minus, Plus } from 'lucide-react-native';
import type { User } from '@supabase/supabase-js';
import type { Business } from '../business/types';
import type { Product } from '../inventory/types';
import { placeProductOrder } from './data/ordersRepository';
import { colors } from '../../shared/theme';
import { dinero } from '../../shared/contacto';
import { aceptaDecimales, limpiarTelefono, mostrarCantidad, redondear, telefonoValido, textoUnidad } from '../../shared/validaciones';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import GrabadorVoz from '../../shared/components/GrabadorVoz';
import { enviarNotaVoz } from './data/notasVozRepository';

type Props = { product: Product; business: Business | null; quantity: number; user: User; onBack: () => void; onCreated: (orderId: string) => void };

// consulta del comprador al vendedor. no descuenta inventario:
// el vendedor la revisa y solo si vende la registra como venta
export default function OrderCheckoutScreen({ product, business, quantity, user, onBack, onCreated }: Props) {
  let nombreGuardado = '';
  if (user.user_metadata && typeof user.user_metadata.nombre === 'string') nombreGuardado = user.user_metadata.nombre;
  // si queda menos de 1 kg se pide lo que queda
  let minimo = 1;
  if (aceptaDecimales(product.unit) && product.stock < 1) minimo = redondear(product.stock);
  let maximo = redondear(product.stock);
  if (!aceptaDecimales(product.unit)) maximo = Math.floor(product.stock);
  let inicial = quantity;
  if (inicial < minimo) inicial = minimo;
  if (inicial > maximo) inicial = maximo;

  const [cantidad, setCantidad] = useState(inicial);
  const [name, setName] = useState(nombreGuardado);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [notaVoz, setNotaVoz] = useState<{ uri: string; segundos: number } | null>(null);

  function cambiar(paso: number) {
    let nueva = redondear(cantidad + paso);
    if (nueva < minimo) nueva = minimo;
    if (nueva > maximo) nueva = maximo;
    setCantidad(nueva);
  }

  async function submit() {
    if (!business) { Alert.alert('Vendedor no disponible', 'No encontramos los datos del vendedor.'); return; }
    if (name.trim().length < 3) { Alert.alert('Revisa tu nombre', 'Escribe tu nombre completo.'); return; }
    if (telefonoValido(phone) === false) { Alert.alert('Revisa tu teléfono', 'Escribe un número de 10 dígitos, por ejemplo 300 123 4567. El vendedor te escribirá ahí.'); return; }
    if (cantidad <= 0) { Alert.alert('Revisa la cantidad', 'La cantidad debe ser mayor que 0.'); return; }
    setSaving(true);
    try {
      const orderId = await placeProductOrder({ businessId: business.id, productId: product.id, quantity: cantidad, customerName: name.trim(), customerPhone: limpiarTelefono(phone), deliveryAddress: address.trim(), note: note.trim() });
      // la nota de voz se sube despues de crear la consulta
      let aviso = 'El vendedor la verá en Sava y te contactará. Puedes ver su estado en «Cuenta».';
      if (notaVoz) {
        try { await enviarNotaVoz(orderId, notaVoz.uri, notaVoz.segundos); }
        catch { aviso = 'La consulta se envió, pero la nota de voz no se pudo subir. Puedes grabarla otra vez en «Cuenta».'; }
      }
      Alert.alert('Consulta enviada', aviso);
      onCreated(orderId);
    } catch (error) {
      Alert.alert('No se pudo enviar', error instanceof Error ? error.message : 'Revisa tu conexión e intenta de nuevo.');
    } finally { setSaving(false); }
  }

  let vendedor = 'Vendedor de Casanare';
  if (business) vendedor = business.name;

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft size={18} color={colors.brown} /><Text style={styles.backText}>Volver</Text></Pressable>
    <View style={styles.headingIcon}><ClipboardList size={24} color={colors.brown} /></View>
    <Text style={styles.title}>Enviar consulta</Text>
    <Text style={styles.subtitle}>Dile al vendedor cuánto necesitas. No es una compra: él te contacta para acordar precio y entrega.</Text>
    <BotonEscuchar texto="Toca más o menos para elegir cuánto necesitas. Escribe tu nombre y tu teléfono. Después toca el botón verde." />

    <View style={styles.orderCard}>
      <Text style={styles.productName}>{product.name}</Text>
      <Text style={styles.merchant}>{vendedor}</Text>
      <Text style={styles.label}>¿Cuánto necesitas?</Text>
      <View style={styles.cantidadFila}>
        <Pressable accessibilityRole="button" accessibilityLabel="Menos" disabled={cantidad <= minimo} onPress={() => cambiar(-1)} style={[styles.paso, cantidad <= minimo && styles.pasoApagado]}><Minus size={22} color={colors.verde} /></Pressable>
        <View style={styles.cantidadCentro}><Text style={styles.cantidad}>{mostrarCantidad(cantidad)}</Text><Text style={styles.unidad}>{textoUnidad(cantidad, product.unit)}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Más" disabled={cantidad >= maximo} onPress={() => cambiar(1)} style={[styles.paso, cantidad >= maximo && styles.pasoApagado]}><Plus size={22} color={colors.verde} /></Pressable>
      </View>
      <View style={styles.summaryRow}><Text style={styles.summaryText}>Valor aproximado</Text><Text style={styles.total}>{dinero(Math.round(cantidad * product.price_cop))}</Text></View>
    </View>

    <Text style={styles.label}>¿No quieres escribir? Graba lo que necesitas</Text>
    <GrabadorVoz onListo={setNotaVoz} texto="Grabar nota de voz para el vendedor" />
    <Text style={styles.label}>Tu nombre *</Text><TextInput value={name} onChangeText={setName} placeholder="Nombre y apellido" placeholderTextColor={colors.muted} style={styles.input} maxLength={60} />
    <Text style={styles.label}>Tu teléfono *</Text><TextInput value={phone} onChangeText={setPhone} placeholder="300 000 0000" placeholderTextColor={colors.muted} style={styles.input} keyboardType="phone-pad" maxLength={16} />
    <Text style={styles.label}>¿Dónde lo recibes? (opcional)</Text><TextInput value={address} onChangeText={setAddress} placeholder="Barrio, vereda o punto de encuentro" placeholderTextColor={colors.muted} style={styles.input} maxLength={120} />
    <Text style={styles.label}>Mensaje escrito (opcional)</Text><TextInput value={note} onChangeText={setNote} placeholder="Ej. lo necesito para el sábado" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={200} />
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => void submit()} style={[styles.submit, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Enviar consulta</Text>}</Pressable>
    <Text style={styles.footnote}>Sava no cobra ni procesa pagos. El inventario del vendedor no cambia hasta que él confirme la venta.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 22, paddingTop: 28, paddingBottom: 36 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 }, backText: { color: colors.brown, fontWeight: '700', fontSize: 14 },
  headingIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900', marginTop: 14 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 12 },
  orderCard: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 14, marginBottom: 6 },
  productName: { color: colors.ink, fontSize: 19, fontWeight: '900' }, merchant: { color: colors.muted, fontSize: 13, marginTop: 2 },
  cantidadFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paso: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' }, pasoApagado: { opacity: 0.35 },
  cantidadCentro: { alignItems: 'center' }, cantidad: { color: colors.grafito, fontSize: 32, fontWeight: '900' }, unidad: { color: colors.muted, fontSize: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, marginTop: 14, paddingTop: 12 },
  summaryText: { color: colors.muted, fontSize: 14 }, total: { color: colors.verde, fontSize: 19, fontWeight: '900' },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, color: colors.ink, fontSize: 15 }, multiline: { height: 84 },
  submit: { alignItems: 'center', justifyContent: 'center', minHeight: 54, borderRadius: 27, backgroundColor: colors.verde, marginTop: 22 }, disabled: { opacity: 0.6 }, submitText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  footnote: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 10 },
});
