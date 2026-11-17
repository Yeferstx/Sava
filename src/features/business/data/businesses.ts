import type { Business } from '../types';

export const businesses: Business[] = [
  { id: 'llanerazo', name: 'El Llanerazo', category: 'Restaurante', rating: 4.8, distanceKm: 1.2, color: '#C98770', description: 'Sabores tradicionales de los Llanos.', municipality: 'Yopal' },
  { id: 'sabor-casanare', name: 'Sabor Casanare', category: 'Comida típica', rating: 4.7, distanceKm: 1.5, color: '#E8F2EE', description: 'Comida casera con ingredientes locales.', municipality: 'Yopal' },
  { id: 'tecnoyopal', name: 'TecnoYopal', category: 'Tecnología', rating: 4.6, distanceKm: 2.0, color: '#F0E9DF', description: 'Accesorios y soporte tecnológico.', municipality: 'Yopal' },
];
