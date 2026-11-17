import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ProductDraft, Recomendacion, VentaPropuesta } from '../types';
import { entender, normalizar, seParece, type Periodo } from '../maria';
import { categoriaDeProducto, categoriaVisible, esInsumo } from '../../../shared/agro';
import { listProducts } from '../../inventory/data/inventoryRepository';
import { recordSale, ventasDesde } from '../../sales/data/salesRepository';
import { cargarMercado, municipioDe, negocioDe } from '../../marketplace/data/mercadoRepository';
import { dinero } from '../../../shared/contacto';
import { mostrarCantidad, textoUnidad } from '../../../shared/validaciones';
import { hablar } from '../../../shared/voz';

// tipoVendedor: 'agricultor' o 'tienda' si la persona vende, '' si solo compra
type TipoVendedor = 'agricultor' | 'tienda' | '';

function bienvenida(tipo: TipoVendedor): ChatMessage {
  let texto = '¡Hola! Soy María. Dime qué necesitas comprar y te digo quién lo tiene. Por ejemplo: «necesito 50 kilos de piña» o «busco abono en Aguazul».';
  if (tipo === 'agricultor') texto = '¡Hola! Soy María. Puedes decirme: «tengo 200 kilos de piña a 2.500», «vendí 10 kilos de yuca», «¿cuánta papaya me queda?» o «¿cuánto vendí esta semana?».';
  if (tipo === 'tienda') texto = '¡Hola! Soy María. Puedes decirme: «tengo 20 bultos de abono a 95 mil», «vendí 2 litros de herbicida», «¿cuánto abono me queda?» o «¿cuánto vendí hoy?».';
  return { id: 'bienvenida', author: 'assistant', text: texto };
}

