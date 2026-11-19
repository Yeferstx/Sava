// lo que mas le interesa a cada persona: cosechas o insumos.
// solo se guardan dos numeros en el celular (nada de conversaciones ni de que vio exactamente).
// cada accion suma puntos; los puntos viejos pierden peso con los dias.
// el orden del inicio solo cambia despues de varias acciones, nunca por una sola
import { getDatabase } from '../infrastructure/database/database';

export type Interes = 'cosechas' | 'insumos';
type Puntos = { cosechas: number; insumos: number; fecha: string };

const CLAVE = 'intereses_inicio';
// cada 14 dias los puntos valen la mitad: lo reciente pesa mas
const MEDIA_VIDA_DIAS = 14;
// para poner insumos primero hace falta una ventaja clara y repetida
const VENTAJA_MINIMA = 3;

async function leer(): Promise<Puntos> {
  try {
    const db = await getDatabase();
    const fila = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      CLAVE,
    );
    if (fila) return JSON.parse(fila.value) as Puntos;
  } catch {
    /* sin datos */
  }
  return { cosechas: 0, insumos: 0, fecha: new Date().toISOString() };
}

function envejecer(p: Puntos): Puntos {
  const dias = (Date.now() - new Date(p.fecha).getTime()) / 86400000;
  const factor = Math.pow(0.5, Math.max(0, dias) / MEDIA_VIDA_DIAS);
  return { cosechas: p.cosechas * factor, insumos: p.insumos * factor, fecha: new Date().toISOString() };
}

// peso: abrir una publicacion o buscar = 1, guardar = 2
export async function registrarInteres(tipo: Interes, peso = 1) {
  try {
    const p = envejecer(await leer());
    p[tipo] = Math.min(50, p[tipo] + peso);
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      CLAVE,
      JSON.stringify(p),
    );
  } catch {
    /* si no se puede guardar, el inicio sigue igual */
  }
}

// orden de las secciones del inicio. al empezar: cosechas primero
export async function ordenInicio(): Promise<Interes[]> {
  const p = envejecer(await leer());
  if (p.insumos >= VENTAJA_MINIMA && p.insumos - p.cosechas >= VENTAJA_MINIMA) return ['insumos', 'cosechas'];
  return ['cosechas', 'insumos'];
}

export async function borrarIntereses() {
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM app_settings WHERE key = ?', CLAVE);
  } catch {
    /* nada */
  }
}
