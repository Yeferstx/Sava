// maria entiende frases sencillas escritas o dictadas con el microfono del teclado.
// no es inteligencia artificial: son reglas que buscan palabras clave.
// asi funciona sin internet y sin pagar una api

import { municipios } from '../../shared/validaciones';

export type Periodo = 'hoy' | 'semana' | 'mes';

export type Intencion =
  | { tipo: 'publicar'; producto: string; cantidad: number; unidad: string; precio: number }
  | { tipo: 'venta'; producto: string; cantidad: number; unidad: string; precio: number; total: number; fiada: boolean }
  | { tipo: 'gasto'; monto: number; concepto: string }
  | { tipo: 'perdida'; producto: string; cantidad: number; unidad: string }
  | { tipo: 'cuentas'; periodo: Periodo; tema: 'gastos' | 'deben' | 'balance' }
  | { tipo: 'promocionar'; producto: string }
  | { tipo: 'aprender'; pregunta: string }
  | { tipo: 'inventario'; producto: string }
  | { tipo: 'resumen'; periodo: Periodo }
  | { tipo: 'buscar'; producto: string; municipio: string; cantidad: number; unidad: string; soloPrecio: boolean }
  | { tipo: 'precio'; precio: number }
  | { tipo: 'ayuda' }
  | { tipo: 'publicarGuiado' }
  | { tipo: 'queEsSava' }
  | { tipo: 'crearCuenta' }
  | { tipo: 'compradores' }
  | { tipo: 'pedirVenta' }
  | { tipo: 'saludo' }
  | { tipo: 'gracias' }
  | { tipo: 'nada' };

// minusculas y sin tildes para comparar facil
export function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!,;:"]/g, ' ').replace(/\s+/g, ' ').trim();
}

// numeros escritos con letras (el dictado a veces los escribe asi)
const numerosEnLetras: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, quinientos: 500,
};

// palabra de unidad -> unidad de la app
const unidadesHabladas: Array<{ palabras: string[]; unidad: string }> = [
  { palabras: ['kilo', 'kilos', 'kg', 'kilogramo', 'kilogramos'], unidad: 'kg' },
  { palabras: ['bulto', 'bultos'], unidad: 'bulto' },
  { palabras: ['tonelada', 'toneladas'], unidad: 'tonelada' },
  { palabras: ['canastilla', 'canastillas', 'canasta', 'canastas'], unidad: 'canastilla' },
  { palabras: ['caja', 'cajas'], unidad: 'caja' },
  { palabras: ['racimo', 'racimos'], unidad: 'racimo' },
  { palabras: ['libra', 'libras'], unidad: 'libra' },
  { palabras: ['litro', 'litros'], unidad: 'litro' },
  { palabras: ['galon', 'galones'], unidad: 'galón' },
  { palabras: ['unidad', 'unidades', 'docena'], unidad: 'unidad' },
];

export function unidadDe(palabra: string) {
  for (const grupo of unidadesHabladas) {
    if (grupo.palabras.includes(palabra)) return grupo.unidad;
  }
  return '';
}

export function leerNumero(palabra: string) {
  if (/^\d+([.,]\d+)?$/.test(palabra)) {
    // 2.500 son dos mil quinientos, pero 2,5 o 1.5 son decimales
    if (/^\d{1,3}(\.\d{3})+$/.test(palabra)) return Number(palabra.split('.').join(''));
    return Number(palabra.replace(',', '.'));
  }
  if (numerosEnLetras[palabra] !== undefined) return numerosEnLetras[palabra];
  return -1;
}

// palabras que cortan el nombre del producto
const cortes = ['a', 'al', 'por', 'en', 'para', 'regist', 'anot', 'hoy', 'ayer', 'esta', 'este', 'y', 'que', 'el', 'la', 'cada', 'pesos', 'me', 'le', 'les', 'porfa', 'por favor'];
const relleno = ['de', 'del', 'la', 'el', 'los', 'las', 'unos', 'unas', 'mi', 'mis', 'kilo', 'kilos'];

