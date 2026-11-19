// textos de promocion armados con los datos reales de la publicacion (sin inventar nada)
import type { Product } from '../inventory/types';
import type { Business } from '../business/types';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';
import { dinero, textoMinimo } from '../../shared/contacto';
import { textoDisponible } from '../../shared/agro';

function datos(product: Product, business: Business | null) {
  const cantidad = mostrarCantidad(product.stock) + ' ' + textoUnidad(product.stock, product.unit);
  const minimo = textoMinimo(product.min_order, product.unit);
  let lugar = product.municipality;
  if (!lugar && business) lugar = business.municipality;
  const precio =
    product.price_cop > 0 ? dinero(product.price_cop) + ' por ' + product.unit : 'precio a convenir';
  const finca = business ? business.name : '';
  const disponible = textoDisponible(product.available_from).toLowerCase();
  return { cantidad, minimo, lugar: lugar || 'Casanare', precio, finca, disponible, nombre: product.name };
}

function etiqueta(texto: string) {
  return (
    '#' +
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
  );
}

export function textoWhatsApp(product: Product, business: Business | null) {
  const d = datos(product, business);
  const lineas = [
    '🌱 *' + d.nombre + '* de ' + d.lugar + ', Casanare',
    '',
    '✅ Disponible: ' + d.cantidad + (d.minimo ? ' (' + d.minimo.toLowerCase() + ')' : ''),
    '💲 ' + d.precio.charAt(0).toUpperCase() + d.precio.slice(1),
    '📅 ' + d.disponible.charAt(0).toUpperCase() + d.disponible.slice(1),
  ];
  if (d.finca) lineas.push('🏡 ' + d.finca);
  lineas.push('', 'Escríbeme para separar tu pedido. Lo encuentras en Sava.');
  return lineas.join('\n');
}

export function textoFacebook(product: Product, business: Business | null) {
  const d = datos(product, business);
  return (
    '¡Tenemos ' +
    d.nombre.toLowerCase() +
    ' fresca del campo casanareño! 🌾\n\n' +
    (d.finca ? 'Desde ' + d.finca + ', en ' : 'Desde ') +
    d.lugar +
    ', ofrecemos ' +
    d.cantidad +
    (d.minimo ? ', ' + d.minimo.toLowerCase() : '') +
    '. ' +
    'Precio: ' +
    d.precio +
    '. Está ' +
    d.disponible +
    '.\n\n' +
    'Comprarle directo al productor es apoyar el campo de Casanare. Escríbenos para coordinar la entrega. 🤝'
  );
}

export function textoInstagram(product: Product, business: Business | null) {
  const d = datos(product, business);
  const etiquetas = [
    etiqueta(d.nombre.split(' ')[0]),
    etiqueta(d.lugar),
    '#Casanare',
    '#HechoEnCasanare',
    '#DelCampoALaMesa',
    '#Sava',
  ];
  return (
    d.nombre +
    ' de ' +
    d.lugar +
    ' 🌱\n' +
    d.cantidad +
    ' disponibles' +
    (d.minimo ? ' · ' + d.minimo.toLowerCase() : '') +
    '\n' +
    d.precio.charAt(0).toUpperCase() +
    d.precio.slice(1) +
    '\n\nEscríbenos por mensaje directo.\n\n' +
    etiquetas.join(' ')
  );
}

export function guionVideo(product: Product, business: Business | null) {
  const d = datos(product, business);
  return [
    'Escena 1 (3 segundos): muestra el cultivo o la cosecha de cerca. Di: «Hola, ' +
      (d.finca ? 'somos ' + d.finca : 'soy productor') +
      ' de ' +
      d.lugar +
      '».',
    'Escena 2 (5 segundos): muestra las canastillas, bultos o el lote. Di: «Tenemos ' +
      d.cantidad +
      ' de ' +
      d.nombre.toLowerCase() +
      (d.minimo ? ', ' + d.minimo.toLowerCase() : '') +
      '».',
    'Escena 3 (4 segundos): toma un producto en la mano y muéstralo a la cámara. Di cómo está: madura, de primera o recién cosechada.',
    'Escena 4 (3 segundos): mira a la cámara. Di: «' +
      (d.precio === 'precio a convenir' ? 'El precio lo hablamos' : 'A ' + d.precio) +
      '. Escríbenos y búscanos en Sava».',
    'Consejo: graba de día, con el celular vertical y sin viento fuerte para que se oiga tu voz.',
  ].join('\n\n');
}
