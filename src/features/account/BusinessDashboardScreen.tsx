import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Boxes, CircleCheck, CircleDollarSign, ClipboardList, PackagePlus, Sparkles, Store, Wifi } from 'lucide-react-native';
import { listProducts } from '../inventory/data/inventoryRepository';
import { listSales } from '../sales/data/salesRepository';
import { getBusinessProfile } from '../business/data/businessRepository';
import type { AppTab } from '../../navigation/types';
import { colors } from '../../shared/theme';

type Props = { onNavigate: (tab: AppTab) => void; onRegisterBusiness: () => void; onSignOut?: () => void };
const money = (value: number) => `$${value.toLocaleString('es-CO')}`;

export default function BusinessDashboardScreen({ onNavigate, onRegisterBusiness, onSignOut }: Props) {
  const [productCount, setProductCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [businessName, setBusinessName] = useState('Mercado Llanero');
  const [municipality, setMunicipality] = useState('Yopal');
  const refresh = useCallback(async () => {
    try {
      const [products, sales, business] = await Promise.all([listProducts(), listSales(), getBusinessProfile()]);
      const today = new Date().toDateString();
      const currentSales = sales.filter((sale) => new Date(sale.sold_at).toDateString() === today);
      setProductCount(products.length); setTodayCount(currentSales.length); setTodayTotal(currentSales.reduce((sum, sale) => sum + sale.total_cop, 0));
      if (business) { setBusinessName(business.name); setMunicipality(business.city); }
    } catch { Alert.alert('No pudimos cargar el resumen', 'Revisa tu conexión e intenta otra vez.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>HERRAMIENTAS PARA TU NEGOCIO</Text><Text style={styles.title}>Mi negocio</Text>
    <View style={styles.businessCard}><View style={styles.storeIcon}><Store size={24} color={colors.brown} /></View><View style={styles.businessCopy}><Text style={styles.businessName}>{businessName}</Text><Text style={styles.businessLocation}>{municipality} · Casanare</Text></View><CircleCheck size={19} color="#568253" /></View>
    <View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricLabel}>VENTAS DE HOY</Text><Text style={styles.metricValue}>{money(todayTotal)}</Text><Text style={styles.metricHint}>{todayCount} {todayCount === 1 ? 'venta' : 'ventas'}</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>PUBLICACIONES</Text><Text style={styles.metricValue}>{productCount}</Text><Text style={styles.metricHint}>productos activos</Text></View></View>
    <Text style={styles.section}>Atajos</Text>
    <Pressable onPress={() => onNavigate('Inventario')} style={styles.action}><View style={styles.actionIcon}><Boxes size={21} color={colors.brown} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Inventario</Text><Text style={styles.actionBody}>Actualiza existencias y precios</Text></View><ArrowRight size={18} color={colors.brown} /></Pressable>
    <Pressable onPress={() => onNavigate('Ventas')} style={styles.action}><View style={styles.actionIcon}><CircleDollarSign size={21} color={colors.brown} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Registrar ventas</Text><Text style={styles.actionBody}>Lleva tus cuentas al día</Text></View><ArrowRight size={18} color={colors.brown} /></Pressable>
    <Pressable onPress={() => onNavigate('Pedidos')} style={styles.action}><View style={styles.actionIcon}><ClipboardList size={21} color={colors.brown} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Pedidos</Text><Text style={styles.actionBody}>Revisa y responde solicitudes de clientes</Text></View><ArrowRight size={18} color={colors.brown} /></Pressable>
    <Pressable onPress={() => onNavigate('Publicar')} style={styles.action}><View style={styles.actionIcon}><PackagePlus size={21} color={colors.brown} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Publicar producto</Text><Text style={styles.actionBody}>Muestra lo que ofreces</Text></View><ArrowRight size={18} color={colors.brown} /></Pressable>
    <Pressable onPress={() => onNavigate('María')} style={styles.action}><View style={styles.actionIcon}><Sparkles size={21} color={colors.brown} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Hablar con María</Text><Text style={styles.actionBody}>Prepara una publicación conversando</Text></View><ArrowRight size={18} color={colors.brown} /></Pressable>
    <Pressable onPress={onRegisterBusiness} style={styles.editProfile}><Text style={styles.editProfileText}>Editar información del negocio</Text></Pressable>
    {!!onSignOut && <Pressable onPress={onSignOut} style={styles.editProfile}><Text style={styles.signOutText}>Cerrar sesión</Text></Pressable>}
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}><Wifi size={15} color="#71804e" /><Text style={styles.offline}>Inventario y ventas se guardan en este dispositivo, incluso sin internet.</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 22, paddingTop: 38, paddingBottom: 40 }, eyebrow: { color: '#9c8876', fontSize: 9, letterSpacing: 1.2, fontWeight: '800' }, title: { color: colors.ink, fontSize: 27, fontWeight: '900', marginTop: 4 }, businessCard: { backgroundColor: '#fff', borderRadius: 17, padding: 13, flexDirection: 'row', alignItems: 'center', marginTop: 17, borderColor: colors.line, borderWidth: 1 }, storeIcon: { width: 47, height: 47, borderRadius: 15, backgroundColor: '#f4e7d8', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, storeEmoji: { fontSize: 25 }, businessCopy: { flex: 1 }, businessName: { color: colors.ink, fontWeight: '800', fontSize: 14 }, businessLocation: { color: colors.muted, fontSize: 11, marginTop: 3 }, verified: { color: '#568253', marginRight: 4 }, metrics: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 23 }, metric: { flex: 1, backgroundColor: '#f3e8dc', borderRadius: 15, padding: 13 }, metricLabel: { color: '#846d56', fontWeight: '800', letterSpacing: 0.5, fontSize: 8 }, metricValue: { color: colors.brown, fontWeight: '900', fontSize: 21, marginTop: 7 }, metricHint: { color: colors.muted, fontSize: 9, marginTop: 2 }, section: { color: colors.ink, fontWeight: '800', fontSize: 17, marginBottom: 10 }, action: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 15, padding: 12, borderWidth: 1, borderColor: colors.line, marginBottom: 8 }, actionIcon: { color: colors.brown, fontSize: 21, width: 40, height: 40, textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#f6ebdf', overflow: 'hidden', borderRadius: 13, marginRight: 11 }, actionCopy: { flex: 1 }, actionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, actionBody: { color: colors.muted, fontSize: 10, marginTop: 3 }, arrow: { color: colors.brown, fontSize: 23 }, editProfile: { alignItems: 'center', paddingVertical: 14 }, editProfileText: { color: colors.brown, fontSize: 11, fontWeight: '700' }, signOutText: { color: '#a64430', fontSize: 11, fontWeight: '700' }, offline: { color: '#71804e', textAlign: 'center', fontSize: 9, lineHeight: 14, marginTop: 8 } });
