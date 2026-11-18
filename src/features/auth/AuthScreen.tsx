import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { CircleCheck, LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { colors } from '../../shared/theme';
import SavaLogo from '../../shared/components/SavaLogo';
import { correoValido } from '../../shared/validaciones';
import Campo from './components/Campo';
import { pedirReducirMovimiento } from '../../shared/movimiento';
import PaisajeLlanero from './components/PaisajeLlanero';
import LegalScreen from '../legal/LegalScreen';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import ApoyoGobernacion from '../../shared/components/ApoyoGobernacion';
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
  let contenido = <Text style={styles.botonTexto}>{texto}</Text>;
  if (cargando) contenido = <ActivityIndicator color={colors.white} />;
  if (listo) contenido = <CircleCheck size={24} color={colors.white} />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={texto} accessibilityState={{ busy: cargando, disabled: cargando }} disabled={cargando || listo} onPress={onPress} onPressIn={() => presionar(0.97)} onPressOut={() => presionar(1)}>
      <Animated.View style={[styles.boton, { transform: [{ scale: escala }] }]}>{contenido}</Animated.View>
    </Pressable>
  );
}

export default function AuthScreen({ onContinueGuest, purpose = 'general', modoInicial = 'signIn' }: { onContinueGuest?: () => void; purpose?: AuthPurpose; modoInicial?: Modo }) {
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

  if (verLegal) return <LegalScreen onBack={() => setVerLegal(false)} />;

  let titulo = '¡Qué bueno verte!';
  let subtitulo = 'Entra y conecta con lo nuestro.';
  if (purpose === 'seller') subtitulo = 'Entra para publicar tus cosechas y llevar tus ventas.';
  if (purpose === 'buyer') subtitulo = 'Entra para enviar tu consulta al productor.';
  if (mode === 'signUp') { titulo = 'Empieza con Sava'; subtitulo = 'Tu cosecha o tus compras, en un solo lugar.'; }

  const moverIndicador = pestana.interpolate({ inputRange: [0, 1], outputRange: [0, anchoTabs / 2] });
  const moverFormulario = formulario.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const logoEscala = entrada[0].interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <View style={styles.screen}>
      <PaisajeLlanero posicion="arriba" moverse={movimiento} />
      <PaisajeLlanero posicion="abajo" moverse={movimiento} />
      <View ref={teclaEspacio.ref} onLayout={teclaEspacio.medir} style={[styles.flex, { paddingBottom: teclaEspacio.espacio }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={false}>
          <View style={styles.columna}>
            <Animated.View style={[styles.logo, { opacity: entrada[0], transform: [{ scale: logoEscala }] }]}><SavaLogo size="medio" centrado /></Animated.View>

            <Animated.View style={aparecer(1)}>
              <View accessibilityRole="tablist" style={styles.tabs} onLayout={(e) => setAnchoTabs(e.nativeEvent.layout.width)}>
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'signIn' }} onPress={() => cambiarModo('signIn')} style={styles.tab}><Text style={[styles.tabTexto, mode === 'signIn' && styles.tabActiva]}>Iniciar sesión</Text></Pressable>
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === 'signUp' }} onPress={() => cambiarModo('signUp')} style={styles.tab}><Text style={[styles.tabTexto, mode === 'signUp' && styles.tabActiva]}>Crear cuenta</Text></Pressable>
                {anchoTabs > 0 && <Animated.View style={[styles.indicador, { width: anchoTabs / 2, transform: [{ translateX: moverIndicador }] }]} />}
              </View>
            </Animated.View>

            <Animated.View style={{ opacity: formulario, transform: [{ translateY: moverFormulario }] }}>
              <Animated.View style={[styles.encabezado, aparecer(2)]}>
                <Text style={styles.titulo}>{titulo}</Text>
                <Svg width={92} height={10} viewBox="0 0 92 10"><Path d="M3 7 C 30 1, 62 1, 89 6" stroke={colors.arcilla} strokeWidth={3} strokeLinecap="round" fill="none" /></Svg>
                <Text style={styles.subtitulo}>{subtitulo}</Text>
              </Animated.View>

              <Animated.View style={[styles.campos, aparecer(3)]}>
                {mode === 'signUp' && <View style={styles.rolBloque}>
                  <View style={styles.rolTitulo}><Text style={styles.rolPregunta}>¿Qué eres?</Text><BotonEscuchar etiqueta="" texto="¿Qué eres? Toca campesino si vendes tu cosecha, tienda si vendes cosas para el campo, o comprador si quieres comprar." /></View>
                  <View accessibilityRole="radiogroup" style={styles.roles}>
                    {roles.map((item) => {
                      const elegido = rol === item.rol;
                      return <Pressable key={item.rol} accessibilityRole="radio" accessibilityState={{ checked: elegido }} accessibilityLabel={item.titulo + '. ' + item.texto} onPress={() => { setRol(item.rol); if (errores.rol !== '') setErrores({ ...errores, rol: '' }); }} style={[styles.rolTarjeta, elegido && styles.rolElegido, errores.rol !== '' && styles.rolError]}>
                        <item.Icon size={26} color={elegido ? colors.white : colors.verde} strokeWidth={1.8} />
                        <Text style={[styles.rolTexto, elegido && styles.rolTextoElegido]}>{item.corto}</Text>
                      </Pressable>;
                    })}
                  </View>
                  {errores.rol !== '' && <Text accessibilityRole="alert" style={styles.rolMensaje}>{errores.rol}</Text>}
                </View>}
                {mode === 'signUp' && <Campo etiqueta="Nombre completo" icono={<UserRound size={20} color={colors.grafito} />} value={nombre} onChangeText={(v) => escribir('nombre', v)} placeholder="Escribe tu nombre completo" autoComplete="name" autoCapitalize="words" maxLength={80} error={errores.nombre} />}
                <Campo etiqueta="Correo electrónico" icono={<Mail size={20} color={colors.grafito} />} value={email} onChangeText={(v) => escribir('correo', v)} placeholder="Ingresa tu correo electrónico" autoCapitalize="none" autoComplete="email" keyboardType="email-address" maxLength={100} error={errores.correo} />
                <Campo etiqueta="Contraseña" esClave icono={<LockKeyhole size={20} color={colors.grafito} />} value={password} onChangeText={(v) => escribir('clave', v)} placeholder={mode === 'signUp' ? 'Crea una contraseña' : 'Ingresa tu contraseña'} autoCapitalize="none" autoComplete={mode === 'signUp' ? 'new-password' : 'password'} maxLength={72} error={errores.clave} ayuda={mode === 'signUp' ? 'Usa al menos 8 caracteres' : ''} onSubmitEditing={() => void submit()} />
                {mode === 'signIn' && <Pressable accessibilityRole="button" hitSlop={8} disabled={working} onPress={() => void olvideClave()} style={styles.olvide}><Text style={styles.enlace}>¿Olvidaste tu contraseña?</Text></Pressable>}
              </Animated.View>

              {errores.general !== '' && <Text accessibilityRole="alert" style={styles.errorGeneral}>{errores.general}</Text>}
              {aviso !== '' && <View accessibilityRole="alert" style={styles.aviso}>
                <Animated.View style={{ transform: [{ scale: check }] }}><CircleCheck size={22} color={colors.verde} /></Animated.View>
                <Text style={styles.avisoTexto}>{aviso}</Text>
              </View>}

              <Animated.View style={aparecer(4)}>
                <BotonPrincipal texto={mode === 'signUp' ? 'Crear cuenta' : 'Entrar'} cargando={working} listo={listo} onPress={() => void submit()} />
              </Animated.View>
            </Animated.View>

            <Animated.View style={[styles.pie, aparecer(5)]}>
              {mode === 'signUp' && <Text style={styles.terminos}>Al continuar, aceptas los <Text style={styles.enlaceChico} onPress={() => setVerLegal(true)}>términos</Text> y la <Text style={styles.enlaceChico} onPress={() => setVerLegal(true)}>política de privacidad</Text>.</Text>}
              {mode === 'signIn' && <Pressable hitSlop={6} onPress={() => setVerLegal(true)}><Text style={styles.terminos}>Privacidad y términos de uso</Text></Pressable>}
              {!!onContinueGuest && <Pressable accessibilityRole="button" hitSlop={10} onPress={onContinueGuest} style={styles.explorar}><Text style={styles.enlace}>Explorar sin cuenta</Text></Pressable>}
              <ApoyoGobernacion />
            </Animated.View>
          </View>
        </ScrollView>
        {/* al subir, el contenido se desvanece arriba en vez de verse cortado */}
        <Svg pointerEvents="none" width="100%" height={26} style={styles.fundidoArriba}>
          <Defs><LinearGradient id="arriba" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.crema} stopOpacity={1} /><Stop offset="1" stopColor={colors.crema} stopOpacity={0} /></LinearGradient></Defs>
          <Rect x={0} y={0} width="100%" height={26} fill="url(#arriba)" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.crema },
  flex: { flex: 1 },
  // arriba fijo: al cambiar de pestana el logo y las pestanas no se mueven
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 80 },
  fundidoArriba: { position: 'absolute', top: 0, left: 0, right: 0 },
  columna: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  logo: { marginBottom: 6 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 14 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabTexto: { color: colors.grafito, fontSize: 16, fontWeight: '500' },
  tabActiva: { color: colors.verde, fontWeight: '800' },
  indicador: { position: 'absolute', left: 0, bottom: -1.5, height: 3, borderRadius: 2, backgroundColor: colors.verde },
  encabezado: { alignItems: 'center', marginBottom: 12 },
  titulo: { color: colors.verde, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  subtitulo: { color: colors.grafito, fontSize: 15, textAlign: 'center', marginTop: 8 },
  campos: {},
  olvide: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 6, paddingVertical: 4 },
  enlace: { color: colors.verde, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  enlaceChico: { color: colors.verde, fontWeight: '700', textDecorationLine: 'underline' },
  errorGeneral: { color: '#775D50', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.verdeClaro, borderRadius: 14, padding: 12, marginBottom: 14 },
  avisoTexto: { flex: 1, color: colors.verde, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  boton: { height: 54, borderRadius: 27, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: colors.grafito, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  botonTexto: { color: colors.white, fontSize: 17, fontWeight: '800' },
  pie: { alignItems: 'center', marginTop: 16, gap: 6 },
  terminos: { color: colors.grafito, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  explorar: { paddingVertical: 10 },
  rolBloque: { marginBottom: 14 },
  rolTitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  rolPregunta: { color: colors.grafito, fontSize: 14, fontWeight: '700' },
  roles: { flexDirection: 'row', gap: 8 },
  rolTarjeta: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  rolElegido: { backgroundColor: colors.verde, borderColor: colors.verde },
  rolError: { borderColor: '#775D50' },
  rolTexto: { color: colors.grafito, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  rolTextoElegido: { color: colors.white },
  rolMensaje: { color: '#775D50', fontSize: 12, fontWeight: '600', marginTop: 6 },
});
