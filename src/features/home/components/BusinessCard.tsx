import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Headphones, MapPin, Star, Store, Utensils } from 'lucide-react-native';
import type { Business } from '../../business/types';
import { colors } from '../../../shared/theme';

export default function BusinessCard({ business, onPress }: { business: Business; onPress: () => void }) {
  const Icon = business.category.toLowerCase().includes('restaurante') || business.category.toLowerCase().includes('comida') ? Utensils : business.category.toLowerCase().includes('tecnolog') ? Headphones : Store;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <View style={[styles.image, { backgroundColor: business.color }]}><Icon size={38} color={colors.brown} strokeWidth={1.6} /></View>
      <Text numberOfLines={1} style={styles.name}>{business.name}</Text>
      <Text style={styles.category}>{business.category}</Text>
      <View style={styles.meta}>{business.rating > 0 && <><Star size={11} color="#C98770" fill="#C98770" /><Text style={styles.rating}>{business.rating.toFixed(1)}</Text></>}<MapPin size={11} color={colors.muted} /><Text style={styles.category}>{business.municipality ?? `${business.distanceKm.toFixed(1)} km`}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 140, backgroundColor: '#fff', padding: 6, borderRadius: 15, borderWidth: 1, borderColor: '#DCD7CD' },
  image: { height: 88, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.ink, fontSize: 11, fontWeight: '800', marginTop: 7 }, category: { color: colors.muted, fontSize: 9, marginTop: 2 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, marginBottom: 3 }, rating: { color: '#26332F', fontSize: 9 },
});
