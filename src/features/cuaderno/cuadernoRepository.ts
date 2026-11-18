// cuaderno del campo: todo se guarda primero en el celular (sqlite) y se sincroniza despues.
// cada movimiento tiene un id unico: si se envia dos veces, el servidor no lo duplica
import { createLocalId, enqueueSync, getActiveBusinessId, getDatabase } from '../../infrastructure/database/database';
import { syncPendingChanges } from '../../infrastructure/sync/syncService';
import type { Product } from '../inventory/types';
import { errorCantidad, redondear } from '../../shared/validaciones';

export type TipoMovimiento = 'cosecha' | 'venta' | 'gasto' | 'perdida' | 'cobro';

export type Movimiento = {
  id: string; business_id: string; tipo: TipoMovimiento; product_id: string | null; producto: string; cantidad: number; unidad: string;
  monto: number; pagado: number; ref_id: string | null; persona: string; nota: string; fecha: string; sync_status: string;
};

async function guardar(movimiento: Movimiento, producto?: { anterior: Product; stock: number }) {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('INSERT INTO movimientos (id, business_id, tipo, product_id, producto, cantidad, unidad, monto, pagado, ref_id, persona, nota, fecha, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      movimiento.id, movimiento.business_id, movimiento.tipo, movimiento.product_id, movimiento.producto, movimiento.cantidad, movimiento.unidad, movimiento.monto, movimiento.pagado, movimiento.ref_id, movimiento.persona, movimiento.nota, movimiento.fecha, 'pending');
    if (producto) {
      // la cantidad del producto cambia en el celular; en el servidor cambia al sincronizar
      await transaction.runAsync('UPDATE products SET stock = ?, sync_status = ?, updated_at = ? WHERE id = ?', producto.stock, 'pending', movimiento.fecha, producto.anterior.id);
      await enqueueSync(transaction, 'product', 'upsert', { ...producto.anterior, stock: producto.stock, sync_status: 'pending', updated_at: movimiento.fecha });
    }
    await enqueueSync(transaction, 'movimiento', 'create', movimiento);
  });
  void syncPendingChanges().catch(() => undefined);
  return movimiento;
}

async function base(tipo: TipoMovimiento): Promise<Movimiento> {
  return { id: createLocalId('mov'), business_id: await getActiveBusinessId(), tipo, product_id: null, producto: '', cantidad: 0, unidad: '', monto: 0, pagado: 1, ref_id: null, persona: '', nota: '', fecha: new Date().toISOString(), sync_status: 'pending' };
}

async function productoDelNegocio(productId: string) {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const product = await db.getFirstAsync<Product>('SELECT * FROM products WHERE id = ? AND business_id = ?', productId, businessId);
  if (!product) throw new Error('No encontramos ese producto en tu negocio.');
  return product;
}

// nueva cosecha de un producto que ya existe: suma a lo disponible
export async function registrarCosecha(productId: string, cantidad: number, nota = '') {
  const product = await productoDelNegocio(productId);
  const error = errorCantidad(cantidad, product.unit);
  if (error !== '') throw new Error(error);
  const movimiento = { ...(await base('cosecha')), product_id: product.id, producto: product.name, cantidad, unidad: product.unit, nota };
  return guardar(movimiento, { anterior: product, stock: redondear(product.stock + cantidad) });
}

// producto danado o perdido: resta de lo disponible, nunca deja numeros negativos
export async function registrarPerdida(productId: string, cantidad: number, nota = '') {
  const product = await productoDelNegocio(productId);
  const error = errorCantidad(cantidad, product.unit);
  if (error !== '') throw new Error(error);
  if (redondear(cantidad) > redondear(product.stock)) throw new Error('Solo tienes ' + product.stock + ' ' + product.unit + ' de ' + product.name + '.');
  const movimiento = { ...(await base('perdida')), product_id: product.id, producto: product.name, cantidad, unidad: product.unit, nota };
  return guardar(movimiento, { anterior: product, stock: redondear(product.stock - cantidad) });
}

