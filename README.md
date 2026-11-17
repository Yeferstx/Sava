# Sava · app móvil

Aplicación Expo / React Native para descubrir negocios de Casanare y ayudar a sus vendedores a organizar productos, inventario y ventas. Usa pnpm, Supabase y almacenamiento local con SQLite.

## Arranque

```bash
pnpm install
pnpm start
```

Para abrirla en iPhone, usa Expo Go compatible con Expo SDK 58, inicia sesión en Expo Go y en la CLI con la misma cuenta, y escanea el QR generado por `pnpm start`.

```bash
pnpm typecheck
```

## Arquitectura

```text
src/
  features/
    account/       # Panel e información del negocio
    auth/          # Inicio de sesión y registro de vendedores
    business/      # Catálogo, datos, ficha y contacto
    chat/          # María y preparación de publicaciones
    home/          # Búsqueda y descubrimiento local
    inventory/     # Publicaciones e inventario
    sales/         # Registro y resumen de ventas
    videos/        # Descubrimiento por categoría
  infrastructure/
    database/      # SQLite y cola local de cambios
    supabase/      # Cliente remoto
    sync/          # Sincronización de operaciones pendientes
  navigation/      # Flujos de visitante y vendedor
  shared/          # Tema, componentes e iconos Lucide
supabase/migrations/ # Esquema remoto y políticas RLS
```

## Experiencia y acceso

- El visitante puede explorar el inicio, negocios, productos publicados y videos sin iniciar sesión.
- Contactar un negocio es directo por WhatsApp cuando el vendedor agregó su teléfono.
- Para publicar y administrar un negocio, el usuario debe iniciar sesión. Si aún no tiene negocio, Sava abre el registro del negocio en ese momento.
- El MVP todavía no incluye carrito, pagos integrados ni reproducción de videos reales. Los videos actuales son contenido demostrativo.
- La navegación, categorías y acciones usan iconos Lucide. Las fotos reales de productos, negocios y la ilustración propia de María quedan como recursos de contenido por conectar.

## Datos y conexión

- **SQLite** conserva inventario, ventas y cambios pendientes del negocio en el dispositivo para las operaciones básicas sin conexión.
- **Supabase/Postgres** provee autenticación y datos compartidos. El esquema y las políticas RLS están en `supabase/migrations/`.
- Configura `.env` con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca incluyas una clave de servicio en la app.
- Los cambios pendientes se envían a Supabase cuando hay sesión y conexión. La sincronización en tiempo real entre varios dispositivos todavía no está implementada.

## Estado del prototipo

Se puede crear una cuenta de vendedor, registrar un negocio, explorar negocios y productos publicados, publicar productos, ajustar existencias y registrar ventas. María prepara localmente un borrador para el ejemplo de publicación de arroz y pide confirmación antes de guardarlo. La IA real, los videos comerciales y el flujo de pedidos con carrito todavía no están conectados.
