import React, { useContext, useState } from 'react';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import NewSaleScreen from '../screens/NewSaleScreen';
import InventoryScreen from '../screens/InventoryScreen';
import LowStockScreen from '../screens/LowStockScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CreditsScreen from '../screens/CreditsScreen';
import CustomerDebtScreen from '../screens/CustomerDebtScreen';
import SalesHistoryScreen from '../screens/SalesHistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import StoreSettingsScreen from '../screens/StoreSettingsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import OwnConsumptionScreen from '../screens/OwnConsumptionScreen';
import ActivityLogScreen from '../screens/ActivityLogScreen';
import AddProductScreen from '../screens/AddProductScreen';
import EditProductScreen from '../screens/EditProductScreen';
import NewPurchaseScreen from '../screens/NewPurchaseScreen';
import PurchaseHistoryScreen from '../screens/PurchaseHistoryScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import { StoreProvider, StoreContext } from '../context/StoreContext';
import { fontSize, colors } from '../config/theme';
import { IconShoppingCart, IconBoxes } from '../ui/Icon';

const Raiz = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MainViews = createNativeStackNavigator();
const InventoryViews = createNativeStackNavigator();

const TAB_BAR_HEIGHT = 70;

function MainStack() {
  return (
    <MainViews.Navigator screenOptions={{ headerShown: false }}>
      <MainViews.Screen name="Main" component={NewSaleScreen} />
      <MainViews.Screen name="Creditos" component={CreditsScreen} />
      <MainViews.Screen name="ClientDebtDetail" component={CustomerDebtScreen} />
      <MainViews.Screen name="Historial" component={SalesHistoryScreen} />
      <MainViews.Screen name="Reportes" component={ReportsScreen} />
      <MainViews.Screen name="ConfigView" component={SettingsScreen} />
      <MainViews.Screen name="TiendaView" component={StoreSettingsScreen} />
      <MainViews.Screen name="ConsumoPropioView" component={OwnConsumptionScreen} />
      <MainViews.Screen name="ActivityLogView" component={ActivityLogScreen} />
      <MainViews.Screen name="HistorialCompras" component={PurchaseHistoryScreen} />
      <MainViews.Screen name="RegistrarCompra" component={NewPurchaseScreen} />
      <MainViews.Screen name="AgregarProducto" component={AddProductScreen} />
    </MainViews.Navigator>
  );
}

function InventoryStack() {
  return (
    <InventoryViews.Navigator screenOptions={{ headerShown: false }}>
      <InventoryViews.Screen name="Inventory" component={InventoryScreen} />
      <InventoryViews.Screen name="ProductDetail" component={ProductDetailScreen} />
      <InventoryViews.Screen name="LowStock" component={LowStockScreen} />
      <InventoryViews.Screen name="ConfigView" component={SettingsScreen} />
      <InventoryViews.Screen name="TiendaView" component={StoreSettingsScreen} />
      <InventoryViews.Screen name="Reportes" component={ReportsScreen} />
      <InventoryViews.Screen name="ConsumoPropioView" component={OwnConsumptionScreen} />
      <InventoryViews.Screen name="ActivityLogView" component={ActivityLogScreen} />
      <InventoryViews.Screen name="AgregarProducto" component={AddProductScreen} />
      <InventoryViews.Screen name="EditarProducto" component={EditProductScreen} />
      <InventoryViews.Screen name="RegistrarCompra" component={NewPurchaseScreen} />
      <InventoryViews.Screen name="HistorialCompras" component={PurchaseHistoryScreen} />
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
          <Raiz.Screen name="Bienvenida" component={WelcomeScreen} options={{ animation: 'fade' }} />
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
