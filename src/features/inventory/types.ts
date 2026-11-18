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
  sync_status: 'local' | 'pending' | 'synced' | 'conflict';
  updated_at: string;
  // datos de la cosecha (pueden faltar en productos viejos)
  municipality?: string;
  available_from?: string;
  delivery?: string;
  retired?: number;
  // pedido minimo (0 = vende cualquier cantidad). precio 0 = precio a convenir
  min_order?: number;
  // version del servidor que conoce este celular (vacio = nunca se ha subido)
  server_updated_at?: string | null;
  // fotos adicionales en json: ["ruta1", "ruta2"]
  extra_photos?: string;
  created_at?: string;
};
