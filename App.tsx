import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigator from './src/components/router';
import Toast from './src/components/Toast';

/**
 * App.tsx — punto de entrada.
 *
 * Toast se monta UNA sola vez aquí, encima de todo el árbol de navegación,
 * para que sea visible desde cualquier pantalla o modal.
 * Se llama desde cualquier lugar con Toast.show('mensaje', 'success'|'error'|'info').
 *
 * SafeAreaProvider: el Encabezado azul de cada pantalla se extiende debajo de
 * la barra de estado del sistema con su alto real (useSafeAreaInsets), en vez
 * de la franja verde fija de 50 que había antes. StatusBar con íconos claros
 * porque el encabezado es azul.
 */
function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.root}>
        <Navigator />
        <Toast ref={ref => Toast.setRef(ref)} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
