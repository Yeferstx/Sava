import { useState } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashAnimado from './src/features/splash/SplashAnimado';

export default function App() {
  // la animacion solo sale cuando la app abre desde cero, no al cambiar de pantalla
  const [verSplash, setVerSplash] = useState(true);
  return <SafeAreaProvider><AppNavigator />{verSplash && <SplashAnimado onTerminar={() => setVerSplash(false)} />}</SafeAreaProvider>;
}
