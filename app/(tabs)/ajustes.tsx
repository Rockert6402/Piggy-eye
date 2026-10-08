/**
 * Ajustes: permisos, sincronización, bancos reconocidos,
 * exportar CSV y bitácora de diagnóstico.
 */

import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colores, espacio, radio, tipografia, fechaLegible } from '../../src/ui/tema';
import { Boton, Cabecera, Tarjeta } from '../../src/ui/componentes';
import { usePermisoNotificaciones } from '../../src/notificaciones/permisos';
import { usePermisoSMS } from '../../src/sms';
import {
  listarDiagnostico,
  limpiarDiagnostico,
  type EntradaDiagnostico,
} from '../../src/db/pendientes';
import {
  contarSinSincronizar,
  haySincronizacion,
  obtenerEstadoSync,
  type EstadoSync,
} from '../../src/sync/cola';
import { URL_SERVIDOR } from '../../src/sync/configuracion';
import { sincronizarAhora } from '../../src/sync/monitor';
import { useAlCambiarDatos } from '../../src/eventos';
import { BANCOS } from '../../src/parser';
import { exportarExtracto, PERIODOS, type Formato, type Periodo } from '../../src/exportar';

const COLOR_VEREDICTO: Record<string, string> = {
  registrada: colores.ingreso,
  pendiente: colores.atencion,
  descartada: colores.textoTenue,
  duplicada: colores.textoTenue,
  error: colores.peligro,
};

const ICONO_VEREDICTO: Record<string, string> = {
  registrada: 'checkmark-circle',
  pendiente: 'time',
  descartada: 'remove-circle',
  duplicada: 'copy',
  error: 'alert-circle',
};

