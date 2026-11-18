// recordatorios de cobro: ventas fiadas que llevan tiempo sin pagarse.
// funcionan sin internet: se arman con el cuaderno del celular.
// dentro de la app quedan en la campana; en el celular solo si la persona activo los avisos
import * as Notifications from 'expo-notifications';
import { avisosActivos, crearNotificacion } from '../notificaciones/notificacionesRepository';
import { ventasPorCobrar } from './cuadernoRepository';

const DIAS_PARA_RECORDAR = 7;

function dinero(valor: number) {
  return '$' + Math.round(valor).toLocaleString('es-CO');
}

// a las 9 de la manana del dia indicado
function nueveDeLaManana(fecha: Date) {
  const d = new Date(fecha);
  d.setHours(9, 0, 0, 0);
  return d;
}

let ultimaRevision = 0;

export async function revisarRecordatoriosDeCobro() {
  // como mucho cada 3 horas (no gasta bateria revisando a cada rato)
  if (Date.now() - ultimaRevision < 3 * 3600 * 1000) return;
  ultimaRevision = Date.now();
  let deudas;
  try { deudas = await ventasPorCobrar(); } catch { return; }
  const ahora = Date.now();
  // la semana sirve para no repetir el mismo aviso: maximo uno por semana por cada deuda
  const semana = Math.floor(ahora / (7 * 86400000));
  for (const d of deudas) {
    const dias = Math.floor((ahora - new Date(d.fecha).getTime()) / 86400000);
    if (dias < DIAS_PARA_RECORDAR) continue;
    await crearNotificacion({
      id: 'cobro-' + d.id + '-' + semana, tipo: 'recordatorio', titulo: 'Recuerda cobrar',
      texto: (d.persona ? d.persona + ' te debe ' : 'Te deben ') + dinero(d.debe) + ' de ' + d.producto.toLowerCase() + ' desde hace ' + dias + ' días.', product_id: null,
    }).catch(() => undefined);
  }
  // los que aun no cumplen 7 dias: aviso programado en el celular para ese dia (si hay permiso)
  try {
    if (!(await avisosActivos())) return;
    const programados = await Notifications.getAllScheduledNotificationsAsync();
    for (const p of programados) { if (p.identifier.startsWith('cobro-')) await Notifications.cancelScheduledNotificationAsync(p.identifier); }
    for (const d of deudas) {
      const cuando = nueveDeLaManana(new Date(new Date(d.fecha).getTime() + DIAS_PARA_RECORDAR * 86400000));
      if (cuando.getTime() <= ahora) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: 'cobro-' + d.id,
        content: { title: 'Recuerda cobrar', body: (d.persona ? d.persona + ' te debe ' : 'Te deben ') + dinero(d.debe) + ' de ' + d.producto.toLowerCase() + '.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: cuando },
      });
    }
  } catch { /* los avisos del celular son opcionales */ }
}
