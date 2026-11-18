import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CircleCheck, Clock3, Minus, Plus, Sparkles, XCircle } from 'lucide-react-native';
import { colors } from '../../shared/theme';
import { dinero } from '../../shared/contacto';
import { aceptaDecimales, leerPrecio, mostrarCantidad, redondear, textoUnidad } from '../../shared/validaciones';
import { hablar } from '../../shared/voz';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import { confirmarNoVendido, confirmarVendido, posponer, type Seguimiento } from './seguimientoRepository';

type Props = { visible: boolean; pendientes: Seguimiento[]; leerEnVoz: boolean; onListo: (id: string) => void; onCerrar: () => void };

function hace(fecha: string) {
  const horas = Math.round((Date.now() - new Date(fecha).getTime()) / (60 * 60 * 1000));
  if (horas < 24) return 'hace ' + horas + (horas === 1 ? ' hora' : ' horas');
  const dias = Math.round(horas / 24);
  return 'hace ' + dias + (dias === 1 ? ' día' : ' días');
}

function pregunta(item: Seguimiento) {
  if (item.tipo === 'consulta') return item.cliente + ' te preguntó por ' + item.producto + ' ' + hace(item.fecha) + '. ¿Le vendiste?';
  return 'Alguien te escribió por WhatsApp por ' + item.producto + ' ' + hace(item.fecha) + '. ¿Le vendiste?';
}

