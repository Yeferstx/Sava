export type Product = {
  id: string;
  business_id: string;
  name: string;
  category: string;
  description: string;
  price_cop: number;
  stock: number;
  unit: string;
  photo_uri: string | null;
  is_published: number;
  sync_status: 'local' | 'pending' | 'synced';
  updated_at: string;
  // datos de la cosecha (pueden faltar en productos viejos)
  municipality?: string;
  available_from?: string;
  delivery?: string;
  retired?: number;
  created_at?: string;
};
