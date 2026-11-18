import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, Image, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { ArrowLeft, Clock, Keyboard as IconoTeclado, MessageCircle, Mic, RotateCcw, Send, Sprout, Square, Volume2, VolumeX, WifiOff } from 'lucide-react-native';
import NotaVoz from '../../shared/components/NotaVoz';
import type { ChatMessage, ProductDraft, Recomendacion, VentaPropuesta } from './types';
import type { Product } from '../inventory/types';
import type { Business } from '../business/types';
import { colors } from '../../shared/theme';
import { dinero, escribirPorWhatsApp } from '../../shared/contacto';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';
import { getProductImageUri } from '../marketplace/getProductImageUri';
import { callar, escucharVoz, hablar } from '../../shared/voz';
import { empezarEscucha, entiendeSinInternet, escuchaDisponible } from '../../shared/escucha';
import { pedirReducirMovimiento } from '../../shared/movimiento';
import AsistenteOrbe, { textoEstado, type EstadoAsistente } from './components/AsistenteOrbe';

// en android viejo las transiciones de tamano necesitan esto
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

type Props = {
  messages: ChatMessage[]; draft: ProductDraft | null; venta: VentaPropuesta | null; pensando: boolean; leerEnVoz: boolean; conIA: boolean; tipo: 'agricultor' | 'tienda' | '';
  sinSenal: boolean; enEspera: number;
  onSend: (text: string, audio?: string) => void; onReset: () => void; onBack: () => void; onCambiarVoz: () => void;
  onConfirmDraft: () => void; onEditDraft: () => void; onConfirmarVenta: () => void; onCancelarVenta: () => void;
  onOpenProduct: (product: Product, business: Business | null) => void;
  modoInicial?: 'voz' | 'texto' | '';
};

// sugerencias cortas segun quien usa la app (todas tienen respuesta)
function sugerencias(tipo: Props['tipo']) {
  if (tipo === '') return [
    { titulo: 'Buscar productos', frase: '¿Quién vende plátano en Yopal?' },
    { titulo: 'Consultar precios', frase: '¿A cómo está la piña?' },
    { titulo: 'Insumos para el campo', frase: 'Busco abono en Aguazul' },
    { titulo: '¿Cómo vendo en Sava?', frase: '¿Cómo vendo en Sava?' },
  ];
  return [
    { titulo: 'Buscar productos', frase: '¿Quién vende plátano en Yopal?' },
    { titulo: 'Encontrar compradores', frase: '¿Cómo encuentro compradores?' },
    { titulo: 'Registrar una venta', frase: 'Quiero registrar una venta' },
    { titulo: 'Consultar mis productos', frase: '¿Qué productos tengo?' },
  ];
}

