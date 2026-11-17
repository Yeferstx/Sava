import { Alert, Linking, Share } from 'react-native';
import type { Product } from '../features/inventory/types';
import type { Business } from '../features/business/types';
import { limpiarTelefono, mostrarCantidad, textoUnidad } from './validaciones';

export function dinero(valor: number) {
  return '$' + valor.toLocaleString('es-CO');
}

// texto corto de la cosecha para whatsapp o para compartir
export function textoCosecha(product: Product, business: Business | null) {
  let texto = product.name + ' · ' + dinero(product.price_cop) + ' por ' + product.unit;
  texto = texto + '\nDisponible: ' + mostrarCantidad(product.stock) + ' ' + textoUnidad(product.stock, product.unit);
  let municipio = product.municipality;
  if (!municipio && business) municipio = business.municipality;
  if (municipio) texto = texto + '\nMunicipio: ' + municipio + ', Casanare';
  if (business) texto = texto + '\nProductor: ' + business.name;
  return texto;
}

export async function escribirPorWhatsApp(product: Product, business: Business | null) {
  if (!business || !business.phone) {
    Alert.alert('Contacto no disponible', 'Este productor todavía no agregó un número de contacto.');
    return;
  }
  const mensaje = 'Hola, vi tu publicación en Sava y me interesa:\n' + textoCosecha(product, null) + '\n¿Sigue disponible?';
  try { await Linking.openURL('https://wa.me/57' + limpiarTelefono(business.phone) + '?text=' + encodeURIComponent(mensaje)); }
  catch { Alert.alert('No se pudo abrir WhatsApp', 'Revisa que WhatsApp esté instalado e intenta de nuevo.'); }
}

// abre el menu del celular para compartir (whatsapp, mensajes, etc.)
export async function compartirCosecha(product: Product, business: Business | null) {
  const mensaje = textoCosecha(product, business) + '\n\nVisto en Sava, del campo casanareño al comprador.';
  try { await Share.share({ message: mensaje }); }
  catch { Alert.alert('No se pudo compartir', 'Intenta de nuevo.'); }
}
