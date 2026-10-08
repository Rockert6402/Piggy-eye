/**
 * HU-05: dashboard con resumen de gastos por día, semana y mes.
 * También es donde aparece la alerta de permiso revocado (HU-07).
 *
 * Criterios cubiertos:
 *   - Suma gastos automáticos, manuales y confirmados (src/dashboard/resumen).
 *   - Selector Día / Semana / Mes. Las tres vistas se calculan de una vez,
 *     así que cambiar de pestaña es inmediato y no consulta la base.
 *   - Se recalcula solo cuando entra un gasto (useAlCambiarDatos).
 *   - Estado vacío: "No hay gastos registrados para este periodo".
 *   - Si falla el cálculo: mensaje y botón para reintentar.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colores, espacio, radio, tipografia } from '../../src/ui/tema';
import { Cabecera, Tarjeta, Boton, Vacio } from '../../src/ui/componentes';
import { formatearCOP } from '../../src/parser/monto';
import { listarParaResumen } from '../../src/db/gastos';
import {
  rangoConsulta,
  resumirTodo,
  VISTAS,
  type ResumenVista,
  type Vista,
} from '../../src/dashboard/resumen';
import { presupuestosConGasto, type PresupuestoConGasto } from '../../src/db/presupuestos';
import { contarPendientes } from '../../src/db/pendientes';
import { useAlCambiarDatos } from '../../src/eventos';
import { usePermisoNotificaciones } from '../../src/notificaciones/permisos';
import { consultarPermisoSMS, leerSMSBancarios } from '../../src/sms';

const ALTO_GRAFICA = 80;

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'listo'; resumenes: Record<Vista, ResumenVista> };

/** "+25 % vs. ayer", "−10 % vs. la semana pasada" o null si no hay con qué comparar. */
function textoVariacion(r: ResumenVista): { texto: string; subio: boolean } | null {
  if (r.variacion === null) return null;
  const pct = Math.round(Math.abs(r.variacion) * 100);
  if (pct === 0) return { texto: `Igual que ${r.rango.textoAnterior}`, subio: false };
  const subio = r.variacion > 0;
  return { texto: `${subio ? '+' : '−'}${pct} % vs. ${r.rango.textoAnterior}`, subio };
}

