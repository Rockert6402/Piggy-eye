/** Lista de movimientos con filtros y agrupación por fecha. */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colores, espacio, tipografia } from '../../src/ui/tema';
import { Cabecera, FilaGasto, Vacio } from '../../src/ui/componentes';
import { listarGastos, CATEGORIAS, CATEGORIAS_INGRESO, type Gasto } from '../../src/db/gastos';

const PAGINA = 40;

type FiltroTipo = 'todos' | 'gasto' | 'ingreso';

interface Seccion { titulo: string; data: Gasto[] }

function etiquetaFecha(fechaMs: number): string {
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  const inicioAyer = inicioHoy - 86_400_000;
  const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
  const inicioSemana = inicioHoy - diaSemana * 86_400_000;
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime();
  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).getTime();

  const t = fechaMs;
  if (t >= inicioHoy) return 'Hoy';
  if (t >= inicioAyer) return 'Ayer';
  if (t >= inicioSemana) return 'Esta semana';
  if (t >= inicioMes) return 'Este mes';
  if (t >= inicioMesAnterior) return 'El mes pasado';
  return new Date(fechaMs).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function agrupar(gastos: Gasto[]): Seccion[] {
  const mapa = new Map<string, Gasto[]>();
  for (const g of gastos) {
    const clave = etiquetaFecha(g.fecha);
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave)!.push(g);
  }
  return Array.from(mapa.entries()).map(([titulo, data]) => ({ titulo, data }));
}

const TODAS_CATS = ['Todas', ...CATEGORIAS, ...CATEGORIAS_INGRESO.filter(
  (c) => !CATEGORIAS.includes(c as any)
)];

export default function Gastos() {
  const router = useRouter();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [hayMas, setHayMas] = useState(true);
  const [cargando, setCargando] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroCat, setFiltroCat] = useState('Todas');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const cargarPrimera = useCallback(async () => {
    const datos = await listarGastos(PAGINA, 0);
    setGastos(datos);
    setHayMas(datos.length === PAGINA);
  }, []);

  useFocusEffect(useCallback(() => { cargarPrimera(); }, [cargarPrimera]));

  const cargarMas = async () => {
    if (!hayMas || cargando) return;
    setCargando(true);
    const siguientes = await listarGastos(PAGINA, gastos.length);
    setGastos((prev) => [...prev, ...siguientes]);
    setHayMas(siguientes.length === PAGINA);
    setCargando(false);
  };

  const filtrados = useMemo(() => {
    return gastos.filter((g) => {
      if (filtroTipo !== 'todos' && g.tipo !== filtroTipo) return false;
      if (filtroCat !== 'Todas' && g.categoria !== filtroCat) return false;
      return true;
    });
  }, [gastos, filtroTipo, filtroCat]);

  const secciones = useMemo(() => agrupar(filtrados), [filtrados]);
  const hayFiltros = filtroTipo !== 'todos' || filtroCat !== 'Todas';

  return (
    <SafeAreaView style={e.pantalla} edges={[]}>
      <Cabecera
        seccion="Movimientos"
        accion={{
          icono: hayFiltros ? 'funnel' : 'funnel-outline',
          alPresionar: () => setMostrarFiltros((v) => !v),
        }}
      />

      {mostrarFiltros && (
        <View style={e.panelFiltros}>
          {/* Tipo */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.chipsFila}>
            {(['todos', 'gasto', 'ingreso'] as FiltroTipo[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setFiltroTipo(t)}
                style={[e.chip, filtroTipo === t && e.chipActivo]}
              >
                <Text style={[e.chipTexto, filtroTipo === t && e.chipTextoActivo]}>
                  {t === 'todos' ? 'Todos' : t === 'gasto' ? 'Gastos' : 'Ingresos'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Categoría */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.chipsFila}>
            {TODAS_CATS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setFiltroCat(c)}
                style={[e.chip, filtroCat === c && e.chipActivo]}
              >
                <Text style={[e.chipTexto, filtroCat === c && e.chipTextoActivo]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {hayFiltros && (
            <Pressable onPress={() => { setFiltroTipo('todos'); setFiltroCat('Todas'); }} style={e.limpiarBtn}>
              <Text style={e.limpiarTexto}>Limpiar filtros</Text>
            </Pressable>
          )}
        </View>
      )}

      <SectionList
        sections={secciones}
        keyExtractor={(g) => String(g.id)}
        renderItem={({ item }) => (
          <FilaGasto gasto={item} alPresionar={() => router.push(`/gasto/${item.id}`)} />
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
            titulo={hayFiltros ? 'Sin resultados' : 'Todavía no hay movimientos'}
            detalle={
              hayFiltros
                ? 'No hay movimientos con los filtros seleccionados.'
                : 'Cuando llegue una notificación de tu banco aparecerá acá. También puedes anotar un movimiento a mano.'
            }
            accion={
              hayFiltros
                ? { texto: 'Limpiar filtros', alPresionar: () => { setFiltroTipo('todos'); setFiltroCat('Todas'); } }
                : { texto: 'Anotar un movimiento', alPresionar: () => router.push('/gasto/nuevo') }
            }
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

  panelFiltros: {
    backgroundColor: colores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
    paddingVertical: espacio.sm,
    gap: espacio.xs,
  },
  chipsFila: { paddingHorizontal: espacio.md, gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colores.superficieAlta,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  chipActivo: { backgroundColor: colores.acento, borderColor: colores.acento },
  chipTexto: { ...tipografia.menudo, color: colores.textoSuave },
  chipTextoActivo: { color: colores.fondo, fontWeight: '600' },
  limpiarBtn: { paddingHorizontal: espacio.md, paddingTop: 4 },
  limpiarTexto: { ...tipografia.menudo, color: colores.acento },

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
