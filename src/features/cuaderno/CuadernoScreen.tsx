import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, HandCoins, PackageMinus, PackagePlus, Receipt, ShoppingBag, Wheat } from 'lucide-react-native';
import { colors } from '../../shared/theme';
import { dinero } from '../../shared/contacto';
import { leerCantidad, leerPrecio, mostrarCantidad, tecladoCantidad, textoUnidad } from '../../shared/validaciones';
import { listProducts } from '../inventory/data/inventoryRepository';
import { recordSale } from '../sales/data/salesRepository';
import type { Product } from '../inventory/types';
import EstadoSincronizacion from '../../shared/components/EstadoSincronizacion';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import { useEspacioTeclado } from '../../shared/useEspacioTeclado';
import { listarMovimientos, registrarCobro, registrarCompra, registrarCosecha, registrarGasto, registrarPerdida, resumenCuentas, ventasPorCobrar, type Movimiento, type Periodo, type TipoMovimiento, type VentaPorCobrar } from './cuadernoRepository';

type Props = { onBack: () => void; onNuevaCosecha: () => void; tipo?: 'agricultor' | 'tienda' };

const acciones: Array<{ tipo: TipoMovimiento; titulo: string; Icono: typeof Wheat }> = [
  { tipo: 'cosecha', titulo: 'Cosecha', Icono: Wheat },
  { tipo: 'venta', titulo: 'Venta', Icono: ShoppingBag },
  { tipo: 'gasto', titulo: 'Gasto', Icono: Receipt },
  { tipo: 'perdida', titulo: 'Pérdida', Icono: PackageMinus },
  { tipo: 'cobro', titulo: 'Cobro', Icono: HandCoins },
];

// la finca gasta en producir; la tienda en tener el local abierto (la mercancia va en «Compra»)
const conceptosFinca = ['Abono', 'Jornal', 'Transporte', 'Semillas', 'Empaques', 'Fumigación'];
const conceptosTienda = ['Arriendo', 'Transporte', 'Servicios', 'Empleados', 'Empaques', 'Impuestos'];
const accionesTienda: typeof acciones = [
  { tipo: 'compra', titulo: 'Compra', Icono: PackagePlus },
  { tipo: 'venta', titulo: 'Venta', Icono: ShoppingBag },
  { tipo: 'gasto', titulo: 'Gasto', Icono: Receipt },
  { tipo: 'perdida', titulo: 'Pérdida', Icono: PackageMinus },
  { tipo: 'cobro', titulo: 'Cobro', Icono: HandCoins },
];
const periodos: Array<{ valor: Periodo; texto: string }> = [{ valor: 'hoy', texto: 'Hoy' }, { valor: 'semana', texto: '7 días' }, { valor: 'mes', texto: 'Este mes' }, { valor: 'todo', texto: 'Todo' }];

const nombreTipo: Record<string, string> = { cosecha: 'Cosecha', venta: 'Venta', gasto: 'Gasto', perdida: 'Pérdida', cobro: 'Cobro', compra: 'Compra' };

function estadoTexto(estado: string) {
  if (estado === 'synced' || estado === 'historial') return { texto: 'Guardado en el servidor', estilo: styles.badgeOk };
  if (estado === 'error') return { texto: 'Error, se reintentará', estilo: styles.badgeError };
  return { texto: 'Solo en este celular', estilo: styles.badgePendiente };
}

