import { AccessibilityInfo } from 'react-native';

// pregunta si la persona pidio reducir el movimiento.
// si el sistema no responde en 400 ms se sigue con animacion,
// asi la pantalla nunca se queda en blanco esperando
export function pedirReducirMovimiento() {
  return new Promise<boolean>((resolver) => {
    let respondio = false;
    const espera = setTimeout(() => {
      if (!respondio) { respondio = true; resolver(false); }
    }, 400);
    AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (respondio) return;
      respondio = true;
      clearTimeout(espera);
      resolver(valor);
    }).catch(() => {
      if (respondio) return;
      respondio = true;
      clearTimeout(espera);
      resolver(false);
    });
  });
}