export default function Ajustes() {
  const router = useRouter();
  const permiso = usePermisoNotificaciones();
  const permisoSMS = usePermisoSMS();
  const [bitacora, setBitacora] = useState<EntradaDiagnostico[]>([]);
  const [sinSubir, setSinSubir] = useState(0);
  const [estadoSync, setEstadoSync] = useState<EstadoSync>(obtenerEstadoSync());
  const [sincronizando, setSincronizando] = useState(false);
  // Formato en curso, para mostrar "Generando…" solo en ese botón.
  const [exportando, setExportando] = useState<Formato | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [expandirBitacora, setExpandirBitacora] = useState(false);

  const cargar = useCallback(async () => {
    const [b, n] = await Promise.all([listarDiagnostico(60), contarSinSincronizar()]);
    setBitacora(b);
    setSinSubir(n);
    setEstadoSync(obtenerEstadoSync());
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  // El contador de pendientes baja solo cuando el monitor sincroniza.
  useAlCambiarDatos(cargar);

  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      const n = await sincronizarAhora('manual');
      if (n === 0 && sinSubir === 0) Alert.alert('Sincronización', 'Todo está al día.');
    } catch {
      Alert.alert(
        'Sin conexión con el servidor',
        'Tus movimientos siguen guardados en el teléfono y se enviarán solos cuando vuelva la conexión.'
      );
    } finally {
      setSincronizando(false);
      await cargar();
    }
  };

  const handleExportar = async (formato: Formato) => {
    setExportando(formato);
    try {
      const resultado = await exportarExtracto(formato, periodo);
      if (!resultado.ok && resultado.mensaje) {
        Alert.alert('Exportar', resultado.mensaje);
      }
    } finally {
      setExportando(null);
    }
  };

  return (
    <SafeAreaView style={e.pantalla} edges={[]}>
      <Cabecera seccion="Ajustes" />
      <ScrollView contentContainerStyle={e.contenido}>

        {/* Notificaciones */}
        <Tarjeta style={e.bloque}>
          <Text style={e.encabezado}>Captura automática</Text>
          <Text style={e.detalle}>
            {permiso.activo
              ? 'Piggy Eye está leyendo las notificaciones de tus bancos y registrando los movimientos apenas ocurren.'
              : 'Sin este permiso solo funcionará con los movimientos que anotes a mano.'}
          </Text>
          <View style={e.estadoFila}>
            <View style={[e.punto, { backgroundColor: permiso.activo ? colores.ingreso : colores.atencion }]} />
            <Text style={e.estadoTexto}>{permiso.activo ? 'Activo' : 'Apagado'}</Text>
          </View>
          {!permiso.activo && (
            <Boton texto="Activar en ajustes de Android" alPresionar={permiso.solicitar} />
          )}
        </Tarjeta>

        {/* SMS */}
        <Tarjeta style={e.bloque}>
          <Text style={e.encabezado}>Lectura de SMS bancarios</Text>
          <Text style={e.detalle}>
            {permisoSMS.activo
              ? 'Piggy Eye lee los mensajes de texto de tus bancos para capturar movimientos que no lleguen como notificación push.'
              : 'Opcional. Algunos bancos envían alertas por SMS. Activa este permiso para que también se detecten.'}
          </Text>
          <View style={e.estadoFila}>
            <View style={[e.punto, { backgroundColor: permisoSMS.activo ? colores.ingreso : colores.textoTenue }]} />
            <Text style={e.estadoTexto}>
              {permisoSMS.activo ? 'Activo' : permisoSMS.estado === 'never_ask_again' ? 'Bloqueado' : 'Apagado'}
            </Text>
          </View>
          {!permisoSMS.activo && permisoSMS.estado !== 'never_ask_again' && (
            <Boton texto="Activar lectura de SMS" variante="secundario" alPresionar={async () => { await permisoSMS.solicitar(); }} />
          )}
        </Tarjeta>

        {/* Presupuestos */}
        <Tarjeta style={e.bloque}>
          <View style={e.filaConAccion}>
            <Text style={e.encabezado}>Presupuestos</Text>
            <Pressable onPress={() => router.push('/presupuesto/gestionar')}>
              <Text style={e.linkAccion}>Gestionar</Text>
            </Pressable>
          </View>
          <Text style={e.detalle}>
            Define cuánto quieres gastar por categoría cada mes y recibe alertas cuando te estés pasando.
          </Text>
        </Tarjeta>

        {/* Exportar */}
        <Tarjeta style={e.bloque}>
          <Text style={e.encabezado}>Exportar extracto</Text>
          <Text style={e.detalle}>
            Genera un extracto como el del banco: entradas, salidas, saldo y resumen por mes y
            categoría. Lo puedes guardar en Drive o enviarlo por WhatsApp o correo.
          </Text>

          <Text style={e.etiquetaPeriodo}>Período</Text>
          <View style={e.chips}>
            {PERIODOS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPeriodo(p.id)}
                style={[e.chipPeriodo, periodo === p.id && e.chipPeriodoActivo]}
                accessibilityRole="button"
                accessibilityState={{ selected: periodo === p.id }}
              >
                <Text style={[e.chipTexto, periodo === p.id && e.chipTextoActivo]}>{p.etiqueta}</Text>
              </Pressable>
            ))}
          </View>

          <View style={e.botonesExportar}>
            <View style={{ flex: 1 }}>
              <Boton
                texto={exportando === 'excel' ? 'Generando…' : 'Excel'}
                alPresionar={() => handleExportar('excel')}
                deshabilitado={exportando !== null}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Boton
                texto={exportando === 'pdf' ? 'Generando…' : 'PDF'}
                variante="secundario"
                alPresionar={() => handleExportar('pdf')}
                deshabilitado={exportando !== null}
              />
            </View>
          </View>
          <Pressable
            onPress={() => handleExportar('csv')}
            disabled={exportando !== null}
            style={{ alignSelf: 'center', padding: 4 }}
          >
            <Text style={e.linkAccion}>
              {exportando === 'csv' ? 'Generando CSV…' : 'Exportar como CSV'}
            </Text>
          </Pressable>
        </Tarjeta>

        {/* Sincronización */}
        <Tarjeta style={e.bloque}>
          <Text style={e.encabezado}>Copia en la nube</Text>
          {haySincronizacion() ? (
            <>
              <Text style={e.detalle}>
                Cada movimiento se guarda primero en el teléfono y se envía al servidor cuando hay
                conexión. Si no hay internet, se envía solo al reconectarse.
              </Text>
              <View style={e.estadoFila}>
                <View
                  style={[
                    e.punto,
                    {
                      backgroundColor: estadoSync.ultimoError
                        ? colores.atencion
                        : sinSubir === 0
                          ? colores.ingreso
                          : colores.textoTenue,
                    },
                  ]}
                />
                <Text style={e.estadoTexto}>
                  {sinSubir === 0
                    ? 'Todo sincronizado'
                    : `${sinSubir} ${sinSubir === 1 ? 'movimiento pendiente' : 'movimientos pendientes'}`}
                </Text>
              </View>
              {estadoSync.ultimoError && sinSubir > 0 && (
                <Text style={e.detalle}>
                  Último intento {fechaLegible(estadoSync.ultimoError.fecha)}: {estadoSync.ultimoError.mensaje}.
                  Tus datos están a salvo en el teléfono.
                </Text>
              )}
              {estadoSync.ultimaExitosa && (
                <Text style={e.detalle}>Última sincronización: {fechaLegible(estadoSync.ultimaExitosa)}</Text>
              )}
              <Text style={e.detalle}>Servidor: {URL_SERVIDOR}</Text>
              <Boton
                texto={sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
                variante="secundario"
                alPresionar={handleSincronizar}
                deshabilitado={sincronizando}
              />
            </>
          ) : (
            <Text style={e.detalle}>
              Apagada. Todos tus datos viven solo en este teléfono y nunca salen de él.
            </Text>
          )}
        </Tarjeta>

        {/* Bancos */}
        <Tarjeta style={e.bloque}>
          <Text style={e.encabezado}>Bancos y apps reconocidas</Text>
          <Text style={e.detalle}>
            Piggy Eye solo procesa notificaciones de estas apps. Cualquier otra se ignora sin leerla.
          </Text>
          <View style={e.chips}>
            {BANCOS.map((b) => (
              <View key={b.nombre} style={e.chip}>
                <Text style={e.chipTexto}>{b.nombre}</Text>
              </View>
            ))}
          </View>
        </Tarjeta>

        {/* Bitácora de diagnóstico */}
        <Tarjeta style={e.bloque}>
          <Pressable onPress={() => setExpandirBitacora((v) => !v)} style={e.filaConAccion}>
            <Text style={e.encabezado}>Registro técnico</Text>
            <Ionicons
              name={expandirBitacora ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colores.textoTenue}
            />
          </Pressable>
          <Text style={e.detalle}>
            Últimas notificaciones y SMS procesados por el lector.
          </Text>

          {expandirBitacora && (
            <>
              {bitacora.length === 0 ? (
                <Text style={e.vacioTexto}>Sin registros todavía.</Text>
              ) : (
                <View style={e.listaBitacora}>
                  {bitacora.map((entrada) => (
                    <View key={entrada.id} style={e.entradaBitacora}>
                      <View style={e.entradaCabecera}>
                        <View style={e.veredictoFila}>
                          <Ionicons
                            name={(ICONO_VEREDICTO[entrada.veredicto] ?? 'ellipse') as any}
                            size={13}
                            color={COLOR_VEREDICTO[entrada.veredicto] ?? colores.textoSuave}
                          />
                          <Text style={[e.veredicto, { color: COLOR_VEREDICTO[entrada.veredicto] ?? colores.textoSuave }]}>
                            {entrada.veredicto}
                          </Text>
                        </View>
                        <Text style={e.entradaFecha}>{fechaLegible(entrada.fecha)}</Text>
                      </View>
                      <Text style={e.entradaPaquete} numberOfLines={1}>{entrada.paquete}</Text>
                      <Text style={e.entradaTexto} numberOfLines={3}>
                        {entrada.titulo ? `${entrada.titulo} — ` : ''}{entrada.texto}
                      </Text>
                      {entrada.motivo && (
                        <Text style={e.entradaMotivo}>Regla: {entrada.motivo}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {bitacora.length > 0 && (
                <Boton
                  texto="Borrar registro"
                  variante="secundario"
                  alPresionar={async () => {
                    await limpiarDiagnostico();
                    await cargar();
                  }}
                />
              )}
            </>
          )}
        </Tarjeta>
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.md, gap: espacio.md, paddingBottom: espacio.xl },
  bloque: { gap: espacio.sm },
  encabezado: { ...tipografia.etiqueta, fontSize: 15, color: colores.texto },
  detalle: { ...tipografia.menudo, color: colores.textoSuave, lineHeight: 18 },

  filaConAccion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkAccion: { ...tipografia.etiqueta, color: colores.acento },

  estadoFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  punto: { width: 8, height: 8, borderRadius: 4 },
  estadoTexto: { ...tipografia.etiqueta, color: colores.texto },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colores.superficieAlta, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radio.sm },
  chipTexto: { ...tipografia.menudo, color: colores.textoSuave },
  chipTextoActivo: { color: colores.fondo, fontWeight: '600' },
  chipPeriodo: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radio.sm,
    backgroundColor: colores.superficieAlta,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  chipPeriodoActivo: { backgroundColor: colores.acento, borderColor: colores.acento },
  etiquetaPeriodo: { ...tipografia.menudo, color: colores.textoSuave, marginTop: espacio.xs },
  botonesExportar: { flexDirection: 'row', gap: espacio.sm, marginTop: espacio.xs },

  vacioTexto: { ...tipografia.menudo, color: colores.textoTenue },
  listaBitacora: { gap: espacio.sm },
  entradaBitacora: { backgroundColor: colores.fondo, borderRadius: radio.sm, padding: espacio.sm, gap: 3 },
  entradaCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  veredictoFila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  veredicto: { ...tipografia.menudo, fontWeight: '600' },
  entradaFecha: { ...tipografia.menudo, color: colores.textoTenue },
  entradaPaquete: { ...tipografia.menudo, color: colores.textoTenue },
  entradaTexto: { ...tipografia.menudo, color: colores.textoSuave, lineHeight: 17 },
  entradaMotivo: { ...tipografia.menudo, color: colores.acentoProfundo },
});
