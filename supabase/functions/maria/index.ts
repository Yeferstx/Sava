// funcion de supabase (deno) que conecta a maria con claude.
// la clave de anthropic vive aqui como secreto, nunca dentro de la app.
// claude entiende el mensaje y, si hace falta, propone una accion con una herramienta.
// la app muestra esa accion y la persona la confirma antes de guardar nada.

import Anthropic from "npm:@anthropic-ai/sdk@1.9.0";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const cabeceras = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const categorias = [
  "Plátano y banano", "Yuca y tubérculos", "Piña", "Papaya", "Patilla", "Ahuyama", "Maracuyá y frutas", "Hortalizas", "Otros",
  "Semillas", "Abonos y fertilizantes", "Agroquímicos", "Herramientas", "Alimento para animales", "Otros insumos",
];
const unidades = ["kg", "bulto", "caja", "racimo", "unidad", "libra", "litro", "galón"];
const municipios = [
  "", "Yopal", "Aguazul", "Chámeza", "Hato Corozal", "La Salina", "Maní", "Monterrey", "Nunchía", "Orocué", "Paz de Ariporo",
  "Pore", "Recetor", "Sabanalarga", "Sácama", "San Luis de Palenque", "Támara", "Tauramena", "Trinidad", "Villanueva",
];

// instrucciones fijas (no cambian entre mensajes, asi se aprovecha la cache)
const sistema = `Eres María, la asistente de Sava, una app que conecta a campesinos y tiendas del campo de Casanare (Colombia) con compradores.

Quién te habla:
- Muchas personas leen y escriben poco, y a veces te dictan por voz: entiende frases mal escritas, sin tildes o con palabras del llano.
- Tus respuestas se leen en voz alta. Responde en español colombiano, cálido y sencillo, en 1 a 3 frases cortas. Sin listas largas, sin emojis, sin asteriscos ni formato.

Qué puedes hacer:
- preparar_publicacion: cuando la persona vende y dice que tiene algo para vender o publicar.
- registrar_venta: cuando la persona dice que ya vendió algo (vendí, anótame una venta, acabo de vender...). El producto debe ser uno de su inventario.
- buscar_en_mercado: cuando alguien busca comprar algo o pregunta quién vende algo.
- Responder sin herramienta: preguntas sobre su inventario o sus ventas (usa solo los datos del contexto), cómo usar Sava, o consejos generales del campo.

Reglas:
- Nunca inventes cantidades, precios, productos ni ventas. Si falta un dato para una acción (por ejemplo el precio o la cantidad), pregúntalo en una frase y no uses la herramienta todavía.
- Usa como máximo una herramienta por respuesta.
- La app pide confirmación antes de guardar: no digas que ya guardaste o registraste algo; di que preparaste la publicación o la venta para que la revise.
- Las ventas y el inventario son registros de la persona, no facturas ni contabilidad oficial.
- Sava no procesa pagos ni transporta: el precio final y la entrega se acuerdan entre comprador y vendedor.
- Si la persona solo compra, no puede publicar ni registrar ventas: invítala a tocar "Vender" para registrarse como campesino o tienda.
- Si te piden algo fuera de Sava o del campo, responde amable y breve y vuelve a lo que sí puedes ayudar.`;

