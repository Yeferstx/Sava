import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Platform, View } from 'react-native';

// cuanto tapa el teclado a una pantalla. se mide la pantalla real contra la posicion del teclado,
// asi funciona igual en iphone y android, y aunque la barra de abajo se oculte al abrir el teclado.
// uso: <View ref={ref} onLayout={medir} style={{ flex: 1, paddingBottom: espacio }}>
export function useEspacioTeclado() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [espacio, setEspacio] = useState(0);
  const tecladoArriba = useRef<number | null>(null);

  function medir() {
    const borde = tecladoArriba.current;
    if (borde === null || !ref.current) { setEspacio(0); return; }
    ref.current.measureInWindow((_x, y, _ancho, alto) => {
      setEspacio(Math.max(0, Math.round(y + alto - borde)));
    });
  }

  useEffect(() => {
    const mostrar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (evento) => {
      tecladoArriba.current = evento.endCoordinates.screenY;
      medir();
    });
    const ocultar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      tecladoArriba.current = null;
      setEspacio(0);
    });
    return () => { mostrar.remove(); ocultar.remove(); };
  }, []);

  return { ref, espacio, medir };
}
