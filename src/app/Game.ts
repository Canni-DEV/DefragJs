import * as THREE from 'three';
import { VirtualFS } from '../engine/io/pk3/VirtualFS';
import { Pk3Archive } from '../engine/io/pk3/Pk3Archive';
import { BspParser } from '../engine/io/bsp/BspParser';
import { EntityParser } from '../engine/io/bsp/EntityParser';
import { MapRenderer } from '../engine/render/MapRenderer';
import { TriMeshTraceWorld } from '../engine/physics/worlds/TriMeshTraceWorld';
import { PlayerController } from '../engine/physics/player/PlayerController';
import { CameraRig } from '../engine/physics/player/CameraRig';
import { FixedTimestep } from '../engine/core/FixedTimestep';
import { GameLoop } from './GameLoop';
import { FileMountPanel } from './UI/FileMountPanel';
import { MapSelectPanel } from './UI/MapSelectPanel';
import { DebugPanel } from './UI/DebugPanel';
import { Hud } from './UI/Hud';
import { Q3Vanilla } from '../engine/physics/movement/Q3Vanilla';
import { CPM } from '../engine/physics/movement/CPM';
import { PhysicsMode } from '../engine/physics/movement/PhysicsModes';
import { BUTTON_JUMP, UserCmd } from '../engine/physics/movement/PmoveTypes';
import { ITraceWorld } from '../engine/physics/ITraceWorld';
import { Contents, TraceBoxRequest, TraceResult } from '../engine/physics/TraceTypes';
import { EntityWorld } from '../engine/gameplay/entities/EntityWorld';
import { TriggerSystem } from '../engine/gameplay/defrag/TriggerSystem';
import { TimerSystem } from '../engine/gameplay/defrag/TimerSystem';
import { TeleportSystem } from '../engine/gameplay/defrag/TeleportSystem';
import { AABB } from '../engine/core/Math/AABB';
import { Vec3 } from '../engine/core/Math/Vec3';

class NullTraceWorld implements ITraceWorld {
  traceBox(req: TraceBoxRequest): TraceResult {
    return {
      fraction: 1,
      endPos: req.end.clone(),
      planeNormal: new Vec3(0, 0, 1),
      startSolid: false,
      allSolid: false,
      contents: Contents.EMPTY,
    };
  }
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private worldGroup: THREE.Group | null = null;

  private readonly vfs = new VirtualFS();
  private mountedNames: string[] = [];
  private mapData: ReturnType<typeof BspParser.parse> | null = null;
  private mapRenderer = new MapRenderer();
  private traceWorld: ITraceWorld = new NullTraceWorld();

  private readonly player = new PlayerController(this.traceWorld, Q3Vanilla);
  private readonly cameraRig = new CameraRig();
  private physicsMode: PhysicsMode = Q3Vanilla;

  private triggerSystem: TriggerSystem | null = null;
  private teleportSystem: TeleportSystem | null = null;
  private readonly timerSystem = new TimerSystem();

  private readonly hud = new Hud();
  private readonly input = new InputState();
  private readonly loop: GameLoop;

  private wireframe = false;

