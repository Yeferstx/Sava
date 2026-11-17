import { useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Headphones, MapPin, Minus, Package, Plus, Sprout, Store, Utensils } from 'lucide-react-native';
import type { Business } from '../business/types';
import type { Product } from '../inventory/types';
import { getProductImageUri } from './getProductImageUri';
import { colors } from '../../shared/theme';
import { aceptaDecimales, mostrarCantidad, redondear, textoUnidad } from '../../shared/validaciones';

type Props = { product: Product; business: Business | null; onBack: () => void; onOpenBusiness: (business: Business) => void; onPlaceOrder: (product: Product, business: Business, quantity: number) => void };
const money = (value: number) => `$${value.toLocaleString('es-CO')}`;

export default function ProductDetailScreen({ product, business, onBack, onOpenBusiness, onPlaceOrder }: Props) {
  // si queda menos de 1 kg se pide lo que queda
  let cantidadMinima = 1;
  if (aceptaDecimales(product.unit) && product.stock > 0 && product.stock < 1) cantidadMinima = redondear(product.stock);
  // las unidades enteras no se pueden pedir por partes
  let cantidadMaxima = redondear(product.stock);
  if (aceptaDecimales(product.unit) === false) cantidadMaxima = Math.floor(product.stock);
  let hayStock = true;
  if (cantidadMaxima < cantidadMinima) hayStock = false;
  const [quantity, setQuantity] = useState(cantidadMinima);

  function restar() {
    let nueva = redondear(quantity - 1);
    if (nueva < cantidadMinima) nueva = cantidadMinima;
    setQuantity(nueva);
  }

  function sumar() {
    let nueva = redondear(quantity + 1);
    if (nueva > cantidadMaxima) nueva = cantidadMaxima;
    setQuantity(nueva);
  }
  const category = product.category.toLowerCase();
  const Icon = category === 'agro' ? Sprout : category.includes('comida') || category.includes('abarrote') ? Utensils : category.includes('tecnolog') ? Headphones : Package;
  const imageUri = getProductImageUri(product.photo_uri);

  async function contactSeller() {
    if (!business) {
      Alert.alert('Vendedor no disponible', 'No encontramos los datos del negocio asociado a este producto.');
      return;
    }
    if (!business.phone?.trim()) {
      Alert.alert('Contacto no disponible', 'Este negocio todavía no agregó un número de contacto.');
      return;
    }
    const phone = business.phone.replace(/\D/g, '').replace(/^57/, '');
    const message = `Hola, vi ${product.name} de ${business.name} en Sava y quisiera consultar disponibilidad.`;
    try { await Linking.openURL(`https://wa.me/57${phone}?text=${encodeURIComponent(message)}`); }
    catch { Alert.alert('No se pudo abrir WhatsApp', 'Intenta de nuevo o contacta al negocio más tarde.'); }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft size={19} color={colors.brown} /><Text style={styles.backText}>Volver al catálogo</Text></Pressable>
      <View style={styles.hero}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" /> : <View style={styles.placeholder}><Icon size={76} color={colors.brown} strokeWidth={1.4} /><Text style={styles.placeholderText}>Foto del producto</Text></View>}
      </View>
      <View style={styles.categoryChip}><Text style={styles.categoryText}>{product.category}</Text></View>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>{money(product.price_cop)} <Text style={styles.unit}>/ {product.unit}</Text></Text>
      <View style={[styles.availability, hayStock ? styles.available : styles.unavailable]}><View style={[styles.dot, hayStock ? styles.availableDot : styles.unavailableDot]} /><Text style={styles.availabilityText}>{hayStock ? `${mostrarCantidad(product.stock)} ${textoUnidad(product.stock, product.unit)} ${product.stock === 1 ? 'disponible' : 'disponibles'}` : 'Agotado · consulta disponibilidad'}</Text></View>

      <Text style={styles.section}>Descripción</Text>
      <Text style={styles.description}>{product.description.trim() || 'Comunícate con el negocio para conocer más detalles de este producto.'}</Text>

      <View style={styles.orderControls}>
        <View style={styles.quantityControl}>
          <Pressable accessibilityRole="button" accessibilityLabel="Quitar una unidad" disabled={quantity <= cantidadMinima} onPress={restar} style={styles.quantityButton}><Minus size={17} color={quantity <= cantidadMinima ? colors.muted : colors.brown} /></Pressable>
          <Text style={styles.quantity}>{mostrarCantidad(quantity)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Agregar una unidad" disabled={quantity >= cantidadMaxima} onPress={sumar} style={styles.quantityButton}><Plus size={17} color={quantity >= cantidadMaxima ? colors.muted : colors.brown} /></Pressable>
        </View>
        <Text style={styles.orderSubtotal}>{money(Math.round(product.price_cop * quantity))}</Text>
      </View>
      <Pressable accessibilityRole="button" disabled={!business || !hayStock} onPress={() => business && onPlaceOrder(product, business, quantity)} style={[styles.orderButton, (!business || !hayStock) && styles.disabledButton]}>
        <Text style={styles.orderButtonText}>{hayStock ? 'Hacer pedido' : 'Producto agotado'}</Text>
      </Pressable>
      <Text style={styles.orderNote}>Inicia sesión para enviar la solicitud. El negocio confirmará disponibilidad y entrega.</Text>
      <Text style={styles.section}>Vendido por</Text>
      {business ? (
        <Pressable accessibilityRole="button" onPress={() => onOpenBusiness(business)} style={styles.sellerCard}>
          <View style={styles.sellerIcon}><Store size={22} color={colors.brown} /></View>
          <View style={styles.sellerCopy}><Text style={styles.sellerName}>{business.name}</Text><View style={styles.location}><MapPin size={13} color={colors.muted} /><Text style={styles.locationText}>{business.municipality ?? 'Casanare'}</Text></View></View>
          <ArrowLeft size={18} color={colors.brown} style={styles.sellerArrow} />
        </Pressable>
      ) : <Text style={styles.missingSeller}>No encontramos la información del negocio.</Text>}

      <Pressable accessibilityRole="button" onPress={() => void contactSeller()} style={styles.contactButton}>
        <Text style={styles.contactText}>Consultar por WhatsApp</Text>
      </Pressable>
      <Text style={styles.contactNote}>Consulta directamente con el vendedor. No necesitas crear una cuenta.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingHorizontal: 22, paddingTop: 30, paddingBottom: 34 }, back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 }, backText: { color: colors.brown, fontWeight: '700', fontSize: 13 }, hero: { height: 260, borderRadius: 24, overflow: 'hidden', backgroundColor: '#E8F2EE' }, photo: { width: '100%', height: '100%' }, placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, placeholderText: { color: '#636A64', fontSize: 12, fontWeight: '600' }, categoryChip: { alignSelf: 'flex-start', backgroundColor: '#E8F2EE', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 6, marginTop: 19 }, categoryText: { color: colors.brown, fontSize: 10, fontWeight: '800' }, name: { color: colors.ink, fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: 10 }, price: { color: colors.brown, fontSize: 22, fontWeight: '900', marginTop: 7 }, unit: { color: colors.muted, fontSize: 13, fontWeight: '500' }, availability: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, marginTop: 12 }, available: { backgroundColor: '#E8F2EE' }, unavailable: { backgroundColor: '#F5E7E2' }, dot: { width: 7, height: 7, borderRadius: 4 }, availableDot: { backgroundColor: '#174B3F' }, unavailableDot: { backgroundColor: '#775D50' }, availabilityText: { color: colors.ink, fontSize: 11, fontWeight: '600' }, orderControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 17 }, quantityControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1 }, quantityButton: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' }, quantity: { minWidth: 24, textAlign: 'center', color: colors.ink, fontWeight: '800' }, orderSubtotal: { color: colors.ink, fontSize: 19, fontWeight: '900' }, orderButton: { alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 25, backgroundColor: colors.brown, marginTop: 13 }, disabledButton: { opacity: 0.5 }, orderButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' }, orderNote: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 8 }, section: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 25, marginBottom: 7 }, description: { color: colors.muted, fontSize: 13, lineHeight: 20 }, sellerCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' }, sellerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F2EE', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, sellerCopy: { flex: 1 }, sellerName: { color: colors.ink, fontSize: 13, fontWeight: '800' }, location: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }, locationText: { color: colors.muted, fontSize: 11 }, sellerArrow: { transform: [{ rotate: '180deg' }] }, missingSeller: { color: colors.muted, fontSize: 12, paddingVertical: 8 }, contactButton: { alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 25, backgroundColor: colors.brown, marginTop: 25 }, contactText: { color: '#fff', fontSize: 14, fontWeight: '800' }, contactNote: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 9 },
});
