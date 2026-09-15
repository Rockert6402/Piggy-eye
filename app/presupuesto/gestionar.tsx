/** Pantalla para que el usuario defina sus presupuestos por categoría. */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colores, espacio, radio, tipografia } from '../../src/ui/tema';
import { Boton, Tarjeta } from '../../src/ui/componentes';
import { formatearCOP, normalizarMonto } from '../../src/parser/monto';
import { CATEGORIAS } from '../../src/db/gastos';
import {
  listarPresupuestos,
  guardarPresupuesto,
  eliminarPresupuesto,
  type Presupuesto,
} from '../../src/db/presupuestos';

export default function GestionarPresupuestos() {
  const router = useRouter();
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [montoEdicion, setMontoEdicion] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [montoNuevo, setMontoNuevo] = useState('');

  const cargar = useCallback(async () => {
    const datos = await listarPresupuestos();
    setPresupuestos(datos);
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const categoriasSinPresupuesto = CATEGORIAS.filter(
    (c) => !presupuestos.some((p) => p.categoria === c)
  );

  const guardar = async (categoria: string, monto: string) => {
    const valor = normalizarMonto(monto);
    if (valor === null) {
      Alert.alert('Monto inválido', 'Ingresa una cifra mayor que cero.');
      return;
    }
    await guardarPresupuesto(categoria, valor);
    setEditando(null);
    setAgregando(false);
    setMontoNuevo('');
    setCategoriaSeleccionada('');
    await cargar();
  };

  const eliminar = (categoria: string) => {
    Alert.alert(
      `¿Eliminar presupuesto de ${categoria}?`,
      'Se borrará el límite pero no los gastos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await eliminarPresupuesto(categoria);
            await cargar();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">

        <View style={e.cabecera}>
          <Pressable onPress={() => router.back()} style={e.volver}>
            <Ionicons name="arrow-back" size={22} color={colores.acento} />
          </Pressable>
          <Text style={e.titulo}>Presupuestos</Text>
          <View style={{ width: 36 }} />
        </View>

        <Text style={e.descripcion}>
          Define cuánto quieres gastar por categoría cada mes. Piggy Eye te avisará cuando te estés pasando.
        </Text>

        {/* Lista de presupuestos existentes */}
        {presupuestos.length > 0 && (
          <Tarjeta style={e.bloque}>
            {presupuestos.map((p, i) => (
              <View key={p.categoria}>
                {i > 0 && <View style={e.separador} />}
                {editando === p.categoria ? (
                  <View style={e.filaEdicion}>
                    <Text style={e.categoriaLabel}>{p.categoria}</Text>
                    <TextInput
                      value={montoEdicion}
                      onChangeText={setMontoEdicion}
                      keyboardType="numeric"
                      placeholder={String(p.limite)}
                      placeholderTextColor={colores.textoTenue}
                      style={e.inputEdicion}
                      autoFocus
                    />
                    <Pressable onPress={() => guardar(p.categoria, montoEdicion)} style={e.btnGuardar}>
                      <Ionicons name="checkmark" size={20} color={colores.ingreso} />
                    </Pressable>
                    <Pressable onPress={() => setEditando(null)} style={e.btnCancelar}>
                      <Ionicons name="close" size={20} color={colores.textoTenue} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={e.fila}>
                    <Text style={e.categoriaLabel}>{p.categoria}</Text>
                    <Text style={e.limiteLabel}>{formatearCOP(p.limite)}/mes</Text>
                    <Pressable
                      onPress={() => { setEditando(p.categoria); setMontoEdicion(String(p.limite)); }}
                      style={e.btnIcono}
                    >
                      <Ionicons name="pencil-outline" size={18} color={colores.textoSuave} />
                    </Pressable>
                    <Pressable onPress={() => eliminar(p.categoria)} style={e.btnIcono}>
                      <Ionicons name="trash-outline" size={18} color={colores.peligro} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </Tarjeta>
        )}

        {/* Agregar nuevo presupuesto */}
        {categoriasSinPresupuesto.length > 0 && (
          <>
            {!agregando ? (
              <Boton
                texto="Agregar categoría"
                variante="secundario"
                alPresionar={() => setAgregando(true)}
              />
            ) : (
              <Tarjeta style={e.bloque}>
                <Text style={e.etiqueta}>Categoría</Text>
                <View style={e.chips}>
                  {categoriasSinPresupuesto.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCategoriaSeleccionada(c)}
                      style={[
                        e.chip,
                        categoriaSeleccionada === c && e.chipActivo,
                      ]}
                    >
                      <Text style={[e.chipTexto, categoriaSeleccionada === c && e.chipTextoActivo]}>
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {categoriaSeleccionada !== '' && (
                  <>
                    <Text style={e.etiqueta}>Límite mensual</Text>
                    <TextInput
                      value={montoNuevo}
                      onChangeText={setMontoNuevo}
                      keyboardType="numeric"
                      placeholder="Ej: 200000"
                      placeholderTextColor={colores.textoTenue}
                      style={e.entrada}
                      autoFocus
                    />
                    {normalizarMonto(montoNuevo) !== null && (
                      <Text style={e.previsualizacion}>{formatearCOP(normalizarMonto(montoNuevo)!)}/mes</Text>
                    )}
                  </>
                )}

                <View style={e.botonesNuevo}>
                  <View style={{ flex: 1 }}>
                    <Boton
                      texto="Guardar"
                      alPresionar={() => guardar(categoriaSeleccionada, montoNuevo)}
                      deshabilitado={!categoriaSeleccionada || normalizarMonto(montoNuevo) === null}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Boton
                      texto="Cancelar"
                      variante="secundario"
                      alPresionar={() => {
                        setAgregando(false);
                        setCategoriaSeleccionada('');
                        setMontoNuevo('');
                      }}
                    />
                  </View>
                </View>
              </Tarjeta>
            )}
          </>
        )}

        {presupuestos.length === 0 && !agregando && (
          <Text style={e.vacio}>
            Aún no tienes presupuestos. Agrega uno para empezar a controlar tus gastos por categoría.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.md, gap: espacio.md, paddingBottom: espacio.xl },

  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  volver: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titulo: { ...tipografia.etiqueta, fontSize: 16, color: colores.texto },

  descripcion: { ...tipografia.menudo, color: colores.textoSuave, lineHeight: 18 },

  bloque: { gap: espacio.sm },
  separador: { height: 1, backgroundColor: colores.borde, marginVertical: 4 },

  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaEdicion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoriaLabel: { ...tipografia.etiqueta, color: colores.texto, flex: 1 },
  limiteLabel: { ...tipografia.menudo, color: colores.textoSuave, fontVariant: ['tabular-nums'] },
  btnIcono: { padding: 4 },
  btnGuardar: { padding: 4 },
  btnCancelar: { padding: 4 },
  inputEdicion: {
    ...tipografia.cuerpo,
    color: colores.texto,
    backgroundColor: colores.superficieAlta,
    borderRadius: radio.sm,
    paddingHorizontal: espacio.sm,
    paddingVertical: 6,
    width: 100,
    fontVariant: ['tabular-nums'],
  },

  etiqueta: { ...tipografia.etiqueta, color: colores.textoSuave },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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

  entrada: {
    ...tipografia.cuerpo,
    color: colores.texto,
    backgroundColor: colores.superficieAlta,
    borderRadius: radio.sm,
    paddingHorizontal: espacio.md,
    paddingVertical: 12,
  },
  previsualizacion: { ...tipografia.menudo, color: colores.acento },
  botonesNuevo: { flexDirection: 'row', gap: espacio.sm },

  vacio: { ...tipografia.menudo, color: colores.textoTenue, textAlign: 'center', paddingVertical: espacio.xl },
});
