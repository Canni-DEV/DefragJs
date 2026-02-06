# DefragJs — IMPLEMENTATION_REFACTOR.md

Objetivo: lista completa de cambios para lograr compatibilidad VQ3/CPM fiel a DeFRaG sin romper contratos congelados.

## Alcance y contratos
- No modificar `ITraceWorld` ni `PhysicsMode` sin propuesta previa.
- `Pmove` y física siguen siendo “pure core” sin dependencias de render/DOM.
- Fixed timestep obligatorio y determinista.
- Cliente-only, sin backend ni fetch de archivos locales.

## Cambios de movimiento (Pmove)
1. Separar lógica de aire por modo en `Pmove.move`.
2. Implementar `airSpeedCap` real para VQ3 y CPM.
3. Aplicar `airAccel` con el cap en VQ3 y sin cap extra en CPM.
4. Corregir la condición de “air control” CPM.
5. Añadir parámetro `airControl` en `PmoveParams` y usarlo en CPM.
6. Añadir parámetro `strafeAccelerate` en `PmoveParams` para CPM.
7. Ajustar `wishSpeed` y `cmdScale` al estándar Q3 para evitar desbalance.
8. Mantener `wishDir` normalizado antes de todo cálculo de aceleración.

## Cambios de salto y rampas
1. Guardar plano del ground trace para el tick actual.
2. Reordenar integración de gravedad al estilo Q3.
3. Implementar half‑step gravity en `slideMove`.
4. Alinear `stepSlideMove` con flujo Q3 para ramps.
5. Implementar “ramp boost” opcional por modo (solo CPM).
6. Definir comportamiento de jump sobre rampas por modo.

## Cambios de determinismo y timestep
1. Parametrizar `FixedTimestep` por modo (125Hz CPM, configurable).
2. Asegurar que `cmd.msec` coincide con el step real.
3. Evitar dependencia de `requestAnimationFrame` para lógica de física.
4. Estabilizar acumulador ante spikes con límites controlados.

## Cambios de colisión (necesarios para DeFRaG)
1. Integrar patches en el mundo de colisión principal.
2. Respetar `mask` en `TriMeshTraceWorld`.
3. Evitar stepping discreto en `TriMeshTraceWorld`.
4. Revisar `clipVelocity` y `overclip` para match Q3.
5. Usar el normal correcto del plano en rampas y clips.

## Parámetros por modo (VQ3 vs CPM)
1. Agregar `airControl` a `PmoveParams`.
2. Agregar `airSpeedCap` a `PmoveParams`.
3. Agregar `strafeAccelerate` a `PmoveParams`.
4. Ajustar valores por modo sin reescribir lógica.
5. Mantener `PhysicsMode` como contrato único con params.

## Ajustes de input y escalado
1. Escalar `forwardmove`/`rightmove` a valores tipo Q3.
2. Mantener yaw/pitch en grados, pero separar de cmdScale.
3. Evitar clamping de inputs que rompa strafe.

## Depuración y validación
1. Agregar debug toggles para mostrar velocidad y planos.
2. Log de parámetros activos por modo.
3. Tests manuales de mapas DeFRaG típicos.
4. Checklist en `IMPLEMENTATION.md` actualizado.

## Archivos afectados (referencia)
- `src/engine/physics/movement/Pmove.ts`
- `src/engine/physics/movement/PmoveTypes.ts`
- `src/engine/physics/movement/PhysicsModes.ts`
- `src/engine/physics/movement/Q3Vanilla.ts`
- `src/engine/physics/movement/CPM.ts`
- `src/engine/core/FixedTimestep.ts`
- `src/app/Game.ts`
- `src/engine/physics/worlds/TriMeshTraceWorld.ts`
- `src/engine/physics/worlds/BrushTraceWorld.ts`
