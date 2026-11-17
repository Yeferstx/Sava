import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bookmark, CirclePlus, House, Play, Sprout, Store, UserRound } from 'lucide-react-native';
import type { AppTab } from '../../navigation/types';
import { colors } from '../theme';

type Props = { active: AppTab; onChange: (tab: AppTab) => void; guest?: boolean; tienda?: boolean };

export default function TabBar({ active, onChange, guest = false, tienda = false }: Props) {
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
    <View style={styles.bar}>
      {tabs.map(({ name, label, Icon }) => {
        const selected = active === name;
        const add = name === 'Publicar';
        const color = selected || add ? colors.brown : '#26332F';
        return (
          <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} key={name} onPress={() => onChange(name)} style={styles.item}>
            <View style={[styles.iconWrap, add && styles.add, selected && !add && styles.selected]}>
              <Icon size={add ? 25 : 21} color={add ? '#fff' : color} strokeWidth={selected ? 2.5 : 2} />
            </View>
            <Text style={[styles.label, selected && styles.activeText]}>{label}</Text>
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
});
