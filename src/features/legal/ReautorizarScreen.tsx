import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../../shared/theme';
import SavaLogo from '../../shared/components/SavaLogo';
import BloqueAutorizacion from './components/BloqueAutorizacion';
import LegalScreen from './LegalScreen';
import { registrarAutorizacion } from './autorizaciones';
import { POLITICA_VERSION } from './politica';

// cuentas creadas antes de la politica, o cuando la politica cambia: se pide autorizar de nuevo
export default function ReautorizarScreen({
  usuario,
  onListo,
  onSalir,
}: {
  usuario: string;
  onListo: () => void;
  onSalir: () => void;
}) {
  const [autoriza, setAutoriza] = useState(false);
  const [ia, setIA] = useState(false);
  const [comunicaciones, setComunicaciones] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [leer, setLeer] = useState(false);

  async function continuar() {
    if (!autoriza) {
      setError('Para seguir usando tu cuenta necesitamos tu autorización.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await registrarAutorizacion(usuario, 'tratamiento_datos', true);
      await registrarAutorizacion(usuario, 'ia_externa', ia);
      await registrarAutorizacion(usuario, 'comunicaciones', comunicaciones);
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Intenta otra vez.');
    } finally {
      setGuardando(false);
    }
  }

  if (leer) return <LegalScreen onBack={() => setLeer(false)} />;
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SavaLogo size="regular" centrado />
      <Text style={styles.titulo}>Actualizamos nuestra política de datos</Text>
      <Text style={styles.texto}>
        Antes de seguir, lee el aviso y autoriza el tratamiento de tus datos (versión {POLITICA_VERSION}).
      </Text>
      <BloqueAutorizacion
        autoriza={autoriza}
        onAutoriza={(v) => {
          setAutoriza(v);
          if (v) setError('');
        }}
        ia={ia}
        onIA={setIA}
        comunicaciones={comunicaciones}
        onComunicaciones={setComunicaciones}
        error={error}
        onLeerPolitica={() => setLeer(true)}
      />
      <Pressable
        accessibilityRole="button"
        disabled={guardando}
        onPress={() => void continuar()}
        style={({ pressed }) => [styles.boton, pressed && styles.presionado]}
      >
        {guardando ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.botonTexto}>Autorizar y continuar</Text>
        )}
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onSalir} style={styles.salir}>
        <Text style={styles.salirTexto}>No autorizo, cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 40, backgroundColor: colors.crema, flexGrow: 1 },
  titulo: { color: colors.verde, fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 14 },
  texto: {
    color: colors.grafito,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  boton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.verde,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  presionado: { opacity: 0.85 },
  botonTexto: { color: colors.white, fontSize: 17, fontWeight: '800' },
  salir: { alignItems: 'center', paddingVertical: 14 },
  salirTexto: { color: colors.muted, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
});
