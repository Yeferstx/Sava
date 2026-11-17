import { useEffect, useState } from 'react';
import { Image, Keyboard, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bookmark, House, Play, Plus, Sprout, Store, UserRound } from 'lucide-react-native';
import type { AppTab } from '../../navigation/types';
import { colors } from '../theme';

// paisaje llanero completo (arboles, sol, horizonte y pasto) de fondo de la barra
const paisaje = require('../../../assets/marca/paisaje-barra.png');
// ancho / alto de la imagen: se respeta para no estirarla ni recortarla
const PROPORCION = 1600 / 385;

// alto de la barra: lo que mide el paisaje a lo ancho del celular,
// y nunca menos de lo que necesitan los botones mas el borde de abajo del celular
export function alturaBarra(ancho: number, bordeAbajo: number) {
  return Math.max(Math.round(ancho / PROPORCION), 62 + Math.max(bordeAbajo, 8));
}

type Props = { active: AppTab; onChange: (tab: AppTab) => void; guest?: boolean; tienda?: boolean; oscuro?: boolean };

// barra de abajo: una sola pieza con el paisaje detras de los cinco botones.
// oscuro: en videos la barra se pone oscura como el resto de la pantalla
export default function TabBar({ active, onChange, guest = false, tienda = false, oscuro = false }: Props) {
  const bordes = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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

  const abajo = Math.max(bordes.bottom, 8);
  const alto = alturaBarra(width, bordes.bottom);
  const altoPaisaje = Math.round(width / PROPORCION);

  return (
    <View style={[styles.bar, { height: alto }, oscuro && styles.barOscura]}>
      {!oscuro && <Image source={paisaje} style={[styles.paisaje, { width, height: altoPaisaje }]} resizeMode="stretch" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
      <View style={[styles.fila, { paddingBottom: abajo }]}>
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
                <View style={[styles.etiqueta, oscuro && styles.etiquetaOscura]}><Text style={[styles.label, styles.addLabel, oscuro && styles.labelOscuro]}>{label}</Text></View>
              </Pressable>
            );
          }
          return (
            <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} key={name} onPress={() => onChange(name)} style={styles.item}>
              {/* capa crema suave detras de cada boton: se lee bien sin tapar el paisaje */}
              <View style={[styles.boton, oscuro && styles.botonOscuro, selected && (oscuro ? styles.selectedOscuro : styles.selected)]}>
                <Icon size={24} color={color} strokeWidth={selected ? 2.6 : 2.2} />
                <Text style={[styles.label, selected && styles.activeText, oscuro && styles.labelOscuro]} numberOfLines={1}>{label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.crema, overflow: 'visible' },
  barOscura: { backgroundColor: colors.grafito },
  // el paisaje va pegado abajo y ocupa todo el ancho con su proporcion original
  paisaje: { position: 'absolute', left: 0, bottom: 0 },
  fila: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 4 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  boton: { alignItems: 'center', justifyContent: 'center', minWidth: 62, height: 54, paddingHorizontal: 6, borderRadius: 16, backgroundColor: 'rgba(240,233,223,0.72)' },
  botonOscuro: { backgroundColor: 'transparent' },
  selected: { backgroundColor: 'rgba(255,255,255,0.94)' },
  selectedOscuro: { backgroundColor: 'rgba(255,255,255,0.18)' },
  add: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.crema, marginBottom: 2, shadowColor: colors.grafito, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  addOscuro: { borderColor: colors.grafito },
  etiqueta: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 1, backgroundColor: 'rgba(240,233,223,0.72)' },
  etiquetaOscura: { backgroundColor: 'transparent' },
  addLabel: { color: colors.verde, fontWeight: '900', marginTop: 0 },
  label: { fontSize: 12, marginTop: 3, color: colors.grafito, fontWeight: '800' },
  activeText: { color: colors.verde, fontWeight: '900' },
  labelOscuro: { color: colors.white },
});
