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
  serieDiariaDoble,
  type CorteTemporal,
  type GastoPorCategoria,
  type PuntoDiarioDoble,
} from '../../src/db/gastos';
import { presupuestosConGasto, type PresupuestoConGasto } from '../../src/db/presupuestos';
import { contarPendientes } from '../../src/db/pendientes';
import { usePermisoNotificaciones } from '../../src/notificaciones/permisos';
import { consultarPermisoSMS, leerSMSBancarios } from '../../src/sms';

export default function Dashboard() {
  const router = useRouter();
  const permiso = usePermisoNotificaciones();

  const [corte, setCorte] = useState<CorteTemporal | null>(null);
  const [categorias, setCategorias] = useState<GastoPorCategoria[]>([]);
  const [serie, setSerie] = useState<PuntoDiarioDoble[]>([]);
  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    const permisoSMS = await consultarPermisoSMS();
    if (permisoSMS === 'authorized') await leerSMSBancarios(30);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const fin = Date.now() + 1;

    const [r, c, s, p, pr] = await Promise.all([
      resumenDashboard(),
      totalesPorCategoria(inicioMes.getTime(), fin),
      serieDiariaDoble(14),
      contarPendientes(),
      presupuestosConGasto(inicioMes.getTime(), fin),
    ]);
    setCorte(r);
    setCategorias(c);
    setSerie(s);
    setPendientes(p);
    setPresupuestos(pr);
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const maxValor = Math.max(...serie.flatMap((p) => [p.gastos, p.ingresos]), 1);

  return (
    <SafeAreaView style={e.pantalla} edges={[]}>
      <Cabecera
        seccion="Resumen"
        accion={{ icono: 'add-circle-outline', alPresionar: () => router.push('/gasto/nuevo') }}
      />
      <ScrollView
        contentContainerStyle={e.contenido}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colores.textoSuave} />
        }
      >
        {!permiso.cargando && !permiso.activo && (
          <Pressable onPress={permiso.solicitar}>
            <Tarjeta style={e.alerta}>
              <Text style={e.alertaTitulo}>La captura automática está apagada</Text>
              <Text style={e.alertaTexto}>
                Piggy Eye necesita acceso a las notificaciones para registrar tus compras.
                Toca aquí para activarlo.
              </Text>
            </Tarjeta>
          </Pressable>
        )}

        {pendientes > 0 && (
          <Pressable onPress={() => router.push('/(tabs)/pendientes')}>
            <Tarjeta style={e.aviso}>
              <Text style={e.avisoTexto}>
                {pendientes === 1 ? '1 notificación sin interpretar' : `${pendientes} notificaciones sin interpretar`}
              </Text>
              <Text style={e.avisoAccion}>Revisar</Text>
            </Tarjeta>
          </Pressable>
        )}

        {/* Balance del mes */}
        <View style={e.encabezado}>
          <Text style={e.etiquetaPrincipal}>Balance este mes</Text>
          {(() => {
            const gastosMes = corte?.mes.total ?? 0;
            const ingresosMes = corte?.ingresosMes.total ?? 0;
            const balance = ingresosMes - gastosMes;
            const colorBalance = balance >= 0 ? colores.ingreso : colores.atencion;
            return (
              <>
                <Text style={[e.cifraPrincipal, { color: colorBalance }]}>
                  {balance >= 0 ? '+' : ''}{formatearCOP(balance)}
                </Text>
                <View style={e.desgloseMes}>
                  <Text style={e.desgloseMesTexto}>
                    <Text style={{ color: colores.ingreso }}>↓ {formatearCOP(ingresosMes)}</Text>
                    {'  '}
                    <Text style={{ color: colores.acento }}>↑ {formatearCOP(gastosMes)}</Text>
                  </Text>
                </View>
              </>
            );
          })()}
          <Text style={e.subCifra}>
            {(corte?.mes.cantidad ?? 0) + (corte?.ingresosMes.cantidad ?? 0)} movimientos este mes
          </Text>
        </View>

        {/* Tarjetas hoy / semana */}
        <View style={e.duo}>
          <Tarjeta style={e.mitad}>
            <Text style={e.etiqueta}>Hoy</Text>
            <Text style={e.cifraMedia}>{formatearCOP(corte?.hoy.total ?? 0)}</Text>
          </Tarjeta>
          <Tarjeta style={e.mitad}>
            <Text style={e.etiqueta}>Esta semana</Text>
            <Text style={e.cifraMedia}>{formatearCOP(corte?.semana.total ?? 0)}</Text>
          </Tarjeta>
        </View>

        {/* Gráfica ingresos vs gastos */}
        {serie.length > 0 && (
          <Tarjeta>
            <View style={e.graficaCabecera}>
              <Text style={e.etiqueta}>Últimos 14 días</Text>
              <View style={e.leyenda}>
                <View style={[e.leyendaPunto, { backgroundColor: colores.ingreso }]} />
                <Text style={e.leyendaTexto}>Ingresos</Text>
                <View style={[e.leyendaPunto, { backgroundColor: colores.acentoProfundo }]} />
                <Text style={e.leyendaTexto}>Gastos</Text>
              </View>
            </View>
            <View style={e.grafica}>
              {serie.map((punto) => (
                <View key={punto.dia} style={e.columna}>
                  <View style={e.barras}>
                    {punto.ingresos > 0 && (
                      <View
                        style={[
                          e.barra,
                          {
                            height: Math.max(3, (punto.ingresos / maxValor) * 80),
                            backgroundColor: colores.ingreso,
                          },
                        ]}
                      />
                    )}
                    {punto.gastos > 0 && (
                      <View
                        style={[
                          e.barra,
                          {
                            height: Math.max(3, (punto.gastos / maxValor) * 80),
                            backgroundColor: colores.acentoProfundo,
                          },
                        ]}
                      />
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Tarjeta>
        )}

        {/* Presupuestos */}
        {presupuestos.length > 0 && (
          <Tarjeta>
            <View style={e.presupuestoCabecera}>
              <Text style={e.etiqueta}>Presupuestos del mes</Text>
              <Pressable onPress={() => router.push('/presupuesto/gestionar')}>
                <Text style={e.editarLink}>Editar</Text>
              </Pressable>
            </View>
            <View style={e.listaPresupuestos}>
              {presupuestos.map((p) => {
                const excedido = p.porcentaje > 100;
                const colorBarra = excedido ? colores.peligro : p.porcentaje > 80 ? colores.atencion : colores.ingreso;
                return (
                  <View key={p.categoria} style={e.filaPresupuesto}>
                    <View style={e.presupuestoTitulo}>
                      <Text style={e.nombreCategoria} numberOfLines={1}>{p.categoria}</Text>
                      <Text style={[e.montoPresupuesto, excedido && { color: colores.peligro }]}>
                        {formatearCOP(p.gastado)} / {formatearCOP(p.limite)}
                      </Text>
                    </View>
                    <View style={e.barraFondo}>
                      <View
                        style={[
                          e.barraRelleno,
                          {
                            width: `${Math.min(p.porcentaje, 100)}%`,
                            backgroundColor: colorBarra,
                          },
                        ]}
                      />
                    </View>
                    {excedido && (
                      <Text style={e.excedidoTexto}>
                        Excedido en {formatearCOP(p.gastado - p.limite)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </Tarjeta>
        )}

        {/* Categorías */}
        {categorias.length > 0 && (
          <Tarjeta>
            <Text style={e.etiqueta}>Por categoría este mes</Text>
            <View style={e.listaCategorias}>
              {categorias.map((c) => (
                <View key={c.categoria} style={e.filaCategoria}>
                  <Text style={e.nombreCategoria} numberOfLines={1}>{c.categoria}</Text>
                  <View style={e.barraFondo}>
                    <View
                      style={[
                        e.barraRelleno,
                        { width: `${Math.max(2, (c.total / (categorias[0]?.total || 1)) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={e.montoCategoria}>{formatearCOP(c.total)}</Text>
                </View>
              ))}
            </View>
          </Tarjeta>
        )}

        {presupuestos.length === 0 && (
          <Pressable onPress={() => router.push('/presupuesto/gestionar')}>
            <Tarjeta style={e.avisoPresupuesto}>
              <Text style={e.avisoPresupuestoTexto}>
                Agrega presupuestos por categoría para ver si estás dentro del límite cada mes.
              </Text>
              <Text style={e.avisoAccion}>Configurar</Text>
            </Tarjeta>
          </Pressable>
        )}

        <Boton
          texto="Anotar un movimiento"
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

  aviso: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  avisoTexto: { ...tipografia.menudo, color: colores.textoSuave, flex: 1 },
  avisoAccion: { ...tipografia.etiqueta, color: colores.acento },

  encabezado: { paddingVertical: espacio.lg, gap: 4 },
  etiquetaPrincipal: { ...tipografia.etiqueta, color: colores.textoSuave },
  cifraPrincipal: { ...tipografia.cifraGrande, color: colores.acento },
  desgloseMes: { marginTop: 2 },
  desgloseMesTexto: { ...tipografia.menudo, color: colores.textoSuave },
  subCifra: { ...tipografia.menudo, color: colores.textoTenue },

  duo: { flexDirection: 'row', gap: espacio.sm },
  mitad: { flex: 1, gap: 6 },
  etiqueta: { ...tipografia.etiqueta, color: colores.textoSuave },
  cifraMedia: { ...tipografia.cifra, fontSize: 20, color: colores.texto },

  graficaCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaPunto: { width: 8, height: 8, borderRadius: 4 },
  leyendaTexto: { ...tipografia.menudo, color: colores.textoTenue },

  grafica: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 3, marginTop: espacio.md },
  columna: { flex: 1, justifyContent: 'flex-end' },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, justifyContent: 'center' },
  barra: { width: 5, borderRadius: 3 },

  presupuestoCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editarLink: { ...tipografia.etiqueta, color: colores.acento },
  listaPresupuestos: { gap: 12, marginTop: espacio.md },
  filaPresupuesto: { gap: 5 },
  presupuestoTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  excedidoTexto: { ...tipografia.menudo, color: colores.peligro },

  listaCategorias: { gap: 10, marginTop: espacio.md },
  filaCategoria: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  nombreCategoria: { ...tipografia.menudo, color: colores.textoSuave, width: 84 },
  barraFondo: { flex: 1, height: 6, backgroundColor: colores.superficieAlta, borderRadius: 3, overflow: 'hidden' },
  barraRelleno: { height: '100%', backgroundColor: colores.acento, borderRadius: 3 },
  montoCategoria: { ...tipografia.menudo, color: colores.texto, fontVariant: ['tabular-nums'], width: 78, textAlign: 'right' },
  montoPresupuesto: { ...tipografia.menudo, color: colores.textoSuave, fontVariant: ['tabular-nums'] },

  avisoPresupuesto: { gap: 6 },
  avisoPresupuestoTexto: { ...tipografia.menudo, color: colores.textoSuave, lineHeight: 18 },
});
