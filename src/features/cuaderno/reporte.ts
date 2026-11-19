// reporte pdf de "mi cuaderno": se arma solo con los datos reales guardados en el celular (funciona sin internet).
// la persona decide si lo guarda o lo comparte; nada se envia solo
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import { getActiveBusinessId, getDatabase } from '../../infrastructure/database/database';
import { estadoSincronizacion } from '../../infrastructure/sync/syncService';
import { getBusinessProfile } from '../business/data/businessRepository';
import { listProducts } from '../inventory/data/inventoryRepository';
import { armarHtmlReporte, nombrePeriodo } from './reporteHtml';
import {
  desdeFecha,
  resumenCuentas,
  ventasPorCobrar,
  type Movimiento,
  type Periodo,
} from './cuadernoRepository';

async function imagenAru() {
  try {
    const asset = Asset.fromModule(require('../../../assets/asistente/asistente.png'));
    await asset.downloadAsync();
    if (!asset.localUri) return '';
    return 'data:image/png;base64,' + (await new File(asset.localUri).base64());
  } catch {
    return '';
  }
}

// arma el html del reporte (se ve dentro de la app y con el mismo se crea el pdf)
export async function armarReporte(periodo: Periodo, tipo: 'agricultor' | 'tienda') {
  const esTienda = tipo === 'tienda';
  const db = await getDatabase();
  const negocioId = await getActiveBusinessId();
  const perfil = await getBusinessProfile().catch(() => null);
  const desde = desdeFecha(periodo);
  const ahora = new Date();
  const duracion = ahora.getTime() - desde.getTime();
  const desdeAnterior = new Date(desde.getTime() - duracion);
  const todos = await db.getAllAsync<Movimiento>(
    'SELECT * FROM movimientos WHERE business_id = ? AND fecha >= ? ORDER BY fecha',
    negocioId,
    (periodo === 'todo' ? new Date(0) : desdeAnterior).toISOString(),
  );
  const actuales = todos.filter((m) => new Date(m.fecha) >= desde);
  const anteriores = periodo === 'todo' ? [] : todos.filter((m) => new Date(m.fecha) < desde);
  const r = await resumenCuentas(periodo);
  const deudas = await ventasPorCobrar();
  const productos = (await listProducts())
    .filter((p) => p.stock > 0)
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 8);
  const sync = await estadoSincronizacion().catch(() => null);
  const aru = await imagenAru();

  return armarHtmlReporte({
    esTienda,
    periodo,
    desde,
    ahora,
    nombreNegocio: perfil ? perfil.name : 'Mi negocio',
    lugar: perfil && perfil.city ? perfil.city + ', Casanare' : 'Casanare',
    ultimaSync: sync && sync.ultima ? sync.ultima : '',
    aru,
    r,
    actuales,
    anteriores,
    deudas,
    productos,
  });
}

// convierte el html en un pdf con un nombre claro
export async function crearPdf(html: string, periodo: Periodo) {
  const ahora = new Date();
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  // nombre claro para el archivo
  let destino = uri;
  try {
    const original = new File(uri);
    const nombre =
      'Sava-reporte-' +
      nombrePeriodo[periodo].toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      ahora.toISOString().slice(0, 10) +
      '.pdf';
    const nuevo = new File(original.parentDirectory, nombre);
    if (nuevo.exists) nuevo.delete();
    original.move(nuevo);
    destino = nuevo.uri;
  } catch {
    /* se queda con el nombre que dio el sistema */
  }
  return destino;
}

export async function compartirPdf(uri: string) {
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Compartir tu reporte',
    });
}

// guarda el pdf en la carpeta que la persona elija (por ejemplo Descargas).
// devuelve false si cerro el selector sin elegir carpeta
export async function guardarPdf(uri: string) {
  const original = new File(uri);
  let carpeta: Directory;
  try {
    carpeta = await Directory.pickDirectoryAsync();
  } catch {
    return false;
  }
  const copia = carpeta.createFile(original.name, 'application/pdf');
  await copia.write(await original.bytes());
  return true;
}

// arma el pdf y abre el menu para guardarlo o compartirlo
export async function compartirReporte(periodo: Periodo, tipo: 'agricultor' | 'tienda') {
  const uri = await crearPdf(await armarReporte(periodo, tipo), periodo);
  await compartirPdf(uri);
  return uri;
}
