import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Store } from 'lucide-react-native';
import { getBusinessProfile, saveBusinessProfile } from '../business/data/businessRepository';
import { colors } from '../../shared/theme';
import SavaLogo from '../../shared/components/SavaLogo';

const businessCategories = ['Tienda', 'Restaurante', 'Agro', 'Servicios', 'Otro'];

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tienda');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Yopal');
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getBusinessProfile().then((business) => { if (business) { setName(business.name); setCategory(business.category); setDescription(business.description); setPhone(business.phone); setCity(business.city); } }).catch(() => Alert.alert('Error', 'No pudimos leer la información del negocio.')).finally(() => setLoading(false)); }, []);

  async function save() {
    if (!name.trim() || !phone.trim()) { Alert.alert('Completa los datos', 'El nombre del negocio y el teléfono son obligatorios.'); return; }
    try { await saveBusinessProfile({ name: name.trim(), category, description: description.trim(), phone: phone.trim(), city: city.trim() || 'Yopal' }); Alert.alert('Negocio actualizado', 'Los cambios quedaron guardados en este dispositivo.'); }
    catch { Alert.alert('No se pudo guardar', 'Intenta de nuevo.'); }
  }

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={onBack}><Text style={styles.back}>‹  Mi negocio</Text></Pressable><SavaLogo size="small" /><Text style={styles.title}>Información del negocio</Text><Text style={styles.subtitle}>Estos datos ayudan a que los clientes sepan quién eres y cómo encontrarte.</Text>
    <View style={styles.avatar}><Store size={38} color={colors.brown} strokeWidth={1.6} /></View>
    <Text style={styles.label}>Nombre del negocio *</Text><TextInput editable={!loading} value={name} onChangeText={setName} placeholder="Nombre del negocio" style={styles.input} />
    <Text style={styles.label}>Actividad</Text><View style={styles.options}>{businessCategories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.option, category === item && styles.optionSelected]}><Text style={[styles.optionText, category === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>
    <Text style={styles.label}>Descripción</Text><TextInput value={description} onChangeText={setDescription} placeholder="¿Qué hace especial tu negocio?" style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={240} />
    <Text style={styles.label}>Teléfono de contacto *</Text><TextInput value={phone} onChangeText={setPhone} placeholder="+57 300 000 0000" style={styles.input} keyboardType="phone-pad" />
    <Text style={styles.label}>Municipio</Text><TextInput value={city} onChangeText={setCity} placeholder="Yopal" style={styles.input} />
    <Pressable disabled={loading} onPress={save} style={[styles.button, loading && styles.disabled]}><Text style={styles.buttonText}>{loading ? 'Cargando…' : 'Guardar información'}</Text></Pressable>
    <Text style={styles.note}>●  Los cambios quedan guardados sin internet y listos para sincronizar.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 24, paddingTop: 35, paddingBottom: 40 }, back: { color: colors.brown, fontWeight: '700', fontSize: 14, marginBottom: 15 }, brand: { color: colors.brown, fontSize: 28, fontWeight: '900' }, title: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 22 }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 }, avatar: { width: 75, height: 75, backgroundColor: '#ecd9c8', borderRadius: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 20 }, avatarText: { fontSize: 39 }, label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 15, marginBottom: 7 }, input: { backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink }, multiline: { height: 88 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, option: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' }, optionSelected: { backgroundColor: '#f2e2d1', borderColor: colors.brown }, optionText: { color: colors.ink, fontSize: 10 }, optionTextSelected: { color: colors.brown, fontWeight: '800' }, button: { backgroundColor: colors.brown, borderRadius: 24, alignItems: 'center', padding: 14, marginTop: 22 }, disabled: { opacity: 0.6 }, buttonText: { color: '#fff', fontWeight: '800' }, note: { color: '#71804e', fontSize: 10, textAlign: 'center', marginTop: 12 } });
