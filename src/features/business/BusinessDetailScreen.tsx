import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Clock3, Headphones, Heart, MapPin, Star, Store, Utensils } from 'lucide-react-native';
import type { Business } from './types';
import { colors } from '../../shared/theme';

export default function BusinessDetailScreen({ business, onBack }: { business: Business; onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const Icon = business.category.toLowerCase().includes('restaurante') || business.category.toLowerCase().includes('comida') ? Utensils : business.category.toLowerCase().includes('tecnolog') ? Headphones : Store;
  async function contactBusiness() {
    if (!business.phone) { Alert.alert('Contacto no disponible', 'Este negocio todavía no agregó un número de contacto.'); return; }
    const number = business.phone.replace(/\D/g, '').replace(/^57/, '');
    await Linking.openURL(`https://wa.me/57${number}?text=${encodeURIComponent(`Hola, vi ${business.name} en Sava y quisiera más información.`)}`);
  }
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}><ArrowLeft size={19} color={colors.brown} /><Text style={styles.backText}>Volver</Text></Pressable>
      <View style={[styles.hero, { backgroundColor: business.color }]}><Icon size={78} color={colors.brown} strokeWidth={1.5} /></View>
      <View style={styles.headingRow}><View style={styles.headingCopy}><Text style={styles.name}>{business.name}</Text><Text style={styles.category}>{business.category}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar negocio'} onPress={() => setSaved(!saved)} style={styles.save}><Heart size={21} color={colors.brown} fill={saved ? colors.brown : 'transparent'} /></Pressable></View>
      {business.rating > 0 && <View style={styles.rating}><Star size={14} color="#d99b25" fill="#d99b25" /><Text style={styles.ratingText}>{business.rating.toFixed(1)}  ·  A {business.distanceKm.toFixed(1)} km</Text></View>}
      <Text style={styles.section}>Acerca del negocio</Text><Text style={styles.description}>{business.description || 'Conoce este negocio local de Casanare y comunícate directamente para consultar disponibilidad.'}</Text>
      <View style={styles.info}><MapPin size={20} color={colors.brown} /><View><Text style={styles.infoTitle}>Ubicación</Text><Text style={styles.infoText}>{business.municipality ?? 'Yopal'}, Casanare</Text></View></View>
      <View style={styles.info}><Clock3 size={20} color={colors.brown} /><View><Text style={styles.infoTitle}>Horario</Text><Text style={styles.infoText}>Consulta disponibilidad con el negocio</Text></View></View>
      <Pressable style={styles.primary} onPress={() => void contactBusiness()}><Text style={styles.primaryText}>Contactar por WhatsApp</Text></Pressable>
      <Pressable style={styles.secondary} onPress={() => Alert.alert('Cómo llegar', 'La navegación y el mapa estarán disponibles al conectar el servicio de ubicación.')}><Text style={styles.secondaryText}>Ver cómo llegar</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 22, paddingTop: 36, paddingBottom: 32 }, back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 }, backText: { color: colors.brown, fontSize: 15, fontWeight: '700' }, hero: { height: 220, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }, headingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 }, headingCopy: { flex: 1 }, name: { color: colors.ink, fontSize: 25, fontWeight: '900' }, category: { color: colors.muted, fontSize: 14, marginTop: 4 }, save: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#f4e7da', justifyContent: 'center', alignItems: 'center' }, rating: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 }, ratingText: { color: '#604a35', fontSize: 13 }, section: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 25, marginBottom: 7 }, description: { color: colors.muted, fontSize: 14, lineHeight: 22 }, info: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomColor: colors.line, borderBottomWidth: 1 }, infoTitle: { color: colors.ink, fontWeight: '700', fontSize: 13 }, infoText: { color: colors.muted, fontSize: 12, marginTop: 3 }, primary: { backgroundColor: colors.brown, borderRadius: 25, padding: 15, alignItems: 'center', marginTop: 24 }, primaryText: { color: '#fff', fontWeight: '800' }, secondary: { borderColor: colors.brown, borderWidth: 1, borderRadius: 25, padding: 14, alignItems: 'center', marginTop: 10 }, secondaryText: { color: colors.brown, fontWeight: '800' },
});
