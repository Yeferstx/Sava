import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin, Sprout, UserRound } from 'lucide-react-native';
import type { Product } from '../../inventory/types';
import { colors } from '../../../shared/theme';
import { getProductImageUri } from '../../marketplace/getProductImageUri';
import { dinero } from '../../../shared/contacto';
import { mostrarCantidad, textoUnidad } from '../../../shared/validaciones';

type Props = { product: Product; municipio?: string; vendedor?: string; conCategoria?: boolean; enGrilla?: boolean; onPress: () => void };

// nombre corto de la categoria para la etiqueta sobre la foto
function categoriaCorta(categoria: string) {
  const partes = categoria.split(' y ');
  return partes[0];
}

// tarjeta de una publicacion: foto real, nombre, precio, cantidad, municipio y vendedor
export default function ProductCard({ product, municipio, vendedor = '', conCategoria = false, enGrilla = false, onPress }: Props) {
  const imageUri = getProductImageUri(product.photo_uri);
  let lugar = product.municipality;
  if (!lugar) lugar = municipio;
  // nuevo: publicado hace menos de 3 dias
  let fecha = product.created_at;
  if (!fecha) fecha = product.updated_at;
  const esNuevo = Date.now() - new Date(fecha).getTime() < 3 * 24 * 60 * 60 * 1000;
  let cantidad = 'Agotado';
  if (product.stock > 0) cantidad = mostrarCantidad(product.stock) + ' ' + textoUnidad(product.stock, product.unit) + ' disponibles';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={'Ver ' + product.name} onPress={onPress} style={({ pressed }) => [styles.card, enGrilla && styles.grilla, pressed && styles.presionada]}>
      <View style={styles.image}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" /> : <Sprout size={36} color={colors.brown} strokeWidth={1.5} />}
        <View style={styles.etiquetas}>
          {conCategoria && <View style={styles.categoria}><Text style={styles.categoriaTexto} numberOfLines={1}>{categoriaCorta(product.category)}</Text></View>}
          {esNuevo && <View style={styles.nuevo}><Text style={styles.nuevoTexto}>Nuevo</Text></View>}
        </View>
      </View>
      <Text numberOfLines={1} style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>{dinero(product.price_cop)} <Text style={styles.unit}>/ {product.unit}</Text></Text>
      <Text numberOfLines={1} style={styles.stock}>{cantidad}</Text>
      {!!lugar && <View style={styles.place}><MapPin size={12} color={colors.muted} /><Text numberOfLines={1} style={styles.placeText}>{lugar}</Text></View>}
      {vendedor !== '' && <View style={styles.place}><UserRound size={12} color={colors.muted} /><Text numberOfLines={1} style={styles.placeText}>{vendedor}</Text></View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 156, backgroundColor: colors.white, borderRadius: 20, padding: 8, borderWidth: 1, borderColor: colors.line, shadowColor: '#26332F', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  grilla: { width: '48.5%' },
  presionada: { transform: [{ scale: 0.97 }] },
  image: { height: 124, backgroundColor: colors.salvia, borderRadius: 14, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  photo: { width: '100%', height: '100%' },
  etiquetas: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  categoria: { backgroundColor: 'rgba(240,233,223,0.95)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 1 },
  categoriaTexto: { color: colors.verde, fontSize: 12, fontWeight: '900' },
  nuevo: { backgroundColor: colors.arcilla, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  nuevoTexto: { color: colors.grafito, fontSize: 11, fontWeight: '900' },
  name: { color: colors.ink, fontWeight: '900', fontSize: 15, marginTop: 9 },
  price: { color: colors.verde, fontWeight: '900', fontSize: 15, marginTop: 3 },
  unit: { color: colors.muted, fontWeight: '500', fontSize: 12 },
  stock: { color: colors.ink, fontSize: 12, marginTop: 3 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  placeText: { color: colors.muted, fontSize: 12, flex: 1 },
});
