import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CircleCheck, Package, Plus, Sprout } from 'lucide-react-native';
import { listProducts } from '../inventory/data/inventoryRepository';
import { listSales, recordSale } from './data/salesRepository';
import type { Product } from '../inventory/types';
import type { SaleSummary } from './types';
import { colors } from '../../shared/theme';
import { errorCantidad, leerCantidad, mostrarCantidad, redondear, tecladoCantidad, textoUnidad } from '../../shared/validaciones';

const money = (value: number) => `$${value.toLocaleString('es-CO')}`;

export default function SalesScreen({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendiendo, setVendiendo] = useState<Product | null>(null);
  const [cantidadVenta, setCantidadVenta] = useState('1');
  const refresh = useCallback(async () => {
    try { const [nextProducts, nextSales] = await Promise.all([listProducts(), listSales()]); setProducts(nextProducts); setSales(nextSales); }
    catch { Alert.alert('No pudimos cargar las ventas', 'Intenta de nuevo.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  function askToSell(product: Product) {
    if (product.stock <= 0) { Alert.alert('Sin existencias', 'Ajusta el inventario para poder registrar esta venta.'); return; }
    setVendiendo(product);
    if (product.stock < 1) {
      setCantidadVenta(mostrarCantidad(product.stock));
    } else {
      setCantidadVenta('1');
    }
  }

  function confirmarVenta() {
    if (vendiendo === null) return;
    const product = vendiendo;
    const cantidad = leerCantidad(cantidadVenta);
    const error = errorCantidad(cantidad, product.unit);
    if (error !== '') { Alert.alert('Revisa la cantidad', error); return; }
    if (redondear(cantidad) > redondear(product.stock)) {
      Alert.alert('No alcanza el inventario', 'Solo quedan ' + mostrarCantidad(product.stock) + ' ' + textoUnidad(product.stock, product.unit) + ' de ' + product.name + '.');
      return;
    }
    const total = Math.round(product.price_cop * cantidad);
    Alert.alert('Registrar venta', `¿Vendiste ${mostrarCantidad(cantidad)} ${textoUnidad(cantidad, product.unit)} de ${product.name} por ${money(total)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar venta', onPress: async () => { try { await recordSale(product.id, cantidad); setVendiendo(null); await refresh(); } catch (error) { Alert.alert('No se pudo registrar', error instanceof Error ? error.message : 'Intenta de nuevo.'); } } },
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
    {products.map((product) => <View key={product.id}><Pressable onPress={() => askToSell(product)} style={styles.product}><View style={styles.productIcon}>{product.category === 'Agro' ? <Sprout size={20} color={colors.brown} /> : <Package size={20} color={colors.brown} />}</View><View style={styles.productCopy}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productMeta}>{money(product.price_cop)} · quedan {mostrarCantidad(product.stock)} {textoUnidad(product.stock, product.unit)}</Text></View><Plus size={19} color={colors.brown} /></Pressable>
      {vendiendo !== null && vendiendo.id === product.id && <View style={styles.saleForm}>
        <Text style={styles.saleFormLabel}>Cantidad vendida ({textoUnidad(2, product.unit)})</Text>
        <View style={styles.saleFormRow}>
          <TextInput value={cantidadVenta} onChangeText={setCantidadVenta} keyboardType={tecladoCantidad(product.unit)} maxLength={10} style={styles.saleInput} />
          <Pressable accessibilityRole="button" onPress={confirmarVenta} style={styles.saleButton}><Text style={styles.saleButtonText}>Registrar</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setVendiendo(null)} style={styles.saleCancel}><Text style={styles.saleCancelText}>Cancelar</Text></Pressable>
        </View>
      </View>}
    </View>)}
    <Text style={[styles.section, styles.recentTitle]}>Movimientos recientes</Text>
    {sales.slice(0, 10).map((sale) => <View key={sale.id} style={styles.sale}><View style={styles.saleDot}><CircleCheck size={17} color="#174B3F" /></View><View style={styles.saleCopy}><Text style={styles.productName}>{sale.product_name} · {mostrarCantidad(sale.quantity)} {textoUnidad(sale.quantity, sale.unit)}</Text><Text style={styles.productMeta}>{new Date(sale.sold_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</Text></View><Text style={styles.saleAmount}>{money(sale.total_cop)}</Text></View>)}
    {!loading && sales.length === 0 && <Text style={styles.empty}>Las ventas que registres aparecerán aquí.</Text>}
    <Text style={styles.note}>Sin conexión también puedes registrar ventas. El inventario se descuenta en el celular.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 22, paddingTop: 35, paddingBottom: 35 }, back: { color: colors.brown, fontSize: 14, fontWeight: '700', marginBottom: 18 }, title: { color: colors.ink, fontSize: 27, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 }, summary: { backgroundColor: colors.brown, borderRadius: 18, padding: 18, marginTop: 18, marginBottom: 23 }, summaryCaption: { color: '#E8F2EE', fontSize: 9, letterSpacing: 1.2, fontWeight: '800' }, summaryValue: { color: '#fff', fontSize: 27, fontWeight: '900', marginTop: 6 }, summaryCount: { color: '#E8F2EE', fontSize: 11, marginTop: 3 }, section: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 10 }, product: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, marginBottom: 8 }, productIcon: { backgroundColor: '#E8F2EE', width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10, fontSize: 19 }, productCopy: { flex: 1 }, productName: { color: colors.ink, fontWeight: '800', fontSize: 12 }, productMeta: { color: colors.muted, fontSize: 10, marginTop: 3 }, plus: { color: colors.brown, fontSize: 22, paddingHorizontal: 5 }, recentTitle: { marginTop: 21 }, saleForm: { backgroundColor: '#F0E9DF', borderRadius: 14, padding: 11, marginTop: -2, marginBottom: 10 }, saleFormLabel: { color: colors.ink, fontSize: 11, fontWeight: '700', marginBottom: 7 }, saleFormRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, saleInput: { flex: 1, backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, color: colors.ink, fontSize: 13 }, saleButton: { backgroundColor: colors.brown, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 }, saleButtonText: { color: '#fff', fontWeight: '800', fontSize: 11 }, saleCancel: { paddingHorizontal: 6, paddingVertical: 9 }, saleCancelText: { color: colors.brown, fontWeight: '700', fontSize: 11 }, sale: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, saleDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F2EE', justifyContent: 'center', alignItems: 'center', marginRight: 10 }, saleCopy: { flex: 1 }, saleAmount: { color: colors.brown, fontSize: 12, fontWeight: '800' }, empty: { color: colors.muted, fontSize: 12, paddingVertical: 15 }, note: { backgroundColor: '#E8F2EE', color: '#636A64', borderRadius: 12, padding: 11, fontSize: 10, lineHeight: 15, marginTop: 16 } });
