import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ShoppingBag } from 'lucide-react-native';
import type { User } from '@supabase/supabase-js';
import type { Business } from '../business/types';
import type { Product } from '../inventory/types';
import { placeProductOrder } from './data/ordersRepository';
import { colors } from '../../shared/theme';
import { limpiarTelefono, mostrarCantidad, telefonoValido, textoUnidad } from '../../shared/validaciones';

type Props = { product: Product; business: Business | null; quantity: number; user: User; onBack: () => void; onCreated: (orderId: string) => void };
const money = (value: number) => `$${value.toLocaleString('es-CO')}`;

export default function OrderCheckoutScreen({ product, business, quantity, user, onBack, onCreated }: Props) {
  const [name, setName] = useState(String(user.user_metadata?.full_name ?? ''));
  const [phone, setPhone] = useState(String(user.phone ?? ''));
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!business?.id || !name.trim() || !phone.trim()) {
      Alert.alert('Completa tus datos', 'Escribe tu nombre y teléfono para que el negocio pueda confirmar el pedido.');
      return;
    }
    if (name.trim().length < 3) {
      Alert.alert('Revisa tu nombre', 'Escribe tu nombre completo, mínimo 3 letras.');
      return;
    }
    if (telefonoValido(phone) === false) {
      Alert.alert('Revisa tu teléfono', 'Escribe un número de 10 dígitos, por ejemplo 300 123 4567.');
      return;
    }
    if (quantity <= 0) {
      Alert.alert('Revisa la cantidad', 'La cantidad del pedido debe ser mayor que 0.');
      return;
    }
    setSaving(true);
    try {
      const orderId = await placeProductOrder({ businessId: business.id, productId: product.id, quantity, customerName: name.trim(), customerPhone: limpiarTelefono(phone), deliveryAddress: address.trim(), note: note.trim() });
      onCreated(orderId);
    } catch (error) {
      Alert.alert('No se pudo enviar el pedido', error instanceof Error ? error.message : 'Revisa tu conexión e intenta de nuevo.');
    } finally { setSaving(false); }
  }

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft size={18} color={colors.brown} /><Text style={styles.backText}>Volver al producto</Text></Pressable>
    <View style={styles.headingIcon}><ShoppingBag size={24} color={colors.brown} /></View>
    <Text style={styles.title}>Confirma tu pedido</Text>
    <Text style={styles.subtitle}>El negocio recibirá tu solicitud y se pondrá en contacto contigo.</Text>

    <View style={styles.orderCard}><Text style={styles.productName}>{product.name}</Text><Text style={styles.merchant}>{business?.name ?? 'Negocio local'}</Text><View style={styles.summaryRow}><Text style={styles.summaryText}>{mostrarCantidad(quantity)} {textoUnidad(quantity, product.unit)} × {money(product.price_cop)}</Text><Text style={styles.total}>{money(Math.round(quantity * product.price_cop))}</Text></View></View>

    <Text style={styles.label}>Tu nombre *</Text><TextInput value={name} onChangeText={setName} placeholder="Nombre y apellido" style={styles.input} maxLength={60} />
    <Text style={styles.label}>Teléfono de contacto *</Text><TextInput value={phone} onChangeText={setPhone} placeholder="300 000 0000" style={styles.input} keyboardType="phone-pad" maxLength={16} />
    <Text style={styles.label}>Dirección o punto de entrega</Text><TextInput value={address} onChangeText={setAddress} placeholder="Barrio, dirección o lugar de recogida" style={styles.input} maxLength={120} />
    <Text style={styles.label}>Nota para el negocio</Text><TextInput value={note} onChangeText={setNote} placeholder="Horario, presentación u otra indicación" style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={200} />
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => void submit()} style={[styles.submit, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Enviar pedido</Text>}</Pressable>
    <Text style={styles.footnote}>El pedido queda pendiente hasta que el negocio confirme disponibilidad y entrega. No se realiza ningún cobro en la app.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 22, paddingTop: 28, paddingBottom: 36 }, back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }, backText: { color: colors.brown, fontWeight: '700', fontSize: 12 }, headingIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E8F2EE', alignItems: 'center', justifyContent: 'center' }, title: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 15 }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 18 }, orderCard: { backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 8 }, productName: { color: colors.ink, fontWeight: '800', fontSize: 14 }, merchant: { color: colors.muted, fontSize: 11, marginTop: 3 }, summaryRow: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 12, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, summaryText: { color: colors.muted, fontSize: 11 }, total: { color: colors.brown, fontWeight: '900', fontSize: 15 }, label: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 15, marginBottom: 6 }, input: { backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, color: colors.ink, fontSize: 13 }, multiline: { height: 76 }, submit: { minHeight: 49, borderRadius: 25, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center', marginTop: 22 }, disabled: { opacity: 0.6 }, submitText: { color: '#fff', fontWeight: '800', fontSize: 13 }, footnote: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 10 } });