  constructor(private readonly root: HTMLElement) {
    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';
    canvasContainer.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.up.set(0, 0, 1);
    this.scene.background = new THREE.Color(0x0b0f14);
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 20000);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.7);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(300, 400, 800);
    this.scene.add(hemi, dir);

    this.root.appendChild(canvasContainer);

    const uiRoot = document.createElement('div');
    uiRoot.className = 'ui-root';
    this.root.appendChild(uiRoot);

    const filePanel = new FileMountPanel((files) => void this.mountFiles(files));
    const mapPanel = new MapSelectPanel((mapPath) => void this.loadMap(mapPath));
    const debugPanel = new DebugPanel({
      onWireframe: (enabled) => {
        this.wireframe = enabled;
        if (this.mapData) {
          this.buildMap();
        }
      },
      onPhysicsMode: (mode) => this.setPhysicsMode(mode),
    });

    uiRoot.append(filePanel.element, mapPanel.element, debugPanel.element, this.hud.element);

    this.loop = new GameLoop(new FixedTimestep(0.016), (dt) => this.update(dt), () => this.render());

    window.addEventListener('resize', () => this.onResize());

    this.input.attach(this.renderer.domElement);
    this.onMountedUpdate = (names) => filePanel.setMounted(names);
    this.onMapsUpdate = (maps) => mapPanel.setMaps(maps);
  }

  private onMountedUpdate: (names: string[]) => void = () => {};
  private onMapsUpdate: (maps: string[]) => void = () => {};

  async init(): Promise<void> {
    this.loop.start();
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private async mountFiles(files: FileList): Promise<void> {
    const names: string[] = [];
    for (const file of Array.from(files)) {
      const buffer = await file.arrayBuffer();
      const archive = Pk3Archive.fromArrayBuffer(buffer);
      this.vfs.mount(archive);
      names.push(file.name);
    }
    this.mountedNames = [...this.mountedNames, ...names];
    this.onMountedUpdate(this.mountedNames);
    this.refreshMapList();
  }

  private refreshMapList(): void {
    const maps = this.vfs.list('maps/').filter((path) => path.endsWith('.bsp'));
    this.onMapsUpdate(maps);
  }

  private loadMap(mapPath: string): void {
    const data = this.vfs.readFile(mapPath);
    if (!data) {
      return;
    }
    const bytes = new Uint8Array(data);
    this.mapData = BspParser.parse(bytes.buffer);
    this.buildMap();

    const entities = EntityParser.parseEntities(this.mapData.entities);
    const entityWorld = new EntityWorld(entities);
    this.triggerSystem = TriggerSystem.fromEntityWorld(entityWorld);
    this.teleportSystem = TeleportSystem.fromEntityWorld(entityWorld);
    this.timerSystem.reset();

    this.spawnPlayer(entityWorld);
  }

  private buildMap(): void {
    if (!this.mapData) {
      return;
    }
    if (this.worldGroup) {
      this.scene.remove(this.worldGroup);
      this.worldGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
    }
    this.worldGroup = this.mapRenderer.build(this.mapData, { wireframe: this.wireframe, patchSubdiv: 5 });
    this.scene.add(this.worldGroup);
    this.traceWorld = TriMeshTraceWorld.fromBsp(this.mapData, 4);
    this.player.setTraceWorld(this.traceWorld);
  }

  private spawnPlayer(entityWorld: EntityWorld): void {
    const spawn =
      entityWorld.findFirstByClass('info_player_deathmatch') ||
      entityWorld.findFirstByClass('info_player_start') ||
      entityWorld.findFirstByClass('info_player_team1') ||
      entityWorld.findFirstByClass('info_player_team2');
    const origin = parseVec3(spawn?.properties.origin) ?? new Vec3();
    this.player.teleport(origin);
  }

  private setPhysicsMode(modeId: 'VQ3' | 'CPM'): void {
    this.physicsMode = modeId === 'CPM' ? CPM : Q3Vanilla;
    this.player.setMode(this.physicsMode);
    this.player.state.velocity.set(0, 0, 0);
  }

  private update(dt: number): void {
    const cmd = this.input.buildUserCmd(dt);
    this.player.step(cmd);

    if (this.triggerSystem) {
      const bounds = new AABB().setFromCenterExtents(
        this.player.state.position,
        this.player.state.bboxMins,
        this.player.state.bboxMaxs
      );
      const entered = this.triggerSystem.update(bounds);
      for (const trigger of entered) {
        switch (trigger.type) {
          case 'start':
            this.timerSystem.start();
            break;
          case 'stop':
            this.timerSystem.stop();
            break;
          case 'checkpoint':
            this.timerSystem.checkpoint();
            break;
          case 'teleport': {
            const target = this.teleportSystem?.resolveTarget(trigger.target);
            if (target) {
              this.player.teleport(target);
            }
            break;
          }
        }
      }
    }

    this.timerSystem.tick(dt);
    this.hud.update(this.timerSystem.elapsedMs, this.timerSystem.splits);

    this.cameraRig.apply(this.camera, this.player.state, this.input.viewYaw, this.input.viewPitch);
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}

class InputState {
  private readonly keys = new Set<string>();
  viewYaw = 0;
  viewPitch = 0;
  private pointerLocked = false;

  attach(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });

    canvas.addEventListener('click', () => {
      void canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });

    window.addEventListener('mousemove', (event) => {
      if (!this.pointerLocked) {
        return;
      }
      const sensitivity = 0.12;
      this.viewYaw = (this.viewYaw - event.movementX * sensitivity) % 360;
      this.viewPitch = Math.max(-85, Math.min(85, this.viewPitch + event.movementY * sensitivity));
    });
  }

  buildUserCmd(dt: number): UserCmd {
    const forward = this.keyAxis('KeyW', 'KeyS');
    const right = this.keyAxis('KeyD', 'KeyA');
    const up = this.keyAxis('Space', 'ControlLeft');

    const buttons = this.keys.has('Space') ? BUTTON_JUMP : 0;

    return {
      forwardmove: forward,
      rightmove: right,
      upmove: up,
      buttons,
      msec: Math.round(dt * 1000),
      viewYaw: this.viewYaw,
      viewPitch: this.viewPitch,
    };
  }

  private keyAxis(positive: string, negative: string): number {
    const pos = this.keys.has(positive);
    const neg = this.keys.has(negative);
    if (pos === neg) {
      return 0;
    }
    return pos ? 1 : -1;
  }
}

function parseVec3(value: string | undefined): Vec3 | null {
  if (!value) {
    return null;
  }
  const parts = value.trim().split(/\s+/).map((v) => Number(v));
  const x = parts[0];
  const y = parts[1];
  const z = parts[2];
  if (x === undefined || y === undefined || z === undefined || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
    return null;
  }
  return new Vec3(x, y, z);
}
