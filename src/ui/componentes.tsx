import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colores, espacio, radio, tipografia, fechaLegible } from './tema';
import { formatearCOP } from '../parser/monto';
import type { Gasto } from '../db/gastos';

export function Tarjeta({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[e.tarjeta, style]}>{children}</View>;
}

/** Estado vacío: una invitación a actuar, no un mensaje de error. */
export function Vacio({
  titulo,
  detalle,
  accion,
}: {
  titulo: string;
  detalle: string;
  accion?: { texto: string; alPresionar: () => void };
}) {
  return (
    <View style={e.vacio}>
      <Text style={e.vacioTitulo}>{titulo}</Text>
      <Text style={e.vacioDetalle}>{detalle}</Text>
      {accion && (
        <Boton texto={accion.texto} alPresionar={accion.alPresionar} />
      )}
    </View>
  );
}

export function Boton({
  texto,
  alPresionar,
  variante = 'principal',
  deshabilitado,
}: {
  texto: string;
  alPresionar: () => void;
  variante?: 'principal' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
}) {
  const fondo =
    variante === 'principal'
      ? colores.acento
      : variante === 'peligro'
        ? 'transparent'
        : colores.superficieAlta;
  const color =
    variante === 'principal'
      ? colores.fondo
      : variante === 'peligro'
        ? colores.peligro
        : colores.texto;

  return (
    <Pressable
      onPress={alPresionar}
      disabled={deshabilitado}
      accessibilityRole="button"
      style={({ pressed }) => [
        e.boton,
        { backgroundColor: fondo, opacity: deshabilitado ? 0.4 : pressed ? 0.75 : 1 },
        variante === 'peligro' && { borderWidth: 1, borderColor: colores.peligro },
      ]}
    >
      <Text style={[e.botonTexto, { color }]}>{texto}</Text>
    </Pressable>
  );
}

/** Fila de la lista de gastos. */
export function FilaGasto({
  gasto,
  alPresionar,
}: {
  gasto: Gasto;
  alPresionar: () => void;
}) {
  const esIngreso = gasto.tipo === 'ingreso';

  return (
    <Pressable
      onPress={alPresionar}
      accessibilityRole="button"
      style={({ pressed }) => [e.fila, pressed && { backgroundColor: colores.superficieAlta }]}
    >
      <View style={e.filaIzquierda}>
        <Text style={e.filaComercio} numberOfLines={1}>
          {gasto.comercio || 'Sin comercio'}
        </Text>
        <Text style={e.filaMeta} numberOfLines={1}>
          {fechaLegible(gasto.fecha)}
          {gasto.banco ? ` · ${gasto.banco}` : ''}
          {gasto.origen === 'manual' ? ' · a mano' : ''}
        </Text>
      </View>
      <Text
        style={[
          e.filaMonto,
          esIngreso && { color: colores.ingreso },
        ]}
      >
        {esIngreso ? '+' : ''}
        {formatearCOP(gasto.monto)}
      </Text>
    </Pressable>
  );
}

const e = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: radio.md,
    padding: espacio.md,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  vacio: {
    alignItems: 'center',
    paddingVertical: espacio.xl,
    paddingHorizontal: espacio.lg,
    gap: espacio.sm,
  },
  vacioTitulo: { ...tipografia.titulo, color: colores.texto, textAlign: 'center' },
  vacioDetalle: {
    ...tipografia.cuerpo,
    color: colores.textoSuave,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 21,
    marginBottom: espacio.sm,
  },
  boton: {
    paddingVertical: 13,
    paddingHorizontal: espacio.lg,
    borderRadius: radio.sm,
    alignItems: 'center',
  },
  botonTexto: { ...tipografia.etiqueta, fontSize: 15 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: espacio.md,
    gap: espacio.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  filaIzquierda: { flex: 1, gap: 3 },
  filaComercio: { ...tipografia.cuerpo, color: colores.texto, fontWeight: '500' },
  filaMeta: { ...tipografia.menudo, color: colores.textoTenue },
  filaMonto: { ...tipografia.cifra, color: colores.texto },
});
