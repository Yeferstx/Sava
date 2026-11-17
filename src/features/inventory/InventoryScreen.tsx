import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pause, Pencil, Play, Share2, Sprout, Trash2, Wifi } from 'lucide-react-native';
import { adjustStock, cambiarEstadoPublicacion, listProducts } from './data/inventoryRepository';
import { getBusinessProfile } from '../business/data/businessRepository';
import type { Product } from './types';
import { colors } from '../../shared/theme';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';
import { compartirCosecha, dinero } from '../../shared/contacto';

type Props = { onAddProduct: () => void; onEdit: (product: Product) => void; onOpenSales: () => void };

// mis cosechas: publicaciones del agricultor con su cantidad disponible
export default function InventoryScreen({ onAddProduct, onEdit, onOpenSales }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [finca, setFinca] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setProducts(await listProducts());
      const perfil = await getBusinessProfile();
      if (perfil) setFinca(perfil.name + ' · ' + perfil.city);
    }
    catch { Alert.alert('No pudimos abrir tus cosechas', 'Intenta de nuevo en un momento.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function changeStock(product: Product, delta: number) {
    // si queda menos de 1 (ej. 0,5 kg) se resta lo que queda
    if (delta < 0 && product.stock < 1) delta = -product.stock;
    if (delta === 0) return;
    try { await adjustStock(product.id, delta); await refresh(); }
    catch (error) { Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Intenta de nuevo.'); }
  }

  async function cambiarEstado(product: Product, estado: 'activa' | 'pausada' | 'retirada') {
    try { await cambiarEstadoPublicacion(product.id, estado); await refresh(); }
    catch (error) { Alert.alert('No se pudo cambiar', error instanceof Error ? error.message : 'Intenta de nuevo.'); }
  }

  // antes de cambios importantes se pide confirmacion
  function pausar(product: Product) {
    if (product.is_published === 0) { void cambiarEstado(product, 'activa'); return; }
    Alert.alert('Pausar publicación', 'Los compradores dejarán de ver "' + product.name + '" hasta que la reanudes.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Pausar', onPress: () => void cambiarEstado(product, 'pausada') },
    ]);
  }

  function retirar(product: Product) {
    Alert.alert('Retirar publicación', '"' + product.name + '" se quitará del mercado y de tu lista. Las ventas registradas se conservan. ¿Quieres continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Retirar', style: 'destructive', onPress: () => void cambiarEstado(product, 'retirada') },
    ]);
  }

  let activas = 0;
  let agotadas = 0;
  for (const product of products) {
    if (product.is_published === 1) activas = activas + 1;
    if (product.stock <= 0) agotadas = agotadas + 1;
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.brown} />}>
      {finca !== '' && <Text style={styles.eyebrow}>{finca.toUpperCase()}</Text>}
      <Text style={styles.title}>Mis cosechas</Text>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statNumber}>{activas}</Text><Text style={styles.statLabel}>Publicadas</Text></View>
        <View style={styles.stat}><Text style={[styles.statNumber, agotadas > 0 && styles.warning]}>{agotadas}</Text><Text style={styles.statLabel}>Agotadas</Text></View>
        <Pressable style={styles.salesStat} onPress={onOpenSales}><Text style={styles.salesLabel}>Ventas</Text><Text style={styles.salesArrow}>›</Text></Pressable>
      </View>
      <View style={styles.heading}><Text style={styles.headingText}>Tus publicaciones</Text><Pressable onPress={onAddProduct}><Text style={styles.addText}>＋ Publicar</Text></Pressable></View>

      {products.map((product) => {
        let estado = 'Publicada';
        if (product.is_published === 0) estado = 'Pausada';
        let sync = 'Sincronizada';
        if (product.sync_status === 'pending') sync = 'Pendiente de sincronizar';
        if (product.sync_status === 'local') sync = 'Solo en este celular';
        return <View key={product.id} style={styles.product}>
          <View style={styles.productTop}>
            <View style={styles.productIcon}><Sprout size={22} color={colors.brown} /></View>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>{dinero(product.price_cop)} por {product.unit}</Text>
              <Text style={[styles.stock, product.stock <= 0 && styles.warning]}>{mostrarCantidad(product.stock)} {textoUnidad(product.stock, product.unit)} disponibles</Text>
              <View style={styles.badges}>
                <Text style={[styles.badge, product.is_published === 0 && styles.badgePaused]}>{estado}</Text>
                <Text style={[styles.sync, product.sync_status === 'pending' && styles.syncPending]}>● {sync}</Text>
              </View>
            </View>
            <View style={styles.quantity}>
              <Pressable accessibilityLabel={'Sumar ' + product.name} onPress={() => changeStock(product, 1)} style={styles.quantityButton}><Text style={styles.quantityText}>＋</Text></Pressable>
              <Pressable accessibilityLabel={'Restar ' + product.name} disabled={product.stock <= 0} onPress={() => changeStock(product, -1)} style={[styles.quantityButton, product.stock <= 0 && styles.quantityDisabled]}><Text style={styles.quantityText}>−</Text></Pressable>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => onEdit(product)} style={styles.action}><Pencil size={15} color={colors.brown} /><Text style={styles.actionText}>Editar</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => pausar(product)} style={styles.action}>{product.is_published === 0 ? <Play size={15} color={colors.brown} /> : <Pause size={15} color={colors.brown} />}<Text style={styles.actionText}>{product.is_published === 0 ? 'Reanudar' : 'Pausar'}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void compartirCosecha(product, null)} style={styles.action}><Share2 size={15} color={colors.brown} /><Text style={styles.actionText}>Compartir</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => retirar(product)} style={styles.action}><Trash2 size={15} color="#775D50" /><Text style={[styles.actionText, styles.warning]}>Retirar</Text></Pressable>
          </View>
        </View>;
      })}
      {products.length === 0 && !loading && <View style={styles.emptyBox}><Text style={styles.empty}>Aún no tienes cosechas publicadas.</Text><Pressable onPress={onAddProduct} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Publicar mi primera cosecha</Text></Pressable></View>}
      <View style={styles.offline}><Wifi size={16} color={colors.muted} /><Text style={styles.offlineText}>Tus cambios se guardan en este celular y se sincronizan cuando vuelve la conexión.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 20, paddingTop: 37, paddingBottom: 36 },
  eyebrow: { color: colors.muted, letterSpacing: 1.1, fontSize: 11, fontWeight: '800' }, title: { color: colors.ink, fontSize: 27, fontWeight: '900', marginTop: 4 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18, marginBottom: 22 },
  stat: { flex: 1, backgroundColor: colors.verdeClaro, borderRadius: 15, padding: 13 }, statNumber: { color: colors.brown, fontSize: 23, fontWeight: '900' }, statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  warning: { color: '#775D50' },
  salesStat: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brown, borderRadius: 15, padding: 13, minHeight: 68 }, salesLabel: { color: colors.white, fontWeight: '800', fontSize: 13 }, salesArrow: { color: colors.white, fontSize: 22, marginLeft: 8 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }, headingText: { color: colors.ink, fontWeight: '800', fontSize: 18 }, addText: { color: colors.brown, fontWeight: '800', fontSize: 14 },
  product: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 12, marginBottom: 10 },
  productTop: { flexDirection: 'row', alignItems: 'center' },
  productIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 11, backgroundColor: colors.verdeClaro },
  productInfo: { flex: 1 }, productName: { color: colors.ink, fontWeight: '800', fontSize: 15 }, productPrice: { color: colors.muted, fontSize: 12, marginTop: 2 },
  stock: { color: colors.brown, fontSize: 13, fontWeight: '700', marginTop: 4 },
  badges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  badge: { color: colors.brown, backgroundColor: colors.verdeClaro, fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, overflow: 'hidden' },
  badgePaused: { color: '#775D50', backgroundColor: '#F5E7E2' },
  sync: { color: colors.muted, fontSize: 11 }, syncPending: { color: '#775D50', fontWeight: '700' },
  quantity: { alignItems: 'center', gap: 6 }, quantityButton: { width: 36, height: 32, borderRadius: 10, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' }, quantityDisabled: { opacity: 0.35 },
  quantityText: { color: colors.brown, fontWeight: '800', fontSize: 18, lineHeight: 21 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, marginTop: 11, paddingTop: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 4 }, actionText: { color: colors.brown, fontSize: 12, fontWeight: '700' },
  emptyBox: { alignItems: 'center', gap: 12, padding: 22, backgroundColor: colors.white, borderRadius: 17, borderWidth: 1, borderColor: colors.line },
  empty: { color: colors.muted, fontSize: 14 }, emptyButton: { backgroundColor: colors.brown, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11 }, emptyButtonText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: colors.verdeClaro, borderRadius: 13, padding: 12 }, offlineText: { color: colors.muted, fontSize: 12, lineHeight: 17, flex: 1 },
});
