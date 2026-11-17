import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import ProductCard from '../home/components/ProductCard';
import type { Product } from '../inventory/types';
import type { Business } from '../business/types';
import { listarFavoritos, type Favorito } from './favoritosRepository';
import { colors } from '../../shared/theme';

// publicaciones que el comprador guardo en este celular
export default function GuardadosScreen({ onProductPress }: { onProductPress: (product: Product, business: Business | null) => void }) {
  const [lista, setLista] = useState<Favorito[]>([]);
  const refresh = useCallback(async () => {
    try { setLista(await listarFavoritos()); }
    catch { Alert.alert('No pudimos abrir tus guardados', 'Intenta de nuevo.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={colors.brown} />}>
      <Text style={styles.title}>Guardados</Text>
      <Text style={styles.subtitle}>Las publicaciones que guardas quedan en este celular. Los datos pueden haber cambiado: confirma con el productor.</Text>
      <View style={styles.grid}>
        {lista.map((item) => <ProductCard key={item.product.id} enGrilla product={item.product} municipio={item.business ? item.business.municipality : ''} onPress={() => onProductPress(item.product, item.business)} />)}
      </View>
      {lista.length === 0 && <View style={styles.empty}><Bookmark size={30} color={colors.brown} /><Text style={styles.emptyText}>Aún no guardas publicaciones. Toca el ícono de guardar en una cosecha para verla aquí.</Text></View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 20, paddingTop: 40, paddingBottom: 96 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  empty: { alignItems: 'center', gap: 12, padding: 26, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
