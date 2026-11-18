import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Wifi, WifiOff } from 'lucide-react-native';
import { colors } from '../theme';
import { escucharSenal, hayInternet } from '../../features/chat/pendientes';

// franja discreta arriba: sin conexion, y un momento "conexion recuperada" cuando vuelve.
// no bloquea nada: la app sigue funcionando con lo guardado en el celular
export default function AvisoConexion() {
  const [estado, setEstado] = useState<'ok' | 'sin' | 'volvio'>('ok');
  const altura = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    let antes = true;
    void hayInternet().then((senal) => { antes = senal; if (!senal) setEstado('sin'); });
    const quitar = escucharSenal((senal) => {
      if (espera) clearTimeout(espera);
      if (!senal) setEstado('sin');
      else if (!antes) { setEstado('volvio'); espera = setTimeout(() => setEstado('ok'), 2500); }
      antes = senal;
    });
    return () => { quitar(); if (espera) clearTimeout(espera); };
  }, []);

  useEffect(() => {
    Animated.timing(altura, { toValue: estado === 'ok' ? 0 : 1, duration: 220, useNativeDriver: false }).start();
  }, [estado]);

  const alto = altura.interpolate({ inputRange: [0, 1], outputRange: [0, 30] });
  return (
    <Animated.View accessibilityLiveRegion="polite" style={[styles.franja, estado === 'volvio' && styles.volvio, { height: alto, opacity: altura }]}>
      {estado === 'volvio' ? <Wifi size={14} color={colors.verde} /> : <WifiOff size={14} color={colors.grafito} />}
      <Text style={styles.texto} numberOfLines={1}>{estado === 'volvio' ? 'Conexión recuperada · Actualizando' : 'Sin conexión · Tus registros se guardan en este celular'}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  franja: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F5E7E2', overflow: 'hidden', paddingHorizontal: 12 },
  volvio: { backgroundColor: colors.salvia },
  texto: { color: colors.grafito, fontSize: 12, fontWeight: '700', flexShrink: 1 },
});
