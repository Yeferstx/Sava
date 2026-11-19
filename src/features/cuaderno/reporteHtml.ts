// diseno del reporte pdf (html). es una funcion pura: recibe los datos reales y devuelve el html
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';
import { LOGO_ALTO, LOGO_ANCHO, piezas } from '../splash/logoSava';
import type { Movimiento, Periodo } from './cuadernoRepository';

export type DatosReporte = {
  esTienda: boolean;
  periodo: Periodo;
  desde: Date;
  ahora: Date;
  nombreNegocio: string;
  lugar: string;
  ultimaSync: string;
  aru: string;
  r: {
    vendido: number;
    recibido: number;
    gastos: number;
    compras: number;
    balance: number;
    porCobrar: number;
    ganancia: number;
    ventasConCosto: number;
    ventasSinCosto: number;
  };
  actuales: Movimiento[];
  anteriores: Movimiento[];
  deudas: Array<{ producto: string; persona: string; debe: number; fecha: string }>;
  productos: Array<{ name: string; stock: number; unit: string }>;
};

const VERDE = '#064229';
const CREMA = '#F0E9DF';
const SALVIA = '#DCEBE2';
const TERRACOTA = '#C98770';
const GRAFITO = '#26332F';
const SUAVE = '#636A64';

export const nombrePeriodo: Record<Periodo, string> = {
  hoy: 'Hoy',
  semana: 'Últimos 7 días',
  mes: 'Este mes',
  todo: 'Todo el tiempo',
};

function dinero(valor: number) {
  const signo = valor < 0 ? '−' : '';
  return signo + '$' + Math.abs(Math.round(valor)).toLocaleString('es-CO');
}
function fecha(iso: string | Date) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}
function escapar(texto: string) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// logo original de sava (las mismas formas de la animacion de inicio)
function logoSvg(alto: number) {
  const ancho = Math.round((alto * LOGO_ANCHO) / LOGO_ALTO);
  return (
    '<svg width="' +
    ancho +
    '" height="' +
    alto +
    '" viewBox="0 0 ' +
    LOGO_ANCHO +
    ' ' +
    LOGO_ALTO +
    '">' +
    piezas.map((p) => '<path d="' + p.d + '" fill="' + p.color + '"/>').join('') +
    '</svg>'
  );
}

// paisaje llanero sutil para el pie de pagina
const llano =
  '<svg class="llano" viewBox="0 0 800 70" preserveAspectRatio="none"><path d="M0 48 C120 30 220 40 330 34 C450 26 560 44 680 36 C740 32 780 36 800 34 L800 70 L0 70Z" fill="' +
  SALVIA +
  '"/><path d="M0 58 C150 46 260 56 400 50 C540 44 660 58 800 52 L800 70 L0 70Z" fill="#C9DDD0"/>' +
  '<circle cx="560" cy="30" r="9" fill="' +
  TERRACOTA +
  '" opacity="0.45"/></svg>';

type Barra = { etiqueta: string; entra: number; sale: number };

// grafica de barras: dinero que entro (verde) y que salio (terracota)
function grafica(barras: Barra[]) {
  const max = Math.max(1, ...barras.map((b) => Math.max(b.entra, b.sale)));
  const ancho = 640;
  const alto = 170;
  const base = 140;
  const paso = ancho / barras.length;
  const w = Math.min(28, paso / 3);
  let svg = '<svg width="100%" viewBox="0 0 ' + ancho + ' ' + alto + '">';
  for (let i = 0; i <= 3; i++) {
    const y = base - ((base - 10) * i) / 3;
    svg +=
      '<line x1="0" x2="' + ancho + '" y1="' + y + '" y2="' + y + '" stroke="#E6E1D8" stroke-width="1"/>';
  }
  barras.forEach((b, i) => {
    const x = i * paso + paso / 2;
    const he = ((base - 10) * b.entra) / max;
    const hs = ((base - 10) * b.sale) / max;
    svg +=
      '<rect x="' +
      (x - w - 2) +
      '" y="' +
      (base - he) +
      '" width="' +
      w +
      '" height="' +
      he +
      '" rx="5" fill="' +
      VERDE +
      '"/>';
    svg +=
      '<rect x="' +
      (x + 2) +
      '" y="' +
      (base - hs) +
      '" width="' +
      w +
      '" height="' +
      hs +
      '" rx="5" fill="' +
      TERRACOTA +
      '"/>';
    svg +=
      '<text x="' +
      x +
      '" y="' +
      (base + 18) +
      '" text-anchor="middle" font-size="12" fill="' +
      SUAVE +
      '">' +
      escapar(b.etiqueta) +
      '</text>';
  });
  return svg + '</svg>';
}

