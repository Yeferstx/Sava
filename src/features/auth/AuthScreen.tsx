import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ArrowRight, CircleCheck, LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import AsistenteOrbe from '../chat/components/AsistenteOrbe';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { colors } from '../../shared/theme';
import SavaLogo from '../../shared/components/SavaLogo';
import { correoValido } from '../../shared/validaciones';
import Campo from './components/Campo';
import { pedirReducirMovimiento } from '../../shared/movimiento';
import LegalScreen from '../legal/LegalScreen';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import { useEspacioTeclado } from '../../shared/useEspacioTeclado';
import { roles, type Rol } from '../../shared/roles';

// supabase responde en ingles, se pasan a espanol los errores mas comunes
function traducirError(mensaje: string) {
  const texto = mensaje.toLowerCase();
  if (texto.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
  if (texto.includes('already registered')) return 'Ya existe una cuenta con ese correo. Inicia sesión.';
  if (texto.includes('email not confirmed')) return 'Aún no confirmas tu correo. Revisa tu bandeja de entrada.';
  if (texto.includes('rate limit') || texto.includes('too many') || texto.includes('security purposes')) return 'Hiciste muchos intentos. Espera unos minutos e intenta de nuevo.';
  if (texto.includes('network') || texto.includes('fetch')) return 'No hay conexión. Revisa tu internet e intenta de nuevo.';
  return mensaje;
}

type AuthPurpose = 'buyer' | 'seller' | 'general';
type Modo = 'signIn' | 'signUp';
type Errores = { rol: string; nombre: string; correo: string; clave: string; general: string };
const sinErrores: Errores = { rol: '', nombre: '', correo: '', clave: '', general: '' };

// boton con una pequena animacion al presionarlo
function BotonPrincipal({ texto, cargando, listo, onPress }: { texto: string; cargando: boolean; listo: boolean; onPress: () => void }) {
  const escala = useRef(new Animated.Value(1)).current;
  function presionar(valor: number) {
    Animated.timing(escala, { toValue: valor, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }
  let contenido = <View style={styles.botonFila}><Text style={styles.botonTexto}>{texto}</Text><ArrowRight size={21} color={colors.white} /></View>;
  if (cargando) contenido = <ActivityIndicator color={colors.white} />;
  if (listo) contenido = <CircleCheck size={24} color={colors.white} />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={texto} accessibilityState={{ busy: cargando, disabled: cargando }} disabled={cargando || listo} onPress={onPress} onPressIn={() => presionar(0.97)} onPressOut={() => presionar(1)}>
      <Animated.View style={[styles.boton, { transform: [{ scale: escala }] }]}>{contenido}</Animated.View>
    </Pressable>
  );
}

// paisaje original de los llanos (guardado en la app, se ve sin internet)
const paisaje = require('../../../assets/marca/llanos-acceso.jpg');
const PROPORCION_PAISAJE = 1400 / 788;
// escala de espacios: todo el formulario usa estos valores
const E = { xs: 4, s: 8, m: 12, l: 16, xl: 24 };
// el boton de aru va centrado sobre el borde de la tarjeta
const ALTO_ARU = 56;
const MONTA_TARJETA = 22;

export default function AuthScreen({ onContinueGuest, purpose = 'general', modoInicial = 'signIn', onAru }: { onContinueGuest?: () => void; purpose?: AuthPurpose; modoInicial?: Modo; onAru?: () => void }) {
  const [mode, setMode] = useState<Modo>(modoInicial);
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [listo, setListo] = useState(false);
  const [errores, setErrores] = useState<Errores>(sinErrores);
  const [aviso, setAviso] = useState('');
  const [verLegal, setVerLegal] = useState(false);
  const [movimiento, setMovimiento] = useState(false);
  const [anchoTabs, setAnchoTabs] = useState(0);

  // entrada: logo, pestanas, titulo, campos, boton y pie (en ese orden)
  const entrada = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0))).current;
  const pestana = useRef(new Animated.Value(modoInicial === 'signUp' ? 1 : 0)).current;
  const formulario = useRef(new Animated.Value(1)).current;
  const check = useRef(new Animated.Value(0)).current;
  const reducir = useRef(false);

  useEffect(() => {
    let activo = true;
    pedirReducirMovimiento().then((valor) => {
      if (!activo) return;
      reducir.current = valor;
      if (valor) {
        // sin movimiento: todo aparece de una vez
        for (const item of entrada) item.setValue(1);
        return;
      }
      setMovimiento(true);
      Animated.stagger(80, entrada.map((item) => Animated.timing(item, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }))).start();
    }).catch(() => { for (const item of entrada) item.setValue(1); });
    return () => { activo = false; };
  }, []);

  function aparecer(i: number) {
    const subir = entrada[i].interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
    return { opacity: entrada[i], transform: [{ translateY: subir }] };
  }

  function cambiarModo(nuevo: Modo) {
    if (nuevo === mode || working) return;
    setErrores(sinErrores);
    setAviso('');
    check.setValue(0);
    let destino = 0;
    if (nuevo === 'signUp') destino = 1;
    if (reducir.current) { pestana.setValue(destino); setMode(nuevo); return; }
    Animated.timing(pestana, { toValue: destino, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // el formulario sale, cambia y vuelve a entrar
    Animated.timing(formulario, { toValue: 0, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setMode(nuevo);
      Animated.timing(formulario, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  }

  function mostrarAviso(texto: string) {
    setAviso(texto);
    check.setValue(0);
    if (reducir.current) { check.setValue(1); return; }
    Animated.spring(check, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }

  // al escribir se quita el error de ese campo
  function escribir(campo: 'nombre' | 'correo' | 'clave', valor: string) {
    if (campo === 'nombre') setNombre(valor);
    if (campo === 'correo') setEmail(valor);
    if (campo === 'clave') setPassword(valor);
    if (errores[campo] !== '' || errores.general !== '') setErrores({ ...errores, [campo]: '', general: '' });
  }

  async function submit() {
    const supabase = getSupabaseClient();
    if (!supabase) { setErrores({ ...sinErrores, general: 'Sava no está conectada al servidor en este celular.' }); return; }
    const nuevos: Errores = { ...sinErrores };
    if (mode === 'signUp' && !rol) nuevos.rol = 'Toca lo que eres: campesino, tienda o comprador.';
    if (mode === 'signUp' && nombre.trim().length < 3) nuevos.nombre = 'Escribe tu nombre completo.';
    if (correoValido(email) === false) nuevos.correo = 'Escribe un correo válido, por ejemplo tu@correo.com.';
    if (password.length < 8) nuevos.clave = 'La contraseña debe tener al menos 8 caracteres.';
    if (nuevos.rol !== '' || nuevos.nombre !== '' || nuevos.correo !== '' || nuevos.clave !== '') { setErrores(nuevos); return; }
    setWorking(true);
    setErrores(sinErrores);
    setAviso('');
    const correo = email.trim().toLowerCase();
    try {
      if (mode === 'signUp') {
        const result = await supabase.auth.signUp({ email: correo, password, options: { data: { nombre: nombre.trim(), rol } } });
        if (result.error) throw result.error;
        if (!result.data.session) mostrarAviso('Te enviamos un correo a ' + correo + '. Confírmalo y luego inicia sesión.');
        else setListo(true);
      } else {
        const result = await supabase.auth.signInWithPassword({ email: correo, password });
        if (result.error) throw result.error;
        // la app cambia de pantalla sola cuando supabase avisa que entro
        setListo(true);
      }
    } catch (error) {
      let mensaje = 'No pudimos conectar. Intenta de nuevo.';
      if (error instanceof Error) mensaje = traducirError(error.message);
      const texto = mensaje.toLowerCase();
      if (texto.includes('contraseña no son')) setErrores({ ...sinErrores, clave: mensaje });
      else if (texto.includes('ya existe') || texto.includes('confirmas tu correo')) setErrores({ ...sinErrores, correo: mensaje });
      else setErrores({ ...sinErrores, general: mensaje });
    } finally { setWorking(false); }
  }

  async function olvideClave() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (correoValido(email) === false) { setErrores({ ...sinErrores, correo: 'Escribe tu correo arriba y te enviamos un enlace para cambiar la contraseña.' }); return; }
    setWorking(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (error) throw error;
      mostrarAviso('Si existe una cuenta con ese correo, te llegará un enlace para cambiar la contraseña.');
    } catch (error) {
      setErrores({ ...sinErrores, general: error instanceof Error ? traducirError(error.message) : 'Intenta de nuevo.' });
    } finally { setWorking(false); }
  }

  const teclaEspacio = useEspacioTeclado();
  const { width, height } = useWindowDimensions();
  // el alto de cada parte sale del alto real de la pantalla (no de un celular en particular).
  // al crear cuenta el encabezado se achica para dar espacio a los campos
  const compacto = height < 720;
  const registro = mode === 'signUp';
  let proporcionPaisaje = 0.22;
  if (compacto) proporcionPaisaje = 0.18;
  if (registro) proporcionPaisaje = compacto ? 0.13 : 0.16;
  const altoPaisaje = Math.round(Math.min(width / PROPORCION_PAISAJE, height * proporcionPaisaje));
  // la foto conserva su proporcion. se sube lo necesario para que los campesinos y el ganado
  // (entre el 62 % y el 75 % de la foto) queden siempre por encima del boton de aru
  const altoFoto = width / PROPORCION_PAISAJE;
  const altoCaja = altoPaisaje + MONTA_TARJETA;
  const subirFoto = Math.min(0, Math.max(altoCaja - altoFoto, altoCaja - MONTA_TARJETA - ALTO_ARU / 2 - E.s - altoFoto * 0.75));
  let logo: 'small' | 'regular' | 'encabezado' = 'encabezado';
  if (compacto || registro) logo = 'regular';
  if (compacto && registro) logo = 'small';
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const posiciones = useRef<Record<string, number>>({});
  // posicion real de la tarjeta y del formulario dentro de la pantalla (se mide al dibujar)
  const tarjetaY = useRef(0);
  const [altoArriba, setAltoArriba] = useState(0);
  const formularioY = useRef(0);
  // el campo que se toca queda visible encima del teclado
  function mostrarCampo(campo: string) {
    setTimeout(() => {
      const y = posiciones.current[campo];
      if (y === undefined || !scroll.current) return;
      scroll.current.scrollTo({ y: Math.max(0, tarjetaY.current + formularioY.current + y - 90), animated: true });
    }, 280);
  }

  if (verLegal) return <LegalScreen onBack={() => setVerLegal(false)} />;

  let titulo = '¡Qué bueno verte!';
  let subtitulo = 'Tu campo, más conectado.';
  if (purpose === 'seller') subtitulo = 'Entra para publicar tus cosechas.';
  if (purpose === 'buyer') subtitulo = 'Entra para enviar tu consulta al productor.';
  if (mode === 'signUp') titulo = 'Únete a Sava';

  const anchoPastilla = Math.max(0, (anchoTabs - 8) / 2);
  const moverIndicador = pestana.interpolate({ inputRange: [0, 1], outputRange: [0, anchoPastilla] });
  const moverFormulario = formulario.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const subirTarjeta = entrada[2].interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <View ref={teclaEspacio.ref} onLayout={teclaEspacio.medir} style={[styles.screen, { paddingBottom: teclaEspacio.espacio }]}>
      <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} bounces={false}>
        {/* parte de arriba: crema con el logo y la bienvenida, y el paisaje original abajo */}
        <View onLayout={(e) => setAltoArriba(e.nativeEvent.layout.height)} style={{ paddingTop: compacto ? E.xs : E.s }}>
          <Animated.View style={[styles.encabezado, aparecer(0)]}>
            <SavaLogo size={logo} centrado />
            <Text style={[styles.titulo, (compacto || registro) && styles.tituloCompacto]}>{titulo}</Text>
            {!(registro && compacto) && <Text style={styles.subtitulo}>{subtitulo}</Text>}
          </Animated.View>
          <View style={{ width, height: altoPaisaje + MONTA_TARJETA, marginTop: E.s, overflow: 'hidden' }}>
            {/* la foto completa a lo ancho: no se recorta a los campesinos ni a las vacas */}
            <Image source={paisaje} style={{ position: 'absolute', left: 0, top: subirFoto, width, height: altoFoto }} resizeMode="cover" accessibilityLabel="Atardecer en los llanos con palmas, campesinos y ganado" />
            {/* el crema se funde con el cielo, sin corte */}
            <Svg pointerEvents="none" width={width} height={altoPaisaje * 0.42} style={styles.fundido}>
              <Defs><LinearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.crema} stopOpacity={1} /><Stop offset="1" stopColor={colors.crema} stopOpacity={0} /></LinearGradient></Defs>
              <Rect x={0} y={0} width={width} height={altoPaisaje * 0.42} fill="url(#cielo)" />
            </Svg>
          </View>
        </View>

        {/* tarjeta blanca con el formulario: sube desde abajo */}
        <Animated.View onLayout={(e) => { tarjetaY.current = e.nativeEvent.layout.y; }} style={[styles.tarjeta, !onAru && { paddingTop: E.xl }, { opacity: entrada[2], transform: [{ translateY: subirTarjeta }] }]}>
          <View accessibilityRole="tablist" style={styles.tabs} onLayout={(e) => setAnchoTabs(e.nativeEvent.layout.width)}>
            {anchoTabs > 0 && <Animated.View style={[styles.indicador, { width: anchoPastilla, transform: [{ translateX: moverIndicador }] }]} />}
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'signIn' }} onPress={() => cambiarModo('signIn')} style={styles.tab}><Text style={[styles.tabTexto, mode === 'signIn' && styles.tabActiva]}>Iniciar sesión</Text></Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'signUp' }} onPress={() => cambiarModo('signUp')} style={styles.tab}><Text style={[styles.tabTexto, mode === 'signUp' && styles.tabActiva]}>Crear cuenta</Text></Pressable>
          </View>

          <Animated.View onLayout={(e) => { formularioY.current = e.nativeEvent.layout.y; }} style={{ opacity: formulario, transform: [{ translateY: moverFormulario }] }}>
            {mode === 'signUp' && <View style={styles.rolBloque}>
              <View style={styles.rolTitulo}><Text style={styles.rolPregunta}>¿Qué eres?</Text><BotonEscuchar etiqueta="Escuchar" texto="¿Qué eres? Toca campesino si vendes tu cosecha, tienda si vendes cosas para el campo, o comprador si quieres comprar." /></View>
              <View accessibilityRole="radiogroup" style={styles.roles}>
                {roles.map((item) => {
                  const elegido = rol === item.rol;
                  return <Pressable key={item.rol} accessibilityRole="radio" accessibilityState={{ checked: elegido }} accessibilityLabel={item.titulo + '. ' + item.texto} onPress={() => { setRol(item.rol); if (errores.rol !== '') setErrores({ ...errores, rol: '' }); }} style={[styles.rolTarjeta, elegido && styles.rolElegido, errores.rol !== '' && styles.rolError]}>
                    <item.Icon size={20} color={elegido ? colors.white : colors.verde} strokeWidth={1.9} />
                    <Text style={[styles.rolTexto, elegido && styles.rolTextoElegido]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.corto}</Text>
                  </Pressable>;
                })}
              </View>
              {errores.rol !== '' && <Text accessibilityRole="alert" style={styles.rolMensaje}>{errores.rol}</Text>}
            </View>}
            {mode === 'signUp' && <View onLayout={(e) => { posiciones.current.nombre = e.nativeEvent.layout.y; }}><Campo etiqueta="Nombre completo" icono={<UserRound size={20} color={colors.verde} />} value={nombre} onChangeText={(v) => escribir('nombre', v)} placeholder="Escribe tu nombre completo" autoComplete="name" autoCapitalize="words" maxLength={80} error={errores.nombre} onFocus={() => mostrarCampo('nombre')} /></View>}
            <View onLayout={(e) => { posiciones.current.correo = e.nativeEvent.layout.y; }}><Campo etiqueta="Correo electrónico" icono={<Mail size={20} color={colors.verde} />} value={email} onChangeText={(v) => escribir('correo', v)} placeholder="tucorreo@ejemplo.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address" maxLength={100} error={errores.correo} onFocus={() => mostrarCampo('correo')} /></View>
            <View onLayout={(e) => { posiciones.current.clave = e.nativeEvent.layout.y; }}><Campo etiqueta="Contraseña" esClave icono={<LockKeyhole size={20} color={colors.verde} />} value={password} onChangeText={(v) => escribir('clave', v)} placeholder={mode === 'signUp' ? 'Crea una contraseña' : 'Tu contraseña'} autoCapitalize="none" autoComplete={mode === 'signUp' ? 'new-password' : 'password'} maxLength={72} error={errores.clave} ayuda={mode === 'signUp' ? 'Usa al menos 8 caracteres' : ''} onSubmitEditing={() => void submit()} onFocus={() => mostrarCampo('clave')} /></View>
            {mode === 'signIn' && <Pressable accessibilityRole="button" hitSlop={8} disabled={working} onPress={() => void olvideClave()} style={styles.olvide}><Text style={styles.enlace}>¿Olvidaste tu contraseña?</Text></Pressable>}

            {errores.general !== '' && <Text accessibilityRole="alert" style={styles.errorGeneral}>{errores.general}</Text>}
            {aviso !== '' && <View accessibilityRole="alert" style={styles.aviso}>
              <Animated.View style={{ transform: [{ scale: check }] }}><CircleCheck size={22} color={colors.verde} /></Animated.View>
              <Text style={styles.avisoTexto}>{aviso}</Text>
            </View>}

            <BotonPrincipal texto={mode === 'signUp' ? 'Crear cuenta' : 'Iniciar sesión'} cargando={working} listo={listo} onPress={() => { Keyboard.dismiss(); void submit(); }} />
          </Animated.View>

          {!!onContinueGuest && <Pressable accessibilityRole="button" onPress={onContinueGuest} style={({ pressed }) => [styles.explorar, pressed && styles.presionado]}><Text style={styles.explorarTexto}>Explorar sin cuenta</Text></Pressable>}
          {mode === 'signUp' ? <Text style={styles.terminos}>Al continuar, aceptas los <Text style={styles.enlaceChico} onPress={() => setVerLegal(true)}>términos</Text> y la <Text style={styles.enlaceChico} onPress={() => setVerLegal(true)}>política de privacidad</Text>.</Text>
            : <Pressable hitSlop={6} onPress={() => setVerLegal(true)}><Text style={styles.terminos}>Privacidad y términos de uso</Text></Pressable>}
          <Text style={styles.pieTexto}>Hecho para el campo de Casanare</Text>
        </Animated.View>
        {/* aru va encima de todo, en el borde entre el paisaje y el formulario */}
        {!!onAru && altoArriba > 0 && <Animated.View style={[styles.aruCaja, { top: altoArriba - MONTA_TARJETA - ALTO_ARU / 2 }, aparecer(1)]}>
              <Pressable accessibilityRole="button" accessibilityLabel="¿Necesitas ayuda? Habla con Aru, el asistente de Sava" onPress={onAru} style={({ pressed }) => [styles.aru, pressed && styles.presionado]}>
                <View style={styles.aruOrbe}><AsistenteOrbe estado="reposo" tamano={44} quieto /></View>
                <View style={styles.flex}>
                  <Text style={styles.aruPregunta}>¿Necesitas ayuda?</Text>
                  <Text style={styles.aruTitulo}>Habla con Aru</Text>
                </View>
                <ArrowRight size={22} color={colors.verde} />
              </Pressable>
            </Animated.View>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.crema },
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  encabezado: { alignItems: 'center', paddingHorizontal: E.xl, gap: 2 },
  titulo: { color: colors.verde, fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: E.xs },
  tituloCompacto: { fontSize: 22, marginTop: 0 },
  subtitulo: { color: colors.grafito, fontSize: 15, textAlign: 'center' },
  fundido: { position: 'absolute', top: 0, left: 0 },
  // el boton queda en el borde entre el paisaje y el formulario: no tapa a los campesinos ni al ganado
  aruCaja: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  aru: { flexDirection: 'row', alignItems: 'center', gap: E.s, width: '78%', maxWidth: 340, height: ALTO_ARU, paddingLeft: E.xs, paddingRight: E.l, borderRadius: ALTO_ARU / 2, backgroundColor: 'rgba(250,246,239,0.94)', shadowColor: colors.grafito, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  aruOrbe: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  aruPregunta: { color: colors.grafito, fontSize: 12 },
  aruTitulo: { color: colors.verde, fontSize: 16, fontWeight: '900' },
  presionado: { transform: [{ scale: 0.97 }] },
  tarjeta: { flexGrow: 1, marginTop: -MONTA_TARJETA, backgroundColor: '#FAF7F2', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: E.l + E.xs, paddingTop: ALTO_ARU / 2 + E.l, paddingBottom: E.l },
  tabs: { flexDirection: 'row', backgroundColor: colors.salvia, borderRadius: 24, padding: E.xs, marginBottom: E.l },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  tabActiva: { color: colors.white, fontWeight: '900' },
  indicador: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 22, backgroundColor: colors.verde },
  olvide: { alignSelf: 'flex-end', marginTop: -E.xs, marginBottom: E.m, paddingVertical: E.xs },
  enlace: { color: colors.verde, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  enlaceChico: { color: colors.verde, fontWeight: '700', textDecorationLine: 'underline' },
  errorGeneral: { color: '#775D50', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.verdeClaro, borderRadius: 14, padding: 12, marginBottom: 14 },
  avisoTexto: { flex: 1, color: colors.verde, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  boton: { height: 52, borderRadius: 26, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center', marginTop: 6, shadowColor: colors.grafito, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  botonFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botonTexto: { color: colors.white, fontSize: 18, fontWeight: '800' },
  explorar: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: E.m, borderRadius: 24, backgroundColor: colors.salvia, marginTop: E.m },
  explorarTexto: { color: colors.verde, fontSize: 16, fontWeight: '800' },
  terminos: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: E.m },
  pieTexto: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: E.xs },
  rolBloque: { marginBottom: E.m },
  rolTitulo: { flexDirection: 'row', alignItems: 'center', gap: E.s, marginBottom: E.s },
  rolPregunta: { color: colors.grafito, fontSize: 14, fontWeight: '700' },
  roles: { flexDirection: 'row', gap: 8 },
  rolTarjeta: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, paddingHorizontal: E.xs, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  rolElegido: { backgroundColor: colors.verde, borderColor: colors.verde },
  rolError: { borderColor: '#775D50' },
  rolTexto: { color: colors.grafito, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  rolTextoElegido: { color: colors.white },
  rolMensaje: { color: '#775D50', fontSize: 12, fontWeight: '600', marginTop: 6 },
});
