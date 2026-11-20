import React, { useContext, useState } from 'react';
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
import BienvenidaView from './BienvenidaView';
import { StoreProvider, StoreContext } from '../context/StoreContext';
import { fontSize, colors } from '../config/theme';
import { IconShoppingCart, IconBoxes } from './Icon';

const Raiz = createNativeStackNavigator();
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
      <MainViews.Screen name="AgregarProducto" component={AgregarProductoView} />
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
      // El SafeAreaView de Navigator ya deja libre la barra de navegación de
      // Android. Desde que App.tsx tiene SafeAreaProvider, la barra de
      // pestañas también recibía ese margen inferior y lo sumaba OTRA vez
      // dentro de sus 70 de alto (íconos y etiquetas aplastados).
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        tabBarStyle: { height: TAB_BAR_HEIGHT },
        // Azul muy claro del mismo tono que primary (antes cian #CDFEF9, que
        // no combinaba). El tinte colorea ícono Y etiqueta, así que la
        // etiqueta activa se distingue de la inactiva por color.
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.placeholder,
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
            fontWeight: 'bold',
            marginBottom: 12,
          },
          tabBarStyle: tabVisibility(route, 'Inventory'),
        })}
      />
    </Tab.Navigator>
  );
}

// Pila raíz: la app (pestañas) y, encima, la bienvenida a pantalla completa.
// En el primer arranque se abre con las DOS rutas ya puestas (App debajo,
// Bienvenida arriba): así Saltar / Atrás / "Ir a vender" solo hacen goBack()
// y queda Ventas, sin pantalla en blanco. Desde Configuración se llega con
// navigate('Bienvenida') y al cerrar se vuelve a Configuración.
function Rutas() {
  const { mostrarBienvenida } = useContext(StoreContext);
  // Solo cuenta al montar: después NavigationContainer ignora initialState.
  const [estadoInicial] = useState(() => (mostrarBienvenida
    ? { index: 1, routes: [{ name: 'App' }, { name: 'Bienvenida' }] }
    : undefined));
  return (
    <NavigationContainer initialState={estadoInicial}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <Raiz.Navigator screenOptions={{ headerShown: false }}>
          <Raiz.Screen name="App" component={AppTabs} />
          <Raiz.Screen name="Bienvenida" component={BienvenidaView} options={{ animation: 'fade' }} />
        </Raiz.Navigator>
      </SafeAreaView>
    </NavigationContainer>
  );
}

export default function Navigator() {
  return (
    <StoreProvider>
      <Rutas />
    </StoreProvider>
  );
}
