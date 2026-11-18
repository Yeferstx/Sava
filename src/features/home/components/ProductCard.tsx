import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Sprout, UserRound } from 'lucide-react-native';
import type { Product } from '../../inventory/types';
import { colors } from '../../../shared/theme';
import { getProductImageUri } from '../../marketplace/getProductImageUri';
import { dinero, textoMinimo } from '../../../shared/contacto';
import { mostrarCantidad, textoUnidad } from '../../../shared/validaciones';
import { esInsumo } from '../../../shared/agro';

type Props = { product: Product; municipio?: string; vendedor?: string; conCategoria?: boolean; enGrilla?: boolean; propia?: boolean; onPress: () => void };

// tarjeta de una cosecha: la foto manda; luego que es, donde, quien y cuanto hay.
// el precio va pequeno y solo si el productor quiso mostrarlo
export default function ProductCard({ product, municipio, vendedor = '', enGrilla = false, propia = false, onPress }: Props) {
  const aparecer = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(aparecer, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, []);
  const subir = aparecer.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const imageUri = getProductImageUri(product.photo_uri);
  let lugar = product.municipality;
  if (!lugar) lugar = municipio;
  let fecha = product.created_at;
  if (!fecha) fecha = product.updated_at;
  const esNuevo = Date.now() - new Date(fecha).getTime() < 3 * 24 * 60 * 60 * 1000;
  const minimo = textoMinimo(product.min_order, product.unit);
  const insumo = esInsumo(product.category);
  return (
    <Animated.View style={[enGrilla ? styles.grilla : styles.fila, { opacity: aparecer, transform: [{ translateY: subir }] }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={'Conocer ' + product.name} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.presionada]}>
        <View style={styles.image}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={product.id} /> : <Sprout size={36} color={colors.verde} strokeWidth={1.5} />}
          {/* tus propias publicaciones se marcan para que no se confundan con las de otros */}
          {propia ? <View style={styles.tuya}><Text style={styles.tuyaTexto}>Tuya</Text></View> : esNuevo && <View style={styles.nuevo}><Text style={styles.nuevoTexto}>Nuevo</Text></View>}
          {product.price_cop > 0 && <View style={styles.precio}><Text style={styles.precioTexto} numberOfLines={1}>{dinero(product.price_cop)}/{product.unit}</Text></View>}
        </View>
        <View style={styles.cuerpo}>
          <Text numberOfLines={1} style={styles.name}>{product.name}</Text>
          {!!lugar && <View style={styles.place}><MapPin size={12} color={colors.muted} /><Text numberOfLines={1} style={styles.placeText}>{lugar}, Casanare</Text></View>}
          {vendedor !== '' && <View style={styles.place}><UserRound size={12} color={colors.muted} /><Text numberOfLines={1} style={styles.placeText}>{vendedor}</Text></View>}
          <Text numberOfLines={1} style={styles.cantidad}>{mostrarCantidad(product.stock)} {textoUnidad(product.stock, product.unit)} <Text style={styles.cantidadSuave}>disponibles</Text></Text>
          {minimo !== '' && <Text numberOfLines={1} style={styles.minimo}>Pedido mínimo: {mostrarCantidad(product.min_order ?? 0)} {textoUnidad(product.min_order ?? 0, product.unit)}</Text>}
          <View style={styles.boton}><Text style={styles.botonTexto}>{insumo ? 'Ver producto' : 'Conocer cosecha'}</Text></View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fila: { width: 164 },
  grilla: { width: '48.5%' },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, shadowColor: '#26332F', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  presionada: { transform: [{ scale: 0.97 }] },
  image: { height: 118, backgroundColor: colors.salvia, justifyContent: 'center', alignItems: 'center' },
  photo: { width: '100%', height: '100%' },
  nuevo: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.arcilla, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  tuya: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.verde, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  tuyaTexto: { color: colors.white, fontSize: 11, fontWeight: '900' },
  nuevoTexto: { color: colors.grafito, fontSize: 11, fontWeight: '900' },
  precio: { position: 'absolute', bottom: 8, right: 8, maxWidth: '90%', backgroundColor: 'rgba(240,233,223,0.95)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  precioTexto: { color: colors.verde, fontSize: 11, fontWeight: '900' },
  cuerpo: { padding: 10, paddingTop: 9, flex: 1 },
  name: { color: colors.grafito, fontWeight: '900', fontSize: 15 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  placeText: { color: colors.muted, fontSize: 12, flex: 1 },
  cantidad: { color: colors.verde, fontSize: 14, fontWeight: '900', marginTop: 6 },
  cantidadSuave: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  minimo: { color: colors.grafito, fontSize: 11, fontWeight: '700', marginTop: 2 },
  boton: { marginTop: 'auto', paddingTop: 8 },
  botonTexto: { textAlign: 'center', color: colors.verde, fontSize: 13, fontWeight: '900', backgroundColor: colors.salvia, borderRadius: 14, paddingVertical: 7, overflow: 'hidden' },
});
