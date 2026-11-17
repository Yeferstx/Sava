import { useEffect, useState } from 'react';
import { Image, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bookmark, House, Play, Plus, Sprout, Store, UserRound } from 'lucide-react-native';
import type { AppTab } from '../../navigation/types';
import { colors } from '../theme';

// paisaje llanero de fondo, ya fundido con el crema en la parte de arriba
const paisaje = require('../../../assets/marca/paisaje-barra.png');

type Props = { active: AppTab; onChange: (tab: AppTab) => void; guest?: boolean; tienda?: boolean; oscuro?: boolean };

// barra de abajo con botones grandes y claros.
// oscuro: en videos la barra se pone oscura como el resto de la pantalla
export default function TabBar({ active, onChange, guest = false, tienda = false, oscuro = false }: Props) {
  const bordes = useSafeAreaInsets();
  // con el teclado abierto la barra se esconde para no tapar lo que se escribe
  const [teclado, setTeclado] = useState(false);
  useEffect(() => {
    const mostrar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTeclado(true));
    const ocultar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTeclado(false));
    return () => { mostrar.remove(); ocultar.remove(); };
  }, []);
  // inicio siempre es el mercado. maria esta en el boton flotante de todas las pantallas
  let tabs = [
    { name: 'Inicio' as AppTab, label: 'Inicio', Icon: House },
    { name: 'Videos' as AppTab, label: 'Videos', Icon: Play },
    { name: 'Publicar' as AppTab, label: 'Vender', Icon: Plus },
    { name: 'Guardados' as AppTab, label: 'Guardados', Icon: Bookmark },
    { name: 'Mi negocio' as AppTab, label: 'Cuenta', Icon: UserRound },
  ];
  if (guest === false) {
    tabs = [
      { name: 'Inicio' as AppTab, label: 'Inicio', Icon: House },
      { name: 'Videos' as AppTab, label: 'Videos', Icon: Play },
      { name: 'Publicar' as AppTab, label: 'Publicar', Icon: Plus },
      { name: 'Inventario' as AppTab, label: tienda ? 'Productos' : 'Cosechas', Icon: Sprout },
      { name: 'Mi negocio' as AppTab, label: 'Mi negocio', Icon: Store },
    ];
  }

  if (teclado) return null;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bordes.bottom, 8) }, oscuro && styles.barOscura]}>
      {!oscuro && <Image source={paisaje} style={styles.paisaje} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
      {tabs.map(({ name, label, Icon }) => {
        const selected = active === name;
        const add = name === 'Publicar';
        let color: string = colors.grafito;
        if (selected) color = colors.verde;
        if (oscuro) color = colors.white;
        if (add) {
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={label} key={name} onPress={() => onChange(name)} style={styles.item}>
              <View style={[styles.add, oscuro && styles.addOscuro]}><Icon size={30} color={colors.white} strokeWidth={2.8} /></View>
              <Text style={[styles.label, styles.addLabel, oscuro && styles.labelOscuro]}>{label}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} key={name} onPress={() => onChange(name)} style={styles.item}>
            <View style={[styles.iconWrap, selected && (oscuro ? styles.selectedOscuro : styles.selected)]}>
              <Icon size={25} color={color} strokeWidth={selected ? 2.6 : 2.2} />
            </View>
            <Text style={[styles.label, selected && styles.activeText, oscuro && styles.labelOscuro]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.crema, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingTop: 18, overflow: 'visible' },
  paisaje: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  barOscura: { backgroundColor: colors.grafito, borderTopColor: colors.grafito },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 58 },
  iconWrap: { width: 52, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  selected: { backgroundColor: 'rgba(255,255,255,0.85)' },
  selectedOscuro: { backgroundColor: 'rgba(255,255,255,0.18)' },
  add: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center', marginTop: -24, borderWidth: 4, borderColor: colors.crema, shadowColor: colors.grafito, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  addOscuro: { borderColor: colors.grafito },
  addLabel: { color: colors.verde, fontWeight: '900' },
  label: { fontSize: 12, marginTop: 3, color: colors.grafito, fontWeight: '800', textShadowColor: 'rgba(240,233,223,0.9)', textShadowRadius: 4 },
  activeText: { color: colors.verde, fontWeight: '900' },
  labelOscuro: { color: colors.white },
});
