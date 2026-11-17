import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../../shared/theme';

// texto base del prototipo. el equipo debe revisarlo antes de un lanzamiento real
export default function LegalScreen({ onBack }: { onBack: () => void }) {
  return <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
    <Pressable onPress={onBack}><Text style={styles.back}>‹  Volver</Text></Pressable>
    <Text style={styles.title}>Privacidad y términos</Text>
    <Text style={styles.note}>Sava es un prototipo en etapa de validación. Este texto es una versión inicial y puede cambiar.</Text>

    <Text style={styles.section}>Qué datos guardamos</Text>
    <Text style={styles.body}>Tu correo para iniciar sesión, el nombre y municipio de tu finca o emprendimiento, el teléfono de contacto y las publicaciones, inventario y ventas que registres. Las ventas y el inventario son registros personales: no son facturas electrónicas ni contabilidad certificada.</Text>

    <Text style={styles.section}>Quién ve tus datos</Text>
    <Text style={styles.body}>Los compradores ven tus publicaciones, el nombre de tu finca, tu municipio y tu teléfono para contactarte por WhatsApp. Tus ventas e inventario solo los ves tú. Los guardados del comprador quedan únicamente en su celular.</Text>

    <Text style={styles.section}>Tus derechos</Text>
    <Text style={styles.body}>De acuerdo con la Ley 1581 de 2012 de protección de datos personales en Colombia, puedes conocer, actualizar, rectificar o pedir que se eliminen tus datos. Puedes editar la información de tu finca desde la app y pedir la eliminación de tu cuenta al equipo de Sava.</Text>

    <Text style={styles.section}>Términos de uso</Text>
    <Text style={styles.body}>Sava conecta a productores y compradores, pero no vende, no transporta y no procesa pagos. El precio final, la calidad y la entrega se acuerdan directamente entre las partes. Sava todavía no verifica la identidad de los productores, así que te recomendamos confirmar los datos antes de pagar.</Text>
    <Text style={styles.body}>No está permitido publicar productos falsos, engañosos o ilegales. Las publicaciones que incumplan estas reglas pueden ser retiradas.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 22, paddingTop: 35, paddingBottom: 40 },
  back: { color: colors.brown, fontWeight: '700', fontSize: 15, marginBottom: 18 }, title: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  note: { color: '#775D50', backgroundColor: '#F5E7E2', borderRadius: 13, padding: 12, fontSize: 13, lineHeight: 19, marginTop: 12, overflow: 'hidden' },
  section: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 6 }, body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 6 },
});
