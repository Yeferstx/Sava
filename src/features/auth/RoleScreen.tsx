import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ShoppingBasket, Sprout } from 'lucide-react-native';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import SavaLogo from '../../shared/components/SavaLogo';
import { colors } from '../../shared/theme';
import { municipios } from '../../shared/validaciones';

export type Rol = 'agricultor' | 'comprador';

// despues de crear la cuenta se elige como usar sava.
// el rol y el municipio se guardan en los datos del usuario de supabase
export default function RoleScreen({ onElegido, onSignOut }: { onElegido: (rol: Rol, municipio: string) => void; onSignOut: () => void }) {
  const [rol, setRol] = useState<Rol | null>(null);
  const [municipio, setMunicipio] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function continuar() {
    if (!rol) { Alert.alert('Elige una opción', 'Cuéntanos si vas a vender o a comprar.'); return; }
    if (rol === 'comprador' && municipios.includes(municipio) === false) { Alert.alert('Elige tu municipio', 'Así te mostramos primero las cosechas cercanas.'); return; }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setGuardando(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { rol, municipio } });
      if (error) throw error;
      onElegido(rol, municipio);
    } catch { Alert.alert('No se pudo guardar', 'Revisa tu conexión e intenta de nuevo.'); }
    finally { setGuardando(false); }
  }

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
    <SavaLogo size="small" />
    <Text style={styles.title}>¿Cómo vas a usar Sava?</Text>
    <Text style={styles.subtitle}>Puedes cambiarlo más adelante.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ selected: rol === 'agricultor' }} onPress={() => setRol('agricultor')} style={[styles.card, rol === 'agricultor' && styles.cardSelected]}>
      <View style={styles.icon}><Sprout size={26} color={colors.brown} /></View>
      <View style={styles.flex}><Text style={styles.cardTitle}>Soy agricultor o productor</Text><Text style={styles.cardBody}>Quiero publicar mis cosechas, llevar mi inventario y registrar ventas.</Text></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{ selected: rol === 'comprador' }} onPress={() => setRol('comprador')} style={[styles.card, rol === 'comprador' && styles.cardSelected]}>
      <View style={styles.icon}><ShoppingBasket size={26} color={colors.brown} /></View>
      <View style={styles.flex}><Text style={styles.cardTitle}>Soy comprador</Text><Text style={styles.cardBody}>Persona, restaurante, frutería, tienda o distribuidor que busca productos del campo.</Text></View>
    </Pressable>
    {rol === 'comprador' && <>
      <Text style={styles.label}>¿En qué municipio compras?</Text>
      <View style={styles.options}>{municipios.map((item) => <Pressable key={item} onPress={() => setMunicipio(item)} style={[styles.option, municipio === item && styles.optionSelected]}><Text style={[styles.optionText, municipio === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>
    </>}
    {rol === 'agricultor' && <Text style={styles.hint}>En el siguiente paso registras tu finca o emprendimiento.</Text>}
    <Pressable disabled={guardando} onPress={() => void continuar()} style={[styles.submit, guardando && styles.disabled]}>{guardando ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Continuar</Text>}</Pressable>
    <Pressable onPress={onSignOut} style={styles.link}><Text style={styles.linkText}>Cerrar sesión</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 24, paddingTop: 44, paddingBottom: 40 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900', marginTop: 22 }, subtitle: { color: colors.muted, fontSize: 14, marginTop: 5, marginBottom: 18 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderRadius: 18, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white, marginBottom: 11 },
  cardSelected: { borderColor: colors.brown, backgroundColor: colors.verdeClaro },
  icon: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, cardBody: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 12, marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  optionSelected: { backgroundColor: colors.verdeClaro, borderColor: colors.brown }, optionText: { color: colors.ink, fontSize: 13 }, optionTextSelected: { color: colors.brown, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 13, marginTop: 6 },
  submit: { backgroundColor: colors.brown, borderRadius: 25, alignItems: 'center', justifyContent: 'center', height: 50, marginTop: 24 }, disabled: { opacity: 0.65 }, submitText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  link: { alignItems: 'center', padding: 14 }, linkText: { color: colors.brown, fontWeight: '700', fontSize: 13 },
});
