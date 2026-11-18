import { useEffect, useState } from 'react';
import { Alert, Animated, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, Bookmark, CalendarDays, ChevronRight, ClipboardList, MapPin, MessageCircle, Package, Share2, Sprout, Truck, UserRound } from 'lucide-react-native';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import type { Business } from '../business/types';
import type { Product } from '../inventory/types';
import { getProductImageUri } from './getProductImageUri';
import { colors } from '../../shared/theme';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';
import { textoDisponible, textoFecha } from '../../shared/agro';
import { compartirCosecha, dinero, escribirPorWhatsApp, textoMinimo } from '../../shared/contacto';
import { esFavorito, guardarFavorito, quitarFavorito } from '../favoritos/favoritosRepository';
import { leerCopia } from './data/mercadoRepository';

type Props = { product: Product; business: Business | null; onBack: () => void; onOpenBusiness: (business: Business) => void; onConsultar?: (product: Product, business: Business) => void; onOpenProduct?: (product: Product, business: Business | null) => void };

// todas las fotos de la publicacion: la principal y las adicionales
export function fotosDe(product: Product) {
  const lista: string[] = [];
  const principal = getProductImageUri(product.photo_uri);
  if (principal) lista.push(principal);
  try {
    for (const ruta of JSON.parse(product.extra_photos ?? '[]') as string[]) {
      const uri = getProductImageUri(ruta);
      if (uri) lista.push(uri);
    }
  } catch { /* sin fotos extra */ }
  return lista;
}

