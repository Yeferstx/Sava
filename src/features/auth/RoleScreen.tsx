import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CircleCheck } from 'lucide-react-native';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import SavaLogo from '../../shared/components/SavaLogo';
import BotonEscuchar from '../../shared/components/BotonEscuchar';
import ApoyoGobernacion from '../../shared/components/ApoyoGobernacion';
import { colors } from '../../shared/theme';
import { roles, type Rol } from '../../shared/roles';

export type { Rol };

// para cuentas que todavia no dicen como usan sava.
// tarjetas grandes con dibujo y boton para escuchar, pensado para quien lee poco
export default function RoleScreen({
  onElegido,
  onSignOut,
}: {
  onElegido: (rol: Rol) => void;
  onSignOut: () => void;
}) {
  const [rol, setRol] = useState<Rol | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function continuar() {
    if (!rol) {
      Alert.alert('Toca una opción', 'Elige lo que eres para seguir.');
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setGuardando(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { rol } });
      if (error) throw error;
      onElegido(rol);
    } catch {
      Alert.alert('No se pudo guardar', 'Revisa tu conexión e intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <SavaLogo size="small" centrado />
      <Text style={styles.title}>¿Qué eres?</Text>
      <View style={styles.centro}>
        <BotonEscuchar
          centrado
          texto="¿Qué eres? Toca una de las tres opciones. Campesino, tienda del campo o comprador."
        />
      </View>
      {roles.map((item) => {
        const elegido = rol === item.rol;
        return (
          <Pressable
            key={item.rol}
            accessibilityRole="radio"
            accessibilityState={{ checked: elegido }}
            accessibilityLabel={item.titulo + '. ' + item.texto}
            onPress={() => setRol(item.rol)}
            style={[styles.card, elegido && styles.cardSelected]}
          >
            <View style={[styles.icon, elegido && styles.iconSelected]}>
              <item.Icon size={38} color={elegido ? colors.white : colors.verde} strokeWidth={1.8} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{item.titulo}</Text>
              <Text style={styles.cardBody}>{item.texto}</Text>
              <View style={styles.escuchar}>
                <BotonEscuchar texto={item.voz} />
              </View>
            </View>
            {elegido && <CircleCheck size={26} color={colors.verde} />}
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        disabled={guardando}
        onPress={() => void continuar()}
        style={[styles.submit, (guardando || !rol) && styles.disabled]}
      >
        {guardando ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitText}>Seguir</Text>
        )}
      </Pressable>
      <Pressable onPress={onSignOut} style={styles.link}>
        <Text style={styles.linkText}>Cerrar sesión</Text>
      </Pressable>
      <ApoyoGobernacion conMapa />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 22, paddingTop: 40, paddingBottom: 30, backgroundColor: colors.crema, flexGrow: 1 },
  title: { color: colors.verde, fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: 16 },
  centro: { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    marginBottom: 12,
  },
  cardSelected: { borderColor: colors.verde, backgroundColor: colors.verdeClaro },
  icon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: colors.verdeClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSelected: { backgroundColor: colors.verde },
  cardTitle: { color: colors.grafito, fontSize: 19, fontWeight: '900' },
  cardBody: { color: colors.muted, fontSize: 14, lineHeight: 19, marginTop: 3 },
  escuchar: { marginTop: 8 },
  submit: {
    backgroundColor: colors.verde,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    marginTop: 10,
  },
  disabled: { opacity: 0.55 },
  submitText: { color: colors.white, fontWeight: '900', fontSize: 18 },
  link: { alignItems: 'center', padding: 14 },
  linkText: { color: colors.verde, fontWeight: '700', fontSize: 14 },
});
