import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native';
import VisorReporte from '../cuaderno/VisorReporte';
import { ArrowRight, Bell, FileText, CircleDollarSign, ClipboardList, GraduationCap, NotebookPen, Sparkles, Sprout, Store } from 'lucide-react-native';
import EstadoSincronizacion from '../../shared/components/EstadoSincronizacion';
import FotoPerfil from '../../shared/components/FotoPerfil';
import { CATEGORIA_TIENDA } from '../../shared/roles';
import { contarPendientes, listProducts } from '../inventory/data/inventoryRepository';
import { listSales } from '../sales/data/salesRepository';
import { getBusinessProfile } from '../business/data/businessRepository';
import { syncPendingChanges } from '../../infrastructure/sync/syncService';
import type { AppTab } from '../../navigation/types';
import { colors } from '../../shared/theme';
import { dinero } from '../../shared/contacto';
import ApoyoGobernacion from '../../shared/components/ApoyoGobernacion';
import BotonEscuchar from '../../shared/components/BotonEscuchar';

type Props = { onNavigate: (tab: AppTab) => void; onEditFinca: () => void; onSignOut?: () => void; onLegal: () => void; tipo?: 'agricultor' | 'tienda'; porConfirmar?: number; onConfirmarVentas?: () => void; sinLeer?: number; consultasNuevas?: number; negocios?: Array<{ id: string; name: string; category: string }>; onCambiarNegocio?: (id: string) => void; onAgregarNegocio?: (tipo: 'agricultor' | 'tienda') => void };