// barras horizontales para listas (productos que mas vendieron, gastos por tipo)
function listaBarras(items: Array<{ nombre: string; valor: number; detalle?: string }>, color: string) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  return items
    .map(
      (i) =>
        '<div class="fila"><div class="fila-arriba"><span>' +
        escapar(i.nombre) +
        '</span><b>' +
        dinero(i.valor) +
        '</b></div><div class="pista"><div style="width:' +
        Math.max(4, Math.round((100 * i.valor) / max)) +
        '%;background:' +
        color +
        '"></div></div>' +
        (i.detalle ? '<small>' + escapar(i.detalle) + '</small>' : '') +
        '</div>',
    )
    .join('');
}

export function sumar(lista: Movimiento[], filtro: (m: Movimiento) => boolean) {
  return lista.filter(filtro).reduce((t, m) => t + m.monto, 0);
}
const recibe = (m: Movimiento) => (m.tipo === 'venta' && m.pagado === 1) || m.tipo === 'cobro';

function barrasDelPeriodo(lista: Movimiento[], periodo: Periodo, desde: Date): Barra[] {
  const barras: Barra[] = [];
  const agregar = (etiqueta: string, ini: Date, fin: Date) => {
    const dentro = lista.filter((m) => {
      const f = new Date(m.fecha);
      return f >= ini && f < fin;
    });
    barras.push({
      etiqueta,
      entra: sumar(dentro, recibe),
      sale: sumar(dentro, (m) => m.tipo === 'gasto' || m.tipo === 'compra'),
    });
  };
  const hoy = new Date();
  if (periodo === 'mes') {
    for (let s = 0; s < 5; s++) {
      const ini = new Date(desde);
      ini.setDate(1 + s * 7);
      if (ini > hoy) break;
      const fin = new Date(ini);
      fin.setDate(ini.getDate() + 7);
      agregar('Semana ' + (s + 1), ini, fin);
    }
  } else if (periodo === 'todo') {
    for (let k = 5; k >= 0; k--) {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth() - k, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth() - k + 1, 1);
      agregar(ini.toLocaleDateString('es-CO', { month: 'short' }), ini, fin);
    }
  } else {
    for (let d = 6; d >= 0; d--) {
      const ini = new Date(hoy);
      ini.setHours(0, 0, 0, 0);
      ini.setDate(ini.getDate() - d);
      const fin = new Date(ini);
      fin.setDate(ini.getDate() + 1);
      agregar(ini.toLocaleDateString('es-CO', { weekday: 'short' }), ini, fin);
    }
  }
  return barras;
}

