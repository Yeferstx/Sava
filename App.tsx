import { useState } from 'react';
import { Asset } from 'expo-asset';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashAnimado from './src/features/splash/SplashAnimado';

// se cargan de una vez las imagenes que salen apenas abre la app (menu, acceso y aru),
// asi no aparecen tarde mientras se usa la app
void Asset.loadAsync([
  require('./assets/marca/paisaje-barra.jpg'),
  require('./assets/marca/llanos-acceso.jpg'),
  require('./assets/asistente/asistente.png'),
]).catch(() => undefined);

export default function App() {
  // la animacion solo sale cuando la app abre desde cero, no al cambiar de pantalla
  const [verSplash, setVerSplash] = useState(true);
  return (
    <SafeAreaProvider>
      <AppNavigator />
      {verSplash && <SplashAnimado onTerminar={() => setVerSplash(false)} />}
    </SafeAreaProvider>
  );
}
