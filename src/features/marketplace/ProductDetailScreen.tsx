import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Bookmark, CalendarDays, ClipboardList, MapPin, MessageCircle, Share2, Sprout, Truck, UserRound } from 'lucide-react-native';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import type { Business } from '../business/types';
import type { Product } from '../inventory/types';
import { getProductImageUri } from './getProductImageUri';
import { colors } from '../../shared/theme';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';
import { textoDisponible, textoFecha } from '../../shared/agro';
import { compartirCosecha, dinero, escribirPorWhatsApp } from '../../shared/contacto';
import { esFavorito, guardarFavorito, quitarFavorito } from '../favoritos/favoritosRepository';

type Props = { product: Product; business: Business | null; onBack: () => void; onOpenBusiness: (business: Business) => void; onConsultar?: (product: Product, business: Business) => void };

export default function ProductDetailScreen({ product, business, onBack, onOpenBusiness, onConsultar }: Props) {
  const [guardado, setGuardado] = useState(false);
  useEffect(() => { void esFavorito(product.id).then(setGuardado).catch(() => undefined); }, [product.id]);

  async function cambiarGuardado() {
    try {
      if (guardado) { await quitarFavorito(product.id); setGuardado(false); }
      else { await guardarFavorito(product, business); setGuardado(true); }
    } catch { Alert.alert('No se pudo guardar', 'Intenta de nuevo.'); }
  }

  const imageUri = getProductImageUri(product.photo_uri);
  const hayStock = product.stock > 0;
  let disponible = 'Agotado';
  if (hayStock) disponible = mostrarCantidad(product.stock) + ' ' + textoUnidad(product.stock, product.unit) + ' disponibles';
  let municipio = product.municipality;
  if (!municipio && business) municipio = business.municipality;
  let entrega = product.delivery;
  if (!entrega) entrega = 'A convenir con el productor';
  let descripcion = product.description.trim();
  if (descripcion === '') descripcion = 'El productor no agregó una descripción. Escríbele para conocer más detalles.';
  // texto para escuchar la publicacion completa
  let paraOir = product.name + '. Cuesta ' + dinero(product.price_cop).replace('$', '') + ' pesos cada ' + product.unit + '. ' + disponible + '.';
  if (municipio) paraOir = paraOir + ' Está en ' + municipio + '.';
  if (business) paraOir = paraOir + ' Lo vende ' + business.name + '.';
  let publicado = product.created_at;
  if (!publicado) publicado = product.updated_at;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft size={19} color={colors.brown} /><Text style={styles.backText}>Volver</Text></Pressable>
        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Compartir publicación" onPress={() => void compartirCosecha(product, business)} style={styles.round}><Share2 size={19} color={colors.brown} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={guardado ? 'Quitar de guardados' : 'Guardar publicación'} onPress={() => void cambiarGuardado()} style={styles.round}><Bookmark size={19} color={colors.brown} fill={guardado ? colors.brown : 'transparent'} /></Pressable>
        </View>
      </View>
      <View style={styles.hero}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" /> : <View style={styles.placeholder}><Sprout size={70} color={colors.brown} strokeWidth={1.4} /><Text style={styles.placeholderText}>Sin foto</Text></View>}
      </View>
      <View style={styles.categoryChip}><Text style={styles.categoryText}>{product.category}</Text></View>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.price}>{dinero(product.price_cop)} <Text style={styles.unit}>por {product.unit}</Text></Text>
      <View style={[styles.availability, !hayStock && styles.unavailable]}><Text style={styles.availabilityText}>{disponible}</Text></View>
      <View style={styles.oir}><BotonEscuchar texto={paraOir} /></View>

      <View style={styles.facts}>
        <View style={styles.fact}><MapPin size={18} color={colors.brown} /><View style={styles.flex}><Text style={styles.factTitle}>Municipio</Text><Text style={styles.factText}>{municipio ? municipio + ', Casanare' : 'Casanare'}</Text></View></View>
        <View style={styles.fact}><CalendarDays size={18} color={colors.brown} /><View style={styles.flex}><Text style={styles.factTitle}>{textoDisponible(product.available_from)}</Text><Text style={styles.factText}>Publicado el {textoFecha(publicado)}</Text></View></View>
        <View style={styles.fact}><Truck size={18} color={colors.brown} /><View style={styles.flex}><Text style={styles.factTitle}>Entrega o recogida</Text><Text style={styles.factText}>{entrega}</Text></View></View>
      </View>

      <Text style={styles.section}>Descripción</Text>
      <Text style={styles.description}>{descripcion}</Text>

      <Text style={styles.section}>Productor</Text>
      {business ? (
        <Pressable accessibilityRole="button" onPress={() => onOpenBusiness(business)} style={styles.sellerCard}>
          <View style={styles.sellerIcon}><UserRound size={22} color={colors.brown} /></View>
          <View style={styles.flex}><Text style={styles.sellerName}>{business.name}</Text><Text style={styles.sellerText}>Perfil sin verificar · Ver más</Text></View>
        </Pressable>
      ) : <Text style={styles.missingSeller}>No encontramos la información del productor.</Text>}

      <Pressable accessibilityRole="button" disabled={!business} onPress={() => void escribirPorWhatsApp(product, business)} style={[styles.contactButton, !business && styles.disabled]}>
        <MessageCircle size={18} color={colors.white} /><Text style={styles.contactText}>Contactar por WhatsApp</Text>
      </Pressable>
      {!!onConsultar && !!business && hayStock && <Pressable accessibilityRole="button" onPress={() => onConsultar(product, business)} style={styles.consultaButton}>
        <ClipboardList size={18} color={colors.verde} /><Text style={styles.consultaText}>Enviar consulta en Sava</Text>
      </Pressable>}
      <Text style={styles.contactNote}>Acuerdas el precio final y la entrega directamente con el vendedor. Sava no procesa pagos.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6 }, backText: { color: colors.brown, fontWeight: '700', fontSize: 14 },
  topActions: { flexDirection: 'row', gap: 8 }, round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 250, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.verdeClaro }, photo: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, placeholderText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  categoryChip: { alignSelf: 'flex-start', backgroundColor: colors.verdeClaro, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 6, marginTop: 18 }, categoryText: { color: colors.brown, fontSize: 11, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 26, lineHeight: 32, fontWeight: '900', marginTop: 10 },
  price: { color: colors.brown, fontSize: 22, fontWeight: '900', marginTop: 6 }, unit: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  availability: { alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7, marginTop: 10, backgroundColor: colors.verdeClaro }, unavailable: { backgroundColor: '#F5E7E2' }, availabilityText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  facts: { marginTop: 18, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  factTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, factText: { color: colors.muted, fontSize: 12, marginTop: 2 },
  section: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 8 }, description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  sellerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  sellerName: { color: colors.ink, fontSize: 14, fontWeight: '800' }, sellerText: { color: colors.muted, fontSize: 12, marginTop: 3 },
  missingSeller: { color: colors.muted, fontSize: 13, paddingVertical: 8 },
  contactButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 26, backgroundColor: colors.brown, marginTop: 24 }, disabled: { opacity: 0.5 },
  contactText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  consultaButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 26, backgroundColor: colors.verdeClaro, marginTop: 10 }, consultaText: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  oir: { marginTop: 10 }, contactNote: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 10 },
});
