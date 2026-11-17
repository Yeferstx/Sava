import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Apple, Banana, Bean, Carrot, Cherry, Citrus, FlaskConical, Grape, Hammer, Leaf, Package, PawPrint, Salad, Sprout, Wheat } from 'lucide-react-native';
import { colors } from '../../../shared/theme';

// dibujo para cada categoria, asi se reconoce sin tener que leer
const iconos: Record<string, typeof Sprout> = {
  'Plátano y banano': Banana, 'Yuca y tubérculos': Carrot, 'Piña': Citrus, 'Papaya': Apple, 'Patilla': Cherry,
  'Ahuyama': Salad, 'Maracuyá y frutas': Grape, 'Hortalizas': Leaf, 'Otros': Sprout,
  'Semillas': Bean, 'Abonos y fertilizantes': Wheat, 'Agroquímicos': FlaskConical, 'Herramientas': Hammer,
  'Alimento para animales': PawPrint, 'Otros insumos': Package,
};

// tres fondos de la paleta que se turnan para que el mercado se vea alegre
const fondos = [colors.verdeClaro, '#F5E7E2', colors.white];

export default function CategoriaIcono({ nombre, posicion, elegida, onPress }: { nombre: string; posicion: number; elegida: boolean; onPress: () => void }) {
  let Icono = iconos[nombre];
  if (!Icono) Icono = Sprout;
  const fondo = fondos[posicion % fondos.length];
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: elegida }} accessibilityLabel={nombre} onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.presionado]}>
      <View style={[styles.circulo, { backgroundColor: fondo }, elegida && styles.circuloElegido]}>
        <Icono size={30} color={elegida ? colors.white : colors.verde} strokeWidth={1.8} />
      </View>
      <Text numberOfLines={2} style={[styles.nombre, elegida && styles.nombreElegido]}>{nombre}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: 82, alignItems: 'center', paddingVertical: 4 },
  presionado: { transform: [{ scale: 0.92 }] },
  circulo: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  circuloElegido: { backgroundColor: colors.verde, borderColor: colors.verde },
  nombre: { color: colors.grafito, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 6, lineHeight: 15 },
  nombreElegido: { color: colors.verde, fontWeight: '900' },
});
