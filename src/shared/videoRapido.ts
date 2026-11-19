// el celular guarda el indice del video (moov) al final del archivo.
// aqui se pasa al inicio para que el video empiece a verse sin bajarlo completo

type Caja = { tipo: string; inicio: number; tamano: number };

// cajas que tienen otras cajas adentro
const CONTENEDORES = ['moov', 'trak', 'mdia', 'minf', 'stbl'];
const MAXIMO_32 = 4294967296;

function leerTipo(datos: DataView, i: number) {
  let tipo = '';
  for (let n = 4; n < 8; n++) {
    tipo = tipo + String.fromCharCode(datos.getUint8(i + n));
  }
  return tipo;
}

// lista las cajas que hay entre dos posiciones (null si el archivo esta raro)
function leerCajas(datos: DataView, desde: number, hasta: number) {
  const cajas: Caja[] = [];
  let i = desde;
  while (i + 8 <= hasta) {
    let tamano = datos.getUint32(i);
    if (tamano === 1) tamano = datos.getUint32(i + 8) * MAXIMO_32 + datos.getUint32(i + 12);
    if (tamano === 0) tamano = hasta - i;
    if (tamano < 8 || i + tamano > hasta) return null;
    cajas.push({ tipo: leerTipo(datos, i), inicio: i, tamano: tamano });
    i = i + tamano;
  }
  return cajas;
}

// suma el corrimiento a cada posicion de las tablas stco y co64
function correrPosiciones(datos: DataView, desde: number, hasta: number, corrimiento: number) {
  const cajas = leerCajas(datos, desde, hasta);
  if (cajas === null) return false;

  for (const caja of cajas) {
    if (CONTENEDORES.includes(caja.tipo)) {
      const bien = correrPosiciones(datos, caja.inicio + 8, caja.inicio + caja.tamano, corrimiento);
      if (!bien) return false;
    }

    if (caja.tipo === 'stco') {
      const cantidad = datos.getUint32(caja.inicio + 12);
      for (let n = 0; n < cantidad; n++) {
        const lugar = caja.inicio + 16 + n * 4;
        const nueva = datos.getUint32(lugar) + corrimiento;
        if (nueva >= MAXIMO_32) return false;
        datos.setUint32(lugar, nueva);
      }
    }

    if (caja.tipo === 'co64') {
      const cantidad = datos.getUint32(caja.inicio + 12);
      for (let n = 0; n < cantidad; n++) {
        const lugar = caja.inicio + 16 + n * 8;
        const nueva = datos.getUint32(lugar) * MAXIMO_32 + datos.getUint32(lugar + 4) + corrimiento;
        datos.setUint32(lugar, Math.floor(nueva / MAXIMO_32));
        datos.setUint32(lugar + 4, nueva % MAXIMO_32);
      }
    }
  }
  return true;
}

export function moverIndiceAlInicio(bytes: ArrayBuffer) {
  const datos = new DataView(bytes);
  const cajas = leerCajas(datos, 0, bytes.byteLength);
  if (cajas === null) return bytes;

  let moov = -1;
  let mdat = -1;
  for (let n = 0; n < cajas.length; n++) {
    if (cajas[n].tipo === 'moov' && moov === -1) moov = n;
    if (cajas[n].tipo === 'mdat' && mdat === -1) mdat = n;
  }
  // sin indice o ya esta al inicio: se deja igual
  if (moov === -1 || mdat === -1 || moov < mdat) return bytes;

  // copia del indice con las posiciones corridas
  const inicioMoov = cajas[moov].inicio;
  const indice = new Uint8Array(bytes.slice(inicioMoov, inicioMoov + cajas[moov].tamano));
  const bien = correrPosiciones(new DataView(indice.buffer), 8, indice.byteLength, indice.byteLength);
  if (!bien) return bytes;

  // orden nuevo: lo de antes de los datos, el indice y lo demas
  const resultado = new Uint8Array(bytes.byteLength);
  const original = new Uint8Array(bytes);
  let lugar = 0;
  for (let n = 0; n < cajas.length; n++) {
    if (n === mdat) {
      resultado.set(indice, lugar);
      lugar = lugar + indice.byteLength;
    }
    if (n !== moov) {
      const caja = cajas[n];
      resultado.set(original.subarray(caja.inicio, caja.inicio + caja.tamano), lugar);
      lugar = lugar + caja.tamano;
    }
  }
  return resultado.buffer;
}
