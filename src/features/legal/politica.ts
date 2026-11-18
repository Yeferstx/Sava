// politica de tratamiento de datos personales de sava (ley 1581 de 2012 y decreto 1074 de 2015).
// va dentro de la app: se puede leer sin internet. cada cambio sustancial sube la version
// y obliga a pedir una nueva autorizacion (las versiones tambien estan en el servidor).

export const POLITICA_VERSION = '1.0';
export const POLITICA_FECHA = '18 de noviembre de 2026';

// textos exactos que la persona autoriza (se guarda la version de cada uno como evidencia)
export const AUTORIZACIONES = {
  tratamiento_datos: {
    version: 'datos-1.0',
    texto: 'Autorizo de manera previa, expresa e informada el tratamiento de mis datos personales para las finalidades indicadas en el aviso y la Política de Tratamiento de Datos Personales.',
  },
  comunicaciones: {
    version: 'comunicaciones-1.0',
    texto: 'Acepto recibir mensajes con novedades y comunicaciones de Sava que no son necesarias para usar la app (opcional).',
  },
  ia_externa: {
    version: 'ia-1.0',
    texto: 'Autorizo que, cuando Aru no entienda mi pregunta con sus reglas, envíe el texto de mi pregunta y de los últimos mensajes del chat a Gemini (Google) para responderme. No se envían mis cuentas, ventas, inventario ni datos de contacto.',
  },
} as const;

export type TipoAutorizacion = keyof typeof AUTORIZACIONES;

export const AVISO_PRIVACIDAD = 'En cumplimiento de la Ley 1581 de 2012 y el Decreto 1074 de 2015, te informamos que tus datos personales serán utilizados para gestionar tu cuenta, publicaciones, inventarios, ventas, pedidos y otras funciones de Sava. Puedes conocer, actualizar, rectificar y solicitar la supresión de tus datos, así como revocar tu autorización cuando corresponda. Consulta nuestra Política de Tratamiento de Datos Personales para conocer las finalidades completas, la identidad y los datos de contacto del responsable, y los canales para ejercer tus derechos.';

// datos del responsable que el equipo debe definir formalmente antes de un lanzamiento.
// mientras esten vacios, la app los muestra como "por confirmar" (no se inventan)
export const RESPONSABLE = {
  nombre: '',
  identificacion: '',
  direccion: '',
  correo: '',
  telefono: '',
};

export type SeccionPolitica = { titulo: string; parrafos: string[]; porConfirmar?: boolean };

const pendiente = (dato: string) => (dato.trim() === '' ? 'Por confirmar' : dato);

