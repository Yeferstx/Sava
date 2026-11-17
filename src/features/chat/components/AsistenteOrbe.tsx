import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../../shared/theme';
import { pedirReducirMovimiento } from '../../../shared/movimiento';

// estados reales de maria. cada uno se activa solo cuando de verdad pasa
export type EstadoAsistente = 'reposo' | 'escuchando' | 'pensando' | 'hablando';

type Props = { estado: EstadoAsistente; tamano?: number; quieto?: boolean };

// personaje de maria: cuerpo redondo crema y verde salvia, visor verde oscuro,
// dos ojos que brillan y un borde terracota. dibujado en svg para poder animarlo
export default function AsistenteOrbe({ estado, tamano = 150, quieto = false }: Props) {
  const flotar = useRef(new Animated.Value(0)).current;
  const parpadeo = useRef(new Animated.Value(1)).current;
  const giro = useRef(new Animated.Value(0)).current;
  const ondas = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const barras = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.3))).current;
  // opacidad de cada capa de estado (para pasar de uno a otro con suavidad)
  const capas = useRef({ escuchando: new Animated.Value(estado === 'escuchando' ? 1 : 0), pensando: new Animated.Value(estado === 'pensando' ? 1 : 0), hablando: new Animated.Value(estado === 'hablando' ? 1 : 0) }).current;
  const [reducir, setReducir] = useState(false);

  useEffect(() => { void pedirReducirMovimiento().then(setReducir); }, []);

  // reposo: flota suave y parpadea de vez en cuando
  useEffect(() => {
    if (reducir || quieto) return;
    const vaiven = Animated.loop(Animated.sequence([
      Animated.timing(flotar, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(flotar, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    vaiven.start();
    let activo = true;
    let espera: ReturnType<typeof setTimeout>;
    function parpadear() {
      espera = setTimeout(() => {
        if (!activo) return;
        Animated.sequence([
          Animated.timing(parpadeo, { toValue: 0.12, duration: 90, useNativeDriver: true }),
          Animated.timing(parpadeo, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start(() => parpadear());
      }, 2800 + Math.random() * 2600);
    }
    parpadear();
    return () => { activo = false; clearTimeout(espera); vaiven.stop(); };
  }, [reducir, quieto]);

  // muestra solo la capa del estado actual
  useEffect(() => {
    const claves: Array<'escuchando' | 'pensando' | 'hablando'> = ['escuchando', 'pensando', 'hablando'];
    for (const clave of claves) {
      Animated.timing(capas[clave], { toValue: estado === clave ? 1 : 0, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [estado]);

  // pensando: una orbita con tres puntos que gira despacio
  useEffect(() => {
    if (estado !== 'pensando' || reducir) return;
    giro.setValue(0);
    const vuelta = Animated.loop(Animated.timing(giro, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }));
    vuelta.start();
    return () => vuelta.stop();
  }, [estado, reducir]);

  // escuchando: ondas que salen del cuerpo una tras otra
  useEffect(() => {
    if (estado !== 'escuchando' || reducir) return;
    const animaciones = ondas.map((onda, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 350),
      Animated.timing(onda, { toValue: 1, duration: 1050, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(onda, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])));
    for (const animacion of animaciones) animacion.start();
    return () => { for (const animacion of animaciones) animacion.stop(); };
  }, [estado, reducir]);

  // hablando: barras de sonido que suben y bajan a distinto ritmo
  useEffect(() => {
    if (estado !== 'hablando' || reducir) return;
    const animaciones = barras.map((barra, i) => Animated.loop(Animated.sequence([
      Animated.timing(barra, { toValue: 1, duration: 260 + i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(barra, { toValue: 0.3, duration: 300 + i * 50, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])));
    for (const animacion of animaciones) animacion.start();
    return () => { for (const animacion of animaciones) animacion.stop(); };
  }, [estado, reducir]);

  const alto = tamano * 0.9;
  const subir = flotar.interpolate({ inputRange: [0, 1], outputRange: [0, -tamano * 0.035] });
  const sombra = flotar.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });
  const vueltas = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ancho = tamano * 1.75;

  return (
    <View pointerEvents="none" accessible accessibilityLabel={'María, ' + textoEstado(estado)} style={{ width: ancho, height: tamano * 1.15, alignItems: 'center', justifyContent: 'center' }}>
      {/* escuchando: arcos a los dos lados */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.centro, { opacity: capas.escuchando }]}>
        {ondas.map((onda, i) => {
          const escala = onda.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] });
          const opacidad = onda.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.7, 0] });
          return <Animated.View key={i} style={[styles.capa, { opacity: reducir ? 0.5 : opacidad, transform: [{ scale: reducir ? 1.05 + i * 0.08 : escala }] }]}>
            <Svg width={ancho} height={tamano} viewBox="0 0 350 200">
              <Path d="M70 50 Q40 100 70 150" stroke={colors.verde} strokeOpacity={0.35} strokeWidth={5} strokeLinecap="round" fill="none" />
              <Path d="M280 50 Q310 100 280 150" stroke={colors.verde} strokeOpacity={0.35} strokeWidth={5} strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>;
        })}
      </Animated.View>

      {/* hablando: barras de sonido */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.barras, { opacity: capas.hablando }]}>
        {[0, 1].map((lado) => <View key={lado} style={[styles.grupoBarras, { gap: tamano * 0.03 }]}>
          {barras.map((barra, i) => {
            const orden = lado === 0 ? barras.length - 1 - i : i;
            let color: string = colors.verde;
            if (orden % 3 === 1) color = colors.arcilla;
            if (orden % 3 === 2) color = '#9CC3A8';
            return <Animated.View key={i} style={{ width: tamano * 0.03, height: tamano * (0.16 + (orden % 3) * 0.06), borderRadius: tamano, backgroundColor: color, opacity: 0.85, transform: [{ scaleY: reducir ? 0.7 : barras[orden] }] }} />;
          })}
        </View>)}
      </Animated.View>

      {/* sombra en el piso */}
      <Animated.View style={[styles.sombra, { width: tamano * 0.62, height: tamano * 0.07, borderRadius: tamano, bottom: tamano * 0.02, transform: [{ scaleX: sombra }] }]} />

      <Animated.View style={{ width: tamano, height: alto, transform: [{ translateY: subir }] }}>
        {/* pensando: orbita con puntos */}
        <Animated.View style={[styles.orbita, { width: tamano * 1.22, height: tamano * 1.22, left: -tamano * 0.11, top: -tamano * 0.16, opacity: capas.pensando, transform: [{ rotate: vueltas }] }]}>
          <Svg width="100%" height="100%" viewBox="0 0 120 120">
            <Defs>
              <LinearGradient id="orbitaColor" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.verde} stopOpacity={0.05} />
                <Stop offset="0.6" stopColor="#9CC3A8" stopOpacity={0.9} />
                <Stop offset="1" stopColor={colors.arcilla} stopOpacity={0.9} />
              </LinearGradient>
            </Defs>
            <Path d="M14 60 A46 46 0 0 1 106 60" stroke="url(#orbitaColor)" strokeWidth={2} fill="none" strokeLinecap="round" />
            <Ellipse cx={30} cy={27} rx={3.2} ry={3.2} fill={colors.white} />
            <Ellipse cx={60} cy={14} rx={4.2} ry={4.2} fill={colors.white} />
            <Ellipse cx={92} cy={29} rx={3.2} ry={3.2} fill={colors.white} />
          </Svg>
        </Animated.View>

        {/* cuerpo */}
        <Svg width={tamano} height={alto} viewBox="0 0 200 180">
          <Defs>
            <RadialGradient id="cuerpo" cx="38%" cy="30%" rx="75%" ry="80%">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="0.45" stopColor={colors.crema} />
              <Stop offset="1" stopColor={colors.salvia} />
            </RadialGradient>
            <LinearGradient id="pasto" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#B9D6BC" />
              <Stop offset="1" stopColor="#9CC3A8" />
            </LinearGradient>
            <LinearGradient id="visor" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1E5A4C" />
              <Stop offset="1" stopColor={colors.verde} />
            </LinearGradient>
          </Defs>
          <Ellipse cx={100} cy={92} rx={84} ry={78} fill="url(#cuerpo)" />
          {/* la parte de abajo verde, como una loma */}
          <Path d="M20 118 C55 98 95 132 140 116 C160 109 176 112 182 118 C172 150 140 170 100 170 C60 170 30 150 20 118 Z" fill="url(#pasto)" opacity={0.9} />
          {/* borde terracota abajo a la derecha */}
          <Path d="M176 70 C190 112 168 158 112 169" stroke={colors.arcilla} strokeWidth={7} strokeLinecap="round" fill="none" opacity={0.95} />
          {/* brillo de arriba */}
          <Ellipse cx={70} cy={40} rx={34} ry={14} fill="#FFFFFF" opacity={0.55} />
          {/* visor */}
          <Rect x={38} y={58} width={124} height={62} rx={31} fill="url(#visor)" />
          <Rect x={46} y={63} width={100} height={8} rx={4} fill="#FFFFFF" opacity={0.08} />
        </Svg>

        {/* ojos (capa aparte para poder parpadear) */}
        <Animated.View style={[styles.ojos, { top: alto * (72 / 180), height: alto * (34 / 180), transform: [{ scaleY: parpadeo }] }]}>
          <Svg width={tamano} height={alto * (34 / 180)} viewBox="0 0 200 34">
            <Rect x={70} y={0} width={20} height={34} rx={10} fill="#FFF3D6" opacity={0.25} />
            <Rect x={110} y={0} width={20} height={34} rx={10} fill="#FFF3D6" opacity={0.25} />
            <Rect x={74} y={4} width={12} height={26} rx={6} fill="#FFF8E7" />
            <Rect x={114} y={4} width={12} height={26} rx={6} fill="#FFF8E7" />
          </Svg>
        </Animated.View>
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
  barras: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: '3%' },
  grupoBarras: { flexDirection: 'row', alignItems: 'center' },
  sombra: { position: 'absolute', backgroundColor: colors.verde, opacity: 0.12 },
  orbita: { position: 'absolute' },
  ojos: { position: 'absolute', left: 0, right: 0 },
});