// busca "<numero> <unidad> de <producto>" y devuelve lo que encuentre
export function extraerCantidad(t: string) {
  const palabras = t.split(' ');
  for (let i = 0; i < palabras.length; i++) {
    const numero = leerNumero(palabras[i]);
    if (numero <= 0) continue;
    // "200 mil" no es una cantidad, es un precio
    if (palabras[i + 1] === 'mil' || palabras[i + 1] === 'pesos') continue;
    if (i > 0 && (palabras[i - 1] === 'a' || palabras[i - 1] === 'por' || palabras[i - 1] === '$')) continue;
    let j = i + 1;
    let unidad = '';
    if (j < palabras.length && unidadDe(palabras[j]) !== '') { unidad = unidadDe(palabras[j]); j = j + 1; }
    if (palabras[j] === 'de' || palabras[j] === 'del') j = j + 1;
    const nombre: string[] = [];
    while (j < palabras.length) {
      const palabra = palabras[j];
      if (cortes.includes(palabra) || palabra.startsWith('regist') || palabra.startsWith('anot')) break;
      if (leerNumero(palabra) > 0) break;
      nombre.push(palabra);
      j = j + 1;
    }
    return { cantidad: numero, unidad, producto: nombre.join(' ').trim() };
  }
  return { cantidad: 0, unidad: '', producto: '' };
}

// "a 2.500", "a 25 mil", "por 125.000" (por = total)
export function extraerPrecio(t: string) {
  const encontrado = t.match(/(?:^|\s)(a|por|en)\s+\$?\s*(\d[\d.,]*)\s*(mil|millon|millones)?/);
  if (!encontrado) return { precio: 0, esTotal: false };
  let valor = 0;
  const numero = encontrado[2];
  let multiplicador = 1;
  if (encontrado[3] === 'mil') multiplicador = 1000;
  if (encontrado[3] === 'millon' || encontrado[3] === 'millones') multiplicador = 1000000;
  if (multiplicador > 1 && /^\d+[.,]\d{1,2}$/.test(numero)) valor = Number(numero.replace(',', '.'));
  else valor = Number(numero.replace(/[.,]/g, ''));
  return { precio: Math.round(valor * multiplicador), esTotal: encontrado[1] === 'por' };
}

// solo un precio, para cuando maria pregunta "¿a como lo vendes?"
export function soloPrecio(t: string) {
  const limpio = t.replace(/^(a|en|por|lo vendo a|lo doy a|vale|cuesta)\s+/, '').replace(/\s*(pesos|el kilo|el bulto|cada uno|la unidad|c\/u)\s*$/g, '').trim();
  const encontrado = limpio.match(/^\$?\s*(\d[\d.,]*)\s*(mil)?$/);
  if (!encontrado) return 0;
  let valor = Number(encontrado[1].replace(/[.,]/g, ''));
  if (encontrado[2] === 'mil') valor = valor * 1000;
  return valor;
}

export function municipioEn(t: string) {
  for (const municipio of municipios) {
    if (t.includes(normalizar(municipio))) return municipio;
  }
  return '';
}

// quita lo que no es el nombre del producto en una busqueda
function productoBuscado(t: string) {
  let texto = t;
  const frases = ['a como esta', 'a como se vende', 'a como venden', 'a como', 'cuanto vale', 'cuanto cuesta', 'cuanto esta', 'precio del', 'precio de', 'precios de', 'precio', 'se vende', 'esta', 'quiero comprar', 'quisiera comprar', 'necesito comprar', 'necesito', 'busco', 'estoy buscando', 'quien vende', 'quien tiene', 'donde consigo', 'donde compro', 'donde venden', 'donde hay', 'me interesa', 'comprar', 'hay', 'venden', 'alguien que venda', 'alguien vende', 'maria'];
  for (const frase of frases) texto = texto.split(frase).join(' ');
  const municipio = municipioEn(texto);
  if (municipio !== '') texto = texto.split(normalizar(municipio)).join(' ');
  const palabras: string[] = [];
  for (const palabra of texto.split(' ')) {
    if (palabra === '' || relleno.includes(palabra) || cortes.includes(palabra)) continue;
    if (leerNumero(palabra) > 0 || unidadDe(palabra) !== '') continue;
    palabras.push(palabra);
  }
  return palabras.join(' ');
}

