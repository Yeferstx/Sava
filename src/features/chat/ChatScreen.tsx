import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Mic, MessageCircle, RotateCcw, Send, Sparkles, Sprout, Volume2, VolumeX } from 'lucide-react-native';
import type { ChatMessage, ProductDraft, Recomendacion, VentaPropuesta } from './types';
import type { Product } from '../inventory/types';
import type { Business } from '../business/types';
import { colors } from '../../shared/theme';
import { dinero, escribirPorWhatsApp } from '../../shared/contacto';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';
import { getProductImageUri } from '../marketplace/getProductImageUri';
import { hablar } from '../../shared/voz';

type Props = {
  messages: ChatMessage[]; draft: ProductDraft | null; venta: VentaPropuesta | null; pensando: boolean; leerEnVoz: boolean; tipo: 'agricultor' | 'tienda' | '';
  onSend: (text: string) => void; onReset: () => void; onBack: () => void; onCambiarVoz: () => void;
  onConfirmDraft: () => void; onEditDraft: () => void; onConfirmarVenta: () => void; onCancelarVenta: () => void;
  onOpenProduct: (product: Product, business: Business | null) => void;
};

// frases de ejemplo segun quien usa la app (todas funcionan)
function ejemplos(tipo: Props['tipo']) {
  if (tipo === 'agricultor') return ['Tengo 200 kilos de piña a 2.500', 'Vendí 10 kilos de yuca', '¿Cuánta papaya me queda?', '¿Cuánto vendí esta semana?'];
  if (tipo === 'tienda') return ['Tengo 20 bultos de abono a 95 mil', 'Vendí 2 litros de herbicida', '¿Qué tengo en inventario?', '¿Cuánto vendí hoy?'];
  return ['Necesito 50 kilos de piña', 'Busco abono en Aguazul', '¿Quién vende plátano en Yopal?'];
}

function TarjetaRecomendada({ item, onOpen }: { item: Recomendacion; onOpen: () => void }) {
  const foto = getProductImageUri(item.product.photo_uri);
  let lugar = item.product.municipality;
  if (!lugar && item.business) lugar = item.business.municipality;
  return <View style={styles.reco}>
    <Pressable accessibilityRole="button" accessibilityLabel={'Ver ' + item.product.name} onPress={onOpen} style={styles.recoArriba}>
      <View style={styles.recoFoto}>{foto ? <Image source={{ uri: foto }} style={styles.recoImagen} /> : <Sprout size={24} color={colors.verde} />}</View>
      <View style={styles.flex}>
        <Text style={styles.recoNombre} numberOfLines={1}>{item.product.name}</Text>
        <Text style={styles.recoPrecio}>{dinero(item.product.price_cop)} por {item.product.unit}</Text>
        <Text style={styles.recoMeta} numberOfLines={1}>{mostrarCantidad(item.product.stock)} {textoUnidad(item.product.stock, item.product.unit)} · {lugar ? lugar : 'Casanare'}{item.business ? ' · ' + item.business.name : ''}</Text>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => void escribirPorWhatsApp(item.product, item.business)} style={styles.recoBoton}>
      <MessageCircle size={16} color={colors.white} /><Text style={styles.recoBotonTexto}>Escribirle por WhatsApp</Text>
    </Pressable>
  </View>;
}

