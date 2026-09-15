# Piggy Eye

App Android de control de gastos personales que registra automáticamente las
compras leyendo las notificaciones del banco, con registro manual para efectivo
y un resumen por día, semana y mes.

---

## Lo primero que tienen que saber

Este código **no se ha ejecutado en un dispositivo**. Está escrito, tipado y el
parser tiene pruebas que pasan, pero nadie lo ha compilado todavía. Cuenten con
dedicarle una sesión a dejar el build andando antes de ver la primera pantalla.

Hay tres cosas que pueden morderlos, en orden de probabilidad:

**1. Los patrones de los bancos son una hipótesis, no un hecho.**
Las expresiones regulares de `src/parser/bancos.ts` fueron escritas imitando el
formato que *suelen* usar estos bancos, pero no se copiaron de notificaciones
reales porque no existe documentación pública de eso. Los *package names* de
Android tampoco están verificados. Es muy probable que el primer día no capturen
nada. El plan para arreglarlo está abajo, en "Cómo construir los patrones reales".

**2. Expo Go no sirve.** El lector de notificaciones es código nativo. Necesitan
un *development build*. Si intentan correr esto en Expo Go va a fallar al
importar el módulo y no van a entender por qué.

**3. El emulador tampoco sirve bien.** Para probar de verdad necesitan un
teléfono Android físico con la app del banco instalada y una compra real.

## Instalación

```bash
npm install

# Ajusta las versiones de las dependencias a las que tu SDK de Expo espera.
# Háganlo: las versiones del package.json son una referencia y pueden estar
# desactualizadas respecto al SDK que instalen.
npx expo install --fix

# Genera la carpeta android/ nativa
npx expo prebuild --platform android --clean

# Compila e instala en el teléfono conectado
npx expo run:android
```

Después del `prebuild`, **verifiquen el manifiesto**. Abran
`android/app/src/main/AndroidManifest.xml` y confirmen que el servicio del
lector de notificaciones quedó declarado, con su `BIND_NOTIFICATION_LISTENER_SERVICE`.
El *manifest merger* de Gradle debería inyectarlo automáticamente desde el
módulo, pero si por alguna razón no aparece, el permiso nunca se va a poder
otorgar y la captura no va a funcionar sin ningún mensaje de error claro.

No incluí un config plugin de Expo para forzar esa declaración a propósito: si
el merger ya la inserta, declararla otra vez rompe el build con un conflicto de
elementos duplicados. Es mejor verificar primero y solo escribir el plugin si
hace falta.

Ya instalada, la app pide activar el permiso desde Ajustes de Android. Hay que
hacerlo a mano una vez: Android no permite pedirlo con un diálogo normal.

## Cómo construir los patrones reales

Esta es la tarea central del proyecto y es la parte que no existe en ningún
repositorio público. El flujo:

1. Instalen la app y activen el permiso.
2. Hagan compras reales pequeñas con cada banco del equipo.
3. Abran **Ajustes → Registro técnico**. Ahí aparece cada notificación que pasó
   por el lector: el *package name* exacto, el texto crudo y qué decidió hacer
   la app con ella.
4. Copien el texto real y el package real a `src/parser/bancos.ts`.
5. Agreguen ese caso a `src/parser/parser.test.ts` y corran `npm test`.

El registro técnico guarda las últimas 300 notificaciones y se poda solo. Una
notificación que aparece como `descartada` con motivo `paquete-desconocido` es
la señal más común: el package name está mal escrito en el diccionario.

Vayan guardando ese corpus de textos reales aparte del código. Es la evidencia
de proceso que pide el acta y es lo que van a necesitar cuando un banco cambie
el formato a mitad del semestre.

## Arquitectura

```
index.js                      registra el headless task (tiene que ir primero)
app/                          pantallas, enrutadas por archivo con expo-router
  (tabs)/index.tsx            HU-05 dashboard
  (tabs)/gastos.tsx           lista de movimientos
  (tabs)/pendientes.tsx       HU-04 confirmación manual
  (tabs)/ajustes.tsx          HU-07 permiso + registro técnico
  gasto/nuevo.tsx             HU-03 registro manual
  gasto/[id].tsx              HU-10 detalle, HU-08 edición, HU-09 eliminación
src/
  parser/                     el corazón: filtros y extracción
    bancos.ts                 diccionario de patrones por entidad
    filtros.ts                HU-02 descarte de falsos positivos
    monto.ts                  normalización de pesos colombianos
    index.ts                  orquestación
  db/                         SQLite, fuente de verdad
  notificaciones/             puente con Android
  sync/cola.ts                HU-06, apagada por defecto
  ui/                         tokens visuales y componentes
```

El flujo de una notificación:

```
Android → headless task → filtrar() → ¿banco conocido? ─ no → descartar
                                    → ¿es publicidad?  ─ sí → descartar
                                    → parsear()
                                        ├ acierta  → gasto en SQLite
                                        └ no       → cola de pendientes (HU-04)
```

Todo se escribe en SQLite primero. Esa es la decisión que resuelve el riesgo #3
del acta: si no hay internet, no pasa nada, porque nunca hubo internet en la
ruta crítica.

## Decisiones que tomamos y por qué

**Local primero, nube opcional.** El acta dice que no hay presupuesto para
servicios de pago y que la sincronización multi-dispositivo está fuera de
alcance. La app funciona entera contra SQLite. `src/sync/cola.ts` deja la puerta
abierta: implementan `AdaptadorRemoto` contra Supabase o Firebase y llaman a
`configurarAdaptador()` una vez al arrancar. Nada más cambia.

**Deduplicación por huella.** Android reenvía la misma notificación cuando la
app del banco la actualiza. Sin defensa, un gasto se registraría dos o tres
veces. Combinamos monto, comercio y una ventana de dos minutos. El costo: dos
compras reales idénticas seguidas se cuentan como una. Es el intercambio
correcto, porque un gasto de menos se nota y se corrige, mientras que un
duplicado silencioso infla el total del mes sin que nadie se dé cuenta.
Los gastos manuales no se deduplican.

**Nada se pierde en silencio.** Si el parser no entiende una notificación de un
banco conocido, no la bota: la manda a la cola de pendientes con el monto que
alcanzó a leer. Es la mitigación del riesgo #1 del acta, implementada.

## Pruebas

```bash
npm test
```

El parser tiene 25 casos cubriendo normalización de montos, filtrado de
publicidad y alertas de seguridad, extracción por banco, distinción entre gasto
e ingreso, y la ruta de pendientes. Todos pasan. Los textos son sintéticos y hay
que irlos reemplazando por reales.

## Lo que falta

- Validar los patrones contra notificaciones auténticas (tarea #1).
- Verificar los package names de cada banco.
- Categorización automática. Está fuera de alcance según el acta y así debería
  quedarse: es un pozo sin fondo para el tiempo que tienen.
- Exportar a CSV, que probablemente les pidan en la demo.
