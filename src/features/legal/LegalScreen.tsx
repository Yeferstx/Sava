import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../shared/theme';
import ApoyoGobernacion from '../../shared/components/ApoyoGobernacion';

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

    <Text style={styles.section}>Público y privado</Text>
    <Text style={styles.body}>Público, solo si tú lo publicas: nombre de la finca, producto, municipio, cantidad ofrecida, fotos que elijas y tu contacto. Privado siempre: gastos, ingresos, cobros, deudas, historial de tu cuaderno e inventario que no publicaste. Lo privado nunca aparece en tu perfil ni en las búsquedas.</Text>

    <Text style={styles.section}>Sin internet</Text>
    <Text style={styles.body}>Tu cuaderno (cosechas, ventas, gastos, pérdidas y cobros) se guarda primero en este celular y se envía a tu cuenta cuando vuelve la señal. Al cerrar sesión se borran de este celular tus datos privados para que otra persona no los vea; si hay registros sin enviar, Sava te avisa antes. Los datos guardados en el celular no están cifrados por la app: protege tu celular con clave o huella.</Text>

    <Text style={styles.section}>Tus derechos</Text>
    <Text style={styles.body}>De acuerdo con la Ley 1581 de 2012 de protección de datos personales en Colombia, puedes conocer, actualizar, rectificar o pedir que se eliminen tus datos. Puedes editar la información de tu finca desde la app y pedir la eliminación de tu cuenta al equipo de Sava.</Text>

    <Text style={styles.section}>Términos de uso</Text>
    <Text style={styles.body}>Sava conecta a productores y compradores, pero no vende, no transporta y no procesa pagos. El precio final, la calidad y la entrega se acuerdan directamente entre las partes. Sava todavía no verifica la identidad de los productores, así que te recomendamos confirmar los datos antes de pagar.</Text>
    <Text style={styles.body}>No está permitido publicar productos falsos, engañosos o ilegales. Las publicaciones que incumplan estas reglas pueden ser retiradas.</Text>
    <Text style={styles.body}>Las tiendas del campo solo pueden publicar agroquímicos con registro ICA vigente y etiqueta original.</Text>

    <Text style={styles.section}>María</Text>
    <Text style={styles.body}>Sava puede usar Claude (Anthropic) o Gemini (Google). Con Gemini en su plan gratis solo se envía tu pregunta y unos pocos mensajes del chat, nunca tu inventario, tus ventas ni tus cuentas, porque Google puede usar ese contenido para mejorar sus productos. No escribas datos personales o de dinero en preguntas generales.</Text>
    <Text style={styles.body}>Cuando hay internet y tienes cuenta, María usa inteligencia artificial (Claude, de la empresa Anthropic) para entender lo que escribes o dictas. Para responderte se envía tu mensaje y un resumen de tus productos y ventas; no se envían tu correo ni tu teléfono. Sin internet, María funciona con reglas dentro del celular.</Text>
    <Text style={styles.body}>María nunca guarda una publicación ni una venta sin que tú la confirmes, y puede equivocarse: revisa siempre los datos antes de confirmar.</Text>

    <View style={styles.apoyo}><ApoyoGobernacion conMapa /></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 22, paddingTop: 14, paddingBottom: 40 },
  back: { color: colors.brown, fontWeight: '700', fontSize: 15, marginBottom: 18 }, title: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  note: { color: '#775D50', backgroundColor: '#F5E7E2', borderRadius: 13, padding: 12, fontSize: 13, lineHeight: 19, marginTop: 12, overflow: 'hidden' },
  apoyo: { marginTop: 20 },
  section: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 6 }, body: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 6 },
});