export default function ChatScreen(props: Props) {
  const { messages, draft, venta, pensando, leerEnVoz, tipo } = props;
  const [texto, setTexto] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { setTimeout(() => { if (scroll.current) scroll.current.scrollToEnd({ animated: true }); }, 80); }, [messages.length, draft, venta]);

  function enviar(valor = texto) {
    if (!valor.trim()) return;
    props.onSend(valor);
    setTexto('');
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={10} onPress={props.onBack} style={styles.headerBoton}><ArrowLeft size={22} color={colors.white} /></Pressable>
        <View style={styles.headerCentro}>
          <View style={styles.nameRow}><Text style={styles.name}>María</Text><Sparkles size={15} color={colors.arcilla} /></View>
          <Text style={styles.subtitle}>Entiende frases sencillas · sin IA conectada</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={leerEnVoz ? 'Dejar de leer en voz alta' : 'Leer respuestas en voz alta'} hitSlop={10} onPress={props.onCambiarVoz} style={[styles.headerBoton, leerEnVoz && styles.vozActiva]}>
          {leerEnVoz ? <Volume2 size={21} color={colors.white} /> : <VolumeX size={21} color={colors.white} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Empezar de nuevo" hitSlop={10} onPress={props.onReset} style={styles.headerBoton}><RotateCcw size={20} color={colors.white} /></Pressable>
      </View>

      <ScrollView ref={scroll} style={styles.body} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {messages.map((mensaje) => {
          const deMaria = mensaje.author === 'assistant';
          return <View key={mensaje.id} style={styles.grupo}>
            <View style={[styles.bubble, deMaria ? styles.assistantBubble : styles.userBubble]}>
              <Text style={[styles.bubbleText, !deMaria && styles.userText]}>{mensaje.text}</Text>
              {deMaria && <Pressable accessibilityRole="button" accessibilityLabel="Escuchar este mensaje" hitSlop={8} onPress={() => hablar(mensaje.text)} style={styles.oir}><Volume2 size={15} color={colors.verde} /><Text style={styles.oirTexto}>Escuchar</Text></Pressable>}
            </View>
            {mensaje.recomendaciones && mensaje.recomendaciones.map((item) => <TarjetaRecomendada key={item.product.id} item={item} onOpen={() => props.onOpenProduct(item.product, item.business)} />)}
          </View>;
        })}

        {pensando && <View style={[styles.bubble, styles.assistantBubble, styles.pensando]}><ActivityIndicator size="small" color={colors.verde} /><Text style={styles.bubbleText}>María está revisando…</Text></View>}

        {draft && <View style={styles.card}>
          <Text style={styles.cardEyebrow}>PUBLICACIÓN LISTA PARA REVISAR</Text>
          <Text style={styles.cardTitle}>{draft.name}</Text>
          <Text style={styles.cardDato}>{mostrarCantidad(draft.stock)} {textoUnidad(draft.stock, draft.unit)} · {dinero(draft.price_cop)} por {draft.unit}</Text>
          <Text style={styles.cardHint}>Categoría: {draft.category}. Nada se publica hasta que toques «Confirmar».</Text>
          <View style={styles.cardBotones}>
            <Pressable accessibilityRole="button" onPress={props.onEditDraft} style={styles.botonSuave}><Text style={styles.botonSuaveTexto}>Corregir</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={props.onConfirmDraft} style={styles.botonFuerte}><Text style={styles.botonFuerteTexto}>Confirmar</Text></Pressable>
          </View>
        </View>}

        {venta && <View style={styles.card}>
          <Text style={styles.cardEyebrow}>VENTA PARA REGISTRAR</Text>
          <Text style={styles.cardTitle}>{venta.nombre}</Text>
          <Text style={styles.cardDato}>{mostrarCantidad(venta.cantidad)} {textoUnidad(venta.cantidad, venta.unidad)} × {dinero(venta.precio)} = {dinero(venta.total)}</Text>
          <Text style={styles.cardHint}>Al confirmar se descuentan del inventario. Te quedarían {mostrarCantidad(venta.quedan)} {textoUnidad(venta.quedan, venta.unidad)}. Es un registro tuyo, no una factura.</Text>
          <View style={styles.cardBotones}>
            <Pressable accessibilityRole="button" onPress={props.onCancelarVenta} style={styles.botonSuave}><Text style={styles.botonSuaveTexto}>No</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={props.onConfirmarVenta} style={styles.botonFuerte}><Text style={styles.botonFuerteTexto}>Sí, registrar</Text></Pressable>
          </View>
        </View>}

        {messages.length <= 2 && <View style={styles.ejemplos}>
          <Text style={styles.ejemplosTitulo}>Toca un ejemplo:</Text>
          {ejemplos(tipo).map((ejemplo) => <Pressable key={ejemplo} accessibilityRole="button" onPress={() => enviar(ejemplo)} style={styles.ejemplo}><Text style={styles.ejemploTexto}>{ejemplo}</Text></Pressable>)}
        </View>}
      </ScrollView>

      <View style={styles.dictado}><Mic size={14} color={colors.muted} /><Text style={styles.dictadoTexto}>Para hablar, toca el micrófono de tu teclado.</Text></View>
      <View style={styles.composer}>
        <TextInput accessibilityLabel="Mensaje para María" value={texto} onChangeText={setTexto} placeholder="Escríbele o háblale a María…" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={() => enviar()} returnKeyType="send" maxLength={200} />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensaje" disabled={pensando} onPress={() => enviar()} style={styles.send}><Send size={20} color={colors.white} /></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingTop: 44, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.verde },
  headerBoton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  vozActiva: { backgroundColor: 'rgba(255,255,255,0.18)' },
  headerCentro: { flex: 1, alignItems: 'center' }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { color: colors.white, fontWeight: '900', fontSize: 19 }, subtitle: { color: colors.verdeClaro, fontSize: 11, marginTop: 2 },
  body: { flex: 1, backgroundColor: colors.crema }, content: { padding: 16, paddingBottom: 20 },
  grupo: { marginBottom: 8, gap: 8 },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 },
  assistantBubble: { backgroundColor: colors.white, alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.line },
  userBubble: { backgroundColor: colors.verde, alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  bubbleText: { color: colors.grafito, fontSize: 16, lineHeight: 22 }, userText: { color: colors.white },
  oir: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7, alignSelf: 'flex-start' }, oirTexto: { color: colors.verde, fontSize: 12, fontWeight: '800' },
  pensando: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reco: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 10, marginLeft: 6, maxWidth: '92%' },
  recoArriba: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recoFoto: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' }, recoImagen: { width: '100%', height: '100%' },
  recoNombre: { color: colors.grafito, fontSize: 15, fontWeight: '800' }, recoPrecio: { color: colors.verde, fontSize: 14, fontWeight: '800', marginTop: 2 }, recoMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  recoBoton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.verde, borderRadius: 20, paddingVertical: 10, marginTop: 10 }, recoBotonTexto: { color: colors.white, fontSize: 14, fontWeight: '800' },
  card: { backgroundColor: colors.white, borderRadius: 18, borderColor: colors.verde, borderWidth: 1.5, padding: 15, marginTop: 6, marginBottom: 8 },
  cardEyebrow: { color: colors.muted, fontWeight: '900', letterSpacing: 0.8, fontSize: 11 }, cardTitle: { color: colors.grafito, fontWeight: '900', fontSize: 19, marginTop: 5 },
  cardDato: { color: colors.verde, fontWeight: '800', fontSize: 15, marginTop: 4 }, cardHint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 8 },
  cardBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 13 },
  botonSuave: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: colors.verdeClaro }, botonSuaveTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  botonFuerte: { borderRadius: 22, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: colors.verde }, botonFuerteTexto: { color: colors.white, fontSize: 15, fontWeight: '900' },
  ejemplos: { marginTop: 10, gap: 8 }, ejemplosTitulo: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  ejemplo: { alignSelf: 'flex-start', backgroundColor: colors.verdeClaro, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }, ejemploTexto: { color: colors.verde, fontSize: 15, fontWeight: '700' },
  dictado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 6, backgroundColor: colors.crema }, dictadoTexto: { color: colors.muted, fontSize: 12 },
  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 22 : 10, gap: 8, backgroundColor: colors.crema },
  input: { flex: 1, backgroundColor: colors.white, borderRadius: 26, minHeight: 52, paddingHorizontal: 16, color: colors.grafito, fontSize: 16, borderWidth: 1, borderColor: colors.line },
  send: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center' },
});
