import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, MessageCircle, Mic, RotateCcw, Search, Send, Sprout, Tag, Users, Volume2, VolumeX } from 'lucide-react-native';
import type { ChatMessage, ProductDraft, Recomendacion, VentaPropuesta } from './types';
import type { Product } from '../inventory/types';
import type { Business } from '../business/types';
import { colors } from '../../shared/theme';
import { dinero, escribirPorWhatsApp } from '../../shared/contacto';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';
import { getProductImageUri } from '../marketplace/getProductImageUri';
import { escucharVoz, hablar } from '../../shared/voz';
import AsistenteOrbe, { textoEstado, type EstadoAsistente } from './components/AsistenteOrbe';


type Props = {
  messages: ChatMessage[]; draft: ProductDraft | null; venta: VentaPropuesta | null; pensando: boolean; leerEnVoz: boolean; conIA: boolean; tipo: 'agricultor' | 'tienda' | '';
  onSend: (text: string) => void; onReset: () => void; onBack: () => void; onCambiarVoz: () => void;
  onConfirmDraft: () => void; onEditDraft: () => void; onConfirmarVenta: () => void; onCancelarVenta: () => void;
  onOpenProduct: (product: Product, business: Business | null) => void;
  modoInicial?: 'voz' | 'texto' | '';
};

