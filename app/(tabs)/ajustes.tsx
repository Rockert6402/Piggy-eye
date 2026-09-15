/**
 * Ajustes. Tres cosas viven acá:
 *   · HU-07: estado del permiso de notificaciones y cómo activarlo.
 *   · HU-06: estado de la sincronización.
 *   · La bitácora de diagnóstico, que es la herramienta con la que el
 *     equipo va a construir los patrones reales de cada banco.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colores, espacio, radio, tipografia, fechaLegible } from '../../src/ui/tema';
import { Boton, Tarjeta } from '../../src/ui/componentes';
import { usePermisoNotificaciones } from '../../src/notificaciones/permisos';
import {
  listarDiagnostico,
  limpiarDiagnostico,
  type EntradaDiagnostico,
} from '../../src/db/pendientes';
import { contarSinSincronizar, haySincronizacion } from '../../src/sync/cola';
import { BANCOS } from '../../src/parser';

const COLOR_VEREDICTO: Record<string, string> = {
  registrada: colores.ingreso,
  pendiente: colores.atencion,
  descartada: colores.textoTenue,
  duplicada: colores.textoTenue,
  error: colores.peligro,
};

export default function Ajustes() {
  const permiso = usePermisoNotificaciones();
  const [bitacora, setBitacora] = useState<EntradaDiagnostico[]>([]);
  const [sinSubir, setSinSubir] = useState(0);

  const cargar = useCallback(async () => {
    const [b, n] = await Promise.all([
      listarDiagnostico(60),
      contarSinSincronizar(),
    ]);
    setBitacora(b);
    setSinSubir(n);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={e.contenido}>
        <Text style={e.titulo}>Ajustes</Text>

        <Tarjeta style={e.bloque}>
          <Text style={e.encabezado}>Captura automática</Text>
          <Text style={e.detalle}>
            {permiso.activo
              ? 'Piggy Eye está leyendo las notificaciones de tus bancos y registrando los gastos apenas ocurren.'
              : 'Sin este permiso, Piggy Eye no puede ver las notificaciones de tu banco y solo funcionará con los gastos que anotes a mano.'}
          </Text>
          <View style={e.estadoFila}>
            <View
              style={[
                e.punto,
                { backgroundColor: permiso.activo ? colores.ingreso : colores.atencion },
              ]}
            />
            <Text style={e.estadoTexto}>
              {permiso.activo ? 'Activo' : 'Apagado'}
            </Text>
          </View>
          {!permiso.activo && (
            <Boton texto="Activar en ajustes de Android" alPresionar={permiso.solicitar} />
          )}
        </Tarjeta>

        <Tarjeta style={e.bloque}>
          <Text style={e.encabezado}>Copia en la nube</Text>
          <Text style={e.detalle}>
            {haySincronizacion()
              ? `${sinSubir} ${sinSubir === 1 ? 'movimiento' : 'movimientos'} sin subir.`
              : 'Apagada. Todos tus datos viven solo en este teléfono y nunca salen de él.'}
          </Text>
        </Tarjeta>

        <Tarjeta style={e.bloque}>
          <Text style={e.encabezado}>Bancos reconocidos</Text>
          <Text style={e.detalle}>
            Piggy Eye solo procesa notificaciones de estas apps. Cualquier otra se
            ignora sin leerla.
          </Text>
          <View style={e.chips}>
            {BANCOS.map((b) => (
              <View key={b.nombre} style={e.chip}>
                <Text style={e.chipTexto}>{b.nombre}</Text>
              </View>
            ))}
          </View>
        </Tarjeta>

        <Tarjeta style={e.bloque}>
          <Text style={e.encabezado}>Registro técnico</Text>
          <Text style={e.detalle}>
            Las últimas notificaciones que pasaron por el lector, con lo que Piggy
            Eye decidió hacer con cada una. Sirve para afinar los patrones de cada
            banco durante el desarrollo.
          </Text>

          {bitacora.length === 0 ? (
            <Text style={e.vacioTexto}>Sin registros todavía.</Text>
          ) : (
            <View style={e.listaBitacora}>
              {bitacora.map((entrada) => (
                <View key={entrada.id} style={e.entradaBitacora}>
                  <View style={e.entradaCabecera}>
                    <Text
                      style={[
                        e.veredicto,
                        { color: COLOR_VEREDICTO[entrada.veredicto] ?? colores.textoSuave },
                      ]}
                    >
                      {entrada.veredicto}
                    </Text>
                    <Text style={e.entradaFecha}>{fechaLegible(entrada.fecha)}</Text>
                  </View>
                  <Text style={e.entradaPaquete}>{entrada.paquete}</Text>
                  <Text style={e.entradaTexto} numberOfLines={3}>
                    {entrada.titulo} — {entrada.texto}
                  </Text>
                  {entrada.motivo && (
                    <Text style={e.entradaMotivo}>{entrada.motivo}</Text>
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
        </Tarjeta>
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.md, gap: espacio.md, paddingBottom: espacio.xl },
  titulo: { ...tipografia.titulo, color: colores.texto, marginBottom: espacio.xs },
  bloque: { gap: espacio.sm },
  encabezado: { ...tipografia.etiqueta, fontSize: 15, color: colores.texto },
  detalle: { ...tipografia.menudo, color: colores.textoSuave, lineHeight: 18 },

  estadoFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  punto: { width: 8, height: 8, borderRadius: 4 },
  estadoTexto: { ...tipografia.etiqueta, color: colores.texto },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colores.superficieAlta,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radio.sm,
  },
  chipTexto: { ...tipografia.menudo, color: colores.textoSuave },

  vacioTexto: { ...tipografia.menudo, color: colores.textoTenue },
  listaBitacora: { gap: espacio.sm },
  entradaBitacora: {
    backgroundColor: colores.fondo,
    borderRadius: radio.sm,
    padding: espacio.sm,
    gap: 3,
  },
  entradaCabecera: { flexDirection: 'row', justifyContent: 'space-between' },
  veredicto: { ...tipografia.menudo, fontWeight: '600' },
  entradaFecha: { ...tipografia.menudo, color: colores.textoTenue },
  entradaPaquete: { ...tipografia.menudo, color: colores.textoTenue },
  entradaTexto: { ...tipografia.menudo, color: colores.textoSuave, lineHeight: 17 },
  entradaMotivo: { ...tipografia.menudo, color: colores.acentoProfundo },
});
