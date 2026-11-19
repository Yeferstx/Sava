import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../../shared/theme';
import { AUTORIZACIONES, AVISO_PRIVACIDAD } from '../politica';

// casilla que la persona marca por su cuenta (siempre empieza sin marcar)
export function Casilla({
  marcada,
  onCambiar,
  texto,
  error,
  opcional,
}: {
  marcada: boolean;
  onCambiar: (valor: boolean) => void;
  texto: string;
  error?: boolean;
  opcional?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      accessibilityLabel={texto}
      hitSlop={4}
      onPress={() => onCambiar(!marcada)}
      style={styles.casillaFila}
    >
      <View
        style={[styles.casilla, marcada && styles.casillaMarcada, error && !marcada && styles.casillaError]}
      >
        {marcada && <Check size={16} color={colors.white} strokeWidth={3} />}
      </View>
      <Text style={[styles.casillaTexto, opcional && styles.casillaOpcional]}>{texto}</Text>
    </Pressable>
  );
}

type Props = {
  autoriza: boolean;
  onAutoriza: (v: boolean) => void;
  ia: boolean;
  onIA: (v: boolean) => void;
  comunicaciones: boolean;
  onComunicaciones: (v: boolean) => void;
  error: string;
  onLeerPolitica: () => void;
};

// aviso corto + enlace a la politica + autorizacion obligatoria y las opcionales (separadas)
export default function BloqueAutorizacion({
  autoriza,
  onAutoriza,
  ia,
  onIA,
  comunicaciones,
  onComunicaciones,
  error,
  onLeerPolitica,
}: Props) {
  return (
    <View style={[styles.caja, error !== '' && styles.cajaError]}>
      <View style={styles.cabeza}>
        <ShieldCheck size={18} color={colors.verde} />
        <Text style={styles.titulo}>AVISO DE PRIVACIDAD</Text>
      </View>
      <Text style={styles.aviso}>{AVISO_PRIVACIDAD}</Text>
      <Pressable accessibilityRole="link" hitSlop={6} onPress={onLeerPolitica}>
        <Text style={styles.enlace}>Leer aviso y Política de Tratamiento de Datos Personales</Text>
      </Pressable>
      <Casilla
        marcada={autoriza}
        onCambiar={onAutoriza}
        texto={'«' + AUTORIZACIONES.tratamiento_datos.texto + '»'}
        error={error !== ''}
      />
      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Text style={styles.opcionales}>Opcional (puedes cambiarlo después en «Tus datos y privacidad»):</Text>
      <Casilla marcada={ia} onCambiar={onIA} texto={AUTORIZACIONES.ia_externa.texto} opcional />
      <Casilla
        marcada={comunicaciones}
        onCambiar={onComunicaciones}
        texto={AUTORIZACIONES.comunicaciones.texto}
        opcional
      />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    backgroundColor: colors.verdeClaro,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.verdeClaro,
  },
  cajaError: { borderColor: '#C98770' },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  titulo: { color: colors.verde, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  aviso: { color: colors.verde, fontSize: 12, lineHeight: 17 },
  enlace: {
    color: colors.verde,
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
    marginTop: 8,
    marginBottom: 10,
  },
  casillaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  casilla: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.verde,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  casillaMarcada: { backgroundColor: colors.verde },
  casillaError: { borderColor: '#C98770' },
  casillaTexto: { flex: 1, color: colors.grafito, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  casillaOpcional: { fontWeight: '400', fontSize: 12, lineHeight: 17 },
  opcionales: { color: colors.muted, fontSize: 12, marginTop: 8, marginBottom: 2 },
  error: { color: '#8A4F3B', fontSize: 12, fontWeight: '700', marginTop: 2, marginLeft: 34 },
});
