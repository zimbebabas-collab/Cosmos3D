import * as THREE from 'three';
import { createQuasarDiskMaterial, createQuasarJetMaterial } from './shaders/quasarShader';

/**
 * Composite 10-part procedural 3D Orbital Research Station (ISS-inspired)
 * orbiting Earth at real 408 km low-Earth orbit altitude.
 * Built with varied PBR metalness & roughness across hull, truss, radiators, and solar wings.
 */
export function buildOrbitalStationGroup(): THREE.Group {
  const station = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xdbe4ee,
    roughness: 0.36,
    metalness: 0.65,
  });
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.68,
    metalness: 0.78,
  });
  const solarMat = new THREE.MeshStandardMaterial({
    color: 0xc27829,
    roughness: 0.22,
    metalness: 0.88,
    emissive: new THREE.Color(0x2e1705),
    emissiveIntensity: 0.25,
  });
  const radiatorMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.82,
    metalness: 0.12,
  });
  const cupolaMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.12,
    metalness: 0.9,
    emissive: new THREE.Color(0x0c4a6e),
    emissiveIntensity: 0.45,
  });

  // 1. Central integrated backbone truss
  const truss = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.18, 0.18), trussMat);
  station.add(truss);

  // 2. Main pressurized habitation module (Zvezda / Destiny spine)
  const mainModule = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.4, 16), hullMat);
  mainModule.rotation.x = Math.PI / 2;
  station.add(mainModule);

  // 3. Forward docking node (Harmony) + Cupola observatory window
  const node = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.55, 16), hullMat);
  node.rotation.x = Math.PI / 2;
  node.position.z = 1.32;
  station.add(node);

  const cupola = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), cupolaMat);
  cupola.position.set(0, -0.22, 0.35);
  station.add(cupola);

  // 4. Side laboratory modules (Columbus & Kibo)
  const labGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.9, 14);
  const labL = new THREE.Mesh(labGeo, hullMat);
  labL.rotation.z = Math.PI / 2;
  labL.position.set(-0.68, 0, 0.9);
  const labR = new THREE.Mesh(labGeo, hullMat);
  labR.rotation.z = Math.PI / 2;
  labR.position.set(0.68, 0, 0.9);
  station.add(labL, labR);

  // 5. Four twin golden photovoltaic solar wings (outer pairs)
  const wingGeo = new THREE.BoxGeometry(0.55, 0.03, 2.2);
  const wingOffsets = [-2.2, -1.55, 1.55, 2.2];
  for (const xOff of wingOffsets) {
    const wing = new THREE.Mesh(wingGeo, solarMat);
    wing.position.set(xOff, 0, 0);
    station.add(wing);
  }

  // 6. White thermal control radiator panels
  const radGeo = new THREE.BoxGeometry(0.32, 0.025, 1.15);
  const radL = new THREE.Mesh(radGeo, radiatorMat);
  radL.position.set(-0.85, 0.16, -0.75);
  const radR = new THREE.Mesh(radGeo, radiatorMat);
  radR.position.set(0.85, 0.16, -0.75);
  station.add(radL, radR);

  return station;
}

/**
 * Composite Quasar 3C 273 assembly:
 * Black singularity core + incandescent accretion vortex + twin collimated plasma jets + soft halo.
 */
export function buildQuasarGroup(): {
  group: THREE.Group;
  diskMat: THREE.ShaderMaterial;
  jetMat: THREE.ShaderMaterial;
} {
  const group = new THREE.Group();

  // Supermassive dark core
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0x03050a }),
  );
  group.add(core);

  // Blinding inner photon bloom
  const innerBloom = new THREE.Mesh(
    new THREE.SphereGeometry(0.68, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xe0f7ff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(innerBloom);

  // Equatorial relativistic accretion disk
  const diskMat = createQuasarDiskMaterial();
  const disk = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), diskMat);
  disk.rotation.x = -Math.PI / 2;
  group.add(disk);

  // Twin polar relativistic synchrotron jets
  const jetMat = createQuasarJetMaterial();
  const jetGeo = new THREE.CylinderGeometry(1.15, 0.12, 18.0, 28, 1, true);
  jetGeo.translate(0, 9.0, 0);

  const jetNorth = new THREE.Mesh(jetGeo, jetMat);
  const jetSouth = new THREE.Mesh(jetGeo, jetMat);
  jetSouth.rotation.x = Math.PI;
  group.add(jetNorth, jetSouth);

  // Narrow bright inner plasma beam inside each jet
  const innerJetGeo = new THREE.CylinderGeometry(0.28, 0.05, 16.5, 16, 1, true);
  innerJetGeo.translate(0, 8.25, 0);
  const innerJetMat = new THREE.MeshBasicMaterial({
    color: 0xbaf2ff,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const innerNorth = new THREE.Mesh(innerJetGeo, innerJetMat);
  const innerSouth = new THREE.Mesh(innerJetGeo, innerJetMat);
  innerSouth.rotation.x = Math.PI;
  group.add(innerNorth, innerSouth);

  return { group, diskMat, jetMat };
}

/**
 * Main Asteroid Belt InstancedMesh (450 sculpted rocky bodies between Mars and Jupiter).
 * Normalized to 1 unit = 1 AU so it can be scaled cleanly to any floating-origin renderScale.
 */
export function buildAsteroidBeltMesh(): THREE.InstancedMesh {
  const count = 450;
  const baseGeo = new THREE.DodecahedronGeometry(1.0, 1);
  // Subtle irregular rock sculpting on base geometry
  const posAttr = baseGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const jitter = 0.78 + 0.34 * Math.abs(Math.sin(x * 7.3 + y * 5.1 + z * 3.7));
    posAttr.setXYZ(i, x * jitter, y * jitter * 0.82, z * jitter);
  }
  baseGeo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.14,
  });

  const mesh = new THREE.InstancedMesh(baseGeo, mat, count);
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  let seed = 77291;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    // 2.2 AU to 3.3 AU (in AU units; scaled dynamically in engine)
    const r = 2.15 + rand() * 1.15;
    const angle = rand() * Math.PI * 2;
    const y = (rand() - 0.5) * 0.18;

    dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
    dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    const s = 0.008 + Math.pow(rand(), 2.2) * 0.022;
    dummy.scale.set(s * (0.85 + rand() * 0.3), s * (0.75 + rand() * 0.35), s * (0.85 + rand() * 0.3));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const shade = 0.42 + rand() * 0.28;
    color.setRGB(shade * 1.06, shade * 0.98, shade * 0.90);
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();

  return mesh;
}

/**
 * Dynamic radial star-streak lines displayed during relativistic hyper-warp jumps.
 */
export function buildWarpStreaks(): {
  lines: THREE.LineSegments;
  material: THREE.LineBasicMaterial;
} {
  const count = 180;
  const positions = new Float32Array(count * 2 * 3);

  let seed = 55109;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2;
    const radius = 8 + rand() * 65;
    const zStart = -20 - rand() * 180;
    const len = 18 + rand() * 55;
    const x = Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius;

    positions[i * 6] = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = zStart;

    positions[i * 6 + 3] = x;
    positions[i * 6 + 4] = y;
    positions[i * 6 + 5] = zStart - len;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(geo, material);
  lines.frustumCulled = false;
  return { lines, material };
}
