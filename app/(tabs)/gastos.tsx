/** Lista de movimientos. Punto de entrada a HU-08, HU-09 y HU-10. */

import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colores, espacio, tipografia } from '../../src/ui/tema';
import { FilaGasto, Vacio } from '../../src/ui/componentes';
import { listarGastos, type Gasto } from '../../src/db/gastos';

const PAGINA = 40;

export default function Gastos() {
  const router = useRouter();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [hayMas, setHayMas] = useState(true);
  const [cargando, setCargando] = useState(false);

  const cargarPrimera = useCallback(async () => {
    const datos = await listarGastos(PAGINA, 0);
    setGastos(datos);
    setHayMas(datos.length === PAGINA);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarPrimera();
    }, [cargarPrimera])
  );

  /** Paginación: evita cargar cientos de filas de golpe al final del mes. */
  const cargarMas = async () => {
    if (!hayMas || cargando) return;
    setCargando(true);
    const siguientes = await listarGastos(PAGINA, gastos.length);
    setGastos((previos) => [...previos, ...siguientes]);
    setHayMas(siguientes.length === PAGINA);
    setCargando(false);
  };

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <Text style={e.titulo}>Movimientos</Text>
      <FlatList
        data={gastos}
        keyExtractor={(g) => String(g.id)}
        renderItem={({ item }) => (
          <FilaGasto
            gasto={item}
            alPresionar={() => router.push(`/gasto/${item.id}`)}
          />
        )}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <Vacio
            titulo="Todavía no hay movimientos"
            detalle="Cuando llegue una notificación de tu banco aparecerá acá. También puedes anotar un gasto en efectivo."
            accion={{
              texto: 'Anotar un gasto',
              alPresionar: () => router.push('/gasto/nuevo'),
            }}
          />
        }
        ListFooterComponent={<View style={{ height: espacio.xl }} />}
      />
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  titulo: {
    ...tipografia.titulo,
    color: colores.texto,
    paddingHorizontal: espacio.md,
    paddingVertical: espacio.md,
  },
});
