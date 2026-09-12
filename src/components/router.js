import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import Main from './Main';
import Inventory from './Inventory';
import LowStockView from './LowStockView';
import ProductDetailView from './ProductDetailView';
import CreditosView from './CreditosView';
import ClientDebtDetailView from './ClientDebtDetailView';
import { StoreProvider } from '../context/StoreContext';
import { colors, fontSize } from '../config/theme';

const Tab = createBottomTabNavigator();
const MainViews = createNativeStackNavigator();
const InventoryViews = createNativeStackNavigator();

function ConfigViewPlaceholder() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>⚙️ Configuración</Text>
      <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: 8 }}>Próximamente</Text>
    </View>
  );
}

function MainStack() {
  return (
    <MainViews.Navigator screenOptions={{ headerShown: false }}>
      <MainViews.Screen name="Main" component={Main} />
      <MainViews.Screen name="Creditos" component={CreditosView} />
      <MainViews.Screen name="ClientDebtDetail" component={ClientDebtDetailView} />
      <MainViews.Screen name="ConfigView" component={ConfigViewPlaceholder} />
    </MainViews.Navigator>
  );
}

function InventoryStack() {
  return (
    <InventoryViews.Navigator screenOptions={{ headerShown: false }}>
      <InventoryViews.Screen name="Inventory" component={Inventory} />
      <InventoryViews.Screen name="ProductDetail" component={ProductDetailView} />
      <InventoryViews.Screen name="LowStock" component={LowStockView} />
      <InventoryViews.Screen name="ConfigView" component={ConfigViewPlaceholder} />
    </InventoryViews.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      initialRouteName="MainTab"
      screenOptions={{
        tabBarStyle: { height: 70 },
        tabBarActiveBackgroundColor: '#CDFEF9',
      }}
    >
      <Tab.Screen
        name="MainTab"
        component={MainStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Ventas',
          tabBarLabelStyle: { fontSize: fontSize.label, color: 'black', fontWeight: 'bold', marginBottom: 10 },
        }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Inventario',
          tabBarLabelStyle: { fontSize: fontSize.label, color: 'black', fontWeight: 'bold', marginBottom: 10 },
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
