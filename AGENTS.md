# DefragJs — AGENTS.md

Este repositorio implementa un “DefragJs” (Quake 3 / DeFRaG-like) 100% client-side, estático (GitHub Pages), con Vite + TypeScript + Three.js.
La prioridad del proyecto es: **movimiento fiel (VQ3/CPM) + colisión fiel (BBox Q3)**, con rendering moderno (sin shaders legacy de Q3).

---

## Principios de trabajo (obligatorios)

1. **No romper contratos congelados**
   `ITraceWorld` (trace primario por AABB/box) y `PhysicsMode` no se cambian sin una propuesta previa y justificación.
   Gameplay/movement no conoce la implementación de colisión (TriMesh/BVH vs BrushTrace); solo usa `ITraceWorld`.

2. **Implementar por fases**
   No se adelantan features de fases futuras si rompen el avance (ej: triggers brush-model antes de BrushTraceWorld).
   Cada PR/commit debe cerrar un bloque del checklist de `IMPLEMENTATION.md`.

3. **Pure core**
   `Pmove` y toda la lógica de movimiento/física no pueden depender de Three.js, DOM, UI, ni de la escena.
   `io/` (parsers) no depende de `render/` ni `physics/`.

4. **Determinismo y estabilidad**
   Se usa **fixed timestep** desde Fase 1.
   Sin `Math.random()` en movimiento/colisión.
   Evitar dependencias de framerate en el gameplay.

5. **Cliente-only**
   No agregar backend, ni endpoints, ni `fetch` a rutas de archivos locales.
   Los PK3 se cargan vía File API (input/drag&drop) y se procesan en memoria en el browser.

---

## Stack y build

- Vite + TypeScript (strict)
- Three.js
- Zip/PK3: `fflate` (preferido por performance en browser)
- Deploy: GitHub Pages (`vite.config.ts` con `base: '/<repo>/'`)

---

## Convenciones de código (TypeScript)

### Reglas de TypeScript

- `strict: true` en `tsconfig.json`.
- Prohibido `any`. Si no se sabe el tipo, usar `unknown` y type guards.
- Preferir `readonly` en DTOs del parsing.
- Preferir union types antes que `enum` si el set es corto y estable.

### Naming

- Clases y tipos: `PascalCase`
- Funciones y variables: `camelCase`
- Archivos: `PascalCase.ts` para clases, `camelCase.ts` para helpers.
- 1 módulo = 1 responsabilidad.

### Estructura

- Nunca mezclar parser con builder.
- `BspParser` solo parsea.
- `MapRenderer` solo construye meshes Three.
- `TriMeshTraceWorld` solo colisión y broadphase.

### Errores/Validaciones

Crear `engine/core/Debug/Assertions.ts` con:

- `invariant(condition, message)`
- `assertNever(x: never)`

### Validaciones de parsing

- Validar offsets/lengths de lumps.
- Manejar PK3 corruptos sin romper toda la app.

---

## Performance y hot paths

### Movimiento (Pmove)

- No alocar vectores dentro del tick. Reutilizar temporales (`tmp1`, `tmp2`, etc.).
- Evitar arrays dinámicos por frame.
- Cuidar `EPS` global para estabilidad numérica.

### Colisión

- Broadphase cacheable (BVH/Octree).
- Early exits (si `fraction === 1` etc.).
- Debug toggles para inspección (no siempre activo).

---

## Determinismo: tiempo y loop

- `FixedTimestep` obligatorio:
- acumular `dt` real
- simular N steps de tamaño fijo (8ms o 16ms definido por config)
- `UserCmd.msec` debe representar el step actual.
- No atar la física al `requestAnimationFrame` directamente.

---

## Interfaz de colisión (congelada)

El movimiento Quake 3 usa sweep de AABB (box trace) con `mins/maxs`.
Se define como contrato central:

```ts
export interface ITraceWorld {
  traceBox(req: TraceBoxRequest): TraceResult;
  pointContents?(p: Vec3): ContentsMask;
}
```

Prohibido cambiar a cápsula como primario. Cápsula puede existir como helper encima del box, pero Pmove usa box.

---

## Física (VQ3 / CPM)

- Desde Fase 1: BBox Q3.
- Soportar switch de modo: `PhysicsMode` con params y hooks opcionales.
- Pmove compartido, parámetros y hooks varían por modo.
- Cambios grandes (p.ej. “recrear pmove desde cero”) requieren propuesta previa.

---

## Cliente-only: archivos PK3 y persistencia

- Los PK3 se montan en VirtualFS en memoria.
- Persistencia opcional: IndexedDB (solo Fase 4).
- Nada de “descargar assets” desde internet por default.

---

## Checklist / calidad antes de marcar una tarea como hecha

Antes de marcar un ítem como hecho en `IMPLEMENTATION.md`:

- El código compila con strict.
- Hay una demo mínima funcional (si aplica).
- No se rompieron contratos.
- Se agregaron logs/debug toggles cuando sea útil.
- Se actualizó el checklist.

---

## Estilo de commits / PRs

- Cambios pequeños y enfocados (1 fase o parte de fase).
- Prohibido refactor masivo no solicitado.
- Si se detecta deuda técnica: abrir issue o agregar TODO específico con contexto.

---
