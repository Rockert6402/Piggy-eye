/** HU-03: registro manual de gasto en efectivo. */

import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colores, espacio, radio, tipografia } from '../../src/ui/tema';
import { Boton } from '../../src/ui/componentes';
import { formatearCOP, normalizarMonto } from '../../src/parser/monto';
import { crearGasto, CATEGORIAS } from '../../src/db/gastos';

export default function NuevoGasto() {
  const router = useRouter();
  const [monto, setMonto] = useState('');
  const [comercio, setComercio] = useState('');
  const [categoria, setCategoria] = useState<string>('Sin categoría');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const valor = normalizarMonto(monto);

  const guardar = async () => {
    if (valor === null) {
      Alert.alert('Falta el monto', 'Escribe cuánto gastaste.');
      return;
    }
    setGuardando(true);
    await crearGasto({
      monto: valor,
      comercio: comercio.trim() || null,
      categoria,
      nota: nota.trim() || null,
      origen: 'manual',
    });
    router.back();
  };

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={e.volver}>
          <Text style={e.volverTexto}>Cancelar</Text>
        </Pressable>

        <Text style={e.titulo}>Anotar un gasto</Text>
        <Text style={e.subtitulo}>
          Para lo que pagaste en efectivo, o cualquier compra que Piggy Eye no
          alcanzó a ver.
        </Text>

        <View style={e.campoMonto}>
          <TextInput
            value={monto}
            onChangeText={setMonto}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colores.textoTenue}
            style={e.entradaMonto}
            autoFocus
          />
          {valor !== null && (
            <Text style={e.previsualizacion}>{formatearCOP(valor)}</Text>
          )}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={e.etiqueta}>¿En dónde?</Text>
          <TextInput
            value={comercio}
            onChangeText={setComercio}
            placeholder="Opcional"
            placeholderTextColor={colores.textoTenue}
            style={e.entrada}
          />
        </View>

        <View style={{ gap: espacio.sm }}>
          <Text style={e.etiqueta}>Categoría</Text>
          <View style={e.chips}>
            {CATEGORIAS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategoria(c)}
                style={[e.chip, categoria === c && e.chipActivo]}
              >
                <Text style={[e.chipTexto, categoria === c && e.chipTextoActivo]}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={e.etiqueta}>Nota</Text>
          <TextInput
            value={nota}
            onChangeText={setNota}
            placeholder="Opcional"
            placeholderTextColor={colores.textoTenue}
            style={e.entrada}
            multiline
          />
        </View>

        <Boton
          texto="Guardar gasto"
          alPresionar={guardar}
          deshabilitado={valor === null || guardando}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.md, gap: espacio.md, paddingBottom: espacio.xl },
  volver: { paddingVertical: espacio.xs },
  volverTexto: { ...tipografia.etiqueta, color: colores.acento },
  titulo: { ...tipografia.titulo, color: colores.texto },
  subtitulo: { ...tipografia.menudo, color: colores.textoSuave, lineHeight: 18 },

  campoMonto: { alignItems: 'center', paddingVertical: espacio.lg, gap: espacio.xs },
  entradaMonto: {
    ...tipografia.cifraGrande,
    color: colores.acento,
    textAlign: 'center',
    minWidth: 180,
  },
  previsualizacion: { ...tipografia.menudo, color: colores.textoTenue },

  etiqueta: { ...tipografia.etiqueta, color: colores.textoSuave },
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
