import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../../../shared/theme';
import { pedirReducirMovimiento } from '../../../shared/movimiento';
import { escucharPalabras } from '../../../shared/voz';

// el personaje es la imagen del diseno aprobado (fondo transparente).
// se usa la misma imagen en todas las pantallas, solo cambia el tamano
const personaje = require('../../../../assets/asistente/asistente.png');
// ancho / alto de la imagen
const PROPORCION = 666 / 584;
// donde estan los ojos dentro de la imagen (en partes del ancho y alto), para el parpadeo
const ojos = [
  { x: 0.4324, y: 0.4007, w: 0.0766, h: 0.1507 },
  { x: 0.6877, y: 0.3647, w: 0.0751, h: 0.1524 },
];
// color del visor alrededor de los ojos (sale de la misma imagen)
const VISOR = '#034D2C';
const LOMA = '#6FAE7E';
// barras de sonido: verde salvia mas profundo (para que se vea sobre el crema) y terracota
const SALVIA_ONDA = '#8DBF9C';
// alto base de cada barra (de afuera hacia el personaje): formas variadas, no todas iguales
const ALTOS = [0.32, 0.55, 0.78, 1, 0.82, 0.6, 0.4];
const BRILLO_OJO = '#FFE9B8';

// estados reales del asistente. cada uno se activa solo cuando de verdad pasa
export type EstadoAsistente = 'reposo' | 'escuchando' | 'pensando' | 'hablando';

// volumen: nivel real del microfono entre 0 y 1 (solo cuando escucha)
type Props = { estado: EstadoAsistente; tamano?: number; quieto?: boolean; volumen?: number };

