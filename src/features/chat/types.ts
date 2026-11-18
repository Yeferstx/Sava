import type { Product } from '../inventory/types';
import type { Business } from '../business/types';

// publicacion o producto que maria recomienda a quien busca
export type Recomendacion = { product: Product; business: Business | null };

// audio: nota de voz de la persona. pendiente: espera senal para que el asistente responda
export type ChatMessage = { id: string; author: 'assistant' | 'user'; text: string; recomendaciones?: Recomendacion[]; audio?: string; pendiente?: boolean; opciones?: string[] };

export type ProductDraft = { name: string; category: string; description: string; price_cop: number; stock: number; unit: string; municipality?: string; min_order?: number; available_from?: string };

// venta que maria prepara y que el vendedor debe confirmar
export type VentaPropuesta = { productId: string; nombre: string; cantidad: number; unidad: string; precio: number; total: number; quedan: number };
