import * as THREE from 'three';

/**
 * Custom HDR circular starfield / Milky Way spiral galaxy point shader.
 * Renders razor-sharp glowing stars with zero square-pixel artifacts.
 */
export function createStarPointsMaterial(sizeScale: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSizeScale: { value: sizeScale },
      uOpacity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aColor;
      uniform float uSizeScale;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uSizeScale * (320.0 / max(1.0, -mvPosition.z)), 1.2, 26.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(c, c);
        if (r2 > 1.0) discard;
        float core = exp(-r2 * 6.5);
        float halo = exp(-r2 * 1.9) * 0.45;
        float a = clamp(core + halo, 0.0, 1.0) * uOpacity;
        gl_FragColor = vec4(vColor * (core * 1.4 + halo), a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/**
 * Builds the 3D Milky Way Spiral Galaxy (barred SBbc with 4 logarithmic spiral arms,
 * golden galactic bulge, young blue OB arm clusters, and warm H-II nebulae regions).
 */
export function buildMilkyWayGroup(): THREE.Group {
  const group = new THREE.Group();
  const starCount = 28_000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  const arms = 4;
  const radiusMax = 52_000; // in light-years (scene scaled dynamically in galactic mode)
  const coreCol = new THREE.Color('#ffdfa8');
  const armBlue = new THREE.Color('#7cc4ff');
  const armWarm = new THREE.Color('#ffd3a0');
  const nebulaPink = new THREE.Color('#e879f9');
  const tempCol = new THREE.Color();

  // Deterministic pseudo-random generator for reproducible star distribution
  let seed = 421337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < starCount; i++) {
    const u = rand();
    const isBulge = i < starCount * 0.22;

    let x = 0;
    let y = 0;
    let z = 0;

    if (isBulge) {
      // Elongated galactic bar / bulge
      const r = Math.pow(rand(), 1.8) * 11_000;
      const theta = rand() * Math.PI * 2;
      const phi = (rand() - 0.5) * Math.PI;
      x = Math.cos(theta) * Math.cos(phi) * r * 1.35;
      z = Math.sin(theta) * Math.cos(phi) * r * 0.72;
      y = Math.sin(phi) * r * 0.34;
      tempCol.copy(coreCol).lerp(armWarm, rand() * 0.4);
      sizes[i] = 1.6 + rand() * 2.8;
    } else {
      const armIdx = i % arms;
      const distNorm = Math.pow(u, 0.78);
      const r = 4_500 + distNorm * (radiusMax - 4_500);
      const spiralTwist = Math.log(r / 4_000 + 1.0) * 2.55;
      const armAngle = (armIdx / arms) * Math.PI * 2 + spiralTwist;
      const spread = (rand() - 0.5) * (0.45 + distNorm * 0.55);
      const radialScatter = (rand() - 0.5) * 4_500 * (0.4 + distNorm);

      x = Math.cos(armAngle + spread) * (r + radialScatter);
      z = Math.sin(armAngle + spread) * (r + radialScatter);
      // Thin galactic disk (~1,500 ly vertical thickness, thicker near core)
      const diskH = 1_800 * (1.0 - distNorm * 0.55) + 400;
      y = (rand() - 0.5) * (rand() - 0.5) * diskH * 3.5;

      const roll = rand();
      if (roll < 0.52) {
        tempCol.copy(armBlue).lerp(coreCol, (1.0 - distNorm) * 0.55);
      } else if (roll < 0.88) {
        tempCol.copy(armWarm).lerp(coreCol, 0.35);
      } else {
        tempCol.copy(nebulaPink).lerp(armBlue, rand() * 0.4);
      }
      sizes[i] = 1.1 + Math.pow(rand(), 2.4) * 3.6;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    colors[i * 3] = tempCol.r;
    colors[i * 3 + 1] = tempCol.g;
    colors[i * 3 + 2] = tempCol.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const mat = createStarPointsMaterial(1.55);
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  group.add(points);

  // Soft glowing galactic bulge sprite at center (Sgr A*)
  const bulgeGeo = new THREE.PlaneGeometry(34_000, 34_000);
  const bulgeMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      void main() {
        vec2 c = vUv * 2.0 - 1.0;
        float r = length(c);
        float g = exp(-r * 3.6) * 0.65;
        vec3 col = mix(vec3(0.95, 0.62, 0.28), vec3(1.0, 0.94, 0.82), exp(-r * 4.5));
        gl_FragColor = vec4(col * g, g);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const bulgePlane = new THREE.Mesh(bulgeGeo, bulgeMat);
  bulgePlane.rotation.x = -Math.PI / 2;
  group.add(bulgePlane);

  return group;
}

/**
 * Builds background celestial sphere of 7,500 realistic spectral-class stars
 * (O/B blue, A white, G yellow, K/M orange) plus faint Milky Way band.
 */
export function buildDeepStarfield(): THREE.Points {
  const count = 7_500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  let seed = 918273;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const palette = [
    new THREE.Color('#9bb8ff'), // O/B blue-white
    new THREE.Color('#cad8ff'), // A white-blue
    new THREE.Color('#f8f7ff'), // F pure white
    new THREE.Color('#fff2d6'), // G solar yellow
    new THREE.Color('#ffd2a1'), // K warm orange
  ];

  const R = 500_000;
  for (let i = 0; i < count; i++) {
    // 30% concentrated along an inclined galactic band for authentic night-sky depth
    const inBand = i < count * 0.3;
    const theta = rand() * Math.PI * 2;
    let phi: number;
    if (inBand) {
      phi = Math.PI / 2 + (rand() - 0.5) * (rand() - 0.5) * 0.65;
    } else {
      phi = Math.acos(2 * rand() - 1);
    }

    let x = R * Math.sin(phi) * Math.cos(theta);
    let y = R * Math.cos(phi);
    let z = R * Math.sin(phi) * Math.sin(theta);

    // Tilt galactic plane by 58 deg
    const tilt = 1.01;
    const yt = y * Math.cos(tilt) - z * Math.sin(tilt);
    const zt = y * Math.sin(tilt) + z * Math.cos(tilt);

    positions[i * 3] = x;
    positions[i * 3 + 1] = yt;
    positions[i * 3 + 2] = zt;

    const col = palette[Math.floor(rand() * palette.length)];
    const brightness = 0.45 + Math.pow(rand(), 1.8) * 0.75;
    colors[i * 3] = col.r * brightness;
    colors[i * 3 + 1] = col.g * brightness;
    colors[i * 3 + 2] = col.b * brightness;

    sizes[i] = inBand ? 1.1 + rand() * 1.8 : 1.2 + Math.pow(rand(), 3.0) * 3.2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aColor;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        gl_PointSize = aSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(c, c);
        if (r2 > 1.0) discard;
        float a = exp(-r2 * 4.5);
        gl_FragColor = vec4(vColor * a * 1.2, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

/**
 * Builds Pulsar PSR B1919+21: blazing magnetized neutron star core + tilted sweeping
 * twin synchrotron radiation beams + glowing magnetic dipole field loops.
 */
export function buildPulsarGroup(): { group: THREE.Group; spinPivot: THREE.Group } {
  const group = new THREE.Group();
  const spinPivot = new THREE.Group();
  group.add(spinPivot);

  // Magnetic axis tilted 32 degrees relative to spin axis so beams sweep like a lighthouse!
  const magGroup = new THREE.Group();
  magGroup.rotation.z = THREE.MathUtils.degToRad(32);
  spinPivot.add(magGroup);

  // Blazing neutron core
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), coreMat);
  magGroup.add(core);

  // Inner magnetosphere glow
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x6366f1,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 24), haloMat);
  magGroup.add(halo);

  // Twin sweeping lighthouse cones
  const beamMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        float y = vUv.y;
        float edge = pow(abs(dot(normalize(vNormal), normalize(vViewPos))), 1.5);
        float fade = smoothstep(0.0, 0.08, y) * pow(1.0 - y, 1.4);
        vec3 col = mix(vec3(0.75, 0.92, 1.0), vec3(0.45, 0.35, 1.0), y);
        float a = edge * fade * 0.95;
        gl_FragColor = vec4(col * a * 1.4, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const coneGeo = new THREE.CylinderGeometry(1.4, 0.08, 7.5, 24, 1, true);
  coneGeo.translate(0, 3.75, 0);

  const topBeam = new THREE.Mesh(coneGeo, beamMat);
  const botBeam = new THREE.Mesh(coneGeo, beamMat);
  botBeam.rotation.x = Math.PI;
  magGroup.add(topBeam, botBeam);

  // Magnetic dipole field line rings around equator
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x818cf8,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 8; i++) {
    const az = (i / 8) * Math.PI * 2;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 32; s++) {
      const th = (s / 32) * Math.PI;
      const r = 1.9 * Math.pow(Math.sin(th), 2);
      const px = r * Math.sin(th) * Math.cos(az);
      const py = r * Math.cos(th);
      const pz = r * Math.sin(th) * Math.sin(az);
      pts.push(new THREE.Vector3(px, py, pz));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    magGroup.add(new THREE.Line(lineGeo, lineMat));
  }

  return { group, spinPivot };
}
