import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, CircleDollarSign, ClipboardList, CloudUpload, PackagePlus, Sparkles, Sprout, Store } from 'lucide-react-native';
import { contarPendientes, listProducts } from '../inventory/data/inventoryRepository';
import { listSales } from '../sales/data/salesRepository';
import { getBusinessProfile } from '../business/data/businessRepository';
import { syncPendingChanges } from '../../infrastructure/sync/syncService';
import type { AppTab } from '../../navigation/types';
import { colors } from '../../shared/theme';
import { dinero } from '../../shared/contacto';
import ApoyoGobernacion from '../../shared/components/ApoyoGobernacion';
import BotonEscuchar from '../../shared/components/BotonEscuchar';

type Props = { onNavigate: (tab: AppTab) => void; onEditFinca: () => void; onSignOut?: () => void; onLegal: () => void; tipo?: 'agricultor' | 'tienda' };

// panel del agricultor: accesos rapidos y un resumen corto, sin graficas
export default function BusinessDashboardScreen({ onNavigate, onEditFinca, onSignOut, onLegal, tipo = 'agricultor' }: Props) {
  const esTienda = tipo === 'tienda';
  const [activas, setActivas] = useState(0);
  const [ventasSemana, setVentasSemana] = useState(0);
  const [pendientes, setPendientes] = useState(0);
  const [finca, setFinca] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [sincronizando, setSincronizando] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const products = await listProducts();
      const sales = await listSales();
      const perfil = await getBusinessProfile();
      let publicadas = 0;
      for (const product of products) {
        if (product.is_published === 1 && product.stock > 0) publicadas = publicadas + 1;
      }
      // ventas de los ultimos 7 dias
      const hace7Dias = Date.now() - 7 * 24 * 60 * 60 * 1000;
      let total = 0;
      for (const sale of sales) {
        if (new Date(sale.sold_at).getTime() >= hace7Dias) total = total + sale.total_cop;
      }
      setActivas(publicadas);
      setVentasSemana(total);
      setPendientes(await contarPendientes());
      if (perfil) { setFinca(perfil.name); setMunicipio(perfil.city); }
    } catch { Alert.alert('No pudimos cargar el resumen', 'Intenta otra vez.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function sincronizar() {
    setSincronizando(true);
    try {
      const resultado = await syncPendingChanges();
      if (resultado.reason === 'not-configured') Alert.alert('Sin servidor', 'Sava no está conectada a Supabase en este celular.');
      await refresh();
    } catch {
      Alert.alert('No se pudo sincronizar', 'Revisa tu conexión a internet. Tus cambios siguen guardados en el celular.');
    } finally { setSincronizando(false); }
  }

  const atajos: Array<{ tab: AppTab; titulo: string; texto: string; Icon: typeof Sprout }> = [
    { tab: 'Publicar', titulo: esTienda ? 'Publicar producto' : 'Publicar cosecha', texto: 'Muestra lo que tienes disponible', Icon: PackagePlus },
    { tab: 'Inventario', titulo: esTienda ? 'Mis productos' : 'Mis cosechas', texto: 'Cantidades, precios y publicaciones', Icon: Sprout },
    { tab: 'Ventas', titulo: 'Ventas registradas', texto: 'Anota lo que vendiste', Icon: CircleDollarSign },
    { tab: 'Pedidos', titulo: 'Consultas de compradores', texto: 'Solicitudes que te enviaron en Sava', Icon: ClipboardList },
    { tab: 'María', titulo: 'Hablar con María', texto: 'Publica, anota ventas y pregunta tu inventario', Icon: Sparkles },
    { tab: 'Explorar', titulo: esTienda ? 'Ver el mercado' : 'Comprar insumos', texto: esTienda ? 'Mira lo que se vende en Casanare' : 'Semillas, abonos y herramientas', Icon: Store },
  ];

  let textoPendientes = 'Todo está sincronizado';
  if (pendientes === 1) textoPendientes = '1 cambio pendiente de sincronizar';
  if (pendientes > 1) textoPendientes = pendientes + ' cambios pendientes de sincronizar';

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={colors.brown} />}>
    <Text style={styles.eyebrow}>{esTienda ? 'PANEL DE LA TIENDA' : 'PANEL DEL CAMPESINO'}</Text>
    <Text style={styles.title}>{finca !== '' ? finca : esTienda ? 'Mi tienda' : 'Mi finca'}</Text>
    {municipio !== '' && <Text style={styles.place}>{municipio}, Casanare</Text>}
    <Text style={styles.motto}>{esTienda ? 'Lleva tus productos a los campesinos de Casanare.' : 'Tu cosecha merece encontrar compradores.'}</Text>
    <View style={styles.escuchar}><BotonEscuchar texto={'Aquí ves lo que tienes publicado y tus ventas. Toca un botón grande para publicar, ver tus productos, anotar una venta o hablar con María.'} /></View>

    <View style={styles.metrics}>
      <View style={styles.metric}><Text style={styles.metricLabel}>{esTienda ? 'PRODUCTOS PUBLICADOS' : 'COSECHAS PUBLICADAS'}</Text><Text style={styles.metricValue}>{activas}</Text></View>
      <View style={styles.metric}><Text style={styles.metricLabel}>VENTAS 7 DÍAS</Text><Text style={styles.metricValue}>{dinero(ventasSemana)}</Text></View>
    </View>

    <Pressable accessibilityRole="button" disabled={pendientes === 0 || sincronizando} onPress={() => void sincronizar()} style={[styles.sync, pendientes > 0 && styles.syncPending]}>
      <CloudUpload size={18} color={pendientes > 0 ? '#775D50' : colors.brown} />
      <Text style={[styles.syncText, pendientes > 0 && styles.syncTextPending]}>{sincronizando ? 'Sincronizando…' : textoPendientes}</Text>
      {pendientes > 0 && !sincronizando && <Text style={styles.syncAction}>Sincronizar</Text>}
    </Pressable>

    {atajos.map((atajo) => <Pressable key={atajo.tab} accessibilityRole="button" onPress={() => onNavigate(atajo.tab)} style={styles.action}>
      <View style={styles.actionIcon}><atajo.Icon size={21} color={colors.brown} /></View>
      <View style={styles.flex}><Text style={styles.actionTitle}>{atajo.titulo}</Text><Text style={styles.actionBody}>{atajo.texto}</Text></View>
      <ArrowRight size={18} color={colors.brown} />
    </Pressable>)}

    <Pressable onPress={onEditFinca} style={styles.link}><Text style={styles.linkText}>{esTienda ? 'Editar información de la tienda' : 'Editar información de la finca'}</Text></Pressable>
    <Pressable onPress={onLegal} style={styles.link}><Text style={styles.linkText}>Privacidad y términos de uso</Text></Pressable>
    {!!onSignOut && <Pressable onPress={onSignOut} style={styles.link}><Text style={styles.signOutText}>Cerrar sesión</Text></Pressable>}
    <ApoyoGobernacion conMapa />
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 20, paddingTop: 38, paddingBottom: 96 },
  eyebrow: { color: colors.muted, fontSize: 11, letterSpacing: 1.2, fontWeight: '800' }, title: { color: colors.ink, fontSize: 27, fontWeight: '900', marginTop: 4 },
  place: { color: colors.muted, fontSize: 13, marginTop: 2 }, motto: { color: colors.brown, fontSize: 14, fontWeight: '700', marginTop: 10 }, escuchar: { marginTop: 10 },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 18 },
  metric: { flex: 1, borderRadius: 17, padding: 14, backgroundColor: colors.brown }, metricLabel: { color: colors.verdeClaro, fontSize: 10, letterSpacing: 0.8, fontWeight: '800' }, metricValue: { color: colors.white, fontSize: 22, fontWeight: '900', marginTop: 6 },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 14, backgroundColor: colors.verdeClaro, marginTop: 12, marginBottom: 14 },
  syncPending: { backgroundColor: '#F5E7E2' }, syncText: { flex: 1, color: colors.brown, fontSize: 13, fontWeight: '700' }, syncTextPending: { color: '#775D50' }, syncAction: { color: '#775D50', fontSize: 13, fontWeight: '900' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginBottom: 9 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, actionBody: { color: colors.muted, fontSize: 12, marginTop: 2 },
  link: { alignItems: 'center', padding: 13 }, linkText: { color: colors.brown, fontWeight: '700', fontSize: 13 }, signOutText: { color: '#775D50', fontWeight: '700', fontSize: 13 },
});