export default function AsistenteOrbe({ estado, tamano = 150, quieto = false, volumen = 0 }: Props) {
  const flotar = useRef(new Animated.Value(0)).current;
  const parpadeo = useRef(new Animated.Value(0)).current;
  const respirar = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(0)).current;
  const giro = useRef(new Animated.Value(0)).current;
  const brilloOjos = useRef(new Animated.Value(0)).current;
  // 7 barras por lado, cada una con su propio movimiento
  const barras = useRef(Array.from({ length: 14 }, () => new Animated.Value(0.2))).current;
  const conOndas = estado === 'escuchando' || estado === 'hablando';
  // opacidad de cada capa de efectos (para pasar de un estado a otro con suavidad)
  const capas = useRef({ ondas: new Animated.Value(conOndas ? 1 : 0), pensando: new Animated.Value(estado === 'pensando' ? 1 : 0) }).current;
  const [reducir, setReducir] = useState(false);

  useEffect(() => { void pedirReducirMovimiento().then(setReducir); }, []);

  // reposo: flota muy poco y parpadea de vez en cuando
  useEffect(() => {
    if (reducir || quieto) return;
    const vaiven = Animated.loop(Animated.sequence([
      Animated.timing(flotar, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(flotar, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    vaiven.start();
    let activo = true;
    let espera: ReturnType<typeof setTimeout>;
    function parpadear() {
      espera = setTimeout(() => {
        if (!activo) return;
        Animated.sequence([
          Animated.timing(parpadeo, { toValue: 1, duration: 85, useNativeDriver: true }),
          Animated.timing(parpadeo, { toValue: 0, duration: 125, useNativeDriver: true }),
        ]).start(() => parpadear());
      }, 3000 + Math.random() * 2800);
    }
    parpadear();
    return () => { activo = false; clearTimeout(espera); vaiven.stop(); };
  }, [reducir, quieto]);

  // solo se ve la capa del estado actual; los ojos brillan un poco mas al escuchar
  useEffect(() => {
    Animated.timing(capas.ondas, { toValue: conOndas ? 1 : 0, duration: conOndas ? 260 : 450, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(capas.pensando, { toValue: estado === 'pensando' ? 1 : 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    let brillo = 0;
    if (estado === 'escuchando') brillo = 0.85;
    if (estado === 'hablando') brillo = 0.45;
    Animated.timing(brilloOjos, { toValue: brillo, duration: 300, useNativeDriver: true }).start();
  }, [estado]);

  // escuchando: pulsacion muy suave
  useEffect(() => {
    if (estado !== 'escuchando' || reducir) { respirar.setValue(0); return; }
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(respirar, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(respirar, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [estado, reducir]);

  // hablando: un pulso pequeno con cada palabra que dice la voz
  useEffect(() => {
    if (estado !== 'hablando' || reducir) return;
    return escucharPalabras(() => {
      pulso.stopAnimation();
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    });
  }, [estado, reducir]);

  // pensando: arco luminoso con puntos que gira despacio
  useEffect(() => {
    if (estado !== 'pensando' || reducir) return;
    giro.setValue(0);
    const vuelta = Animated.loop(Animated.timing(giro, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true }));
    vuelta.start();
    return () => vuelta.stop();
  }, [estado, reducir]);

  // escuchando: cada barra sigue el volumen real del microfono (con un poco de variacion
  // propia para que no suban todas iguales). en silencio quedan pequenas
  useEffect(() => {
    if (estado !== 'escuchando') return;
    for (let i = 0; i < barras.length; i++) {
      const variacion = 0.7 + ((i * 37) % 10) / 16;
      let destino = 0.16 + volumen * 0.9 * variacion;
      if (destino > 1) destino = 1;
      Animated.timing(barras[i], { toValue: reducir ? 0.5 : destino, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [estado, volumen, reducir]);

  // hablando: cada barra va a una altura distinta y a su propio ritmo (nunca todas a la vez)
  useEffect(() => {
    if (estado !== 'hablando' || reducir) return;
    let activo = true;
    function mover(i: number) {
      if (!activo) return;
      Animated.timing(barras[i], { toValue: 0.25 + Math.random() * 0.75, duration: 170 + Math.random() * 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => mover(i));
    }
    for (let i = 0; i < barras.length; i++) mover(i);
    return () => { activo = false; };
  }, [estado, reducir]);

  // al dejar de escuchar o de hablar, las barras bajan despacio
  useEffect(() => {
    if (conOndas) return;
    for (const barra of barras) Animated.timing(barra, { toValue: 0.2, duration: 400, useNativeDriver: true }).start();
  }, [conOndas]);

  const anchoOrbe = tamano;
  const altoOrbe = tamano / PROPORCION;
  const subir = flotar.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.max(2, tamano * 0.03)] });
  const sombraEscala = flotar.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });
  const sombraOpacidad = flotar.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] });
  const escalaRespirar = respirar.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const escalaPulso = pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const vueltas = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ancho = tamano * 1.8;
  const altoTotal = altoOrbe * 1.45;

  return (
    <View pointerEvents="none" accessible accessibilityLabel={'Asistente de Sava, ' + textoEstado(estado)} style={{ width: ancho, height: altoTotal, alignItems: 'center', justifyContent: 'center' }}>
      {/* ondas de sonido: escuchando (con el volumen real) y hablando (con la voz) */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.barras, { opacity: capas.ondas }]}>
        {[0, 1].map((lado) => <View key={lado} style={[styles.grupoBarras, { gap: tamano * 0.028 }]}>
          {ALTOS.map((alto, i) => {
            // del lado izquierdo el orden va al reves para que las mas altas queden cerca del personaje
            let pos = i;
            if (lado === 0) pos = ALTOS.length - 1 - i;
            const indice = lado * ALTOS.length + i;
            let color = SALVIA_ONDA;
            if (pos % 3 === 1) color = colors.arcilla;
            return <Animated.View key={i} style={[styles.barra, { width: Math.max(3, tamano * 0.026), height: tamano * 0.34 * ALTOS[pos], backgroundColor: color, shadowColor: color, transform: [{ scaleY: barras[indice] }] }]} />;
          })}
        </View>)}
      </Animated.View>

      {/* sombra suave en el piso: se achica cuando sube */}
      <Animated.View style={{ position: 'absolute', bottom: altoTotal * 0.04, opacity: sombraOpacidad, transform: [{ scaleX: sombraEscala }] }}>
        <Svg width={anchoOrbe * 0.82} height={altoOrbe * 0.16} viewBox="0 0 160 28">
          <Defs>
            <RadialGradient id="piso" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#2F7350" stopOpacity={0.34} />
              <Stop offset="1" stopColor="#2F7350" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={80} cy={14} rx={80} ry={14} fill="url(#piso)" />
        </Svg>
      </Animated.View>

      <Animated.View style={{ width: anchoOrbe, height: altoOrbe, marginBottom: altoOrbe * 0.18, transform: [{ translateY: subir }, { scale: escalaRespirar }, { scale: escalaPulso }] }}>
        {/* pensando: arco luminoso con puntos */}
        <Animated.View style={[styles.capa, { width: anchoOrbe * 1.28, height: anchoOrbe * 1.28, left: -anchoOrbe * 0.14, top: (altoOrbe - anchoOrbe * 1.28) / 2, opacity: capas.pensando, transform: [{ rotate: vueltas }] }]}>
          <Svg width="100%" height="100%" viewBox="0 0 130 130">
            <Defs>
              <LinearGradient id="arco" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={LOMA} stopOpacity={0} />
                <Stop offset="0.55" stopColor={LOMA} stopOpacity={0.95} />
                <Stop offset="1" stopColor={colors.arcilla} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Path d="M12 65 A53 53 0 0 1 118 65" stroke="url(#arco)" strokeWidth={6} strokeOpacity={0.22} fill="none" strokeLinecap="round" />
            <Path d="M12 65 A53 53 0 0 1 118 65" stroke="url(#arco)" strokeWidth={2.2} fill="none" strokeLinecap="round" />
            <Circle cx={27} cy={28} r={3.8} fill="#FFFFFF" />
            <Circle cx={65} cy={12} r={4.8} fill="#FFFFFF" />
            <Circle cx={103} cy={28} r={3.8} fill="#FFFFFF" />
          </Svg>
        </Animated.View>

        {/* el personaje: la imagen original, sin estirar */}
        <Image source={personaje} style={{ width: anchoOrbe, height: altoOrbe }} resizeMode="contain" accessibilityIgnoresInvertColors />

        {/* resplandor extra de los ojos (al escuchar y al hablar) */}
        {ojos.map((ojo, i) => <Animated.View key={'brillo' + i} style={[styles.capa, { left: anchoOrbe * (ojo.x - ojo.w * 0.9), top: altoOrbe * (ojo.y - ojo.h * 0.35), width: anchoOrbe * ojo.w * 2.8, height: altoOrbe * ojo.h * 1.7, opacity: brilloOjos }]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={'halo' + i} cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={BRILLO_OJO} stopOpacity={0.65} />
                <Stop offset="1" stopColor={BRILLO_OJO} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={50} cy={50} rx={50} ry={50} fill={'url(#halo' + i + ')'} />
          </Svg>
        </Animated.View>)}

        {/* parpadeo: el visor tapa los ojos un instante */}
        {ojos.map((ojo, i) => <Animated.View key={'parpado' + i} style={[styles.capa, { left: anchoOrbe * (ojo.x - ojo.w * 0.12), top: altoOrbe * (ojo.y - ojo.h * 0.08), width: anchoOrbe * ojo.w * 1.24, height: altoOrbe * ojo.h * 1.16, borderRadius: anchoOrbe, backgroundColor: VISOR, opacity: parpadeo, transform: [{ scaleY: parpadeo }] }]} />)}
      </Animated.View>
    </View>
  );
}

export function textoEstado(estado: EstadoAsistente) {
  if (estado === 'escuchando') return 'Te estoy escuchando';
  if (estado === 'pensando') return 'Estoy pensando';
  if (estado === 'hablando') return 'Aquí tienes mi respuesta';
  return '¿En qué te ayudo?';
}

const styles = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
  capa: { position: 'absolute' },
  barras: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: '1%' },
  // resplandor muy discreto alrededor de cada barra
  barra: { borderRadius: 99, shadowOpacity: 0.45, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  grupoBarras: { flexDirection: 'row', alignItems: 'center' },
});
