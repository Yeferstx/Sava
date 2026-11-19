import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  ArrowLeft,
  Bell,
  HandCoins,
  ClipboardList,
  CloudCheck,
  MessageCircle,
  Reply,
} from 'lucide-react-native';
import { colors } from '../../shared/theme';
import {
  activarAvisos,
  alCambiarNotificaciones,
  avisosActivos,
  listarNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  type Notificacion,
} from './notificacionesRepository';

const iconos = {
  consulta: ClipboardList,
  contacto: MessageCircle,
  respuesta: Reply,
  sincronizacion: CloudCheck,
  recordatorio: HandCoins,
};

function cuando(fecha: string) {
  const minutos = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return 'Hace ' + minutos + ' min';
  const horas = Math.round(minutos / 60);
  if (horas < 24) return 'Hace ' + horas + (horas === 1 ? ' hora' : ' horas');
  return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export default function NotificacionesScreen({
  onBack,
  onAbrir,
}: {
  onBack: () => void;
  onAbrir: (n: Notificacion) => void;
}) {
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [avisos, setAvisos] = useState(false);
  const cargar = useCallback(async () => {
    try {
      setLista(await listarNotificaciones());
    } catch {
      /* nada */
    }
  }, []);
  useEffect(() => {
    void cargar();
    void avisosActivos().then(setAvisos);
    return alCambiarNotificaciones(() => void cargar());
  }, [cargar]);

  async function cambiarAvisos(valor: boolean) {
    const listo = await activarAvisos(valor);
    if (!listo) {
      Alert.alert(
        'Permiso de notificaciones',
        'Para recibir avisos en el celular, permite las notificaciones de Sava en los ajustes.',
      );
      return;
    }
    setAvisos(valor);
  }

  const sinLeer = lista.filter((n) => n.leida === 0).length;
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.volver}>
        <ArrowLeft size={20} color={colors.verde} />
        <Text style={styles.volverTexto}>Volver</Text>
      </Pressable>
      <Text style={styles.titulo}>Notificaciones</Text>
      <Text style={styles.subtitulo}>
        Solo te avisamos de cosas reales: consultas, contactos y respuestas. Las visitas no se avisan una por
        una.
      </Text>
      <View style={styles.ajuste}>
        <Bell size={18} color={colors.verde} />
        <Text style={[styles.flex, styles.ajusteTexto]}>Avisarme también en el celular</Text>
        <Switch
          value={avisos}
          onValueChange={(v) => void cambiarAvisos(v)}
          trackColor={{ true: colors.verde, false: colors.line }}
          thumbColor={colors.white}
        />
      </View>
      {sinLeer > 0 && (
        <Pressable accessibilityRole="button" onPress={() => void marcarTodasLeidas()} style={styles.todas}>
          <Text style={styles.todasTexto}>Marcar todas como leídas</Text>
        </Pressable>
      )}
      {lista.length === 0 && (
        <Text style={styles.vacio}>
          Todavía no tienes notificaciones. Cuando alguien consulte tus cosechas o te responda, aparecerá
          aquí.
        </Text>
      )}
      {lista.map((n) => {
        const Icono = iconos[n.tipo] ?? Bell;
        return (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            accessibilityLabel={(n.leida ? '' : 'Sin leer. ') + n.titulo + '. ' + n.texto}
            onPress={() => {
              void marcarLeida(n.id);
              onAbrir(n);
            }}
            style={[styles.item, n.leida === 0 && styles.itemNuevo]}
          >
            <View style={styles.icono}>
              <Icono size={18} color={colors.verde} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.itemTitulo}>{n.titulo}</Text>
              <Text style={styles.itemTexto}>{n.texto}</Text>
              <Text style={styles.itemFecha}>{cuando(n.fecha)}</Text>
            </View>
            {n.leida === 0 && <View style={styles.punto} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 18, paddingTop: 10, paddingBottom: 40 },
  volver: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  volverTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  titulo: { color: colors.verde, fontSize: 24, fontWeight: '900', marginTop: 4 },
  subtitulo: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2, marginBottom: 12 },
  ajuste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
  },
  ajusteTexto: { color: colors.grafito, fontSize: 14, fontWeight: '700' },
  todas: { alignSelf: 'flex-end', paddingVertical: 6, marginBottom: 4 },
  todasTexto: { color: colors.verde, fontSize: 13, fontWeight: '800' },
  vacio: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  itemNuevo: { borderColor: colors.verde, backgroundColor: '#F7FBF8' },
  icono: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.salvia,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitulo: { color: colors.grafito, fontSize: 15, fontWeight: '900' },
  itemTexto: { color: colors.grafito, fontSize: 14, lineHeight: 20, marginTop: 2 },
  itemFecha: { color: colors.muted, fontSize: 12, marginTop: 4 },
  punto: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.arcilla, marginTop: 4 },
});
