import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Package, Sprout, Wifi, Wheat } from 'lucide-react-native';
import { listProducts, adjustStock } from './data/inventoryRepository';
import type { Product } from './types';
import { colors } from '../../shared/theme';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';

type Props = { onAddProduct: () => void; onOpenSales: () => void };
const money = (value: number) => `$${value.toLocaleString('es-CO')}`;

export default function InventoryScreen({ onAddProduct, onOpenSales }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { setProducts(await listProducts()); }
    catch { Alert.alert('No pudimos abrir el inventario', 'Intenta de nuevo en un momento.'); }
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

  const lowStock = products.filter((product) => product.stock <= 3).length;
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.brown} />}>
      <Text style={styles.eyebrow}>MERCADO LLANERO · YOPAL</Text><Text style={styles.title}>Inventario</Text>
      <View style={styles.stats}><View style={styles.stat}><Text style={styles.statNumber}>{products.length}</Text><Text style={styles.statLabel}>Productos</Text></View><View style={styles.stat}><Text style={[styles.statNumber, lowStock > 0 && styles.warning]}>{lowStock}</Text><Text style={styles.statLabel}>Por agotarse</Text></View><Pressable style={styles.salesStat} onPress={onOpenSales}><Text style={styles.salesLabel}>Ver ventas</Text><Text style={styles.salesArrow}>›</Text></Pressable></View>
      <View style={styles.heading}><Text style={styles.headingText}>Tus productos</Text><Pressable onPress={onAddProduct}><Text style={styles.addText}>＋ Agregar</Text></Pressable></View>
      {products.map((product) => <View key={product.id} style={styles.product}>
        <View style={[styles.productIcon, { backgroundColor: product.category === 'Agro' ? '#E8F2EE' : '#E8F2EE' }]}>{product.category === 'Agro' ? <Sprout size={23} color={colors.brown} /> : product.category === 'Abarrotes' ? <Wheat size={23} color={colors.brown} /> : <Package size={23} color={colors.brown} />}</View>
        <View style={styles.productInfo}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productPrice}>{money(product.price_cop)} · {product.unit}</Text><Text style={[styles.stock, product.stock <= 3 && styles.warning]}>{mostrarCantidad(product.stock)} {textoUnidad(product.stock, product.unit)} disponibles</Text><Text style={styles.sync}>{product.sync_status === 'local' ? '● Producto de muestra' : product.sync_status === 'pending' ? '● Pendiente de sincronizar' : '● Sincronizado'}</Text></View>
        <View style={styles.quantity}><Pressable accessibilityLabel={`Restar ${product.name}`} disabled={product.stock <= 0} onPress={() => changeStock(product, -1)} style={[styles.quantityButton, product.stock <= 0 && styles.quantityDisabled]}><Text style={styles.quantityText}>−</Text></Pressable><Text style={styles.quantityValue}>{mostrarCantidad(product.stock)}</Text><Pressable accessibilityLabel={`Sumar ${product.name}`} onPress={() => changeStock(product, 1)} style={styles.quantityButton}><Text style={styles.quantityText}>＋</Text></Pressable></View>
      </View>)}
      {products.length === 0 && !loading && <Text style={styles.empty}>Aún no tienes productos. Agrega el primero para comenzar.</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11, backgroundColor: '#E8F2EE', borderRadius: 13, padding: 12 }}><Wifi size={16} color="#636A64" /><Text style={{ color: '#636A64', fontSize: 10, lineHeight: 16, flex: 1 }}>Tus cambios se guardan en este celular y quedan listos para sincronizarse cuando vuelva la conexión.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 21, paddingTop: 37, paddingBottom: 36 }, eyebrow: { color: '#636A64', letterSpacing: 1.2, fontSize: 9, fontWeight: '800' }, title: { color: colors.ink, fontSize: 27, fontWeight: '900', marginTop: 4 }, stats: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 19, marginBottom: 25 }, stat: { flex: 1, backgroundColor: '#E8F2EE', borderRadius: 15, padding: 13 }, statNumber: { color: colors.brown, fontSize: 23, fontWeight: '900' }, statLabel: { color: colors.muted, fontSize: 10, marginTop: 2 }, warning: { color: '#775D50' }, salesStat: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brown, borderRadius: 15, padding: 13, minHeight: 65 }, salesLabel: { color: '#fff', fontWeight: '800', fontSize: 11 }, salesArrow: { color: '#fff', fontSize: 22, marginLeft: 8 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }, headingText: { color: colors.ink, fontWeight: '800', fontSize: 17 }, addText: { color: colors.brown, fontWeight: '800', fontSize: 12 }, product: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 11, marginBottom: 9, flexDirection: 'row', alignItems: 'center' }, productIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 11 }, productEmoji: { fontSize: 25 }, productInfo: { flex: 1 }, productName: { color: colors.ink, fontWeight: '800', fontSize: 12 }, productPrice: { color: colors.muted, fontSize: 10, marginTop: 2 }, stock: { color: '#174B3F', fontSize: 10, fontWeight: '700', marginTop: 4 }, sync: { color: '#636A64', fontSize: 8, marginTop: 3 }, quantity: { alignItems: 'center', gap: 5 }, quantityButton: { width: 29, height: 26, borderRadius: 9, backgroundColor: '#E8F2EE', alignItems: 'center', justifyContent: 'center' }, quantityDisabled: { opacity: 0.35 }, quantityText: { color: colors.brown, fontWeight: '800', fontSize: 17, lineHeight: 20 }, quantityValue: { color: colors.ink, fontWeight: '800', fontSize: 11 }, empty: { color: colors.muted, paddingVertical: 22 }, offlineNote: { color: '#636A64', backgroundColor: '#E8F2EE', borderRadius: 13, padding: 12, fontSize: 10, lineHeight: 16, marginTop: 11 } });
