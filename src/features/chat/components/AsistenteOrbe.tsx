import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../../shared/theme';
import { pedirReducirMovimiento } from '../../../shared/movimiento';
import { escucharPalabras } from '../../../shared/voz';

// estados reales de maria. cada uno se activa solo cuando de verdad pasa
export type EstadoAsistente = 'reposo' | 'escuchando' | 'pensando' | 'hablando';

type Props = { estado: EstadoAsistente; tamano?: number; quieto?: boolean };

// tonos del personaje (salen de la paleta: verde, salvia, crema y terracota con luz y sombra)
const tono = {
  luz: '#FFFFFF', cremaClaro: '#F7F2EA', salviaClaro: '#E3EEE2', salviaOscuro: '#A9CDB1',
  lomaClara: '#B6DABB', lomaOscura: '#5F9F72', sombraVerde: '#2F7350',
  visorOscuro: '#0D332B', visorClaro: '#22604F', visorBorde: '#2E6E5D',
  terracotaClaro: '#E9A98B', terracotaOscuro: '#A65F3E', ojo: '#FFF6E2', brilloOjo: '#FFE9B8',
};

// personaje de maria: esfera crema con reflejos verde salvia, visor verde oscuro,
// dos ojos que brillan y un borde terracota. dibujado en svg para poder animarlo
export default function AsistenteOrbe({ estado, tamano = 150, quieto = false }: Props) {
  const flotar = useRef(new Animated.Value(0)).current;
  const parpadeo = useRef(new Animated.Value(1)).current;
  const respirar = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(0)).current;
  const giro = useRef(new Animated.Value(0)).current;
  const brilloOjos = useRef(new Animated.Value(0.45)).current;
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
          Animated.timing(parpadeo, { toValue: 0.1, duration: 90, useNativeDriver: true }),
          Animated.timing(parpadeo, { toValue: 1, duration: 130, useNativeDriver: true }),
        ]).start(() => parpadear());
      }, 2800 + Math.random() * 2800);
    }
    parpadear();
    return () => { activo = false; clearTimeout(espera); vaiven.stop(); };
  }, [reducir, quieto]);

  // muestra solo la capa del estado actual y ajusta el brillo de los ojos
  useEffect(() => {
    const claves: Array<'escuchando' | 'pensando' | 'hablando'> = ['escuchando', 'pensando', 'hablando'];
    for (const clave of claves) {
      Animated.timing(capas[clave], { toValue: estado === clave ? 1 : 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
    let brillo = 0.45;
    if (estado === 'escuchando') brillo = 1;
    if (estado === 'hablando') brillo = 0.8;
    if (estado === 'pensando') brillo = 0.65;
    Animated.timing(brilloOjos, { toValue: brillo, duration: 300, useNativeDriver: true }).start();
  }, [estado]);

  // escuchando: respiracion muy ligera
  useEffect(() => {
    if (estado !== 'escuchando' || reducir) { respirar.setValue(0); return; }
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(respirar, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(respirar, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [estado, reducir]);

  // hablando: un pequeno pulso con cada palabra que dice la voz
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

  // pensando: un arco luminoso con tres puntos que gira despacio
  useEffect(() => {
    if (estado !== 'pensando' || reducir) return;
    giro.setValue(0);
    const vuelta = Animated.loop(Animated.timing(giro, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }));
    vuelta.start();
    return () => vuelta.stop();
  }, [estado, reducir]);

  // escuchando: ondas que salen de los dos lados, una tras otra
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

  const subir = flotar.interpolate({ inputRange: [0, 1], outputRange: [0, -tamano * 0.04] });
  const sombraEscala = flotar.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
  const sombraOpacidad = flotar.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });
  const escalaRespirar = respirar.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const escalaPulso = pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const vueltas = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ancho = tamano * 1.8;
  const altoTotal = tamano * 1.22;

  return (
    <View pointerEvents="none" accessible accessibilityLabel={'María, ' + textoEstado(estado)} style={{ width: ancho, height: altoTotal, alignItems: 'center', justifyContent: 'center' }}>
      {/* escuchando: ondas verdes a los dos lados */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.centro, { opacity: capas.escuchando }]}>
        {ondas.map((onda, i) => {
          const escala = onda.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.28] });
          const opacidad = onda.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.85, 0] });
          return <Animated.View key={i} style={[styles.capa, { opacity: reducir ? 0.55 : opacidad, transform: [{ scale: reducir ? 1.05 + i * 0.08 : escala }] }]}>
            <Svg width={ancho} height={tamano} viewBox="0 0 360 200">
              <Path d="M78 48 Q46 100 78 152" stroke={colors.verde} strokeOpacity={0.5} strokeWidth={6} strokeLinecap="round" fill="none" />
              <Path d="M282 48 Q314 100 282 152" stroke={colors.verde} strokeOpacity={0.5} strokeWidth={6} strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>;
        })}
      </Animated.View>

      {/* hablando: ondas de audio verdes y terracota */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.barras, { opacity: capas.hablando }]}>
        {[0, 1].map((lado) => <View key={lado} style={[styles.grupoBarras, { gap: tamano * 0.035 }]}>
          {barras.map((barra, i) => {
            const orden = lado === 0 ? barras.length - 1 - i : i;
            let color: string = colors.verde;
            if (orden % 2 === 1) color = colors.arcilla;
            if (orden === 4) color = tono.lomaOscura;
            return <Animated.View key={i} style={{ width: tamano * 0.035, height: tamano * (0.18 + (orden % 3) * 0.07), borderRadius: tamano, backgroundColor: color, transform: [{ scaleY: reducir ? 0.7 : barras[orden] }] }} />;
          })}
        </View>)}
      </Animated.View>

      {/* sombra suave en el piso: se achica cuando maria sube */}
      <Animated.View style={{ position: 'absolute', bottom: altoTotal * 0.02, opacity: sombraOpacidad, transform: [{ scaleX: sombraEscala }] }}>
        <Svg width={tamano * 0.8} height={tamano * 0.14} viewBox="0 0 160 28">
          <Defs>
            <RadialGradient id="piso" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={tono.sombraVerde} stopOpacity={0.38} />
              <Stop offset="1" stopColor={tono.sombraVerde} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={80} cy={14} rx={80} ry={14} fill="url(#piso)" />
        </Svg>
      </Animated.View>

      <Animated.View style={{ width: tamano, height: tamano, marginBottom: tamano * 0.12, transform: [{ translateY: subir }, { scale: escalaRespirar }, { scale: escalaPulso }] }}>
        {/* pensando: arco luminoso con tres puntos que gira */}
        <Animated.View style={[styles.orbita, { width: tamano * 1.3, height: tamano * 1.3, left: -tamano * 0.15, top: -tamano * 0.15, opacity: capas.pensando, transform: [{ rotate: vueltas }] }]}>
          <Svg width="100%" height="100%" viewBox="0 0 130 130">
            <Defs>
              <LinearGradient id="arco" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={tono.lomaClara} stopOpacity={0} />
                <Stop offset="0.55" stopColor={tono.lomaOscura} stopOpacity={0.9} />
                <Stop offset="1" stopColor={colors.arcilla} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Path d="M12 65 A53 53 0 0 1 118 65" stroke="url(#arco)" strokeWidth={6} strokeOpacity={0.25} fill="none" strokeLinecap="round" />
            <Path d="M12 65 A53 53 0 0 1 118 65" stroke="url(#arco)" strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <Circle cx={27} cy={28} r={4.5} fill={tono.ojo} stroke={tono.lomaOscura} strokeWidth={1} />
            <Circle cx={65} cy={12} r={5.5} fill={tono.ojo} stroke={colors.arcilla} strokeWidth={1} />
            <Circle cx={103} cy={28} r={4.5} fill={tono.ojo} stroke={colors.arcilla} strokeWidth={1} />
          </Svg>
        </Animated.View>

        {/* cuerpo: esfera con luz arriba a la izquierda y sombra verde abajo */}
        <Svg width={tamano} height={tamano} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="cuerpo" cx="36%" cy="28%" rx="78%" ry="78%">
              <Stop offset="0" stopColor={tono.luz} />
              <Stop offset="0.3" stopColor={tono.cremaClaro} />
              <Stop offset="0.62" stopColor={tono.salviaClaro} />
              <Stop offset="1" stopColor={tono.salviaOscuro} />
            </RadialGradient>
            <LinearGradient id="sombra" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.45" stopColor={tono.sombraVerde} stopOpacity={0} />
              <Stop offset="1" stopColor={tono.sombraVerde} stopOpacity={0.5} />
            </LinearGradient>
            <LinearGradient id="loma" x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor={tono.lomaClara} />
              <Stop offset="1" stopColor={tono.lomaOscura} />
            </LinearGradient>
            <LinearGradient id="terracota" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tono.terracotaClaro} />
              <Stop offset="0.5" stopColor={colors.arcilla} />
              <Stop offset="1" stopColor={tono.terracotaOscuro} />
            </LinearGradient>
            <LinearGradient id="visor" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tono.visorOscuro} />
              <Stop offset="0.6" stopColor={colors.verde} />
              <Stop offset="1" stopColor={tono.visorClaro} />
            </LinearGradient>
            <RadialGradient id="brillo" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={tono.luz} stopOpacity={0.95} />
              <Stop offset="1" stopColor={tono.luz} stopOpacity={0} />
            </RadialGradient>
            <ClipPath id="esfera"><Circle cx={100} cy={100} r={86} /></ClipPath>
          </Defs>
          <Circle cx={100} cy={100} r={86} fill="url(#cuerpo)" />
          <G clipPath="url(#esfera)">
            {/* loma verde en la parte de abajo */}
            <Path d="M0 128 C40 104 84 140 128 124 C152 116 176 118 200 128 L200 200 L0 200 Z" fill="url(#loma)" opacity={0.95} />
            <Path d="M0 128 C40 104 84 140 128 124 C152 116 176 118 200 128" stroke={tono.luz} strokeOpacity={0.45} strokeWidth={2} fill="none" />
            <Circle cx={100} cy={100} r={86} fill="url(#sombra)" />
          </G>
          {/* detalle terracota en el borde de abajo a la derecha */}
          <Path d="M179 79 A82 82 0 0 1 79 179" stroke="url(#terracota)" strokeWidth={9} strokeLinecap="round" fill="none" />
          <Path d="M173 80 A76 76 0 0 1 80 173" stroke={tono.terracotaClaro} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" fill="none" />
          {/* borde fino para que se vea el volumen */}
          <Circle cx={100} cy={100} r={86} stroke={colors.verde} strokeOpacity={0.14} strokeWidth={1.5} fill="none" />
          {/* brillos de luz */}
          <Ellipse cx={66} cy={48} rx={36} ry={16} fill="url(#brillo)" transform="rotate(-24 66 48)" />
          <Circle cx={140} cy={44} r={7} fill={tono.luz} opacity={0.55} />
          {/* visor con profundidad */}
          <Rect x={36} y={70} width={128} height={64} rx={32} fill={tono.visorOscuro} opacity={0.35} />
          <Rect x={38} y={68} width={124} height={62} rx={31} fill="url(#visor)" stroke={tono.visorBorde} strokeWidth={1.5} />
          <Rect x={52} y={73} width={96} height={12} rx={6} fill={tono.luz} opacity={0.13} />
        </Svg>

        {/* brillo de los ojos: se enciende mas al escuchar */}
        <Animated.View style={[styles.ojos, { top: tamano * (82 / 200), height: tamano * (40 / 200), opacity: brilloOjos }]}>
          <Svg width={tamano} height={tamano * (40 / 200)} viewBox="0 0 200 40">
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={tono.brilloOjo} stopOpacity={0.9} />
                <Stop offset="1" stopColor={tono.brilloOjo} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={86} cy={20} rx={19} ry={23} fill="url(#halo)" />
            <Ellipse cx={114} cy={20} rx={19} ry={23} fill="url(#halo)" />
          </Svg>
        </Animated.View>

        {/* ojos (capa aparte para poder parpadear) */}
        <Animated.View style={[styles.ojos, { top: tamano * (84 / 200), height: tamano * (36 / 200), transform: [{ scaleY: parpadeo }] }]}>
          <Svg width={tamano} height={tamano * (36 / 200)} viewBox="0 0 200 36">
            <Rect x={78} y={2} width={16} height={32} rx={8} fill={tono.ojo} />
            <Rect x={106} y={2} width={16} height={32} rx={8} fill={tono.ojo} />
            <Rect x={81} y={6} width={4} height={9} rx={2} fill={tono.luz} />
            <Rect x={109} y={6} width={4} height={9} rx={2} fill={tono.luz} />
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
  barras: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: '2%' },
  grupoBarras: { flexDirection: 'row', alignItems: 'center' },
  orbita: { position: 'absolute' },
  ojos: { position: 'absolute', left: 0, right: 0 },
});
