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
        CREATE INDEX IF NOT EXISTS products_business_idx ON products(business_id, is_published);
        CREATE INDEX IF NOT EXISTS sales_business_date_idx ON sales(business_id, sold_at);
      `);
      await seedDemoData(db);
      return db;
    })().catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

async function seedDemoData(db: SQLite.SQLiteDatabase) {
  const business = await db.getFirstAsync<{ id: string }>('SELECT id FROM businesses WHERE id = ?', DEMO_BUSINESS_ID);
  if (business) return;
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO businesses (id, name, category, description, phone, city, sync_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', DEMO_BUSINESS_ID, 'Mercado Llanero', 'Tienda', 'Productos de la región, pedidos sencillos y atención cercana.', '', 'Yopal', 'local', now);
    const samples = [
      ['demo-arroz', 'Arroz de la región', 'Abarrotes', 'Arroz cultivado en Casanare.', 80000, 20, 'bulto'],
      ['demo-queso', 'Queso campesino', 'Lácteos', 'Queso fresco de productores locales.', 18000, 12, 'unidad'],
      ['demo-yuca', 'Yuca fresca', 'Agro', 'Cosecha local disponible.', 3500, 30, 'kg'],
    ] as const;
    for (const [id, name, category, description, price, stock, unit] of samples) {
      await db.runAsync('INSERT INTO products (id, business_id, name, category, description, price_cop, stock, unit, sync_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', id, DEMO_BUSINESS_ID, name, category, description, price, stock, unit, 'local', now);
    }
  });
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
