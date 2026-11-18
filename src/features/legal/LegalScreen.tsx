import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { colors } from '../../shared/theme';
import { AVISO_PRIVACIDAD, POLITICA_FECHA, POLITICA_VERSION, SECCIONES_POLITICA } from './politica';

// politica completa. el texto va dentro de la app: se lee sin internet
export default function LegalScreen({ onBack }: { onBack: () => void }) {
  return <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onBack}><Text style={styles.back}>‹  Volver</Text></Pressable>
    <View style={styles.cabeza}>
      <View style={styles.icono}><ShieldCheck size={26} color={colors.verde} /></View>
      <View style={styles.flex}>
        <Text style={styles.title}>Política de Tratamiento de Datos Personales</Text>
        <Text style={styles.version}>Versión {POLITICA_VERSION} · {POLITICA_FECHA}</Text>
      </View>
    </View>

    <View style={styles.aviso}>
      <Text style={styles.avisoTitulo}>Aviso de privacidad</Text>
      <Text style={styles.avisoTexto}>{AVISO_PRIVACIDAD}</Text>
    </View>

    {SECCIONES_POLITICA.map((seccion) => <View key={seccion.titulo}>
      <Text style={styles.section}>{seccion.titulo}</Text>
      {seccion.porConfirmar && <Text style={styles.pendiente}>Algunos datos del responsable están por confirmar por el equipo de Sava.</Text>}
      {seccion.parrafos.map((parrafo) => <Text key={parrafo} style={styles.body}>{parrafo}</Text>)}
    </View>)}

    <Text style={styles.section}>Términos de uso</Text>
    <Text style={styles.body}>Sava conecta a productores y compradores, pero no vende, no transporta y no procesa pagos. El precio final, la calidad y la entrega se acuerdan directamente entre las partes. Sava todavía no verifica la identidad de los productores: confirma los datos antes de pagar.</Text>
    <Text style={styles.body}>No está permitido publicar productos falsos, engañosos o ilegales. Las tiendas del campo solo pueden publicar agroquímicos con registro ICA vigente y etiqueta original. Las publicaciones que incumplan estas reglas pueden ser retiradas.</Text>
    <Text style={styles.body}>Las ventas e inventario del cuaderno son registros personales: no son facturas electrónicas ni contabilidad certificada. Aru puede equivocarse y nunca guarda una publicación o una venta sin que la confirmes.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 22, paddingTop: 14, paddingBottom: 48 },
  back: { color: colors.brown, fontWeight: '700', fontSize: 15, marginBottom: 18 },
  cabeza: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  icono: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.verde, fontSize: 20, fontWeight: '900', lineHeight: 25 },
  version: { color: colors.muted, fontSize: 13, marginTop: 2 },
  aviso: { backgroundColor: colors.verdeClaro, borderRadius: 16, padding: 14, marginTop: 18 },
  avisoTitulo: { color: colors.verde, fontSize: 13, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  avisoTexto: { color: colors.verde, fontSize: 14, lineHeight: 21 },
  pendiente: { color: '#775D50', backgroundColor: '#F5E7E2', borderRadius: 10, padding: 10, fontSize: 13, lineHeight: 18, marginBottom: 6, overflow: 'hidden' },
  section: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 6 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 6 },
});
