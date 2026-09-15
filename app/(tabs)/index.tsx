/**
 * HU-05: dashboard con resumen por día, semana y mes.
 * También es donde aparece la alerta de permiso revocado (HU-07).
 */

import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colores, espacio, radio, tipografia } from '../../src/ui/tema';
import { Cabecera, Tarjeta, Boton } from '../../src/ui/componentes';
import { formatearCOP } from '../../src/parser/monto';
import {
  resumenDashboard,
  totalesPorCategoria,
  serieDiaria,
  type CorteTemporal,
  type GastoPorCategoria,
  type PuntoDiario,
} from '../../src/db/gastos';
import { contarPendientes } from '../../src/db/pendientes';
import { usePermisoNotificaciones } from '../../src/notificaciones/permisos';

export default function Dashboard() {
  const router = useRouter();
  const permiso = usePermisoNotificaciones();

  const [corte, setCorte] = useState<CorteTemporal | null>(null);
  const [categorias, setCategorias] = useState<GastoPorCategoria[]>([]);
  const [serie, setSerie] = useState<PuntoDiario[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [r, c, s, p] = await Promise.all([
      resumenDashboard(),
      totalesPorCategoria(inicioMes.getTime(), Date.now() + 1),
      serieDiaria(14),
      contarPendientes(),
    ]);
    setCorte(r);
    setCategorias(c);
    setSerie(s);
    setPendientes(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const maximo = Math.max(...serie.map((p) => p.total), 1);

  return (
    <SafeAreaView style={e.pantalla} edges={[]}>
      <Cabecera
        seccion="Resumen"
        accion={{ icono: 'add-circle-outline', alPresionar: () => router.push('/gasto/nuevo') }}
      />
      <ScrollView
        contentContainerStyle={e.contenido}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            tintColor={colores.textoSuave}
          />
        }
      >
        {!permiso.cargando && !permiso.activo && (
          <Pressable onPress={permiso.solicitar}>
            <Tarjeta style={e.alerta}>
              <Text style={e.alertaTitulo}>La captura automática está apagada</Text>
              <Text style={e.alertaTexto}>
                Piggy Eye necesita acceso a las notificaciones para registrar tus
                compras. Mientras esté apagado, solo verás los gastos que anotes
                a mano. Toca aquí para activarlo.
              </Text>
            </Tarjeta>
          </Pressable>
        )}

        {pendientes > 0 && (
          <Pressable onPress={() => router.push('/(tabs)/pendientes')}>
            <Tarjeta style={e.aviso}>
              <Text style={e.avisoTexto}>
                {pendientes === 1
                  ? '1 notificación quedó sin interpretar'
                  : `${pendientes} notificaciones quedaron sin interpretar`}
              </Text>
              <Text style={e.avisoAccion}>Revisar</Text>
            </Tarjeta>
          </Pressable>
        )}

        <View style={e.encabezado}>
          <Text style={e.etiquetaPrincipal}>Gastado este mes</Text>
          <Text style={e.cifraPrincipal}>
            {formatearCOP(corte?.mes.total ?? 0)}
          </Text>
          <Text style={e.subCifra}>
            {corte?.mes.cantidad ?? 0}{' '}
            {corte?.mes.cantidad === 1 ? 'movimiento' : 'movimientos'}
          </Text>
        </View>

        <View style={e.duo}>
          <Tarjeta style={e.mitad}>
            <Text style={e.etiqueta}>Hoy</Text>
            <Text style={e.cifraMedia}>{formatearCOP(corte?.hoy.total ?? 0)}</Text>
          </Tarjeta>
          <Tarjeta style={e.mitad}>
            <Text style={e.etiqueta}>Esta semana</Text>
            <Text style={e.cifraMedia}>
              {formatearCOP(corte?.semana.total ?? 0)}
            </Text>
          </Tarjeta>
        </View>

        {serie.length > 0 && (
          <Tarjeta>
            <Text style={e.etiqueta}>Últimos 14 días</Text>
            <View style={e.grafica}>
              {serie.map((punto) => (
                <View key={punto.dia} style={e.columna}>
                  <View
                    style={[
                      e.barra,
                      { height: Math.max(3, (punto.total / maximo) * 90) },
                    ]}
                  />
                </View>
              ))}
            </View>
          </Tarjeta>
        )}

        {categorias.length > 0 && (
          <Tarjeta>
            <Text style={e.etiqueta}>Por categoría este mes</Text>
            <View style={e.listaCategorias}>
              {categorias.map((c) => (
                <View key={c.categoria} style={e.filaCategoria}>
                  <Text style={e.nombreCategoria} numberOfLines={1}>
                    {c.categoria}
                  </Text>
                  <View style={e.barraFondo}>
                    <View
                      style={[
                        e.barraRelleno,
                        {
                          width: `${Math.max(
                            2,
                            (c.total / (categorias[0]?.total || 1)) * 100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={e.montoCategoria}>{formatearCOP(c.total)}</Text>
                </View>
              ))}
            </View>
          </Tarjeta>
        )}

        <Boton
          texto="Anotar un gasto en efectivo"
          alPresionar={() => router.push('/gasto/nuevo')}
          variante="secundario"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.md, gap: espacio.md, paddingBottom: espacio.xl },

  alerta: { borderColor: colores.atencion, gap: 6 },
  alertaTitulo: { ...tipografia.etiqueta, color: colores.atencion },
  alertaTexto: { ...tipografia.menudo, color: colores.textoSuave, lineHeight: 18 },

  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  avisoTexto: { ...tipografia.menudo, color: colores.textoSuave, flex: 1 },
  avisoAccion: { ...tipografia.etiqueta, color: colores.acento },

  encabezado: { paddingVertical: espacio.lg, gap: 4 },
  etiquetaPrincipal: { ...tipografia.etiqueta, color: colores.textoSuave },
  cifraPrincipal: { ...tipografia.cifraGrande, color: colores.acento },
  subCifra: { ...tipografia.menudo, color: colores.textoTenue },

  duo: { flexDirection: 'row', gap: espacio.sm },
  mitad: { flex: 1, gap: 6 },
  etiqueta: { ...tipografia.etiqueta, color: colores.textoSuave },
  cifraMedia: { ...tipografia.cifra, fontSize: 20, color: colores.texto },

  grafica: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 4,
    marginTop: espacio.md,
  },
  columna: { flex: 1, justifyContent: 'flex-end' },
  barra: {
    backgroundColor: colores.acentoProfundo,
    borderRadius: 3,
    width: '100%',
  },

  listaCategorias: { gap: 10, marginTop: espacio.md },
  filaCategoria: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  nombreCategoria: { ...tipografia.menudo, color: colores.textoSuave, width: 84 },
  barraFondo: {
    flex: 1,
    height: 6,
    backgroundColor: colores.superficieAlta,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barraRelleno: {
    height: '100%',
    backgroundColor: colores.acento,
    borderRadius: 3,
  },
  montoCategoria: {
    ...tipografia.menudo,
    color: colores.texto,
    fontVariant: ['tabular-nums'],
    width: 78,
    textAlign: 'right',
  },
});
