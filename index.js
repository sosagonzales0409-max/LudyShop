/**
 * @format
 */

// uuid lo necesita para generar IDs únicos (ver src/data/ids.js).
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
