import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bookmark, CirclePlus, House, Play, Sprout, Store, UserRound } from 'lucide-react-native';
import type { AppTab } from '../../navigation/types';
import { colors } from '../theme';

type Props = { active: AppTab; onChange: (tab: AppTab) => void; guest?: boolean; tienda?: boolean; oscuro?: boolean };

// oscuro: en videos la barra se pone oscura como el resto de la pantalla
export default function TabBar({ active, onChange, guest = false, tienda = false, oscuro = false }: Props) {
  // inicio siempre es el mercado. maria esta en el boton flotante de todas las pantallas
  let tabs = [
    { name: 'Inicio' as AppTab, label: 'Inicio', Icon: House },
    { name: 'Videos' as AppTab, label: 'Videos', Icon: Play },
    { name: 'Publicar' as AppTab, label: 'Vender', Icon: CirclePlus },
    { name: 'Guardados' as AppTab, label: 'Guardados', Icon: Bookmark },
    { name: 'Mi negocio' as AppTab, label: 'Cuenta', Icon: UserRound },
  ];
  if (guest === false) {
    tabs = [
      { name: 'Inicio' as AppTab, label: 'Inicio', Icon: House },
      { name: 'Videos' as AppTab, label: 'Videos', Icon: Play },
      { name: 'Publicar' as AppTab, label: 'Publicar', Icon: CirclePlus },
      { name: 'Inventario' as AppTab, label: tienda ? 'Productos' : 'Cosechas', Icon: Sprout },
      { name: 'Mi negocio' as AppTab, label: tienda ? 'Mi tienda' : 'Mi finca', Icon: Store },
    ];
  }

  return (
    <View style={[styles.bar, oscuro && styles.barOscura]}>
      {tabs.map(({ name, label, Icon }) => {
        const selected = active === name;
        const add = name === 'Publicar';
        let color: string = colors.grafito;
        if (selected || add) color = colors.brown;
        if (oscuro) color = colors.white;
        return (
          <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} key={name} onPress={() => onChange(name)} style={styles.item}>
            <View style={[styles.iconWrap, add && styles.add, oscuro && add && styles.addOscuro, selected && !add && (oscuro ? styles.selectedOscuro : styles.selected)]}>
              <Icon size={add ? 25 : 21} color={add ? '#fff' : color} strokeWidth={selected ? 2.5 : 2} />
            </View>
            <Text style={[styles.label, selected && styles.activeText, oscuro && styles.labelOscuro]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 76, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 3 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  selected: { backgroundColor: '#E8F2EE' },
  add: { width: 44, height: 44, backgroundColor: colors.brown, marginTop: -18, borderWidth: 4, borderColor: colors.paper },
  label: { fontSize: 11, marginTop: 1, color: '#26332F' },
  activeText: { color: colors.brown, fontWeight: '800' },
  barOscura: { backgroundColor: colors.grafito, borderTopColor: colors.grafito },
  addOscuro: { borderColor: colors.grafito },
  selectedOscuro: { backgroundColor: 'rgba(255,255,255,0.16)' },
  labelOscuro: { color: colors.white },
});
