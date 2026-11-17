import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, CalendarDays, ChevronRight, CircleUserRound, Lightbulb, MessageCircle, MoreHorizontal, Search, Send, Sparkles, Utensils } from 'lucide-react-native';
import type { ChatMessage, ProductDraft } from './types';
import { colors } from '../../shared/theme';

type Props = { messages: ChatMessage[]; draft: ProductDraft | null; onSend: (text: string) => void; onReset: () => void; onBack: () => void; onConfirmDraft: () => void; onEditDraft: () => void };
const suggestions = [
  { Icon: Search, label: 'Buscar un negocio\no producto' },
  { Icon: Utensils, label: 'Recomiéndame\nrestaurantes' },
  { Icon: CalendarDays, label: 'Agendar un servicio' },
  { Icon: Lightbulb, label: 'Dame ideas de\nemprendimiento' },
];

export default function ChatScreen({ messages, draft, onSend, onReset, onBack, onConfirmDraft, onEditDraft }: Props) {
  const [messageDraft, setMessageDraft] = useState('');
  function submit(text = messageDraft) { if (!text.trim()) return; onSend(text); setMessageDraft(''); }
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Volver al inicio" onPress={onBack} style={styles.back}><ArrowLeft size={22} color="#fff" /></Pressable>
        <View style={styles.title}><View style={styles.nameRow}><Text style={styles.name}>María</Text><Sparkles size={15} color="#ffcf52" /></View><Text style={styles.subtitle}>Asistente de Sava · Yopal</Text></View>
        <Pressable accessibilityLabel="Reiniciar conversación" onPress={onReset}><MoreHorizontal size={23} color="#fff" /></Pressable>
      </View>
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}><View style={styles.maria}><CircleUserRound size={94} color="#fff4e9" strokeWidth={1.35} /></View><View style={styles.speech}><Text style={styles.speechTitle}>¡Hablemos!</Text><Text style={styles.speechText}>¿Cómo te puedo ayudar hoy?</Text></View></View>
          <View style={styles.suggestions}>{suggestions.map(({ Icon, label }) => <Pressable key={label} onPress={() => submit(label.replace('\n', ' '))} style={styles.suggestion}><View style={styles.suggestionIcon}><Icon size={19} color={colors.brown} /></View><Text style={styles.suggestionText}>{label}</Text><ChevronRight size={19} color="#795b40" /></Pressable>)}</View>
          <View style={styles.messages}>{messages.map((message) => <View key={message.id} style={[styles.bubble, message.author === 'user' ? styles.userBubble : styles.assistantBubble]}><Text style={[styles.bubbleText, message.author === 'user' && styles.userText]}>{message.text}</Text></View>)}</View>
          {draft && <View style={styles.draft}><Text style={styles.draftEyebrow}>BORRADOR DE PUBLICACIÓN</Text><Text style={styles.draftName}>{draft.name}</Text><Text style={styles.draftDetails}>${draft.price_cop.toLocaleString('es-CO')} por {draft.unit} · {draft.stock} disponibles</Text><Text style={styles.draftHint}>María propone estos datos. Confírmalos o edítalos antes de guardar.</Text><View style={styles.draftButtons}><Pressable onPress={onEditDraft} style={styles.editDraft}><Text style={styles.editDraftText}>Editar</Text></Pressable><Pressable onPress={onConfirmDraft} style={styles.confirmDraft}><Text style={styles.confirmDraftText}>Confirmar y guardar</Text></Pressable></View></View>}
        </ScrollView>
        <View style={styles.composer}><Sparkles size={21} color="#d99b25" /><TextInput accessibilityLabel="Mensaje para María" value={messageDraft} onChangeText={setMessageDraft} placeholder="Escribe tu mensaje a María..." placeholderTextColor="#958a7d" style={styles.input} onSubmitEditing={() => submit()} returnKeyType="send" /><Pressable accessibilityLabel="Enviar mensaje" onPress={() => submit()} style={styles.send}><Send size={18} color="#fff" /></Pressable></View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, header: { height: 108, paddingTop: 48, paddingHorizontal: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#995b3e' }, back: { width: 35 }, title: { alignItems: 'center' }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, name: { color: '#fff', fontWeight: '800', fontSize: 17 }, subtitle: { color: '#f1ded1', fontSize: 10, marginTop: 2 },
  body: { flex: 1, backgroundColor: '#f8f0e8' }, content: { paddingHorizontal: 19, paddingTop: 17, paddingBottom: 15 }, intro: { height: 170, backgroundColor: '#bb8057', borderRadius: 23, marginBottom: 19, overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: 12 }, maria: { width: 130, height: 142, alignItems: 'center', justifyContent: 'center', backgroundColor: '#a86745', borderTopLeftRadius: 70, borderTopRightRadius: 70 }, speech: { backgroundColor: '#fff8ef', width: 131, borderRadius: 21, padding: 12, marginBottom: 20 }, speechTitle: { color: colors.ink, textAlign: 'center', fontWeight: '900', fontSize: 15 }, speechText: { color: colors.ink, textAlign: 'center', fontSize: 12, lineHeight: 17, marginTop: 3 },
  suggestions: { gap: 9 }, suggestion: { minHeight: 59, backgroundColor: '#fffaf5', borderRadius: 17, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', elevation: 1 }, suggestionIcon: { backgroundColor: '#f8ebd7', width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, suggestionText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700', lineHeight: 17 }, messages: { marginTop: 14, gap: 7 }, bubble: { maxWidth: '86%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 }, assistantBubble: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 5 }, userBubble: { backgroundColor: colors.brown, alignSelf: 'flex-end', borderBottomRightRadius: 5 }, bubbleText: { color: colors.ink, fontSize: 13, lineHeight: 18 }, userText: { color: '#fff' },
  draft: { backgroundColor: '#fff', borderRadius: 17, borderColor: '#ead8c4', borderWidth: 1, padding: 13, marginTop: 12 }, draftEyebrow: { color: '#9a714c', fontWeight: '900', letterSpacing: 0.8, fontSize: 8 }, draftName: { color: colors.ink, fontWeight: '900', fontSize: 15, marginTop: 5 }, draftDetails: { color: colors.brown, fontWeight: '800', fontSize: 12, marginTop: 3 }, draftHint: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 7 }, draftButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 11 }, editDraft: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#f4ebe1' }, editDraftText: { color: colors.brown, fontSize: 10, fontWeight: '800' }, confirmDraft: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.brown }, confirmDraftText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 25 : 10, gap: 8 }, input: { flex: 1, backgroundColor: '#fff', borderRadius: 24, height: 44, paddingHorizontal: 15, color: colors.ink, fontSize: 12, borderWidth: 1, borderColor: '#eee5dc' }, send: { width: 39, height: 39, borderRadius: 21, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center' },
});
