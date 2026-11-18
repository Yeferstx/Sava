<p align="center">
  <img src="assets/icon.png" width="96" alt="Sava" />
</p>

<h1 align="center">Sava</h1>

<p align="center"><b>Tu campo, más conectado.</b><br/>App móvil para las mipymes del campo de Casanare: campesinos, tiendas agropecuarias y compradores.</p>

<p align="center">
  Expo SDK 58 · React Native · TypeScript · Supabase · SQLite · Funciona sin internet
</p>

---

## ¿Qué es Sava?

Sava conecta a los **campesinos** y **tiendas del campo** de Casanare con **compradores**, y les ayuda a llevar su negocio desde el celular, incluso donde no hay señal.

| Para quién | Qué puede hacer |
|---|---|
| **Comprador** (sin cuenta) | Ver cosechas e insumos cerca, buscar por producto o municipio, guardar favoritos y escribir al productor por WhatsApp |
| **Campesino** | Publicar cosechas con fotos, llevar el inventario, anotar ventas, gastos, pérdidas y fiados en **Mi cuaderno**, y descargar el reporte en PDF |
| **Tienda del campo** | Publicar insumos, registrar compras de mercancía, ventas y ganancia por producto |
| **Todos** | Hablar o escribirle a **Aru**, el asistente de Sava, que ayuda a publicar, anotar y buscar |

## Funciones principales

- **Inicio personalizado:** cosechas e insumos cerca de ti, según tu municipio y lo que más miras (los intereses se guardan solo en el celular).
- **Publicar paso a paso:** con formulario, por voz o con Aru, que pregunta solo lo que falta.
- **Mi cuaderno:** ventas, gastos, pérdidas, cobros y compras; resumen por día, semana o mes, recordatorios de cobro y reporte PDF «Así va tu negocio».
- **Aru:** entiende frases como «vendí 10 kilos de yuca a 2.000» o «¿quién vende plátano en Yopal?». Funciona con reglas dentro del celular y, si la persona lo autoriza, usa IA (Gemini) para preguntas generales. Las 33 frases más usadas tienen voz natural grabada.
- **Sin internet:** todo lo del negocio se guarda primero en el celular (SQLite) y se envía solo cuando vuelve la señal, sin duplicados.
- **Privacidad:** aviso de privacidad, autorización obligatoria verificada en el servidor (Ley 1581 de 2012 y Decreto 1074 de 2015), autorizaciones opcionales separadas y solicitudes de derechos desde la app.

## Cómo ejecutarla

Requisitos: Node 20 o superior, [pnpm](https://pnpm.io) y la app **Expo Go** (SDK 58) en el celular.

```bash
pnpm install
cp .env.example .env      # y pon tus datos de Supabase
pnpm start                # escanea el QR con Expo Go
```

Otros comandos:

```bash
pnpm typecheck                                              # revisar tipos
npx expo start -c                                           # abrir limpiando la caché
npx eas-cli build --platform android --profile preview      # generar el APK
```

> Hablarle a Aru con el micrófono y algunos módulos nativos solo funcionan en el **APK**, no en Expo Go.

## Variables de entorno

| Variable | Dónde va | Para qué |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` de la app | Dirección del proyecto de Supabase |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env` de la app | Clave pública (la protegen las reglas RLS) |
| `GEMINI_API_KEY`, `IA_PROVEEDOR` | Secretos de Supabase | IA de Aru (nunca en la app) |

```bash
npx supabase secrets set IA_PROVEEDOR=gemini GEMINI_API_KEY=tu-clave --remote
```

**Nunca** subas a GitHub el archivo `.env` ni una clave de servicio (`service_role` o `sb_secret_…`).

## Base de datos (Supabase)

Las tablas, funciones y reglas de seguridad (RLS) están en `supabase/migrations/`. Cada persona solo puede leer y cambiar su propia información privada; lo público es solo lo que el vendedor decide publicar.

```bash
npx supabase link --project-ref <tu-proyecto>
npx supabase db push --remote          # aplicar las migraciones
npx supabase functions deploy maria    # subir la función de Aru
```

## Estructura del proyecto

```text
App.tsx                  # entrada: splash y navegación
src/
  navigation/            # flujo de visitante, comprador y vendedor
  features/
    home/                # inicio, búsqueda y tarjetas de productos
    marketplace/         # detalle del producto y datos del mercado
    inventory/           # publicar e inventario
    cuaderno/            # ventas, gastos, cobros, recordatorios y reporte PDF
    sales/               # ventas del negocio
    orders/              # consultas entre compradores y vendedores
    chat/                # Aru: reglas, voz e IA
    legal/               # política de datos, autorizaciones y derechos
    auth/                # crear cuenta, iniciar sesión y registro del negocio
    account/             # Mi negocio
    videos/ aprende/ promocion/ favoritos/ notificaciones/ seguimiento/ splash/
  infrastructure/
    database/            # SQLite del celular
    sync/                # cola de cambios sin internet
    supabase/            # cliente del servidor
  shared/                # colores, componentes, voz, validaciones
supabase/
  migrations/            # esquema y reglas RLS
  functions/maria/       # función de Aru en el servidor
assets/                  # logo, imágenes, Aru y sus frases de voz
scripts/demo/            # datos de demostración (crear y borrar)
```

## Datos de demostración

Para presentar la app hay cuentas y publicaciones de prueba marcadas con **«(Demo)»**. Se crean y se borran con:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python scripts/demo/crear_demo.py
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python scripts/demo/borrar_demo.py
```

La clave de servicio solo se usa en el computador para este script; nunca se guarda en el proyecto. Las fotos de la demostración y sus créditos están en `scripts/demo/`.

## Colores

| Color | Código |
|---|---|
| Verde oscuro | `#064229` |
| Crema | `#F0E9DF` |
| Verde suave | `#DCEBE2` |
| Terracota | `#C98770` |

---

<p align="center">Hecho en Casanare 🌾 · Proyecto para CREATIC Casanare</p>
