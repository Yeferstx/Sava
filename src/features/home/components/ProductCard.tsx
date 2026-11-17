import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin, Sprout } from 'lucide-react-native';
import type { Product } from '../../inventory/types';
import { colors } from '../../../shared/theme';
import { getProductImageUri } from '../../marketplace/getProductImageUri';
import { dinero } from '../../../shared/contacto';
import { mostrarCantidad, textoUnidad } from '../../../shared/validaciones';

// tarjeta de cosecha. en la grilla ocupa media pantalla, en la fila tiene ancho fijo
export default function ProductCard({ product, municipio, enGrilla = false, onPress }: { product: Product; municipio?: string; enGrilla?: boolean; onPress: () => void }) {
  const imageUri = getProductImageUri(product.photo_uri);
  let lugar = product.municipality;
  if (!lugar) lugar = municipio;
  let cantidad = 'Agotado';
  if (product.stock > 0) cantidad = mostrarCantidad(product.stock) + ' ' + textoUnidad(product.stock, product.unit) + ' disponibles';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={'Ver ' + product.name} onPress={onPress} style={[styles.card, enGrilla && styles.grilla]}>
      <View style={styles.image}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" /> : <Sprout size={36} color={colors.brown} strokeWidth={1.5} />}
      </View>
      <Text numberOfLines={1} style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>{dinero(product.price_cop)} <Text style={styles.unit}>/ {product.unit}</Text></Text>
      <Text numberOfLines={1} style={styles.stock}>{cantidad}</Text>
      {!!lugar && <View style={styles.place}><MapPin size={11} color={colors.muted} /><Text numberOfLines={1} style={styles.placeText}>{lugar}</Text></View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 156, backgroundColor: colors.white, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: colors.line },
  grilla: { width: '48%' },
  image: { height: 104, backgroundColor: colors.verdeClaro, borderRadius: 11, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  photo: { width: '100%', height: '100%' },
  name: { color: colors.ink, fontWeight: '800', fontSize: 13, marginTop: 8 },
  price: { color: colors.brown, fontWeight: '900', fontSize: 13, marginTop: 3 },
  unit: { color: colors.muted, fontWeight: '500', fontSize: 11 },
  stock: { color: colors.ink, fontSize: 11, marginTop: 3 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  placeText: { color: colors.muted, fontSize: 11, flex: 1 },
});
