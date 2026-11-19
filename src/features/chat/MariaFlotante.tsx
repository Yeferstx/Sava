import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../shared/theme';
import { escucharVoz } from '../../shared/voz';
import AsistenteOrbe from './components/AsistenteOrbe';

// boton de maria que esta en todas las pantallas para hablarle en cualquier momento.
// muestra al personaje en pequeno; cuando maria habla se ven sus barras de sonido
export default function MariaFlotante({ onPress, abajo }: { onPress: () => void; abajo: number }) {
  const [hablando, setHablando] = useState(false);
  // con el teclado abierto se esconde para no tapar lo que se escribe
  const [teclado, setTeclado] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setTeclado(true),
    );
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setTeclado(false),
    );
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  useEffect(() => escucharVoz(setHablando), []);
  // al aparecer dice «¿Te ayudo?» unos segundos y luego queda solo con su nombre
  const [saludo, setSaludo] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setSaludo(false), 5000);
    return () => clearTimeout(t);
  }, []);

  if (teclado) return null;
  return (
    <View pointerEvents="box-none" style={[styles.contenedor, { bottom: abajo }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hablar con Aru"
        accessibilityHint="Abre el chat con Aru, el asistente de Sava"
        onPress={onPress}
        style={({ pressed }) => [styles.boton, pressed && styles.presionado]}
      >
        <View style={styles.orbe}>
          <AsistenteOrbe estado={hablando ? 'hablando' : 'reposo'} tamano={40} />
        </View>
        <View>
          <Text style={styles.texto}>Aru</Text>
          {saludo && <Text style={styles.saludo}>¿Te ayudo?</Text>}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { position: 'absolute', right: 14 },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingLeft: 2,
    paddingRight: 18,
    borderRadius: 28,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.salvia,
    shadowColor: colors.grafito,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  presionado: { transform: [{ scale: 0.95 }] },
  orbe: { width: 58, height: 52, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  texto: { color: colors.verde, fontSize: 16, fontWeight: '900' },
  saludo: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: -1 },
});
