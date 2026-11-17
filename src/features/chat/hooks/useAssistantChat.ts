import { useState } from 'react';
import type { ChatMessage, ProductDraft } from '../types';

const welcome: ChatMessage = { id: 'welcome', author: 'assistant', text: '¡Hola! Soy María, tu guía en Sava. ¿Qué estás buscando hoy?' };

export function useAssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [draft, setDraft] = useState<ProductDraft | null>(null);

  function sendMessage(text: string) {
    const value = text.trim();
    if (!value) return;
    const timestamp = Date.now().toString();
    const parsedDraft = parseProductDraft(value);
    if (parsedDraft) setDraft(parsedDraft);
    setMessages((current) => [...current,
      { id: `${timestamp}-user`, author: 'user', text: value },
      { id: `${timestamp}-assistant`, author: 'assistant', text: parsedDraft ? 'Organicé una publicación como borrador. Revisa los datos y confirma antes de agregarla a tu inventario.' : '¡Claro! Puedo ayudarte a encontrar opciones locales en Yopal. Cuéntame un poco más y te recomiendo negocios de la zona.' },
    ]);
  }

  function confirmDraft() { setDraft(null); setMessages((current) => [...current, { id: `${Date.now()}-saved`, author: 'assistant', text: '¡Listo! La publicación quedó guardada en tu inventario local. Cuando tengas internet, estará lista para sincronizarse.' }]); }
  function resetChat() { setMessages([welcome]); setDraft(null); }
  return { messages, draft, sendMessage, confirmDraft, resetChat };
}

function parseProductDraft(message: string): ProductDraft | null {
  const match = message.match(/(?:voy a\s+)?(?:vender|publicar|ofrezco|vendo)\s+(\d+(?:[.,]\d+)?)\s+([\p{L}]+)\s+de\s+([\p{L}\s]+?)\s+a\s+(\d[\d.,]*)\s*(mil|mill[oó]n(?:es)?)?\s*(?:pesos)?/iu);
  if (!match) return null;
  const stock = Number(match[1].replace(',', '.'));
  const rawPrice = Number(match[4].replace(/[.,]/g, ''));
  const multiplier = match[5]?.toLowerCase().startsWith('mil') ? 1_000 : match[5] ? 1_000_000 : 1;
  const price = Math.round(rawPrice * multiplier);
  if (!Number.isFinite(stock) || stock <= 0 || !Number.isFinite(price) || price <= 0) return null;
  const rawName = match[3].trim().replace(/\s+$/, '');
  const name = rawName.charAt(0).toLocaleUpperCase('es-CO') + rawName.slice(1);
  const rawUnit = match[2].toLowerCase();
  const unit = rawUnit.startsWith('bulto') ? 'bulto' : rawUnit.startsWith('kilo') || rawUnit === 'kg' ? 'kg' : rawUnit.startsWith('libra') ? 'libra' : rawUnit.startsWith('servicio') ? 'servicio' : 'unidad';
  return { name, category: 'Abarrotes', description: 'Borrador preparado con María. Revisa la información antes de publicarlo.', price_cop: price, stock, unit };
}
