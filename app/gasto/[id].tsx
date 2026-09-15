/**
 * HU-10 detalle, HU-08 edición y HU-09 eliminación.
 *
 * Una sola pantalla que arranca en modo lectura y se vuelve editable.
 * Separarlas en dos rutas obligaría a navegar de más para corregir un
 * comercio mal leído, que es justo lo que más va a pasar.
 */

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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colores, espacio, radio, tipografia, fechaLegible } from '../../src/ui/tema';
import { Boton, Tarjeta } from '../../src/ui/componentes';
import { formatearCOP, normalizarMonto } from '../../src/parser/monto';
import {
  obtenerGasto,
  editarGasto,
  eliminarGasto,
  CATEGORIAS,
  type Gasto,
} from '../../src/db/gastos';

const ORIGEN_LEGIBLE: Record<string, string> = {
  automatico: 'Detectado automáticamente',
  manual: 'Anotado a mano',
  confirmado: 'Confirmado por ti',
};

export default function DetalleGasto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const idNumero = Number(id);

  const [gasto, setGasto] = useState<Gasto | null>(null);
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState('');
  const [comercio, setComercio] = useState('');
  const [categoria, setCategoria] = useState<string>('Sin categoría');
  const [nota, setNota] = useState('');

  const cargar = useCallback(async () => {
    const datos = await obtenerGasto(idNumero);
    setGasto(datos);
    if (datos) {
      setMonto(String(datos.monto));
      setComercio(datos.comercio ?? '');
      setCategoria(datos.categoria);
      setNota(datos.nota ?? '');
    }
  }, [idNumero]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const guardar = async () => {
    const valor = normalizarMonto(monto);
    if (valor === null) {
      Alert.alert('Monto inválido', 'Escribe una cifra mayor que cero.');
      return;
    }
    await editarGasto(idNumero, {
      monto: valor,
      comercio: comercio.trim() || null,
      categoria,
      nota: nota.trim() || null,
    });
    setEditando(false);
    await cargar();
  };

  const confirmarEliminar = () => {
    Alert.alert(
      '¿Eliminar este movimiento?',
      'Se borra de este teléfono y no se puede recuperar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await eliminarGasto(idNumero);
            router.back();
          },
        },
      ]
    );
  };

  if (!gasto) {
    return (
      <SafeAreaView style={e.pantalla}>
        <Text style={e.noEncontrado}>Este movimiento ya no existe.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={e.contenido}>
        <Pressable onPress={() => router.back()} style={e.volver}>
          <Text style={e.volverTexto}>Volver</Text>
        </Pressable>

        {!editando ? (
          <>
            <View style={e.cabecera}>
              <Text
                style={[
                  e.montoGrande,
                  gasto.tipo === 'ingreso' && { color: colores.ingreso },
                ]}
              >
                {gasto.tipo === 'ingreso' ? '+' : ''}
                {formatearCOP(gasto.monto, true)}
              </Text>
              <Text style={e.comercioGrande}>
                {gasto.comercio || 'Sin comercio'}
              </Text>
              <Text style={e.fechaTexto}>{fechaLegible(gasto.fecha)}</Text>
            </View>

            <Tarjeta style={e.bloque}>
              <Dato etiqueta="Categoría" valor={gasto.categoria} />
              <Dato etiqueta="Origen" valor={ORIGEN_LEGIBLE[gasto.origen] ?? gasto.origen} />
              {gasto.banco && <Dato etiqueta="Banco" valor={gasto.banco} />}
              {gasto.nota && <Dato etiqueta="Nota" valor={gasto.nota} />}
              {gasto.editado_en && (
                <Dato etiqueta="Editado" valor={fechaLegible(gasto.editado_en)} />
              )}
            </Tarjeta>

            {gasto.texto_original && (
              <Tarjeta style={e.bloque}>
                <Text style={e.etiqueta}>Notificación original</Text>
                <Text style={e.original}>{gasto.texto_original}</Text>
                {gasto.regla_id && (
                  <Text style={e.regla}>Patrón aplicado: {gasto.regla_id}</Text>
                )}
              </Tarjeta>
            )}

            <Boton texto="Editar" alPresionar={() => setEditando(true)} />
            <Boton
              texto="Eliminar movimiento"
              variante="peligro"
              alPresionar={confirmarEliminar}
            />
          </>
        ) : (
          <>
            <Campo etiqueta="Monto" valor={monto} alCambiar={setMonto} numerico />
            <Campo etiqueta="Comercio" valor={comercio} alCambiar={setComercio} />

            <View style={{ gap: espacio.sm }}>
              <Text style={e.etiqueta}>Categoría</Text>
              <View style={e.chips}>
                {CATEGORIAS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCategoria(c)}
                    style={[e.chip, categoria === c && e.chipActivo]}
                  >
                    <Text
                      style={[e.chipTexto, categoria === c && e.chipTextoActivo]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Campo etiqueta="Nota" valor={nota} alCambiar={setNota} />

            <Boton texto="Guardar cambios" alPresionar={guardar} />
            <Boton
              texto="Cancelar"
              variante="secundario"
              alPresionar={() => {
                setEditando(false);
                cargar();
              }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={e.dato}>
      <Text style={e.datoEtiqueta}>{etiqueta}</Text>
      <Text style={e.datoValor}>{valor}</Text>
    </View>
  );
}

function Campo({
  etiqueta,
  valor,
  alCambiar,
  numerico,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  numerico?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={alCambiar}
        keyboardType={numerico ? 'numeric' : 'default'}
        placeholderTextColor={colores.textoTenue}
        style={e.entrada}
      />
    </View>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.md, gap: espacio.md, paddingBottom: espacio.xl },
  noEncontrado: { ...tipografia.cuerpo, color: colores.textoSuave, padding: espacio.lg },

  volver: { paddingVertical: espacio.xs },
  volverTexto: { ...tipografia.etiqueta, color: colores.acento },

  cabecera: { paddingVertical: espacio.lg, gap: 6 },
  montoGrande: { ...tipografia.cifraGrande, color: colores.acento },
  comercioGrande: { ...tipografia.titulo, fontSize: 18, color: colores.texto },
  fechaTexto: { ...tipografia.menudo, color: colores.textoTenue },

  bloque: { gap: espacio.sm },
  dato: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.md },
  datoEtiqueta: { ...tipografia.menudo, color: colores.textoSuave },
  datoValor: { ...tipografia.menudo, color: colores.texto, flexShrink: 1, textAlign: 'right' },

  etiqueta: { ...tipografia.etiqueta, color: colores.textoSuave },
  original: {
    ...tipografia.menudo,
    color: colores.texto,
    backgroundColor: colores.fondo,
    padding: espacio.sm,
    borderRadius: radio.sm,
    lineHeight: 18,
  },
  regla: { ...tipografia.menudo, color: colores.textoTenue },

  entrada: {
    ...tipografia.cuerpo,
    color: colores.texto,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.sm,
    paddingHorizontal: espacio.md,
    paddingVertical: 12,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radio.sm,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  chipActivo: { backgroundColor: colores.acento, borderColor: colores.acento },
  chipTexto: { ...tipografia.menudo, color: colores.textoSuave },
  chipTextoActivo: { color: colores.fondo, fontWeight: '600' },
});
