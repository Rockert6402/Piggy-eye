# Piggy Eye

App Android de control de gastos personales. Registra automáticamente las
compras leyendo las notificaciones y los SMS del banco, permite anotar gastos
en efectivo y muestra un resumen por día, semana y mes.

Proyecto de **Gestión de Proyectos Ágiles** · Tecnológico de Antioquia · Grupo 3.

**Stack:** React Native 0.81 · Expo SDK 54 (development build) · expo-router ·
SQLite · TypeScript · Jest.

---

## Contenido

1. [Estado de las historias de usuario](#estado-de-las-historias-de-usuario)
2. [Requisitos](#requisitos)
3. [Instalación y primera ejecución](#instalación-y-primera-ejecución)
4. [Uso diario](#uso-diario)
5. [Servidor simulado (HU-06)](#servidor-simulado-hu-06)
6. [Pruebas](#pruebas)
7. [Arquitectura](#arquitectura)
8. [Cómo construir los patrones reales de los bancos](#cómo-construir-los-patrones-reales-de-los-bancos)
9. [Decisiones de diseño](#decisiones-de-diseño)
10. [Problemas comunes](#problemas-comunes)
11. [Pendientes](#pendientes)

---

## Estado de las historias de usuario

| HU | Historia | Código | Pruebas automáticas | Prueba en teléfono |
|----|----------|:------:|:-------------------:|:------------------:|
| HU-01 | Registro automático por notificación bancaria | ✅ | ✅ | ⏳ |
| HU-02 | Filtrado de notificaciones (falsos positivos) | ✅ | ✅ | ⏳ |
| HU-03 | Registro manual de gasto en efectivo | ✅ | — | ✅ |
| HU-04 | Confirmación manual cuando el parser falla | ✅ | ✅ | ⏳ |
| HU-05 | Dashboard por día, semana y mes | ✅ | ✅ | ✅ |
| HU-06 | Registro y sincronización sin conexión | ✅ (servidor simulado) | ✅ | ⏳ |
| HU-07 | Gestión del permiso de notificaciones | ✅ | — | ✅ |
| HU-08 / 09 / 10 | Editar, eliminar y ver detalle de un gasto | ✅ | — | ✅ |

Extra: exportar el extracto en **Excel, PDF o CSV**, presupuestos por
categoría y lectura de **SMS** bancarios.

> ⚠️ Los patrones de texto de cada banco son una **hipótesis**: se escribieron
> imitando el formato usual, no copiados de notificaciones reales. Hay que
> validarlos con compras reales (ver [más abajo](#cómo-construir-los-patrones-reales-de-los-bancos)).

---

## Requisitos

| Herramienta | Para qué | Notas |
|-------------|----------|-------|
| **Node.js LTS** (20.19+ o 22) | Instalar dependencias, Metro, servidor simulado | Probado con Node 22 |
| **Git** | Control de versiones | |
| **Android Studio** | Android SDK y JDK 17 para compilar | Trae el JDK en `Android Studio\jbr` |
| **Teléfono Android físico** | Probar la app | Con *depuración USB* activada |

**Expo Go no sirve** y el **emulador tampoco sirve bien**: el lector de
notificaciones es código nativo y para probar de verdad hace falta la app del
banco instalada y una compra real.

> Alternativa sin Android Studio: compilar en la nube con EAS
> (`npm i -g eas-cli` → `eas login` → `eas build --profile development --platform android`)
> e instalar el APK que devuelve.

---

## Instalación y primera ejecución

Pasos para Windows con PowerShell.

### 1. Permitir scripts de npm en PowerShell (una sola vez)

Si `npm` responde *"la ejecución de scripts está deshabilitada"*:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 2. Variables de entorno del Android SDK (una sola vez)

Instala Android Studio y deja que su asistente descargue el SDK. Luego:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
$p = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$p;$env:LOCALAPPDATA\Android\Sdk\platform-tools", "User")
```

**Cierra y vuelve a abrir la terminal** (o VS Code completo) y comprueba:

```powershell
adb version
adb devices   # el teléfono debe aparecer como "device"
```

### 3. Instalar, generar el proyecto nativo y compilar

```powershell
npm install
npx expo install --check                 # alinea versiones con el SDK 54
npm run prebuild                         # genera la carpeta android/
npm run android                          # compila e instala en el teléfono
```

La primera compilación tarda varios minutos.

> 💡 **Recomendado:** clona el repo **fuera de OneDrive** (por ejemplo en
> `C:\dev\Piggy-eye`). OneDrive bloquea archivos mientras sincroniza
> `node_modules` y Gradle, y las rutas largas rompen la compilación nativa.

### 4. Permisos dentro de la app

1. Acepta el permiso de **notificaciones** que pide al abrir (avisos de HU-01).
2. En **Ajustes**, activa el acceso a **notificaciones bancarias**. Android lo
   pide desde su propia pantalla de ajustes, no con un diálogo normal.
3. Opcional: activa la **lectura de SMS**.

---

## Uso diario

| Comando | Qué hace |
|---------|----------|
| `npm start` | Servidor de desarrollo (Metro) para la app ya instalada |
| `npm run android` | Recompila e instala. Solo hace falta si cambia algo nativo (nuevas librerías, `app.json`, plugins) |
| `npm run servidor` | Servidor simulado de sincronización (HU-06) |
| `npm test` | Pruebas automáticas |
| `npm run typecheck` | Revisión de tipos de TypeScript |

Con `npm start` corriendo, en la terminal `r` recarga la app. El teléfono y el
PC deben estar en la **misma red Wi-Fi**. Si el teléfono no logra conectarse,
usa el cable USB:

```powershell
npx expo start --dev-client --localhost
adb reverse tcp:8081 tcp:8081
```

---

## Servidor simulado (HU-06)

No hay backend real (el acta no tiene presupuesto para servicios pagos), así
que `servidor/index.js` hace de "nube". Es Node puro, sin dependencias.

```powershell
npm run servidor
```

- Abre **http://localhost:3001** en el PC para ver en vivo lo que llega del
  teléfono y cambiar el modo de falla.
- La app lo encuentra sola: usa el mismo PC que sirve Metro, en el puerto
  3001. Para un servidor distinto, define `EXPO_PUBLIC_SYNC_URL`.
- Los datos se guardan en `servidor/datos.json` (ignorado por git).

| Modo | Simula | Lo que debe pasar en la app |
|------|--------|-----------------------------|
| `normal` | Servidor sano | Los gastos se envían en segundos |
| `error` | El servidor responde 500 | Los datos siguen en el teléfono; se reintenta |
| `lento` | El servidor tarda 20 s | La app aborta a los 15 s y conserva los datos |
| `cortar` | Se cae la conexión a mitad del envío | Al reintentar se envía todo **sin duplicados** |

**Prueba de modo avión** (checklist de HU-06): con el teléfono por Wi-Fi,
registra gastos en modo avión. Ajustes mostrará "N movimientos pendientes".
Al desactivar el modo avión se envían solos y aparece *"Conexión recuperada:
se sincronizaron N movimientos"*.

> Con `adb reverse` el tráfico va por el cable USB y el modo avión **no** lo
> corta. Para esta prueba usa Wi-Fi.

**Contrato** (para cambiar a un backend real sin tocar el resto de la app):

```
POST /api/movimientos   { "movimientos": [ { "clave", "monto", "tipo", "fecha", ... } ] }
→ 200                   { "guardados": ["clave", ...] }
```

La `clave` es la huella única del gasto. El servidor debe guardar por esa
clave (upsert) para no duplicar.

---

## Pruebas

```powershell
npm test
```

71 pruebas en 7 archivos:

| Archivo | Cubre |
|---------|-------|
| `src/parser/parser.test.ts` | Montos en pesos, filtro de publicidad y seguridad (HU-02), extracción por banco (HU-01), pendientes (HU-04) |
| `src/notificaciones/avisos.test.ts` | Avisos sin módulo nativo (la app no se cae) |
| `src/exportar/exportar.test.ts` | Extracto, Excel, PDF y CSV |
| `src/dashboard/resumen.test.ts` | Totales por día, semana y mes; automáticos + manuales |
| `src/dashboard/dashboard.test.tsx` | Pantalla del dashboard: cambio de vista, estado vacío, reintentar, tiempo real |
| `src/sync/sync.test.ts` | Sincronización de punta a punta contra el servidor simulado real |
| `src/sync/monitor.test.ts` | Reintento al reconectar y aviso |

Los textos de notificaciones en las pruebas son **sintéticos** y hay que irlos
reemplazando por reales.

---

## Arquitectura

```
index.js                      registra el headless task (tiene que ir primero)
app/                          pantallas (expo-router, una ruta por archivo)
  _layout.tsx                 raíz: base de datos, avisos y sincronización
  (tabs)/index.tsx            HU-05 dashboard día / semana / mes
  (tabs)/gastos.tsx           lista de movimientos con filtros
  (tabs)/pendientes.tsx       HU-04 confirmación manual
  (tabs)/ajustes.tsx          HU-07 permisos · exportar · sincronización · diagnóstico
  gasto/nuevo.tsx             HU-03 registro manual
  gasto/[id].tsx              HU-08/09/10 detalle, edición y eliminación
  presupuesto/gestionar.tsx   presupuestos por categoría
src/
  parser/                     el corazón: filtros (HU-02) y extracción (HU-01)
  notificaciones/             listener de Android y avisos locales
  sms/                        lectura de SMS bancarios
  db/                         SQLite, fuente de verdad
  dashboard/                  cálculo del resumen (HU-05)
  exportar/                   extracto en Excel, PDF y CSV
  sync/                       cola, adaptador HTTP y monitor de conexión (HU-06)
  ui/                         tema, componentes y toasts
  eventos.ts                  aviso de "cambiaron los datos" entre pantallas
servidor/                     servidor simulado de sincronización
plugins/                      config plugins de Expo (permiso SMS, allowBackup)
```

Flujo de una notificación bancaria:

```
Android → headless task → filtrar() → ¿banco conocido? ── no → descartar
                                    → ¿es publicidad?  ── sí → descartar
                                    → parsear()
                                        ├ acierta → gasto en SQLite → aviso "Se registró…" → cola de envío
                                        └ falla   → Por confirmar   → aviso "Detectamos un pago…"
```

---

## Cómo construir los patrones reales de los bancos

Es la tarea central del proyecto, y la parte que no existe en ningún
repositorio público.

1. Instala la app y activa el permiso de notificaciones bancarias.
2. Haz compras reales pequeñas con cada banco del equipo.
3. Abre **Ajustes → Registro técnico**. Ahí aparece cada notificación que pasó
   por el lector: el *package name* exacto, el texto crudo y qué decidió la app.
4. Copia el texto real y el package real a `src/parser/bancos.ts`.
5. Agrega el caso a `src/parser/parser.test.ts` y corre `npm test`.

Una notificación `descartada` con motivo `paquete-desconocido` casi siempre
significa que el *package name* está mal escrito en el diccionario.

Guarden los textos reales aparte del código: es la evidencia de proceso del
acta, y la van a necesitar cuando un banco cambie el formato.

---

## Decisiones de diseño

**Local primero, nube opcional.** Todo gasto se escribe primero en SQLite. Si
no hay internet no pasa nada, porque el internet nunca está en la ruta
crítica. La sincronización es una capa aparte (`src/sync/`).

**Sin duplicados en dos niveles.** En el teléfono, una huella de monto,
comercio y ventana de 2 minutos evita registrar dos veces la misma
notificación, que Android reenvía. En el servidor, esa misma huella es la
clave de guardado, así que reenviar un gasto lo reemplaza. El costo: dos
compras idénticas seguidas se cuentan como una. Es el intercambio correcto,
porque un gasto de menos se nota y se corrige, mientras que un duplicado
silencioso infla el total del mes.

**Nada se pierde en silencio.** Si el parser no entiende una notificación de
un banco conocido, la manda a *Por confirmar* y avisa al usuario.

**La app no se cae si falta un módulo nativo.** Avisos, exportación y
detección de red se cargan con protección: si la app instalada se compiló sin
ellos, esa función se apaga con un mensaje y el resto sigue funcionando.

**Excel sin SheetJS.** El `.xlsx` se arma a mano con `fflate` (zip en
JavaScript puro). La versión de SheetJS publicada en npm es vieja y tiene
vulnerabilidades conocidas.

---

## Problemas comunes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `npm : No se puede cargar el archivo npm.ps1` | PowerShell bloquea scripts | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `SDK location not found` | Gradle no encuentra el SDK | Configura `ANDROID_HOME` y reinicia la terminal, o crea `android/local.properties` con `sdk.dir=C\:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk` |
| `adb no se reconoce` | `platform-tools` no está en el PATH | Agrégalo (paso 2) y **reinicia VS Code completo** |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE … signatures do not match` | La app instalada se firmó con otra clave | `adb uninstall co.edu.tdea.piggyeye` y vuelve a instalar (borra los datos de la app) |
| `SocketTimeoutException … port 8081` | El teléfono no alcanza Metro | Firewall: permite Node.js en redes privadas, o usa `--localhost` + `adb reverse` |
| `Cannot find native module 'Expo…'` | Se agregó una librería nativa y no se recompiló | `npm run android` |
| Error `[CXX5304] … SDK XML version 4` | Versiones distintas de herramientas del SDK | Inofensivo; se quita actualizando *Command-line Tools* en el SDK Manager |
| Aviso `Legacy Architecture` | `newArchEnabled: false` en `app.json` | Esperado: lo exige la librería del lector de notificaciones |

---

## Pendientes

- Validar los patrones y los *package names* de cada banco con notificaciones
  reales (tarea #1).
- Pruebas en teléfono físico de todas las historias (checklists de Trello).
- Revisión de código por el equipo.
- Ajustar en Trello el criterio de HU-01: "$XX.XX" está pensado en dólares; en
  pesos la app muestra "$25.000".
- Decidir si `cuota` y `seguro` deben seguir en la lista de descarte del
  filtro: hoy descartan pagos reales como "Pagaste tu cuota".
- HU-06: borrar un gasto en el teléfono no lo borra del servidor. Para un
  backend real hace falta HTTPS, porque Android solo permite HTTP en builds
  de desarrollo.
- Categorización automática: fuera de alcance según el acta.
