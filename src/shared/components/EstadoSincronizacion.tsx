import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CloudCheck, CloudOff, CloudUpload, TriangleAlert } from 'lucide-react-native';
import { colors } from '../theme';
import { estadoSincronizacion, listarConflictos, resolverConflicto, syncPendingChanges, type EstadoSync } from '../../infrastructure/sync/syncService';
import { escucharSenal, hayInternet } from '../../features/chat/pendientes';

function hora(fecha: string) {
  if (!fecha) return '';
  const d = new Date(fecha);
  const hoy = new Date();
  const mismaFecha = d.toDateString() === hoy.toDateString();
  return mismaFecha ? 'hoy ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

// aviso discreto: sin conexion, cuantos movimientos faltan por enviar o "todo esta actualizado".
// nunca bloquea la app; se puede reintentar a mano
export default function EstadoSincronizacion({ alCambiar }: { alCambiar?: () => void }) {
  const [estado, setEstado] = useState<EstadoSync | null>(null);
  const [conSenal, setConSenal] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const leer = useCallback(async () => {
    try { setEstado(await estadoSincronizacion()); } catch { /* sin datos todavia */ }
  }, []);

  const enviar = useCallback(async (avisar: boolean) => {
    setEnviando(true);
    try { await syncPendingChanges(); }
    catch { if (avisar) Alert.alert('No se pudo sincronizar', 'Tus registros siguen guardados en este celular. Intenta otra vez cuando tengas buena señal.'); }
    finally { setEnviando(false); await leer(); if (alCambiar) alCambiar(); }
  }, [leer, alCambiar]);

  useEffect(() => {
    void leer();
    void hayInternet().then(setConSenal);
    const quitar = escucharSenal((senal) => { setConSenal(senal); if (senal) void enviar(false); });
    const repaso = setInterval(() => void leer(), 15000);
    return () => { quitar(); clearInterval(repaso); };
  }, [leer, enviar]);

  async function revisarConflictos() {
    try {
      const lista = await listarConflictos();
      if (lista.length === 0) { await leer(); return; }
      const c = lista[0];
      Alert.alert('Cambios desde otro celular', '«' + c.nombre + '» se cambió en otro celular. Aquí tienes ' + c.stockLocal + (c.stockServidor !== null ? ' y en el otro ' + c.stockServidor : '') + '. ¿Cuál cantidad es la correcta? Tus ventas y gastos no se borran.', [
        { text: 'Decidir después', style: 'cancel' },
        { text: 'La del otro celular', onPress: () => void resolverConflicto(c.productId, 'servidor').then(leer).then(() => { if (alCambiar) alCambiar(); }) },
        { text: 'La de este celular', onPress: () => void resolverConflicto(c.productId, 'mio').then(leer).then(() => { if (alCambiar) alCambiar(); }) },
      ]);
    } catch { Alert.alert('Necesitas conexión', 'Para revisar esto necesitas internet.'); }
  }

  if (!estado) return null;
  let Icono = CloudCheck;
  let texto = 'Todo está actualizado';
  let detalle = estado.ultima ? 'Última sincronización: ' + hora(estado.ultima) : '';
  let tono: { backgroundColor: string } = styles.ok;
  let accion = '';
  if (estado.pendientes > 0) {
    Icono = CloudUpload; tono = styles.pendiente;
    texto = estado.pendientes === 1 ? '1 movimiento pendiente de sincronizar' : estado.pendientes + ' movimientos pendientes de sincronizar';
    accion = 'Reintentar';
    if (estado.errores > 0 && estado.ultimoError.toLowerCase().includes('movimientos')) detalle = 'Falta preparar el servidor para el cuaderno. Tus datos siguen guardados aquí.';
  }
  if (!conSenal) {
    Icono = CloudOff; tono = styles.pendiente; accion = '';
    texto = 'Sin conexión · Tus registros se guardan en este dispositivo';
    if (estado.pendientes > 0) detalle = estado.pendientes + ' pendientes por enviar cuando vuelva la señal';
  }

  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={texto + '. ' + detalle} disabled={!accion || enviando} onPress={() => void enviar(true)} style={[styles.caja, tono]}>
        {enviando ? <ActivityIndicator size="small" color={colors.verde} /> : <Icono size={18} color={colors.verde} />}
        <View style={styles.flex}>
          <Text style={styles.texto}>{enviando ? 'Sincronizando…' : texto}</Text>
          {detalle !== '' && !enviando && <Text style={styles.detalle}>{detalle}</Text>}
        </View>
        {!!accion && !enviando && <Text style={styles.accion}>{accion}</Text>}
      </Pressable>
      {estado.conflictos > 0 && <Pressable accessibilityRole="button" onPress={() => void revisarConflictos()} style={[styles.caja, styles.conflicto]}>
        <TriangleAlert size={18} color={colors.grafito} />
        <Text style={[styles.texto, styles.flex]}>{estado.conflictos === 1 ? 'Un cambio necesita tu revisión' : estado.conflictos + ' cambios necesitan tu revisión'}</Text>
        <Text style={styles.accion}>Revisar</Text>
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  caja: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, marginBottom: 8 },
  ok: { backgroundColor: colors.salvia },
  pendiente: { backgroundColor: '#F5E7E2' },
  conflicto: { backgroundColor: colors.arcilla },
  texto: { color: colors.verde, fontSize: 13, fontWeight: '800' },
  detalle: { color: colors.muted, fontSize: 12, marginTop: 1 },
  accion: { color: colors.verde, fontSize: 13, fontWeight: '900' },
});
