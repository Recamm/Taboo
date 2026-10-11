# Palabras Prohibidas — React

Juego presencial PWA para compartir un celular, hecho con **React 19 + Vite 8**. La interfaz usa componentes JSX, formularios controlados, hooks y un reducer inmutable. El motor es JavaScript independiente de React. Sin cuentas, backend ni base de datos.

## Modo libre

Desde el inicio, elegí **Modo libre · Solo cartas**. Seleccioná una o varias categorías y tocá **Ver cartas**. Se muestran la palabra y sus cinco prohibidas, con botones **Atrás** y **Siguiente**; no hay tiempo, equipos ni puntuación.

Atrás recupera la misma carta y Siguiente vuelve a recorrer el historial antes de mostrar cartas nuevas. Al consumir el mazo, se mezcla otro ciclo sin repetir inmediatamente la última carta. El botón Categorías permite cambiar la selección. Se recuerda la selección en el dispositivo, pero el recorrido de cartas empieza de nuevo al abrir otra sesión libre. Si había una partida cronometrada activa, se pausa al entrar en este modo.

## Ejecutar

Necesitás **Node.js 22.12 o superior** (recomendado: Node 24 LTS).

```sh
npm ci
npm run dev
```

Abrí la dirección que muestra Vite. No abras `index.html` con doble clic. No necesitás Python.

## Compilar y probar la PWA

```sh
npm run build
npm run preview
```

Vite genera `dist/`. Después se genera el service worker con todos los archivos compilados, los iconos y el manifest. Las 300 cartas están incluidas en el JavaScript compilado; no se consultan servicios externos.

La PWA se registra **solo en producción y preview**, para evitar una caché vieja durante el desarrollo. Esperá “Lista sin conexión” antes de probar modo avión. Para instalar desde un celular, usá la dirección HTTPS de Vercel.

## Subir a GitHub y desplegar en Vercel

1. Creá un repositorio en GitHub.
2. Subí **el contenido** de `palabras-prohibidas-react` a la raíz: `package.json`, `package-lock.json`, `index.html`, `src`, `public`, `scripts`, `tests`, `vite.config.js`, `vercel.json`, `.gitignore` y `.github`.
3. No subas `node_modules` ni `dist`; `.gitignore` ya los excluye.
4. En Vercel elegí **Add New → Project** e importá el repositorio.
5. La configuración incluida usa:

| Opción | Valor |
| --- | --- |
| Framework Preset | Vite |
| Build Command | npm run build |
| Output Directory | dist |
| Install Command | Predeterminado de Vercel |
| Node.js | 24.x |
| Variables de entorno | Ninguna |

Si subís la carpeta completa dentro del repositorio, elegí `palabras-prohibidas-react` como **Root Directory**. Para que GitHub Actions ejecute los checks automáticamente, es preferible subir su contenido a la raíz.

También podés subir con Git desde esa carpeta:

```sh
git init -b main
git add .
git commit -m "Crear Palabras Prohibidas en React"
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```