// detalle de una cosecha: la foto manda, luego quien la vende, donde y cuanto hay
export default function ProductDetailScreen({ product, business, onBack, onOpenBusiness, onConsultar, onOpenProduct }: Props) {
  const [guardado, setGuardado] = useState(false);
  const [foto, setFoto] = useState(0);
  const [otras, setOtras] = useState<Product[]>([]);
  const { width } = useWindowDimensions();
  const aparecer = useState(() => new Animated.Value(0))[0];
  useEffect(() => { void esFavorito(product.id).then(setGuardado).catch(() => undefined); }, [product.id]);
  useEffect(() => { Animated.timing(aparecer, { toValue: 1, duration: 260, useNativeDriver: true }).start(); }, []);
  // mas cosechas del mismo productor (de lo que ya cargo el inicio, sin pedir nada nuevo)
  useEffect(() => {
    void leerCopia().then((copia) => {
      if (!copia) return;
      setOtras(copia.products.filter((p) => p.business_id === product.business_id && p.id !== product.id && p.stock > 0).slice(0, 6));
    }).catch(() => undefined);
  }, [product.id]);

  async function cambiarGuardado() {
    try {
      if (guardado) { await quitarFavorito(product.id); setGuardado(false); }
      else { await guardarFavorito(product, business); setGuardado(true); }
    } catch { Alert.alert('No se pudo guardar', 'Intenta de nuevo.'); }
  }

  const fotos = fotosDe(product);
  const hayStock = product.stock > 0;
  let disponible = 'Agotado';
  if (hayStock) disponible = mostrarCantidad(product.stock) + ' ' + textoUnidad(product.stock, product.unit);
  let municipio = product.municipality;
  if (!municipio && business) municipio = business.municipality;
  let entrega = product.delivery;
  if (!entrega) entrega = 'A convenir con el productor';
  let descripcion = product.description.trim();
  if (descripcion === '') descripcion = 'El productor no agregó una descripción. Escríbele para conocer más detalles.';
  const minimo = textoMinimo(product.min_order, product.unit);
  let paraOir = product.name + '. ' + disponible + ' disponibles' + (minimo ? ', ' + minimo.toLowerCase() : '') + '. ' + (product.price_cop > 0 ? 'Cuesta ' + dinero(product.price_cop).replace('$', '') + ' pesos cada ' + product.unit : 'El precio se negocia con el productor') + '.';
  if (municipio) paraOir = paraOir + ' Está en ' + municipio + '.';
  if (business) paraOir = paraOir + ' Lo vende ' + business.name + '.';
  let publicado = product.created_at;
  if (!publicado) publicado = product.updated_at;
  const ancho = width;
  const subir = aparecer.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        {/* galeria: se desliza entre fotos */}
        <View style={[styles.hero, { width: ancho }]}>
          {fotos.length > 0 ? <FlatList data={fotos} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(uri, i) => uri + i}
            onMomentumScrollEnd={(e) => setFoto(Math.round(e.nativeEvent.contentOffset.x / ancho))}
            renderItem={({ item }) => <Image source={{ uri: item }} style={{ width: ancho, height: 300 }} resizeMode="cover" accessibilityLabel={'Foto de ' + product.name} />} />
            : <View style={styles.placeholder}><Sprout size={70} color={colors.verde} strokeWidth={1.4} /><Text style={styles.placeholderText}>El productor aún no subió fotos</Text></View>}
          {fotos.length > 1 && <View style={styles.puntos}>{fotos.map((_, i) => <View key={i} style={[styles.punto, i === foto && styles.puntoActivo]} />)}</View>}
          <View style={styles.top}>
            <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} style={styles.round}><ArrowLeft size={20} color={colors.verde} /></Pressable>
            <View style={styles.topActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Compartir publicación" onPress={() => void compartirCosecha(product, business)} style={styles.round}><Share2 size={19} color={colors.verde} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={guardado ? 'Quitar de guardados' : 'Guardar publicación'} onPress={() => void cambiarGuardado()} style={styles.round}><Bookmark size={19} color={colors.verde} fill={guardado ? colors.verde : 'transparent'} /></Pressable>
            </View>
          </View>
        </View>

        <Animated.View style={[styles.cuerpo, { opacity: aparecer, transform: [{ translateY: subir }] }]}>
          <Text style={styles.categoria}>{product.category}</Text>
          <Text style={styles.name}>{product.name}</Text>
          <View style={styles.lugar}><MapPin size={15} color={colors.muted} /><Text style={styles.lugarTexto}>{municipio ? municipio + ', Casanare' : 'Casanare'}</Text></View>

          {/* productor arriba: es lo que da confianza */}
          {business ? <Pressable accessibilityRole="button" onPress={() => onOpenBusiness(business)} style={styles.productor}>
            <View style={styles.productorIcono}><UserRound size={20} color={colors.verde} /></View>
            <View style={styles.flex}><Text style={styles.productorNombre}>{business.name}</Text><Text style={styles.productorTexto}>Perfil sin verificar · Ver productor</Text></View>
            <ChevronRight size={20} color={colors.verde} />
          </Pressable> : <Text style={styles.sinProductor}>No encontramos la información del productor.</Text>}

          <View style={styles.datos}>
            <View style={[styles.dato, styles.datoFuerte]}><Package size={18} color={colors.crema} /><Text style={styles.datoEtiquetaClara}>DISPONIBLE</Text><Text style={styles.datoValorClaro}>{disponible}</Text></View>
            <View style={styles.dato}><Text style={styles.datoEtiqueta}>{minimo ? 'PEDIDO MÍNIMO' : 'VENTA'}</Text><Text style={styles.datoValor}>{minimo ? minimo.replace('Desde ', '') : 'Cualquier cantidad'}</Text></View>
            <View style={styles.dato}><Text style={styles.datoEtiqueta}>PRECIO</Text><Text style={styles.datoValor}>{product.price_cop > 0 ? dinero(product.price_cop) + ' / ' + product.unit : 'A convenir'}</Text></View>
          </View>

          <View style={styles.oir}><BotonEscuchar texto={paraOir} /></View>

          <View style={styles.facts}>
            <View style={styles.fact}><CalendarDays size={18} color={colors.verde} /><View style={styles.flex}><Text style={styles.factTitle}>{textoDisponible(product.available_from)}</Text><Text style={styles.factText}>Publicado el {textoFecha(publicado)}</Text></View></View>
            <View style={styles.fact}><Truck size={18} color={colors.verde} /><View style={styles.flex}><Text style={styles.factTitle}>Entrega o recogida</Text><Text style={styles.factText}>{entrega}</Text></View></View>
          </View>

          <Text style={styles.section}>Descripción</Text>
          <Text style={styles.description}>{descripcion}</Text>

          {otras.length > 0 && !!onOpenProduct && <>
            <Text style={styles.section}>Más de {business ? business.name : 'este productor'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.otras}>
              {otras.map((otra) => { const f = fotosDe(otra)[0]; return <Pressable key={otra.id} accessibilityRole="button" onPress={() => onOpenProduct(otra, business)} style={styles.otra}>
                <View style={styles.otraFoto}>{f ? <Image source={{ uri: f }} style={styles.otraImagen} /> : <Sprout size={26} color={colors.verde} />}</View>
                <Text style={styles.otraNombre} numberOfLines={1}>{otra.name}</Text>
                <Text style={styles.otraCantidad} numberOfLines={1}>{mostrarCantidad(otra.stock)} {textoUnidad(otra.stock, otra.unit)}</Text>
              </Pressable>; })}
            </ScrollView>
          </>}
          <Text style={styles.contactNote}>Acuerdas el precio final y la entrega directamente con el productor. Sava no procesa pagos.</Text>
        </Animated.View>
      </ScrollView>

      {/* contacto siempre a mano */}
      <View style={styles.barra}>
        {!!onConsultar && !!business && hayStock && <Pressable accessibilityRole="button" accessibilityLabel="Enviar consulta en Sava" onPress={() => onConsultar(product, business)} style={({ pressed }) => [styles.consulta, pressed && styles.presionado]}><ClipboardList size={20} color={colors.verde} /></Pressable>}
        <Pressable accessibilityRole="button" disabled={!business} onPress={() => void escribirPorWhatsApp(product, business)} style={({ pressed }) => [styles.contactar, !business && styles.disabled, pressed && styles.presionado]}>
          <MessageCircle size={20} color={colors.white} /><Text style={styles.contactarTexto}>Contactar al productor</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 30 },
  hero: { height: 300, backgroundColor: colors.salvia },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderText: { color: colors.verde, fontSize: 13, fontWeight: '700' },
  puntos: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(240,233,223,0.6)' },
  puntoActivo: { backgroundColor: colors.white, width: 18 },
  top: { position: 'absolute', top: 10, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', gap: 8 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(240,233,223,0.94)', alignItems: 'center', justifyContent: 'center' },
  cuerpo: { padding: 18, marginTop: -18, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.crema },
  categoria: { color: colors.arcilla, fontSize: 12, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  name: { color: colors.grafito, fontSize: 24, fontWeight: '900', marginTop: 2 },
  lugar: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  lugarTexto: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  productor: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginTop: 14 },
  productorIcono: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' },
  productorNombre: { color: colors.grafito, fontSize: 15, fontWeight: '900' },
  productorTexto: { color: colors.muted, fontSize: 12, marginTop: 1 },
  sinProductor: { color: colors.muted, fontSize: 13, marginTop: 12 },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  dato: { flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  datoFuerte: { flexBasis: '100%', backgroundColor: colors.verde, borderColor: colors.verde, gap: 2 },
  datoEtiqueta: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  datoEtiquetaClara: { color: colors.verdeClaro, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  datoValor: { color: colors.grafito, fontSize: 16, fontWeight: '900', marginTop: 3 },
  datoValorClaro: { color: colors.white, fontSize: 22, fontWeight: '900' },
  oir: { marginTop: 12 },
  facts: { marginTop: 12, gap: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  factTitle: { color: colors.grafito, fontSize: 14, fontWeight: '800' },
  factText: { color: colors.muted, fontSize: 12, marginTop: 1 },
  section: { color: colors.grafito, fontSize: 18, fontWeight: '900', marginTop: 20, marginBottom: 6 },
  description: { color: colors.grafito, fontSize: 15, lineHeight: 22 },
  otras: { gap: 10, paddingRight: 8 },
  otra: { width: 130 },
  otraFoto: { height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' },
  otraImagen: { width: '100%', height: '100%' },
  otraNombre: { color: colors.grafito, fontSize: 14, fontWeight: '800', marginTop: 6 },
  otraCantidad: { color: colors.verde, fontSize: 12, fontWeight: '800' },
  contactNote: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 20 },
  barra: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: colors.crema, borderTopWidth: 1, borderTopColor: colors.line },
  consulta: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' },
  contactar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, backgroundColor: colors.verde },
  contactarTexto: { color: colors.white, fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  presionado: { transform: [{ scale: 0.97 }] },
});
