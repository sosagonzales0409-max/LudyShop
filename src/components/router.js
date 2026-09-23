import React from 'react';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import Main from './Main';
import Inventory from './Inventory';
import LowStockView from './LowStockView';
import ProductDetailView from './ProductDetailView';
import CreditosView from './CreditosView';
import ClientDebtDetailView from './ClientDebtDetailView';
import HistorialView from './HistorialView';
import ConfigView from './ConfigView';
import TiendaView from './TiendaView';
import ReportesView from './ReportesView';
import ConsumoPropioView from './ConsumoPropioView';
import ActivityLogView from './ActivityLogView';
import AgregarProductoView from './AgregarProductoView';
import EditarProductoView from './EditarProductoView';
import RegistrarCompraView from './RegistrarCompraView';
import HistorialComprasView from './HistorialComprasView';
import { StoreProvider } from '../context/StoreContext';
import { fontSize, colors } from '../config/theme';
import { IconShoppingCart, IconBoxes } from './Icon';

const Tab = createBottomTabNavigator();
const MainViews = createNativeStackNavigator();
const InventoryViews = createNativeStackNavigator();

const TAB_BAR_HEIGHT = 70;

function MainStack() {
  return (
    <MainViews.Navigator screenOptions={{ headerShown: false }}>
      <MainViews.Screen name="Main" component={Main} />
      <MainViews.Screen name="Creditos" component={CreditosView} />
      <MainViews.Screen name="ClientDebtDetail" component={ClientDebtDetailView} />
      <MainViews.Screen name="Historial" component={HistorialView} />
      <MainViews.Screen name="Reportes" component={ReportesView} />
      <MainViews.Screen name="ConfigView" component={ConfigView} />
      <MainViews.Screen name="TiendaView" component={TiendaView} />
      <MainViews.Screen name="ConsumoPropioView" component={ConsumoPropioView} />
      <MainViews.Screen name="ActivityLogView" component={ActivityLogView} />
      <MainViews.Screen name="HistorialCompras" component={HistorialComprasView} />
      <MainViews.Screen name="RegistrarCompra" component={RegistrarCompraView} />
    </MainViews.Navigator>
  );
}

function InventoryStack() {
  return (
    <InventoryViews.Navigator screenOptions={{ headerShown: false }}>
      <InventoryViews.Screen name="Inventory" component={Inventory} />
      <InventoryViews.Screen name="ProductDetail" component={ProductDetailView} />
      <InventoryViews.Screen name="LowStock" component={LowStockView} />
      <InventoryViews.Screen name="ConfigView" component={ConfigView} />
      <InventoryViews.Screen name="TiendaView" component={TiendaView} />
      <InventoryViews.Screen name="Reportes" component={ReportesView} />
      <InventoryViews.Screen name="ConsumoPropioView" component={ConsumoPropioView} />
      <InventoryViews.Screen name="ActivityLogView" component={ActivityLogView} />
      <InventoryViews.Screen name="AgregarProducto" component={AgregarProductoView} />
      <InventoryViews.Screen name="EditarProducto" component={EditarProductoView} />
      <InventoryViews.Screen name="RegistrarCompra" component={RegistrarCompraView} />
      <InventoryViews.Screen name="HistorialCompras" component={HistorialComprasView} />
    </InventoryViews.Navigator>
  );
}

function tabVisibility(route, rootName) {
  const rutaActiva = getFocusedRouteNameFromRoute(route) ?? rootName;
  return rutaActiva === rootName
    ? { height: TAB_BAR_HEIGHT }
    : { display: 'none' };
}

function AppTabs() {
  return (
    <Tab.Navigator
      initialRouteName="MainTab"
      screenOptions={{
        tabBarStyle: { height: TAB_BAR_HEIGHT },
        tabBarActiveBackgroundColor: '#CDFEF9',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIconStyle: { marginBottom: -8 },
      }}
    >
      <Tab.Screen
        name="MainTab"
        component={MainStack}
        options={({ route }) => ({
          headerShown: false,
          tabBarLabel: 'Ventas',
          tabBarIcon: ({ color }) => <IconShoppingCart color={color} size={30} />,
          tabBarLabelStyle: {
            fontSize: fontSize.label,
            color: 'black',
            fontWeight: 'bold',
            marginBottom: 12,
          },
          tabBarStyle: tabVisibility(route, 'Main'),
        })}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryStack}
        options={({ route }) => ({
          headerShown: false,
          tabBarLabel: 'Inventario',
          tabBarIcon: ({ color }) => <IconBoxes color={color} size={30} />,
          tabBarLabelStyle: {
            fontSize: fontSize.label,
            color: 'black',
            fontWeight: 'bold',
            marginBottom: 12,
          },
          tabBarStyle: tabVisibility(route, 'Inventory'),
        })}
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
