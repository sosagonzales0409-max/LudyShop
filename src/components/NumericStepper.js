import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function NumericStepper({
  value,
  onChange,
  min = 0,
  max = 9999,
}) {
  function decrease() {
    if (value > min) onChange(value - 1);
  }

  function increase() {
    if (value < max) onChange(value + 1);
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f2f2f2',
        borderRadius: 10,
        height: 45,
      }}
    >
      {/* Botón - */}
      <TouchableOpacity
        onPress={decrease}
        style={{
          paddingHorizontal: 15,
          paddingVertical: 5,
        }}
      >
        <Text style={{ fontSize: 25, fontWeight: 'bold' }}>−</Text>
      </TouchableOpacity>

      {/* Número */}
      <Text
        style={{
          fontSize: 20,
          fontWeight: 'bold',
          width: 40,
          textAlign: 'center',
        }}
      >
        {value}
      </Text>

      {/* Botón + */}
      <TouchableOpacity
        onPress={increase}
        style={{
          paddingHorizontal: 15,
          paddingVertical: 5,
        }}
      >
        <Text style={{ fontSize: 25, fontWeight: 'bold' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
