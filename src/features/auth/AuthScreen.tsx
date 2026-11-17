import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { colors } from '../../shared/theme';
import SavaLogo from '../../shared/components/SavaLogo';

type AuthPurpose = 'buyer' | 'seller' | 'general';

export default function AuthScreen({ onContinueGuest, purpose = 'general' }: { onContinueGuest?: () => void; purpose?: AuthPurpose }) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    const supabase = getSupabaseClient();
    if (!supabase) { Alert.alert('Falta configurar Supabase', 'Revisa las variables EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.'); return; }
    if (!email.trim() || password.length < 8) { setMessage('Escribe un correo válido y una contraseña de al menos 8 caracteres.'); return; }
    setWorking(true); setMessage('');
    try {
      const result = mode === 'signUp'
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (mode === 'signUp' && !result.data.session) setMessage('Revisa tu correo para confirmar la cuenta. Después vuelve e inicia sesión.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos conectar. Intenta de nuevo.');
    } finally { setWorking(false); }
  }

  return <View style={styles.screen}>
    <SavaLogo size="small" />
    <Text style={styles.title}>{mode === 'signIn' ? 'Qué bueno verte' : 'Crea tu cuenta'}</Text>
    <Text style={styles.subtitle}>{purpose === 'buyer' ? mode === 'signIn' ? 'Inicia sesión para enviar este pedido y consultar su estado.' : 'Crea una cuenta de cliente para hacer pedidos. No necesitas registrar un negocio.' : purpose === 'seller' ? mode === 'signIn' ? 'Entra para administrar tu negocio o continuar con tu cuenta.' : 'Crea una cuenta para publicar y administrar tu negocio.' : mode === 'signIn' ? 'Entra para hacer pedidos o administrar tu negocio.' : 'Crea una cuenta para comprar en Sava. Si tienes un negocio, podrás registrarlo después.'}</Text>
    <Text style={styles.label}>Correo electrónico</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="tu@negocio.com" placeholderTextColor="#958a7d" style={styles.input} />
    <Text style={styles.label}>Contraseña</Text><TextInput secureTextEntry autoCapitalize="none" autoComplete={mode === 'signUp' ? 'new-password' : 'password'} value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" placeholderTextColor="#958a7d" style={styles.input} onSubmitEditing={() => void submit()} />
    {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
    <Pressable disabled={working} onPress={() => void submit()} style={[styles.submit, working && styles.disabled]}>{working ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{mode === 'signIn' ? 'Iniciar sesión' : 'Crear cuenta'}</Text>}</Pressable>
    <Pressable onPress={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setMessage(''); }} style={styles.toggle}><Text style={styles.toggleText}>{mode === 'signIn' ? '¿Nuevo en Sava? Crea tu cuenta' : 'Ya tienes cuenta? Inicia sesión'}</Text></Pressable>
    {!!onContinueGuest && <Pressable onPress={onContinueGuest} style={styles.toggle}><Text style={styles.toggleText}>Seguir explorando sin cuenta</Text></Pressable>}
    <Text style={styles.footnote}>{purpose === 'buyer' ? 'Tu cuenta de cliente no necesita un negocio. Puedes registrar uno más adelante.' : 'Tus productos y movimientos se guardan en el dispositivo y se sincronizan cuando vuelve internet.'}</Text>
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, justifyContent: 'center', padding: 27, backgroundColor: colors.paper }, mark: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#f2e3d4', alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, markText: { color: colors.brown, fontWeight: '900', fontSize: 28 }, brand: { color: colors.brown, fontWeight: '900', fontSize: 18 }, title: { color: colors.ink, fontWeight: '900', fontSize: 27, marginTop: 28 }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5, marginBottom: 16 }, label: { color: colors.ink, fontWeight: '800', fontSize: 12, marginTop: 14, marginBottom: 6 }, input: { height: 48, paddingHorizontal: 14, borderColor: colors.line, borderWidth: 1, backgroundColor: '#fff', color: colors.ink, borderRadius: 13 }, message: { color: '#a64430', fontSize: 11, lineHeight: 17, marginTop: 12 }, submit: { height: 48, borderRadius: 24, marginTop: 20, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.65 }, submitText: { color: '#fff', fontWeight: '800', fontSize: 13 }, toggle: { alignItems: 'center', paddingVertical: 16 }, toggleText: { color: colors.brown, fontWeight: '700', fontSize: 11 }, footnote: { color: colors.muted, fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 10 } });
