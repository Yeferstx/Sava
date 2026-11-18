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
const BRILLO_OJO = '#FFE9B8';

// estados reales del asistente. cada uno se activa solo cuando de verdad pasa
export type EstadoAsistente = 'reposo' | 'escuchando' | 'pensando' | 'hablando';

type Props = { estado: EstadoAsistente; tamano?: number; quieto?: boolean };

export default function AsistenteOrbe({ estado, tamano = 150, quieto = false }: Props) {
  const flotar = useRef(new Animated.Value(0)).current;
  const parpadeo = useRef(new Animated.Value(0)).current;
  const respirar = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(0)).current;
  const giro = useRef(new Animated.Value(0)).current;
  const brilloOjos = useRef(new Animated.Value(0)).current;
  const ondas = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const barras = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.3))).current;
  // opacidad de cada capa de efectos (para pasar de un estado a otro con suavidad)
  const capas = useRef({ escuchando: new Animated.Value(estado === 'escuchando' ? 1 : 0), pensando: new Animated.Value(estado === 'pensando' ? 1 : 0), hablando: new Animated.Value(estado === 'hablando' ? 1 : 0) }).current;
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
    const claves: Array<'escuchando' | 'pensando' | 'hablando'> = ['escuchando', 'pensando', 'hablando'];
    for (const clave of claves) {
      Animated.timing(capas[clave], { toValue: estado === clave ? 1 : 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
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

  // escuchando: ondas verdes que salen de los dos lados
  useEffect(() => {
    if (estado !== 'escuchando' || reducir) return;
    const animaciones = ondas.map((onda, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 380),
      Animated.timing(onda, { toValue: 1, duration: 1150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(onda, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])));
    for (const animacion of animaciones) animacion.start();
    return () => { for (const animacion of animaciones) animacion.stop(); };
  }, [estado, reducir]);

  // hablando: barras de sonido que suben y bajan a distinto ritmo
  useEffect(() => {
    if (estado !== 'hablando' || reducir) return;
    const animaciones = barras.map((barra, i) => Animated.loop(Animated.sequence([
      Animated.timing(barra, { toValue: 1, duration: 240 + i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(barra, { toValue: 0.3, duration: 280 + i * 55, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])));
    for (const animacion of animaciones) animacion.start();
    return () => { for (const animacion of animaciones) animacion.stop(); };
  }, [estado, reducir]);

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
      {/* escuchando: ondas verdes a los dos lados */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.centro, { opacity: capas.escuchando }]}>
        {ondas.map((onda, i) => {
          const escala = onda.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.25] });
          const opacidad = onda.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 0] });
          return <Animated.View key={i} style={[styles.capa, { opacity: reducir ? 0.5 : opacidad, transform: [{ scale: reducir ? 1.05 + i * 0.08 : escala }] }]}>
            <Svg width={ancho} height={altoOrbe} viewBox="0 0 360 200">
              <Path d="M74 52 Q44 100 74 148" stroke={LOMA} strokeOpacity={0.75} strokeWidth={6} strokeLinecap="round" fill="none" />
              <Path d="M286 52 Q316 100 286 148" stroke={LOMA} strokeOpacity={0.75} strokeWidth={6} strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>;
        })}
      </Animated.View>

      {/* hablando: ondas de sonido verdes y terracota */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.barras, { opacity: capas.hablando }]}>
        {[0, 1].map((lado) => <View key={lado} style={[styles.grupoBarras, { gap: tamano * 0.035 }]}>
          {barras.map((barra, i) => {
            const orden = lado === 0 ? barras.length - 1 - i : i;
            let color: string = LOMA;
            if (orden % 2 === 1) color = colors.arcilla;
            return <Animated.View key={i} style={{ width: Math.max(2, tamano * 0.03), height: tamano * (0.16 + (orden % 3) * 0.07), borderRadius: tamano, backgroundColor: color, transform: [{ scaleY: reducir ? 0.7 : barras[orden] }] }} />;
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
  if (estado === 'pensando') return 'Buscando la mejor respuesta';
  if (estado === 'hablando') return 'Aquí tienes mi respuesta';
  return '¿En qué te ayudo?';
}

const styles = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
  capa: { position: 'absolute' },
  barras: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: '2%' },
  grupoBarras: { flexDirection: 'row', alignItems: 'center' },
});
