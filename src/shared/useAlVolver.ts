import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { escucharSenal } from '../features/chat/pendientes';

// llama a "alVolver" cuando vuelve el internet o cuando la app regresa del segundo plano.
// asi cada pantalla se recupera sola, sin que la persona tenga que recargar
export function useAlVolver(alVolver: () => void) {
  const funcion = useRef(alVolver);
  funcion.current = alVolver;

  useEffect(() => {
    let ultima = 0;
    // evita llamar dos veces seguidas (senal y app activa pasan casi al mismo tiempo)
    function avisar() {
      const ahora = Date.now();
      if (ahora - ultima < 3000) return;
      ultima = ahora;
      funcion.current();
    }
    let conSenal = true;
    const quitarSenal = escucharSenal((senal) => {
      if (senal && !conSenal) setTimeout(avisar, 1200);
      conSenal = senal;
    });
    let estado = AppState.currentState;
    const app = AppState.addEventListener('change', (nuevo) => {
      if (estado !== 'active' && nuevo === 'active') avisar();
      estado = nuevo;
    });
    return () => {
      quitarSenal();
      app.remove();
    };
  }, []);
}