// strict: claude debe devolver exactamente estos campos
const herramientas: Anthropic.Beta.BetaTool[] = [
  {
    name: "preparar_publicacion",
    description: "Prepara una publicación de cosecha o producto para que la persona la revise y confirme. Úsala solo si la persona vende y dio el producto, la cantidad y el precio.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["nombre", "cantidad", "unidad", "precio_cop", "categoria", "descripcion"],
      properties: {
        nombre: { type: "string", description: "Nombre corto del producto con mayúscula inicial, por ejemplo 'Piña oro miel'." },
        cantidad: { type: "number", description: "Cantidad disponible, mayor que 0." },
        unidad: { type: "string", enum: unidades },
        precio_cop: { type: "integer", description: "Precio en pesos colombianos por cada unidad, sin centavos." },
        categoria: { type: "string", enum: categorias },
        descripcion: { type: "string", description: "Detalles que dijo la persona (variedad, estado, entrega). Vacío si no dijo nada." },
      },
    },
  },
  {
    name: "registrar_venta",
    description: "Prepara el registro de una venta que la persona ya hizo, para que la confirme. Descuenta del inventario al confirmar.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["producto", "cantidad", "precio_unitario_cop"],
      properties: {
        producto: { type: "string", description: "Nombre del producto tal como aparece en el inventario del contexto." },
        cantidad: { type: "number", description: "Cantidad vendida, mayor que 0." },
        precio_unitario_cop: { type: "integer", description: "Precio por unidad al que vendió. 0 si no lo dijo (se usa el de la publicación)." },
      },
    },
  },
  {
    name: "buscar_en_mercado",
    description: "Busca en el mercado de Sava quién vende un producto o insumo, para recomendar vendedores.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["producto", "municipio", "cantidad"],
      properties: {
        producto: { type: "string", description: "Producto buscado en una o dos palabras, por ejemplo 'piña' o 'abono'." },
        municipio: { type: "string", enum: municipios, description: "Municipio de Casanare donde busca. Vacío si no lo dijo." },
        cantidad: { type: "number", description: "Cantidad que necesita. 0 si no la dijo." },
      },
    },
  },
];

type Peticion = {
  mensaje: string;
  historial: Array<{ autor: "user" | "assistant"; texto: string }>;
  contexto: string;
};

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cabeceras });
  if (req.method !== "POST") return responder({ error: "metodo-no-permitido" }, 405);

  // solo personas con cuenta en sava pueden usar la ia (cuesta dinero por mensaje)
  const autorizacion = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: autorizacion } },
  });
  const { data: usuario } = await supabase.auth.getUser();
  if (!usuario.user) return responder({ error: "sin-sesion" }, 401);

  let datos: Peticion;
  try { datos = await req.json(); } catch { return responder({ error: "json-invalido" }, 400); }
  const mensaje = String(datos.mensaje ?? "").slice(0, 600).trim();
  if (mensaje === "") return responder({ error: "mensaje-vacio" }, 400);

  // ultimos mensajes de la conversacion, como texto
  const mensajes: Anthropic.Beta.BetaMessageParam[] = [];
  for (const item of (datos.historial ?? []).slice(-10)) {
    const texto = String(item.texto ?? "").slice(0, 600);
    if (texto === "") continue;
    mensajes.push({ role: item.autor === "assistant" ? "assistant" : "user", content: texto });
  }
  // el primer mensaje debe ser de la persona
  while (mensajes.length > 0 && mensajes[0].role !== "user") mensajes.shift();
  // el contexto (inventario, ventas, rol) cambia en cada mensaje: va al final, no en el sistema
  mensajes.push({ role: "user", content: `Contexto de la persona (datos reales de la app):\n${String(datos.contexto ?? "").slice(0, 6000)}\n\nMensaje: ${mensaje}` });

  try {
    const respuesta = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // chat sencillo: poco esfuerzo, respuestas rapidas
      output_config: { effort: "low" },
      // si el modelo declina por seguridad, la api reintenta sola con otro modelo
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: sistema,
      tools: herramientas,
      tool_choice: { type: "auto" },
      messages: mensajes,
    });

    if (respuesta.stop_reason === "refusal") {
      return responder({ texto: "No puedo ayudarte con eso. Pregúntame sobre tus cosechas, tus ventas o qué quieres comprar.", accion: null });
    }

    let texto = "";
    let accion: { tipo: string; datos: unknown } | null = null;
    for (const bloque of respuesta.content) {
      if (bloque.type === "text") texto = texto + bloque.text;
      if (bloque.type === "tool_use" && accion === null) accion = { tipo: bloque.name, datos: bloque.input };
    }
    return responder({ texto: texto.trim(), accion });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return responder({ error: "muchas-solicitudes" }, 429);
    if (error instanceof Anthropic.AuthenticationError) return responder({ error: "clave-invalida" }, 500);
    if (error instanceof Anthropic.APIError) return responder({ error: "error-ia", estado: error.status }, 502);
    return responder({ error: "error-desconocido" }, 500);
  }
});
