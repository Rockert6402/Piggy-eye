import React, { useCallback, useState } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colores, tipografia } from '../../src/ui/tema';
import { contarPendientes } from '../../src/db/pendientes';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function icono(nombre: IoniconsName, nombreActivo: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? nombreActivo : nombre} size={22} color={color} />
  );
}

export default function Pestanas() {
  const [pendientes, setPendientes] = useState(0);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      contarPendientes().then(setPendientes);
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colores.superficie,
          borderTopColor: colores.borde,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colores.acento,
        tabBarInactiveTintColor: colores.textoTenue,
        tabBarLabelStyle: { ...tipografia.menudo, marginTop: 2 },
        tabBarBadgeStyle: {
          backgroundColor: colores.atencion,
          color: colores.fondo,
          fontSize: 10,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Resumen',
          tabBarIcon: icono('pie-chart-outline', 'pie-chart'),
        }}
      />
      <Tabs.Screen
        name="gastos"
        options={{
          title: 'Movimientos',
          tabBarIcon: icono('list-outline', 'list'),
        }}
      />
      <Tabs.Screen
        name="pendientes"
        options={{
          title: 'Por confirmar',
          tabBarBadge: pendientes > 0 ? pendientes : undefined,
          tabBarIcon: icono('alert-circle-outline', 'alert-circle'),
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: icono('settings-outline', 'settings'),
        }}
      />
    </Tabs>
  );
}