El código está en [Recamm/Taboo](https://github.com/Recamm/Taboo). Podés importar ese repositorio directamente en Vercel. No requiere variables de entorno.

## Funciones y reglas

- Tutorial inicial de cuatro pasos, omitir y volver a abrir.
- De 2 a 8 equipos; nombres editables, únicos y hasta 24 caracteres.
- Turnos de 15 a 300 segundos, en pasos de 15; de 1 a 20 rondas.
- Cada ronda incluye un turno de cada equipo.
- Acertó: +1 al equipo actual y carta nueva.
- Prohibida: −1 al equipo actual o +1 al siguiente rival, según lo configurado.
- Los puntajes negativos están permitidos. No se combinan penalizaciones.
- Dos pases gratuitos por turno; cambiar la carta no permite elegir ni volver a las descartadas. Aciertos e infracciones no recuperan pases.
- Una respuesta incorrecta o terminar el tiempo no penaliza la carta.
- Vocabularios combinables: General (100), Argentina (60), Cultura y entretenimiento (50), Deportes (50), Tecnología (40).
- Cartas originales, con objetivo y exactamente cinco prohibidas.
- Mezcla Fisher–Yates; repite solo al consumir el mazo completo, con aviso y reloj detenido.
- Deshacer una acción, sin devolver tiempo, restaurando carta, puntos y cupo.
- Pausa con carta oculta; reanuda la misma palabra.
- Resumen, correcciones manuales identificadas y marcador.
- Desempates únicamente entre los equipos líderes, con igual cantidad de turnos.
- Sonido opcional, aviso visual en los últimos diez segundos y Wake Lock cuando el navegador lo permite.

Una persona da pistas, sus compañeros adivinan y el siguiente equipo controla. No se permiten objetivo, prohibidas ni variaciones directas; tampoco gestos, deletreo, traducción, abreviaturas para decir el objetivo o pistas de rima. El grupo valida las pistas: la app no escucha ni decide.

## Guardado y actualizaciones

La partida se guarda en localStorage después de cada cambio. Conserva puntos, orden del mazo, carta y pases. El reloj usa una fecha de vencimiento: recargar, bloquear el celular o cambiar de aplicación no pausa el tiempo. Tocá **Pausa** antes de una interrupción.

El tutorial y el marcador pausan el turno activo para permitir leer sin mostrar la carta. Para seguir, cerrá el diálogo y tocá **Seguir jugando**. Salir al inicio pide guardar o abandonar; empezar otra partida confirma la sustitución.

La migración conserva el formato de partida versión 1 y las mismas claves locales de la edición anterior. Puede recuperarla si se publica en el mismo dominio y navegador. Cambiar de dominio no transfiere el almacenamiento.

Cada build genera automáticamente una versión de caché distinta cuando cambian los archivos. Una actualización queda esperando y se ofrece al volver al inicio sin una partida pendiente. No se activa automáticamente durante el juego. Las cachés de otras apps y otros scopes se conservan.

## Estructura

| Archivo/carpeta | Función |
| --- | --- |
| src/App.jsx | Estado, reloj, audio, persistencia, navegación y PWA |
| src/Screens.jsx | Componentes de todas las pantallas y tutorial |
| src/reducer.js | Transiciones inmutables de la partida |
| src/FreeMode.jsx / src/free.js | Selección de categorías y navegación del modo libre |
| src/game.js / src/deck.js | Reglas, validación, selección y mazo |
| src/cards.js / src/data | 300 cartas originales y vocabularios |
| src/storage.js / src/pwa.js | Guardado local, instalación y actualización |
| src/styles.css | Diseño adaptable y accesibilidad |
| public | Manifest e iconos con fondo sólido |
| scripts | Generación del service worker de producción |
| tests | Motor, reducer, componentes React y caché offline |
| .github/workflows/check.yml | Compilación y pruebas en pushes y pull requests |

## Verificación

```sh
npm test
```

Este comando compila y ejecuta **32 pruebas**. Cubren las 300 cartas, configuración, puntuación, receptor circular, cupo, deshacer, doble toque, reloj real, pausa, recarga, turnos, correcciones, agotamiento y desempates. También prueban el reducer inmutable, renderizado real de componentes React, campos duplicados, nombres escapados y carta oculta; verifican la caché compilada en raíz/subcarpeta, descargas incompletas y manifest/iconos. Las pruebas del modo libre comprueban categorías, historial, botones Atrás/Siguiente y nuevos ciclos.

Compilación de producción y todas las pruebas aprobadas. El renderizado de React probado es estático en Node; no sustituye una prueba interactiva en navegador. No se verificó en dispositivos reales la instalación, audio, modo avión ni el layout. Antes de compartir, probá esos puntos en iPhone y Android, además de recarga durante un turno y una actualización pendiente.

Referencias: [React](https://react.dev/), [Vite](https://vite.dev/guide/) y [configuración de Vercel](https://vercel.com/docs/project-configuration/vercel-json).
