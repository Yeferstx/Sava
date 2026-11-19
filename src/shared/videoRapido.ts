// los celulares guardan el indice del mp4 (moov) al final del archivo.
// asi el reproductor tiene que pedir el final antes de empezar.
// esta funcion lo pasa al inicio para que el video arranque apenas llegan los primeros datos.

type Caja = { tipo: string; inicio: number; tamano: number };

// cajas que tienen otras cajas adentro, hasta llegar a la tabla de posiciones
const CONTENEDORES = ['moov', 'trak', 'mdia', 'minf', 'stbl'];

function leerCajas(datos: DataView, desde: number, hasta: number): Caja[] | null {
  const cajas: Caja[] = [];
  let i = desde;
  while (i + 8 <= hasta) {
    let tamano = datos.getUint32(i);
    const tipo = String.fromCharCode(datos.getUint8(i + 4), datos.getUint8(i + 5), datos.getUint8(i + 6), datos.getUint8(i + 7));
    if (tamano === 1) tamano = datos.getUint32(i + 8) * 4294967296 + datos.getUint32(i + 12);
    if (tamano === 0) tamano = hasta - i;
    if (tamano < 8 || i + tamano > hasta) return null;
    cajas.push({ tipo, inicio: i, tamano });
    i = i + tamano;
  }
  return cajas;
}

// suma el corrimiento a cada posicion de la tabla stco o co64
function correrPosiciones(datos: DataView, desde: number, hasta: number, corrimiento: number): boolean {
  const cajas = leerCajas(datos, desde, hasta);
  if (cajas === null) return false;
  for (const caja of cajas) {
    if (CONTENEDORES.includes(caja.tipo)) {
      if (!correrPosiciones(datos, caja.inicio + 8, caja.inicio + caja.tamano, corrimiento)) return false;
    }
    if (caja.tipo === 'stco') {
      const cantidad = datos.getUint32(caja.inicio + 12);
      for (let n = 0; n < cantidad; n++) {
        const lugar = caja.inicio + 16 + n * 4;
        const nueva = datos.getUint32(lugar) + corrimiento;
        if (nueva > 4294967295) return false;
        datos.setUint32(lugar, nueva);
      }
    }
    if (caja.tipo === 'co64') {
      const cantidad = datos.getUint32(caja.inicio + 12);
      for (let n = 0; n < cantidad; n++) {
        const lugar = caja.inicio + 16 + n * 8;
        let nueva = datos.getUint32(lugar) * 4294967296 + datos.getUint32(lugar + 4) + corrimiento;
        datos.setUint32(lugar, Math.floor(nueva / 4294967296));
        datos.setUint32(lugar + 4, nueva % 4294967296);
      }
    }
  }
  return true;
}

export function moverIndiceAlInicio(bytes: ArrayBuffer): ArrayBuffer {
  const datos = new DataView(bytes);
  const cajas = leerCajas(datos, 0, bytes.byteLength);
  if (cajas === null) return bytes;
  let moov = -1;
  let mdat = -1;
  for (let n = 0; n < cajas.length; n++) {
    if (cajas[n].tipo === 'moov' && moov === -1) moov = n;
    if (cajas[n].tipo === 'mdat' && mdat === -1) mdat = n;
  }
  // si no tiene indice o ya esta al inicio, se deja igual
  if (moov === -1 || mdat === -1 || moov < mdat) return bytes;

  // copia del indice con las posiciones corridas
  const indice = new Uint8Array(bytes.slice(cajas[moov].inicio, cajas[moov].inicio + cajas[moov].tamano));
  const datosIndice = new DataView(indice.buffer);
  if (!correrPosiciones(datosIndice, 8, indice.byteLength, indice.byteLength)) return bytes;

  // orden nuevo: lo que va antes de los datos, el indice, y luego lo demas
  const resultado = new Uint8Array(bytes.byteLength);
  const original = new Uint8Array(bytes);
  let lugar = 0;
  for (let n = 0; n < cajas.length; n++) {
    if (n === mdat) {
      resultado.set(indice, lugar);
      lugar = lugar + indice.byteLength;
    }
    if (n !== moov) {
      resultado.set(original.subarray(cajas[n].inicio, cajas[n].inicio + cajas[n].tamano), lugar);
      lugar = lugar + cajas[n].tamano;
    }
  }
  return resultado.buffer;
}
