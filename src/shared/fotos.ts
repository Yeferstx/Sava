// fotos: pedir permiso solo cuando se necesita, elegir o tomar la foto y achicarla antes de subirla
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// achica la foto (ancho maximo) y la comprime: sube mas rapido con poca senal.
// cuadrada: recorta el centro (para la foto de perfil tomada con la camara)
export async function optimizarFoto(uri: string, ancho = 1280, cuadrada = false) {
  try {
    let trabajo = ImageManipulator.manipulate(uri);
    if (cuadrada) {
      const original = await ImageManipulator.manipulate(uri).renderAsync();
      const lado = Math.min(original.width, original.height);
      trabajo = trabajo.crop({ originX: Math.round((original.width - lado) / 2), originY: Math.round((original.height - lado) / 2), width: lado, height: lado });
    }
    const imagen = await trabajo.resize({ width: ancho }).renderAsync();
    const guardada = await imagen.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
    return guardada.uri;
  } catch {
    return uri;
  }
}

export async function tomarOElegirFoto(origen: 'camara' | 'galeria', cuadrada = false, ancho = 1280): Promise<string | null> {
  if (origen === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) { Alert.alert('Permiso de cámara', 'Permite el uso de la cámara en los ajustes del celular para tomar la foto.'); return null; }
    // sin el recortador: en algunos celulares (y en emuladores) la camara no devolvia la foto.
    // si la foto es para el perfil, sava la recorta cuadrada
    const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85 });
    if (resultado.canceled || resultado.assets.length === 0) return null;
    return optimizarFoto(resultado.assets[0].uri, ancho, cuadrada);
  }
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) { Alert.alert('Permiso para tus fotos', 'Permite el acceso a tus fotos para elegir una imagen.'); return null; }
  const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: cuadrada ? [1, 1] : [4, 3], quality: 0.85, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
  if (resultado.canceled || resultado.assets.length === 0) return null;
  return optimizarFoto(resultado.assets[0].uri, ancho);
}

// pregunta de donde sacar la foto
export function preguntarOrigen(titulo: string, alElegir: (origen: 'camara' | 'galeria') => void, quitar?: () => void) {
  const opciones: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
    { text: 'Tomar foto', onPress: () => alElegir('camara') },
    { text: 'Elegir de la galería', onPress: () => alElegir('galeria') },
  ];
  if (quitar) opciones.push({ text: 'Quitar foto', style: 'destructive', onPress: quitar });
  opciones.push({ text: 'Cancelar', style: 'cancel' });
  Alert.alert(titulo, undefined, opciones);
}
