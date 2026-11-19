import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CREMA, LOGO_ALTO, LOGO_ANCHO, piezas } from './logoSava';
import { pedirReducirMovimiento } from '../../shared/movimiento';

const PathAnimado = Animated.createAnimatedComponent(Path);

// duracion total de la animacion en milisegundos
const DURACION = 2650;

// tiempos de cada parte (en ms dentro de los 2650)
// 1. trazo del simbolo   0 - 1100
// 2. relleno del simbolo 800 - 1500
// 3. letras "sava"       1300 - 2050 (una detras de otra)
// 4. pausa               2050 - 2300
// 5. salida              2300 - 2650
const suave = Easing.inOut(Easing.cubic);

function tramo(valor: Animated.Value, inicio: number, fin: number, desde: number, hasta: number) {
  return valor.interpolate({
    inputRange: [inicio / DURACION, fin / DURACION],
    outputRange: [desde, hasta],
    easing: suave,
    extrapolate: 'clamp',
  });
}

type Props = { onTerminar: () => void };

export default function SplashAnimado({ onTerminar }: Props) {
  const tiempo = useRef(new Animated.Value(0)).current;
  const pantalla = useWindowDimensions();

  // el logo ocupa mas o menos la mitad del ancho, sin pasarse en tablets
  let ancho = pantalla.width * 0.56;
  if (ancho > 300) ancho = 300;
  const alto = ancho * (LOGO_ALTO / LOGO_ANCHO);

  useEffect(() => {
    let cancelado = false;
    pedirReducirMovimiento().then((reducir) => {
      if (cancelado) return;
      if (reducir) {
        // si la persona pidio menos movimiento se muestra el logo listo y solo se desvanece
        tiempo.setValue(2050 / DURACION);
      }
      Animated.timing(tiempo, {
        toValue: 1,
        duration: reducir ? 600 : DURACION,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        if (cancelado === false) onTerminar();
      });
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const opacidadPantalla = tramo(tiempo, 2300, 2650, 1, 0);
  const escalaPantalla = tramo(tiempo, 2300, 2650, 1, 1.04);

  return (
    <Animated.View pointerEvents="none" style={[styles.fondo, { opacity: opacidadPantalla }]}>
      <Animated.View style={{ transform: [{ scale: escalaPantalla }] }}>
        <View accessible accessibilityRole="image" accessibilityLabel="Sava">
          <Svg width={ancho} height={alto} viewBox={`0 0 ${LOGO_ANCHO} ${LOGO_ALTO}`}>
            {piezas.map((pieza, i) => {
              // las dos primeras piezas son el simbolo: se dibujan con linea y luego se rellenan
              if (i < 2) {
                const retraso = i * 200;
                const largo = pieza.largo * 1.03;
                return (
                  <PathAnimado
                    key={pieza.id}
                    d={pieza.d}
                    fill={pieza.color}
                    fillRule="evenodd"
                    stroke={pieza.color}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={[largo, largo]}
                    strokeDashoffset={tramo(tiempo, retraso, 900 + retraso, largo, 0)}
                    fillOpacity={tramo(tiempo, 800 + retraso, 1300 + retraso, 0, 1)}
                    strokeOpacity={tramo(tiempo, 1000 + retraso, 1400 + retraso, 1, 0)}
                  />
                );
              }
              // las letras aparecen una detras de otra de izquierda a derecha
              const inicio = 1300 + (i - 2) * 100;
              return (
                <PathAnimado
                  key={pieza.id}
                  d={pieza.d}
                  fill={pieza.color}
                  fillRule="evenodd"
                  fillOpacity={tramo(tiempo, inicio, inicio + 350, 0, 1)}
                />
              );
            })}
          </Svg>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CREMA,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
});
