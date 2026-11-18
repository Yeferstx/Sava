import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Megaphone, Minus, Pause, Pencil, Play, Plus, Sprout, Trash2, Wifi } from 'lucide-react-native';
import { getProductImageUri } from '../marketplace/getProductImageUri';
import { FilaEsqueleto } from '../../shared/components/Esqueleto';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import { adjustStock, cambiarEstadoPublicacion, listProducts } from './data/inventoryRepository';
import { getBusinessProfile } from '../business/data/businessRepository';
import type { Product } from './types';
import { colors } from '../../shared/theme';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';
import { compartirCosecha, dinero, textoPrecio } from '../../shared/contacto';
import { vendidoPorProducto, type VendidoPorProducto } from '../sales/data/salesRepository';
import { interesPorProducto, type Interes } from './data/inventoryRepository';
import { useAlVolver } from '../../shared/useAlVolver';

type Props = { onAddProduct: () => void; onEdit: (product: Product) => void; onOpenSales: () => void; onPromocionar?: (product: Product) => void; tipo?: 'agricultor' | 'tienda' };

// mis cosechas: publicaciones del agricultor con su cantidad disponible
export default function InventoryScreen({ onAddProduct, onEdit, onOpenSales, onPromocionar, tipo = 'agricultor' }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendidos, setVendidos] = useState<VendidoPorProducto[]>([]);
  const [finca, setFinca] = useState('');
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todas' | 'publicadas' | 'pausadas' | 'agotadas'>('todas');

  const refresh = useCallback(async () => {
    try {
      setProducts(await listProducts());
      setVendidos(await vendidoPorProducto());
      const perfil = await getBusinessProfile();
      if (perfil) setFinca(perfil.name + ' · ' + perfil.city);
    }
    catch { Alert.alert('No pudimos abrir tus cosechas', 'Intenta de nuevo en un momento.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  // consultas y contactos de cada publicacion (con internet)
  const [interes, setInteres] = useState<Interes | null>(null);
  useEffect(() => { void interesPorProducto().then(setInteres); }, []);
  useAlVolver(() => { void refresh(); void interesPorProducto().then(setInteres); });

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

  let publicadas = 0;
  let pausadas = 0;
  let agotadas = 0;
  for (const product of products) {
    if (product.is_published === 1) publicadas = publicadas + 1;
    else pausadas = pausadas + 1;
    if (product.stock <= 0) agotadas = agotadas + 1;
  }

  const visibles: Product[] = [];
  for (const product of products) {
    if (filtro === 'publicadas' && product.is_published !== 1) continue;
    if (filtro === 'pausadas' && product.is_published === 1) continue;
    if (filtro === 'agotadas' && product.stock > 0) continue;
    visibles.push(product);
  }

  const filtros: Array<{ clave: typeof filtro; texto: string; numero: number }> = [
    { clave: 'todas', texto: 'Todas', numero: products.length },
    { clave: 'publicadas', texto: 'Publicadas', numero: publicadas },
    { clave: 'pausadas', texto: 'Pausadas', numero: pausadas },
    { clave: 'agotadas', texto: 'Agotadas', numero: agotadas },
  ];

  let titulo = 'Mis cosechas';
  if (tipo === 'tienda') titulo = 'Mis productos';

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} tintColor={colors.brown} />}>
      {finca !== '' && <Text style={styles.eyebrow}>{finca.toUpperCase()}</Text>}
      <View style={styles.tituloFila}>
        <Text style={styles.title}>{titulo}</Text>
        <Pressable accessibilityRole="button" onPress={onAddProduct} style={styles.publicar}><Plus size={20} color={colors.white} strokeWidth={2.8} /><Text style={styles.publicarTexto}>Publicar</Text></Pressable>
      </View>
      <View style={styles.escuchar}><BotonEscuchar texto={'Aquí ves lo que tienes publicado. Toca más o menos para cambiar cuánto te queda. Abajo de cada producto puedes editarlo, pausarlo o compartirlo.'} /></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
        {filtros.map((item) => <Pressable key={item.clave} accessibilityRole="button" accessibilityState={{ selected: filtro === item.clave }} onPress={() => setFiltro(item.clave)} style={[styles.filtro, filtro === item.clave && styles.filtroActivo]}>
          <Text style={[styles.filtroTexto, filtro === item.clave && styles.filtroTextoActivo]}>{item.texto}</Text>
          <View style={[styles.filtroNumero, filtro === item.clave && styles.filtroNumeroActivo]}><Text style={[styles.filtroNumeroTexto, filtro === item.clave && styles.filtroNumeroTextoActivo]}>{item.numero}</Text></View>
        </Pressable>)}
      </ScrollView>

      <Pressable accessibilityRole="button" onPress={onOpenSales} style={styles.ventas}>
        <Text style={styles.ventasTexto}>Ver y anotar ventas</Text><ChevronRight size={20} color={colors.verde} />
      </Pressable>

      {loading && products.length === 0 && <><FilaEsqueleto /><FilaEsqueleto /><FilaEsqueleto /></>}

      {visibles.map((product) => {
        let vendido = 0;
        let totalVendido = 0;
        for (const fila of vendidos) {
          if (fila.product_id === product.id) { vendido = fila.vendido; totalVendido = fila.total; }
        }
        const foto = getProductImageUri(product.photo_uri);
        const pausada = product.is_published === 0;
        const agotada = product.stock <= 0;
        // nunca se dice "publicada" si el servidor todavia no la tiene
        const enServidor = !!product.server_updated_at;
        let estado = 'Publicada';
        if (!enServidor && product.sync_status !== 'synced') estado = pausada ? 'Borrador' : 'Pendiente de publicación';
        else if (pausada) estado = 'Pausada';
        if (agotada && estado === 'Publicada') estado = 'Agotada';
        let sync = '';
        if (product.sync_status === 'pending' && enServidor) sync = 'Cambios sin enviar';
        if (product.sync_status === 'conflict') sync = 'Revisa: cambió en otro celular';
        return <View key={product.id} style={[styles.product, pausada && styles.productPausado]}>
          <View style={styles.productTop}>
            <View style={styles.foto}>{foto ? <Image source={{ uri: foto }} style={styles.fotoImagen} /> : <Sprout size={28} color={colors.brown} />}</View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
              <Text style={styles.productPrice}>{textoPrecio(product.price_cop, product.unit)}</Text>
              <View style={styles.badges}>
                <Text style={[styles.badge, (pausada || agotada) && styles.badgePaused]}>{estado}</Text>
                {sync !== '' && <Text style={styles.syncPending}>● {sync}</Text>}
              </View>
            </View>
          </View>

          {/* cantidad grande con botones grandes para restar y sumar */}
          <View style={styles.cantidadFila}>
            <Pressable accessibilityRole="button" accessibilityLabel={'Restar 1 a ' + product.name} disabled={agotada} onPress={() => void changeStock(product, -1)} style={[styles.paso, agotada && styles.pasoApagado]}><Minus size={24} color={colors.verde} strokeWidth={2.8} /></Pressable>
            <View style={styles.cantidadCentro}>
              <Text style={[styles.cantidad, agotada && styles.warning]}>{mostrarCantidad(product.stock)}</Text>
              <Text style={styles.cantidadUnidad}>{textoUnidad(product.stock, product.unit)} quedan</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={'Sumar 1 a ' + product.name} onPress={() => void changeStock(product, 1)} style={styles.paso}><Plus size={24} color={colors.verde} strokeWidth={2.8} /></Pressable>
          </View>
          {!!interes && <Text style={styles.interes}>{(interes[product.id]?.consultas ?? 0) === 1 ? '1 consulta' : (interes[product.id]?.consultas ?? 0) + ' consultas'} · {(interes[product.id]?.contactos ?? 0) === 1 ? '1 contacto por WhatsApp' : (interes[product.id]?.contactos ?? 0) + ' contactos por WhatsApp'}</Text>}
          {vendido > 0 && <Text style={styles.vendido}>Vendiste {mostrarCantidad(vendido)} de {mostrarCantidad(product.stock + vendido)} · {dinero(totalVendido)}</Text>}

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => onEdit(product)} style={styles.action}><Pencil size={20} color={colors.brown} /><Text style={styles.actionText}>Editar</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => pausar(product)} style={styles.action}>{pausada ? <Play size={20} color={colors.brown} /> : <Pause size={20} color={colors.brown} />}<Text style={styles.actionText}>{pausada ? 'Reanudar' : 'Pausar'}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { if (onPromocionar) onPromocionar(product); else void compartirCosecha(product, null); }} style={styles.action}><Megaphone size={20} color={colors.brown} /><Text style={styles.actionText}>Promocionar</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => retirar(product)} style={styles.action}><Trash2 size={20} color="#775D50" /><Text style={[styles.actionText, styles.warning]}>Retirar</Text></Pressable>
          </View>
        </View>;
      })}
      {!loading && products.length === 0 && <View style={styles.emptyBox}><Sprout size={34} color={colors.brown} /><Text style={styles.emptyTitle}>Aún no tienes nada publicado</Text><Text style={styles.empty}>Publica lo que tienes para que los compradores de Casanare lo vean.</Text><Pressable onPress={onAddProduct} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Publicar ahora</Text></Pressable></View>}
      {!loading && products.length > 0 && visibles.length === 0 && <Text style={styles.empty}>No tienes publicaciones en «{filtro}».</Text>}
      <View style={styles.offline}><Wifi size={16} color={colors.muted} /><Text style={styles.offlineText}>Tus cambios se guardan en este celular y se suben solos cuando vuelve la conexión.</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  interes: { color: colors.verde, fontSize: 13, fontWeight: '800', marginTop: 8 },
  flex: { flex: 1 }, content: { padding: 18, paddingTop: 14, paddingBottom: 96 },
  eyebrow: { color: colors.muted, letterSpacing: 1.1, fontSize: 11, fontWeight: '800' },
  tituloFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  publicar: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.verde, borderRadius: 22, paddingHorizontal: 15, paddingVertical: 10 },
  publicarTexto: { color: colors.white, fontSize: 15, fontWeight: '900' },
  escuchar: { marginTop: 10 },
  filtros: { gap: 8, paddingVertical: 14 },
  filtro: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  filtroActivo: { backgroundColor: colors.verde, borderColor: colors.verde },
  filtroTexto: { color: colors.grafito, fontSize: 14, fontWeight: '700' }, filtroTextoActivo: { color: colors.white, fontWeight: '900' },
  filtroNumero: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  filtroNumeroActivo: { backgroundColor: colors.white },
  filtroNumeroTexto: { color: colors.verde, fontSize: 13, fontWeight: '900' }, filtroNumeroTextoActivo: { color: colors.verde },
  ventas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.verdeClaro, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 14 },
  ventasTexto: { color: colors.verde, fontSize: 15, fontWeight: '900' },
  warning: { color: '#775D50' },
  product: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 14, marginBottom: 12 },
  productPausado: { opacity: 0.8 },
  productTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: 72, height: 72, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  fotoImagen: { width: '100%', height: '100%' },
  productInfo: { flex: 1 },
  productName: { color: colors.ink, fontWeight: '900', fontSize: 18 },
  productPrice: { color: colors.verde, fontSize: 14, fontWeight: '800', marginTop: 3 },
  badges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  badge: { color: colors.brown, backgroundColor: colors.verdeClaro, fontSize: 12, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9, overflow: 'hidden' },
  badgePaused: { color: '#775D50', backgroundColor: '#F5E7E2' },
  syncPending: { color: '#775D50', fontSize: 12, fontWeight: '700' },
  cantidadFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.crema, borderRadius: 18, padding: 8, marginTop: 12 },
  paso: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.verde, alignItems: 'center', justifyContent: 'center' },
  pasoApagado: { opacity: 0.35 },
  cantidadCentro: { alignItems: 'center' },
  cantidad: { color: colors.grafito, fontSize: 30, fontWeight: '900' },
  cantidadUnidad: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  vendido: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line, marginTop: 12, paddingTop: 10 },
  action: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  actionText: { color: colors.brown, fontSize: 12, fontWeight: '800' },
  emptyBox: { alignItems: 'center', gap: 10, padding: 24, backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyButton: { backgroundColor: colors.brown, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12 }, emptyButtonText: { color: colors.white, fontWeight: '900', fontSize: 15 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: colors.verdeClaro, borderRadius: 13, padding: 12 },
  offlineText: { color: colors.muted, fontSize: 12, lineHeight: 17, flex: 1 },
});
