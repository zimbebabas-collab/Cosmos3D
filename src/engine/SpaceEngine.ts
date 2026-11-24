import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AU_KM,
  BODY_BY_ID,
  CELESTIAL_CATALOG,
  type CelestialBodyData,
} from '../data/celestialCatalog';
import {
  applyLogZoom,
  clampOrbitDistance,
  classifyScaleTier,
  computeAllSolarPositionsKm,
  computeDynamicRenderScale,
  computeTimeDilationFactor,
  formatDistanceRu,
  formatTimeDilationRu,
  getScalePresetDistance,
  isWithinScanRange,
  projectBodyToScene,
  type DoubleVec3,
  type ScaleTier,
} from './scaleMath';
import {
  createAtmosphereMaterial,
  createPlanetMaterial,
  createPlanetaryRingMaterial,
} from './shaders/planetShader';
import { createSunCoronaMaterial, createSunMaterial } from './shaders/sunShader';
import { createBlackHoleMaterial } from './shaders/blackHoleShader';
import {
  buildDeepStarfield,
  buildMilkyWayGroup,
  buildPulsarGroup,
} from './shaders/deepSpaceShaders';
import {
  buildAsteroidBeltMesh,
  buildOrbitalStationGroup,
  buildQuasarGroup,
  buildWarpStreaks,
} from './compositeModels';
import { SpaceAudio } from './audio';

export type GameMode = 'title' | 'playing' | 'paused';

export interface ProjectedMarker {
  id: string;
  nameRu: string;
  accentHex: string;
  x: number; // viewport px
  y: number; // viewport px
  distanceLabel: string;
  isFocused: boolean;
}

export interface EngineTelemetry {
  focusedId: string;
  focusedNameRu: string;
  focusedSubtitleRu: string;
  scaleTier: ScaleTier;
  altitudeLabel: string;
  distanceLabel: string;
  detailPercent: number;
  timeRateLabel: string;
  timeDilationLabel: string | null;
  canScan: boolean;
  isGalacticMode: boolean;
  warpActive: boolean;
  markers: ProjectedMarker[];
  issVisible: boolean;
}

// Reusable scratch objects (zero-GC inside render loop)
const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _v3c = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _sunDir = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _mat4Inv = new THREE.Matrix4();

interface SolarMeshEntry {
  body: CelestialBodyData;
  root: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  atmosphereMat?: THREE.ShaderMaterial;
  ringMat?: THREE.ShaderMaterial;
}

