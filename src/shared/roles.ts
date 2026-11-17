import { ShoppingBasket, Sprout, Store } from 'lucide-react-native';

// las tres formas de usar sava
export type Rol = 'agricultor' | 'tienda' | 'comprador';

export const CATEGORIA_TIENDA = 'Tienda agropecuaria';

export const roles = [
  {
    rol: 'agricultor' as Rol,
    corto: 'Campesino',
    titulo: 'Soy campesino',
    texto: 'Vendo lo que cosecho.',
    voz: 'Soy campesino. Quiero vender lo que cosecho y llevar mis cuentas.',
    Icon: Sprout,
  },
  {
    rol: 'tienda' as Rol,
    corto: 'Tienda',
    titulo: 'Tengo tienda del campo',
    texto: 'Vendo semillas, abonos, venenos y herramientas.',
    voz: 'Tengo una tienda del campo. Vendo semillas, abonos, venenos y herramientas para el campesino.',
    Icon: Store,
  },
  {
    rol: 'comprador' as Rol,
    corto: 'Comprador',
    titulo: 'Quiero comprar',
    texto: 'Busco productos del campo de Casanare.',
    voz: 'Quiero comprar productos del campo de Casanare.',
    Icon: ShoppingBasket,
  },
];

export function esRol(valor: string): valor is Rol {
  return valor === 'agricultor' || valor === 'tienda' || valor === 'comprador';
}
