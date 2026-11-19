import { useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy, MapPin, MessageCircle, Share2, Sparkles, Sprout } from 'lucide-react-native';
import type { Product } from '../inventory/types';
import type { Business } from '../business/types';
import { colors } from '../../shared/theme';
import { dinero, textoMinimo } from '../../shared/contacto';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';
import { getProductImageUri } from '../marketplace/getProductImageUri';
import SavaLogo from '../../shared/components/SavaLogo';
import { guionVideo, textoFacebook, textoInstagram, textoWhatsApp } from './textosPromocion';
import { preguntarAMaria } from '../chat/mariaIA';

type Props = {
  product: Product;
  business: Business | null;
  tipo: 'agricultor' | 'tienda';
  onBack: () => void;
};
type Pestana = 'whatsapp' | 'facebook' | 'instagram' | 'video';

// promocionar con sava: imagen publicitaria con la foto real y textos listos para compartir.
// nada se publica solo: la persona decide donde compartir
export default function PromocionarScreen({ product, business, tipo, onBack }: Props) {
  const tarjeta = useRef<ComponentRef<typeof View>>(null);
  const [pestana, setPestana] = useState<Pestana>('whatsapp');
  const [compartiendo, setCompartiendo] = useState(false);
  const [textoIA, setTextoIA] = useState<Record<string, string>>({});
  const [pensando, setPensando] = useState(false);
  const foto = getProductImageUri(product.photo_uri);
  const minimo = textoMinimo(product.min_order, product.unit);
  let lugar = product.municipality;
  if (!lugar && business) lugar = business.municipality;

  const textos: Record<Pestana, string> = {
    whatsapp: textoWhatsApp(product, business),
    facebook: textoFacebook(product, business),
    instagram: textoInstagram(product, business),
    video: guionVideo(product, business),
  };
  const texto = textoIA[pestana] || textos[pestana];

  async function compartirImagen() {
    setCompartiendo(true);
    try {
      const uri = await captureRef(tarjeta, { format: 'png', quality: 0.95 });
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir publicidad de ' + product.name,
        });
      else Alert.alert('No se puede compartir', 'Este celular no permite compartir imágenes desde la app.');
    } catch {
      Alert.alert('No se pudo crear la imagen', 'Intenta otra vez.');
    } finally {
      setCompartiendo(false);
    }
  }

  async function copiar() {
    await Clipboard.setStringAsync(texto);
    Alert.alert('Copiado', 'Ahora pégalo donde quieras compartirlo.');
  }

  async function enviarWhatsApp() {
    const enlace = 'whatsapp://send?text=' + encodeURIComponent(texto);
    try {
      if (await Linking.canOpenURL(enlace)) {
        await Linking.openURL(enlace);
        return;
      }
    } catch {
      /* se usa compartir */
    }
    await Share.share({ message: texto });
  }

  // texto distinto con la ia (necesita internet). si no hay, se quedan los textos de siempre
  async function pedirOtro() {
    setPensando(true);
    const red: Record<Pestana, string> = {
      whatsapp: 'un mensaje corto para WhatsApp',
      facebook: 'una publicación para Facebook',
      instagram: 'un texto para Instagram con hashtags',
      video: 'un guion para un video corto de 15 segundos',
    };
    const pedido =
      'Escribe ' +
      red[pestana] +
      ' para promocionar esta cosecha. Usa solo estos datos, sin inventar nada: ' +
      textos.whatsapp.replace(/\*/g, '') +
      '. Responde solo con el texto.';
    const respuesta = await preguntarAMaria(pedido, [], tipo).catch(() => null);
    setPensando(false);
    if (!respuesta || respuesta.texto === '') {
      Alert.alert(
        'Necesitas internet',
        'Para pedirle otro texto a tu asistente necesitas conexión. Mientras tanto puedes usar el texto que ya está listo.',
      );
      return;
    }
    setTextoIA({ ...textoIA, [pestana]: respuesta.texto });
  }

  const pestanas: Array<{ clave: Pestana; texto: string }> = [
    { clave: 'whatsapp', texto: 'WhatsApp' },
    { clave: 'facebook', texto: 'Facebook' },
    { clave: 'instagram', texto: 'Instagram' },
    { clave: 'video', texto: 'Guion de video' },
  ];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.volver}>
        <ArrowLeft size={20} color={colors.verde} />
        <Text style={styles.volverTexto}>Volver</Text>
      </Pressable>
      <Text style={styles.titulo}>Promocionar con Sava</Text>
      <Text style={styles.subtitulo}>Comparte tu cosecha donde tú quieras. Sava no publica nada sin ti.</Text>

      {/* esta tarjeta es la imagen que se comparte */}
      <View ref={tarjeta} collapsable={false} style={styles.tarjeta}>
        <View style={styles.foto}>
          {foto ? (
            <Image source={{ uri: foto }} style={styles.fotoImagen} resizeMode="cover" />
          ) : (
            <Sprout size={64} color={colors.verde} strokeWidth={1.4} />
          )}
          {!foto && (
            <Text style={styles.sinFoto}>Agrega una foto real para que la publicidad luzca mejor</Text>
          )}
        </View>
        <View style={styles.tarjetaCuerpo}>
          <Text style={styles.tarjetaNombre}>{product.name}</Text>
          <View style={styles.lugar}>
            <MapPin size={14} color={colors.crema} />
            <Text style={styles.lugarTexto}>
              {lugar ? lugar + ', Casanare' : 'Casanare'}
              {business ? ' · ' + business.name : ''}
            </Text>
          </View>
          <View style={styles.datos}>
            <View style={styles.dato}>
              <Text style={styles.datoEtiqueta}>DISPONIBLE</Text>
              <Text style={styles.datoValor}>
                {mostrarCantidad(product.stock)} {textoUnidad(product.stock, product.unit)}
              </Text>
            </View>
            <View style={styles.dato}>
              <Text style={styles.datoEtiqueta}>{minimo ? 'PEDIDO MÍNIMO' : 'VENTA'}</Text>
              <Text style={styles.datoValor}>
                {minimo ? minimo.replace('Desde ', '') : 'Cualquier cantidad'}
              </Text>
            </View>
          </View>
          <Text style={styles.precio}>
            {product.price_cop > 0 ? dinero(product.price_cop) + ' por ' + product.unit : 'Precio a convenir'}
          </Text>
          <View style={styles.pie}>
            <View style={styles.logo}>
              <SavaLogo size="small" />
            </View>
            <Text style={styles.pieTexto}>Encuéntralo en Sava{'\n'}Hecho en Casanare</Text>
          </View>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={compartiendo}
        onPress={() => void compartirImagen()}
        style={({ pressed }) => [styles.boton, pressed && styles.presionado]}
      >
        {compartiendo ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Share2 size={20} color={colors.white} />
        )}
        <Text style={styles.botonTexto}>Compartir o guardar la imagen</Text>
      </Pressable>

      <Text style={styles.seccion}>Textos listos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pestanas}>
        {pestanas.map((p) => (
          <Pressable
            key={p.clave}
            onPress={() => setPestana(p.clave)}
            style={[styles.pestana, pestana === p.clave && styles.pestanaActiva]}
          >
            <Text style={[styles.pestanaTexto, pestana === p.clave && styles.pestanaTextoActiva]}>
              {p.texto}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.texto}>
        <Text selectable style={styles.textoContenido}>
          {texto}
        </Text>
      </View>
      <View style={styles.fila}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void copiar()}
          style={[styles.botonSuave, styles.flex]}
        >
          <Copy size={18} color={colors.verde} />
          <Text style={styles.botonSuaveTexto}>Copiar</Text>
        </Pressable>
        {pestana === 'whatsapp' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void enviarWhatsApp()}
            style={[styles.botonSuave, styles.flex]}
          >
            <MessageCircle size={18} color={colors.verde} />
            <Text style={styles.botonSuaveTexto}>Enviar</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Share.share({ message: texto })}
            style={[styles.botonSuave, styles.flex]}
          >
            <Share2 size={18} color={colors.verde} />
            <Text style={styles.botonSuaveTexto}>Compartir</Text>
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={pensando}
        onPress={() => void pedirOtro()}
        style={styles.ia}
      >
        {pensando ? <ActivityIndicator color={colors.verde} /> : <Sparkles size={18} color={colors.verde} />}
        <Text style={styles.iaTexto}>{pensando ? 'Aru está escribiendo…' : 'Pedir otro texto a Aru'}</Text>
      </Pressable>
      <Text style={styles.nota}>
        Los textos usan solo los datos de tu publicación. Revísalos antes de compartir.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 18, paddingTop: 10, paddingBottom: 40 },
  volver: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  volverTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  titulo: { color: colors.verde, fontSize: 24, fontWeight: '900', marginTop: 4 },
  subtitulo: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2, marginBottom: 12 },
  tarjeta: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.verde },
  foto: { height: 230, backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' },
  fotoImagen: { width: '100%', height: '100%' },
  sinFoto: {
    color: colors.verde,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  tarjetaCuerpo: { padding: 16 },
  tarjetaNombre: { color: colors.white, fontSize: 26, fontWeight: '900' },
  lugar: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  lugarTexto: { color: colors.crema, fontSize: 14, fontWeight: '700', flex: 1 },
  datos: { flexDirection: 'row', gap: 8, marginTop: 14 },
  dato: { flex: 1, backgroundColor: 'rgba(240,233,223,0.14)', borderRadius: 14, padding: 10 },
  datoEtiqueta: { color: colors.verdeClaro, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  datoValor: { color: colors.white, fontSize: 17, fontWeight: '900', marginTop: 3 },
  precio: { color: colors.arcilla, fontSize: 18, fontWeight: '900', marginTop: 12 },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(240,233,223,0.25)',
  },
  logo: { backgroundColor: colors.crema, borderRadius: 12, padding: 4 },
  pieTexto: { color: colors.crema, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.verde,
    borderRadius: 24,
    paddingVertical: 14,
    marginTop: 12,
  },
  botonTexto: { color: colors.white, fontSize: 16, fontWeight: '900' },
  presionado: { transform: [{ scale: 0.97 }] },
  seccion: { color: colors.grafito, fontSize: 18, fontWeight: '900', marginTop: 22, marginBottom: 8 },
  pestanas: { gap: 6 },
  pestana: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pestanaActiva: { backgroundColor: colors.verde, borderColor: colors.verde },
  pestanaTexto: { color: colors.verde, fontSize: 14, fontWeight: '800' },
  pestanaTextoActiva: { color: colors.white },
  texto: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginTop: 10,
  },
  textoContenido: { color: colors.grafito, fontSize: 15, lineHeight: 22 },
  fila: { flexDirection: 'row', gap: 8, marginTop: 10 },
  botonSuave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.salvia,
    borderRadius: 22,
    paddingVertical: 12,
  },
  botonSuaveTexto: { color: colors.verde, fontSize: 15, fontWeight: '900' },
  ia: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  iaTexto: { color: colors.verde, fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' },
  nota: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