export class SpaceEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private audio: SpaceAudio;

  // Groups for different cosmic domains
  private solarGroup = new THREE.Group();
  private deepSpaceGroup = new THREE.Group();
  private galacticGroup = new THREE.Group();

  // Solar System meshes
  private solarEntries = new Map<string, SolarMeshEntry>();
  private sunCoronaMesh!: THREE.Mesh;
  private sunCoronaMat!: THREE.ShaderMaterial;
  private issGroup!: THREE.Group;
  private asteroidBelt!: THREE.InstancedMesh;
  private orbitLinesGroup = new THREE.Group();

  // Deep Space wonders
  private blackHoleGroup = new THREE.Group();
  private blackHoleMat!: THREE.ShaderMaterial;
  private quasarGroup!: THREE.Group;
  private quasarDiskMat!: THREE.ShaderMaterial;
  private quasarJetMat!: THREE.ShaderMaterial;
  private pulsarGroup!: THREE.Group;
  private pulsarSpinPivot!: THREE.Group;
  private milkyWayGroup!: THREE.Group;

  // Starfield & Warp streaks
  private starfield!: THREE.Points;
  private warpLines!: THREE.LineSegments;
  private warpMat!: THREE.LineBasicMaterial;

  // Lighting
  private keyLight!: THREE.DirectionalLight;

  // Simulation & Camera State
  private mode: GameMode = 'title';
  private focusedId = 'earth';
  private isGalacticMode = false;
  private simTimeSec = 0;
  private timeRate = 1; // 0 = paused, 1 = real-time, 3600 = fast, 86400 = 1 day/sec
  private elapsedReal = 0;

  // Spherical orbit camera coordinates around focused body
  // Earth initial angle = 0.42 rad -> sunDir ~= (-0.91, 0, -0.41) -> yaw = -2.28 frames 60% sunlit / 40% night-cities terminator!
  private yaw = -2.28;
  private pitch = 0.18;
  private targetYaw = -2.28;
  private targetPitch = 0.18;
  private orbitDistance = 6_371 * 2.75; // km (or ly when focusedId === 'galaxy')
  private targetOrbitDistance = 6_371 * 2.75;

  // Title-screen subtle pointer parallax
  private pointerNdcX = 0;
  private pointerNdcY = 0;

  // Hyper-warp transition state
  private warpTimer = 0;
  private warpDuration = 0;

  // Input state
  private keys = new Set<string>();
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private showOrbits = true;

  // Loop & lifecycle
  private frameId = 0;
  private lastFrameMs = 0;
  private lastTelemetryMs = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private onTelemetry: (telemetry: EngineTelemetry) => void;

  // Latest computed solar positions cache
  private solarPosKm = new Map<string, DoubleVec3>();

  constructor(
    container: HTMLElement,
    onTelemetry: (telemetry: EngineTelemetry) => void,
    audio: SpaceAudio,
  ) {
    this.container = container;
    this.onTelemetry = onTelemetry;
    this.audio = audio;

    // 1. Software WebGL detection from GPU renderer string (never user-agent)
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer (floating-origin + perspective-exact far shell keeps standard depth crisp & fast across 1:1 scales!)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x02040a, 1);

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.dataset.testid = 'space-canvas';
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera (camera stays at origin (0,0,0) via floating origin!)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);

    // Mandatory studio environment map for metallic ISS / asteroids
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.04, 800_000);
    this.camera.position.set(0, 0, 0);

    // 4. Lighting rig (Warm solar directional key + cool starlight hemisphere fill)
    this.keyLight = new THREE.DirectionalLight(0xfff4e0, 2.4);
    this.keyLight.position.set(100, 30, 50);
    this.scene.add(this.keyLight);

    const hemiLight = new THREE.HemisphereLight(0x6088c8, 0x0b1020, 0.55);
    this.scene.add(hemiLight);

    // 5. Build all cosmic content
    this.buildUniverse();

    // 6. Initialize Title framing directly on Earth's sunlit/night-cities terminator (right side of viewport!)
    const initYaw = this.computeTerminatorYaw('earth', 0.95);
    this.yaw = initYaw;
    this.targetYaw = initYaw;
    this.pitch = 0.16;
    this.targetPitch = 0.16;
    this.orbitDistance = BODY_BY_ID.earth.radiusKm * 2.55;
    this.targetOrbitDistance = BODY_BY_ID.earth.radiusKm * 2.55;

    // 7. Attach input & resize listeners
    this.attachEvents();

    // Pre-warm shaders on hardware GPUs (skip on software WebGL)
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Initial state update and start loop
    this.lastFrameMs = performance.now();
    this.tick();
  }

  private buildUniverse(): void {
    // Deep background spectral starfield
    this.starfield = buildDeepStarfield();
    this.scene.add(this.starfield);

    // Warp streaks attached to camera direction
    const warp = buildWarpStreaks();
    this.warpLines = warp.lines;
    this.warpMat = warp.material;
    this.scene.add(this.warpLines);

    // ==================== SOLAR SYSTEM ====================
    this.scene.add(this.solarGroup);
    this.solarGroup.add(this.orbitLinesGroup);

    // Shared high-resolution sphere for rocky worlds (supports crisp vertex terrain displacement on close-up!)
    const rockySphereGeo = new THREE.SphereGeometry(1, 96, 64);
    const gasSphereGeo = new THREE.SphereGeometry(1, 64, 48);
    const atmoSphereGeo = new THREE.SphereGeometry(1, 48, 32);

    for (const body of CELESTIAL_CATALOG) {
      if (body.category !== 'star' && body.category !== 'planet' && body.category !== 'moon') {
        continue;
      }

      const root = new THREE.Group();
      root.rotation.z = THREE.MathUtils.degToRad(body.axialTiltDeg);

      let mat: THREE.ShaderMaterial;
      let geo: THREE.BufferGeometry;

      if (body.shaderType === 'sun') {
        mat = createSunMaterial();
        geo = gasSphereGeo;
      } else {
        mat = createPlanetMaterial(body.shaderType);
        geo = body.hasRockyTerrain ? rockySphereGeo : gasSphereGeo;
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      root.add(mesh);

      let atmosphereMat: THREE.ShaderMaterial | undefined;
      if (body.atmosphereColor && body.atmosphereScale) {
        atmosphereMat = createAtmosphereMaterial(body.atmosphereColor);
        const atmoMesh = new THREE.Mesh(atmoSphereGeo, atmosphereMat);
        atmoMesh.scale.setScalar(body.atmosphereScale);
        atmoMesh.frustumCulled = false;
        root.add(atmoMesh);
      }

      let ringMat: THREE.ShaderMaterial | undefined;
      if (body.rings) {
        ringMat = createPlanetaryRingMaterial(
          body.rings.colorHex,
          body.rings.opacity,
          body.rings.innerFactor,
          body.rings.outerFactor,
        );
        const ringGeo = new THREE.RingGeometry(
          body.rings.innerFactor,
          body.rings.outerFactor,
          96,
        );
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.frustumCulled = false;
        root.add(ringMesh);
      }

      // Sun volumetric corona billboard
      if (body.shaderType === 'sun') {
        this.sunCoronaMat = createSunCoronaMaterial();
        this.sunCoronaMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.8), this.sunCoronaMat);
        this.sunCoronaMesh.frustumCulled = false;
        root.add(this.sunCoronaMesh);
      }

      this.solarGroup.add(root);
      this.solarEntries.set(body.id, {
        body,
        root,
        mesh,
        material: mat,
        atmosphereMat,
        ringMat,
      });

      // Subtle orbital ring line around parent (Sun) for 1:1 system overview readability
      if (body.parentId === 'sun' && body.semiMajorAxisKm > 0) {
        const pts: THREE.Vector3[] = [];
        const segs = 128;
        const rAu = body.semiMajorAxisKm / AU_KM;
        const inc =
          body.id === 'mercury' ? THREE.MathUtils.degToRad(7) : THREE.MathUtils.degToRad(1.5);
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          pts.push(
            new THREE.Vector3(
              Math.cos(a) * rAu,
              Math.sin(a) * Math.sin(inc) * rAu,
              Math.sin(a) * Math.cos(inc) * rAu,
            ),
          );
        }
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const orbitMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(body.accentHex),
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        });
        const line = new THREE.Line(orbitGeo, orbitMat);
        line.frustumCulled = false;
        this.orbitLinesGroup.add(line);
      }
    }

    // Composite 10-part Orbital Station (ISS) orbiting Earth at 408 km altitude
    this.issGroup = buildOrbitalStationGroup();
    this.solarGroup.add(this.issGroup);

    // Main Asteroid Belt between Mars & Jupiter
    this.asteroidBelt = buildAsteroidBeltMesh();
    this.solarGroup.add(this.asteroidBelt);

    // ==================== DEEP SPACE WONDERS ====================
    this.scene.add(this.deepSpaceGroup);
    this.deepSpaceGroup.visible = false;

    // 1. Interstellar Gargantua Black Hole (geodesic raymarched sphere, radius 10 in local units)
    this.blackHoleMat = createBlackHoleMaterial();
    const bhMesh = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 32), this.blackHoleMat);
    bhMesh.frustumCulled = false;
    this.blackHoleGroup.add(bhMesh);
    this.deepSpaceGroup.add(this.blackHoleGroup);

    // 2. Quasar 3C 273 (accretion vortex + twin plasma jets)
    const quasar = buildQuasarGroup();
    this.quasarGroup = quasar.group;
    this.quasarDiskMat = quasar.diskMat;
    this.quasarJetMat = quasar.jetMat;
    this.quasarGroup.rotation.z = THREE.MathUtils.degToRad(22);
    this.deepSpaceGroup.add(this.quasarGroup);

    // 3. Pulsar PSR B1919+21 (spinning neutron star lighthouse)
    const pulsar = buildPulsarGroup();
    this.pulsarGroup = pulsar.group;
    this.pulsarSpinPivot = pulsar.spinPivot;
    this.deepSpaceGroup.add(this.pulsarGroup);

    // ==================== MILKY WAY GALAXY ====================
    this.milkyWayGroup = buildMilkyWayGroup();
    this.galacticGroup.add(this.milkyWayGroup);
    this.galacticGroup.visible = false;
    this.scene.add(this.galacticGroup);
  }

  private attachEvents(): void {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    dom.addEventListener('webglcontextlost', this.onContextLost);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', this.handleResize);
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.mode !== 'playing') return;
    if (e.button !== 0) return;
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.audio.unlock();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.pointerNdcX = (e.clientX / w) * 2 - 1;
    this.pointerNdcY = -(e.clientY / h) * 2 + 1;

    if (!this.isDragging || this.mode !== 'playing') return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    // Fine-tune angular sensitivity when skimming low over planetary surface
    const body = BODY_BY_ID[this.focusedId];
    const isCloseSurface =
      !this.isGalacticMode &&
      body.hasRockyTerrain &&
      this.orbitDistance < body.radiusKm * 1.15;
    const sens = isCloseSurface ? 0.0022 : 0.0052;

    this.targetYaw -= dx * sens;
    this.targetPitch = THREE.MathUtils.clamp(
      this.targetPitch + dy * sens,
      -Math.PI * 0.48,
      Math.PI * 0.48,
    );
  };

  private onPointerUp = (): void => {
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.mode !== 'playing') return;
    e.preventDefault();
    this.audio.unlock();

    const body = BODY_BY_ID[this.focusedId];
    const delta = Math.sign(e.deltaY) * Math.min(2.0, Math.abs(e.deltaY) / 90);

    if (this.isGalacticMode || body.category === 'galaxy') {
      const next = applyLogZoom(this.targetOrbitDistance, BODY_BY_ID.galaxy, delta, 175_000);
      this.targetOrbitDistance = next;
      // Seamless automatic drop back into Solar System if zooming deep into Orion arm when focused on galaxy
      if (this.focusedId === 'galaxy' && next <= 5_400 && delta < 0) {
        this.focusBody('earth', 'orbit', false);
      }
      return;
    }

    const maxDist =
      body.category === 'deep_space' ? body.radiusKm * 45 : AU_KM * 42;
    const next = applyLogZoom(this.targetOrbitDistance, body, delta, maxDist);
    this.targetOrbitDistance = next;

    // Seamless transition to Milky Way Galaxy when zooming way past outer Solar System!
    if (body.category !== 'deep_space' && next >= AU_KM * 38 && delta > 0) {
      this.focusBody('galaxy', 'orbit', true);
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onWindowBlur = (): void => {
    this.keys.clear();
    this.isDragging = false;
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.keys.clear();
      this.isDragging = false;
    }
  };

  // ==================== PUBLIC API FOR REACT SHELL ====================

  public setMode(mode: GameMode): void {
    this.mode = mode;
    if (mode !== 'playing') {
      this.keys.clear();
      this.isDragging = false;
    }
    if (mode === 'playing') {
      this.audio.unlock();
      // Smoothly settle onto Earth's sunlit/night terminator when launching from Title Menu
      if (this.focusedId === 'earth' && !this.isGalacticMode) {
        this.targetYaw = this.computeTerminatorYaw('earth', 0.62);
        this.targetPitch = 0.18;
      }
    }
  }

  public setTimeRate(rate: number): void {
    this.timeRate = rate;
  }

  public setShowOrbits(show: boolean): void {
    this.showOrbits = show;
  }

  public getFocusedId(): string {
    return this.focusedId;
  }

  /**
   * Warps smoothly (with relativistic star-streak visual & audio) to any planet,
   * moon, Gargantua Black Hole, Quasar 3C 273, Pulsar, or Milky Way Galaxy!
   */
  public focusBody(
    id: string,
    preset: 'surface' | 'orbit' | 'system' = 'orbit',
    withWarpEffect = true,
  ): void {
    const body = BODY_BY_ID[id];
    if (!body) return;

    const targetDist = getScalePresetDistance(body, preset);
    const isNewTarget = id !== this.focusedId;

    this.applyBodySwitch(id, targetDist);

    if (withWarpEffect && isNewTarget) {
      this.warpDuration = 0.65;
      this.warpTimer = this.warpDuration;
      this.audio.playWarpJump();
    }
    this.emitTelemetry();
  }

  public setZoomPreset(preset: 'surface' | 'orbit' | 'system' | 'galactic'): void {
    if (preset === 'galactic') {
      this.focusBody('galaxy', 'orbit', this.focusedId !== 'galaxy');
      return;
    }
    const body = BODY_BY_ID[this.focusedId];
    if (body.category === 'galaxy') {
      this.focusBody('earth', preset, true);
      return;
    }
    this.targetOrbitDistance = getScalePresetDistance(body, preset);
    if (preset === 'surface' && body.id === 'earth') {
      // Aim right across Earth's twilight terminator so BOTH sunlit mountain landscape AND glowing night cities fill the viewport!
      this.targetYaw = this.computeTerminatorYaw('earth', 1.12);
      this.targetPitch = 0.22;
    }
    this.audio.playUiTick();
  }

  /**
   * Computes camera yaw offset from the Sun-to-body vector so every planet is framed
   * on a dramatic sunlit crescent/terminator (never accidentally pitch-black).
   */
  private computeTerminatorYaw(id: string, offsetRad = 0.65): number {
    const positions =
      this.solarPosKm.size > 0 ? this.solarPosKm : computeAllSolarPositionsKm(this.simTimeSec);
    const sunPos = positions.get('sun') ?? { x: 0, y: 0, z: 0 };
    const bPos = positions.get(id) ?? { x: AU_KM, y: 0, z: 0 };
    const dx = sunPos.x - bPos.x;
    const dz = sunPos.z - bPos.z;
    if (dx * dx + dz * dz < 1) return 0.65;
    const sunYaw = Math.atan2(dx, dz);
    return sunYaw + offsetRad;
  }

  private applyBodySwitch(id: string, targetDist: number): void {
    const body = BODY_BY_ID[id];
    if (!body) return;
    this.focusedId = id;
    this.isGalacticMode = body.category === 'galaxy';

    this.orbitDistance = targetDist * 1.38;
    this.targetOrbitDistance = targetDist;

    if (body.shaderType === 'blackhole') {
      this.yaw = 0.35;
      this.targetYaw = 0.42;
      this.pitch = 0.22;
      this.targetPitch = 0.21;
    } else if (body.shaderType === 'quasar') {
      this.yaw = 0.6;
      this.targetYaw = 0.65;
      this.pitch = 0.28;
      this.targetPitch = 0.26;
    } else if (body.shaderType === 'galaxy') {
      this.yaw = 0.45;
      this.targetYaw = 0.55;
      this.pitch = 0.62;
      this.targetPitch = 0.58;
    } else if (body.id === 'earth') {
      const y = this.computeTerminatorYaw('earth', 0.72);
      this.yaw = y - 0.08;
      this.targetYaw = y;
      this.pitch = 0.19;
      this.targetPitch = 0.18;
    } else if (body.id === 'saturn') {
      const y = this.computeTerminatorYaw('saturn', 0.52);
      this.yaw = y - 0.08;
      this.targetYaw = y;
      this.pitch = 0.34;
      this.targetPitch = 0.32;
    } else {
      const y = this.computeTerminatorYaw(body.id, 0.55);
      this.yaw = y - 0.08;
      this.targetYaw = y;
      this.pitch = 0.20;
      this.targetPitch = 0.19;
    }
  }

  // ==================== MAIN SIMULATION LOOP ====================

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastFrameMs) / 1000);
    const dt = Math.min(rawDt, 0.05); // clamped dt per game craft guidelines
    this.lastFrameMs = now;

    if (this.mode !== 'paused') {
      this.elapsedReal += dt;
      this.simTimeSec += dt * this.timeRate;
    }

    this.updateWarp(Math.min(rawDt, 0.25));
    this.updateCameraControls(dt);
    this.updateSceneObjects(dt);

    this.renderer.render(this.scene, this.camera);

    // Throttled telemetry to React HUD (<= 8 Hz, never 60 Hz)
    if (now - this.lastTelemetryMs >= 130) {
      this.lastTelemetryMs = now;
      this.emitTelemetry();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private updateWarp(dt: number): void {
    if (this.warpTimer <= 0) {
      this.warpMat.opacity = THREE.MathUtils.damp(this.warpMat.opacity, 0, 8, dt);
      this.warpLines.visible = this.warpMat.opacity > 0.01;
      return;
    }

    this.warpTimer = Math.max(0, this.warpTimer - dt);
    const progress = 1 - this.warpTimer / Math.max(0.001, this.warpDuration);
    // Bell-curve intensity peaking at 0.5 when switching targets
    const bell = Math.sin(progress * Math.PI);

    this.warpLines.visible = true;
    this.warpMat.opacity = bell * 0.85;
    this.warpLines.quaternion.copy(this.camera.quaternion);
    this.warpLines.position.set(0, 0, 0);
    // Subtle relativistic FOV widening during warp!
    const targetFov = 48 + bell * 24;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    if (this.warpTimer <= 0 && Math.abs(this.camera.fov - 46) > 0.05) {
      this.camera.fov = 46;
      this.camera.updateProjectionMatrix();
    }
  }

  private updateCameraControls(dt: number): void {
    const body = BODY_BY_ID[this.focusedId];

    if (this.mode === 'title') {
      // Cinematic slow orbital flyover across Earth's sunlit/night-cities terminator with subtle cursor parallax
      const baseYaw = this.computeTerminatorYaw('earth', 0.95);
      this.targetYaw = baseYaw + Math.sin(this.elapsedReal * 0.08) * 0.14 + this.pointerNdcX * 0.12;
      this.targetPitch = 0.16 + this.pointerNdcY * 0.08;
      this.targetOrbitDistance = body.radiusKm * 2.55;
    } else if (this.mode === 'playing') {
      const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 2.8 : 1.0;
      const isCloseSurface =
        !this.isGalacticMode &&
        body.hasRockyTerrain &&
        this.orbitDistance < body.radiusKm * 1.15;
      const rotSpeed = (isCloseSurface ? 0.32 : 1.15) * boost;

      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
        this.targetYaw -= rotSpeed * dt;
      }
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
        this.targetYaw += rotSpeed * dt;
      }
      if (this.keys.has('KeyR')) {
        this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + rotSpeed * 0.8 * dt, -1.5, 1.5);
      }
      if (this.keys.has('KeyF')) {
        this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - rotSpeed * 0.8 * dt, -1.5, 1.5);
      }

      // W / S or Up / Down = logarithmic approach / pull-back
      let zoomDir = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) zoomDir -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) zoomDir += 1;

      if (zoomDir !== 0) {
        const maxDist =
          this.isGalacticMode || body.category === 'galaxy'
            ? 175_000
            : body.category === 'deep_space'
              ? body.radiusKm * 45
              : AU_KM * 42;
        const next = applyLogZoom(
          this.targetOrbitDistance,
          this.isGalacticMode ? BODY_BY_ID.galaxy : body,
          zoomDir * dt * 4.5 * boost,
          maxDist,
        );
        this.targetOrbitDistance = next;
      }
    }

    // Frame-rate-independent exponential damping
    const dampLambda = this.isSoftwareGl ? 14 : 7.5;
    this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, dampLambda, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, dampLambda, dt);
    this.orbitDistance = THREE.MathUtils.damp(
      this.orbitDistance,
      this.targetOrbitDistance,
      dampLambda,
      dt,
    );
  }

  private updateSceneObjects(dt: number): void {
    const focused = BODY_BY_ID[this.focusedId];

    // Direction vector from focused body center to camera (unit sphere)
    const cosP = Math.cos(this.pitch);
    const camDirX = Math.sin(this.yaw) * cosP;
    const camDirY = Math.sin(this.pitch);
    const camDirZ = Math.cos(this.yaw) * cosP;

    // Camera stays at (0,0,0) in render space; rotate camera to look toward focused body
    _v3a.set(-camDirX, -camDirY, -camDirZ).normalize();
    // Slight composition shift to the right while in Title Menu so left dark-glass panel sits over calm space!
    if (this.mode === 'title') {
      _v3b.set(0, 1, 0);
      _v3c.crossVectors(_v3a, _v3b).normalize(); // camera right
      _v3a.addScaledVector(_v3c, -0.24).normalize();
    } else if (!this.isGalacticMode && focused.hasRockyTerrain) {
      // Subtle horizon pitch-up when skimming very low over terrain so mountains & horizon fill the landscape frame!
      const altRatio = Math.max(0, (this.orbitDistance - focused.radiusKm) / focused.radiusKm);
      const skimBlend = THREE.MathUtils.smoothstep(0.08 - altRatio, 0, 0.065);
      if (skimBlend > 0.001) {
        _v3b.set(0, 1, 0);
        // Tangent forward along horizon
        _v3c.crossVectors(_v3b, _v3a).normalize();
        const horizonDir = _v3b.crossVectors(_v3a, _v3c).normalize();
        _v3a.lerp(horizonDir, skimBlend * 0.42).normalize();
      }
    }

    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(_v3a);
    this.camera.updateMatrixWorld();

    // Update subtle starfield parallax orientation (infinite skybox)
    this.starfield.position.set(0, 0, 0);

    // ==================== BRANCH 1: GALACTIC MODE ====================
    if (this.isGalacticMode || focused.category === 'galaxy') {
      this.solarGroup.visible = false;
      this.deepSpaceGroup.visible = false;
      this.issGroup.visible = false;
      this.galacticGroup.visible = true;

      // Map light-years to render units (1 unit = 100 ly)
      const lyScale = 0.01;
      const distUnits = this.orbitDistance * lyScale;
      this.milkyWayGroup.scale.setScalar(lyScale);
      this.milkyWayGroup.position.set(
        -camDirX * distUnits,
        -camDirY * distUnits,
        -camDirZ * distUnits,
      );
      this.milkyWayGroup.rotation.y = this.elapsedReal * 0.015;
      this.audio.updateAtmosphere(1.0, true);
      return;
    }

    // ==================== BRANCH 2: DEEP SPACE WONDERS ====================
    if (focused.category === 'deep_space') {
      this.solarGroup.visible = false;
      this.galacticGroup.visible = false;
      this.issGroup.visible = false;
      this.deepSpaceGroup.visible = true;

      this.blackHoleGroup.visible = focused.shaderType === 'blackhole';
      this.quasarGroup.visible = focused.shaderType === 'quasar';
      this.pulsarGroup.visible = focused.shaderType === 'pulsar';

      const renderScale = computeDynamicRenderScale(focused.radiusKm);
      const distUnits = this.orbitDistance * renderScale;
      const ox = -camDirX * distUnits;
      const oy = -camDirY * distUnits;
      const oz = -camDirZ * distUnits;

      if (focused.shaderType === 'blackhole') {
        // Black hole shader uses local radius 1.0 = Schwarzschild horizon, bounding sphere = 10.0
        const bhScale = focused.radiusKm * renderScale; // = 100.0
        this.blackHoleGroup.scale.setScalar(bhScale);
        this.blackHoleGroup.position.set(ox, oy, oz);
        this.blackHoleGroup.rotation.z = THREE.MathUtils.degToRad(14);
        this.blackHoleGroup.updateMatrixWorld(true);

        // Pass camera position in black hole's local space to geodesic raymarcher
        _mat4Inv.copy(this.blackHoleGroup.matrixWorld).invert();
        _v3b.set(0, 0, 0).applyMatrix4(_mat4Inv);
        this.blackHoleMat.uniforms.uLocalCamPos.value.copy(_v3b);
        this.blackHoleMat.uniforms.uTime.value = this.elapsedReal * 0.85;

        const dilation = computeTimeDilationFactor(this.orbitDistance, focused.radiusKm);
        this.audio.updateAtmosphere(dilation, false);
      } else if (focused.shaderType === 'quasar') {
        const qScale = focused.radiusKm * renderScale * 0.9;
        this.quasarGroup.scale.setScalar(qScale);
        this.quasarGroup.position.set(ox, oy, oz);
        this.quasarDiskMat.uniforms.uTime.value = this.elapsedReal;
        this.quasarJetMat.uniforms.uTime.value = this.elapsedReal;
        this.audio.updateAtmosphere(1.4, false);
      } else if (focused.shaderType === 'pulsar') {
        const pScale = focused.radiusKm * renderScale * 1.1;
        this.pulsarGroup.scale.setScalar(pScale);
        this.pulsarGroup.position.set(ox, oy, oz);
        // Real pulsar PSR B1919+21 period is 1.337s -> ~4.7 rad/s lighthouse sweep!
        this.pulsarSpinPivot.rotation.y += dt * 4.7;
        this.audio.updateAtmosphere(1.2, false);
      }
      return;
    }

    // ==================== BRANCH 3: REAL 1:1 SOLAR SYSTEM ====================
    this.solarGroup.visible = true;
    this.deepSpaceGroup.visible = false;
    this.galacticGroup.visible = false;

    this.solarPosKm = computeAllSolarPositionsKm(this.simTimeSec);
    const focusedPosKm = this.solarPosKm.get(focused.id) ?? { x: 0, y: 0, z: 0 };

    // Camera position in true 64-bit kilometers
    const cameraPosKm: DoubleVec3 = {
      x: focusedPosKm.x + camDirX * this.orbitDistance,
      y: focusedPosKm.y + camDirY * this.orbitDistance,
      z: focusedPosKm.z + camDirZ * this.orbitDistance,
    };

    const renderScale = computeDynamicRenderScale(focused.radiusKm);
    const sunPosKm = this.solarPosKm.get('sun') ?? { x: 0, y: 0, z: 0 };

    // Position orbit rings centered on the Sun in floating-origin render space
    const sunProj = projectBodyToScene(BODY_BY_ID.sun, sunPosKm, cameraPosKm, renderScale);
    this.orbitLinesGroup.position.set(sunProj.position.x, sunProj.position.y, sunProj.position.z);
    this.orbitLinesGroup.scale.setScalar(AU_KM * renderScale);
    const tier = classifyScaleTier(focused, this.orbitDistance, false);
    this.orbitLinesGroup.visible = this.showOrbits && tier === 'system';

    // Position Main Asteroid Belt centered on Sun
    this.asteroidBelt.position.set(sunProj.position.x, sunProj.position.y, sunProj.position.z);
    this.asteroidBelt.scale.setScalar(AU_KM * renderScale);
    this.asteroidBelt.rotation.y = this.simTimeSec * 1e-8;
    this.asteroidBelt.visible = tier === 'system' || focused.id === 'mars' || focused.id === 'jupiter';

    // Update directional key light pointing from Sun toward focused body
    _sunDir
      .set(
        sunPosKm.x - focusedPosKm.x,
        sunPosKm.y - focusedPosKm.y,
        sunPosKm.z - focusedPosKm.z,
      );
    if (_sunDir.lengthSq() < 1e-6) {
      _sunDir.set(1, 0.25, 0.5);
    }
    _sunDir.normalize();
    this.keyLight.position.copy(_sunDir).multiplyScalar(1000);

    // Update each Solar System body in floating-origin camera space
    // Bodies farther than 220,000 render units are mapped onto a perspective-exact celestial shell
    // so 1:1 true angular diameters remain 100% accurate inside the standard depth frustum!
    const MAX_RENDER_DIST = 220_000;
    for (const [id, entry] of this.solarEntries) {
      const bodyPosKm = this.solarPosKm.get(id) ?? { x: 0, y: 0, z: 0 };
      const proj = projectBodyToScene(entry.body, bodyPosKm, cameraPosKm, renderScale);

      const rawDist = Math.hypot(proj.position.x, proj.position.y, proj.position.z);
      if (rawDist > MAX_RENDER_DIST) {
        const shrink = MAX_RENDER_DIST / rawDist;
        entry.root.position.set(
          proj.position.x * shrink,
          proj.position.y * shrink,
          proj.position.z * shrink,
        );
        entry.root.scale.setScalar(Math.max(0.05, proj.renderRadius * shrink));
      } else {
        entry.root.position.set(proj.position.x, proj.position.y, proj.position.z);
        entry.root.scale.setScalar(proj.renderRadius);
      }

      // Sidereal planetary spin (gentle continuous rotation even at 1x so space feels alive)
      if (entry.body.rotationPeriodHours !== 0) {
        const spinRadPerSec =
          (Math.PI * 2) / (entry.body.rotationPeriodHours * 3600);
        // Add tiny visual baseline on Earth clouds/spin while keeping physical direction
        const visualSpin =
          this.timeRate === 0
            ? 0
            : this.simTimeSec * spinRadPerSec + (this.timeRate === 1 ? this.elapsedReal * 0.008 * Math.sign(spinRadPerSec) : 0);
        entry.mesh.rotation.y = visualSpin;
      }

      if (entry.body.shaderType === 'sun') {
        entry.material.uniforms.uTime.value = this.elapsedReal;
        this.sunCoronaMat.uniforms.uTime.value = this.elapsedReal;
        // Billboard corona toward camera
        _quatA.copy(this.camera.quaternion);
        this.sunCoronaMesh.quaternion.copy(_quatA);
      } else {
        // Compute exact Sun direction for THIS planet
        _v3b.set(
          sunPosKm.x - bodyPosKm.x,
          sunPosKm.y - bodyPosKm.y,
          sunPosKm.z - bodyPosKm.z,
        );
        if (_v3b.lengthSq() < 1e-6) _v3b.set(1, 0.2, 0.5);
        _v3b.normalize();

        entry.material.uniforms.uTime.value = this.elapsedReal;
        entry.material.uniforms.uSunDir.value.copy(_v3b);

        // Adaptive infinite surface detail + physical 3D vertex mountain relief when close!
        const altNorm = proj.altitudeKm / Math.max(1, entry.body.radiusKm);
        const detailLevel = THREE.MathUtils.clamp(1.0 - (altNorm - 0.015) / 1.4, 0.0, 1.0);
        entry.material.uniforms.uDetailLevel.value = detailLevel;

        if (entry.body.hasRockyTerrain) {
          // Physical vertex elevation relief fades in smoothly as you descend to low orbit/surface!
          const disp = THREE.MathUtils.smoothstep(0.65 - altNorm, 0.0, 0.6) * 0.012;
          entry.material.uniforms.uDisplaceAmp.value = disp;
        }

        if (entry.atmosphereMat) {
          entry.atmosphereMat.uniforms.uSunDir.value.copy(_v3b);
        }
        if (entry.ringMat) {
          entry.ringMat.uniforms.uSunDir.value.copy(_v3b);
        }
      }
    }

    // Position composite 10-part Orbital Station (ISS) at 408 km above Earth!
    const earthEntry = this.solarEntries.get('earth');
    const earthPosKm = this.solarPosKm.get('earth');
    if (earthEntry && earthPosKm && focused.id === 'earth' && this.orbitDistance < 6_371 * 6) {
      this.issGroup.visible = true;
      const issOrbitR = 6_371 + 408; // exact 408 km LEO altitude
      const issAngle = this.elapsedReal * 0.06 + 0.55;
      const issInc = THREE.MathUtils.degToRad(51.6); // exact ISS orbital inclination!
      const ix = earthPosKm.x + Math.cos(issAngle) * issOrbitR;
      const iy = earthPosKm.y + Math.sin(issAngle) * Math.sin(issInc) * issOrbitR;
      const iz = earthPosKm.z + Math.sin(issAngle) * Math.cos(issInc) * issOrbitR;

      this.issGroup.position.set(
        (ix - cameraPosKm.x) * renderScale,
        (iy - cameraPosKm.y) * renderScale,
        (iz - cameraPosKm.z) * renderScale,
      );
      // Scaled nicely so ISS silhouette is appreciable in low orbit without losing Earth's grandeur
      this.issGroup.scale.setScalar(1.35);
      this.issGroup.lookAt(earthEntry.root.position);
    } else {
      this.issGroup.visible = false;
    }

    this.audio.updateAtmosphere(1.0, false);
  }

  private emitTelemetry(): void {
    const focused = BODY_BY_ID[this.focusedId];
    const isGalactic = this.isGalacticMode || focused.category === 'galaxy';
    const scaleTier = classifyScaleTier(focused, this.orbitDistance, isGalactic);

    const altitude = isGalactic
      ? this.orbitDistance
      : Math.max(0, this.orbitDistance - focused.radiusKm);

    const altNorm = isGalactic ? 1 : altitude / Math.max(1, focused.radiusKm);
    const detailPercent = isGalactic
      ? 0
      : Math.round(THREE.MathUtils.clamp(1.0 - (altNorm - 0.015) / 1.4, 0, 1) * 100);

    let timeDilationLabel: string | null = null;
    if (focused.shaderType === 'blackhole') {
      const factor = computeTimeDilationFactor(this.orbitDistance, focused.radiusKm);
      // Apply relativistic Kerr spin amplification close to horizon for clear readout
      const kerrBoost = this.orbitDistance < focused.radiusKm * 7 ? Math.pow(factor, 2.6) : factor;
      timeDilationLabel = formatTimeDilationRu(kerrBoost);
    }

    const timeRateLabel =
      this.timeRate === 0
        ? 'Пауза'
        : this.timeRate === 1
          ? '1× (реал.)'
          : this.timeRate === 3600
            ? '1 ч/с'
            : '1 д/с';

    // Project clean 2D viewport markers for distant celestial bodies (guarded with v.z >= -1 && v.z <= 1)
    const markers: ProjectedMarker[] = [];
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    if (this.mode === 'playing') {
      if (isGalactic) {
        const galacticTargets = ['sun', 'gargantua', 'quasar', 'pulsar'];
        for (const tid of galacticTargets) {
          const b = BODY_BY_ID[tid];
          if (!b) continue;
          // Coordinates in Milky Way local space (light-years; milkyWayGroup.matrixWorld already applies lyScale!)
          const gx = b.id === 'sun' ? 14_000 : b.galacticPosLy[0];
          const gy = b.id === 'sun' ? 0 : b.galacticPosLy[1];
          const gz = b.id === 'sun' ? 22_500 : b.galacticPosLy[2] + 26_670;

          _proj.set(gx, gy, gz);
          _proj.applyMatrix4(this.milkyWayGroup.matrixWorld);
          _proj.project(this.camera);

          if (_proj.z >= -1 && _proj.z <= 1) {
            const sx = (_proj.x * 0.5 + 0.5) * width;
            const sy = (-_proj.y * 0.5 + 0.5) * height;
            if (sx > 30 && sx < width - 30 && sy > 50 && sy < height - 80) {
              markers.push({
                id: b.id === 'sun' ? 'earth' : b.id,
                nameRu: b.id === 'sun' ? 'Солнечная система' : b.nameRu,
                accentHex: b.accentHex,
                x: Math.round(sx),
                y: Math.round(sy),
                distanceLabel: b.id === 'sun' ? 'Рукав Ориона' : b.stats.distanceLabel.split(' ')[0] + ' св. лет',
                isFocused: false,
              });
            }
          }
        }
      } else if (focused.category !== 'deep_space' && scaleTier !== 'surface') {
        const focusedPosKm = this.solarPosKm.get(focused.id) ?? { x: 0, y: 0, z: 0 };
        const cosP = Math.cos(this.pitch);
        const camPosKm: DoubleVec3 = {
          x: focusedPosKm.x + Math.sin(this.yaw) * cosP * this.orbitDistance,
          y: focusedPosKm.y + Math.sin(this.pitch) * this.orbitDistance,
          z: focusedPosKm.z + Math.cos(this.yaw) * cosP * this.orbitDistance,
        };

        for (const [id, entry] of this.solarEntries) {
          if (id === focused.id && scaleTier === 'orbit') continue; // don't clutter close-up planet!
          const bPos = this.solarPosKm.get(id);
          if (!bPos) continue;

          _proj.copy(entry.root.position).project(this.camera);
          if (_proj.z >= -1 && _proj.z <= 1) {
            const sx = (_proj.x * 0.5 + 0.5) * width;
            const sy = (-_proj.y * 0.5 + 0.5) * height;
            if (sx > 48 && sx < width - 48 && sy > 64 && sy < height - 96) {
              const dist = Math.hypot(
                bPos.x - camPosKm.x,
                bPos.y - camPosKm.y,
                bPos.z - camPosKm.z,
              );
              markers.push({
                id,
                nameRu: entry.body.nameRu,
                accentHex: entry.body.accentHex,
                x: Math.round(sx),
                y: Math.round(sy),
                distanceLabel: formatDistanceRu(dist, 'km'),
                isFocused: id === focused.id,
              });
            }
          }
        }
      }
    }

    this.onTelemetry({
      focusedId: focused.id,
      focusedNameRu: focused.nameRu,
      focusedSubtitleRu: focused.subtitleRu,
      scaleTier,
      altitudeLabel: formatDistanceRu(altitude, isGalactic ? 'ly' : 'km'),
      distanceLabel: formatDistanceRu(this.orbitDistance, isGalactic ? 'ly' : 'km'),
      detailPercent,
      timeRateLabel,
      timeDilationLabel,
      canScan: !isGalactic && isWithinScanRange(focused, this.orbitDistance),
      isGalacticMode: isGalactic,
      warpActive: this.warpTimer > 0,
      markers: markers.slice(0, 10),
      issVisible: this.issGroup.visible,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
