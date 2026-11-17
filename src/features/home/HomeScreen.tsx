import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bell, CircleUserRound, Grid2X2, MapPin, MessageCircle, Search, Scissors, ShoppingBag, Sparkles, Sprout, Utensils, Video } from 'lucide-react-native';
import { businesses as sampleBusinesses } from '../business/data/businesses';
import type { Business } from '../business/types';
import type { Product } from '../inventory/types';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import BusinessCard from './components/BusinessCard';
import ProductCard from './components/ProductCard';
import SavaLogo from '../../shared/components/SavaLogo';
import { colors } from '../../shared/theme';

const categories = [
  { Icon: Utensils, name: 'Restaurantes' }, { Icon: ShoppingBag, name: 'Tiendas' }, { Icon: Scissors, name: 'Servicios' }, { Icon: Sprout, name: 'Agro' }, { Icon: Grid2X2, name: 'Más' },
];

type Props = { exploring: boolean; guest: boolean; onOpenChat: (prompt?: string) => void; onBusinessPress: (business: Business) => void; onProductPress: (product: Product, business: Business | null) => void; onOpenVideos: () => void };

export default function HomeScreen({ exploring, guest, onOpenChat, onBusinessPress, onProductPress, onOpenVideos }: Props) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [localBusinesses, setLocalBusinesses] = useState<Business[]>(sampleBusinesses);
  const refreshFeed = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const [{ data: remoteProducts }, { data: remoteBusinesses }] = await Promise.all([
      supabase.from('products').select('id,business_id,name,category,description,price_cop,stock,unit,photo_path,is_published,updated_at').eq('is_published', true).order('created_at', { ascending: false }).limit(30),
      supabase.from('businesses').select('id,name,category,description,phone,municipality,is_published').eq('is_published', true).order('created_at', { ascending: false }).limit(30),
    ]);
    if (remoteProducts) setProducts(remoteProducts.map((product) => ({ ...product, price_cop: Number(product.price_cop), photo_uri: product.photo_path, is_published: 1, sync_status: 'synced', updated_at: product.updated_at ?? new Date().toISOString() })));
    if (remoteBusinesses) setLocalBusinesses(remoteBusinesses.map((business) => ({ id: business.id, name: business.name, category: business.category, rating: 0, distanceKm: 0, color: '#f1e2d1', description: business.description ?? '', phone: business.phone, municipality: business.municipality ?? 'Yopal' })));
  }, []);
  useEffect(() => { void refreshFeed().catch(() => undefined); }, [refreshFeed]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query.toLowerCase());
    const termsByCategory: Record<string, string[]> = { Restaurantes: ['comida', 'abarrote'], Tiendas: ['abarrote', 'otros'], Servicios: ['servicio'], Agro: ['agro'] };
    const matchesCategory = !selectedCategory || selectedCategory === 'Más' || (termsByCategory[selectedCategory] ?? []).some((term) => product.category.toLowerCase().includes(term));
    return matchesQuery && matchesCategory && product.is_published === 1;
  }), [products, query, selectedCategory]);
  const filteredBusinesses = useMemo(() => localBusinesses.filter((business) => {
    const searchMatches = `${business.name} ${business.category} ${business.description}`.toLowerCase().includes(query.toLowerCase());
    const categoryTerm: Record<string, string> = { Restaurantes: 'restaurante', Tiendas: 'tienda', Servicios: 'servicio', Agro: 'agro' };
    const categoryMatches = !selectedCategory || selectedCategory === 'Más' || business.category.toLowerCase().includes(categoryTerm[selectedCategory] ?? '');
    return searchMatches && categoryMatches;
  }), [localBusinesses, query, selectedCategory]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <SavaLogo />
        <Pressable accessibilityRole="button" onPress={() => Alert.alert('Tu ubicación', 'Mostrando negocios cerca de Yopal, Casanare.')} style={styles.location}><MapPin size={15} color={colors.ink} /><Text style={styles.locationText}>Yopal, Casanare</Text></Pressable>
        <Pressable accessibilityLabel="Notificaciones" onPress={() => Alert.alert('Notificaciones', 'Estás al día.')}><Bell size={21} color={colors.ink} /></Pressable>
        <View style={styles.avatar}><CircleUserRound size={22} color={colors.brown} /></View>
      </View>
      <Text style={styles.greeting}>{guest ? 'Explora lo local' : 'Qué bueno verte'}</Text>
      <Text style={styles.subGreeting}>¿Qué necesitas hoy en Casanare?</Text>
      <View style={styles.search}><Search size={19} color="#554a40" /><TextInput accessibilityLabel="Buscar negocios" value={query} onChangeText={setQuery} placeholder="Buscar negocios, productos o servicios..." placeholderTextColor="#89837d" style={styles.searchInput} returnKeyType="search" /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {categories.map(({ Icon, name }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedCategory === name }} key={name} onPress={() => setSelectedCategory(selectedCategory === name ? '' : name)} style={styles.category}><View style={[styles.categoryIcon, selectedCategory === name && styles.categorySelected]}><Icon size={22} color={colors.brown} strokeWidth={2} /></View><Text style={styles.categoryName}>{name}</Text></Pressable>)}
      </ScrollView>
      {!exploring && <Pressable accessibilityRole="button" onPress={() => onOpenChat()} style={styles.promo}>
        <View style={styles.promoCopy}><Text style={styles.promoEyebrow}>Conversa con</Text><Text style={styles.promoName}>María</Text><Text style={styles.promoSub}>Tu guía en Sava</Text><View style={styles.promoButton}><MessageCircle size={14} color="#39230e" /><Text style={styles.promoButtonText}>Pregúntale ahora</Text></View></View>
        <View style={styles.character}><View style={styles.characterAvatar}><CircleUserRound size={58} color="#fff4e9" strokeWidth={1.5} /></View><Sparkles size={29} color="#ffcd4d" style={styles.spark} /></View>
      </Pressable>}
      <View style={styles.section}><Text style={styles.sectionTitle}>Productos de Casanare</Text><Text style={styles.seeAll}>Ver todos ›</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.businesses}>
        {filteredProducts.map((product) => <ProductCard key={product.id} product={product} onPress={() => onProductPress(product, localBusinesses.find((business) => business.id === product.business_id) ?? null)} />)}
        {filteredProducts.length === 0 && <Text style={styles.empty}>Aún no hay publicaciones en esta categoría.</Text>}
      </ScrollView>
      <View style={styles.section}><Text style={styles.sectionTitle}>Negocios cerca de ti</Text><Text style={styles.seeAll}>Ver todos ›</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.businesses}>
        {filteredBusinesses.map((business) => <BusinessCard key={business.id} business={business} onPress={() => onBusinessPress(business)} />)}
        {filteredBusinesses.length === 0 && <Text style={styles.empty}>No encontramos negocios con esa búsqueda.</Text>}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={onOpenVideos} style={styles.videoLink}><Video size={17} color={colors.brown} /><Text style={styles.videoLinkText}>Descubre negocios en videos</Text></Pressable>
      <View style={styles.note}><Text style={styles.noteText}>Apoyamos el talento de nuestra tierra</Text><Sprout size={16} color={colors.brown} /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingHorizontal: 22, paddingTop: 52, paddingBottom: 18 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }, location: { flexDirection: 'row', alignItems: 'center', gap: 3 }, locationText: { color: colors.ink, fontWeight: '600', fontSize: 10 }, avatar: { width: 32, height: 32, borderRadius: 17, backgroundColor: '#e8d4c1', alignItems: 'center', justifyContent: 'center' }, greeting: { color: colors.ink, fontSize: 25, fontWeight: '800', letterSpacing: -0.6 }, subGreeting: { color: colors.ink, fontSize: 14, marginTop: 3, marginBottom: 18 },
  search: { height: 48, backgroundColor: '#fff', borderRadius: 25, paddingHorizontal: 16, alignItems: 'center', flexDirection: 'row', gap: 9, borderWidth: 1, borderColor: '#eee7e0', elevation: 2 }, searchInput: { flex: 1, fontSize: 12, color: colors.ink, paddingVertical: 0 }, categories: { paddingTop: 19, paddingBottom: 18, gap: 12 }, category: { alignItems: 'center', width: 61 }, categoryIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#f5e7d5', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }, categorySelected: { backgroundColor: '#edd4b9' }, categoryName: { color: '#493e35', fontSize: 9, fontWeight: '600' },
  promo: { height: 163, borderRadius: 21, backgroundColor: '#8e4d2e', overflow: 'hidden', padding: 17, flexDirection: 'row', marginBottom: 23 }, promoCopy: { zIndex: 1 }, promoEyebrow: { color: '#fff4e9', fontSize: 13 }, promoName: { color: '#fff', fontSize: 28, lineHeight: 31, fontWeight: '900' }, promoSub: { color: '#ffead7', fontSize: 12 }, promoButton: { backgroundColor: colors.gold, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, alignSelf: 'flex-start', marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }, promoButtonText: { color: '#39230e', fontSize: 10, fontWeight: '800' }, character: { position: 'absolute', right: 20, bottom: 16, alignItems: 'center' }, characterAvatar: { width: 88, height: 88, backgroundColor: '#a75e3a', borderRadius: 44, alignItems: 'center', justifyContent: 'center' }, spark: { position: 'absolute', right: 75, top: 2 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, seeAll: { color: colors.brown, fontSize: 11, fontWeight: '600' }, businesses: { gap: 11, paddingBottom: 3 }, empty: { color: colors.muted, padding: 12 }, videoLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, padding: 12, marginTop: 8, backgroundColor: '#f5e7d5', borderRadius: 13 }, videoLinkText: { color: colors.brown, fontWeight: '700', fontSize: 11 }, note: { marginTop: 19, backgroundColor: '#f1eadf', padding: 12, borderRadius: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }, noteText: { color: '#64553f', textAlign: 'center', fontWeight: '600', fontSize: 11 },
});
