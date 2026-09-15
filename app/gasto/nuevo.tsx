/** Registro manual de gastos e ingresos — efectivo y virtual. */

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
import { Ionicons } from '@expo/vector-icons';

import { colores, espacio, radio, tipografia } from '../../src/ui/tema';
import { Boton } from '../../src/ui/componentes';
import { formatearCOP, normalizarMonto } from '../../src/parser/monto';
import { crearGasto, CATEGORIAS, CATEGORIAS_INGRESO } from '../../src/db/gastos';

type Tipo = 'gasto' | 'ingreso';
type Origen = 'efectivo' | 'virtual';

export default function NuevoMovimiento() {
  const router = useRouter();

  const [tipo, setTipo] = useState<Tipo>('gasto');
  const [origen, setOrigen] = useState<Origen>('efectivo');
  const [monto, setMonto] = useState('');
  const [comercio, setComercio] = useState('');
  const [banco, setBanco] = useState('');
  const [categoria, setCategoria] = useState<string>('Sin categoría');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const valor = normalizarMonto(monto);
  const esIngreso = tipo === 'ingreso';
  const colorActivo = esIngreso ? colores.ingreso : colores.acento;
  const cats = esIngreso ? CATEGORIAS_INGRESO : CATEGORIAS;

  // Al cambiar tipo, resetear categoría si no existe en la nueva lista.
  const cambiarTipo = (t: Tipo) => {
    setTipo(t);
    setCategoria('Sin categoría');
  };

  const guardar = async () => {
    if (valor === null) {
      Alert.alert('Falta el monto', esIngreso ? '¿Cuánto recibiste?' : '¿Cuánto gastaste?');
      return;
    }
    setGuardando(true);
    await crearGasto({
      monto: valor,
      tipo,
      comercio: comercio.trim() || null,
      banco: origen === 'virtual' ? (banco.trim() || null) : null,
      categoria,
      nota: nota.trim() || null,
      origen: 'manual',
    });
    router.back();
  };

  return (
    <SafeAreaView style={e.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">

        {/* Cabecera con cancelar */}
        <View style={e.cabecera}>
          <Pressable onPress={() => router.back()} style={e.cancelar}>
            <Ionicons name="close" size={22} color={colores.textoSuave} />
          </Pressable>
          <Text style={e.tituloCabecera}>Nuevo movimiento</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Selector Gasto / Ingreso */}
        <View style={e.selector}>
          <Pressable
            onPress={() => cambiarTipo('gasto')}
            style={[e.opcion, tipo === 'gasto' && { ...e.opcionActiva, borderColor: colores.acento }]}
          >
            <Ionicons
              name="arrow-up-circle"
              size={20}
              color={tipo === 'gasto' ? colores.acento : colores.textoTenue}
            />
            <Text style={[e.opcionTexto, tipo === 'gasto' && { color: colores.acento, fontWeight: '600' }]}>
              Gasto
            </Text>
          </Pressable>
          <Pressable
            onPress={() => cambiarTipo('ingreso')}
            style={[e.opcion, tipo === 'ingreso' && { ...e.opcionActiva, borderColor: colores.ingreso }]}
          >
            <Ionicons
              name="arrow-down-circle"
              size={20}
              color={tipo === 'ingreso' ? colores.ingreso : colores.textoTenue}
            />
            <Text style={[e.opcionTexto, tipo === 'ingreso' && { color: colores.ingreso, fontWeight: '600' }]}>
              Ingreso
            </Text>
          </Pressable>
        </View>

        {/* Selector Efectivo / Virtual */}
        <View style={e.selector}>
          <Pressable
            onPress={() => setOrigen('efectivo')}
            style={[e.opcion, origen === 'efectivo' && { ...e.opcionActiva, borderColor: colorActivo }]}
          >
            <Ionicons
              name="cash-outline"
              size={18}
              color={origen === 'efectivo' ? colorActivo : colores.textoTenue}
            />
            <Text style={[e.opcionTexto, origen === 'efectivo' && { color: colorActivo, fontWeight: '600' }]}>
              Efectivo
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setOrigen('virtual')}
            style={[e.opcion, origen === 'virtual' && { ...e.opcionActiva, borderColor: colorActivo }]}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={18}
              color={origen === 'virtual' ? colorActivo : colores.textoTenue}
            />
            <Text style={[e.opcionTexto, origen === 'virtual' && { color: colorActivo, fontWeight: '600' }]}>
              Virtual / Banco
            </Text>
          </Pressable>
        </View>

        {/* Campo de monto grande */}
        <View style={e.campoMonto}>
          <Text style={[e.signo, { color: colorActivo }]}>{esIngreso ? '+' : '−'}</Text>
          <TextInput
            value={monto}
            onChangeText={setMonto}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colores.textoTenue}
            style={[e.entradaMonto, { color: colorActivo }]}
            autoFocus
          />
        </View>
        {valor !== null && (
          <Text style={e.previsualizacion}>{formatearCOP(valor)}</Text>
        )}

        {/* Banco / fuente (solo en virtual) */}
        {origen === 'virtual' && (
          <View style={{ gap: 6 }}>
            <Text style={e.etiqueta}>{esIngreso ? 'Banco o app de origen' : 'Banco o app de pago'}</Text>
            <TextInput
              value={banco}
              onChangeText={setBanco}
              placeholder="Nequi, Bancolombia, Daviplata…"
              placeholderTextColor={colores.textoTenue}
              style={e.entrada}
            />
          </View>
        )}

        {/* Comercio / fuente */}
        <View style={{ gap: 6 }}>
          <Text style={e.etiqueta}>{esIngreso ? '¿De quién o dónde?' : '¿En dónde?'}</Text>
          <TextInput
            value={comercio}
            onChangeText={setComercio}
            placeholder="Opcional"
            placeholderTextColor={colores.textoTenue}
            style={e.entrada}
          />
        </View>

        {/* Categoría */}
        <View style={{ gap: espacio.sm }}>
          <Text style={e.etiqueta}>Categoría</Text>
          <View style={e.chips}>
            {cats.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategoria(c)}
                style={[
                  e.chip,
                  categoria === c && { backgroundColor: colorActivo, borderColor: colorActivo },
                ]}
              >
                <Text style={[e.chipTexto, categoria === c && e.chipTextoActivo]}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Nota */}
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
          texto={esIngreso ? 'Registrar ingreso' : 'Guardar gasto'}
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

  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: espacio.xs,
  },
  cancelar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colores.superficieAlta,
  },
  tituloCabecera: { ...tipografia.etiqueta, fontSize: 15, color: colores.texto },

  selector: {
    flexDirection: 'row',
    gap: espacio.sm,
  },
  opcion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radio.sm,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  opcionActiva: {
    backgroundColor: colores.fondo,
    borderWidth: 2,
  },
  opcionTexto: { ...tipografia.etiqueta, color: colores.textoTenue },

  campoMonto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: espacio.sm,
    gap: 4,
  },
  signo: { fontSize: 36, fontWeight: '300', lineHeight: 48 },
  entradaMonto: {
    ...tipografia.cifraGrande,
    textAlign: 'center',
    minWidth: 140,
  },
  previsualizacion: {
    ...tipografia.menudo,
    color: colores.textoTenue,
    textAlign: 'center',
    marginTop: -espacio.sm,
  },

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
  chipTexto: { ...tipografia.menudo, color: colores.textoSuave },
  chipTextoActivo: { color: colores.fondo, fontWeight: '600' },
});
