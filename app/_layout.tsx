import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { abrirBD } from '../src/db/esquema';
import { colores } from '../src/ui/tema';

export default function Raiz() {
  const [listo, setListo] = useState(false);

  // La base de datos se abre y migra una sola vez, antes de pintar nada.
  useEffect(() => {
    abrirBD()
      .then(() => setListo(true))
      .catch(() => setListo(true));
  }, []);

  if (!listo) {
    return (
      <View style={{ flex: 1, backgroundColor: colores.fondo, justifyContent: 'center' }}>
        <ActivityIndicator color={colores.acento} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colores.fondo },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="gasto/nuevo" options={{ presentation: 'modal' }} />
        <Stack.Screen name="gasto/[id]" />
      </Stack>
    </SafeAreaProvider>
  );
}