// sugerencias segun quien usa la app (todas funcionan con las reglas o con la ia)
function sugerencias(tipo: Props['tipo']) {
  if (tipo === '') return [
    { Icon: Search, titulo: 'Buscar productos', frase: '¿Quién vende plátano en Yopal?' },
    { Icon: Tag, titulo: 'Consultar precios', frase: '¿A cómo está la piña?' },
    { Icon: Sprout, titulo: 'Insumos para el campo', frase: 'Busco abono en Aguazul' },
  ];
  return [
    { Icon: Sprout, titulo: tipo === 'tienda' ? 'Publicar un producto' : 'Publicar mi cosecha', frase: tipo === 'tienda' ? 'Tengo 20 bultos de abono a 95 mil' : 'Tengo 200 kilos de piña a 2.500' },
    { Icon: Users, titulo: 'Anotar una venta', frase: tipo === 'tienda' ? 'Vendí 2 litros de herbicida' : 'Vendí 10 kilos de yuca' },
    { Icon: Tag, titulo: 'Consultar precios', frase: '¿A cómo se vende la piña?' },
    { Icon: Search, titulo: 'Mis ventas', frase: '¿Cuánto vendí esta semana?' },
  ];
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
  const [hablando, setHablando] = useState(false);
  const [ayudaMicrofono, setAyudaMicrofono] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const entrada = useRef<ComponentRef<typeof TextInput>>(null);

  // hablando solo cuando de verdad suena la voz de maria
  useEffect(() => escucharVoz(setHablando), []);
  // si se abrio desde "hablar" o "escribir" se deja lista la entrada
  useEffect(() => {
    if (props.modoInicial === 'voz') setAyudaMicrofono(true);
    if (props.modoInicial === 'voz' || props.modoInicial === 'texto') {
      const espera = setTimeout(() => { if (entrada.current) entrada.current.focus(); }, 350);
      return () => clearTimeout(espera);
    }
  }, []);
  // solo baja al final cuando ya hay conversacion (al empezar se ve el personaje completo)
  useEffect(() => {
    if (messages.length <= 1 && !draft && !venta) return;
    setTimeout(() => { if (scroll.current) scroll.current.scrollToEnd({ animated: true }); }, 80);
  }, [messages.length, draft, venta, pensando]);

  // el estado del personaje sale de lo que esta pasando de verdad.
  // "escuchando" se usara cuando la app grabe con su propio microfono (hoy se dicta con el teclado)
  let estado: EstadoAsistente = 'reposo';
  if (pensando) estado = 'pensando';
  if (hablando) estado = 'hablando';

  function enviar(valor = texto) {
    if (!valor.trim()) return;
    props.onSend(valor);
    setTexto('');
    setAyudaMicrofono(false);
  }

  // el microfono abre el teclado: ahi se toca el microfono del teclado y se habla
  function usarMicrofono() {
    setAyudaMicrofono(true);
    if (entrada.current) entrada.current.focus();
  }

  const empezando = messages.length <= 1 && !draft && !venta;
  let bienvenida = '';
  if (messages.length > 0) bienvenida = messages[0].text;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.fondo}>

        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={10} onPress={props.onBack} style={styles.headerBoton}><ArrowLeft size={22} color={colors.verde} /></Pressable>
          <View style={styles.headerCentro}>
            <Text style={styles.name}>María</Text>
            <Text style={styles.subtitle}>{props.conIA ? 'Con inteligencia artificial' : 'Asistente de Sava'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={leerEnVoz ? 'Dejar de hablar en voz alta' : 'Hablar en voz alta'} hitSlop={10} onPress={props.onCambiarVoz} style={[styles.headerBoton, leerEnVoz && styles.vozActiva]}>
            {leerEnVoz ? <Volume2 size={21} color={colors.verde} /> : <VolumeX size={21} color={colors.verde} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Empezar de nuevo" hitSlop={10} onPress={props.onReset} style={styles.headerBoton}><RotateCcw size={20} color={colors.verde} /></Pressable>
        </View>

        <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {empezando ? <View style={styles.hero}>
            <AsistenteOrbe estado={estado} tamano={176} />
            <View style={styles.estado}><Text style={styles.estadoTexto}>{textoEstado(estado)}</Text></View>
            <Text style={styles.saludo}>{bienvenida}</Text>
            <Pressable accessibilityRole="button" onPress={() => void hablar(bienvenida)} style={styles.oirSaludo}><Volume2 size={16} color={colors.verde} /><Text style={styles.oirTexto}>Escuchar</Text></Pressable>
            <Text style={styles.sugerenciasTitulo}>Puedes preguntarme:</Text>
            <View style={styles.sugerencias}>
              {sugerencias(tipo).map((item) => <Pressable key={item.titulo} accessibilityRole="button" accessibilityLabel={item.titulo + ': ' + item.frase} onPress={() => enviar(item.frase)} style={({ pressed }) => [styles.sugerencia, pressed && styles.presionado]}>
                <View style={styles.sugerenciaIcono}><item.Icon size={20} color={colors.verde} /></View>
                <View style={styles.flex}><Text style={styles.sugerenciaTitulo}>{item.titulo}</Text><Text style={styles.sugerenciaFrase}>«{item.frase}»</Text></View>
              </Pressable>)}
            </View>
          </View> : <>
            {/* con conversacion el personaje se queda arriba, pequeno pero presente */}
            <View style={styles.mini}>
              <AsistenteOrbe estado={estado} tamano={72} />
              <View style={styles.estadoMini}><Text style={styles.estadoTexto}>{textoEstado(estado)}</Text></View>
            </View>
            {messages.slice(1).map((mensaje) => {
              const deMaria = mensaje.author === 'assistant';
              return <View key={mensaje.id} style={styles.grupo}>
                <View style={[styles.bubble, deMaria ? styles.assistantBubble : styles.userBubble]}>
                  <Text style={[styles.bubbleText, !deMaria && styles.userText]}>{mensaje.text}</Text>
                  {deMaria && <Pressable accessibilityRole="button" accessibilityLabel="Escuchar este mensaje" hitSlop={8} onPress={() => void hablar(mensaje.text)} style={styles.oir}><Volume2 size={15} color={colors.verde} /><Text style={styles.oirTexto}>Escuchar</Text></Pressable>}
                </View>
                {mensaje.recomendaciones && mensaje.recomendaciones.map((item) => <TarjetaRecomendada key={item.product.id} item={item} onOpen={() => props.onOpenProduct(item.product, item.business)} />)}
              </View>;
            })}

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
          </>}
        </ScrollView>

        {ayudaMicrofono && <View style={styles.ayuda}><Mic size={16} color={colors.verde} /><Text style={styles.ayudaTexto}>Toca el micrófono de tu teclado y habla. Luego toca enviar.</Text></View>}
        <View style={styles.composer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Hablar por el micrófono" onPress={usarMicrofono} style={styles.mic}><Mic size={22} color={colors.verde} /></Pressable>
          <TextInput ref={entrada} accessibilityLabel="Mensaje para María" value={texto} onChangeText={setTexto} placeholder="Escríbele o háblale a María…" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={() => enviar()} returnKeyType="send" maxLength={300} />
          <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensaje" disabled={pensando || texto.trim() === ''} onPress={() => enviar()} style={[styles.send, (pensando || texto.trim() === '') && styles.sendApagado]}><Send size={20} color={colors.white} /></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fondo: { flex: 1, backgroundColor: colors.crema },
  header: { paddingTop: 8, paddingBottom: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBoton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  vozActiva: { backgroundColor: colors.salvia },
  headerCentro: { flex: 1, alignItems: 'center' },
  name: { color: colors.verde, fontWeight: '900', fontSize: 20 }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  hero: { alignItems: 'center', paddingTop: 4 },
  estado: { backgroundColor: colors.salvia, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 7, marginTop: 2 },
  estadoTexto: { color: colors.verde, fontSize: 14, fontWeight: '800' },
  saludo: { color: colors.grafito, fontSize: 18, lineHeight: 25, textAlign: 'center', marginTop: 14, paddingHorizontal: 8 },
  oirSaludo: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.salvia },
  sugerenciasTitulo: { alignSelf: 'flex-start', color: colors.grafito, fontSize: 15, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  sugerencias: { alignSelf: 'stretch', gap: 9 },
  sugerencia: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 12 },
  presionado: { transform: [{ scale: 0.98 }] },
  sugerenciaIcono: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' },
  sugerenciaTitulo: { color: colors.grafito, fontSize: 15, fontWeight: '800' },
  sugerenciaFrase: { color: colors.muted, fontSize: 13, marginTop: 2 },
  mini: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  estadoMini: { backgroundColor: colors.salvia, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginLeft: -16 },
  grupo: { marginBottom: 8, gap: 8 },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 },
  assistantBubble: { backgroundColor: colors.white, alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.line },
  userBubble: { backgroundColor: colors.verde, alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  bubbleText: { color: colors.grafito, fontSize: 16, lineHeight: 22 }, userText: { color: colors.white },
  oir: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7, alignSelf: 'flex-start' }, oirTexto: { color: colors.verde, fontSize: 12, fontWeight: '800' },
  reco: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 10, marginLeft: 6, maxWidth: '92%' },
  recoArriba: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recoFoto: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' }, recoImagen: { width: '100%', height: '100%' },
  recoNombre: { color: colors.grafito, fontSize: 15, fontWeight: '800' }, recoPrecio: { color: colors.verde, fontSize: 14, fontWeight: '800', marginTop: 2 }, recoMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  recoBoton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.verde, borderRadius: 20, paddingVertical: 10, marginTop: 10 }, recoBotonTexto: { color: colors.white, fontSize: 14, fontWeight: '800' },
  card: { backgroundColor: colors.white, borderRadius: 18, borderColor: colors.verde, borderWidth: 1.5, padding: 15, marginTop: 6, marginBottom: 8 },
  cardEyebrow: { color: colors.muted, fontWeight: '900', letterSpacing: 0.8, fontSize: 11 }, cardTitle: { color: colors.grafito, fontWeight: '900', fontSize: 19, marginTop: 5 },
  cardDato: { color: colors.verde, fontWeight: '800', fontSize: 15, marginTop: 4 }, cardHint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 8 },
  cardBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 13 },
  botonSuave: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: colors.salvia }, botonSuaveTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  botonFuerte: { borderRadius: 22, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: colors.verde }, botonFuerteTexto: { color: colors.white, fontSize: 15, fontWeight: '900' },
  ayuda: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 12, marginBottom: 4, padding: 10, borderRadius: 14, backgroundColor: colors.salvia },
  ayudaTexto: { color: colors.verde, fontSize: 13, fontWeight: '700', flex: 1 },
  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10, gap: 8 },
  mic: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.verde, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: colors.white, borderRadius: 25, minHeight: 50, paddingHorizontal: 16, color: colors.grafito, fontSize: 16, borderWidth: 1, borderColor: colors.line },
  send: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center' }, sendApagado: { opacity: 0.45 },
});
