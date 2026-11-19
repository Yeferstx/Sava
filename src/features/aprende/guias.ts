// guias cortas de "Aprende con Sava". el asistente las usa para explicar paso a paso.
// son orientaciones generales; lo tecnico (plagas, quimicos, suelos) siempre remite a un profesional

export type Guia = {
  id: string;
  titulo: string;
  resumen: string;
  pasos: string[];
  claves: string[];
  tecnica?: boolean;
};

export const guias: Guia[] = [
  {
    id: 'publicar',
    titulo: 'Cómo publicar tu cosecha',
    resumen: 'En pocos pasos tu cosecha queda visible para compradores de Casanare.',
    claves: ['publicar', 'publico', 'subir', 'montar'],
    pasos: [
      'Toca «Vender» abajo, o dile a tu asistente «ayúdame a publicar una cosecha».',
      'Escribe qué producto es y cuánto tienes, por ejemplo 800 kilos de piña.',
      'Si vendes por lotes, pon el pedido mínimo, por ejemplo desde 100 kilos.',
      'Elige el municipio y desde cuándo está disponible.',
      'Pon el precio o elige «A convenir» si prefieres negociar.',
      'Revisa todo y toca «Publicar». Si no hay señal, se sube sola cuando vuelva.',
    ],
  },
  {
    id: 'fotos',
    titulo: 'Cómo tomar buenas fotos',
    resumen: 'Una foto clara y real vende más que cualquier texto.',
    claves: ['foto', 'fotos', 'fotografia', 'fotografiar', 'imagen'],
    pasos: [
      'Toma la foto con luz de día, sin sol fuerte directo. La mañana o la tarde son buenas horas.',
      'Muestra el producto de verdad: la cosecha que vas a vender, no una foto de internet.',
      'Limpia el lente del celular con un trapo antes de tomarla.',
      'Acércate para que se vea el tamaño y el color. Una segunda foto puede mostrar la cantidad (canastillas, bultos).',
      'Usa un fondo sencillo: una mesa, un costal limpio o el mismo cultivo.',
      'Mantén el celular quieto y toca la pantalla sobre el producto para enfocar.',
    ],
  },
  {
    id: 'descripcion',
    titulo: 'Cómo escribir una buena descripción',
    resumen: 'Pocas palabras, claras y verdaderas.',
    claves: ['descripcion', 'describir', 'escribir', 'texto'],
    pasos: [
      'Di la variedad: por ejemplo «piña oro miel» o «plátano hartón».',
      'Cuenta cómo está: madura, verde, de primera, recién cosechada.',
      'Aclara cómo entregas: en la finca, en el pueblo o a convenir.',
      'Si vendes por canastillas o bultos, di cuánto pesa cada uno.',
      'No exageres: el comprador vuelve si recibe lo que leyó.',
    ],
  },
  {
    id: 'cantidades',
    titulo: 'Cómo mostrar cantidades',
    resumen: 'El comprador necesita saber cuánto hay y desde cuánto vendes.',
    claves: ['cantidad', 'cantidades', 'minimo', 'lote', 'lotes', 'por mayor'],
    pasos: [
      'Pon la cantidad total disponible, por ejemplo 800 kilos.',
      'Elige la medida que usas de verdad: kilos, toneladas, bultos, canastillas o racimos.',
      'Si solo vendes por cantidad grande, pon el pedido mínimo. Si vendes poquito también, déjalo vacío.',
      'Cuando vendas, anótalo en tu cuaderno: la cantidad disponible se actualiza sola.',
    ],
  },
  {
    id: 'promocionar',
    titulo: 'Cómo promocionar tu finca',
    resumen: 'Dar a conocer tu cosecha más allá de Sava.',
    claves: [
      'promocionar',
      'promocion',
      'dar a conocer',
      'publicidad',
      'anunciar',
      'redes',
      'facebook',
      'instagram',
      'whatsapp',
    ],
    pasos: [
      'Abre tu publicación y toca «Promocionar con Sava».',
      'Comparte la imagen que arma Sava en tus estados de WhatsApp y en grupos de compradores.',
      'Usa los textos listos para Facebook e Instagram; puedes cambiarlos a tu gusto.',
      'Graba un video corto en la finca mostrando la cosecha y súbelo en «Videos».',
      'Publica seguido y mantén las cantidades al día para que confíen en ti.',
    ],
  },
  {
    id: 'compradores',
    titulo: 'Cómo responder a compradores',
    resumen: 'Responder rápido y claro cierra más ventas.',
    claves: ['responder', 'comprador', 'compradores', 'cliente', 'clientes', 'negociar'],
    pasos: [
      'Responde lo más pronto que puedas, aunque sea para decir «ya le confirmo».',
      'Confirma cantidad, precio, fecha y cómo se entrega antes de despachar.',
      'Si el precio es a convenir, ten claro tu precio mínimo antes de negociar.',
      'Acuerda el pago: de contado o fiado. Si es fiado, anótalo en tu cuaderno como «quedó debiendo».',
      'Después de vender, anota la venta para que tu inventario quede al día.',
    ],
  },
  {
    id: 'costos',
    titulo: 'Cómo calcular tus costos básicos',
    resumen: 'Saber cuánto te cuesta producir te ayuda a poner precio.',
    claves: ['costo', 'costos', 'calcular', 'precio', 'cuanto cobrar', 'ganancia'],
    pasos: [
      'Anota cada gasto en tu cuaderno: abono, semillas, jornales, transporte, empaques.',
      'Al final de la cosecha suma todos los gastos.',
      'Divide ese total entre los kilos (o la medida) que cosechaste: ese es tu costo por kilo.',
      'Tu precio de venta debería ser mayor que ese costo para que te quede ganancia.',
      'En «Mi cuaderno» ves el dinero recibido, los gastos y el balance del mes.',
    ],
  },
  {
    id: 'cuentas',
    titulo: 'Cómo llevar tus cuentas en Sava',
    resumen: 'Tu cuaderno del campo, aunque no tengas señal.',
    claves: ['cuentas', 'cuaderno', 'registrar', 'anotar', 'gastos', 'ventas', 'cobro', 'fiado'],
    pasos: [
      'Entra a «Mi negocio» y toca «Mi cuaderno».',
      'Anota cada cosecha, venta, gasto, pérdida o cobro con los botones de arriba.',
      'Si te quedaron debiendo, marca «Quedó debiendo»; cuando te paguen, anota el cobro.',
      'Todo se guarda en tu celular aunque no haya señal y se envía cuando vuelva.',
      'También puedes decirle a tu asistente: «gasté 80 mil en abono» o «¿cuánto me deben?».',
    ],
  },
  {
    id: 'tecnico',
    titulo: 'Plagas, abonos y químicos',
    resumen: 'Orientación general. Para tu caso, consulta a un profesional.',
    tecnica: true,
    claves: [
      'plaga',
      'plagas',
      'enfermedad',
      'hongo',
      'abonar',
      'fertilizar',
      'veneno',
      'fumigar',
      'quimico',
      'suelo',
    ],
    pasos: [
      'Esto es solo orientación general: cada cultivo y cada suelo son distintos.',
      'Antes de aplicar un químico, consulta a un agrónomo, a la UMATA o a la secretaría de agricultura de tu municipio.',
      'Usa solo productos con registro ICA vigente y sigue la etiqueta: dosis, tiempo de espera y protección.',
      'Usa guantes, tapabocas y ropa de manga larga al aplicar; guarda los químicos lejos de niños y animales.',
      'Para conocer qué le falta a tu suelo, lo más seguro es un análisis de suelos.',
    ],
  },
];

function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// busca la guia que mejor responde una pregunta
export function guiaPara(pregunta: string): Guia | null {
  const t = normalizar(pregunta);
  let mejor: Guia | null = null;
  let puntos = 0;
  for (const guia of guias) {
    let suma = 0;
    for (const clave of guia.claves) {
      if (t.includes(clave)) suma += clave.length;
    }
    if (suma > puntos) {
      puntos = suma;
      mejor = guia;
    }
  }
  return mejor;
}
