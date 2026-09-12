import React from 'react';
import { Image, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import Main from './Main';
import Inventory from './Inventory';
import LowStockView from './LowStockView';
import { StoreProvider } from '../context/StoreContext';

const Tab = createBottomTabNavigator();
const MainViews = createNativeStackNavigator();
const InventoryViews = createNativeStackNavigator();

function MainStack() {
  return (
    <MainViews.Navigator screenOptions={{ headerShown: false }}>
      <MainViews.Screen name="Main" component={Main} />
    </MainViews.Navigator>
  );
}

function InventoryStack() {
  return (
    <InventoryViews.Navigator screenOptions={{ headerShown: false }}>
      <InventoryViews.Screen name="Inventory" component={Inventory} />
      <InventoryViews.Screen name="LowStock" component={LowStockView} />
    </InventoryViews.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      initialRouteName="MainTab"
      screenOptions={{
        tabBarStyle: {
          height: 70,
          display: 'flex',
        },
        tabBarActiveBackgroundColor: '#CDFEF9',
      }}
    >
      <Tab.Screen
        name="MainTab"
        component={MainStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Ventas',
          tabBarLabelStyle: {
            fontSize: 16,
            color: 'black',
            fontWeight: 'bold',
            marginBottom: 10,
          },
        }}
      />

      <Tab.Screen
        name="InventoryTab"
        component={InventoryStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Inventario',
          tabBarLabelStyle: {
            fontSize: 16,
            color: 'black',
            fontWeight: 'bold',
            marginBottom: 10,
          },
        }}
      />
    </Tab.Navigator>
  );
}

export default function Navigator() {
  return (
    <StoreProvider>
      <NavigationContainer>
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
          <AppTabs />
        </SafeAreaView>
      </NavigationContainer>
    </StoreProvider>
  );
}
