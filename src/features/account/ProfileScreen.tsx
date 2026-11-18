import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Store } from 'lucide-react-native';
import { getBusinessProfile, saveBusinessProfile } from '../business/data/businessRepository';
import { useEspacioTeclado } from '../../shared/useEspacioTeclado';
import { colors } from '../../shared/theme';
import SavaLogo from '../../shared/components/SavaLogo';
import { limpiarTelefono, municipios, telefonoValido } from '../../shared/validaciones';
import { CATEGORIA_TIENDA } from '../../shared/roles';

const businessCategories = ['Finca', 'Huerta', 'Asociación', 'Emprendimiento agrícola', 'Otro'];

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
  const teclaEspacio = useEspacioTeclado();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tienda');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Yopal');
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getBusinessProfile().then((business) => { if (business) { setName(business.name); setCategory(business.category); setDescription(business.description); setPhone(business.phone); setCity(business.city); } }).catch(() => Alert.alert('Error', 'No pudimos leer la información de la finca.')).finally(() => setLoading(false)); }, []);

  async function save() {
    if (!name.trim() || !phone.trim()) { Alert.alert('Completa los datos', 'El nombre de la finca y el teléfono son obligatorios.'); return; }
    if (name.trim().length < 3) { Alert.alert('Revisa el nombre', 'El nombre debe tener al menos 3 letras.'); return; }
    if (telefonoValido(phone) === false) { Alert.alert('Revisa el teléfono', 'Escribe un número de 10 dígitos, por ejemplo 300 123 4567. Los compradores lo usan para escribirte por WhatsApp.'); return; }
    if (municipios.includes(city) === false) { Alert.alert('Elige el municipio', 'Selecciona el municipio de Casanare donde está tu finca.'); return; }
    try { await saveBusinessProfile({ name: name.trim(), category, description: description.trim(), phone: limpiarTelefono(phone), city: city }); Alert.alert('Finca actualizada', 'Los cambios quedaron guardados en este dispositivo.'); }
    catch { Alert.alert('No se pudo guardar', 'Intenta de nuevo.'); }
  }

  return <View ref={teclaEspacio.ref} onLayout={teclaEspacio.medir} style={[styles.flex, { paddingBottom: teclaEspacio.espacio }]}><ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Pressable onPress={onBack}><Text style={styles.back}>‹  Volver</Text></Pressable><SavaLogo size="small" /><Text style={styles.title}>{category === CATEGORIA_TIENDA ? 'Información de la tienda' : 'Información de la finca'}</Text><Text style={styles.subtitle}>Estos datos ayudan a que los compradores sepan quién eres y cómo encontrarte.</Text>
    <View style={styles.avatar}><Store size={38} color={colors.brown} strokeWidth={1.6} /></View>
    <Text style={styles.label}>Nombre de la finca o emprendimiento *</Text><TextInput editable={!loading} value={name} onChangeText={setName} placeholder="Nombre de la finca" style={styles.input} maxLength={60} />
    {category !== CATEGORIA_TIENDA && <Text style={styles.label}>Tipo</Text>}{category !== CATEGORIA_TIENDA && <View style={styles.options}>{businessCategories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.option, category === item && styles.optionSelected]}><Text style={[styles.optionText, category === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>}
    <Text style={styles.label}>Descripción</Text><TextInput value={description} onChangeText={setDescription} placeholder="¿Qué cultivas?" style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={240} />
    <Text style={styles.label}>Teléfono de contacto *</Text><TextInput value={phone} onChangeText={setPhone} placeholder="+57 300 000 0000" style={styles.input} keyboardType="phone-pad" maxLength={16} />
    <Text style={styles.label}>Municipio</Text><View style={styles.options}>{municipios.map((item) => <Pressable key={item} onPress={() => setCity(item)} style={[styles.option, city === item && styles.optionSelected]}><Text style={[styles.optionText, city === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>
    <Pressable disabled={loading} onPress={save} style={[styles.button, loading && styles.disabled]}><Text style={styles.buttonText}>{loading ? 'Cargando…' : 'Guardar información'}</Text></Pressable>
    <Text style={styles.note}>●  Los cambios quedan guardados sin internet y listos para sincronizar.</Text>
  </ScrollView></View>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 24, paddingTop: 14, paddingBottom: 40 }, back: { color: colors.brown, fontWeight: '700', fontSize: 14, marginBottom: 15 }, brand: { color: colors.brown, fontSize: 28, fontWeight: '900' }, title: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 22 }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 }, avatar: { width: 75, height: 75, backgroundColor: '#E8F2EE', borderRadius: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 20 }, avatarText: { fontSize: 39 }, label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 15, marginBottom: 7 }, input: { backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink }, multiline: { height: 88 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, option: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' }, optionSelected: { backgroundColor: '#E8F2EE', borderColor: colors.brown }, optionText: { color: colors.ink, fontSize: 10 }, optionTextSelected: { color: colors.brown, fontWeight: '800' }, button: { backgroundColor: colors.brown, borderRadius: 24, alignItems: 'center', padding: 14, marginTop: 22 }, disabled: { opacity: 0.6 }, buttonText: { color: '#fff', fontWeight: '800' }, note: { color: '#064229', fontSize: 10, textAlign: 'center', marginTop: 12 } });
