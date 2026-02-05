# DefragJs — IMPLEMENTATION.md

Guia de implementacion fase por fase para construir DefragJs.

- App **100% estatica**, **cliente-only**, servida por GitHub Pages.
- Carga PK3/BSP en el navegador.
- Render moderno en Three.js (sin shaders legacy de Quake 3).
- Movimiento fiel con **BBox Quake 3** desde el inicio.
- Switch de fisicas: **VQ3 (vanilla)** y **CPM/CPMA** (modo configurable).
- Colision hibrida: **Fase 1 TriMesh + broadphase**, **Fase 3 BrushTraceWorld**.
- Todo el gameplay usa `ITraceWorld` (no sabe si hay TriMesh o BrushTrace).

---

## 0) Reglas de proyecto y criterios de aceptacion

### Requisitos funcionales

- App web estatica (sin backend): todo en el cliente.
- Entrada de datos:
- Subir `pak0.pk3`/`baseq3` y uno o mas `*.pk3` (map pack / defrag pack), o subir un `.pk3` que ya contenga el `.bsp`.
- Seleccionar `maps/*.bsp` desde UI.
- Construir:
- RenderMesh (Three.js) desde BSP: faces + patches tessellated.
- CollisionWorld: Fase 1 TriMesh + broadphase, Fase 3 BrushTrace.
- EntityWorld: parse entities lump + soporte a triggers (marker-based primero, brush models despues).
- Loop runtime:
- Input -> Pmove (Vanilla/CPM) -> TraceBox -> Integracion -> Camara.
- Timer + checkpoints + teleports.

### Requisitos no funcionales

- Determinismo razonable (fixed timestep).
- Performance: batching por material, evitar draw calls excesivos.
- Mantenibilidad: gameplay y movimiento desacoplados de colision (ITraceWorld).

---

## 1) Stack, build y deploy (Vite + GitHub Pages)

### Setup base

- Crear proyecto Vite TS.
- Dependencias:
- three
- fflate (zip/PK3)
- stats.js (opcional)
- lil-gui (opcional)

### GitHub Pages

- `vite.config.ts` con `base: '/<repo-name>/'`.
- Deploy `dist/`.
- No usar rutas server-side; todo ocurre en cliente.

---

## 2) Arquitectura de modulos (congelada)

Estructura recomendada:

```
src/
  app/
    main.ts
    Game.ts
    GameLoop.ts
    UI/
      FileMountPanel.ts
      MapSelectPanel.ts
      Hud.ts
      DebugPanel.ts
  engine/
    core/
      Clock.ts
      FixedTimestep.ts
      EventBus.ts
      Log.ts
      Math/
        Vec3.ts
        Mat3.ts
        Plane.ts
        AABB.ts
      Debug/
        DebugDraw.ts
        Assertions.ts
    io/
      pk3/
        Pk3Archive.ts
        VirtualFS.ts
      bsp/
        BspParser.ts
        BspTypes.ts
        EntityParser.ts
    render/
      MapRenderer.ts
      Geometry/
        FaceTriangulator.ts
        PatchTessellator.ts
      Materials/
        MaterialRegistry.ts
        MaterialFactory.ts
    physics/
      ITraceWorld.ts
      TraceTypes.ts
      worlds/
        TriMeshTraceWorld.ts
        BrushTraceWorld.ts   // fase 3
      movement/
        Pmove.ts
        PmoveTypes.ts
        PhysicsModes.ts
        Q3Vanilla.ts
        CPM.ts
      player/
        PlayerController.ts
        CameraRig.ts
    gameplay/
      entities/
        EntityWorld.ts
        EntityTypes.ts
        EntityIndex.ts
      defrag/
        TimerSystem.ts
        CheckpointSystem.ts
        TeleportSystem.ts
        TriggerSystem.ts
  tools/
    map_inspector/
```

---

## 3) Contratos inmutables

### 3.1 ITraceWorld (fiel a Quake 3)

El trace primario es box/AABB sweep.

```ts
export interface ITraceWorld {
  traceBox(req: TraceBoxRequest): TraceResult;
  pointContents?(p: Vec3): ContentsMask;
}

export type TraceBoxRequest = {
  start: Vec3;
  end: Vec3;
  mins: Vec3;
  maxs: Vec3;
  mask: ContentsMask;
  passEntityId?: number;
};

export type TraceResult = {
  fraction: number; // 0..1
  endPos: Vec3;
  planeNormal: Vec3;
  startSolid: boolean;
  allSolid: boolean;
  contents?: ContentsMask;
  hitId?: number;
};
```

### 3.2 PhysicsMode (switch VQ3/CPM)

Pmove compartido; cambian parametros y hooks.

```ts
export interface PhysicsMode {
  id: 'VQ3' | 'CPM';
  params: PmoveParams;
  hooks?: {
    airControl?: (ctx: unknown) => void;
  };
}
```

PmoveParams incluye:

