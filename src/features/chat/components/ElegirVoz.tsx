import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, Play, X } from 'lucide-react-native';
import { colors } from '../../../shared/theme';
import {
  ajustesVoz,
  callar,
  elegirVoz,
  hablar,
  listarVocesEspanol,
  type VozEspanol,
} from '../../../shared/voz';

const PRUEBA = 'Hola, soy Aru, tu asistente de Sava. Te ayudo a mostrar tu cosecha y a llevar tus cuentas.';
const VELOCIDADES = [
  { texto: 'Más despacio', valor: 0.82 },
  { texto: 'Normal', valor: 0.95 },
  { texto: 'Más rápido', valor: 1.1 },
];

// elegir la voz de aru: se escucha cada una y se guarda la que mas guste
export default function ElegirVoz({ visible, onCerrar }: { visible: boolean; onCerrar: () => void }) {
  const [voces, setVoces] = useState<VozEspanol[] | null>(null);
  const [elegida, setElegida] = useState('');
  const [velocidad, setVelocidad] = useState(0.95);

  useEffect(() => {
    if (!visible) return;
    void listarVocesEspanol().then(setVoces);
    void ajustesVoz().then((a) => {
      setElegida(a.identificador);
      setVelocidad(a.velocidad);
    });
  }, [visible]);

  function probar(voz: VozEspanol | undefined, vel = velocidad) {
    if (voz) void hablar(PRUEBA, voz, vel);
  }

  async function guardar() {
    const voz = voces ? (voces.find((v) => v.identificador === elegida) ?? null) : null;
    await elegirVoz(voz, velocidad);
    callar();
    onCerrar();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        <View style={styles.hoja}>
          <View style={styles.arriba}>
            <Text style={styles.titulo}>Voz de Aru</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              hitSlop={10}
              onPress={() => {
                callar();
                onCerrar();
              }}
            >
              <X size={22} color={colors.verde} />
            </Pressable>
          </View>
          <Text style={styles.subtitulo}>Toca ▶ para escuchar cada voz y elige la que más te guste.</Text>

          <Text style={styles.etiqueta}>Velocidad</Text>
          <View style={styles.velocidades}>
            {VELOCIDADES.map((v) => (
              <Pressable
                key={v.valor}
                accessibilityRole="button"
                accessibilityState={{ selected: velocidad === v.valor }}
                onPress={() => {
                  setVelocidad(v.valor);
                  probar(voces?.find((x) => x.identificador === elegida) ?? voces?.[0], v.valor);
                }}
                style={[styles.velocidad, velocidad === v.valor && styles.velocidadActiva]}
              >
                <Text style={[styles.velocidadTexto, velocidad === v.valor && styles.velocidadTextoActiva]}>
                  {v.texto}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.etiqueta}>Voces de tu celular</Text>
          <ScrollView style={styles.lista} contentContainerStyle={styles.listaContenido}>
            {voces === null && <ActivityIndicator color={colors.verde} />}
            {voces !== null && voces.length === 0 && (
              <Text style={styles.ayuda}>
                Tu celular no tiene voces en español instaladas. Mira abajo cómo descargarlas.
              </Text>
            )}
            {voces?.map((voz) => {
              const activa = voz.identificador === elegida;
              return (
                <Pressable
                  key={voz.identificador}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: activa }}
                  accessibilityLabel={voz.nombre + ', ' + voz.pais}
                  onPress={() => {
                    setElegida(voz.identificador);
                    probar(voz);
                  }}
                  style={[styles.voz, activa && styles.vozActiva]}
                >
                  <View style={[styles.radio, activa && styles.radioActivo]}>
                    {activa && <Check size={14} color={colors.white} />}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.vozNombre} numberOfLines={1}>
                      {voz.nombre}
                    </Text>
                    <Text style={styles.vozPais}>
                      {voz.pais}
                      {voz.calidad === 'mejor' ? ' · Mejor calidad' : ''}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={'Escuchar ' + voz.nombre}
                    hitSlop={8}
                    onPress={() => probar(voz)}
                    style={styles.play}
                  >
                    <Play size={16} color={colors.white} fill={colors.white} />
                  </Pressable>
                </Pressable>
              );
            })}
            <Text style={styles.ayuda}>
              {Platform.OS === 'ios'
                ? 'Para una voz más natural (gratis): Ajustes → Accesibilidad → Contenido leído → Voces → Español → elige una que diga «Mejorada» o «Premium» y descárgala. Luego vuelve aquí.'
                : 'Para una voz más natural (gratis): Ajustes → Idioma → Salida de texto a voz → Servicios de voz de Google → Instalar datos de voz → Español (Estados Unidos o México). Luego vuelve aquí.'}
            </Text>
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={() => void guardar()}
            style={({ pressed }) => [styles.guardar, pressed && styles.presionado]}
          >
            <Text style={styles.guardarTexto}>Usar esta voz</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38,51,47,0.4)' },
  hoja: {
    maxHeight: '88%',
    backgroundColor: colors.crema,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 18,
    paddingBottom: 28,
  },
  arriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { color: colors.verde, fontSize: 22, fontWeight: '900' },
  subtitulo: { color: colors.muted, fontSize: 14, marginTop: 4 },
  etiqueta: { color: colors.grafito, fontSize: 14, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  velocidades: { flexDirection: 'row', gap: 8 },
  velocidad: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  velocidadActiva: { backgroundColor: colors.verde, borderColor: colors.verde },
  velocidadTexto: { color: colors.verde, fontSize: 13, fontWeight: '800' },
  velocidadTextoActiva: { color: colors.white },
  lista: { flexGrow: 0 },
  listaContenido: { gap: 8, paddingBottom: 8 },
  voz: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  vozActiva: { borderColor: colors.verde, backgroundColor: '#F7FBF8' },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActivo: { backgroundColor: colors.verde, borderColor: colors.verde },
  vozNombre: { color: colors.grafito, fontSize: 15, fontWeight: '800' },
  vozPais: { color: colors.muted, fontSize: 12, marginTop: 1 },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.verde,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  ayuda: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  guardar: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: colors.verde,
    marginTop: 10,
  },
  guardarTexto: { color: colors.white, fontSize: 16, fontWeight: '900' },
  presionado: { transform: [{ scale: 0.97 }] },
});
