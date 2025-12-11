/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import Main from './src/components/Main.js';
import Navigator from './src/components/router';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
      <Navigator />
  );
}

function AppContent() {

  return (
    <View style={styles.container}>
      <NewAppScreen
        templateFileName="App.tsx"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
