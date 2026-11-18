import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { useEspacioTeclado } from '../../shared/useEspacioTeclado';
import { colors } from '../../shared/theme';
import SavaLogo from '../../shared/components/SavaLogo';
import { limpiarTelefono, municipios, telefonoValido } from '../../shared/validaciones';
import { CATEGORIA_TIENDA } from '../../shared/roles';
import ApoyoGobernacion from '../../shared/components/ApoyoGobernacion';
import BotonEscuchar from '../../shared/components/BotonEscuchar';

export type RemoteBusiness = { id: string; owner_id: string; name: string; category: string; description: string; phone: string; municipality: string; is_published: boolean };
const categories = ['Finca', 'Huerta', 'Asociación', 'Emprendimiento agrícola', 'Otro'];

// tipo: finca de un campesino o tienda del campo (agropecuaria)
export default function BusinessSetupScreen({ user, tipo, onCreated }: { user: User; tipo: 'agricultor' | 'tienda'; onCreated: (business: RemoteBusiness) => void }) {
  const teclaEspacio = useEspacioTeclado();
  const esTienda = tipo === 'tienda';
  const [name, setName] = useState('');
  const [category, setCategory] = useState(esTienda ? CATEGORIA_TIENDA : 'Finca');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [municipality, setMunicipality] = useState('Yopal');
  const [working, setWorking] = useState(false);

  async function submit() {
    if (!name.trim() || !phone.trim()) { Alert.alert('Completa los datos', 'El nombre y el teléfono son necesarios.'); return; }
    if (name.trim().length < 3) { Alert.alert('Revisa el nombre', 'El nombre debe tener al menos 3 letras.'); return; }
    if (telefonoValido(phone) === false) { Alert.alert('Revisa el teléfono', 'Escribe un número de 10 dígitos, por ejemplo 300 123 4567. Los compradores lo usan para escribirte por WhatsApp.'); return; }
    if (municipios.includes(municipality) === false) { Alert.alert('Elige el municipio', 'Toca el municipio de Casanare donde estás.'); return; }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.from('businesses').insert({ owner_id: user.id, name: name.trim(), category, description: description.trim(), phone: limpiarTelefono(phone), municipality: municipality, is_published: true }).select('id,owner_id,name,category,description,phone,municipality,is_published').single();
      if (error) throw error;
      // se guarda el rol para que la proxima vez entre directo al panel
      await supabase.auth.updateUser({ data: { rol: tipo, municipio: municipality } });
      onCreated(data as RemoteBusiness);
    } catch (error) { Alert.alert('No se pudo registrar', error instanceof Error ? error.message : 'Intenta de nuevo.'); }
    finally { setWorking(false); }
  }

  return <View ref={teclaEspacio.ref} onLayout={teclaEspacio.medir} style={[styles.flex, { paddingBottom: teclaEspacio.espacio }]}><ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <SavaLogo size="small" /><Text style={styles.title}>{esTienda ? 'Cuéntanos de tu tienda' : 'Cuéntanos de tu finca'}</Text><Text style={styles.subtitle}>Los compradores verán este nombre, tu municipio y tu teléfono en cada publicación.</Text>
    <BotonEscuchar texto={esTienda ? 'Escribe el nombre de tu tienda, tu teléfono y toca tu municipio. Después toca el botón verde.' : 'Escribe el nombre de tu finca, tu teléfono y toca tu municipio. Después toca el botón verde.'} />
    <Text style={styles.label}>{esTienda ? 'Nombre de la tienda *' : 'Nombre de la finca o emprendimiento *'}</Text><TextInput value={name} onChangeText={setName} placeholder={esTienda ? 'Ej. Agropecuaria El Llano' : 'Ej. Finca La Esperanza'} style={styles.input} maxLength={60} />
    {!esTienda && <Text style={styles.label}>Tipo</Text>}{!esTienda && <View style={styles.options}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.option, category === item && styles.optionSelected]}><Text style={[styles.optionText, category === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>}
    <Text style={styles.label}>Descripción</Text><TextInput value={description} onChangeText={setDescription} placeholder={esTienda ? '¿Qué vendes? Ej. semillas, abonos y herramientas' : '¿Qué cultivas? Ej. piña, plátano y yuca'} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={240} />
    <Text style={styles.label}>Teléfono de contacto *</Text><TextInput value={phone} onChangeText={setPhone} placeholder="+57 300 000 0000" style={styles.input} keyboardType="phone-pad" maxLength={16} />
    <Text style={styles.label}>Municipio</Text><View style={styles.options}>{municipios.map((item) => <Pressable key={item} onPress={() => setMunicipality(item)} style={[styles.option, municipality === item && styles.optionSelected]}><Text style={[styles.optionText, municipality === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>
    <Pressable disabled={working} onPress={() => void submit()} style={[styles.submit, working && styles.disabled]}>{working ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{esTienda ? 'Crear mi tienda' : 'Crear mi finca'}</Text>}</Pressable>
    <ApoyoGobernacion />
  </ScrollView></View>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 24, paddingTop: 44, paddingBottom: 40, backgroundColor: colors.paper }, mark: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#E8F2EE', alignItems: 'center', justifyContent: 'center' }, markText: { color: colors.brown, fontWeight: '900', fontSize: 27 }, title: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 22 }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5, marginBottom: 13 }, label: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 15, marginBottom: 6 }, input: { backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink }, multiline: { height: 82 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, option: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' }, optionSelected: { backgroundColor: '#E8F2EE', borderColor: colors.brown }, optionText: { color: colors.ink, fontSize: 10 }, optionTextSelected: { color: colors.brown, fontWeight: '800' }, submit: { backgroundColor: colors.brown, borderRadius: 24, alignItems: 'center', justifyContent: 'center', height: 48, marginTop: 24 }, disabled: { opacity: 0.65 }, submitText: { color: '#fff', fontWeight: '800', fontSize: 13 } });
