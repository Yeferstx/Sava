import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const escudo = require('../../../assets/marca/gobernacion-casanare.png');
const mapa = require('../../../assets/marca/mapa-casanare.png');

// sello de apoyo institucional. el escudo es de la gobernacion de casanare
export default function ApoyoGobernacion({ conMapa = false }: { conMapa?: boolean }) {
  return (
    <View accessible accessibilityLabel="Con el apoyo de la Gobernación de Casanare" style={styles.fila}>
      {conMapa && <Image source={mapa} style={styles.mapa} resizeMode="contain" />}
      <View style={styles.textos}>
        <Text style={styles.chico}>Con el apoyo de</Text>
        <Text style={styles.nombre}>Gobernación de Casanare</Text>
      </View>
      <Image source={escudo} style={styles.escudo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 8 },
  textos: { alignItems: 'flex-end' },
  chico: { color: colors.muted, fontSize: 11 },
  nombre: { color: colors.grafito, fontSize: 13, fontWeight: '800' },
  escudo: { width: 40, height: 50 },
  mapa: { width: 56, height: 35 },
});
