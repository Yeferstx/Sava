// ventana para ver el reporte dentro de la app y luego descargarlo o compartirlo
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Download, Share2, X } from 'lucide-react-native';
import { colors } from '../../shared/theme';
import { armarReporte, compartirPdf, crearPdf, guardarPdf } from './reporte';
import type { Periodo } from './cuadernoRepository';

type Props = {
  visible: boolean;
  periodo: Periodo;
  tipo: 'agricultor' | 'tienda';
  onCerrar: () => void;
};

// para que la hoja quepa a lo ancho de la pantalla
const AJUSTE = '<head><meta name="viewport" content="width=820, user-scalable=yes">';

export default function VisorReporte(props: Props) {
  const [html, setHtml] = useState('');
  const [pdf, setPdf] = useState('');
  const [ocupado, setOcupado] = useState('');

  // cada vez que se abre se arma con los datos de ese momento
  useEffect(() => {
    if (!props.visible) return;
    setHtml('');
    setPdf('');
    armarReporte(props.periodo, props.tipo)
      .then((texto) => {
        setHtml(texto.replace('<head>', AJUSTE));
      })
      .catch(() => {
        Alert.alert('No se pudo crear el reporte', 'Intenta otra vez.');
        props.onCerrar();
      });
  }, [props.visible, props.periodo, props.tipo]);

  // el pdf se crea una sola vez y sirve para descargar y compartir
  async function archivo() {
    if (pdf !== '') return pdf;
    const uri = await crearPdf(html, props.periodo);
    setPdf(uri);
    return uri;
  }

  async function descargar() {
    setOcupado('descargar');
    try {
      const guardado = await guardarPdf(await archivo());
      if (guardado) {
        Alert.alert('¡Reporte descargado!', 'Quedó guardado en la carpeta que elegiste.');
      }
    } catch {
      Alert.alert('No se pudo descargar', 'Prueba con otra carpeta, por ejemplo «Descargas».');
    }
    setOcupado('');
  }

  async function compartir() {
    setOcupado('compartir');
    try {
      await compartirPdf(await archivo());
    } catch {
      Alert.alert('No se pudo compartir', 'Intenta otra vez.');
    }
    setOcupado('');
  }

  const bloqueado = html === '' || ocupado !== '';

  let iconoDescargar = <Download size={20} color={colors.white} />;
  if (ocupado === 'descargar') iconoDescargar = <ActivityIndicator color={colors.white} />;

  let iconoCompartir = <Share2 size={20} color={colors.verde} />;
  if (ocupado === 'compartir') iconoCompartir = <ActivityIndicator color={colors.verde} />;

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onCerrar}>
      <View style={styles.pantalla}>
        <View style={styles.cabeza}>
          <Text style={styles.titulo}>Así va tu negocio</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar reporte"
            hitSlop={10}
            onPress={props.onCerrar}
          >
            <X size={26} color={colors.grafito} />
          </Pressable>
        </View>

        {html === '' && (
          <View style={styles.cargando}>
            <ActivityIndicator size="large" color={colors.verde} />
            <Text style={styles.cargandoTexto}>Preparando tu reporte…</Text>
          </View>
        )}

        {html !== '' && (
          <WebView
            originWhitelist={['*']}
            source={{ html: html }}
            style={styles.hoja}
            javaScriptEnabled={false}
            scalesPageToFit
            setDisplayZoomControls={false}
          />
        )}

        <View style={styles.botones}>
          <Pressable
            accessibilityRole="button"
            disabled={bloqueado}
            onPress={() => void descargar()}
            style={[styles.boton, styles.principal, bloqueado && styles.apagado]}
          >
            {iconoDescargar}
            <Text style={styles.textoPrincipal}>Descargar PDF</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={bloqueado}
            onPress={() => void compartir()}
            style={[styles.boton, styles.secundario, bloqueado && styles.apagado]}
          >
            {iconoCompartir}
            <Text style={styles.textoSecundario}>Compartir</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.crema },
  cabeza: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  titulo: { color: colors.verde, fontSize: 20, fontWeight: '900' },
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  cargandoTexto: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  hoja: { flex: 1, marginHorizontal: 12, borderRadius: 14, backgroundColor: colors.white },
  botones: { flexDirection: 'row', gap: 10, padding: 14 },
  boton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  principal: { backgroundColor: colors.verde },
  secundario: { backgroundColor: colors.verdeClaro },
  apagado: { opacity: 0.5 },
  textoPrincipal: { color: colors.white, fontSize: 16, fontWeight: '900' },
  textoSecundario: { color: colors.verde, fontSize: 16, fontWeight: '900' },
});
