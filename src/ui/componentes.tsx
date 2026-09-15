import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colores, espacio, radio, tipografia, fechaLegible } from './tema';
import { formatearCOP } from '../parser/monto';
import type { Gasto } from '../db/gastos';

/**
 * Barra superior estilo WhatsApp.
 * Muestra "Piggy Eye" en acento como título de la app, el nombre de la
 * sección como subtítulo, y un botón de acción opcional a la derecha.
 */
export function Cabecera({
  seccion,
  accion,
}: {
  seccion: string;
  accion?: { icono: React.ComponentProps<typeof Ionicons>['name']; alPresionar: () => void };
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[cab.contenedor, { paddingTop: insets.top }]}>
      <View style={cab.barra}>
        <View style={cab.textos}>
          <Text style={cab.appNombre}>Piggy Eye</Text>
          <Text style={cab.seccion}>{seccion}</Text>
        </View>
        {accion && (
          <Pressable
            onPress={accion.alPresionar}
            accessibilityRole="button"
            style={({ pressed }) => [cab.botonAccion, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name={accion.icono} size={24} color={colores.acento} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const cab = StyleSheet.create({
  contenedor: {
    backgroundColor: colores.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  barra: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacio.md,
  },
  textos: { flex: 1, gap: 1 },
  appNombre: {
    fontSize: 22,
    fontWeight: '700',
    color: colores.acento,
    letterSpacing: -0.5,
  },
  seccion: {
    fontSize: 11,
    fontWeight: '500',
    color: colores.textoTenue,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  botonAccion: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});

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
  icono,
  accion,
}: {
  titulo: string;
  detalle: string;
  icono?: React.ComponentProps<typeof Ionicons>['name'];
  accion?: { texto: string; alPresionar: () => void };
}) {
  return (
    <View style={e.vacio}>
      {icono && (
        <View style={e.vacioIconoFondo}>
          <Ionicons name={icono} size={32} color={colores.textoTenue} />
        </View>
      )}
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
  const escala = React.useRef(new Animated.Value(1)).current;

  const enPresionar = () => {
    Animated.spring(escala, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start();
  };
  const alSoltar = () => {
    Animated.spring(escala, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
    if (!deshabilitado) alPresionar();
  };

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
    <Animated.View style={{ transform: [{ scale: escala }], opacity: deshabilitado ? 0.4 : 1 }}>
      <Pressable
        onPressIn={enPresionar}
        onPressOut={alSoltar}
        disabled={deshabilitado}
        accessibilityRole="button"
        style={[
          e.boton,
          { backgroundColor: fondo },
          variante === 'peligro' && { borderWidth: 1, borderColor: colores.peligro },
        ]}
      >
        <Text style={[e.botonTexto, { color }]}>{texto}</Text>
      </Pressable>
    </Animated.View>
  );
}

const CATEGORIA_COLOR: Record<string, string> = {
  Alimentación: '#6FD0A8',
  Transporte: '#70B8FF',
  Salud: '#E8735F',
  Entretenimiento: '#C97EF5',
  Ropa: '#F2A0B5',
  Hogar: '#E9B949',
  Educación: '#5BC8D4',
  Servicios: '#9FB6BC',
  'Sin categoría': '#6B8992',
};

/** Fila de la lista de gastos. */
export function FilaGasto({
  gasto,
  alPresionar,
}: {
  gasto: Gasto;
  alPresionar: () => void;
}) {
  const esIngreso = gasto.tipo === 'ingreso';
  const franjaColor = esIngreso ? colores.ingreso : colores.acentoProfundo;
  const catColor = CATEGORIA_COLOR[gasto.categoria ?? ''] ?? colores.textoTenue;

  return (
    <Pressable
      onPress={alPresionar}
      accessibilityRole="button"
      style={({ pressed }) => [e.fila, pressed && { backgroundColor: colores.superficieAlta }]}
    >
      {/* Franja de color izquierda según tipo */}
      <View style={[e.franja, { backgroundColor: franjaColor }]} />

      <View style={e.filaContenido}>
        <View style={e.filaIzquierda}>
          <Text style={e.filaComercio} numberOfLines={1}>
            {gasto.comercio || 'Sin comercio'}
          </Text>
          <View style={e.filaMeta}>
            {/* Pill de categoría */}
            <View style={[e.catPill, { borderColor: catColor }]}>
              <View style={[e.catPunto, { backgroundColor: catColor }]} />
              <Text style={[e.catTexto, { color: catColor }]} numberOfLines={1}>
                {gasto.categoria ?? 'Sin categoría'}
              </Text>
            </View>
            <Text style={e.metaTexto} numberOfLines={1}>
              {fechaLegible(gasto.fecha)}
              {gasto.banco ? ` · ${gasto.banco}` : ''}
              {gasto.origen === 'manual' ? ' · manual' : ''}
            </Text>
          </View>
        </View>
        <Text style={[e.filaMonto, esIngreso && { color: colores.ingreso }]}>
          {esIngreso ? '+' : '−'}{formatearCOP(gasto.monto)}
        </Text>
      </View>
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
  vacioIconoFondo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colores.superficieAlta,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.xs,
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
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
    minHeight: 64,
  },
  franja: {
    width: 3,
    borderRadius: 2,
    marginVertical: 10,
    marginLeft: espacio.md,
  },
  filaContenido: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: espacio.sm,
    gap: espacio.sm,
  },
  filaIzquierda: { flex: 1, gap: 5 },
  filaComercio: { ...tipografia.cuerpo, color: colores.texto, fontWeight: '500' },
  filaMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaTexto: { ...tipografia.menudo, color: colores.textoTenue, flexShrink: 1 },

  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  catPunto: { width: 5, height: 5, borderRadius: 3 },
  catTexto: { fontSize: 10, fontWeight: '500' },

  filaMonto: { ...tipografia.cifra, color: colores.texto },
});
