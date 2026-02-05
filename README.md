# Defrag Web

**Defrag Web** es una aplicacion web **100% estatica y client-side** que permite cargar, visualizar y jugar mapas de **Quake 3 / DeFRaG** directamente desde el navegador, utilizando **Vite + TypeScript + Three.js**.
El proyecto esta enfocado en **reproducir con fidelidad el movimiento original de DeFRaG**, incluyendo **Vanilla (VQ3)** y **CPM/CPMA**, manteniendo desde el inicio el **BBox original de Quake 3**, pero con un **pipeline de render moderno** optimizado para WebGL.

No utiliza backend ni servidores de juego: **todo ocurre del lado del cliente**, lo que permite publicarlo facilmente en **GitHub Pages**.

---

## Objetivo del proyecto

El objetivo principal de Defrag Web es:

- Reproducir **el movimiento y la fisica de DeFRaG de forma fiel**, no "inspirada".
- Permitir **switch dinamico de modos de fisica** (VQ3 / CPM).
- Cargar mapas reales de la comunidad (archivos `.pk3` y `.bsp`).
- Separar claramente rendering moderno (Three.js), colisiones, movimiento Quake y gameplay DeFRaG.
- Utilizar una **arquitectura hibrida de colisiones** con fase inicial TriMesh + broadphase (rapido de implementar) y fase avanzada con colisiones exactas por **BSP brushes**, como el motor original.
- Ser una **base solida y extensible** para timers, checkpoints, teleports, replays, ghosts y herramientas de analisis de mapas.

---

## Que **no** es este proyecto

- No intenta emular el renderer original de Quake 3.
- No implementa shaders legacy (`.shader` Q3).
- No es un engine generico de FPS moderno.
- No usa backend ni logica de servidor.

El foco esta en **jugabilidad y fisica**, no en reproduccion visual 1:1.

---

## Stack tecnologico

- **Vite** (build y dev server)
- **TypeScript (strict)**
- **Three.js** (render WebGL)
- **fflate** (lectura de PK3/ZIP en browser)
- **GitHub Pages** (deploy estatico)

Todo el codigo corre en el navegador.

---

## Flujo de uso (User Flow)

### 1) Abrir la aplicacion

- El usuario accede a la URL (por ejemplo, GitHub Pages).
- La app carga sin requerir conexion a servidores externos.

### 2) Cargar archivos PK3

Desde la interfaz, el usuario puede arrastrar y soltar uno o mas archivos `.pk3`, o seleccionarlos mediante un `<input type="file">`.

Ejemplos:

- `pak0.pk3` / `baseq3.pk3`
- packs de mapas DeFRaG
- mapas individuales `.pk3`

Los PK3 se leen con File API, se descomprimen en memoria y se montan en un **Virtual File System** con prioridad (como en Quake 3).

Nada se sube a ningun servidor.

### 3) Seleccionar un mapa

- La app lista automaticamente los archivos encontrados en `maps/*.bsp`.
- El usuario selecciona un mapa desde la UI.

### 4) Construccion del mapa

Al seleccionar el mapa:

1. Se parsea el `.bsp`.
2. Se construye el mapa con **RenderMesh** (faces + patches tessellated), **CollisionWorld** (TriMesh en fases iniciales) y **EntityWorld** (entities lump).
3. El mapa se agrega a la escena Three.js.

### 5) Spawn del jugador

- Se busca un spawn valido (`info_player_*`).
- Se inicializa el jugador con **BBox Quake 3 real**, estado fisico inicial y modo de fisica seleccionado (VQ3 por defecto).

### 6) Jugar

- Controles estilo FPS clasico (WASD + mouse).
- Movimiento fiel: strafe, air control, bunny hopping y ramp sliding (mejora progresivamente con colision brush).
- El loop de juego es **determinista** con fixed timestep.

### 7) DeFRaG gameplay

Segun la fase del proyecto:

- Timers (start / stop).
- Checkpoints y splits.
- Teleports.
- Switch de fisica VQ3 / CPM desde UI/debug panel.

---

## Arquitectura conceptual (alto nivel)

```
Input -> UserCmd -> Pmove (VQ3 / CPM) -> ITraceWorld.traceBox() -> Integracion de posicion -> Camara / Render
```

El gameplay **no sabe** si la colision es TriMesh + BVH (fase inicial) o BSP brushes exactos (fase avanzada).

---

## Filosofia de diseno

- **Fidelidad antes que estetica**.
- **Interfaces claras y contratos congelados**.
- **Nada de magia oculta**: todo explicito y depurable.
- **Codigo orientado a lectura y mantenimiento**, no solo a "que funcione".
- **Pensado para agentes IA** que puedan implementar por fases sin romper el sistema.

---

## Estado del proyecto

El desarrollo esta dividido en **fases bien definidas**, documentadas en:

- `AGENTS.md` - reglas de implementacion y estilo de codigo.
- `IMPLEMENTATION.md` - guia tecnica paso a paso con checklist por fase.

El objetivo es poder avanzar incrementalmente sin deuda tecnica estructural.

---

## Licencia y contenido

- El codigo del proyecto es independiente de los assets de Quake 3.
- Los mapas y PK3 utilizados deben ser provistos por el usuario.
- No se distribuyen assets propietarios dentro del repositorio.

---

## Publico objetivo

- Jugadores y mappers de DeFRaG.
- Desarrolladores interesados en motores clasicos, fisica Quake, WebGL avanzado e ingenieria de parsers y motores.
- Proyectos educativos y experimentales sobre engines clasicos en la web.
