import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X } from 'lucide-react-native';
import { createProduct } from './data/inventoryRepository';
import { colors } from '../../shared/theme';
import type { ProductDraft } from '../chat/types';

const categories = ['Abarrotes', 'Comida', 'Agro', 'Servicios', 'Otros'];
const units = ['unidad', 'kg', 'bulto', 'libra', 'servicio'];

type Props = { onBack: () => void; onCreated: () => void; initialDraft?: ProductDraft | null };

export default function PublishScreen({ onBack, onCreated, initialDraft }: Props) {
  const [name, setName] = useState(initialDraft?.name ?? '');
  const [description, setDescription] = useState(initialDraft?.description ?? '');
  const [category, setCategory] = useState(initialDraft?.category ?? 'Abarrotes');
  const [price, setPrice] = useState(initialDraft?.price_cop ? String(initialDraft.price_cop) : '');
  const [stock, setStock] = useState(initialDraft?.stock ? String(initialDraft.stock) : '');
  const [unit, setUnit] = useState(initialDraft?.unit ?? 'unidad');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso para tus fotos', 'Permite el acceso a la fototeca para elegir una imagen del producto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
    if (!result.canceled) setPhotoUri(result.assets[0]?.uri ?? null);
  }

  async function submit() {
    const parsedPrice = Number(price.replace(/[^\d]/g, ''));
    const parsedStock = Number(stock.replace(',', '.'));
    if (!name.trim() || !parsedPrice || !stock || !Number.isFinite(parsedStock) || parsedStock < 0) {
      Alert.alert('Revisa la publicación', 'Escribe un nombre, un precio válido y la cantidad disponible.');
      return;
    }
    try {
      setSaving(true);
      await createProduct({ name: name.trim(), category, description: description.trim(), price_cop: parsedPrice, stock: parsedStock, unit, photo_uri: photoUri });
      Alert.alert('Producto guardado', 'La publicación quedó guardada en el celular. Cuando vuelva la conexión, la foto y el producto se sincronizarán.');
      onCreated();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally { setSaving(false); }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack}><Text style={styles.back}>‹  Volver</Text></Pressable>
      <Text style={styles.title}>Publica algo nuevo</Text>
      <Text style={styles.subtitle}>Cuéntales a tus clientes qué tienes disponible.</Text>
      <Text style={styles.label}>¿Qué ofreces? *</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Ej. Arroz de la región" style={styles.input} maxLength={80} />
      <Text style={styles.label}>Categoría</Text>
      <View style={styles.options}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.option, category === item && styles.optionSelected]}><Text style={[styles.optionText, category === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View>

      <Text style={styles.label}>Foto del producto</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={photoUri ? 'Cambiar foto del producto' : 'Elegir foto del producto'} onPress={() => void choosePhoto()} style={styles.photoPicker}>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" /> : <View style={styles.photoEmpty}><ImagePlus size={27} color={colors.brown} /><Text style={styles.photoHint}>Añade una foto real</Text><Text style={styles.photoSubhint}>Elige una imagen de tu celular</Text></View>}
      </Pressable>
      {photoUri && <Pressable accessibilityRole="button" onPress={() => setPhotoUri(null)} style={styles.removePhoto}><X size={14} color={colors.brown} /><Text style={styles.removePhotoText}>Quitar foto</Text></Pressable>}

      <Text style={styles.label}>Precio por unidad (COP) *</Text>
      <TextInput value={price} onChangeText={setPrice} placeholder="Ej. 80.000" style={styles.input} keyboardType="number-pad" />
      <Text style={styles.label}>Cantidad disponible *</Text>
      <View style={styles.stockRow}><TextInput value={stock} onChangeText={setStock} placeholder="Ej. 20" style={[styles.input, styles.stockInput]} keyboardType="decimal-pad" /><View style={styles.options}>{units.map((item) => <Pressable key={item} onPress={() => setUnit(item)} style={[styles.option, unit === item && styles.optionSelected]}><Text style={[styles.optionText, unit === item && styles.optionTextSelected]}>{item}</Text></Pressable>)}</View></View>
      <Text style={styles.label}>Descripción</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="Origen, presentación o detalles para tus clientes" style={[styles.input, styles.multiline]} multiline textAlignVertical="top" maxLength={240} />
      <Text style={styles.counter}>{description.length}/240</Text>
      <Pressable disabled={saving} onPress={() => void submit()} style={[styles.submit, saving && styles.disabled]}><Text style={styles.submitText}>{saving ? 'Guardando…' : 'Guardar publicación'}</Text></Pressable>
      <Text style={styles.footnote}>Puedes preparar publicaciones sin internet. Se sincronizarán cuando vuelva la conexión.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 23, paddingTop: 35, paddingBottom: 40 }, back: { color: colors.brown, fontWeight: '700', fontSize: 15, marginBottom: 18 }, title: { color: colors.ink, fontSize: 27, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 19 }, label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 17, marginBottom: 7 }, input: { backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontSize: 14 }, photoPicker: { height: 175, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', backgroundColor: '#f8f1e9' }, photoPreview: { width: '100%', height: '100%' }, photoEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 7 }, photoHint: { color: colors.brown, fontSize: 13, fontWeight: '800' }, photoSubhint: { color: colors.muted, fontSize: 11 }, removePhoto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 9 }, removePhotoText: { color: colors.brown, fontSize: 11, fontWeight: '700' }, multiline: { height: 92 }, counter: { color: colors.muted, fontSize: 10, textAlign: 'right', marginTop: 4 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, option: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' }, optionSelected: { backgroundColor: '#f2e2d1', borderColor: colors.brown }, optionText: { fontSize: 10, color: colors.ink }, optionTextSelected: { color: colors.brown, fontWeight: '800' }, stockRow: { gap: 9 }, stockInput: { width: 120 }, submit: { backgroundColor: colors.brown, borderRadius: 24, alignItems: 'center', padding: 15, marginTop: 25 }, disabled: { opacity: 0.6 }, submitText: { color: '#fff', fontWeight: '800', fontSize: 14 }, footnote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 10, textAlign: 'center' },
});
