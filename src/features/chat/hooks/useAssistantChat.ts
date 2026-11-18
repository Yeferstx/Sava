import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ProductDraft, Recomendacion, VentaPropuesta } from '../types';
import { entender, normalizar, seParece, type Periodo } from '../maria';
import { categoriaDeProducto, categoriaVisible, esInsumo } from '../../../shared/agro';
import { listProducts } from '../../inventory/data/inventoryRepository';
import { recordSale, ventasDesde } from '../../sales/data/salesRepository';
import { cargarMercado, municipioDe, negocioDe } from '../../marketplace/data/mercadoRepository';
import { dinero, textoPrecio } from '../../../shared/contacto';
import { mostrarCantidad, textoUnidad } from '../../../shared/validaciones';
import { callar, hablar } from '../../../shared/voz';
import { getDatabase } from '../../../infrastructure/database/database';
import { preguntarAMaria, type AccionIA } from '../mariaIA';
import { escucharSenal, guardarPendiente, hayInternet, listarPendientes, quitarPendiente } from '../pendientes';
import { borrarAudio, prepararSinInternet, transcribirAudio } from '../../../shared/escucha';

// tipoVendedor: 'agricultor' o 'tienda' si la persona vende, '' si solo compra
type TipoVendedor = 'agricultor' | 'tienda' | '';

// saludo corto. el nombre del asistente todavia no esta definido
function bienvenida(): ChatMessage {
  return { id: 'bienvenida', author: 'assistant', text: '¡Hola! Soy tu asistente de Sava. ¿En qué te ayudo hoy?' };
}

