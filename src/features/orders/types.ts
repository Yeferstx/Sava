export type OrderStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export type OrderItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price_cop: number;
  line_total_cop: number;
};

export type OrderSummary = {
  id: string;
  business_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  note: string;
  status: OrderStatus;
  total_cop: number;
  created_at: string;
  order_items: OrderItem[];
  business?: { name: string; municipality: string; phone: string } | null;
};
