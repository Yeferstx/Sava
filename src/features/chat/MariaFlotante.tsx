import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { colors } from '../../shared/theme';
import { escucharVoz } from '../../shared/voz';

// boton de maria que esta en todas las pantallas para hablarle en cualquier momento.
// cuando maria habla, el circulo late suave
export default function MariaFlotante({ onPress, abajo }: { onPress: () => void; abajo: number }) {
  const [hablando, setHablando] = useState(false);
  const latido = useRef(new Animated.Value(0)).current;

  useEffect(() => escucharVoz(setHablando), []);

  useEffect(() => {
    if (!hablando) { latido.stopAnimation(); latido.setValue(0); return; }
    const animacion = Animated.loop(Animated.timing(latido, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    animacion.start();
    return () => animacion.stop();
  }, [hablando]);

  const escala = latido.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const opacidad = latido.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View pointerEvents="box-none" style={[styles.contenedor, { bottom: abajo }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Hablar con María" accessibilityHint="Abre el chat con María, la asistente de Sava" onPress={onPress} style={({ pressed }) => [styles.boton, pressed && styles.presionado]}>
        <Animated.View pointerEvents="none" style={[styles.onda, { opacity: opacidad, transform: [{ scale: escala }] }]} />
        <Sparkles size={22} color={colors.grafito} />
        <Text style={styles.texto}>María</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { position: 'absolute', right: 16 },
  boton: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 54, paddingHorizontal: 18, borderRadius: 27, backgroundColor: colors.arcilla, shadowColor: colors.grafito, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  presionado: { transform: [{ scale: 0.95 }] },
  onda: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 27, backgroundColor: colors.arcilla },
  texto: { color: colors.grafito, fontSize: 16, fontWeight: '900' },
});
