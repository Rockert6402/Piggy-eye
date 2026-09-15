/** Lista de movimientos. Punto de entrada a HU-08, HU-09 y HU-10. */

import React, { useCallback, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colores, espacio, tipografia } from '../../src/ui/tema';
import { Cabecera, FilaGasto, Vacio } from '../../src/ui/componentes';
import { listarGastos, type Gasto } from '../../src/db/gastos';

const PAGINA = 40;

interface Seccion {
  titulo: string;
  data: Gasto[];
}

function etiquetaFecha(fechaMs: number): string {
  const hoy = new Date();
  const fecha = new Date(fechaMs);
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  const inicioAyer = inicioHoy - 86_400_000;
  const inicioSemana = inicioHoy - ((hoy.getDay() + 6) % 7) * 86_400_000;
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime();
  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).getTime();

  const t = fecha.getTime();
  if (t >= inicioHoy) return 'Hoy';
  if (t >= inicioAyer) return 'Ayer';
  if (t >= inicioSemana) return 'Esta semana';
  if (t >= inicioMes) return 'Este mes';
  if (t >= inicioMesAnterior) return 'El mes pasado';
  return fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function agruparEnSecciones(gastos: Gasto[]): Seccion[] {
  const mapa = new Map<string, Gasto[]>();
  for (const g of gastos) {
    const clave = etiquetaFecha(g.fecha);
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave)!.push(g);
  }
  return Array.from(mapa.entries()).map(([titulo, data]) => ({ titulo, data }));
}

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

  const cargarMas = async () => {
    if (!hayMas || cargando) return;
    setCargando(true);
    const siguientes = await listarGastos(PAGINA, gastos.length);
    setGastos((previos) => [...previos, ...siguientes]);
    setHayMas(siguientes.length === PAGINA);
    setCargando(false);
  };

  const secciones = agruparEnSecciones(gastos);

  return (
    <SafeAreaView style={e.pantalla} edges={[]}>
      <Cabecera
        seccion="Movimientos"
        accion={{ icono: 'add-circle-outline', alPresionar: () => router.push('/gasto/nuevo') }}
      />
      <SectionList
        sections={secciones}
        keyExtractor={(g) => String(g.id)}
        renderItem={({ item }) => (
          <FilaGasto
            gasto={item}
            alPresionar={() => router.push(`/gasto/${item.id}`)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={e.encabezadoSeccion}>
            <Text style={e.tituloSeccion}>{section.titulo}</Text>
          </View>
        )}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <Vacio
            icono="receipt-outline"
            titulo="Todavía no hay movimientos"
            detalle="Cuando llegue una notificación de tu banco aparecerá acá. También puedes anotar un movimiento a mano."
            accion={{
              texto: 'Anotar un movimiento',
              alPresionar: () => router.push('/gasto/nuevo'),
            }}
          />
        }
        ListFooterComponent={<View style={{ height: espacio.xl }} />}
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  encabezadoSeccion: {
    paddingHorizontal: espacio.md,
    paddingTop: espacio.md,
    paddingBottom: 4,
    backgroundColor: colores.fondo,
  },
  tituloSeccion: {
    ...tipografia.etiqueta,
    color: colores.textoTenue,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
  },
});
