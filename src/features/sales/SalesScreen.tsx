import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CircleCheck, Package, Plus, Sprout } from 'lucide-react-native';
import { listProducts } from '../inventory/data/inventoryRepository';
import { listSales, recordSale } from './data/salesRepository';
import type { Product } from '../inventory/types';
import type { SaleSummary } from './types';
import { colors } from '../../shared/theme';

const money = (value: number) => `$${value.toLocaleString('es-CO')}`;

export default function SalesScreen({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const [nextProducts, nextSales] = await Promise.all([listProducts(), listSales()]); setProducts(nextProducts); setSales(nextSales); }
    catch { Alert.alert('No pudimos cargar las ventas', 'Intenta de nuevo.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  function askToSell(product: Product) {
    if (product.stock < 1) { Alert.alert('Sin existencias', 'Ajusta el inventario para poder registrar esta venta.'); return; }
    Alert.alert('Registrar venta', `¿Vendiste 1 ${product.unit} de ${product.name} por ${money(product.price_cop)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar venta', onPress: async () => { try { await recordSale(product.id); await refresh(); } catch (error) { Alert.alert('No se pudo registrar', error instanceof Error ? error.message : 'Intenta de nuevo.'); } } },
    ]);
  }

  const today = new Date().toDateString();
  const todaySales = sales.filter((sale) => new Date(sale.sold_at).toDateString() === today);
  const totalToday = todaySales.reduce((sum, sale) => sum + sale.total_cop, 0);

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.brown} />}>
    <Pressable onPress={onBack}><Text style={styles.back}>‹  Mi negocio</Text></Pressable>
    <Text style={styles.title}>Ventas</Text><Text style={styles.subtitle}>Registra cada venta y mantén tus cuentas al día.</Text>
    <View style={styles.summary}><Text style={styles.summaryCaption}>TOTAL DE HOY</Text><Text style={styles.summaryValue}>{money(totalToday)}</Text><Text style={styles.summaryCount}>{todaySales.length} {todaySales.length === 1 ? 'venta' : 'ventas'}</Text></View>
    <Text style={styles.section}>Registrar una venta</Text>
    {products.map((product) => <Pressable key={product.id} onPress={() => askToSell(product)} style={styles.product}><View style={styles.productIcon}>{product.category === 'Agro' ? <Sprout size={20} color={colors.brown} /> : <Package size={20} color={colors.brown} />}</View><View style={styles.productCopy}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productMeta}>{money(product.price_cop)} · quedan {product.stock} {product.unit}</Text></View><Plus size={19} color={colors.brown} /></Pressable>)}
    <Text style={[styles.section, styles.recentTitle]}>Movimientos recientes</Text>
    {sales.slice(0, 10).map((sale) => <View key={sale.id} style={styles.sale}><View style={styles.saleDot}><CircleCheck size={17} color="#526b37" /></View><View style={styles.saleCopy}><Text style={styles.productName}>{sale.product_name} · {sale.quantity} {sale.quantity === 1 ? 'unidad' : 'unidades'}</Text><Text style={styles.productMeta}>{new Date(sale.sold_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</Text></View><Text style={styles.saleAmount}>{money(sale.total_cop)}</Text></View>)}
    {!loading && sales.length === 0 && <Text style={styles.empty}>Las ventas que registres aparecerán aquí.</Text>}
    <Text style={styles.note}>Sin conexión también puedes registrar ventas. El inventario se descuenta en el celular.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 22, paddingTop: 35, paddingBottom: 35 }, back: { color: colors.brown, fontSize: 14, fontWeight: '700', marginBottom: 18 }, title: { color: colors.ink, fontSize: 27, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 }, summary: { backgroundColor: colors.brown, borderRadius: 18, padding: 18, marginTop: 18, marginBottom: 23 }, summaryCaption: { color: '#f2ddc8', fontSize: 9, letterSpacing: 1.2, fontWeight: '800' }, summaryValue: { color: '#fff', fontSize: 27, fontWeight: '900', marginTop: 6 }, summaryCount: { color: '#f2ddc8', fontSize: 11, marginTop: 3 }, section: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 10 }, product: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, marginBottom: 8 }, productIcon: { backgroundColor: '#f4e9dc', width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10, fontSize: 19 }, productCopy: { flex: 1 }, productName: { color: colors.ink, fontWeight: '800', fontSize: 12 }, productMeta: { color: colors.muted, fontSize: 10, marginTop: 3 }, plus: { color: colors.brown, fontSize: 22, paddingHorizontal: 5 }, recentTitle: { marginTop: 21 }, sale: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, saleDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e8efdc', justifyContent: 'center', alignItems: 'center', marginRight: 10 }, saleCopy: { flex: 1 }, saleAmount: { color: colors.brown, fontSize: 12, fontWeight: '800' }, empty: { color: colors.muted, fontSize: 12, paddingVertical: 15 }, note: { backgroundColor: '#f0eadf', color: '#675944', borderRadius: 12, padding: 11, fontSize: 10, lineHeight: 15, marginTop: 16 } });
