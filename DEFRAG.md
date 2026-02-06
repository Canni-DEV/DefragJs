# 🧠 Defrag — Documentación Técnica

Contexto técnico profundo para el proyecto **DefragJS**: cómo funciona DeFRaG, la física de movimiento, las colisiones, los mapas y el motor de Quake III Arena.

---

## 📜 1. ¿Qué es DeFRaG?

**DeFRaG** es una modificación de *Quake III Arena* centrada en el movimiento, técnica de saltos y competencia de tiempo, no en combate. Fue construida sobre el motor **id Tech 3 (Quake III)** y está diseñada para maximizar maniobras como *strafe jumping*, *bunny hopping*, *circle jumping*, *ramp jumping*, *overbounce*, etc. La mayoría de mapas en DeFRaG son recorridos, no arenas de combate.

- Ofrece dos físicas:
- **Vanilla Quake III (VQ3)** — física original de Quake III.
- **Challenge ProMode (CPM)** — física con mayor control y movimientos competitivos.

---

## 🏗️ 2. Formatos de mapa: .pk3 y .bsp

### 📦 .pk3 — Contenedor de recursos

- Un `.pk3` es esencialmente un ZIP que contiene:
- Mapas `.bsp`
- Texturas (imágenes: `.jpg`, `.png`, a veces `.tga`)
- Scripts de shaders (`.shader`)
- Modelos (`.md3`, `.md4`)
- Otras entidades (sonidos, texturas especiales)

Este formato fue adoptado por Quake III y sus mods para empaquetar assets.

### 🗺️ .bsp — Binary Space Partitioning (mapa)

Un BSP contiene geometría y datos de nivel:

- Geometría
- Vértices
- Triángulos / mesh
- Superficies
- Parches (curvas)
- Lightmaps (iluminación estática)
- Entidades (spawn points, triggers)
- Datos para colisión: planes, nodes, leafs, brushes, etc.

Leer y parsear estos lumps permite reconstruir máscaras de colisión y renderizar el nivel.

---

## 🎨 3. Renderizado y visual

### 🟦 Lightmapping

- Los mapas contienen **lightmaps** (iluminación precalculada) que aportan sombras suaves y volumen.
- En Three.js podés asignarlos usando `material.lightMap` y `geometry.attributes.uv2`.

Más allá de los lightmaps y texturas base, Quake III usaba un sistema de shaders por script (`.shader`), pero en esta etapa es posible ignorarlos o interpretarlos de forma simplificada.

### 🖼️ Texturas y shaders

- Aunque el motor original combina múltiples capas y efectos, en web puedes usar materiales estándar de Three.js.
- El `.pk3` a menudo trae texturas internas o referidas por los shaders.

---

## 🕹️ 4. Física de Movement

La física de movimiento de Quake III (VQ3) y CPM/CPMA es extremadamente sensible a constantes y orden de operaciones.

Hay dos modos:

- **VQ3**: física original, aceleración básica, menor control en aire.
- **CPM/CPMA**: física competitiva con *air control*, *ramp boosts* y mayor responsividad en aire.

### 🧮 Elementos de física

- **Wishdir/Wishspeed**: intención de movimiento del jugador
- **Ground acceleration/air acceleration**
- **Friction**
- **Clip velocity**
- **Step + slide logic**
- **Gravity & jump impulse**

---

## 🔧 5. Física de Quake III (VQ3)

**Características:**

- Aceleración limitada en aire
- Aceleración normal en suelo
- Fricción al pisar
- La aceleración horizontal se calcula mediante el punto de proyección de velocidad sobre direcciones deseadas

**Comportamiento:**

- Si el jugador gira en el aire, su velocidad cambia solo ligeramente.
- Técnicas como bunnyhop y strafe jumping funcionan, pero son menos potentes.

---

## 🚀 6. Física de CPM/CPMA

**Características:**

- Mayor control en aire (*air control*)
- Posibilidad de *ramp boost*
- Correcciones más agresivas de dirección en aire
- Frecuencia física fija para determinismo

**Efectos principales:**

- Se pueden conservar más grandes velocidades en aire.
- Permite maniobras técnicas más complejas.

---

## 📍 7. Técnicas avanzadas de movimiento

Estas técnicas aprovechan la física del motor original:

### ✨ Strafe Jumping

- Mediante inputs combinados (teclas + ratón) se puede lograr aceleración mayor que la velocidad cap.
- Sucede porque la proyección de velocidades combinadas puede sumarse sin ser recortada por la física base.

### 🚀 Bunny Hopping

- Saltar repetidamente con timing adecuado para conservar la velocidad al aterrizar.

### 🌀 Circle Jumping

- Técnica de inicio que garantiza mayor impulso inicial antes de strafe jumping.

### 🔄 Overbounce

- Variación de la física que puede producir un rebote alto al impactar el suelo con vector específico.

---

## 📐 8. Colisiones

### 📌 Operación de Colisión

- El motor hace barridos (*swept box trace*) por geometría destrinada desde los planos de los brushes para decidir contacto.
- Se usan *normales* de planos para aplicar *clip velocity*, lo que genera efectos de *slide* y *step up*.
- Mal manejo de estas operaciones genera que el jugador quede **clavado** contra paredes.

### 🧠 Clip Velocity

Clip velocity elimina la componente de velocidad perpendicular al plano de colisión, permitiendo que el jugador siga deslizando a lo largo del plano sin ser empujado dentro de él.

---

## ⚙️ 9. Implementación general de física

Pseudocódigo para sistemas de movement típicos:

### 🟦 Base shared

```pseudo
movePlayer(player, input, world) {
  wishDir, wishSpeed = calculateWish(input)
  if (player.onGround) {
    velocity = accelerateGround(velocity, wishDir, wishSpeed)
  } else {
    velocity = accelerateAir(velocity, wishDir, wishSpeed)
  }
  velocity = applyGravity(velocity)
  newPos, impact = traceCollision(player.pos, velocity * dt)
  if (impact.hit) {
    velocity = clipVelocity(velocity, impact.normal)
  }
  updatePlayer(player, newPos, velocity)
}
```

### 🟢 VQ3

```pseudo
accelerateGround(v, wd, ws) {
  curr = dot(v, wd)
  addSpeed = ws - curr
  accelSpeed = groundAccel * ws * fixedDT
  return v + wd * min(addSpeed, accelSpeed)
}
```

### 🟡 CPM

```pseudo
accelerateAir(v, wd, ws) {
  curr = dot(v, wd)
  addSpeed = ws - curr
  accelSpeed = (airAccel + airControlFactor) * ws * fixedDT
  return v + wd * min(addSpeed, accelSpeed)
}
```

---

## 🗺️ 10. Representación de mapas

Cada `.bsp` contiene superficies faces y en muchos casos patch surfaces (curvas) que se tesselan en triángulos para GPU.

Las coordenadas de lightmap se usan para iluminación estática en mapas.

Assets (texturas, materiales) también están dentro de los `.pk3`.

---

## 🧩 11. Contexto de proyecto DefragJS

Objetivo: recrear DeFRaG en web con física fiel, colisiones robustas y render moderno.

En el proyecto definimos:

- `ITraceWorld`: interfaz de colisión unificada.
- Cachés de BVH para colisiones de triángulos.
- MOS de brushes para física más exacta posterior.
- Separación de física (VQ3 vs CPM) mediante parámetros.