// cuaderno del campo: funciona sin internet. todo se guarda en el celular y se sincroniza despues
export default function CuadernoScreen({ onBack, onNuevaCosecha, tipo = 'agricultor' }: Props) {
  const esTienda = tipo === 'tienda';
  const conceptos = esTienda ? conceptosTienda : conceptosFinca;
  const botones = esTienda ? accionesTienda : acciones;
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [resumen, setResumen] = useState({ vendido: 0, recibido: 0, gastos: 0, compras: 0, ganancia: 0, ventasConCosto: 0, ventasSinCosto: 0, porCobrar: 0, balance: 0 });
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [deudas, setDeudas] = useState<VentaPorCobrar[]>([]);
  const [formulario, setFormulario] = useState<TipoMovimiento | null>(null);
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [fiada, setFiada] = useState(false);
  const [ventaId, setVentaId] = useState('');
  const teclaEspacio = useEspacioTeclado();

  const refrescar = useCallback(async () => {
    try {
      setResumen(await resumenCuentas(periodo));
      setMovimientos(await listarMovimientos());
      setProductos(await listProducts());
      setDeudas(await ventasPorCobrar());
    } catch { /* se intenta de nuevo al volver */ }
  }, [periodo]);
  useEffect(() => { void refrescar(); }, [refrescar]);

  function abrir(tipo: TipoMovimiento) {
    setFormulario(formulario === tipo ? null : tipo);
    setProductoId(''); setCantidad(''); setMonto(''); setNota(''); setFiada(false); setVentaId('');
  }

  const producto = productos.find((p) => p.id === productoId);

  // siempre se confirma antes de guardar
  function confirmar(texto: string, guardar: () => Promise<unknown>) {
    Alert.alert('¿Lo anoto?', texto, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, anotar', onPress: async () => {
        try { await guardar(); setFormulario(null); await refrescar(); }
        catch (error) { Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Intenta de nuevo.'); }
      } },
    ]);
  }

  function guardar() {
    if (formulario === 'gasto') {
      const valor = leerPrecio(monto);
      if (valor <= 0) { Alert.alert('Revisa el valor', 'Escribe cuánto gastaste, por ejemplo 80.000.'); return; }
      confirmar('Gasto de ' + dinero(valor) + ' en ' + (nota.trim() || 'sin detalle') + '.', () => registrarGasto(valor, nota));
      return;
    }
    if (formulario === 'cobro') {
      const deuda = deudas.find((d) => d.id === ventaId);
      const valor = leerPrecio(monto);
      if (!deuda) { Alert.alert('Elige la venta', 'Toca la venta que te pagaron.'); return; }
      if (valor <= 0) { Alert.alert('Revisa el valor', 'Escribe cuánto te pagaron.'); return; }
      confirmar('Te pagaron ' + dinero(valor) + ' de la venta de ' + deuda.producto + (deuda.persona ? ' (' + deuda.persona + ')' : '') + '.', () => registrarCobro(deuda.id, valor));
      return;
    }
    if (!producto) { Alert.alert('Elige el producto', 'Toca el producto de la lista.'); return; }
    const numero = leerCantidad(cantidad);
    if (numero <= 0) { Alert.alert('Revisa la cantidad', 'Escribe la cantidad con números, por ejemplo 100.'); return; }
    const medida = mostrarCantidad(numero) + ' ' + textoUnidad(numero, producto.unit) + ' de ' + producto.name;
    if (formulario === 'compra') {
      const costo = leerPrecio(monto);
      if (costo <= 0) { Alert.alert('Falta el costo', 'Escribe cuánto pagaste en total por esa mercancía.'); return; }
      confirmar('Compra de ' + medida + ' por ' + dinero(costo) + ' (' + dinero(Math.round(costo / numero)) + ' cada ' + producto.unit + '). Te quedarían ' + mostrarCantidad(producto.stock + numero) + ' ' + textoUnidad(producto.stock + numero, producto.unit) + '.', () => registrarCompra(producto.id, numero, costo, nota));
      return;
    }
    if (formulario === 'cosecha') {
      confirmar('Cosecha de ' + medida + '. Te quedarían ' + mostrarCantidad(producto.stock + numero) + ' ' + textoUnidad(producto.stock + numero, producto.unit) + '.', () => registrarCosecha(producto.id, numero, nota));
      return;
    }
    if (formulario === 'perdida') {
      confirmar('Pérdida de ' + medida + '. Te quedarían ' + mostrarCantidad(producto.stock - numero) + ' ' + textoUnidad(producto.stock - numero, producto.unit) + '.', () => registrarPerdida(producto.id, numero, nota));
      return;
    }
    // venta
    let precio = producto.price_cop;
    if (monto.trim() !== '') precio = leerPrecio(monto);
    if (precio <= 0) { Alert.alert('Falta el precio', 'Escribe a cómo vendiste cada ' + producto.unit + '.'); return; }
    const total = Math.round(precio * numero);
    confirmar('Venta de ' + medida + ' por ' + dinero(total) + (fiada ? ', fiada (te la deben)' : ', pagada') + '. Te quedarían ' + mostrarCantidad(producto.stock - numero) + ' ' + textoUnidad(producto.stock - numero, producto.unit) + '.', () => recordSale(producto.id, numero, precio, !fiada, nota.trim()));
  }

  const necesitaProducto = formulario === 'cosecha' || formulario === 'venta' || formulario === 'perdida' || formulario === 'compra';

  return (
    <View ref={teclaEspacio.ref} onLayout={teclaEspacio.medir} style={[styles.flex, { paddingBottom: teclaEspacio.espacio }]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.volver}><ArrowLeft size={20} color={colors.verde} /><Text style={styles.volverTexto}>Volver</Text></Pressable>
        <Text style={styles.titulo}>Mi cuaderno</Text>
        <Text style={styles.subtitulo}>{esTienda ? 'Anota compras de mercancía, ventas, gastos y cobros. Funciona sin internet.' : 'Anota cosechas, ventas, gastos y cobros. Funciona sin internet.'}</Text>
        <View style={styles.escuchar}><BotonEscuchar texto="Aquí anotas lo que pasa en tu finca: cosechas, ventas, gastos, pérdidas y cobros. Todo se guarda en tu celular aunque no tengas señal, y se envía cuando vuelva el internet." /></View>
        <EstadoSincronizacion alCambiar={() => void refrescar()} />

        <View style={styles.periodos}>{periodos.map((p) => <Pressable key={p.valor} onPress={() => setPeriodo(p.valor)} style={[styles.periodo, periodo === p.valor && styles.periodoActivo]}><Text style={[styles.periodoTexto, periodo === p.valor && styles.periodoTextoActivo]}>{p.texto}</Text></Pressable>)}</View>
        <View style={styles.resumen}>
          <View style={[styles.cifra, styles.cifraFuerte]}><Text style={styles.cifraEtiquetaClara}>DINERO RECIBIDO</Text><Text style={styles.cifraValorClaro}>{dinero(resumen.recibido)}</Text></View>
          {esTienda && <View style={styles.cifra}><Text style={styles.cifraEtiqueta}>COMPRAS DE MERCANCÍA</Text><Text style={styles.cifraValor}>{dinero(resumen.compras)}</Text></View>}
          {esTienda && <View style={styles.cifra}><Text style={styles.cifraEtiqueta}>GANANCIA EN VENTAS</Text><Text style={[styles.cifraValor, resumen.ganancia < 0 && styles.negativo]}>{dinero(resumen.ganancia)}</Text></View>}
          <View style={styles.cifra}><Text style={styles.cifraEtiqueta}>{esTienda ? 'OTROS GASTOS' : 'GASTOS'}</Text><Text style={styles.cifraValor}>{dinero(resumen.gastos)}</Text></View>
          <View style={styles.cifra}><Text style={styles.cifraEtiqueta}>TE DEBEN</Text><Text style={styles.cifraValor}>{dinero(resumen.porCobrar)}</Text></View>
          <View style={styles.cifra}><Text style={styles.cifraEtiqueta}>BALANCE</Text><Text style={[styles.cifraValor, resumen.balance < 0 && styles.negativo]}>{dinero(resumen.balance)}</Text></View>
        </View>
        <Text style={styles.nota}>Lo que te deben no se cuenta como dinero recibido hasta que lo cobres.{esTienda ? ' La ganancia es lo que vendiste menos lo que te costó esa mercancía.' + (resumen.ventasSinCosto > 0 ? ' ' + resumen.ventasSinCosto + (resumen.ventasSinCosto === 1 ? ' venta no tiene' : ' ventas no tienen') + ' costo: anota la compra de ese producto.' : '') : ''}</Text>

        <Text style={styles.seccion}>Anotar</Text>
        <View style={styles.acciones}>
          {botones.map((a) => <Pressable key={a.tipo} accessibilityRole="button" accessibilityLabel={'Anotar ' + a.titulo} onPress={() => abrir(a.tipo)} style={({ pressed }) => [styles.accion, formulario === a.tipo && styles.accionActiva, pressed && styles.presionado]}>
            <a.Icono size={22} color={formulario === a.tipo ? colors.white : colors.verde} />
            <Text style={[styles.accionTexto, formulario === a.tipo && styles.accionTextoActivo]}>{a.titulo}</Text>
          </Pressable>)}
        </View>

        {formulario !== null && <View style={styles.formulario}>
          {necesitaProducto && <>
            <Text style={styles.etiqueta}>¿De qué producto?</Text>
            {productos.length === 0 ? <Pressable onPress={onNuevaCosecha} style={styles.vacio}><Text style={styles.vacioTexto}>Todavía no tienes productos. Toca aquí para registrar tu primera cosecha.</Text></Pressable> :
              <View style={styles.chips}>{productos.map((p) => <Pressable key={p.id} onPress={() => setProductoId(p.id)} style={[styles.chip, productoId === p.id && styles.chipActivo]}><Text style={[styles.chipTexto, productoId === p.id && styles.chipTextoActivo]}>{p.name} · {mostrarCantidad(p.stock)} {p.unit}</Text></Pressable>)}</View>}
            {(formulario === 'cosecha' || formulario === 'compra') && <Pressable onPress={onNuevaCosecha}><Text style={styles.enlace}>¿Es un producto nuevo? Regístralo aquí</Text></Pressable>}
            <Text style={styles.etiqueta}>Cantidad{producto ? ' (' + textoUnidad(2, producto.unit) + ')' : ''}</Text>
            <TextInput value={cantidad} onChangeText={setCantidad} placeholder="Ej. 100" placeholderTextColor={colors.muted} keyboardType={tecladoCantidad(producto ? producto.unit : 'kg')} style={styles.input} maxLength={10} />
          </>}
          {formulario === 'venta' && <>
            <Text style={styles.etiqueta}>Precio por {producto ? producto.unit : 'unidad'}{producto && producto.price_cop > 0 ? ' (vacío = ' + dinero(producto.price_cop) + ')' : ''}</Text>
            <TextInput value={monto} onChangeText={setMonto} placeholder="Ej. 2.500" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} maxLength={13} />
            <View style={styles.chips}>
              <Pressable onPress={() => setFiada(false)} style={[styles.chip, !fiada && styles.chipActivo]}><Text style={[styles.chipTexto, !fiada && styles.chipTextoActivo]}>Me pagaron</Text></Pressable>
              <Pressable onPress={() => setFiada(true)} style={[styles.chip, fiada && styles.chipActivo]}><Text style={[styles.chipTexto, fiada && styles.chipTextoActivo]}>Quedó debiendo</Text></Pressable>
            </View>
            <TextInput value={nota} onChangeText={setNota} placeholder="¿A quién? (opcional)" placeholderTextColor={colors.muted} style={styles.input} maxLength={60} />
          </>}
          {formulario === 'gasto' && <>
            <Text style={styles.etiqueta}>¿Cuánto gastaste?</Text>
            <TextInput value={monto} onChangeText={setMonto} placeholder="Ej. 80.000" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} maxLength={13} />
            <Text style={styles.etiqueta}>¿En qué?</Text>
            <View style={styles.chips}>{conceptos.map((c) => <Pressable key={c} onPress={() => setNota(c)} style={[styles.chip, nota === c && styles.chipActivo]}><Text style={[styles.chipTexto, nota === c && styles.chipTextoActivo]}>{c}</Text></Pressable>)}</View>
            <TextInput value={nota} onChangeText={setNota} placeholder="O escríbelo" placeholderTextColor={colors.muted} style={styles.input} maxLength={120} />
          </>}
          {formulario === 'compra' && <>
            <Text style={styles.etiqueta}>¿Cuánto pagaste en total?</Text>
            <TextInput value={monto} onChangeText={setMonto} placeholder="Ej. 1.600.000" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} maxLength={13} />
            <TextInput value={nota} onChangeText={setNota} placeholder="¿A quién se la compraste? (opcional)" placeholderTextColor={colors.muted} style={styles.input} maxLength={60} />
          </>}
          {formulario === 'perdida' && <TextInput value={nota} onChangeText={setNota} placeholder="¿Qué pasó? (opcional)" placeholderTextColor={colors.muted} style={styles.input} maxLength={120} />}
          {formulario === 'cobro' && <>
            <Text style={styles.etiqueta}>¿Qué venta te pagaron?</Text>
            {deudas.length === 0 ? <Text style={styles.vacioTexto}>No tienes ventas fiadas por cobrar.</Text> :
              <View style={styles.chips}>{deudas.map((d) => <Pressable key={d.id} onPress={() => { setVentaId(d.id); setMonto(String(d.debe)); }} style={[styles.chip, ventaId === d.id && styles.chipActivo]}><Text style={[styles.chipTexto, ventaId === d.id && styles.chipTextoActivo]}>{d.producto}{d.persona ? ' · ' + d.persona : ''} · debe {dinero(d.debe)}</Text></Pressable>)}</View>}
            <TextInput value={monto} onChangeText={setMonto} placeholder="¿Cuánto te pagaron?" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} maxLength={13} />
          </>}
          <Pressable accessibilityRole="button" onPress={guardar} style={({ pressed }) => [styles.guardar, pressed && styles.presionado]}><Text style={styles.guardarTexto}>Anotar {nombreTipo[formulario].toLowerCase()}</Text></Pressable>
        </View>}

        <Text style={styles.seccion}>Movimientos</Text>
        {movimientos.length === 0 && <Text style={styles.vacioTexto}>{esTienda ? 'Todavía no hay movimientos. Empieza anotando una compra de mercancía o una venta.' : 'Todavía no hay movimientos. Empieza anotando una cosecha o una venta.'}</Text>}
        {movimientos.map((m) => {
          const estado = estadoTexto(m.sync_status);
          let detalle = '';
          if (m.tipo === 'gasto') detalle = m.nota;
          else if (m.tipo === 'cobro') detalle = 'Pago de ' + m.producto + (m.persona ? ' · ' + m.persona : '');
          else detalle = mostrarCantidad(m.cantidad) + ' ' + textoUnidad(m.cantidad, m.unidad) + ' de ' + m.producto + (m.tipo === 'venta' && m.pagado === 0 ? ' · fiada' : '');
          const conMonto = m.tipo === 'venta' || m.tipo === 'gasto' || m.tipo === 'cobro' || m.tipo === 'compra';
          return <View key={m.id} style={styles.mov}>
            <View style={styles.flex}>
              <Text style={styles.movTitulo}>{nombreTipo[m.tipo]}{conMonto ? ' · ' + (m.tipo === 'gasto' || m.tipo === 'compra' ? '−' : '') + dinero(m.monto) : ''}</Text>
              <Text style={styles.movDetalle} numberOfLines={2}>{detalle}</Text>
              <Text style={styles.movFecha}>{new Date(m.fecha).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Text>
            </View>
            <View style={[styles.badge, estado.estilo]}><Text style={styles.badgeTexto}>{estado.texto}</Text></View>
          </View>;
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 18, paddingTop: 10, paddingBottom: 40 },
  volver: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  volverTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  titulo: { color: colors.verde, fontSize: 24, fontWeight: '900', marginTop: 4 },
  subtitulo: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },
  escuchar: { marginTop: 8, marginBottom: 10 },
  periodos: { flexDirection: 'row', gap: 6, marginTop: 4 },
  periodo: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  periodoActivo: { backgroundColor: colors.verde, borderColor: colors.verde },
  periodoTexto: { color: colors.verde, fontSize: 13, fontWeight: '800' }, periodoTextoActivo: { color: colors.white },
  resumen: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  cifra: { width: '48.5%', flexGrow: 1, padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  cifraFuerte: { width: '100%', backgroundColor: colors.verde, borderColor: colors.verde },
  cifraEtiqueta: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  cifraEtiquetaClara: { color: colors.verdeClaro, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  cifraValor: { color: colors.grafito, fontSize: 19, fontWeight: '900', marginTop: 4 },
  cifraValorClaro: { color: colors.white, fontSize: 24, fontWeight: '900', marginTop: 4 },
  negativo: { color: '#775D50' },
  nota: { color: colors.muted, fontSize: 12, marginTop: 6 },
  seccion: { color: colors.grafito, fontSize: 18, fontWeight: '900', marginTop: 18, marginBottom: 8 },
  acciones: { flexDirection: 'row', gap: 6 },
  accion: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.salvia },
  accionActiva: { backgroundColor: colors.verde },
  accionTexto: { color: colors.verde, fontSize: 12, fontWeight: '800' }, accionTextoActivo: { color: colors.white },
  presionado: { transform: [{ scale: 0.96 }] },
  formulario: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 10, gap: 8 },
  etiqueta: { color: colors.grafito, fontSize: 14, fontWeight: '800', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.crema, borderWidth: 1, borderColor: colors.line },
  chipActivo: { backgroundColor: colors.verde, borderColor: colors.verde },
  chipTexto: { color: colors.grafito, fontSize: 13, fontWeight: '700' }, chipTextoActivo: { color: colors.white },
  input: { backgroundColor: colors.crema, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: colors.grafito },
  enlace: { color: colors.verde, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  vacio: { padding: 12, borderRadius: 14, backgroundColor: colors.salvia },
  vacioTexto: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  guardar: { marginTop: 6, alignItems: 'center', paddingVertical: 13, borderRadius: 24, backgroundColor: colors.verde },
  guardarTexto: { color: colors.white, fontSize: 16, fontWeight: '900' },
  mov: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginBottom: 8 },
  movTitulo: { color: colors.grafito, fontSize: 15, fontWeight: '900' },
  movDetalle: { color: colors.grafito, fontSize: 13, marginTop: 2 },
  movFecha: { color: colors.muted, fontSize: 11, marginTop: 3 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 110 },
  badgeOk: { backgroundColor: colors.salvia }, badgePendiente: { backgroundColor: '#F5E7E2' }, badgeError: { backgroundColor: colors.arcilla },
  badgeTexto: { color: colors.grafito, fontSize: 10, fontWeight: '800', textAlign: 'center' },
});
