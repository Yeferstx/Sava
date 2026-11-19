import { Image, StyleSheet, Text, View } from 'react-native';
import { Sprout } from 'lucide-react-native';
import { colors } from '../theme';

const mapa = require('../../../assets/marca/mapa-casanare.png');

// sello de origen. no se muestra apoyo institucional mientras no exista una colaboracion oficial confirmada
export default function ApoyoGobernacion({ conMapa = false }: { conMapa?: boolean }) {
  return (
    <View accessible accessibilityLabel="Hecho en Casanare" style={styles.fila}>
      {conMapa ? (
        <Image source={mapa} style={styles.mapa} resizeMode="contain" />
      ) : (
        <Sprout size={16} color={colors.verde} />
      )}
      <Text style={styles.nombre}>Hecho en Casanare</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  nombre: { color: colors.verde, fontSize: 13, fontWeight: '800' },
  mapa: { width: 48, height: 30 },
});