// panel del agricultor: accesos rapidos y un resumen corto, sin graficas
export default function BusinessDashboardScreen({ onNavigate, onEditFinca, onSignOut, onLegal, tipo = 'agricultor', porConfirmar = 0, onConfirmarVentas, sinLeer = 0, consultasNuevas = 0, negocios = [], onCambiarNegocio, onAgregarNegocio }: Props) {
  const esTienda = tipo === 'tienda';
  const [activas, setActivas] = useState(0);
  const [ventasSemana, setVentasSemana] = useState(0);
  const [pendientes, setPendientes] = useState(0);
  const [finca, setFinca] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [verReporte, setVerReporte] = useState(false);

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

  // lo principal arriba y grande. publicar ya esta en la barra de abajo, no se repite aqui
  const principales: Array<{ tab: AppTab; titulo: string; texto: string; Icon: typeof Sprout; numero?: number }> = [
    { tab: 'Cuaderno', titulo: 'Mi cuaderno', texto: 'Ventas, gastos y cobros. Sin internet también', Icon: NotebookPen },
    { tab: 'Inventario', titulo: esTienda ? 'Mis productos' : 'Mis cosechas', texto: activas === 1 ? '1 publicada' : activas + ' publicadas', Icon: Sprout },
    { tab: 'Pedidos', titulo: 'Consultas de compradores', texto: consultasNuevas > 0 ? (consultasNuevas === 1 ? '1 consulta nueva' : consultasNuevas + ' consultas nuevas') : 'Personas interesadas en lo tuyo', Icon: ClipboardList, numero: consultasNuevas },
  ];
  const atajos: Array<{ tab: AppTab; titulo: string; texto: string; Icon: typeof Sprout }> = [
    { tab: 'Ventas', titulo: 'Ventas registradas', texto: 'Lo que has vendido', Icon: CircleDollarSign },
    { tab: 'María', titulo: 'Hablar con Aru', texto: 'Publica, anota ventas y gastos, pregunta tus cuentas', Icon: Sparkles },
    { tab: 'Aprende', titulo: 'Aprende con Sava', texto: 'Fotos, descripciones, costos y cuentas', Icon: GraduationCap },
    { tab: 'Explorar', titulo: esTienda ? 'Ver el mercado' : 'Comprar insumos', texto: esTienda ? 'Mira lo que se vende en Casanare' : 'Semillas, abonos y herramientas', Icon: Store },
  ];


  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={colors.brown} />}>
    <View style={styles.cabecera}>
      <View style={styles.flex}><FotoPerfil subtitulo={finca !== '' ? finca + (municipio !== '' ? ' · ' + municipio : '') : ''} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={sinLeer > 0 ? sinLeer + ' notificaciones sin leer' : 'Notificaciones'} onPress={() => onNavigate('Notificaciones')} style={styles.campana}>
        <Bell size={22} color={colors.verde} />
        {sinLeer > 0 && <View style={styles.insignia}><Text style={styles.insigniaTexto}>{sinLeer > 9 ? '9+' : sinLeer}</Text></View>}
      </Pressable>
    </View>
    <Text style={styles.eyebrow}>MI NEGOCIO</Text>
    <Text style={styles.title}>{finca !== '' ? finca : 'Mi negocio'}</Text>
    {municipio !== '' && <Text style={styles.place}>{municipio}, Casanare</Text>}
    <Text style={styles.motto}>{esTienda ? 'Lleva tus productos a los campesinos de Casanare.' : 'Tu cosecha merece encontrar compradores.'}</Text>
    <View style={styles.escuchar}><BotonEscuchar texto={'Aquí ves lo que tienes publicado y tus ventas. Toca un botón grande para publicar, ver tus productos, anotar una venta o hablar con Aru.'} /></View>

    {porConfirmar > 0 && !!onConfirmarVentas && <Pressable accessibilityRole="button" onPress={onConfirmarVentas} style={styles.confirmar}>
      <View style={styles.confirmarNumero}><Text style={styles.confirmarNumeroTexto}>{porConfirmar}</Text></View>
      <View style={styles.flex}><Text style={styles.confirmarTitulo}>{porConfirmar === 1 ? 'Una venta por confirmar' : porConfirmar + ' ventas por confirmar'}</Text><Text style={styles.confirmarTexto}>Cuéntale a Aru qué pasó con las personas que te escribieron.</Text></View>
      <ArrowRight size={20} color={colors.grafito} />
    </Pressable>}
    <View style={styles.metrics}>
      <View style={styles.metric}><Text style={styles.metricLabel}>{esTienda ? 'PRODUCTOS PUBLICADOS' : 'COSECHAS PUBLICADAS'}</Text><Text style={styles.metricValue}>{activas}</Text></View>
      <View style={styles.metric}><Text style={styles.metricLabel}>VENTAS 7 DÍAS</Text><Text style={styles.metricValue}>{dinero(ventasSemana)}</Text></View>
    </View>

    {/* finca y tienda en la misma cuenta: cada una lleva sus propias cuentas */}
    {(negocios.length > 1 || !!onAgregarNegocio) && <View style={styles.negocios}>
      {negocios.length > 1 && negocios.map((n) => {
        const esActivo = n.name === finca;
        return <Pressable key={n.id} accessibilityRole="button" accessibilityState={{ selected: esActivo }} disabled={esActivo || !onCambiarNegocio} onPress={() => { if (onCambiarNegocio) onCambiarNegocio(n.id); }} style={[styles.negocio, esActivo && styles.negocioActivo]}>
          {n.category === CATEGORIA_TIENDA ? <Store size={16} color={esActivo ? colors.white : colors.verde} /> : <Sprout size={16} color={esActivo ? colors.white : colors.verde} />}
          <Text style={[styles.negocioTexto, esActivo && styles.negocioTextoActivo]} numberOfLines={1}>{n.name}</Text>
        </Pressable>;
      })}
      {negocios.length < 2 && !!onAgregarNegocio && <Pressable accessibilityRole="button" onPress={() => onAgregarNegocio(esTienda ? 'agricultor' : 'tienda')} style={styles.agregar}>
        <Text style={styles.agregarTexto}>{esTienda ? '¿También tienes finca? Agrégala' : '¿También tienes una tienda del campo? Agrégala'}</Text>
      </Pressable>}
    </View>}
    <View style={styles.estado}><EstadoSincronizacion alCambiar={() => void refresh()} /></View>

    <View style={styles.principales}>
      {principales.map((p, i) => <Pressable key={p.tab} accessibilityRole="button" onPress={() => onNavigate(p.tab)} style={({ pressed }) => [styles.principal, i === 0 && styles.principalAncho, pressed && styles.presionado]}>
        <View style={styles.principalIcono}><p.Icon size={22} color={colors.verde} />{!!p.numero && <View style={styles.insignia}><Text style={styles.insigniaTexto}>{p.numero > 9 ? '9+' : p.numero}</Text></View>}</View>
        <Text style={styles.principalTitulo}>{p.titulo}</Text>
        <Text style={styles.principalTexto}>{p.texto}</Text>
      </Pressable>)}
    </View>
    {/* reporte del mes en pdf (con los datos del cuaderno de este celular) */}
    <Pressable accessibilityRole="button" onPress={() => setVerReporte(true)} style={({ pressed }) => [styles.reporte, pressed && styles.presionado]}>
      <View style={styles.reporteIcono}><FileText size={22} color={colors.white} /></View>
      <View style={styles.flex}><Text style={styles.reporteTitulo}>Reporte de mi negocio</Text><Text style={styles.reporteTexto}>Así va tu negocio este mes: míralo aquí y descárgalo en PDF</Text></View>
      <ArrowRight size={18} color={colors.white} />
    </Pressable>
    <Text style={styles.mas}>Más opciones</Text>
    {atajos.map((atajo) => <Pressable key={atajo.tab} accessibilityRole="button" onPress={() => onNavigate(atajo.tab)} style={styles.action}>
      <View style={styles.actionIcon}><atajo.Icon size={21} color={colors.brown} /></View>
      <View style={styles.flex}><Text style={styles.actionTitle}>{atajo.titulo}</Text><Text style={styles.actionBody}>{atajo.texto}</Text></View>
      <ArrowRight size={18} color={colors.brown} />
    </Pressable>)}

    <Pressable onPress={onEditFinca} style={styles.link}><Text style={styles.linkText}>Editar información del negocio</Text></Pressable>
    <Pressable onPress={onLegal} style={styles.link}><Text style={styles.linkText}>Tus datos y privacidad</Text></Pressable>
    {!!onSignOut && <Pressable onPress={onSignOut} style={styles.link}><Text style={styles.signOutText}>Cerrar sesión</Text></Pressable>}
    <ApoyoGobernacion conMapa />
    <VisorReporte visible={verReporte} periodo="mes" tipo={esTienda ? 'tienda' : 'agricultor'} onCerrar={() => setVerReporte(false)} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 20, paddingTop: 14, paddingBottom: 96 },
  eyebrow: { color: colors.muted, fontSize: 11, letterSpacing: 1.2, fontWeight: '800' }, title: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 4 },
  place: { color: colors.muted, fontSize: 13, marginTop: 2 }, motto: { color: colors.brown, fontSize: 14, fontWeight: '700', marginTop: 10 }, escuchar: { marginTop: 10 },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 18 },
  confirmar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.arcilla, borderRadius: 18, padding: 14, marginTop: 16 },
  confirmarNumero: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  confirmarNumeroTexto: { color: colors.grafito, fontSize: 18, fontWeight: '900' },
  confirmarTitulo: { color: colors.grafito, fontSize: 16, fontWeight: '900' }, confirmarTexto: { color: colors.grafito, fontSize: 13, marginTop: 2 },
  metric: { flex: 1, borderRadius: 17, padding: 14, backgroundColor: colors.brown }, metricLabel: { color: colors.verdeClaro, fontSize: 10, letterSpacing: 0.8, fontWeight: '800' }, metricValue: { color: colors.white, fontSize: 22, fontWeight: '900', marginTop: 6 },
  estado: { marginTop: 12, marginBottom: 6 },
  reporte: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.verde, marginTop: 4, marginBottom: 2 },
  reporteIcono: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(240,233,223,0.18)', alignItems: 'center', justifyContent: 'center' },
  reporteTitulo: { color: colors.white, fontSize: 16, fontWeight: '900' },
  reporteTexto: { color: colors.verdeClaro, fontSize: 12, marginTop: 2 },
  negocios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  negocio: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, maxWidth: '100%' },
  negocioActivo: { backgroundColor: colors.verde, borderColor: colors.verde },
  negocioTexto: { color: colors.verde, fontSize: 13, fontWeight: '800', flexShrink: 1 },
  negocioTextoActivo: { color: colors.white },
  agregar: { paddingVertical: 6 },
  agregarTexto: { color: colors.verde, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  campana: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  insignia: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.arcilla, alignItems: 'center', justifyContent: 'center' },
  insigniaTexto: { color: colors.grafito, fontSize: 11, fontWeight: '900' },
  principales: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  principal: { flexGrow: 1, flexBasis: '45%', padding: 14, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  principalAncho: { flexBasis: '100%', backgroundColor: colors.salvia, borderColor: colors.salvia },
  principalIcono: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  principalTitulo: { color: colors.grafito, fontSize: 16, fontWeight: '900' },
  principalTexto: { color: colors.muted, fontSize: 13, marginTop: 2 },
  presionado: { transform: [{ scale: 0.97 }] },
  mas: { color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 12, marginBottom: 8 },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 14, backgroundColor: colors.verdeClaro, marginTop: 12, marginBottom: 14 },
  syncPending: { backgroundColor: '#F5E7E2' }, syncText: { flex: 1, color: colors.brown, fontSize: 13, fontWeight: '700' }, syncTextPending: { color: '#775D50' }, syncAction: { color: '#775D50', fontSize: 13, fontWeight: '900' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginBottom: 9 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, actionBody: { color: colors.muted, fontSize: 12, marginTop: 2 },
  link: { alignItems: 'center', padding: 13 }, linkText: { color: colors.brown, fontWeight: '700', fontSize: 13 }, signOutText: { color: '#775D50', fontWeight: '700', fontSize: 13 },
});
