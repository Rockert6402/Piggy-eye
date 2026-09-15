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
import { contarSinSincronizar, haySincronizacion } from '../../src/sync/cola';
import { BANCOS } from '../../src/parser';
import { exportarCSV } from '../../src/exportar/csv';

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
  const [exportando, setExportando] = useState(false);
  const [expandirBitacora, setExpandirBitacora] = useState(false);

  const cargar = useCallback(async () => {
    const [b, n] = await Promise.all([listarDiagnostico(60), contarSinSincronizar()]);
    setBitacora(b);
    setSinSubir(n);
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const handleExportar = async () => {
    setExportando(true);
    const resultado = await exportarCSV();
    setExportando(false);
    if (!resultado.ok && resultado.mensaje) {
      Alert.alert('Exportar', resultado.mensaje);
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
          <Text style={e.encabezado}>Exportar movimientos</Text>
          <Text style={e.detalle}>
            Descarga todos tus movimientos en formato CSV, compatible con Excel y Google Sheets.
          </Text>
          <Boton
            texto={exportando ? 'Exportando…' : 'Exportar a CSV'}
            variante="secundario"
            alPresionar={handleExportar}
            deshabilitado={exportando}
          />
        </Tarjeta>

        {/* Sincronización */}
        <Tarjeta style={e.bloque}>
          <Text style={e.encabezado}>Copia en la nube</Text>
          <Text style={e.detalle}>
            {haySincronizacion()
              ? `${sinSubir} ${sinSubir === 1 ? 'movimiento' : 'movimientos'} sin subir.`
              : 'Apagada. Todos tus datos viven solo en este teléfono y nunca salen de él.'}
          </Text>
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
