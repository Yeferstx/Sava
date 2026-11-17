import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LOGO_ALTO, LOGO_ANCHO, piezas } from '../../features/splash/logoSava';

// logo oficial de sava (simbolo + palabra), con las mismas formas de la animacion de inicio
export default function SavaLogo({ size = 'regular', centrado = false }: { size?: 'regular' | 'small' | 'large'; centrado?: boolean }) {
  let ancho = 64;
  if (size === 'small') ancho = 54;
  if (size === 'large') ancho = 120;
  const alto = ancho * (LOGO_ALTO / LOGO_ANCHO);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Sava" style={[styles.logo, centrado && styles.centrado]}>
      <Svg width={ancho} height={alto} viewBox={`0 0 ${LOGO_ANCHO} ${LOGO_ALTO}`}>
        {piezas.map((pieza) => <Path key={pieza.id} d={pieza.d} fill={pieza.color} fillRule="evenodd" />)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ logo: { alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }, centrado: { alignSelf: 'center' } });