// recupera el nombre con tildes tal como lo escribio la persona ("pina" -> "piña")
function nombreOriginal(mensaje: string, producto: string) {
  const palabras = mensaje.replace(/[¿?¡!,;:."]/g, ' ').split(/\s+/);
  const cuantas = producto.split(' ').length;
  for (let i = 0; i + cuantas <= palabras.length; i++) {
    const trozo = palabras.slice(i, i + cuantas).join(' ');
    if (normalizar(trozo) === producto) return trozo.charAt(0).toLocaleUpperCase('es-CO') + trozo.slice(1).toLocaleLowerCase('es-CO');
  }
  return producto.charAt(0).toUpperCase() + producto.slice(1);
}

function desdeCuando(periodo: Periodo) {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  if (periodo === 'semana') fecha.setDate(fecha.getDate() - 6);
  if (periodo === 'mes') fecha.setDate(1);
  return fecha;
}

export function useAssistantChat(tipo: TipoVendedor) {
  const [messages, setMessages] = useState<ChatMessage[]>([bienvenida(tipo)]);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [venta, setVenta] = useState<VentaPropuesta | null>(null);
  const [pensando, setPensando] = useState(false);
  const [leerEnVoz, setLeerEnVoz] = useState(false);
  // borrador al que le falta la cantidad o el precio
  const pendiente = useRef<{ draft: ProductDraft; falta: 'cantidad' | 'precio' } | null>(null);
  const contador = useRef(0);

  // si cambia la cuenta (entra o sale) maria vuelve a saludar
  useEffect(() => { resetChat(); }, [tipo]);

  function nuevoId() {
    contador.current = contador.current + 1;
    return Date.now() + '-' + contador.current;
  }

  function responder(texto: string, recomendaciones?: Recomendacion[]) {
    setMessages((actual) => [...actual, { id: nuevoId(), author: 'assistant', text: texto, recomendaciones }]);
    if (leerEnVoz) hablar(texto);
  }

  async function sendMessage(text: string) {
    const valor = text.trim();
    if (!valor || pensando) return;
    setMessages((actual) => [...actual, { id: nuevoId(), author: 'user', text: valor }]);
    setPensando(true);
    try { await procesar(valor); }
    catch (error) { responder('Tuve un problema: ' + (error instanceof Error ? error.message : 'intenta de nuevo.')); }
    finally { setPensando(false); }
  }

  async function procesar(valor: string) {
    const intencion = entender(valor);
    const vende = tipo !== '';
    let unidadNormal = 'kg';
    if (tipo === 'tienda') unidadNormal = 'unidad';

    // respuesta a una pregunta de maria (falta cantidad o precio)
    if (pendiente.current) {
      const espera = pendiente.current;
      if (espera.falta === 'precio' && intencion.tipo === 'precio') {
        pendiente.current = null;
        mostrarBorrador({ ...espera.draft, price_cop: intencion.precio });
        return;
      }
      if (espera.falta === 'cantidad') {
        const numero = Number(normalizar(valor).replace(/[^\d.,]/g, '').replace(',', '.'));
        if (numero > 0) {
          const conCantidad = { ...espera.draft, stock: numero };
          if (conCantidad.price_cop > 0) { pendiente.current = null; mostrarBorrador(conCantidad); }
          else { pendiente.current = { draft: conCantidad, falta: 'precio' }; responder('¿A cómo vendes cada ' + conCantidad.unit + '?'); }
          return;
        }
      }
      pendiente.current = null;
    }

    if (intencion.tipo === 'saludo') { responder(bienvenida(tipo).text); return; }
    if (intencion.tipo === 'gracias') { responder('¡Con gusto! Aquí estoy cuando me necesites.'); return; }
    if (intencion.tipo === 'ayuda') { responder(bienvenida(tipo).text + ' También puedes hablarme: toca el micrófono de tu teclado.'); return; }

    if (intencion.tipo === 'buscar') { await buscar(intencion.producto, intencion.municipio, intencion.cantidad); return; }

    // lo que sigue es para quien vende
    if (intencion.tipo === 'publicar' || intencion.tipo === 'venta' || intencion.tipo === 'inventario' || intencion.tipo === 'resumen') {
      if (!vende) { responder('Eso es para quien vende en Sava. Si tienes cosecha o una tienda del campo, toca «Vender» abajo para registrarte.'); return; }
    }

    if (intencion.tipo === 'publicar') {
      let unidad = intencion.unidad;
      if (unidad === '') unidad = unidadNormal;
      const nombre = nombreOriginal(valor, intencion.producto);
      let categoria = categoriaVisible(categoriaDeProducto(nombre));
      // en una tienda todo lo que no se reconoce va a otros insumos
      if (tipo === 'tienda' && !esInsumo(categoria)) categoria = 'Otros insumos';
      const borrador: ProductDraft = { name: nombre, category: categoria, description: '', price_cop: intencion.precio, stock: intencion.cantidad, unit: unidad };
      if (borrador.stock <= 0) { pendiente.current = { draft: borrador, falta: 'cantidad' }; responder('¿Cuántos ' + textoUnidad(2, unidad) + ' de ' + nombre.toLowerCase() + ' tienes?'); return; }
      if (borrador.price_cop <= 0) { pendiente.current = { draft: borrador, falta: 'precio' }; responder('¿A cómo vendes cada ' + unidad + ' de ' + nombre.toLowerCase() + '?'); return; }
      mostrarBorrador(borrador);
      return;
    }

    if (intencion.tipo === 'venta') { await prepararVenta(intencion.producto, intencion.cantidad, intencion.precio, intencion.total); return; }
    if (intencion.tipo === 'inventario') { await contarInventario(intencion.producto); return; }
    if (intencion.tipo === 'resumen') { await resumir(intencion.periodo); return; }

    if (intencion.tipo === 'precio') { responder('¿Ese precio para qué producto es? Dime, por ejemplo: «tengo 30 racimos de plátano a 25 mil».'); return; }

    if (vende) responder('No te entendí. Prueba con frases como «vendí 10 kilos de yuca» o «¿cuánto vendí esta semana?».');
    else responder('No te entendí. Dime qué buscas, por ejemplo «necesito plátano en Yopal».');
  }

  function mostrarBorrador(borrador: ProductDraft) {
    setDraft(borrador);
    setVenta(null);
    responder('Preparé esta publicación: ' + borrador.name + ', ' + mostrarCantidad(borrador.stock) + ' ' + textoUnidad(borrador.stock, borrador.unit) + ' a ' + dinero(borrador.price_cop) + ' cada ' + borrador.unit + '. Revísala y toca «Confirmar» para publicarla.');
  }

  async function prepararVenta(producto: string, cantidad: number, precio: number, total: number) {
    const productos = await listProducts();
    let encontrado = null;
    for (const item of productos) {
      if (seParece(item.name, producto)) { encontrado = item; break; }
    }
    if (!encontrado) {
      responder('No encontré «' + producto + '» entre tus publicaciones. Primero publícalo y luego registro la venta.');
      return;
    }
    if (cantidad > encontrado.stock) {
      responder('Solo tienes ' + mostrarCantidad(encontrado.stock) + ' ' + textoUnidad(encontrado.stock, encontrado.unit) + ' de ' + encontrado.name + '. Revisa la cantidad.');
      return;
    }
    let unitario = encontrado.price_cop;
    if (precio > 0) unitario = precio;
    let totalVenta = Math.round(unitario * cantidad);
    if (total > 0) totalVenta = total;
    const propuesta: VentaPropuesta = { productId: encontrado.id, nombre: encontrado.name, cantidad, unidad: encontrado.unit, precio: unitario, total: totalVenta, quedan: encontrado.stock - cantidad };
    setVenta(propuesta);
    setDraft(null);
    responder('Vendiste ' + mostrarCantidad(cantidad) + ' ' + textoUnidad(cantidad, encontrado.unit) + ' de ' + encontrado.name + ' por ' + dinero(totalVenta) + '. ¿La registro? Te quedarían ' + mostrarCantidad(propuesta.quedan) + ' ' + textoUnidad(propuesta.quedan, encontrado.unit) + '.');
  }

  async function confirmarVenta() {
    if (!venta) return;
    const propuesta = venta;
    try {
      await recordSale(propuesta.productId, propuesta.cantidad, propuesta.precio);
      setVenta(null);
      responder('¡Listo! Registré la venta de ' + propuesta.nombre + ' por ' + dinero(propuesta.total) + '. Te quedan ' + mostrarCantidad(propuesta.quedan) + ' ' + textoUnidad(propuesta.quedan, propuesta.unidad) + '.');
    } catch (error) {
      responder('No pude registrar la venta: ' + (error instanceof Error ? error.message : 'intenta de nuevo.'));
    }
  }

  function cancelarVenta() {
    setVenta(null);
    responder('Listo, no registré nada.');
  }

  async function contarInventario(producto: string) {
    const productos = await listProducts();
    if (productos.length === 0) { responder('Todavía no tienes publicaciones. Dime, por ejemplo: «tengo 100 kilos de yuca a 2.000».'); return; }
    if (producto !== '') {
      for (const item of productos) {
        if (seParece(item.name, producto)) {
          responder('Te quedan ' + mostrarCantidad(item.stock) + ' ' + textoUnidad(item.stock, item.unit) + ' de ' + item.name + ', a ' + dinero(item.price_cop) + ' cada ' + item.unit + '.');
          return;
        }
      }
      responder('No encontré «' + producto + '» en tus publicaciones.');
      return;
    }
    const lineas: string[] = [];
    for (const item of productos.slice(0, 8)) lineas.push(item.name + ': ' + mostrarCantidad(item.stock) + ' ' + textoUnidad(item.stock, item.unit));
    responder('Esto es lo que tienes:\n' + lineas.join('\n'));
  }

  async function resumir(periodo: Periodo) {
    const ventas = await ventasDesde(desdeCuando(periodo));
    let cuando = 'esta semana';
    if (periodo === 'hoy') cuando = 'hoy';
    if (periodo === 'mes') cuando = 'este mes';
    if (ventas.length === 0) { responder('No tienes ventas registradas ' + cuando + '.'); return; }
    let total = 0;
    const porProducto: Record<string, number> = {};
    for (const item of ventas) {
      total = total + item.total_cop;
      porProducto[item.product_name] = (porProducto[item.product_name] ?? 0) + item.total_cop;
    }
    let mejor = '';
    let mejorTotal = 0;
    for (const nombre of Object.keys(porProducto)) {
      if (porProducto[nombre] > mejorTotal) { mejor = nombre; mejorTotal = porProducto[nombre]; }
    }
    let veces = ventas.length + ' ventas';
    if (ventas.length === 1) veces = '1 venta';
    responder('Vendiste ' + dinero(total) + ' ' + cuando + ' en ' + veces + '. Lo que más te dejó fue ' + mejor + ' con ' + dinero(mejorTotal) + '.');
  }

  async function buscar(producto: string, municipio: string, cantidad: number) {
    if (producto === '') { responder('¿Qué estás buscando? Dime el producto, por ejemplo «plátano» o «semillas de maíz».'); return; }
    let mercado;
    try { mercado = await cargarMercado(); }
    catch { responder('Para buscar quién vende necesito internet. Revisa tu conexión e intenta otra vez.'); return; }
    const opciones: Recomendacion[] = [];
    const otrasZonas: Recomendacion[] = [];
    for (const item of mercado.products) {
      if (item.stock <= 0) continue;
      if (!seParece(item.name, producto) && !seParece(item.category, producto)) continue;
      const recomendacion = { product: item, business: negocioDe(mercado, item) };
      if (municipio === '' || municipioDe(mercado, item) === municipio) opciones.push(recomendacion);
      else otrasZonas.push(recomendacion);
    }
    let lugar = '';
    if (municipio !== '') lugar = ' en ' + municipio;
    if (opciones.length > 0) {
      let aviso = '';
      if (cantidad > 0) {
        let alcanzan = 0;
        for (const op of opciones) { if (op.product.stock >= cantidad) alcanzan = alcanzan + 1; }
        if (alcanzan === 0) aviso = ' Ninguno tiene esa cantidad completa, pero puedes juntar varios.';
      }
      responder('Encontré ' + opciones.length + ' ' + (opciones.length === 1 ? 'opción' : 'opciones') + lugar + '. Puedes escribirle al vendedor por WhatsApp.' + aviso, opciones.slice(0, 3));
      return;
    }
    if (otrasZonas.length > 0) {
      responder('No hay' + lugar + ', pero sí en otros municipios de Casanare:', otrasZonas.slice(0, 3));
      return;
    }
    responder('Todavía nadie ha publicado «' + producto + '»' + lugar + '. Vuelve a preguntarme en unos días.');
  }

  function confirmDraft() {
    setDraft(null);
    responder('¡Listo! La publicación quedó guardada. Si no hay internet, se sube sola cuando vuelva la señal.');
  }

  function resetChat() {
    setMessages([bienvenida(tipo)]);
    setDraft(null);
    setVenta(null);
    pendiente.current = null;
  }

  function cambiarVoz() {
    const nuevo = !leerEnVoz;
    setLeerEnVoz(nuevo);
    if (nuevo) hablar('Listo, voy a leer mis respuestas en voz alta.');
  }

  return { messages, draft, venta, pensando, leerEnVoz, sendMessage, confirmDraft, confirmarVenta, cancelarVenta, resetChat, cambiarVoz };
}