export async function registrarGasto(monto: number, concepto: string) {
  if (!Number.isInteger(monto) || monto <= 0) throw new Error('Escribe el valor del gasto en pesos, sin centavos.');
  if (concepto.trim().length < 2) throw new Error('Escribe en qué fue el gasto, por ejemplo «abono».');
  return guardar({ ...(await base('gasto')), monto, nota: concepto.trim().slice(0, 120) });
}

// pago de una venta fiada (completo o una parte)
export async function registrarCobro(ventaId: string, monto: number) {
  if (!Number.isInteger(monto) || monto <= 0) throw new Error('Escribe cuánto te pagaron.');
  const pendientes = await ventasPorCobrar();
  const venta = pendientes.find((v) => v.id === ventaId);
  if (!venta) throw new Error('Esa venta ya está pagada.');
  if (monto > venta.debe) throw new Error('Te deben ' + venta.debe + ' pesos de esa venta; no puedes cobrar más.');
  return guardar({ ...(await base('cobro')), ref_id: venta.id, producto: venta.producto, persona: venta.persona, monto });
}

export async function listarMovimientos(limite = 60) {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  return db.getAllAsync<Movimiento>('SELECT * FROM movimientos WHERE business_id = ? ORDER BY fecha DESC LIMIT ?', businessId, limite);
}

export type VentaPorCobrar = { id: string; producto: string; persona: string; monto: number; cobrado: number; debe: number; fecha: string };

export async function ventasPorCobrar() {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const filas = await db.getAllAsync<{ id: string; producto: string; persona: string; monto: number; fecha: string; cobrado: number | null }>(
    `SELECT v.id, v.producto, v.persona, v.monto, v.fecha, (SELECT SUM(c.monto) FROM movimientos c WHERE c.tipo = 'cobro' AND c.ref_id = v.id) AS cobrado
     FROM movimientos v WHERE v.business_id = ? AND v.tipo = 'venta' AND v.pagado = 0 ORDER BY v.fecha`, businessId);
  const lista: VentaPorCobrar[] = [];
  for (const fila of filas) {
    const cobrado = fila.cobrado ?? 0;
    if (cobrado >= fila.monto) continue;
    lista.push({ id: fila.id, producto: fila.producto, persona: fila.persona, monto: fila.monto, cobrado, debe: fila.monto - cobrado, fecha: fila.fecha });
  }
  return lista;
}

export type Periodo = 'hoy' | 'semana' | 'mes' | 'todo';

export function desdeFecha(periodo: Periodo) {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  if (periodo === 'semana') fecha.setDate(fecha.getDate() - 6);
  if (periodo === 'mes') fecha.setDate(1);
  if (periodo === 'todo') return new Date(0);
  return fecha;
}

// resumen de cuentas. "recibido" es solo dinero que de verdad llego (ventas pagadas y cobros)
export async function resumenCuentas(periodo: Periodo) {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const lista = await db.getAllAsync<Movimiento>('SELECT * FROM movimientos WHERE business_id = ? AND fecha >= ?', businessId, desdeFecha(periodo).toISOString());
  let vendido = 0; let recibido = 0; let gastos = 0; let perdidas = 0; let cosechas = 0;
  for (const m of lista) {
    if (m.tipo === 'venta') { vendido += m.monto; if (m.pagado === 1) recibido += m.monto; }
    if (m.tipo === 'cobro') recibido += m.monto;
    if (m.tipo === 'gasto') gastos += m.monto;
    if (m.tipo === 'perdida') perdidas += 1;
    if (m.tipo === 'cosecha') cosechas += 1;
  }
  let porCobrar = 0;
  for (const venta of await ventasPorCobrar()) porCobrar += venta.debe;
  return { vendido, recibido, gastos, porCobrar, balance: recibido - gastos, perdidas, cosechas, movimientos: lista.length };
}