export const SECCIONES_POLITICA: SeccionPolitica[] = [
  {
    titulo: '1. Responsable del tratamiento',
    porConfirmar: Object.values(RESPONSABLE).some((v) => v.trim() === ''),
    parrafos: [
      'Sava es un proyecto desarrollado por un equipo participante en CREATIC Casanare. El responsable de los datos de las personas que crean una cuenta en Sava es:',
      'Nombre o razón social: ' + pendiente(RESPONSABLE.nombre) + '\nIdentificación (NIT o cédula): ' + pendiente(RESPONSABLE.identificacion) + '\nDirección: ' + pendiente(RESPONSABLE.direccion) + '\nCorreo de contacto: ' + pendiente(RESPONSABLE.correo) + '\nTeléfono: ' + pendiente(RESPONSABLE.telefono),
      'Mientras estos datos no estén definidos, puedes ejercer tus derechos desde la app, en «Tus datos y privacidad → Ejercer mis derechos».',
    ],
  },
  {
    titulo: '2. Qué datos recopilamos',
    parrafos: [
      'Datos de tu cuenta: nombre, correo electrónico, contraseña (Supabase la guarda cifrada; nadie del equipo puede verla), el tipo de usuario (campesino, tienda o comprador) y tu foto de perfil si la subes.',
      'Datos de tu negocio: nombre de la finca o tienda, municipio, teléfono de contacto y descripción.',
      'Publicaciones: productos, fotos, cantidades, precios, fechas y forma de entrega.',
      'Cuaderno: cosechas, ventas, gastos, pérdidas, cobros y compras de mercancía, y el nombre de los clientes que tú decidas anotar.',
      'Consultas entre compradores y vendedores: nombre, teléfono, mensaje y notas de voz que el comprador envía, y el registro de cuándo un comprador abrió WhatsApp para escribirte.',
      'Datos que quedan solo en tu celular y no se envían a nadie: tu ubicación (se usa para saber en qué municipio estás), tus intereses en el Inicio, tus guardados y la conversación con Aru.',
    ],
  },
  {
    titulo: '3. Para qué usamos tus datos',
    parrafos: [
      'Crear y administrar tu cuenta y tu negocio.',
      'Mostrar tus publicaciones a los compradores y permitir que te contacten.',
      'Llevar tu inventario, ventas, gastos, cobros y reportes del cuaderno.',
      'Enviarte avisos de la app: consultas, contactos, respuestas, sincronización y recordatorios de cobro.',
      'Responder tus preguntas con Aru y mejorar el funcionamiento y la seguridad de Sava.',
      'Enviarte comunicaciones no esenciales solo si lo autorizas por separado.',
    ],
  },
  {
    titulo: '4. Qué es público y qué es privado',
    parrafos: [
      'Públicos, solo si tú los publicas: nombre de la finca o tienda, municipio, productos publicados, cantidades, fotos elegidas y el teléfono de contacto del negocio.',
      'Privados siempre: ventas, gastos, ingresos, cobros, deudas, compras, el historial del cuaderno, los datos de tus clientes y el inventario que no publiques. Ningún otro usuario puede verlos.',
    ],
  },
  {
    titulo: '5. Cómo guardamos y protegemos la información',
    parrafos: [
      'Los datos se guardan en Supabase con reglas de seguridad por usuario: cada persona solo puede leer y cambiar su propia información privada. La conexión con el servidor va cifrada.',
      'Para que la app funcione sin internet, parte de tu información se guarda también en tu celular. Esa copia no está cifrada por la app: protege tu celular con clave o huella. Al cerrar sesión se borran del celular tus datos privados.',
      'Las claves de los servicios externos están en el servidor y nunca dentro de la app.',
    ],
  },
  {
    titulo: '6. Proveedores que intervienen',
    parrafos: [
      'Supabase: base de datos, inicio de sesión y fotos. Sus servidores están en São Paulo (Brasil), por lo que hay una transferencia internacional de datos.',
      'Google (Gemini): solo si lo autorizas, recibe el texto de algunas preguntas que le haces a Aru. En su plan gratuito, Google puede usar ese contenido para mejorar sus productos y personas pueden revisarlo; por eso Sava nunca le envía tus cuentas, ventas, inventario ni datos de contacto.',
      'Servicios de voz del celular (Apple o Google): cuando le hablas a Aru, el reconocimiento de voz lo hace el sistema de tu celular, que puede procesar el audio en sus servidores.',
      'WhatsApp (Meta): cuando tocas «Contactar al productor» se abre WhatsApp; esa conversación ya se rige por las condiciones de WhatsApp.',
      'Expo: herramienta con la que se construye la app; no recibe tus datos personales.',
    ],
  },
  {
    titulo: '7. Datos de los clientes que registran las mipymes',
    parrafos: [
      'Cuando un negocio anota en Sava datos de sus propios clientes (por ejemplo, el nombre de quien le compró fiado), ese negocio actúa como responsable de esos datos y debe contar con la autorización de su cliente. Sava solo ofrece la herramienta y los trata por cuenta del negocio.',
      'Las especificaciones técnicas de CREATIC Casanare indican que, respecto a esos datos, las mipymes son responsables y la Gobernación de Casanare actuaría como encargada al operar la plataforma. A la fecha esta relación no se ha formalizado: la Gobernación todavía no opera Sava. Si se formaliza, esta política se actualizará y te lo informaremos.',
      'Recomendamos anotar solo el nombre necesario y no registrar datos sensibles de los clientes.',
    ],
  },
  {
    titulo: '8. Tus derechos',
    parrafos: [
      'Conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización que diste; ser informado sobre el uso de tus datos; revocar la autorización o pedir la supresión cuando no exista un deber legal de conservarlos; acceder gratis a tus datos; y presentar quejas ante la Superintendencia de Industria y Comercio (SIC) después de haber hecho tu solicitud a Sava.',
    ],
  },
  {
    titulo: '9. Cómo ejercer tus derechos',
    parrafos: [
      'Desde la app: «Mi negocio» o «Cuenta» → «Tus datos y privacidad» → «Ejercer mis derechos». Ahí eliges si es una consulta, actualización, corrección, supresión o revocación, y queda registrada con fecha.',
      'También puedes escribir al correo del responsable (por confirmar).',
      'Consultas: se responden en máximo 10 días hábiles (prorrogables 5 días hábiles más, avisándote el motivo). Reclamos (corrección, actualización, supresión o revocación): máximo 15 días hábiles (prorrogables 8 días hábiles más).',
      'Puedes corregir tus datos directamente en la app: tu nombre y foto en tu perfil, y los datos del negocio en «Editar información del negocio».',
    ],
  },
  {
    titulo: '10. Conservación y eliminación',
    parrafos: [
      'Conservamos tus datos mientras tengas tu cuenta. Si pides la supresión, se borran tu cuenta, tus negocios, publicaciones, fotos y cuaderno, salvo lo que la ley obligue a conservar. La evidencia de tus autorizaciones se conserva mientras exista la cuenta, para poder demostrar cuándo y qué autorizaste.',
      'Los datos guardados en tu celular se borran al cerrar sesión o al desinstalar la app.',
    ],
  },
  {
    titulo: '11. Menores de edad',
    parrafos: ['Sava está dirigida a mayores de 18 años. Si eres menor de edad, usa la app con un adulto responsable.'],
  },
  {
    titulo: '12. Cambios a esta política',
    parrafos: ['Si cambiamos esta política de forma importante, te lo avisaremos en la app y te pediremos una nueva autorización antes de seguir usando tu cuenta.'],
  },
];
