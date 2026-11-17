import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type DimensionValue } from 'react-native';
import { colors } from '../theme';

// bloque gris que late suave mientras cargan los datos (carga tipo esqueleto)
export function Esqueleto({ ancho = '100%', alto = 14, radio = 8, oscuro = false }: { ancho?: DimensionValue; alto?: number; radio?: number; oscuro?: boolean }) {
  const pulso = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animacion = Animated.loop(Animated.sequence([
      Animated.timing(pulso, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulso, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    animacion.start();
    return () => animacion.stop();
  }, []);
  const opacidad = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  let color: string = colors.line;
  if (oscuro) color = 'rgba(255,255,255,0.14)';
  return <Animated.View style={{ width: ancho, height: alto, borderRadius: radio, backgroundColor: color, opacity: opacidad }} />;
}

// forma de una tarjeta de producto mientras carga
export function TarjetaEsqueleto({ enGrilla = false }: { enGrilla?: boolean }) {
  return <View style={[styles.tarjeta, enGrilla && styles.grilla]}>
    <Esqueleto alto={116} radio={11} />
    <View style={styles.espacio} />
    <Esqueleto ancho="80%" alto={13} />
    <View style={styles.espacioChico} />
    <Esqueleto ancho="55%" alto={13} />
    <View style={styles.espacioChico} />
    <Esqueleto ancho="65%" alto={10} />
  </View>;
}

// forma de una fila (inventario, consultas) mientras carga
export function FilaEsqueleto() {
  return <View style={styles.fila}>
    <Esqueleto ancho={56} alto={56} radio={14} />
    <View style={styles.filaTextos}>
      <Esqueleto ancho="70%" alto={14} />
      <Esqueleto ancho="45%" alto={12} />
      <Esqueleto ancho="55%" alto={12} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  tarjeta: { width: 156, backgroundColor: colors.white, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: colors.line },
  grilla: { width: '48%' },
  espacio: { height: 10 },
  espacioChico: { height: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 17, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 10 },
  filaTextos: { flex: 1, gap: 8 },
});