export function armarHtmlReporte(datos: DatosReporte) {
  const { esTienda, periodo, desde, ahora, r, actuales, anteriores, deudas, productos, aru } = datos;
  const recibidoAntes = sumar(anteriores, recibe);
  const salidas = r.gastos + r.compras;
  // productos que mas dinero dejaron en ventas
  const porProducto: Record<string, { monto: number; cantidad: number; unidad: string }> = {};
  for (const m of actuales.filter((x) => x.tipo === 'venta')) {
    const p = porProducto[m.producto] ?? { monto: 0, cantidad: 0, unidad: m.unidad };
    p.monto += m.monto;
    p.cantidad += m.cantidad;
    porProducto[m.producto] = p;
  }
  const top = Object.entries(porProducto)
    .sort((a, b) => b[1].monto - a[1].monto)
    .slice(0, 5)
    .map(([nombre, v]) => ({
      nombre,
      valor: v.monto,
      detalle: mostrarCantidad(v.cantidad) + ' ' + textoUnidad(v.cantidad, v.unidad),
    }));
  // gastos por tipo (lo que se escribio al anotarlos)
  const porGasto: Record<string, number> = {};
  for (const m of actuales.filter((x) => x.tipo === 'gasto')) {
    const k = m.nota.trim() || 'Otros';
    porGasto[k] = (porGasto[k] ?? 0) + m.monto;
  }
  const gastos = Object.entries(porGasto)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([nombre, valor]) => ({ nombre, valor }));
  const perdidas = actuales.filter((m) => m.tipo === 'perdida');

  // aru te aconseja: frases armadas solo con los numeros reales
  const consejos: string[] = [];
  if (actuales.length === 0)
    consejos.push(
      'Todavía no hay registros en este periodo. Cuando anotes tus ventas y gastos, aquí verás cómo va tu negocio.',
    );
  else {
    if (r.recibido > salidas)
      consejos.push(
        'En este periodo recibiste más dinero del que salió: te quedaron ' +
          dinero(r.recibido - salidas) +
          '.',
      );
    else if (salidas > r.recibido)
      consejos.push(
        'En este periodo salió ' +
          dinero(salidas - r.recibido) +
          ' más de lo que recibiste.' +
          (gastos[0]
            ? ' Tu gasto más grande fue en ' +
              gastos[0].nombre.toLowerCase() +
              ' (' +
              dinero(gastos[0].valor) +
              ').'
            : ''),
      );
    if (top[0])
      consejos.push('Lo que más dinero te dejó fue ' + top[0].nombre + ': ' + dinero(top[0].valor) + '.');
    if (esTienda && r.ventasConCosto > 0)
      consejos.push(
        'Tus ventas te dejaron ' +
          dinero(r.ganancia) +
          ' de ganancia sobre lo que te costó la mercancía.' +
          (r.ventasSinCosto > 0
            ? ' Hay ventas sin costo registrado: anota sus compras para calcularla completa.'
            : ''),
      );
    if (recibidoAntes > 0) {
      const cambio = Math.round((100 * (r.recibido - recibidoAntes)) / recibidoAntes);
      if (cambio !== 0)
        consejos.push(
          'Recibiste ' +
            Math.abs(cambio) +
            '% ' +
            (cambio > 0 ? 'más' : 'menos') +
            ' que en el periodo anterior.',
        );
    }
  }
  if (deudas.length > 0) {
    const vieja = deudas[0];
    const dias = Math.max(0, Math.round((ahora.getTime() - new Date(vieja.fecha).getTime()) / 86400000));
    consejos.push(
      'Te deben ' +
        dinero(r.porCobrar) +
        (deudas.length === 1 ? ' en una venta fiada' : ' en ' + deudas.length + ' ventas fiadas') +
        '. La más antigua' +
        (vieja.persona ? ' es de ' + vieja.persona : '') +
        ', de hace ' +
        dias +
        (dias === 1 ? ' día.' : ' días.'),
    );
  }
  if (perdidas.length > 0)
    consejos.push(
      'Anotaste ' +
        perdidas.length +
        (perdidas.length === 1 ? ' pérdida' : ' pérdidas') +
        '. Llevar la cuenta te ayuda a saber cuánto se está dañando.',
    );

  const tarjetas = [
    {
      t: 'Dinero recibido',
      v: dinero(r.recibido),
      d: 'Ventas pagadas y cobros: el dinero que de verdad llegó',
      fuerte: true,
    },
    { t: 'Ventas realizadas', v: dinero(r.vendido), d: 'Todo lo vendido, también lo fiado' },
    {
      t: esTienda ? 'Gastos y compras' : 'Gastos',
      v: dinero(salidas),
      d: esTienda
        ? 'Mercancía ' + dinero(r.compras) + ' · otros ' + dinero(r.gastos)
        : 'Lo que salió del negocio',
    },
    { t: 'Balance', v: dinero(r.balance), d: 'Recibido menos gastos', negativo: r.balance < 0 },
    { t: 'Por cobrar', v: dinero(r.porCobrar), d: 'Ventas fiadas sin pagar' },
  ];
  if (esTienda && r.ventasConCosto > 0)
    tarjetas.push({
      t: 'Ganancia en ventas',
      v: dinero(r.ganancia),
      d: 'Vendido menos su costo',
      negativo: r.ganancia < 0,
    });

  const nombreNegocio = datos.nombreNegocio;
  const lugar = datos.lugar;
  const periodoTexto = periodo === 'todo' ? 'Todos los registros' : fecha(desde) + ' al ' + fecha(ahora);
  const pie =
    '<div class="pie"><div>Generado el ' +
    fecha(ahora) +
    ' a las ' +
    ahora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) +
    (datos.ultimaSync
      ? ' · Última sincronización: ' + fecha(datos.ultimaSync)
      : ' · Datos guardados en este celular') +
    '</div><div>Registro personal de Sava · no es factura ni contabilidad oficial</div></div>' +
    llano;

  const html =
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:' +
    GRAFITO +
    ';background:#fff}' +
    '.pagina{width:210mm;min-height:297mm;padding:16mm 15mm 30mm;position:relative;page-break-after:always;background:#FFFDF9}.pagina:last-child{page-break-after:auto}' +
    '.cabeza{display:flex;align-items:center;justify-content:space-between;background:' +
    VERDE +
    ';color:#fff;border-radius:22px;padding:18px 22px;position:relative;overflow:hidden}' +
    '.cabeza:after{content:"";position:absolute;right:-40px;bottom:-60px;width:220px;height:160px;border-radius:50%;background:' +
    TERRACOTA +
    ';opacity:.18}' +
    '.marca{background:' +
    CREMA +
    ';border-radius:16px;padding:8px 10px;display:flex}.cabeza h1{margin:0;font-size:28px;letter-spacing:-.3px}.cabeza p{margin:4px 0 0;color:' +
    SALVIA +
    ';font-size:13px}' +
    '.periodo{display:inline-block;margin-top:8px;background:rgba(240,233,223,.18);border-radius:12px;padding:4px 10px;font-size:12px;font-weight:700}' +
    '.tarjetas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.tarjeta{background:#fff;border:1px solid #E6E1D8;border-radius:18px;padding:14px 16px;page-break-inside:avoid}' +
    '.tarjeta.fuerte{grid-column:1/-1;background:' +
    SALVIA +
    ';border-color:' +
    SALVIA +
    '}.tarjeta small{display:block;color:' +
    SUAVE +
    ';font-size:10px;letter-spacing:.8px;font-weight:800;text-transform:uppercase}' +
    '.tarjeta b{display:block;font-size:24px;margin-top:4px;color:' +
    VERDE +
    '}.tarjeta.fuerte b{font-size:32px}.tarjeta span{display:block;color:' +
    SUAVE +
    ';font-size:11px;margin-top:2px}.negativo b{color:#9A5B45}' +
    '.caja{background:#fff;border:1px solid #E6E1D8;border-radius:18px;padding:14px 16px;margin-top:14px;page-break-inside:avoid}.caja h2{margin:0 0 10px;font-size:16px;color:' +
    VERDE +
    '}' +
    '.leyenda{display:flex;gap:14px;font-size:11px;color:' +
    SUAVE +
    ';margin-bottom:6px}.leyenda i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:middle}' +
    '.dos{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fila{margin-bottom:9px}.fila-arriba{display:flex;justify-content:space-between;font-size:12.5px}.pista{height:8px;background:#F1EDE6;border-radius:6px;margin-top:4px;overflow:hidden}.pista div{height:8px;border-radius:6px}.fila small{color:' +
    SUAVE +
    ';font-size:10.5px}' +
    'table{width:100%;border-collapse:collapse;font-size:12px}td{padding:6px 2px;border-bottom:1px solid #F1EDE6}td:last-child{text-align:right;font-weight:700}' +
    '.vacio{color:' +
    SUAVE +
    ';font-size:12px;font-style:italic}' +
    '.aru{display:flex;gap:14px;align-items:flex-start;background:' +
    CREMA +
    ';border-radius:20px;padding:16px;margin-top:14px;border:1.5px solid ' +
    SALVIA +
    ';page-break-inside:avoid}.aru img{width:74px;height:65px;object-fit:contain}' +
    '.aru h2{margin:0 0 6px;font-size:16px;color:' +
    VERDE +
    '}.aru li{font-size:12.5px;line-height:1.5;margin-bottom:4px}.aru ul{margin:0;padding-left:16px}' +
    '.titulo2{display:flex;align-items:center;gap:10px}.titulo2 h1{font-size:22px;margin:0;color:' +
    VERDE +
    '}' +
    '.pie{position:absolute;left:15mm;right:15mm;bottom:15mm;font-size:9.5px;color:' +
    SUAVE +
    ';display:flex;justify-content:space-between;gap:10px;z-index:2}.llano{position:absolute;left:0;bottom:0;width:100%;height:20mm}' +
    '</style></head><body>' +
    // pagina 1: resumen
    '<div class="pagina"><div class="cabeza"><div><h1>Así va tu negocio</h1><p>' +
    escapar(nombreNegocio) +
    ' · ' +
    escapar(lugar) +
    '</p><span class="periodo">' +
    nombrePeriodo[periodo] +
    ' · ' +
    escapar(periodoTexto) +
    '</span></div><div class="marca">' +
    logoSvg(58) +
    '</div></div>' +
    '<div class="tarjetas">' +
    tarjetas
      .map(
        (t) =>
          '<div class="tarjeta' +
          (t.fuerte ? ' fuerte' : '') +
          (t.negativo ? ' negativo' : '') +
          '"><small>' +
          t.t +
          '</small><b>' +
          t.v +
          '</b><span>' +
          t.d +
          '</span></div>',
      )
      .join('') +
    '</div>' +
    '<div class="caja"><h2>Dinero que entró y que salió</h2><div class="leyenda"><span><i style="background:' +
    VERDE +
    '"></i>Entró</span><span><i style="background:' +
    TERRACOTA +
    '"></i>Salió (gastos' +
    (esTienda ? ' y compras' : '') +
    ')</span></div>' +
    (actuales.length > 0
      ? grafica(barrasDelPeriodo(actuales, periodo, desde))
      : '<p class="vacio">Sin movimientos en este periodo.</p>') +
    '</div>' +
    (aru ? '<div class="aru"><img src="' + aru + '"/>' : '<div class="aru">') +
    '<div><h2>Aru te aconseja</h2><ul>' +
    consejos.map((c) => '<li>' + escapar(c) + '</li>').join('') +
    '</ul></div></div>' +
    pie +
    '</div>' +
    // pagina 2: analisis
    '<div class="pagina"><div class="titulo2"><div class="marca" style="background:' +
    SALVIA +
    ';border-radius:14px;padding:6px 8px">' +
    logoSvg(36) +
    '</div><h1>Cómo se mueve tu negocio</h1></div>' +
    '<div class="dos"><div class="caja"><h2>' +
    (esTienda ? 'Productos más vendidos' : 'Cosechas que más vendiste') +
    '</h2>' +
    (top.length ? listaBarras(top, VERDE) : '<p class="vacio">Sin ventas en este periodo.</p>') +
    '</div>' +
    '<div class="caja"><h2>' +
    (esTienda ? 'Otros gastos del local' : 'Gastos por tipo') +
    '</h2>' +
    (gastos.length
      ? listaBarras(gastos, TERRACOTA)
      : '<p class="vacio">Sin gastos anotados en este periodo.</p>') +
    '</div></div>' +
    '<div class="dos"><div class="caja"><h2>Te deben</h2>' +
    (deudas.length
      ? '<table>' +
        deudas
          .slice(0, 8)
          .map(
            (d) =>
              '<tr><td>' +
              escapar(d.producto) +
              (d.persona ? ' · ' + escapar(d.persona) : '') +
              '<br><small style="color:' +
              SUAVE +
              '">' +
              fecha(d.fecha) +
              '</small></td><td>' +
              dinero(d.debe) +
              '</td></tr>',
          )
          .join('') +
        '</table>'
      : '<p class="vacio">Nadie te debe. ¡Bien!</p>') +
    '</div>' +
    '<div class="caja"><h2>' +
    (esTienda ? 'Mercancía disponible' : 'Lo que tienes disponible') +
    '</h2>' +
    (productos.length
      ? '<table>' +
        productos
          .map(
            (p) =>
              '<tr><td>' +
              escapar(p.name) +
              '</td><td>' +
              mostrarCantidad(p.stock) +
              ' ' +
              textoUnidad(p.stock, p.unit) +
              '</td></tr>',
          )
          .join('') +
        '</table>'
      : '<p class="vacio">Sin productos con cantidad disponible.</p>') +
    '</div></div>' +
    (perdidas.length
      ? '<div class="caja"><h2>Pérdidas registradas</h2><table>' +
        perdidas
          .slice(0, 6)
          .map(
            (p) =>
              '<tr><td>' +
              escapar(p.producto) +
              (p.nota ? ' · ' + escapar(p.nota) : '') +
              '</td><td>' +
              mostrarCantidad(p.cantidad) +
              ' ' +
              textoUnidad(p.cantidad, p.unidad) +
              '</td></tr>',
          )
          .join('') +
        '</table></div>'
      : '') +
    (periodo !== 'todo'
      ? '<div class="caja"><h2>Comparado con el periodo anterior</h2>' +
        (anteriores.length
          ? '<table><tr><td>Dinero recibido</td><td>' +
            dinero(recibidoAntes) +
            ' → ' +
            dinero(r.recibido) +
            '</td></tr><tr><td>Gastos' +
            (esTienda ? ' y compras' : '') +
            '</td><td>' +
            dinero(sumar(anteriores, (m) => m.tipo === 'gasto' || m.tipo === 'compra')) +
            ' → ' +
            dinero(salidas) +
            '</td></tr></table>'
          : '<p class="vacio">No hay registros del periodo anterior para comparar.</p>') +
        '</div>'
      : '') +
    pie +
    '</div></body></html>';

  return html;
}
