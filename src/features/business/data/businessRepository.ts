import { enqueueSync, getActiveBusinessId, getDatabase } from '../../../infrastructure/database/database';
import { syncPendingChanges } from '../../../infrastructure/sync/syncService';

export type BusinessProfile = {
  id: string;
  name: string;
  category: string;
  description: string;
  phone: string;
  city: string;
  sync_status: string;
};

export async function cacheRemoteBusiness(input: {
  id: string;
  name: string;
  category: string;
  description: string;
  phone: string;
  municipality: string;
}) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO businesses (id, name, category, description, phone, city, sync_status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category, description = excluded.description, phone = excluded.phone, city = excluded.city, sync_status = 'synced', updated_at = excluded.updated_at`,
    input.id,
    input.name,
    input.category,
    input.description,
    input.phone,
    input.municipality,
    now,
  );
}

export async function getBusinessProfile() {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  return db.getFirstAsync<BusinessProfile>(
    'SELECT id, name, category, description, phone, city, sync_status FROM businesses WHERE id = ?',
    businessId,
  );
}

export async function saveBusinessProfile(
  input: Pick<BusinessProfile, 'name' | 'category' | 'description' | 'phone' | 'city'>,
) {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const now = new Date().toISOString();
  const next = { id: businessId, ...input, sync_status: 'pending', updated_at: now };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE businesses SET name = ?, category = ?, description = ?, phone = ?, city = ?, sync_status = ?, updated_at = ? WHERE id = ?',
      input.name,
      input.category,
      input.description,
      input.phone,
      input.city,
      'pending',
      now,
      businessId,
    );
    await enqueueSync(db, 'business', 'upsert', next);
  });
  void syncPendingChanges().catch(() => undefined);
}
