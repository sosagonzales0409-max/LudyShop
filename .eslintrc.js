module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // TEMPORAL: ~690 estilos en línea repartidos en las pantallas. Se pasarán a
    // StyleSheet.create pantalla por pantalla (con revisión visual) al
    // reorganizar src/components; al terminar, quitar esta línea.
    'react-native/no-inline-styles': 'off',
  },
};
