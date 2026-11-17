import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../../shared/theme';

// paisaje de la sabana arriba y abajo de la pantalla.
// las capas se mueven muy despacio con el driver nativo para no gastar bateria
type Props = { posicion: 'arriba' | 'abajo'; moverse: boolean };

// lo que se pasa de ancho para que al moverse no se vean los bordes
const SOBRANTE = 40;

function useVaiven(moverse: boolean, duracion: number) {
  const valor = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!moverse) return;
    const vaiven = Animated.loop(Animated.sequence([
      Animated.timing(valor, { toValue: 1, duration: duracion, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(valor, { toValue: 0, duration: duracion, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    vaiven.start();
    return () => vaiven.stop();
  }, [moverse]);
  return valor;
}

export default function PaisajeLlanero({ posicion, moverse }: Props) {
  const { width } = useWindowDimensions();
  const ancho = width + SOBRANTE * 2;
  const lento = useVaiven(moverse, 14000);
  const medio = useVaiven(moverse, 10000);
  const sol = useRef(new Animated.Value(0)).current;

  // el sol sale una sola vez desde el horizonte
  useEffect(() => {
    if (!moverse) { sol.setValue(1); return; }
    Animated.timing(sol, { toValue: 1, duration: 1400, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [moverse]);

  const derecha = lento.interpolate({ inputRange: [0, 1], outputRange: [-SOBRANTE, -SOBRANTE + 18] });
  const izquierda = medio.interpolate({ inputRange: [0, 1], outputRange: [-SOBRANTE, -SOBRANTE - 14] });
  const subirSol = sol.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  if (posicion === 'arriba') {
    const alto = 120;
    return (
      <View pointerEvents="none" style={[styles.arriba, { height: alto }]}>
        <Animated.View style={[styles.capa, { transform: [{ translateX: derecha }] }]}>
          <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
            <Path d={`M0 ${alto * 0.72} C ${ancho * 0.25} ${alto * 0.3}, ${ancho * 0.5} ${alto * 0.42}, ${ancho * 0.72} ${alto * 0.62} S ${ancho * 0.95} ${alto * 0.7}, ${ancho} ${alto * 0.55}`} stroke={colors.verde} strokeOpacity={0.22} strokeWidth={2} fill="none" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.sol, { right: width * 0.16, opacity: sol, transform: [{ translateY: subirSol }] }]}>
          <Svg width={56} height={22} viewBox="0 0 56 22">
            <Path d="M3 20 A25 18 0 0 1 53 20" stroke={colors.arcilla} strokeWidth={2} strokeLinecap="round" fill="none" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.capa, { transform: [{ translateX: izquierda }] }]}>
          <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
            <Path d={`M${ancho * 0.45} ${alto} C ${ancho * 0.62} ${alto * 0.62}, ${ancho * 0.82} ${alto * 0.6}, ${ancho} ${alto * 0.74} L ${ancho} ${alto} Z`} fill={colors.verde} fillOpacity={0.1} />
          </Svg>
        </Animated.View>
      </View>
    );
  }

  const alto = 150;
  return (
    <View pointerEvents="none" style={[styles.abajo, { height: alto }]}>
      <Animated.View style={[styles.capa, { transform: [{ translateX: izquierda }] }]}>
        <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
          <Path d={`M0 ${alto * 0.42} C ${ancho * 0.22} ${alto * 0.18}, ${ancho * 0.4} ${alto * 0.3}, ${ancho * 0.58} ${alto * 0.5} S ${ancho * 0.88} ${alto * 0.4}, ${ancho} ${alto * 0.3} L ${ancho} ${alto} L 0 ${alto} Z`} fill={colors.verde} fillOpacity={0.07} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.capa, { transform: [{ translateX: derecha }] }]}>
        <Svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`}>
          <Path d={`M0 ${alto * 0.62} C ${ancho * 0.3} ${alto * 0.48}, ${ancho * 0.55} ${alto * 0.78}, ${ancho * 0.8} ${alto * 0.66} S ${ancho} ${alto * 0.58}, ${ancho} ${alto * 0.6} L ${ancho} ${alto} L 0 ${alto} Z`} fill={colors.verdeClaro} />
          <Path d={`M${ancho * 0.6} ${alto * 0.9} C ${ancho * 0.75} ${alto * 0.78}, ${ancho * 0.88} ${alto * 0.6}, ${ancho} ${alto * 0.52}`} stroke={colors.arcilla} strokeWidth={2} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
      <View style={[styles.capa, { left: 0 }]}>
        <Svg width={width} height={alto} viewBox={`0 0 ${width} ${alto}`}>
          <Path d={`M0 ${alto * 0.84} C ${width * 0.3} ${alto * 0.74}, ${width * 0.6} ${alto * 0.94}, ${width} ${alto * 0.82} L ${width} ${alto} L 0 ${alto} Z`} fill={colors.verde} fillOpacity={0.12} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  arriba: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  abajo: { position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden' },
  capa: { position: 'absolute', top: 0, left: 0 },
  sol: { position: 'absolute', top: 54 },
});
