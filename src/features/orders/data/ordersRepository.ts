import { getSupabaseClient } from '../../../infrastructure/supabase/client';
import { getActiveBusinessId } from '../../../infrastructure/database/database';
import type { OrderStatus, OrderSummary } from '../types';

export async function placeProductOrder(input: {
  businessId: string;
  productId: string;
  quantity: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  note: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('No hay conexión con Sava. Intenta de nuevo cuando tengas internet.');
  const { data, error } = await supabase.rpc('place_order', {
    p_business_id: input.businessId,
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_delivery_address: input.deliveryAddress,
    p_note: input.note,
  });
  if (error) throw error;
  return data as string;
}

export async function listCustomerOrders(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return [] as OrderSummary[];
  const { data, error } = await supabase.from('orders')
    .select('id,business_id,customer_id,customer_name,customer_phone,delivery_address,note,status,total_cop,created_at,order_items(product_name,quantity,unit,unit_price_cop,line_total_cop),business:businesses(name,municipality)')
    .eq('customer_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrderSummary[];
}

export async function listBusinessOrders() {
  const supabase = getSupabaseClient();
  if (!supabase) return [] as OrderSummary[];
  const businessId = await getActiveBusinessId();
  const { data, error } = await supabase.from('orders')
    .select('id,business_id,customer_id,customer_name,customer_phone,delivery_address,note,status,total_cop,created_at,order_items(product_name,quantity,unit,unit_price_cop,line_total_cop)')
    .eq('business_id', businessId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OrderSummary[];
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('No hay conexión con Sava. Intenta de nuevo cuando tengas internet.');
  const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
  if (error) throw error;
}
