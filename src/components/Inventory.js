import React, { Component } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  Dimensions,
  Text,
} from 'react-native';
const _window = Dimensions.get('window');

class Main extends Component {
  render() {
    const { onMenuPress, onProfilePress } = this.props;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#fff',
        }}
      >
        <View
          style={{
            width: _window.width / 1,
            height: '5%',
            backgroundColor: 'green',
          }}
        />
        <View
          style={{
            height: '8%',
            paddingHorizontal: 15,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 2 },
            backgroundColor: '#fff',
          }}
        >
          {/* Icono de menú */}
          <TouchableOpacity onPress={onMenuPress}>
            <Image
              source={require('../images/chevron-back-outline.png')}
              style={{ width: 28, height: 28 }}
            />
          </TouchableOpacity>

          {/* Espaciador */}

          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Inventario</Text>
          <View style={{ flex: 1 }} />

          {/* Icono de perfil */}
          <TouchableOpacity
            onPress={() => this.props.navigation.navigate('perfilView')}
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              width: _window.width / 8,
              height: _window.height / 12,
            }}
          >
            <Image
              source={require('../images/user-circle.png')}
              style={{
                width: _window.width / 14,
                height: _window.width / 14,
                tintColor: '#000',
              }}
            />
          </TouchableOpacity>
        </View>
        <View
          style={{
            marginTop: 15,
            width: '90%',
            height: _window.height / 3,
            marginHorizontal: 20,
            paddingHorizontal: 15,
            backgroundColor: '#fff',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 2 },
            borderRadius: 20,
            flexDirection: 'column',
          }}
        >
          <Text style={{ fontSize: 48, fontWeight: 'bold' }}> En Progreso</Text>
        </View>
      </View>
    );
  }
}

export default Main;
