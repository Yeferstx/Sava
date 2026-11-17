import { useState } from 'react';
import type { ChatMessage, ProductDraft } from '../types';
import { categoriaDeProducto } from '../../../shared/agro';

const welcome: ChatMessage = { id: 'welcome', author: 'assistant', text: '¡Hola! Soy María. Por ahora te ayudo a preparar publicaciones. Escríbeme, por ejemplo: «vendo 200 kilos de piña a 2.500 pesos».' };

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
      { id: `${timestamp}-assistant`, author: 'assistant', text: parsedDraft ? 'Organicé una publicación como borrador. Revisa los datos y confirma antes de agregarla a tu inventario.' : 'No entendí esa instrucción. Todavía solo sé preparar publicaciones: escribe el producto, la cantidad y el precio, por ejemplo «vendo 20 bultos de yuca a 80.000».' },
    ]);
  }

  function confirmDraft() { setDraft(null); setMessages((current) => [...current, { id: `${Date.now()}-saved`, author: 'assistant', text: '¡Listo! La publicación quedó guardada en tu inventario local. Cuando tengas internet, estará lista para sincronizarse.' }]); }
  function resetChat() { setMessages([welcome]); setDraft(null); }
  return { messages, draft, sendMessage, confirmDraft, resetChat };
}

function parseProductDraft(message: string): ProductDraft | null {
  const match = message.match(/(?:voy a\s+)?(?:vender|publicar|ofrezco|vendo|tengo)\s+(\d+(?:[.,]\d+)?)\s+([\p{L}]+)\s+de\s+([\p{L}\s]+?)\s+a\s+(\d[\d.,]*)\s*(mill[oó]n(?:es)?|mil)?\s*(?:pesos)?/iu);
  if (!match) return null;
  const stock = Number(match[1].replace(',', '.'));
  // ojo: "millones" tambien empieza por "mil"
  const multiplier = match[5]?.toLowerCase() === 'mil' ? 1_000 : match[5] ? 1_000_000 : 1;
  // "80,5 mil" es 80.500, pero "80.000" son ochenta mil
  let rawPrice = Number(match[4].replace(/[.,]/g, ''));
  if (multiplier > 1 && /^\d+[.,]\d{1,2}$/.test(match[4])) rawPrice = Number(match[4].replace(',', '.'));
  const price = Math.round(rawPrice * multiplier);
  if (!Number.isFinite(stock) || stock <= 0 || !Number.isFinite(price) || price <= 0) return null;
  const rawName = match[3].trim().replace(/\s+$/, '');
  const name = rawName.charAt(0).toLocaleUpperCase('es-CO') + rawName.slice(1);
  const rawUnit = match[2].toLowerCase();
  const unit = rawUnit.startsWith('bulto') ? 'bulto' : rawUnit.startsWith('kilo') || rawUnit === 'kg' ? 'kg' : rawUnit.startsWith('libra') ? 'libra' : rawUnit.startsWith('servicio') ? 'servicio' : rawUnit.startsWith('caja') ? 'caja' : rawUnit.startsWith('racimo') ? 'racimo' : 'unidad';
  return { name, category: categoriaDeProducto(name), description: '', price_cop: price, stock, unit };
}