export default function Dashboard() {
  const router = useRouter();
  const permiso = usePermisoNotificaciones();

  const [vista, setVista] = useState<Vista>('dia');
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    // Si la lectura de SMS falla, el resumen igual debe cargar.
    try {
      const permisoSMS = await consultarPermisoSMS();
      if (permisoSMS === 'authorized') await leerSMSBancarios(30);
    } catch {
      // Se ignora: los SMS son un complemento.
    }

    try {
      const ahora = new Date();
      const { desde, hasta } = rangoConsulta(ahora);
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();

      const [movimientos, p, pr] = await Promise.all([
        listarParaResumen(desde, hasta),
        contarPendientes(),
        presupuestosConGasto(inicioMes, ahora.getTime() + 1),
      ]);

      // Las tres vistas de una vez: cambiar de pestaña no vuelve a la base.
      setEstado({ tipo: 'listo', resumenes: resumirTodo(movimientos, ahora) });
      setPendientes(p);
      setPresupuestos(pr);
    } catch {
      setEstado({ tipo: 'error' });
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  // HU-05: los totales cambian solos cuando entra un gasto nuevo.
  useAlCambiarDatos(cargar);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const reintentar = () => {
    setEstado({ tipo: 'cargando' });
    void cargar();
  };

  const r = estado.tipo === 'listo' ? estado.resumenes[vista] : null;
  const variacion = r ? textoVariacion(r) : null;

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

        {/* Selector Día / Semana / Mes */}
        <View style={e.selector} accessibilityRole="tablist">
          {VISTAS.map((v) => {
            const activa = vista === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => setVista(v.id)}
                style={[e.segmento, activa && e.segmentoActivo]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
              >
                <Text style={[e.segmentoTexto, activa && e.segmentoTextoActivo]}>{v.etiqueta}</Text>
              </Pressable>
            );
          })}
        </View>

        {estado.tipo === 'cargando' && (
          <View style={e.cargando}>
            <ActivityIndicator color={colores.acento} />
          </View>
        )}

        {estado.tipo === 'error' && (
          <Tarjeta style={e.error}>
            <Ionicons name="cloud-offline-outline" size={28} color={colores.atencion} />
            <Text style={e.errorTitulo}>No pudimos calcular tus totales</Text>
            <Text style={e.errorTexto}>Tus gastos están guardados. Intenta recargar el resumen.</Text>
            <Boton texto="Reintentar" alPresionar={reintentar} />
          </Tarjeta>
        )}

        {r && (
          <>
            {/* Total del período */}
            <View style={e.encabezado}>
              <Text style={e.etiquetaPrincipal}>{r.rango.titulo} · gastaste</Text>
              <Text style={e.cifraPrincipal}>{formatearCOP(r.gastos)}</Text>
              {variacion && (
                <Text style={[e.variacion, { color: variacion.subio ? colores.atencion : colores.ingreso }]}>
                  {variacion.texto}
                </Text>
              )}
              <Text style={e.subCifra}>
                {r.cantidadGastos === 1 ? '1 gasto' : `${r.cantidadGastos} gastos`}
                {r.ingresos > 0 ? (
                  <>
                    {'  ·  '}
                    <Text style={{ color: colores.ingreso }}>Ingresos {formatearCOP(r.ingresos)}</Text>
                    {'  ·  '}
                    <Text style={{ color: r.balance >= 0 ? colores.ingreso : colores.atencion }}>
                      Balance {r.balance >= 0 ? '+' : ''}
                      {formatearCOP(r.balance)}
                    </Text>
                  </>
                ) : null}
              </Text>
            </View>

            {r.cantidadGastos === 0 ? (
              <Tarjeta>
                <Vacio
                  icono="wallet-outline"
                  titulo="No hay gastos registrados para este periodo"
                  detalle="Cuando llegue una notificación de tu banco o anotes un gasto, aparecerá aquí."
                  accion={{ texto: 'Anotar un gasto', alPresionar: () => router.push('/gasto/nuevo') }}
                />
              </Tarjeta>
            ) : (
              <>
                {/* Gráfica del período */}
                <Tarjeta>
                  <View style={e.graficaCabecera}>
                    <Text style={e.etiqueta}>
                      {vista === 'dia' ? 'Últimos 7 días' : vista === 'semana' ? 'Día a día' : 'Día a día del mes'}
                    </Text>
                    <View style={e.leyenda}>
                      <View style={[e.leyendaPunto, { backgroundColor: colores.ingreso }]} />
                      <Text style={e.leyendaTexto}>Ingresos</Text>
                      <View style={[e.leyendaPunto, { backgroundColor: colores.acentoProfundo }]} />
                      <Text style={e.leyendaTexto}>Gastos</Text>
                    </View>
                  </View>
                  <View style={e.grafica}>
                    {r.barras.map((b, i) => (
                      <View key={i} style={e.columna}>
                        <View style={e.barras}>
                          {b.ingresos > 0 && (
                            <View
                              style={[
                                e.barra,
                                vista === 'mes' && e.barraFina,
                                {
                                  height: Math.max(3, (b.ingresos / r.maximoBarra) * ALTO_GRAFICA),
                                  backgroundColor: colores.ingreso,
                                },
                              ]}
                            />
                          )}
                          {b.gastos > 0 && (
                            <View
                              style={[
                                e.barra,
                                vista === 'mes' && e.barraFina,
                                {
                                  height: Math.max(3, (b.gastos / r.maximoBarra) * ALTO_GRAFICA),
                                  backgroundColor: b.esHoy ? colores.acento : colores.acentoProfundo,
                                },
                              ]}
                            />
                          )}
                        </View>
                        <Text style={[e.etiquetaBarra, b.esHoy && { color: colores.acento }]} numberOfLines={1}>
                          {b.etiqueta}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Tarjeta>

                {/* Categorías del período */}
                <Tarjeta>
                  <Text style={e.etiqueta}>Por categoría</Text>
                  <View style={e.listaCategorias}>
                    {r.categorias.map((c) => (
                      <View key={c.categoria} style={e.filaCategoria}>
                        <Text style={e.nombreCategoria} numberOfLines={1}>{c.categoria}</Text>
                        <View style={e.barraFondo}>
                          <View
                            style={[
                              e.barraRelleno,
                              { width: `${Math.max(2, (c.total / (r.categorias[0]?.total || 1)) * 100)}%` },
                            ]}
                          />
                        </View>
                        <Text style={e.montoCategoria}>{formatearCOP(c.total)}</Text>
                      </View>
                    ))}
                  </View>
                </Tarjeta>
              </>
            )}
          </>
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

        {presupuestos.length === 0 && estado.tipo === 'listo' && (
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

  selector: {
    flexDirection: 'row',
    backgroundColor: colores.superficie,
    borderRadius: radio.sm,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 3,
  },
  segmento: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radio.sm - 2 },
  segmentoActivo: { backgroundColor: colores.superficieAlta },
  segmentoTexto: { ...tipografia.etiqueta, color: colores.textoTenue },
  segmentoTextoActivo: { color: colores.texto, fontWeight: '600' },

  cargando: { paddingVertical: espacio.xl },

  error: { alignItems: 'center', gap: espacio.sm, paddingVertical: espacio.lg },
  errorTitulo: { ...tipografia.etiqueta, fontSize: 15, color: colores.texto },
  errorTexto: { ...tipografia.menudo, color: colores.textoSuave, textAlign: 'center', marginBottom: espacio.xs },

  encabezado: { paddingTop: espacio.sm, paddingBottom: espacio.xs, gap: 4 },
  etiquetaPrincipal: { ...tipografia.etiqueta, color: colores.textoSuave },
  cifraPrincipal: { ...tipografia.cifraGrande, color: colores.acento },
  variacion: { ...tipografia.etiqueta },
  subCifra: { ...tipografia.menudo, color: colores.textoTenue },

  etiqueta: { ...tipografia.etiqueta, color: colores.textoSuave },

  graficaCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaPunto: { width: 8, height: 8, borderRadius: 4 },
  leyendaTexto: { ...tipografia.menudo, color: colores.textoTenue },

  grafica: { flexDirection: 'row', alignItems: 'flex-end', height: ALTO_GRAFICA + 26, gap: 2, marginTop: espacio.md },
  columna: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, justifyContent: 'center', minHeight: 3 },
  barra: { width: 6, borderRadius: 3 },
  barraFina: { width: 3, borderRadius: 2 },
  etiquetaBarra: { ...tipografia.menudo, fontSize: 10, color: colores.textoTenue, height: 14 },

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
