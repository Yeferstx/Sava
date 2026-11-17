import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, MapPin, Sprout, UserRound } from 'lucide-react-native';
import type { Business } from './types';
import { colors } from '../../shared/theme';
import { limpiarTelefono } from '../../shared/validaciones';

// perfil publico del productor
export default function BusinessDetailScreen({ business, onBack }: { business: Business; onBack: () => void }) {
  async function contactBusiness() {
    if (!business.phone) { Alert.alert('Contacto no disponible', 'Este productor todavía no agregó un número de contacto.'); return; }
    const texto = 'Hola, vi ' + business.name + ' en Sava y quisiera más información.';
    try { await Linking.openURL('https://wa.me/57' + limpiarTelefono(business.phone) + '?text=' + encodeURIComponent(texto)); }
    catch { Alert.alert('No se pudo abrir WhatsApp', 'Revisa que WhatsApp esté instalado e intenta de nuevo.'); }
  }
  let descripcion = business.description;
  if (!descripcion) descripcion = 'Este productor todavía no agregó una descripción.';
  let municipio = 'Casanare';
  if (business.municipality) municipio = business.municipality + ', Casanare';
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft size={19} color={colors.brown} /><Text style={styles.backText}>Volver</Text></Pressable>
      <View style={styles.hero}><Sprout size={70} color={colors.brown} strokeWidth={1.5} /></View>
      <Text style={styles.name}>{business.name}</Text>
      <Text style={styles.category}>{business.category}</Text>
      <Text style={styles.section}>Acerca del productor</Text><Text style={styles.description}>{descripcion}</Text>
      <View style={styles.info}><MapPin size={20} color={colors.brown} /><View><Text style={styles.infoTitle}>Ubicación</Text><Text style={styles.infoText}>{municipio}</Text></View></View>
      <View style={styles.info}><UserRound size={20} color={colors.brown} /><View style={styles.flex}><Text style={styles.infoTitle}>Perfil sin verificar</Text><Text style={styles.infoText}>Sava todavía no verifica la identidad de los productores. Acuerda la entrega antes de pagar.</Text></View></View>
      <Pressable style={styles.primary} onPress={() => void contactBusiness()}><Text style={styles.primaryText}>Contactar por WhatsApp</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 22, paddingTop: 14, paddingBottom: 100 }, back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 }, backText: { color: colors.brown, fontSize: 15, fontWeight: '700' },
  hero: { height: 170, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.verdeClaro }, name: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 20 }, category: { color: colors.muted, fontSize: 14, marginTop: 4 },
  section: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 25, marginBottom: 7 }, description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginTop: 12 }, infoTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, infoText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  primary: { backgroundColor: colors.brown, borderRadius: 25, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 24 }, primaryText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
