import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'sava.db';
const DEMO_BUSINESS_ID = 'casanare-demo-business';
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS businesses (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL DEFAULT 'Yopal',
          sync_status TEXT NOT NULL DEFAULT 'pending',
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY NOT NULL,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          price_cop INTEGER NOT NULL CHECK (price_cop >= 0),
          stock REAL NOT NULL DEFAULT 0 CHECK (stock >= 0),
          unit TEXT NOT NULL DEFAULT 'unidad',
          photo_uri TEXT,
          is_published INTEGER NOT NULL DEFAULT 1,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY NOT NULL,
          business_id TEXT NOT NULL REFERENCES businesses(id),
          total_cop INTEGER NOT NULL,
          sold_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending'
        );
        CREATE TABLE IF NOT EXISTS sale_items (
          id TEXT PRIMARY KEY NOT NULL,
          sale_id TEXT NOT NULL REFERENCES sales(id),
          product_id TEXT NOT NULL REFERENCES products(id),
          quantity REAL NOT NULL CHECK (quantity > 0),
          unit_price_cop INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY NOT NULL,
          entity TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS favoritos (
          product_id TEXT PRIMARY KEY NOT NULL,
          producto TEXT NOT NULL,
          negocio TEXT,
          guardado_en TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS products_business_idx ON products(business_id, is_published);
        CREATE INDEX IF NOT EXISTS sales_business_date_idx ON sales(business_id, sold_at);
      `);
      await agregarColumnasCosecha(db);
      await seedDemoData(db);
      return db;
    })().catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

// columnas nuevas de la cosecha para celulares que ya tenian la app instalada
async function agregarColumnasCosecha(db: SQLite.SQLiteDatabase) {
  const columnas = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
  const nombres: string[] = [];
  for (const columna of columnas) nombres.push(columna.name);
  if (!nombres.includes('municipality')) await db.execAsync("ALTER TABLE products ADD COLUMN municipality TEXT NOT NULL DEFAULT 'Yopal'");
  if (!nombres.includes('available_from')) await db.execAsync("ALTER TABLE products ADD COLUMN available_from TEXT");
  if (!nombres.includes('delivery')) await db.execAsync("ALTER TABLE products ADD COLUMN delivery TEXT NOT NULL DEFAULT 'A convenir'");
  if (!nombres.includes('retired')) await db.execAsync('ALTER TABLE products ADD COLUMN retired INTEGER NOT NULL DEFAULT 0');
  if (!nombres.includes('created_at')) await db.execAsync('ALTER TABLE products ADD COLUMN created_at TEXT');
}

// el negocio de prueba solo existe para que la app funcione sin supabase.
// ya no se crean productos de muestra porque se veian como si fueran reales
async function seedDemoData(db: SQLite.SQLiteDatabase) {
  const viejos = ['demo-arroz', 'demo-queso', 'demo-yuca'];
  for (const id of viejos) {
    await db.runAsync('DELETE FROM sale_items WHERE product_id = ?', id);
    await db.runAsync('DELETE FROM products WHERE id = ?', id);
  }
  await db.runAsync('DELETE FROM sales WHERE business_id = ? AND id NOT IN (SELECT sale_id FROM sale_items)', DEMO_BUSINESS_ID);
  const business = await db.getFirstAsync<{ id: string }>('SELECT id FROM businesses WHERE id = ?', DEMO_BUSINESS_ID);
  if (business) return;
  const now = new Date().toISOString();
  await db.runAsync('INSERT INTO businesses (id, name, category, description, phone, city, sync_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', DEMO_BUSINESS_ID, 'Finca de prueba', 'Finca', 'Espacio de prueba sin conexión al servidor.', '', 'Yopal', 'local', now);
}

export const demoBusinessId = DEMO_BUSINESS_ID;

export function createLocalId(_prefix: string) {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export async function getActiveBusinessId() {
  const db = await getDatabase();
  const setting = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'active_business_id');
  return setting?.value ?? DEMO_BUSINESS_ID;
}

export async function setActiveBusinessId(businessId: string) {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'active_business_id', businessId);
}

export async function enqueueSync(db: SQLite.SQLiteDatabase, entity: string, operation: string, payload: unknown) {
  await db.runAsync('INSERT INTO sync_queue (id, entity, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)', createLocalId('sync'), entity, operation, JSON.stringify(payload), new Date().toISOString());
}