// transicion suave para cambios de tamano (personaje, teclado, modo voz)
function suavizar() {
  LayoutAnimation.configureNext(LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

// cada mensaje nuevo aparece con un desvanecido corto
function Aparecer({ children }: { children: React.ReactNode }) {
  const valor = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(valor, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, []);
  const subir = valor.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return <Animated.View style={{ opacity: valor, transform: [{ translateY: subir }] }}>{children}</Animated.View>;
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
    <Pressable accessibilityRole="button" onPress={() => void escribirPorWhatsApp(item.product, item.business)} style={({ pressed }) => [styles.recoBoton, pressed && styles.presionado]}>
      <MessageCircle size={16} color={colors.white} /><Text style={styles.recoBotonTexto}>Escribirle por WhatsApp</Text>
    </Pressable>
  </View>;
}

export default function ChatScreen(props: Props) {
  const { messages, draft, venta, pensando, leerEnVoz, tipo } = props;
  const [texto, setTexto] = useState('');
  const [hablando, setHablando] = useState(false);
  const [teclado, setTeclado] = useState(false);
  const [modoVoz, setModoVoz] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [volumen, setVolumen] = useState(0);
  const [parcial, setParcial] = useState('');
  const [aviso, setAviso] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const entrada = useRef<ComponentRef<typeof TextInput>>(null);
  const detener = useRef<() => void>(() => undefined);
  const reducir = useRef(false);
  // charla: en modo voz, despues de que el asistente responde vuelve a escuchar solo
  const esperaTurno = useRef(false);
  const yaHablo = useRef(false);
  const modoVozRef = useRef(false);
  modoVozRef.current = modoVoz;

  useEffect(() => { void pedirReducirMovimiento().then((valor) => { reducir.current = valor; }); }, []);

  // hablando solo cuando de verdad suena la voz del asistente
  useEffect(() => escucharVoz(setHablando), []);

  // el teclado: al abrirse el personaje se achica y la conversacion toma el espacio
  useEffect(() => {
    const mostrar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => { if (!reducir.current) suavizar(); setTeclado(true); });
    const ocultar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => { if (!reducir.current) suavizar(); setTeclado(false); });
    return () => { mostrar.remove(); ocultar.remove(); };
  }, []);

  // si se abrio desde "hablar" o "escribir" (tarjeta del inicio)
  useEffect(() => {
    if (props.modoInicial === 'voz') { const espera = setTimeout(() => void iniciarVoz(), 350); return () => clearTimeout(espera); }
    if (props.modoInicial === 'texto') { const espera = setTimeout(() => { if (entrada.current) entrada.current.focus(); }, 350); return () => clearTimeout(espera); }
  }, []);

  // al salir de la pantalla se deja de escuchar
  useEffect(() => () => { detener.current(); }, []);

  // baja al ultimo mensaje solo cuando ya hay conversacion
  useEffect(() => {
    if (messages.length <= 1 && !draft && !venta) return;
    setTimeout(() => { if (scroll.current) scroll.current.scrollToEnd({ animated: true }); }, 90);
  }, [messages.length, draft, venta, pensando, teclado]);

  // charla continua: cuando el asistente termina de hablar, vuelve a escuchar
  useEffect(() => {
    if (hablando) { yaHablo.current = true; return; }
    if (!esperaTurno.current || pensando || escuchando || !modoVozRef.current) return;
    // si hay una publicacion o venta por confirmar, se espera a que la persona toque el boton
    if (draft || venta) { esperaTurno.current = false; return; }
    // ya hablo: se espera un momento y se escucha. si la voz no sono, se espera un poco mas
    const espera = setTimeout(() => {
      if (!esperaTurno.current || !modoVozRef.current) return;
      esperaTurno.current = false;
      yaHablo.current = false;
      void iniciarVoz();
    }, yaHablo.current ? 600 : 5000);
    return () => clearTimeout(espera);
  }, [hablando, pensando, escuchando, draft, venta]);

  // el estado del personaje sale de lo que pasa de verdad (microfono, respuesta, voz)
  let estado: EstadoAsistente = 'reposo';
  if (hablando) estado = 'hablando';
  if (pensando) estado = 'pensando';
  if (escuchando) estado = 'escuchando';

  function enviar(valor = texto) {
    if (!valor.trim()) return;
    props.onSend(valor);
    setTexto('');
    setAviso('');
  }

  // modo voz: se cierra el teclado, el personaje crece y empieza a escuchar de verdad
  async function iniciarVoz() {
    Keyboard.dismiss();
    if (!escuchaDisponible()) {
      // en expo go no hay reconocimiento de voz: se avisa y se usa el dictado del teclado
      setAviso('Para hablar con tu asistente por voz necesitas la app instalada. Por ahora toca el micrófono de tu teclado y dicta.');
      setTimeout(() => { if (entrada.current) entrada.current.focus(); }, 250);
      return;
    }
    callar();
    if (!reducir.current) suavizar();
    setModoVoz(true);
    setAviso('');
    if (!leerEnVoz) props.onCambiarVoz();
    // sin senal se usa el espanol descargado en el celular (si lo tiene)
    let local = false;
    if (props.sinSenal) local = await entiendeSinInternet();
    let textoFinal = '';
    let pico = 0;
    let fallo = '';
    setParcial('');
    setEscuchando(true);
    detener.current = await empezarEscucha({
      onVolumen: (nivel) => { setVolumen(nivel); if (nivel > pico) pico = nivel; },
      onTexto: (dicho, final) => { setParcial(dicho); if (final) textoFinal = dicho; else if (dicho.trim() !== '') textoFinal = dicho; },
      onFin: (audio) => {
        setEscuchando(false);
        setVolumen(0);
        setParcial('');
        if (textoFinal.trim() !== '') { esperaTurno.current = true; yaHablo.current = false; props.onSend(textoFinal, audio); return; }
        // sin senal y sin entender: si la persona si hablo, la nota de voz queda guardada para despues
        if (audio !== '' && pico > 0.35 && (props.sinSenal || fallo === 'network')) { props.onSend('', audio); return; }
        esperaTurno.current = false;
        if (fallo === '') setAviso('No te escuché. Toca el micrófono para seguir hablando.');
      },
      onError: (motivo) => {
        fallo = motivo;
        setEscuchando(false);
        setVolumen(0);
        esperaTurno.current = false;
        if (motivo === 'sin-permiso' || motivo === 'not-allowed') setAviso('Permite el micrófono en los ajustes del celular para hablarle a tu asistente.');
        else if (motivo === 'no-speech' || motivo === 'speech-timeout') setAviso('No te escuché. Toca el micrófono para seguir hablando.');
        else if (motivo === 'network' || motivo === 'language-not-supported') setAviso('Sin señal este celular no entiende la voz. Si alcanzaste a hablar, guardé tu nota de voz.');
        else setAviso('No pude escucharte. Intenta otra vez o escribe tu mensaje.');
      },
    }, local);
  }

  // boton detener: corta la escucha o la voz que esta sonando
  function detenerTodo() {
    esperaTurno.current = false;
    if (escuchando) detener.current();
    if (hablando) callar();
  }

  function salirVoz() {
    detenerTodo();
    if (!reducir.current) suavizar();
    setModoVoz(false);
  }

  const empezando = messages.length <= 1 && !draft && !venta;
  let saludo = '';
  if (messages.length > 0) saludo = messages[0].text;
  // el ultimo mensaje del asistente (para mostrarlo en modo voz)
  let ultima = '';
  for (const mensaje of messages) { if (mensaje.author === 'assistant' && mensaje.id !== 'bienvenida') ultima = mensaje.text; }

  let etiqueta = textoEstado(estado);
  if (modoVoz && estado === 'reposo') etiqueta = 'Toca el micrófono para hablar';

  let tamanoHero = 150;
  if (teclado) tamanoHero = 64;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <View style={styles.fondo}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={10} onPress={() => { detenerTodo(); props.onBack(); }} style={styles.headerBoton}><ArrowLeft size={22} color={colors.verde} /></Pressable>
          <View style={styles.headerCentro}>
            <Text style={styles.name}>Tu asistente</Text>
            <Text style={styles.subtitle}>{props.conIA ? 'Con inteligencia artificial' : 'Asistente de Sava'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={leerEnVoz ? 'Dejar de hablar en voz alta' : 'Hablar en voz alta'} hitSlop={10} onPress={props.onCambiarVoz} style={[styles.headerBoton, leerEnVoz && styles.vozActiva]}>
            {leerEnVoz ? <Volume2 size={21} color={colors.verde} /> : <VolumeX size={21} color={colors.verde} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Empezar de nuevo" hitSlop={10} onPress={() => { salirVoz(); props.onReset(); }} style={styles.headerBoton}><RotateCcw size={20} color={colors.verde} /></Pressable>
        </View>

        {modoVoz ? (
          // modo voz: el personaje grande y centrado
          <View style={styles.voz}>
            <AsistenteOrbe estado={estado} tamano={200} volumen={volumen} />
            <View style={styles.estado}><Text style={styles.estadoTexto}>{etiqueta}</Text></View>
            {parcial !== '' && <Text style={styles.parcial} numberOfLines={3}>«{parcial}»</Text>}
            {parcial === '' && ultima !== '' && !escuchando && !pensando && <ScrollView style={styles.respuestaCaja} contentContainerStyle={styles.respuestaContenido}><Text style={styles.respuesta}>{ultima}</Text></ScrollView>}
            {(draft || venta) && !escuchando && <View style={styles.cardBotones}>
              <Pressable accessibilityRole="button" onPress={draft ? props.onEditDraft : props.onCancelarVenta} style={({ pressed }) => [styles.botonSuave, pressed && styles.presionado]}><Text style={styles.botonSuaveTexto}>{draft ? 'Corregir' : 'No'}</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { esperaTurno.current = true; yaHablo.current = false; if (draft) props.onConfirmDraft(); else props.onConfirmarVenta(); }} style={({ pressed }) => [styles.botonFuerte, pressed && styles.presionado]}><Text style={styles.botonFuerteTexto}>{draft ? 'Confirmar' : 'Sí, registrar'}</Text></Pressable>
            </View>}
            <View style={styles.vozBotones}>
              {(escuchando || hablando) ? (
                <Pressable accessibilityRole="button" accessibilityLabel={escuchando ? 'Detener la escucha' : 'Detener la voz'} onPress={detenerTodo} style={({ pressed }) => [styles.vozPrincipal, styles.vozDetener, pressed && styles.presionado]}>
                  <Square size={26} color={colors.white} fill={colors.white} />
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="Hablar" disabled={pensando} onPress={() => void iniciarVoz()} style={({ pressed }) => [styles.vozPrincipal, pensando && styles.apagado, pressed && styles.presionado]}>
                  <Mic size={30} color={colors.white} />
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel="Escribir en vez de hablar" onPress={() => { salirVoz(); setTimeout(() => { if (entrada.current) entrada.current.focus(); }, 300); }} style={({ pressed }) => [styles.vozSecundario, pressed && styles.presionado]}>
                <IconoTeclado size={20} color={colors.verde} /><Text style={styles.vozSecundarioTexto}>Escribir</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {empezando ? <View style={styles.hero}>
              <AsistenteOrbe estado={estado} tamano={tamanoHero} />
              <Text style={styles.saludo}>{saludo}</Text>
              <View style={styles.chips}>
                {sugerencias(tipo).map((item) => <Pressable key={item.titulo} accessibilityRole="button" accessibilityLabel={item.titulo} onPress={() => enviar(item.frase)} style={({ pressed }) => [styles.chip, pressed && styles.presionado]}>
                  <Text style={styles.chipTexto}>{item.titulo}</Text>
                </Pressable>)}
              </View>
            </View> : <>
              {/* con conversacion el personaje queda arriba, pequeno pero presente */}
              <View style={styles.mini}>
                <AsistenteOrbe estado={estado} tamano={teclado ? 48 : 64} />
                {(pensando || hablando) && <View style={styles.estadoMini}><Text style={styles.estadoTexto}>{textoEstado(estado)}</Text></View>}
              </View>
              {messages.slice(1).map((mensaje) => {
                const deMaria = mensaje.author === 'assistant';
                return <Aparecer key={mensaje.id}><View style={styles.grupo}>
                  <View style={[styles.bubble, deMaria ? styles.assistantBubble : styles.userBubble]}>
                    {!!mensaje.audio && <View style={styles.notaVoz}><NotaVoz uri={mensaje.audio} segundos={0} /></View>}
                    {!(mensaje.audio && mensaje.text === 'Nota de voz') && <Text style={[styles.bubbleText, !deMaria && styles.userText]}>{mensaje.text}</Text>}
                    {deMaria && <Pressable accessibilityRole="button" accessibilityLabel="Escuchar este mensaje" hitSlop={8} onPress={() => void hablar(mensaje.text)} style={styles.oir}><Volume2 size={15} color={colors.verde} /><Text style={styles.oirTexto}>Escuchar</Text></Pressable>}
                  </View>
                  {mensaje.pendiente && <View style={styles.enEspera}><Clock size={13} color={colors.muted} /><Text style={styles.enEsperaTexto}>Esperando señal para responder</Text></View>}
                  {mensaje.recomendaciones && mensaje.recomendaciones.map((item) => <TarjetaRecomendada key={item.product.id} item={item} onOpen={() => props.onOpenProduct(item.product, item.business)} />)}
                </View></Aparecer>;
              })}
              {pensando && <View style={[styles.bubble, styles.assistantBubble, styles.puntos]}><Text style={styles.puntosTexto}>Estoy pensando…</Text></View>}

              {draft && <Aparecer><View style={styles.card}>
                <Text style={styles.cardEyebrow}>PUBLICACIÓN LISTA PARA REVISAR</Text>
                <Text style={styles.cardTitle}>{draft.name}</Text>
                <Text style={styles.cardDato}>{mostrarCantidad(draft.stock)} {textoUnidad(draft.stock, draft.unit)} · {dinero(draft.price_cop)} por {draft.unit}</Text>
                <Text style={styles.cardHint}>Categoría: {draft.category}. Nada se publica hasta que toques «Confirmar».</Text>
                <View style={styles.cardBotones}>
                  <Pressable accessibilityRole="button" onPress={props.onEditDraft} style={({ pressed }) => [styles.botonSuave, pressed && styles.presionado]}><Text style={styles.botonSuaveTexto}>Corregir</Text></Pressable>
                  <Pressable accessibilityRole="button" onPress={props.onConfirmDraft} style={({ pressed }) => [styles.botonFuerte, pressed && styles.presionado]}><Text style={styles.botonFuerteTexto}>Confirmar</Text></Pressable>
                </View>
              </View></Aparecer>}

              {venta && <Aparecer><View style={styles.card}>
                <Text style={styles.cardEyebrow}>VENTA PARA REGISTRAR</Text>
                <Text style={styles.cardTitle}>{venta.nombre}</Text>
                <Text style={styles.cardDato}>{mostrarCantidad(venta.cantidad)} {textoUnidad(venta.cantidad, venta.unidad)} × {dinero(venta.precio)} = {dinero(venta.total)}</Text>
                <Text style={styles.cardHint}>Al confirmar se descuentan del inventario. Te quedarían {mostrarCantidad(venta.quedan)} {textoUnidad(venta.quedan, venta.unidad)}. Es un registro tuyo, no una factura.</Text>
                <View style={styles.cardBotones}>
                  <Pressable accessibilityRole="button" onPress={props.onCancelarVenta} style={({ pressed }) => [styles.botonSuave, pressed && styles.presionado]}><Text style={styles.botonSuaveTexto}>No</Text></Pressable>
                  <Pressable accessibilityRole="button" onPress={props.onConfirmarVenta} style={({ pressed }) => [styles.botonFuerte, pressed && styles.presionado]}><Text style={styles.botonFuerteTexto}>Sí, registrar</Text></Pressable>
                </View>
              </View></Aparecer>}
            </>}
          </ScrollView>
        )}

        {props.sinSenal && <View style={styles.senal}><WifiOff size={16} color={colors.grafito} /><Text style={styles.senalTexto}>Sin señal. Te respondo lo que pueda; lo demás, cuando vuelva el internet.{props.enEspera > 0 ? ' Mensajes guardados: ' + props.enEspera + '.' : ''}</Text></View>}
        {aviso !== '' && <View style={styles.aviso}><Mic size={16} color={colors.verde} /><Text style={styles.avisoTexto}>{aviso}</Text></View>}
        {!modoVoz && <View style={styles.composer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Hablar con tu asistente" onPress={() => void iniciarVoz()} style={({ pressed }) => [styles.mic, pressed && styles.presionado]}><Mic size={22} color={colors.verde} /></Pressable>
          <TextInput ref={entrada} accessibilityLabel="Mensaje para tu asistente" value={texto} onChangeText={setTexto} placeholder="Escribe tu mensaje…" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={() => enviar()} returnKeyType="send" maxLength={300} />
          <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensaje" disabled={pensando || texto.trim() === ''} onPress={() => enviar()} style={({ pressed }) => [styles.send, (pensando || texto.trim() === '') && styles.apagado, pressed && styles.presionado]}><Send size={20} color={colors.white} /></Pressable>
        </View>}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fondo: { flex: 1, backgroundColor: colors.crema },
  presionado: { transform: [{ scale: 0.96 }] },
  apagado: { opacity: 0.45 },
  header: { paddingTop: 8, paddingBottom: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBoton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  vozActiva: { backgroundColor: colors.salvia },
  headerCentro: { flex: 1, alignItems: 'center' },
  name: { color: colors.verde, fontWeight: '900', fontSize: 19 }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 18, flexGrow: 1 },
  hero: { alignItems: 'center', paddingTop: 6 },
  saludo: { color: colors.grafito, fontSize: 20, lineHeight: 27, fontWeight: '800', textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.salvia },
  chipTexto: { color: colors.verde, fontSize: 14, fontWeight: '800' },
  estado: { backgroundColor: colors.salvia, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },
  estadoTexto: { color: colors.verde, fontSize: 14, fontWeight: '800' },
  mini: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  estadoMini: { backgroundColor: colors.salvia, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginLeft: -16 },
  grupo: { marginBottom: 8, gap: 8 },
  bubble: { maxWidth: '86%', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 20 },
  assistantBubble: { backgroundColor: colors.white, alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.line },
  userBubble: { backgroundColor: colors.verde, alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  bubbleText: { color: colors.grafito, fontSize: 16, lineHeight: 23 }, userText: { color: colors.white },
  puntos: { marginBottom: 8 }, puntosTexto: { color: colors.muted, fontSize: 15, fontStyle: 'italic' },
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
  voz: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  parcial: { color: colors.grafito, fontSize: 18, lineHeight: 25, textAlign: 'center', fontStyle: 'italic', marginTop: 16, paddingHorizontal: 10 },
  respuestaCaja: { maxHeight: 150, alignSelf: 'stretch', marginTop: 14 },
  respuestaContenido: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14 },
  respuesta: { color: colors.grafito, fontSize: 16, lineHeight: 23 },
  vozBotones: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  vozPrincipal: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center', shadowColor: colors.grafito, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  vozDetener: { backgroundColor: colors.arcilla },
  vozSecundario: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.salvia },
  vozSecundarioTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  notaVoz: { marginBottom: 6, minWidth: 190 },
  enEspera: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: -2 },
  enEsperaTexto: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  senal: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 12, marginBottom: 4, padding: 10, borderRadius: 14, backgroundColor: '#F5E7E2' },
  senalTexto: { color: colors.grafito, fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 12, marginBottom: 4, padding: 10, borderRadius: 14, backgroundColor: colors.salvia },
  avisoTexto: { color: colors.verde, fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },
  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10, gap: 8, backgroundColor: colors.crema },
  mic: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: colors.white, borderRadius: 25, minHeight: 50, paddingHorizontal: 16, color: colors.grafito, fontSize: 16, borderWidth: 1, borderColor: colors.line },
  send: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center' },
});
