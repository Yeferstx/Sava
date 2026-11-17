// validaciones que usan los formularios de la app

export const PRECIO_MAXIMO = 100000000;
export const CANTIDAD_MAXIMA = 100000;

// los 19 municipios de casanare
export const municipios = [
  'Yopal', 'Aguazul', 'Chámeza', 'Hato Corozal', 'La Salina', 'Maní', 'Monterrey',
  'Nunchía', 'Orocué', 'Paz de Ariporo', 'Pore', 'Recetor', 'Sabanalarga', 'Sácama',
  'San Luis de Palenque', 'Támara', 'Tauramena', 'Trinidad', 'Villanueva',
];

// estas unidades se pueden vender por partes (medio kilo, media libra)
export function aceptaDecimales(unidad: string) {
  if (unidad === 'kg' || unidad === 'libra' || unidad === 'bulto' || unidad === 'litro' || unidad === 'galón') {
    return true;
  }
  return false;
}

export function tecladoCantidad(unidad: string): 'decimal-pad' | 'number-pad' {
  if (aceptaDecimales(unidad)) {
    return 'decimal-pad';
  }
  return 'number-pad';
}

// deja maximo 3 decimales para que no salgan cosas como 0.30000000004
export function redondear(numero: number) {
  return Math.round(numero * 1000) / 1000;
}

// lee precios como 80000, 80.000 o $ 80.000. si esta mal devuelve 0
export function leerPrecio(texto: string) {
  let limpio = texto.trim().replace('$', '').replace(/\s/g, '');
  const sinPuntos = /^\d+$/.test(limpio);
  const conPuntos = /^\d{1,3}(\.\d{3})+$/.test(limpio);
  if (sinPuntos === false && conPuntos === false) {
    return 0;
  }
  limpio = limpio.split('.').join('');
  const precio = Number(limpio);
  if (precio <= 0 || precio > PRECIO_MAXIMO) {
    return 0;
  }
  return precio;
}

// lee cantidades como 20, 2,5 o 2.5. si el texto esta mal devuelve -1
export function leerCantidad(texto: string) {
  const limpio = texto.trim().replace(',', '.');
  if (/^\d+(\.\d{1,3})?$/.test(limpio) === false) {
    return -1;
  }
  return Number(limpio);
}

// devuelve el error de la cantidad o '' si esta bien
export function errorCantidad(cantidad: number, unidad: string) {
  if (cantidad < 0) {
    return 'Escribe la cantidad solo con números, por ejemplo 20 o 2,5.';
  }
  if (cantidad === 0) {
    return 'La cantidad debe ser mayor que 0.';
  }
  if (aceptaDecimales(unidad) === false && Number.isInteger(cantidad) === false) {
    return 'Para ' + unidad + ' la cantidad debe ser un número entero.';
  }
  return '';
}

// nombre de la unidad en singular o plural
export function textoUnidad(cantidad: number, unidad: string) {
  if (cantidad === 1 || unidad === 'kg') {
    return unidad;
  }
  if (unidad === 'unidad') {
    return 'unidades';
  }
  if (unidad === 'galón') {
    return 'galones';
  }
  return unidad + 's';
}

export function mostrarCantidad(cantidad: number) {
  return redondear(cantidad).toLocaleString('es-CO', { maximumFractionDigits: 3, useGrouping: false });
}

// quita espacios, guiones y el +57 del telefono
export function limpiarTelefono(texto: string) {
  let numeros = texto.replace(/\D/g, '');
  if (numeros.length === 12 && numeros.startsWith('57')) {
    numeros = numeros.slice(2);
  }
  return numeros;
}

// celular (3xx) o fijo (60x), los dos de 10 digitos
export function telefonoValido(texto: string) {
  const numeros = limpiarTelefono(texto);
  return /^(3\d{9}|60\d{8})$/.test(numeros);
}

export function correoValido(texto: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto.trim());
}
