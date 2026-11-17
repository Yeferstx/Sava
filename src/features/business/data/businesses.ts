import type { Business } from '../types';

export const businesses: Business[] = [
  { id: 'llanerazo', name: 'El Llanerazo', category: 'Restaurante', rating: 4.8, distanceKm: 1.2, color: '#e7c49b', description: 'Sabores tradicionales de los Llanos.', municipality: 'Yopal' },
  { id: 'sabor-casanare', name: 'Sabor Casanare', category: 'Comida típica', rating: 4.7, distanceKm: 1.5, color: '#f0d2a5', description: 'Comida casera con ingredientes locales.', municipality: 'Yopal' },
  { id: 'tecnoyopal', name: 'TecnoYopal', category: 'Tecnología', rating: 4.6, distanceKm: 2.0, color: '#c8c6bc', description: 'Accesorios y soporte tecnológico.', municipality: 'Yopal' },
];