export function entender(mensaje: string): Intencion {
  let t = normalizar(mensaje);
  t = t.replace(/^(hola\s+)?maria\s*/, '').replace(/\s+maria$/, '');
  if (t === '') return { tipo: 'saludo' };

  if (/^(gracias|muchas gracias|listo gracias|ok gracias|dios le pague)/.test(t)) return { tipo: 'gracias' };
  // visitantes: que es sava y como crear la cuenta
  if (/\b(que es sava|para que sirve (sava|esto|la app)|como funciona sava|que hace sava|que es esto|que es esta app|quien eres|que eres|como te llamas)\b/.test(t)) return { tipo: 'queEsSava' };
  if (/\b(crear (mi |una )?cuenta|registrarme|me registro|como me registro|abrir (una )?cuenta|iniciar sesion)\b/.test(t)) return { tipo: 'crearCuenta' };
  // "ayudame a publicar una cosecha": empieza la publicacion guiada (va antes que la ayuda general)
  if (!/\d/.test(t) && (/\b(publicar|publica|publiquemos|subir|mostrar|montar)\b.*\b(cosecha|cosechas|producto|productos|algo|publicacion)\b/.test(t) || /^(quiero |ayudame a |vamos a )?publicar$/.test(t))) return { tipo: 'publicarGuiado' };
  // "ayudame a promocionar…" o "ayudame con mis cuentas" no son la ayuda general
  if (!/(promocion|publicidad|propaganda|anunciar|a conocer|foto|descripcion|costo|cuentas|gaste|me deben)/.test(t) && /\b(ayuda|ayudame|que (puedes|sabes) hacer|como (funciona|te uso)|que haces)\b/.test(t)) return { tipo: 'ayuda' };
  // como encontrar compradores o como vender en sava
  if (/(encontrar|encuentro|conseguir|consigo|buscar|busco) compradores|quien me compr|como (vendo|vender|vendemos)/.test(t)) return { tipo: 'compradores' };

  // resumen de ventas
  if (/\b(cuanto (he |hemos )?vend|resumen|mis ventas|como (me )?(fue|va|van|ha ido)|cuanta plata|cuanto (he )?ganado|cuanto (me )?entro)/.test(t)) {
    let periodo: Periodo = 'semana';
    if (/\bhoy\b/.test(t)) periodo = 'hoy';
    if (/\bmes\b/.test(t)) periodo = 'mes';
    return { tipo: 'resumen', periodo };
  }

  // gasto: "gaste 80 mil en abono", "pague 50.000 de jornal"
  if (/\b(gaste|gastamos|pague|pagamos|compre|invertí|inverti|me costo|me costaron)\b/.test(t) || /\bgasto\b/.test(t)) {
    const todas = Array.from(t.matchAll(/\$?\s*(\d[\d.,]*)\s*(mil|millon|millones|pesos)?/g));
    let plata = todas.find((m) => !!m[2]);
    if (!plata && todas.length > 0) plata = todas[todas.length - 1];
    if (plata) {
      let valor = Number(plata[1].replace(/[.,]/g, ''));
      if (plata[2] === 'mil') valor = valor * 1000;
      if (plata[2] === 'millon' || plata[2] === 'millones') valor = valor * 1000000;
      const concepto = (t.split(/\b(?:en|de|del|para)\b/).slice(1).join(' ').replace(/\d[\d.,]*|\b(mil|pesos|millones?)\b/g, ' ').replace(/\s+/g, ' ').trim()).replace(/\s+(a|al|por|el|la|los|las|y)$/, '');
      if (valor >= 100) return { tipo: 'gasto', monto: Math.round(valor), concepto };
    }
  }

  // perdida: "se me danaron 20 kilos de pina", "perdi 5 racimos de platano"
  if (/\b(perdi|perdimos|se (me )?(dano|danaron|perdio|perdieron|pudrio|pudrieron|robaron)|bote|botamos|se murio|se murieron)\b/.test(t)) {
    const datos = extraerCantidad(t.replace(/\b(se me|se|me)\b/g, ' ').replace(/\s+/g, ' '));
    if (datos.cantidad > 0 && datos.producto !== '') return { tipo: 'perdida', producto: datos.producto, cantidad: datos.cantidad, unidad: datos.unidad };
  }

  // cuentas: "cuanto gaste este mes", "cuanto me deben", "como van mis cuentas"
  if (/\b(cuanto (he )?(gaste|gastado|gastamos)|mis gastos|cuanto me deben|quien me debe|que me deben|por cobrar|mis cuentas|como van (mis )?cuentas|balance|cuanto (gane|me gane|he ganado|recibi|me quedo de plata))\b/.test(t)) {
    let periodo: Periodo = 'mes';
    if (/\bhoy\b/.test(t)) periodo = 'hoy';
    if (/\bsemana\b/.test(t)) periodo = 'semana';
    let tema: 'gastos' | 'deben' | 'balance' = 'balance';
    if (/gast/.test(t)) tema = 'gastos';
    if (/deben|debe|cobrar/.test(t)) tema = 'deben';
    return { tipo: 'cuentas', periodo, tema };
  }

  // promocionar: "ayudame a promocionar mis 500 kilos de platano", "no se como darla a conocer"
  if (/\b(promocion\w*|publicidad|propaganda|anunciar|dar a conocer|darla a conocer|darlo a conocer|darlos a conocer|darlas a conocer)\b/.test(t)) {
    const datos = extraerCantidad(t);
    let producto = datos.producto;
    if (producto === '') {
      const palabras = t.replace(/\b(ayudame|ayuda|quiero|a|promocion\w*|publicidad|propaganda|anunciar|hacer|mi|mis|el|la|los|las|de|del|para|dar|conocer|darla|darlo|darlos|darlas|como|no se|tengo|bastante|mucha|mucho|pero|sava|maria)\b/g, ' ').trim();
      producto = palabras.replace(/\s+/g, ' ');
    }
    return { tipo: 'promocionar', producto };
  }

  // aprender: "como tomo buenas fotos", "ensename a llevar cuentas"
  if (/\b(como (tomo|tomar|saco|sacar|hago|hacer|escribo|escribir|calculo|calcular|llevo|llevar|respondo|responder|muestro|mostrar|fotografio)|ensename|aprender|guia|guias|consejo|consejos|tips)\b/.test(t)) return { tipo: 'aprender', pregunta: t };

  // registrar una venta: "vendi", "anotame una venta", "acabo de vender"
  if (/\b(vendi|vendimos|acabo de vender|acabamos de vender|anota|anotame|anote|apunta|apuntame|registra|registrame|registre)\b/.test(t) || /\bventa\b/.test(t)) {
    const sinFrase = t.replace(/\b(una|la|otra) venta( de)?\b/g, ' ').replace(/\bregistr\w*|\banot\w*|\bapunt\w*/g, ' ').replace(/\s+/g, ' ');
    const datos = extraerCantidad(sinFrase);
    if (datos.cantidad > 0 && datos.producto !== '') {
      const precio = extraerPrecio(sinFrase);
      let unitario = precio.precio;
      let total = 0;
      if (precio.esTotal) { total = precio.precio; unitario = Math.round(precio.precio / datos.cantidad); }
      return { tipo: 'venta', producto: datos.producto, cantidad: datos.cantidad, unidad: datos.unidad, precio: unitario, total, fiada: /\b(fiad\w*|quedo debiendo|quedaron debiendo|me debe|me deben|a credito|sin pagar)\b/.test(t) };
    }
    // quiere anotar una venta pero no dijo que ni cuanto
    if (/\b(registrar|anotar|apuntar) (una )?venta\b/.test(t)) return { tipo: 'pedirVenta' };
  }

  // inventario: "cuanta papaya me queda", "que tengo", "inventario"
  if (/\b(cuant[oa]s?|que)\b.*\b(me queda|me quedan|queda|quedan|tengo|hay)\b/.test(t) || /\b(inventario|existencias)\b/.test(t)) {
    let producto = t.replace(/\b(cuant[oa]s?|que|me|quedan?|tengo|hay|de|del|inventario|existencias|todavia|aun|ahora|en|mi|mis|el|la|los|las|kilos?|bultos?|racimos?|cajas?|productos?|cosechas?|cosas|publicad[oa]s?)\b/g, ' ').replace(/\s+/g, ' ').trim();
    return { tipo: 'inventario', producto };
  }

  // precios: "a como esta la pina", "cuanto vale el platano"
  if (/\b(a como|cuanto (vale|cuesta|esta)|precios? (de|del))\b/.test(t)) {
    const producto = productoBuscado(t);
    if (producto !== '') return { tipo: 'buscar', producto, municipio: municipioEn(t), cantidad: 0, unidad: '', soloPrecio: true };
  }

  // buscar para comprar
  if (/\b(necesito|busco|buscando|quiero comprar|quisiera comprar|quien vende|quien tiene|donde (consigo|compro|venden|hay)|me interesa|alguien (que )?vend)/.test(t)) {
    const datos = extraerCantidad(t);
    return { tipo: 'buscar', producto: productoBuscado(t), municipio: municipioEn(t), cantidad: datos.cantidad, unidad: datos.unidad, soloPrecio: false };
  }

  // publicar: "tengo 200 kilos de pina a 2500", "vendo 20 bultos de yuca"
  if (/\b(vendo|tengo|ofrezco|publica|publicar|publicame|quiero vender|voy a vender|salio|saque|coseche|cosechamos)\b/.test(t)) {
    const datos = extraerCantidad(t);
    if (datos.cantidad > 0 && datos.producto !== '') {
      const precio = extraerPrecio(t);
      return { tipo: 'publicar', producto: datos.producto, cantidad: datos.cantidad, unidad: datos.unidad, precio: precio.precio };
    }
    // dijo que vende algo pero sin cantidad: maria la pregunta despues
    const sinCantidad = t.match(/\b(?:vendo|ofrezco|tengo|publica|publicar|quiero vender|voy a vender)\s+(?:de\s+)?([a-zn ]+?)(?=\s+(?:a|al|por|en|para|que|y)\s|$)/);
    if (sinCantidad && sinCantidad[1].trim() !== '') {
      const precio = extraerPrecio(t);
      let unidad = '';
      const porUnidad = t.match(/\b(?:el|la|cada|por)\s+(\w+)$/);
      if (porUnidad) unidad = unidadDe(porUnidad[1]);
      return { tipo: 'publicar', producto: sinCantidad[1].trim(), cantidad: 0, unidad, precio: precio.precio };
    }
  }

  const precio = soloPrecio(t);
  if (precio > 0) return { tipo: 'precio', precio };

  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|buen dia|que mas|quiubo|hey)/.test(t)) return { tipo: 'saludo' };
  return { tipo: 'nada' };
}

// compara nombres sin tildes. "pina" encuentra "Piña oro miel"
export function seParece(nombreProducto: string, buscado: string) {
  const a = normalizar(nombreProducto);
  const b = normalizar(buscado);
  if (b === '') return false;
  if (a.includes(b) || b.includes(a)) return true;
  // basta con que la palabra principal coincida (quitando la s del plural)
  for (const palabra of b.split(' ')) {
    if (palabra.length < 3) continue;
    let raiz = palabra;
    if (raiz.endsWith('es') && raiz.length > 4) raiz = raiz.slice(0, -2);
    else if (raiz.endsWith('s')) raiz = raiz.slice(0, -1);
    if (a.includes(raiz)) return true;
  }
  return false;
}
