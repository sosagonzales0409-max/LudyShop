import React from 'react';
import { StyleSheet, View } from 'react-native';
import Navigator from './src/components/router';
import Toast from './src/components/Toast';

/**
 * App.tsx — punto de entrada.
 *
 * Toast se monta UNA sola vez aquí, encima de todo el árbol de navegación,
 * para que sea visible desde cualquier pantalla o modal.
 * Se llama desde cualquier lugar con Toast.show('mensaje', 'success'|'error'|'info').
 */
function App() {
  return (
    <View style={styles.root}>
      <Navigator />
      <Toast ref={ref => Toast.setRef(ref)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
