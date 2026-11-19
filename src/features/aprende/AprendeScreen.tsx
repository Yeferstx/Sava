import { useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ChevronDown, ChevronUp, GraduationCap, TriangleAlert } from 'lucide-react-native';
import { colors } from '../../shared/theme';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import { guias } from './guias';

// aprende con sava: guias cortas para leer o escuchar, sin internet
export default function AprendeScreen({
  onBack,
  onPreguntar,
}: {
  onBack: () => void;
  onPreguntar: () => void;
}) {
  const [abierta, setAbierta] = useState('');

  function cambiar(id: string) {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );
    setAbierta(abierta === id ? '' : id);
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.volver}>
        <ArrowLeft size={20} color={colors.verde} />
        <Text style={styles.volverTexto}>Volver</Text>
      </Pressable>
      <View style={styles.encabezado}>
        <View style={styles.icono}>
          <GraduationCap size={26} color={colors.verde} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.titulo}>Aprende con Sava</Text>
          <Text style={styles.subtitulo}>Guías cortas para vender mejor. Puedes escucharlas.</Text>
        </View>
      </View>
      {guias.map((guia) => {
        const abiertaEsta = abierta === guia.id;
        return (
          <View key={guia.id} style={[styles.guia, guia.tecnica && styles.guiaTecnica]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: abiertaEsta }}
              onPress={() => cambiar(guia.id)}
              style={styles.guiaArriba}
            >
              {guia.tecnica && <TriangleAlert size={18} color={colors.grafito} />}
              <View style={styles.flex}>
                <Text style={styles.guiaTitulo}>{guia.titulo}</Text>
                <Text style={styles.guiaResumen}>{guia.resumen}</Text>
              </View>
              {abiertaEsta ? (
                <ChevronUp size={20} color={colors.verde} />
              ) : (
                <ChevronDown size={20} color={colors.verde} />
              )}
            </Pressable>
            {abiertaEsta && (
              <View style={styles.pasos}>
                <BotonEscuchar
                  texto={
                    guia.titulo + '. ' + guia.pasos.map((p, i) => 'Paso ' + (i + 1) + '. ' + p).join(' ')
                  }
                />
                {guia.pasos.map((paso, i) => (
                  <View key={i} style={styles.paso}>
                    <View style={styles.numero}>
                      <Text style={styles.numeroTexto}>{i + 1}</Text>
                    </View>
                    <Text style={styles.pasoTexto}>{paso}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
      <Pressable accessibilityRole="button" onPress={onPreguntar} style={styles.preguntar}>
        <Text style={styles.preguntarTexto}>Pregúntale a tu asistente</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 18, paddingTop: 10, paddingBottom: 40 },
  volver: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  volverTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10 },
  icono: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.salvia,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { color: colors.verde, fontSize: 24, fontWeight: '900' },
  subtitulo: { color: colors.muted, fontSize: 14, marginTop: 2 },
  guia: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
    overflow: 'hidden',
  },
  guiaTecnica: { borderColor: colors.arcilla },
  guiaArriba: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  guiaTitulo: { color: colors.grafito, fontSize: 16, fontWeight: '900' },
  guiaResumen: { color: colors.muted, fontSize: 13, marginTop: 2 },
  pasos: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  paso: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  numero: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.verde,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  numeroTexto: { color: colors.white, fontSize: 13, fontWeight: '900' },
  pasoTexto: { flex: 1, color: colors.grafito, fontSize: 15, lineHeight: 22 },
  preguntar: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: colors.verde,
    marginTop: 8,
  },
  preguntarTexto: { color: colors.white, fontSize: 16, fontWeight: '900' },
});
