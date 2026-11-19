import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import {
  Apple,
  Banana,
  Carrot,
  Cherry,
  Grape,
  Hammer,
  LayoutGrid,
  Leaf,
  Package,
  PawPrint,
  Salad,
  ShieldCheck,
  Sprout,
  Tractor,
  Wheat,
} from 'lucide-react-native';
import { colors } from '../../../shared/theme';

type Icono = (props: { size: number; color: string; strokeWidth?: number }) => React.ReactNode;

// piña dibujada a mano en el mismo estilo de linea de los demas iconos
function Pina({ size, color, strokeWidth = 1.8 }: { size: number; color: string; strokeWidth?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 8 L12 2.5 M12 8 L9.5 3.5 M12 8 L14.5 3.5 M12 8 L7.5 5.5 M12 8 L16.5 5.5" />
      <Ellipse cx={12} cy={15} rx={5.2} ry={6.6} />
      <Path
        d="M8.5 11.5 L15.5 18.5 M15.5 11.5 L8.5 18.5 M7.2 15 L12 10 M16.8 15 L12 10 M7.2 15 L12 20 M16.8 15 L12 20"
        strokeWidth={strokeWidth * 0.7}
      />
    </Svg>
  );
}

// papaya abierta con sus semillas
function Papaya({ size, color, strokeWidth = 1.8 }: { size: number; color: string; strokeWidth?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Ellipse cx={12} cy={12} rx={9.5} ry={6.5} transform="rotate(-30 12 12)" />
      <Ellipse cx={12} cy={12} rx={5.2} ry={3} transform="rotate(-30 12 12)" />
      <Circle cx={10.5} cy={12.6} r={0.6} fill={color} />
      <Circle cx={12.4} cy={11.4} r={0.6} fill={color} />
      <Circle cx={13.6} cy={12.6} r={0.6} fill={color} />
      <Circle cx={11.6} cy={13.4} r={0.6} fill={color} />
    </Svg>
  );
}

// dibujo para cada categoria, asi se reconoce sin tener que leer
const iconos: Record<string, Icono> = {
  'Plátano y banano': Banana,
  'Yuca y tubérculos': Carrot,
  Piña: Pina,
  Papaya: Papaya,
  Patilla: Cherry,
  Ahuyama: Salad,
  'Maracuyá y frutas': Grape,
  Hortalizas: Leaf,
  Otros: Sprout,
  'Semillas y plantas': Sprout,
  'Cultivos y suelos': Wheat,
  Ganadería: PawPrint,
  'Equipos y riego': Tractor,
  'Otros insumos': Package,
  Frutas: Banana,
  Tubérculos: Carrot,
  Granos: Wheat,
  'Otros productos agrícolas': Sprout,
  'Nutrición de cultivos': Leaf,
  'Protección de cultivos': ShieldCheck,
  Herramientas: Hammer,
  'Insumos para ganadería': PawPrint,
  'Equipos agrícolas': Tractor,
  '': LayoutGrid,
};

// version compacta para la fila de categorias del inicio
export function ChipCategoria({
  nombre,
  etiqueta,
  elegida,
  onPress,
}: {
  nombre: string;
  etiqueta: string;
  elegida: boolean;
  onPress: () => void;
}) {
  let Icono = iconos[nombre];
  if (!Icono) Icono = Apple;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: elegida }}
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, elegida && styles.chipElegido, pressed && styles.presionado]}
    >
      <Icono size={17} color={elegida ? colors.white : colors.verde} strokeWidth={2} />
      <Text style={[styles.chipTexto, elegida && styles.chipTextoElegido]} numberOfLines={1}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

// fondos suaves de la paleta que se turnan
const fondos = [colors.salvia, '#F5E7E2', colors.white, colors.salvia];

type Props = {
  nombre: string;
  etiqueta?: string;
  posicion: number;
  elegida: boolean;
  enGrilla?: boolean;
  onPress: () => void;
};

export default function CategoriaIcono({
  nombre,
  etiqueta = '',
  posicion,
  elegida,
  enGrilla = false,
  onPress,
}: Props) {
  let Icono = iconos[nombre];
  if (!Icono) Icono = Apple;
  const fondo = fondos[posicion % fondos.length];
  let texto = nombre;
  if (etiqueta !== '') texto = etiqueta;
  const grande = enGrilla;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: elegida }}
      accessibilityLabel={nombre}
      onPress={onPress}
      style={({ pressed }) => [grande ? styles.tileGrilla : styles.tile, pressed && styles.presionado]}
    >
      <View
        style={[
          grande ? styles.circuloGrande : styles.circulo,
          { backgroundColor: fondo },
          elegida && styles.circuloElegido,
        ]}
      >
        <Icono size={grande ? 36 : 30} color={elegida ? colors.white : colors.verde} strokeWidth={1.8} />
      </View>
      <Text
        numberOfLines={2}
        style={[grande ? styles.nombreGrande : styles.nombre, elegida && styles.nombreElegido]}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: 82, alignItems: 'center', paddingVertical: 4 },
  tileGrilla: { width: '25%', alignItems: 'center', paddingVertical: 2 },
  presionado: { transform: [{ scale: 0.93 }] },
  circulo: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  circuloGrande: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#26332F',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  circuloElegido: { backgroundColor: colors.verde, borderColor: colors.verde },
  nombre: {
    color: colors.grafito,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 15,
  },
  nombreGrande: {
    color: colors.grafito,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 18,
    paddingHorizontal: 2,
  },
  nombreElegido: { color: colors.verde, fontWeight: '900' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipElegido: { backgroundColor: colors.verde, borderColor: colors.verde },
  chipTexto: { color: colors.verde, fontSize: 14, fontWeight: '800' },
  chipTextoElegido: { color: colors.white },
});