// maria pregunta que paso con las ventas que empezaron en sava
export default function SeguimientoModal({ visible, pendientes, leerEnVoz, onListo, onCerrar }: Props) {
  const item = pendientes.length > 0 ? pendientes[0] : null;
  const [paso, setPaso] = useState<'pregunta' | 'cuanto'>('pregunta');
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState('');
  const [guardando, setGuardando] = useState(false);

  // cada pregunta nueva empieza de cero y maria la lee en voz alta
  useEffect(() => {
    if (!item || !visible) return;
    setPaso('pregunta');
    setCantidad(item.cantidadSugerida);
    setPrecio(String(item.precio));
    if (leerEnVoz) void hablar('¿Qué pasó con esta venta? ' + pregunta(item));
  }, [item ? item.id : '', visible]);

  if (!item) return null;
  const actual = item;

  function cambiar(pasoCantidad: number) {
    let nueva = redondear(cantidad + pasoCantidad);
    if (nueva < 1 && !aceptaDecimales(actual.unidad)) nueva = 1;
    if (nueva <= 0) nueva = 0.5;
    setCantidad(nueva);
  }

  async function hacer(accion: () => Promise<void>, mensaje: string) {
    setGuardando(true);
    try {
      await accion();
      if (leerEnVoz && mensaje !== '') void hablar(mensaje);
      onListo(actual.id);
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Revisa tu conexión e intenta de nuevo.');
    } finally { setGuardando(false); }
  }

  function guardarVenta() {
    const valor = leerPrecio(precio);
    if (valor === 0) { Alert.alert('Revisa el precio', 'Escribe a cómo vendiste cada ' + actual.unidad + '.'); return; }
    if (cantidad <= 0) { Alert.alert('Revisa la cantidad', 'La cantidad debe ser mayor que 0.'); return; }
    void hacer(() => confirmarVendido(actual, cantidad, valor), '¡Qué bien! Registré la venta y la descontamos del inventario.');
  }

  const valorPrecio = leerPrecio(precio);
  let faltan = '';
  if (pendientes.length > 1) faltan = 'Faltan ' + (pendientes.length - 1) + ' más por revisar';

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
    <View style={styles.fondo}>
      <ScrollView style={styles.hoja} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.maria}><View style={styles.mariaIcono}><Sparkles size={22} color={colors.grafito} /></View><Text style={styles.mariaTexto}>Aru pregunta</Text></View>
        <Text style={styles.titulo}>¿Qué pasó con esta venta?</Text>
        <Text style={styles.pregunta}>{pregunta(actual)}</Text>
        <BotonEscuchar texto={'¿Qué pasó con esta venta? ' + pregunta(actual)} />

        {paso === 'pregunta' && <View style={styles.opciones}>
          <Pressable accessibilityRole="button" disabled={guardando} onPress={() => setPaso('cuanto')} style={[styles.opcion, styles.opcionSi]}>
            <CircleCheck size={30} color={colors.white} /><Text style={styles.opcionTextoBlanco}>Sí, vendí</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={guardando} onPress={() => void hacer(() => confirmarNoVendido(actual), 'Listo, lo anoté como no vendido.')} style={[styles.opcion, styles.opcionNo]}>
            <XCircle size={30} color="#775D50" /><Text style={styles.opcionTextoNo}>No se vendió</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={guardando} onPress={() => void hacer(() => posponer(actual), 'Listo, te vuelvo a preguntar mañana.')} style={[styles.opcion, styles.opcionEspera]}>
            <Clock3 size={30} color={colors.verde} /><Text style={styles.opcionTextoEspera}>Todavía estamos hablando</Text>
          </Pressable>
        </View>}

        {paso === 'cuanto' && <View style={styles.cuanto}>
          <Text style={styles.label}>¿Cuánto vendiste?</Text>
          <View style={styles.cantidadFila}>
            <Pressable accessibilityRole="button" accessibilityLabel="Menos" onPress={() => cambiar(-1)} style={styles.pasoBoton}><Minus size={24} color={colors.verde} /></Pressable>
            <View style={styles.centro}><Text style={styles.cantidad}>{mostrarCantidad(cantidad)}</Text><Text style={styles.unidad}>{textoUnidad(cantidad, actual.unidad)}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Más" onPress={() => cambiar(1)} style={styles.pasoBoton}><Plus size={24} color={colors.verde} /></Pressable>
          </View>
          <Text style={styles.label}>¿A cómo cada {actual.unidad}?</Text>
          <TextInput value={precio} onChangeText={setPrecio} keyboardType="number-pad" maxLength={12} style={styles.input} accessibilityLabel={'Precio por ' + actual.unidad} />
          {valorPrecio > 0 && <Text style={styles.total}>Total: {dinero(Math.round(cantidad * valorPrecio))}</Text>}
          <Text style={styles.nota}>Se registra como venta y se descuenta de tu inventario. Es un registro tuyo, no una factura.</Text>
          <View style={styles.fila}>
            <Pressable accessibilityRole="button" onPress={() => setPaso('pregunta')} style={styles.volver}><Text style={styles.volverTexto}>Atrás</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={guardando} onPress={guardarVenta} style={styles.guardar}>{guardando ? <ActivityIndicator color={colors.white} /> : <Text style={styles.guardarTexto}>Guardar venta</Text>}</Pressable>
          </View>
        </View>}

        {faltan !== '' && <Text style={styles.faltan}>{faltan}</Text>}
        <Pressable accessibilityRole="button" onPress={onCerrar} style={styles.despues}><Text style={styles.despuesTexto}>Responder más tarde</Text></Pressable>
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(38,51,47,0.55)', justifyContent: 'flex-end' },
  hoja: { maxHeight: '92%', backgroundColor: colors.crema, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  contenido: { padding: 22, paddingBottom: 34, gap: 10 },
  maria: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mariaIcono: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.arcilla, alignItems: 'center', justifyContent: 'center' },
  mariaTexto: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  titulo: { color: colors.verde, fontSize: 25, fontWeight: '900' },
  pregunta: { color: colors.grafito, fontSize: 17, lineHeight: 24 },
  opciones: { gap: 10, marginTop: 6 },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 18, borderRadius: 20 },
  opcionSi: { backgroundColor: colors.verde },
  opcionNo: { backgroundColor: '#F5E7E2' },
  opcionEspera: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line },
  opcionTextoBlanco: { color: colors.white, fontSize: 18, fontWeight: '900' },
  opcionTextoNo: { color: '#775D50', fontSize: 18, fontWeight: '900' },
  opcionTextoEspera: { color: colors.verde, fontSize: 17, fontWeight: '800', flex: 1 },
  cuanto: { gap: 8, marginTop: 4 },
  label: { color: colors.grafito, fontSize: 15, fontWeight: '800', marginTop: 6 },
  cantidadFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: 20, padding: 10 },
  pasoBoton: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' },
  centro: { alignItems: 'center' }, cantidad: { color: colors.grafito, fontSize: 32, fontWeight: '900' }, unidad: { color: colors.muted, fontSize: 14 },
  input: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: colors.grafito, fontSize: 18, fontWeight: '800' },
  total: { color: colors.verde, fontSize: 20, fontWeight: '900' },
  nota: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  fila: { flexDirection: 'row', gap: 10, marginTop: 6 },
  volver: { flex: 1, minHeight: 54, borderRadius: 27, backgroundColor: colors.verdeClaro, alignItems: 'center', justifyContent: 'center' }, volverTexto: { color: colors.verde, fontSize: 16, fontWeight: '800' },
  guardar: { flex: 2, minHeight: 54, borderRadius: 27, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center' }, guardarTexto: { color: colors.white, fontSize: 16, fontWeight: '900' },
  faltan: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 6 },
  despues: { alignItems: 'center', padding: 12 }, despuesTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
});
