/**
 * HU-04: confirmación manual cuando el parser no reconoce la notificación.
 *
 * Esta pantalla es la red de seguridad de todo el sistema. Cuando un banco
 * cambia el formato de sus mensajes —que va a pasar— los gastos caen acá en
 * vez de perderse, y el usuario los rescata con dos toques.
 */

import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colores, espacio, radio, tipografia, fechaLegible } from '../../src/ui/tema';
import { Boton, Cabecera, Tarjeta, Vacio } from '../../src/ui/componentes';
import { normalizarMonto, formatearCOP } from '../../src/parser/monto';
import {
  listarPendientes,
  confirmarPendiente,
  descartarPendiente,
  type Pendiente,
} from '../../src/db/pendientes';
import { CATEGORIAS } from '../../src/db/gastos';

export default function Pendientes() {
  const [items, setItems] = useState<Pendiente[]>([]);
  const [montos, setMontos] = useState<Record<number, string>>({});
  const [comercios, setComercios] = useState<Record<number, string>>({});
  const [categorias, setCategorias] = useState<Record<number, string>>({});

  const cargar = useCallback(async () => {
    const datos = await listarPendientes();
    setItems(datos);
    setMontos(
      Object.fromEntries(
        datos.map((p) => [p.id, p.monto_sugerido ? String(p.monto_sugerido) : ''])
      )
    );
    // Inicializar categoría solo para items nuevos, preservando selección actual.
    setCategorias((prev) =>
      Object.fromEntries(datos.map((p) => [p.id, prev[p.id] ?? 'Sin categoría']))
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const confirmar = async (p: Pendiente) => {
    const monto = normalizarMonto(montos[p.id] ?? '');
    if (monto === null) return;
    await confirmarPendiente(p.id, {
      monto,
      comercio: comercios[p.id]?.trim() || null,
      categoria: categorias[p.id] ?? 'Sin categoría',
    });
    await cargar();
  };

  const descartar = async (p: Pendiente) => {
    await descartarPendiente(p.id);
    await cargar();
  };

  return (
    <SafeAreaView style={e.pantalla} edges={[]}>
      <Cabecera seccion="Por confirmar" />
      <FlatList
        data={items}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={e.lista}
        ListEmptyComponent={
          <Vacio
            icono="checkmark-circle-outline"
            titulo="Nada por confirmar"
            detalle="Acá van a llegar las notificaciones bancarias que Piggy Eye no logre interpretar por sí solo."
          />
        }
        renderItem={({ item }) => {
          const montoValido = normalizarMonto(montos[item.id] ?? '') !== null;
          const categoriaActual = categorias[item.id] ?? 'Sin categoría';

          return (
            <Tarjeta style={e.tarjeta}>
              <Text style={e.meta}>
                {item.banco ?? 'Banco desconocido'} · {fechaLegible(item.fecha)}
              </Text>

              <Text style={e.textoOriginal}>{item.texto_original}</Text>

              <View style={e.campos}>
                <View style={e.campo}>
                  <Text style={e.etiqueta}>Monto</Text>
                  <TextInput
                    value={montos[item.id] ?? ''}
                    onChangeText={(v) =>
                      setMontos((prev) => ({ ...prev, [item.id]: v }))
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colores.textoTenue}
                    style={e.entrada}
                  />
                </View>
                <View style={[e.campo, { flex: 1.4 }]}>
                  <Text style={e.etiqueta}>Comercio</Text>
                  <TextInput
                    value={comercios[item.id] ?? ''}
                    onChangeText={(v) =>
                      setComercios((prev) => ({ ...prev, [item.id]: v }))
                    }
                    placeholder="Opcional"
                    placeholderTextColor={colores.textoTenue}
                    style={e.entrada}
                  />
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={e.etiqueta}>Categoría</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={e.chips}
                >
                  {CATEGORIAS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() =>
                        setCategorias((prev) => ({ ...prev, [item.id]: c }))
                      }
                      style={[e.chip, categoriaActual === c && e.chipActivo]}
                    >
                      <Text
                        style={[
                          e.chipTexto,
                          categoriaActual === c && e.chipTextoActivo,
                        ]}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {montoValido && (
                <Text style={e.previsualizacion}>
                  Se registrará {formatearCOP(normalizarMonto(montos[item.id])!)} en{' '}
                  {categoriaActual}
                </Text>
              )}

              <View style={e.acciones}>
                <View style={{ flex: 1 }}>
                  <Boton
                    texto="Registrar"
                    alPresionar={() => confirmar(item)}
                    deshabilitado={!montoValido}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Boton
                    texto="No era un gasto"
                    variante="secundario"
                    alPresionar={() => descartar(item)}
                  />
                </View>
              </View>
            </Tarjeta>
          );
        }}
      />
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  lista: { padding: espacio.md, gap: espacio.md, paddingBottom: espacio.xl },
  tarjeta: { gap: espacio.sm },
  meta: { ...tipografia.menudo, color: colores.textoTenue },
  textoOriginal: {
    ...tipografia.cuerpo,
    color: colores.texto,
    backgroundColor: colores.fondo,
    padding: espacio.sm,
    borderRadius: radio.sm,
    lineHeight: 20,
  },
  campos: { flexDirection: 'row', gap: espacio.sm },
  campo: { flex: 1, gap: 4 },
  etiqueta: { ...tipografia.menudo, color: colores.textoSuave },
  entrada: {
    ...tipografia.cuerpo,
    color: colores.texto,
    backgroundColor: colores.superficieAlta,
    borderRadius: radio.sm,
    paddingHorizontal: espacio.sm,
    paddingVertical: 10,
  },
  previsualizacion: { ...tipografia.menudo, color: colores.acento },
  acciones: { flexDirection: 'row', gap: espacio.sm, marginTop: espacio.xs },

  chips: { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radio.sm,
    backgroundColor: colores.superficieAlta,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  chipActivo: { backgroundColor: colores.acento, borderColor: colores.acento },
  chipTexto: { ...tipografia.menudo, color: colores.textoSuave },
  chipTextoActivo: { color: colores.fondo, fontWeight: '600' },
});
