import { useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors } from '../../../shared/theme';

const ERROR = '#775D50';

type Props = TextInputProps & { etiqueta: string; icono: ReactNode; error?: string; ayuda?: string; esClave?: boolean };

// campo con etiqueta fija arriba, borde que se pone verde al tocarlo
// y mensaje de error debajo
export default function Campo({ etiqueta, icono, error = '', ayuda = '', esClave = false, onFocus, onBlur, ...resto }: Props) {
  const foco = useRef(new Animated.Value(0)).current;
  const [verClave, setVerClave] = useState(false);

  function animar(valor: number) {
    Animated.timing(foco, { toValue: valor, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }

  let borde: Animated.AnimatedInterpolation<string> | string = foco.interpolate({ inputRange: [0, 1], outputRange: [colors.line, colors.verde] });
  if (error !== '') borde = ERROR;

  return (
    <View style={styles.bloque}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Animated.View style={[styles.caja, { borderColor: borde }]}>
        {icono}
        <TextInput
          {...resto}
          secureTextEntry={esClave && !verClave}
          placeholderTextColor={colors.muted}
          style={styles.input}
          accessibilityLabel={etiqueta}
          onFocus={(e) => { animar(1); if (onFocus) onFocus(e); }}
          onBlur={(e) => { animar(0); if (onBlur) onBlur(e); }}
        />
        {esClave && <Pressable accessibilityRole="button" accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'} hitSlop={10} onPress={() => setVerClave(!verClave)} style={styles.ojo}>
          {verClave ? <EyeOff size={20} color={colors.grafito} /> : <Eye size={20} color={colors.grafito} />}
        </Pressable>}
      </Animated.View>
      {error !== '' && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {error === '' && ayuda !== '' && <Text style={styles.ayuda}>{ayuda}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { marginBottom: 12 },
  etiqueta: { color: colors.grafito, fontSize: 14, fontWeight: '700', marginBottom: 7 },
  caja: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: 14, borderWidth: 1.5, backgroundColor: colors.white, paddingHorizontal: 14 },
  input: { flex: 1, color: colors.grafito, fontSize: 15, paddingVertical: 12 },
  ojo: { padding: 4 },
  error: { color: ERROR, fontSize: 12, fontWeight: '600', marginTop: 6 },
  ayuda: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