- friction, stopSpeed
- accelerate, airAccelerate
- gravity
- jumpVelocity
- stepSize
- overclip
- wishSpeedCap, duckScale, etc.

---

## 4) Fases de implementacion

### FASE 1 — Viewer + Walk (TriMesh + Pmove VQ3 base)

Objetivo: cargar pk3/bsp, renderizar el mapa y caminar con feel Quake usando BBox desde el inicio. Fixed timestep desde el primer dia.

#### 4.1 IO: PK3 + VirtualFS

Tareas:

- `Pk3Archive`
- Input: File -> ArrayBuffer.
- Indexar entries (path -> offset/size).
- `read(path): Uint8Array | null`.
- `VirtualFS`
- `mount(archive, priority)`.
- `readFile(path)` resuelve por prioridad (ultimo montado gana).
- `list(prefix)` para `maps/`.

Criterios:

- Soporta multiples pk3.
- Paths normalizados.

Checklist:

- [x] Pk3Archive lee y lista entries.
- [x] VirtualFS mount/resolution ok.
- [x] UI permite cargar 1..N pk3.

#### 4.2 BSP Parser minimo (render + entities + metadata)

Implementar `BspParser.parse(buffer)` -> `BspData`:

- entities (string)
- textures (name + surfaceFlags + contents)
- vertexes, meshverts, faces
- models (guardado aunque no se use)
- guardar tambien lumps futuros (planes/nodes/leafs/brushes...)

Criterios:

- Little-endian robusto.
- Validar magic/version.

Checklist:

- [x] Parse header/lumps.
- [x] Entities lump parseable.
- [x] Lumps geometry ok.
- [x] Lumps colision guardados en BspData.

#### 4.3 Tessellation de patches + triangulacion

Implementar:

- `FaceTriangulator`
- polygon faces
- mesh faces via meshverts
- patch faces via `PatchTessellator`
- billboard: opcional ignorar

`PatchTessellator`:

- control grid + subdiv
- genera vertices/UV/normals

Criterios:

- Patches visibles y triangulados.

Checklist:

- [x] Triangulacion polygon/mesh.
- [x] Tessellation patch configurable.
- [x] Output consistente (positions/uv/indices).

#### 4.4 Render moderno (Three.js)

Implementar `MapRenderer.build(bspData)`:

- Agrupar por `textureName` o group.
- Preferido: 1 geometry global + addGroup.

Materiales:

- `MeshStandardMaterial` default.
- color procedural hash(`textureName`) si no hay textura.

Retorna object3d contenedor. Debug wireframe toggle.

Checklist:

- [x] Render de mapa completo.
- [x] Batching por groups/material.
- [x] UI wireframe/debug.

#### 4.5 Colision fase 1: TriMeshTraceWorld.traceBox (MVP estable)

Tareas:

- Construccion `CollisionTriMesh`.
- posiciones `Float32Array`.
- indices `Uint32Array`.

Broadphase:

- BVH/Octree para candidatos.

Narrowphase (MVP):

- trace aproximado: subdividir sweep en N pasos.
- detectar overlap AABB vs tri (SAT simple/overlap test).
- normal aproximada del tri.
- calcular fraction aproximada.

Criterio:

- Walkable: sin atravesar paredes, estable.

Checklist:

- [x] TriMesh construido desde faces (incluye patches).
- [x] Broadphase funcionando.
- [x] traceBox devuelve fraction/endPos/normal/startSolid.
- [x] Walkable sin jitter extremo.

#### 4.6 Movimiento fase 1: Pmove VQ3 (BBox Q3 desde el inicio)

Tareas:

- PlayerState, UserCmd, PmoveTypes.
- Pmove (shared engine).
- VQ3 mode params.

Algoritmo:

- Friccion ground.
- Aceleracion ground/air.
- SlideMove + StepSlideMove.
- Ground check.
- Jump (si onGround).
- BBox Q3 fijo (mins/maxs).

Checklist:

- [x] Player bbox Q3 aplicado.
- [x] Strafe/airmove basico ok.
- [x] StepSlideMove implementado.
- [x] Jump/gravity ok.

#### 4.7 GameLoop determinista: FixedTimestep

Tareas:

- `FixedTimestep`.
- Acumular dt real.
- Simular N steps de tamano fijo (8ms o 16ms definido por config).
- Render por RAF, sim en fixed steps.

Checklist:

- [x] Fixed timestep activo.
- [x] `UserCmd.msec` consistente.
- [x] Movimiento no depende de FPS.

---

### FASE 2 — DeFRaG basico + Switch VQ3/CPM (marker-based)

Objetivo: timer/checkpoints/teleports funcionales. Switch VQ3/CPM en runtime.

#### 5.1 PhysicsModes: VQ3 y CPM

Tareas:

- `Q3Vanilla.ts` define PhysicsMode VQ3.
- `CPM.ts` define PhysicsMode CPM.
- UI selector VQ3/CPM.

Al cambiar modo:

- opcional reset vel/estado para evitar glitches.

Checklist:

- [x] Selector VQ3/CPM funcional.
- [x] Cambian params (feel perceptible).
- [x] No rompe determinismo.

#### 5.2 Entities + Defrag systems (marker-based)

Tareas:

- `EntityParser`: entities lump -> `Q3Entity[]`.
- `EntityWorld`: index por classname.
- Adapter: mapear classnames a markers: spawns, checkpoints (`target_position`), teleports marker-based (custom kv).

`TriggerSystem` (MVP):

- triggers AABB por kv: mins/maxs o radius.
- deteccion AABB player vs trigger.

`TimerSystem`:

- idle/running/stopped.
- start/stop por triggers.
- splits checkpoints.

HUD:

- tiempo actual, splits.

Checklist:

- [x] Entities parseadas y listadas.
- [x] TriggerSystem marker-based.
- [x] Timer start/stop.
- [x] Checkpoints splits.
- [x] Teleport marker-based.
- [x] HUD visible.

---

### FASE 3 — Fidelidad real: BrushTraceWorld + triggers brush-model (mapas DeFRaG reales)

Objetivo: colision exacta contra brushes. Triggers reales desde brush models de entidades model "*n".

#### 6.1 BrushTraceWorld.traceBox (real)

Tareas:

Parse y uso de lumps:

- planes, nodes, leafs, leafbrushes, brushes, brushsides, models.

Implementar `traceBox` estilo Q3:

- Expandir AABB contra plano con extents.
- Calcular enter/leave fraction.
- Hit normal del plano que clipea.

Broadphase por BSP:

- localizar leafs candidatos (o muestreo).
- recolectar brushes desde leafBrushes.

`pointContents` real:

- contents mask del punto (para triggers/agua/etc).

Checklist:

- traceBox brush-based correcto.
- pointContents real.
- StepSlideMove mas estable.
- No atraviesa brushes.

#### 6.2 Triggers reales desde brush models

Tareas:

- Detectar entidades con model "*n".
- models[n] provee rangos de brushes.
- Construir TriggerVolume a partir de esos brushes (contents trigger).

Runtime:

- usar pointContents/traceBox con mask TRIGGER para enter/leave.
- disparar teleports/start/stop/checkpoint reales.

Checklist:

- Triggers brush-model detectados.
- Enter/leave correcto.
- Teleports reales funcionan en mapas DeFRaG.
- Start/stop/checkpoints reales funcionan.

---

### FASE 4 — Polish + compatibilidad + performance

Objetivo: mejor UX, caching opcional, herramientas, optimizaciones.

#### 7.1 Performance render

- Unificar geometria global con groups.
- Culling: frustum culling por chunk (particionar por AABB).
- LOD opcional.

Checklist:

- Menos draw calls.
- Culling por chunk.
- Mantiene compatibilidad.

#### 7.2 UX de archivos (cliente-only)

Persistencia opcional:

- IndexedDB cache PK3.

UI:

- Drag&drop.
- lista de pk3 montados y prioridad.

Checklist:

- Drag&drop.
- Gestion de mounts/prioridad.
- Cache IndexedDB (opcional).

#### 7.3 Herramientas

tools/map_inspector:

- dump lumps stats.
- contar faces por type, patches, brushes.
- listar entidades con model "*n".

Checklist:

- Inspector funcional.
- Reporte exportable (txt/json).

#### 7.4 Replay/Ghost (opcional)

- grabar inputs por tick y reproducir.
- ghost render.

Checklist:

- Grabacion inputs.
- Reproduccion determinista.
- Ghost visible.

---

## 5) Guia de codigo limpio (resumen operativo, obligatorio)

- Interfaces primero: `ITraceWorld`, `PhysicsMode`, `MapAsset` no se rompen.
- Pure core: `Pmove` no importa Three/DOM/UI.
- Fixed timestep obligatorio.
- No `any`, strict TS.
- No refactors masivos sin propuesta.
- `DebugDraw` y toggles para colision y movimiento.
- Hot paths sin alocaciones por frame.

---

## Checklist global (para ir marcando)

Fase 1

- Vite + GH Pages base ok.
- Upload pk3 -> VirtualFS mount ok.
- Listar maps/ y seleccionar bsp.
- BSP parse lumps basicos ok.
- Render: polygons + mesh + patches ok.
- TriMeshTraceWorld.traceBox MVP estable.
- Pmove VQ3 bbox OK + step/slide.
- Walkable demo.

Fase 2

- Selector VQ3/CPM.
- Timer start/stop (marker-based).
- Checkpoints splits.
- Teleport marker-based.
- HUD.

Fase 3

- BrushTraceWorld traceBox correcto.
- pointContents real.
- triggers brush-model reales.
- mapas defrag reales (teleports/start/stop) funcionan.

Fase 4

- Optimizacion draw calls y culling.
- UX mounting/caching.
- Map inspector.
- Polish camara + opciones.

---
