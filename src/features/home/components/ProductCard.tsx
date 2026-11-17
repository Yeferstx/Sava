import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Headphones, Package, Sprout, Utensils } from 'lucide-react-native';
import type { Product } from '../../inventory/types';
import { colors } from '../../../shared/theme';
import { getProductImageUri } from '../../marketplace/getProductImageUri';

const money = (value: number) => `$${value.toLocaleString('es-CO')}`;

export default function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const category = product.category.toLowerCase();
  const Icon = category === 'agro' ? Sprout : category.includes('comida') || category.includes('abarrote') ? Utensils : category.includes('tecnolog') ? Headphones : Package;
  const imageUri = getProductImageUri(product.photo_uri);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${product.name}`} onPress={onPress} style={styles.card}>
      <View style={styles.image}>{imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" /> : <Icon size={40} color={colors.brown} strokeWidth={1.6} />}</View>
      <Text numberOfLines={1} style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>{money(product.price_cop)} / {product.unit}</Text>
      <Text style={styles.stock}>{product.stock > 0 ? `Disponible · ${product.stock}` : 'Agotado'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ card: { width: 148, backgroundColor: '#fff', borderRadius: 15, padding: 7, borderWidth: 1, borderColor: colors.line }, image: { height: 95, backgroundColor: '#f1e6d7', borderRadius: 11, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }, photo: { width: '100%', height: '100%' }, name: { color: colors.ink, fontWeight: '800', fontSize: 11, marginTop: 7 }, price: { color: colors.brown, fontWeight: '800', fontSize: 10, marginTop: 3 }, stock: { color: colors.muted, fontSize: 9, marginTop: 3 } });
