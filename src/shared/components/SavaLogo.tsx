import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

export default function SavaLogo({ size = 'regular' }: { size?: 'regular' | 'small' }) {
  const compact = size === 'small';
  const hatWidth = compact ? 46 : 58;
  const hatHeight = compact ? 19 : 23;
  return (
    <View accessibilityLabel="Sava" style={styles.logo}>
      <Svg width={hatWidth} height={hatHeight} viewBox="0 0 64 34" fill="none">
        <Path d="M5 25.5c7-4.2 12.7-4.2 18.2-2.5C25 11.8 28.7 6.5 33.1 7.3c4.6.7 7.5 7.4 10.2 16.1 5.2-.1 10.2 1.7 15.8 5-13.6 4.8-41.8 3.2-54.1-2.9Z" fill="#f5e7d5" stroke={colors.brown} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M22.8 22.8c6.3 2 13.4 2.3 20.5.6M24.9 18.2c4.2 2.1 8.7 2.8 13.1 2.1" stroke={colors.brown} strokeWidth="2.2" strokeLinecap="round" />
      </Svg>
      <Text style={[styles.wordmark, compact && styles.compact]} allowFontScaling={false}>Sava</Text>
    </View>
  );
}

const styles = StyleSheet.create({ logo: { alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }, wordmark: { color: colors.brown, fontSize: 31, fontWeight: '900', letterSpacing: -1.7, lineHeight: 33 }, compact: { fontSize: 25, letterSpacing: -1.2, lineHeight: 28 } });
