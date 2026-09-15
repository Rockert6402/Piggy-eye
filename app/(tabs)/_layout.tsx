import React, { useCallback, useState } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { StyleSheet } from 'react-native';

import { colores, tipografia } from '../../src/ui/tema';
import { contarPendientes } from '../../src/db/pendientes';

export default function Pestanas() {
  const [pendientes, setPendientes] = useState(0);

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
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colores.acento,
        tabBarInactiveTintColor: colores.textoTenue,
        tabBarLabelStyle: tipografia.menudo,
        tabBarBadgeStyle: {
          backgroundColor: colores.atencion,
          color: colores.fondo,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Resumen' }} />
      <Tabs.Screen name="gastos" options={{ title: 'Movimientos' }} />
      <Tabs.Screen
        name="pendientes"
        options={{
          title: 'Por confirmar',
          tabBarBadge: pendientes > 0 ? pendientes : undefined,
        }}
      />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes' }} />
    </Tabs>
  );
}
