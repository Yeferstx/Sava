// mensajes para el asistente que quedaron esperando senal.
// se guardan en el celular (sqlite) para que no se pierdan aunque se cierre la app
import * as Network from 'expo-network';
import { getDatabase } from '../../infrastructure/database/database';

export type Pendiente = { id: string; texto: string; audio: string; creado: string };

async function tabla() {
  const db = await getDatabase();
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS maria_pendientes (id TEXT PRIMARY KEY NOT NULL, texto TEXT NOT NULL, audio TEXT NOT NULL, creado TEXT NOT NULL)',
  );
  return db;
}

export async function guardarPendiente(id: string, texto: string, audio: string) {
  const db = await tabla();
  await db.runAsync(
    'INSERT OR REPLACE INTO maria_pendientes (id, texto, audio, creado) VALUES (?, ?, ?, ?)',
    id,
    texto,
    audio,
    new Date().toISOString(),
  );
}

export async function listarPendientes() {
  const db = await tabla();
  return db.getAllAsync<Pendiente>('SELECT id, texto, audio, creado FROM maria_pendientes ORDER BY creado');
}

export async function quitarPendiente(id: string) {
  const db = await tabla();
  await db.runAsync('DELETE FROM maria_pendientes WHERE id = ?', id);
}

// hay internet de verdad (no solo wifi conectado)
export async function hayInternet() {
  try {
    const estado = await Network.getNetworkStateAsync();
    if (estado.isInternetReachable === false) return false;
    return estado.isConnected === true;
  } catch {
    return true;
  }
}

// avisa cada vez que cambia la senal
export function escucharSenal(alCambiar: (conSenal: boolean) => void) {
  const suscripcion = Network.addNetworkStateListener((estado) => {
    alCambiar(estado.isConnected === true && estado.isInternetReachable !== false);
  });
  return () => suscripcion.remove();
}
