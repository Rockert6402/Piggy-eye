import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { abrirBD } from '../src/db/esquema';
import { colores } from '../src/ui/tema';
import {
  configurarAvisos,
  escucharToquesAvisos,
  pedirPermisoAvisos,
} from '../src/notificaciones/avisos';

// Antes de montar nada: sin el handler, los avisos con la app abierta no se ven.
configurarAvisos();

/**
 * HU-01: tocar el aviso abre el gasto registrado o la pestaña de
 * pendientes. Cubre los dos casos: app abierta (listener) y app cerrada
 * que arranca por el toque (última respuesta guardada).
 */
function useNavegarDesdeAvisos(habilitado: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!habilitado) return;
    return escucharToquesAvisos((ruta) => router.push(ruta as never));
  }, [habilitado, router]);
}

export default function Raiz() {
  const [listo, setListo] = useState(false);

  // La base de datos se abre y migra una sola vez, antes de pintar nada.
  useEffect(() => {
    abrirBD()
      .then(() => setListo(true))
      .catch(() => setListo(true));
  }, []);

  // Android 13+: sin este permiso no sale ningún aviso de HU-01.
  useEffect(() => {
    if (listo) void pedirPermisoAvisos();
  }, [listo]);

  useNavegarDesdeAvisos(listo);

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