// ejemplos de lo que entiende, segun quien usa la app
function textoAyuda(tipo: TipoVendedor) {
  let texto = 'Dime qué necesitas comprar y te digo quién lo tiene. Por ejemplo: «necesito 50 kilos de piña» o «busco abono en Aguazul».';
  if (tipo === 'agricultor') texto = 'Puedes decirme: «tengo 200 kilos de piña a 2.500», «vendí 10 kilos de yuca», «¿cuánta papaya me queda?» o «¿cuánto vendí esta semana?».';
  if (tipo === 'tienda') texto = 'Puedes decirme: «tengo 20 bultos de abono a 95 mil», «vendí 2 litros de herbicida», «¿cuánto abono me queda?» o «¿cuánto vendí hoy?».';
  return texto;
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
  const [messages, setMessages] = useState<ChatMessage[]>([bienvenida()]);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [venta, setVenta] = useState<VentaPropuesta | null>(null);
  const [pensando, setPensando] = useState(false);
  // true cuando la ultima respuesta vino de la inteligencia artificial
  const [conIA, setConIA] = useState(false);
  // maria habla por defecto; si la persona la silencia se recuerda en el celular
  const [leerEnVoz, setLeerEnVoz] = useState(true);
  // borrador al que le falta la cantidad o el precio
  const pendiente = useRef<{ draft: ProductDraft; falta: 'cantidad' | 'precio' } | null>(null);
  const contador = useRef(0);
  // sin senal: lo que necesita internet queda guardado y se responde cuando vuelve
  const [sinSenal, setSinSenal] = useState(false);
  const [enEspera, setEnEspera] = useState(0);
  const ocupado = useRef(false);
  // valores actuales para las funciones que corren cuando vuelve la senal
  const actual = useRef({ messages, leerEnVoz });
  actual.current = { messages, leerEnVoz };
  const revisarCola = useRef<() => Promise<void>>(async () => undefined);
  revisarCola.current = responderPendientes;

  // al abrir la app y cada vez que vuelve la senal se responden los mensajes guardados
  useEffect(() => {
    void hayInternet().then((conSenal) => { setSinSenal(!conSenal); if (conSenal) { void revisarCola.current(); void prepararSinInternet(); } });
    void listarPendientes().then((lista) => setEnEspera(lista.length)).catch(() => undefined);
    return escucharSenal((conSenal) => {
      setSinSenal(!conSenal);
      if (conSenal) setTimeout(() => void revisarCola.current(), 1500);
    });
  }, []);

  // si cambia la cuenta (entra o sale) maria vuelve a saludar
  useEffect(() => { resetChat(); }, [tipo]);

  useEffect(() => {
    void getDatabase().then((db) => db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'maria_voz')).then((fila) => {
      if (fila && fila.value === 'no') setLeerEnVoz(false);
    }).catch(() => undefined);
  }, []);

  function nuevoId() {
    contador.current = contador.current + 1;
    return Date.now() + '-' + contador.current;
  }

  function responder(texto: string, recomendaciones?: Recomendacion[]) {
    setMessages((lista) => [...lista, { id: nuevoId(), author: 'assistant', text: texto, recomendaciones }]);
    if (actual.current.leerEnVoz) void hablar(texto);
  }

  // audio: la nota de voz de la persona (si el celular la guardo).
  // si no se entendio sin senal, llega solo el audio y se responde cuando vuelva el internet
  async function sendMessage(text: string, audio = '') {
    const valor = text.trim();
    if ((!valor && !audio) || ocupado.current) return;
    const id = nuevoId();
    if (!valor) {
      setMessages((lista) => [...lista, { id, author: 'user', text: 'Nota de voz', audio, pendiente: true }]);
      await dejarEnEspera(id, '', audio);
      responder('Sin señal no pude entender tu nota de voz. La guardé y te respondo apenas vuelva el internet.');
      return;
    }
    setMessages((lista) => [...lista, { id, author: 'user', text: valor, audio: audio || undefined }]);
    ocupado.current = true;
    setPensando(true);
    try {
      const listo = await resolver(valor);
      if (!listo) {
        setMessages((lista) => lista.map((m) => (m.id === id ? { ...m, pendiente: true } : m)));
        await dejarEnEspera(id, valor, audio);
        responder('Ahora no tienes señal. Guardé tu mensaje y te respondo apenas vuelva el internet.');
      }
    }
    catch (error) { responder('Tuve un problema: ' + (error instanceof Error ? error.message : 'intenta de nuevo.')); }
    finally { ocupado.current = false; setPensando(false); }
  }

  // primero las reglas del celular (gratis y sin internet).
  // la ia solo se usa cuando las reglas no entienden el mensaje.
  // devuelve false si hace falta internet y no hay (el mensaje queda en espera)
  async function resolver(valor: string) {
    const intencion = entender(valor);
    const necesitaInternet = !pendiente.current && (intencion.tipo === 'nada' || intencion.tipo === 'buscar');
    if (necesitaInternet && !(await hayInternet())) return false;
    let resuelto = false;
    if (!pendiente.current && intencion.tipo === 'nada') resuelto = await usarIA(valor);
    setConIA(resuelto);
    if (!resuelto) await procesar(valor);
    return true;
  }

  async function dejarEnEspera(id: string, texto: string, audio: string) {
    try { await guardarPendiente(id, texto, audio); } catch { /* si falla se pierde solo este mensaje */ }
    setEnEspera((n) => n + 1);
  }

  // vuelve la senal: se responde cada mensaje guardado, en orden
  async function responderPendientes() {
    if (ocupado.current) return;
    let lista;
    try { lista = await listarPendientes(); } catch { return; }
    setEnEspera(lista.length);
    if (lista.length === 0 || !(await hayInternet())) return;
    ocupado.current = true;
    setPensando(true);
    try {
      for (const item of lista) {
        let texto = item.texto;
        if (texto === '' && item.audio !== '') texto = await transcribirAudio(item.audio);
        const enPantalla = actual.current.messages.some((m) => m.id === item.id);
        if (texto === '') {
          responder('No pude entender la nota de voz que dejaste sin señal. ¿Me la repites?');
        } else {
          // el mensaje sigue en el chat: se quita la marca de espera. si la app se cerro, se vuelve a mostrar
          if (enPantalla) setMessages((mensajes) => mensajes.map((m) => (m.id === item.id ? { ...m, text: texto, pendiente: false } : m)));
          else setMessages((mensajes) => [...mensajes, { id: item.id, author: 'user', text: texto, audio: item.audio || undefined }]);
          responder('Ya volvió la señal. Sobre lo que me dijiste: «' + texto + '»');
          const listo = await resolver(texto);
          if (!listo) break;
        }
        await quitarPendiente(item.id);
        setEnEspera((n) => Math.max(0, n - 1));
        // el audio se borra si ya no esta en el chat
        if (!enPantalla && item.audio !== '') borrarAudio(item.audio);
      }
    }
    catch { /* se reintenta la proxima vez que vuelva la senal */ }
    finally { ocupado.current = false; setPensando(false); }
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

    if (intencion.tipo === 'saludo') { responder('¡Hola! ' + textoAyuda(tipo)); return; }
    if (intencion.tipo === 'gracias') { responder('¡Con gusto! Aquí estoy cuando me necesites.'); return; }
    if (intencion.tipo === 'ayuda') { responder(textoAyuda(tipo) + ' También puedes hablarme con el micrófono.'); return; }
    if (intencion.tipo === 'compradores') {
      if (vende) responder('Para encontrar compradores: publica tu producto con una foto real y buen precio, compártelo por WhatsApp desde «Mis cosechas» y responde rápido las consultas. Los compradores de Casanare te ven en el Inicio.');
      else responder('Si tienes algo para vender, toca «Vender» abajo, registra tu finca o tienda y publica tu producto. Así los compradores de Casanare te encuentran.');
      return;
    }
    if (intencion.tipo === 'pedirVenta') {
      if (vende) responder('Claro. Dime qué vendiste y cuánto, por ejemplo: «vendí 10 kilos de yuca a 2.000».');
      else responder('Eso es para quien vende en Sava. Si tienes cosecha o una tienda del campo, toca «Vender» abajo para registrarte.');
      return;
    }

    if (intencion.tipo === 'buscar') { await buscar(nombreOriginal(valor, intencion.producto).toLocaleLowerCase('es-CO'), intencion.municipio, intencion.cantidad, intencion.soloPrecio); return; }

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

  // le pregunta a claude por medio de la funcion de supabase.
  // devuelve false si la ia no esta disponible (sin internet, sin cuenta o sin configurar)
  async function usarIA(valor: string) {
    const historial: Array<{ autor: 'user' | 'assistant'; texto: string }> = [];
    for (const mensaje of actual.current.messages) {
      if (mensaje.id === 'bienvenida' || mensaje.pendiente) continue;
      historial.push({ autor: mensaje.author, texto: mensaje.text });
    }
    const respuesta = await preguntarAMaria(valor, historial, tipo);
    if (!respuesta) return false;
    const accion = respuesta.accion;
    if (!accion) {
      if (respuesta.texto === '') return false;
      responder(respuesta.texto);
      return true;
    }
    await ejecutarAccion(accion, respuesta.texto);
    return true;
  }

  // la ia solo propone: aqui se convierte en una tarjeta que la persona confirma
  async function ejecutarAccion(accion: AccionIA, texto: string) {
    const vende = tipo !== '';
    if (accion.tipo === 'buscar_en_mercado') {
      await buscar(accion.datos.producto, accion.datos.municipio, accion.datos.cantidad);
      return;
    }
    if (!vende) { responder('Eso es para quien vende en Sava. Si tienes cosecha o una tienda del campo, toca «Vender» abajo para registrarte.'); return; }
    if (accion.tipo === 'registrar_venta') {
      await prepararVenta(accion.datos.producto, accion.datos.cantidad, accion.datos.precio_unitario_cop, 0);
      return;
    }
    const datos = accion.datos;
    let categoria = categoriaVisible(datos.categoria);
    if (tipo === 'tienda' && !esInsumo(categoria)) categoria = 'Otros insumos';
    const borrador: ProductDraft = { name: datos.nombre, category: categoria, description: datos.descripcion, price_cop: Math.round(datos.precio_cop), stock: datos.cantidad, unit: datos.unidad };
    setDraft(borrador);
    setVenta(null);
    let mensaje = texto;
    if (mensaje === '') mensaje = 'Preparé esta publicación: ' + borrador.name + ', ' + mostrarCantidad(borrador.stock) + ' ' + textoUnidad(borrador.stock, borrador.unit) + ' a ' + dinero(borrador.price_cop) + ' cada ' + borrador.unit + '. Revísala y toca «Confirmar».';
    responder(mensaje);
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
    // publicacion con precio a convenir: hay que saber a como se vendio
    if (unitario <= 0 && total <= 0) { responder('¿A cómo vendiste cada ' + encontrado.unit + '? Dime, por ejemplo: «vendí ' + mostrarCantidad(cantidad) + ' ' + textoUnidad(cantidad, encontrado.unit) + ' de ' + encontrado.name.toLowerCase() + ' a 2.000».'); return; }
    if (unitario <= 0) unitario = Math.round(total / cantidad);
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
          responder('Te quedan ' + mostrarCantidad(item.stock) + ' ' + textoUnidad(item.stock, item.unit) + ' de ' + item.name + '. ' + textoPrecio(item.price_cop, item.unit) + '.');
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

  async function buscar(producto: string, municipio: string, cantidad: number, soloPrecio = false) {
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
    // pregunta de precio: se responde con el rango real de lo publicado en sava
    if (soloPrecio && (opciones.length > 0 || otrasZonas.length > 0)) {
      let lista = opciones;
      if (lista.length === 0) lista = otrasZonas;
      const unidad = lista[0].product.unit;
      let menor = 0;
      let mayor = 0;
      for (const op of lista) {
        if (op.product.unit !== unidad || op.product.price_cop <= 0) continue;
        if (menor === 0 || op.product.price_cop < menor) menor = op.product.price_cop;
        if (op.product.price_cop > mayor) mayor = op.product.price_cop;
      }
      let rango = 'a ' + dinero(menor);
      if (mayor > menor) rango = 'entre ' + dinero(menor) + ' y ' + dinero(mayor);
      responder('En Sava, ' + producto + ' se está publicando ' + rango + ' por ' + unidad + lugar + '. Estas son algunas opciones:', lista.slice(0, 3));
      return;
    }
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
    // las notas de voz ya respondidas se borran del celular
    for (const mensaje of actual.current.messages) { if (mensaje.audio && !mensaje.pendiente) borrarAudio(mensaje.audio); }
    setMessages([bienvenida()]);
    setDraft(null);
    setVenta(null);
    pendiente.current = null;
  }

  function cambiarVoz() {
    const nuevo = !leerEnVoz;
    setLeerEnVoz(nuevo);
    if (nuevo) void hablar('Listo, te voy a hablar en voz alta.');
    else callar();
    let valor = 'no';
    if (nuevo) valor = 'si';
    void getDatabase().then((db) => db.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'maria_voz', valor)).catch(() => undefined);
  }

  // al abrir el chat maria saluda en voz alta si la conversacion esta empezando
  function alAbrir() {
    if (leerEnVoz && messages.length === 1) void hablar(messages[0].text);
  }

  return { messages, draft, venta, pensando, leerEnVoz, conIA, sinSenal, enEspera, sendMessage, confirmDraft, confirmarVenta, cancelarVenta, resetChat, cambiarVoz, alAbrir };
}
