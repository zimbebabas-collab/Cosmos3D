import * as THREE from 'three';
import { NOISE_GLSL } from './noiseGlsl';
import type { PlanetShaderType } from '../../data/celestialCatalog';

const PLANET_TYPE_INDEX: Record<string, number> = {
  earth: 0,
  mars: 1,
  moon: 2,
  mercury: 3,
  venus: 4,
  jupiter: 5,
  saturn: 6,
  uranus: 7,
  neptune: 8,
};

/**
 * High-detail procedural 3D planet surface shader with:
 * - Silky, artifact-free analytical tangent-frame relief normals (zero 2x2 quad stair-stepping!)
 * - Calibrated realistic biomes (Earth oceans, lush forests, deserts, alpine ridges, snow peaks,
 *   plus vivid golden night-side metropolitan city hubs & glowing highway filaments!)
 * - Distinct realistic geological landscapes for Mars, Moon, Mercury, Venus, Jupiter, Saturn, Uranus, Neptune
 */
export function createPlanetMaterial(shaderType: PlanetShaderType): THREE.ShaderMaterial {
  const typeIndex = PLANET_TYPE_INDEX[shaderType] ?? 0;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(1, 0.2, 0.5).normalize() },
      uPlanetType: { value: typeIndex },
      uDetailLevel: { value: 0.0 },
      uDisplaceAmp: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform int uPlanetType;
      uniform float uDisplaceAmp;

      varying vec3 vLocalDir;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float vertexElevation(vec3 p) {
        if (uPlanetType == 0) {
          float cont = fbm4(p * 2.15 + vec3(1.4, -0.5, 2.1)) + 0.04;
          float mtn = ridgedFbm(p * 7.2, 3);
          return max(0.0, cont) * (0.4 + mtn * 0.95);
        } else if (uPlanetType == 1) {
          float h = fbm4(p * 2.8) * 0.45 + ridgedFbm(p * 6.5, 3) * 0.55;
          float canyon = smoothstep(0.18, 0.0, abs(p.y + snoise(p * 2.5) * 0.18)) * 0.45;
          return h - canyon;
        } else if (uPlanetType == 2 || uPlanetType == 3) {
          return fbm4(p * 3.5) * 0.30 + fastCraters(p, 5.5) * 0.50;
        }
        return 0.0;
      }

      void main() {
        vec3 nDir = normalize(position);
        vLocalDir = nDir;

        vec3 displaced = position;
        if (uDisplaceAmp > 0.0001) {
          float h = vertexElevation(nDir);
          displaced += nDir * (h * uDisplaceAmp);
        }

        vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${NOISE_GLSL}

      uniform float uTime;
      uniform vec3 uSunDir;
      uniform int uPlanetType;
      uniform float uDetailLevel;

      varying vec3 vLocalDir;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      // Fast, silky smooth micro-relief scalar used for analytical tangent normal perturbation
      // (zero dFdx/dFdy 2x2 pixel blocking!)
      float fastReliefHeight(vec3 p, float detail, int pType) {
        if (pType == 0) {
          float m1 = ridgedFbm(p * 8.5, 3) * 0.55;
          float m2 = detail > 0.05 ? (1.0 - abs(snoise(p * 28.0))) * 0.25 * detail : 0.0;
          float m3 = detail > 0.25 ? snoise(p * 74.0) * 0.09 * detail : 0.0;
          return m1 + m2 + m3;
        } else if (pType == 1) {
          float m1 = ridgedFbm(p * 8.0, 3) * 0.45 + fastCraters(p, 6.0) * 0.42;
          float m2 = detail > 0.08 ? fastCraters(p + vec3(3.1), 19.0) * 0.24 * detail : 0.0;
          return m1 + m2;
        } else {
          float m1 = fastCraters(p, 5.6) * 0.55 + fastCraters(p + vec3(2.4), 14.0) * 0.30;
          float m2 = detail > 0.08 ? fastCraters(p - vec3(4.2), 34.0) * 0.22 * detail : 0.0;
          return m1 + m2;
        }
      }

      vec3 smoothReliefNormal(vec3 p, vec3 baseN, float detail, int pType, float strength) {
        vec3 up = abs(p.y) < 0.98 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 T = normalize(cross(up, p));
        vec3 B = normalize(cross(p, T));
        float eps = mix(0.008, 0.0022, detail);

        float hC = fastReliefHeight(p, detail, pType);
        float hT = fastReliefHeight(normalize(p + T * eps), detail, pType);
        float hB = fastReliefHeight(normalize(p + B * eps), detail, pType);
        float dT = (hT - hC) / eps;
        float dB = (hB - hC) / eps;

        vec3 wUp = abs(baseN.y) < 0.98 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 wT = normalize(cross(wUp, baseN));
        vec3 wB = normalize(cross(baseN, wT));
        return normalize(baseN - (wT * dT + wB * dB) * strength);
      }

      void main() {
        vec3 p = normalize(vLocalDir);
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);
        float lat = abs(p.y);
        float detail = clamp(uDetailLevel, 0.0, 1.0);

        vec3 albedo = vec3(0.5);
        float roughness = 0.85;
        float specStrength = 0.08;
        vec3 emissive = vec3(0.0);
        vec3 atmoColor = vec3(0.0);
        float atmoPower = 0.0;

        float NdotLRaw = dot(N, L);
        vec3 surfN = N;

        if (uPlanetType == 0) {
          // ==================== EARTH ====================
          float warp = snoise(p * 1.35) * 0.28;
          float cont = fbm5(p * 2.15 + vec3(1.4 + warp, -0.5, 2.1 - warp)) + 0.03;
          float isLand = smoothstep(0.005, 0.028, cont);

          // Mountain chains focused along tectonic bands (not covering all flat lowlands!)
          float mtnMask = smoothstep(0.10, 0.44, cont) * smoothstep(-0.1, 0.45, snoise(p * 3.4 + vec3(0.8)));
          float ridges = ridgedFbm(p * 8.2 + vec3(warp), 4);
          float micro = detail > 0.05 ? ridgedFbm(p * 30.0, 3) * 0.14 * detail : 0.0;
          float elevation = max(0.0, cont) + isLand * (mtnMask * ridges * 0.52 + micro);

          float polarIce = smoothstep(0.77, 0.89, lat + snoise(p * 6.0) * 0.06);

          if (isLand > 0.02) {
            vec3 landN = smoothReliefNormal(p, N, detail, 0, mix(0.014, 0.026, detail));
            surfN = normalize(mix(N, landN, isLand));
          }

          // Deep ocean bathymetry + turquoise coastal shelves
          float shallow = smoothstep(-0.22, 0.012, cont);
          vec3 deepOcean = vec3(0.016, 0.064, 0.195);
          vec3 coastOcean = vec3(0.048, 0.295, 0.425);
          vec3 oceanCol = mix(deepOcean, coastOcean, pow(shallow, 2.2));

          // Realistic Earth land biomes: coastal plains, emerald forests, golden deserts, alpine rock, high snow peaks
          float moisture = fbm4(p * 3.8 + vec3(-4.2, 1.5, 2.7)) * 0.5 + 0.5;
          float aridMask = smoothstep(0.50, 0.22, moisture) * smoothstep(0.58, 0.10, lat);
          vec3 lushForest = mix(vec3(0.052, 0.185, 0.072), vec3(0.145, 0.265, 0.092), moisture);
          vec3 meadow = vec3(0.21, 0.31, 0.13);
          vec3 desert = mix(vec3(0.60, 0.49, 0.31), vec3(0.76, 0.62, 0.40), snoise(p * 16.0) * 0.5 + 0.5);
          vec3 alpineRock = vec3(0.32, 0.29, 0.25);
          vec3 snowPeak = vec3(0.93, 0.96, 0.99);

          float detailTex = detail > 0.05 ? snoise(p * 55.0) * 0.5 + 0.5 : 0.5;
          vec3 landCol = mix(lushForest, meadow, smoothstep(0.06, 0.22, elevation));
          landCol = mix(landCol, desert, aridMask);
          landCol = mix(landCol, alpineRock, smoothstep(0.34, 0.58, elevation));
          // Snow ONLY on very high mountain summits (> 0.62) and polar caps!
          landCol = mix(landCol, snowPeak, smoothstep(0.62, 0.80, elevation));
          landCol *= mix(0.88, 1.12, detailTex * detail + 0.5 * (1.0 - detail));

          albedo = mix(oceanCol, landCol, isLand);
          albedo = mix(albedo, snowPeak, polarIce);

          // Realistic cloud systems
          vec3 cp = p + vec3(uTime * 0.004, 0.0, -uTime * 0.002);
          float cloudWarp = snoise(cp * 2.8) * 0.40;
          float clouds = fbm5(cp * 4.2 + vec3(cloudWarp, -cloudWarp * 0.5, cloudWarp));
          float cloudMask = smoothstep(0.18, 0.56, clouds) * (1.0 - detail * 0.55);

          roughness = mix(0.18, 0.88, max(isLand, polarIce));
          specStrength = mix(0.85, 0.05, max(isLand, max(polarIce, cloudMask)));

          // ==================== EARTH NIGHT CITIES & ROAD NETWORKS ====================
          float nightMask = smoothstep(0.18, -0.08, NdotLRaw);
          if (nightMask > 0.005 && isLand > 0.18 && polarIce < 0.35) {
            float habitable = isLand * smoothstep(0.52, 0.05, elevation) * smoothstep(0.74, 0.06, lat);
            float regionDensity = smoothstep(-0.18, 0.35, fbm4(p * 6.2 + vec3(2.4, -1.8, 0.7)));

            // Bright metropolitan hubs + glowing golden arterial highways + fine suburban blocks on close-up
            float hubs = pow(max(0.0, snoise(p * 24.0 + vec3(1.2))), 2.4);
            float roadNet = pow(1.0 - abs(snoise(p * 34.0)), 7.0);
            float fineGrid = pow(1.0 - abs(snoise(p * 95.0)), 5.5) * (0.45 + detail * 1.1);
            float microLights = pow(max(0.0, snoise(p * 190.0)), 2.0) * (0.35 + detail * 1.0);

            float cityGlow = habitable * regionDensity * (
              hubs * 4.5 +
              roadNet * 1.9 +
              (hubs * 2.2 + roadNet * 1.1) * (fineGrid + microLights)
            );
            vec3 sodiumGold = vec3(1.0, 0.68, 0.24);
            vec3 metroWhite = vec3(1.0, 0.93, 0.74);
            vec3 cityCol = mix(sodiumGold, metroWhite, clamp(hubs * 1.8, 0.0, 1.0));
            emissive = cityCol * cityGlow * nightMask * (1.0 - cloudMask * 0.4) * (1.9 + detail * 0.95);
          }

          albedo = mix(albedo, vec3(0.96, 0.97, 0.99), cloudMask * 0.78);
          atmoColor = vec3(0.30, 0.64, 1.0);
          atmoPower = 0.90;

        } else if (uPlanetType == 1) {
          // ==================== MARS ====================
          float base = fbm5(p * 2.9 + vec3(3.1, 0.4, -1.7)) * 0.48;
          float ridges = ridgedFbm(p * 8.2, 4) * 0.38;
          float canyonPath = abs(p.y + snoise(p * 2.4) * 0.16);
          float canyon = smoothstep(0.11, 0.012, canyonPath) * smoothstep(-0.3, 0.4, p.x) * 0.55;
          float c1 = fastCraters(p, 5.8) * 0.34;
          float h = base + ridges - canyon + c1;

          surfN = smoothReliefNormal(p, N, detail, 1, mix(0.022, 0.040, detail));

          vec3 rustDust = vec3(0.72, 0.33, 0.17);
          vec3 ochrePlain = vec3(0.84, 0.48, 0.26);
          vec3 darkBasalt = vec3(0.28, 0.17, 0.13);
          vec3 polarCap = vec3(0.94, 0.92, 0.90);

          float dustVar = fbm4(p * 4.5 + vec3(0.5, -2.1, 1.3)) * 0.5 + 0.5;
          albedo = mix(darkBasalt, rustDust, smoothstep(0.22, 0.62, dustVar));
          albedo = mix(albedo, ochrePlain, smoothstep(0.15, 0.55, h));
          albedo = mix(albedo, darkBasalt * 0.8, smoothstep(-0.05, -0.35, h));
          float cap = smoothstep(0.83, 0.92, lat + snoise(p * 9.0) * 0.05);
          albedo = mix(albedo, polarCap, cap);

          atmoColor = vec3(0.92, 0.52, 0.32);
          atmoPower = 0.48;
          roughness = 0.94;
          specStrength = 0.04;

        } else if (uPlanetType == 2) {
          // ==================== MOON ====================
          float maria = fbm4(p * 2.4 + vec3(-1.1, 2.3, 0.8));
          float c1 = fastCraters(p, 5.2) * 0.55;
          float c2 = fastCraters(p + vec3(2.7), 13.5) * 0.30;
          float h = maria * 0.35 + c1 + c2;

          surfN = smoothReliefNormal(p, N, detail, 2, mix(0.026, 0.048, detail));

          float mariaMask = smoothstep(-0.05, 0.25, maria);
          albedo = mix(vec3(0.25, 0.26, 0.28), vec3(0.69, 0.68, 0.66), mariaMask);
          albedo = mix(albedo, vec3(0.84, 0.83, 0.81), smoothstep(0.32, 0.65, h));
          albedo *= mix(0.90, 1.10, snoise(p * 42.0) * 0.5 + 0.5);
          roughness = 0.97;
          specStrength = 0.02;

        } else if (uPlanetType == 3) {
          // ==================== MERCURY ====================
          float base = fbm4(p * 3.4) * 0.30;
          float c1 = fastCraters(p, 6.5) * 0.52;
          float h = base + c1;

          surfN = smoothReliefNormal(p, N, detail, 2, mix(0.024, 0.042, detail));
          albedo = mix(vec3(0.28, 0.26, 0.24), vec3(0.59, 0.55, 0.50), smoothstep(-0.2, 0.45, h));
          roughness = 0.95;
          specStrength = 0.04;

        } else if (uPlanetType == 4) {
          // ==================== VENUS ====================
          vec3 q = vec3(p.x * 1.2, p.y * 3.8, p.z * 1.2);
          float bandWarp = fbm4(q * 2.0 + vec3(uTime * 0.012, 0.0, 0.0));
          float bands = sin(p.y * 12.0 + bandWarp * 4.2) * 0.5 + 0.5;
          float streaks = fbm5(q * 4.5 + vec3(bandWarp * 1.4, 0.0, uTime * 0.02)) * 0.5 + 0.5;

          albedo = mix(vec3(0.60, 0.38, 0.17), vec3(0.79, 0.56, 0.28), bands);
          albedo = mix(albedo, vec3(0.94, 0.84, 0.59), streaks * 0.75);

          if (detail > 0.25) {
            float rift = smoothstep(0.72, 0.90, ridgedFbm(p * 20.0, 3));
            emissive = vec3(1.0, 0.34, 0.07) * rift * detail * 0.7;
          }
          atmoColor = vec3(0.96, 0.72, 0.36);
          atmoPower = 0.92;
          roughness = 0.75;

        } else if (uPlanetType == 5) {
          // ==================== JUPITER ====================
          float flow = uTime * 0.012;
          float turb = fbm5(vec3(p.x * 3.2 + flow, p.y * 9.5, p.z * 3.2)) * 0.55;
          float yBand = p.y + turb * 0.12;
          float z1 = sin(yBand * 24.0) * 0.5 + 0.5;
          float z2 = cos(yBand * 11.0 + turb * 2.5) * 0.5 + 0.5;

          albedo = mix(vec3(0.70, 0.40, 0.24), vec3(0.92, 0.85, 0.73), z1);
          albedo = mix(albedo, vec3(0.82, 0.64, 0.44), z2 * 0.55);
          albedo = mix(albedo, vec3(0.48, 0.46, 0.48), smoothstep(0.72, 0.96, lat));

          vec3 grsPos = normalize(vec3(0.82, -0.36, 0.44));
          vec3 dGrs = p - grsPos;
          float ellip = length(vec3(dGrs.x * 0.75, dGrs.y * 1.65, dGrs.z * 0.75));
          float grsMask = smoothstep(0.24, 0.06, ellip);
          float grsSwirl = sin(ellip * 45.0 - uTime * 0.4 + snoise(p * 18.0) * 2.0) * 0.5 + 0.5;
          albedo = mix(albedo, mix(vec3(0.78, 0.25, 0.15), vec3(0.94, 0.48, 0.30), grsSwirl), grsMask * 0.92);

          atmoColor = vec3(0.85, 0.72, 0.55);
          atmoPower = 0.38;
          roughness = 0.78;

        } else if (uPlanetType == 6) {
          // ==================== SATURN ====================
          float turb = fbm4(vec3(p.x * 2.4 + uTime * 0.008, p.y * 10.0, p.z * 2.4)) * 0.06;
          float b1 = sin((p.y + turb) * 20.0) * 0.5 + 0.5;
          float b2 = cos((p.y + turb) * 9.0) * 0.5 + 0.5;

          albedo = mix(vec3(0.78, 0.67, 0.49), vec3(0.93, 0.86, 0.68), b1 * 0.7 + b2 * 0.3);
          albedo = mix(albedo, vec3(0.50, 0.56, 0.60), smoothstep(0.78, 0.96, lat));

          atmoColor = vec3(0.92, 0.84, 0.64);
          atmoPower = 0.35;
          roughness = 0.80;

        } else if (uPlanetType == 7) {
          // ==================== URANUS ====================
          float band = sin(p.y * 10.0 + fbm4(p * 3.0) * 0.4) * 0.5 + 0.5;
          albedo = mix(vec3(0.58, 0.88, 0.93), vec3(0.74, 0.94, 0.96), band * 0.6 + smoothstep(0.65, 0.95, lat) * 0.4);
          atmoColor = vec3(0.55, 0.90, 0.96);
          atmoPower = 0.55;
          roughness = 0.70;

        } else {
          // ==================== NEPTUNE ====================
          float turb = fbm4(vec3(p.x * 2.5 + uTime * 0.018, p.y * 11.0, p.z * 2.5));
          float band = sin((p.y + turb * 0.08) * 16.0) * 0.5 + 0.5;
          float cirrus = smoothstep(0.55, 0.82, fbm4(vec3(p.x * 4.0 + uTime * 0.03, p.y * 18.0, p.z * 4.0)));

          albedo = mix(vec3(0.13, 0.28, 0.72), vec3(0.24, 0.49, 0.92), band);
          albedo = mix(albedo, vec3(0.88, 0.94, 1.0), cirrus * 0.55);

          atmoColor = vec3(0.25, 0.52, 1.0);
          atmoPower = 0.68;
          roughness = 0.65;
        }

        float diff = max(0.0, dot(surfN, L));
        float scatterWrap = atmoPower > 0.1 ? smoothstep(-0.18, 0.22, NdotLRaw) : smoothstep(-0.02, 0.06, NdotLRaw);
        float lit = mix(diff, max(diff, scatterWrap * 0.35), atmoPower * 0.45);

        vec3 H = normalize(L + V);
        float spec = pow(max(0.0, dot(surfN, H)), mix(64.0, 12.0, roughness)) * specStrength * smoothstep(0.0, 0.15, NdotLRaw);

        float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.0);
        vec3 twilight = (uPlanetType == 0)
          ? vec3(1.0, 0.48, 0.20) * exp(-pow((NdotLRaw + 0.02) * 7.0, 2.0)) * fresnel * 0.65
          : vec3(0.0);
        vec3 atmoRim = atmoColor * fresnel * atmoPower * (smoothstep(-0.22, 0.45, NdotLRaw) * 0.92 + 0.12);

        vec3 color = albedo * (lit * 1.32 + 0.036) + vec3(1.0, 0.96, 0.90) * spec + atmoRim + twilight + emissive;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  mat.customProgramCacheKey = () => 'astrum-planet-surface-v1';
  return mat;
}

/**
 * Outer atmospheric Rayleigh halo shell rendered around planets with atmospheres.
 */
export function createAtmosphereMaterial(rgb: [number, number, number]): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(rgb[0], rgb[1], rgb[2]) },
      uSunDir: { value: new THREE.Vector3(1, 0.2, 0.5).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform vec3 uSunDir;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float rim = clamp(1.0 + dot(N, V), 0.0, 1.0);
        float glow = pow(rim, 3.4);
        float sunTerm = smoothstep(-0.25, 0.35, dot(N, normalize(uSunDir)));
        vec3 col = uColor * glow * (0.18 + 1.05 * sunTerm);
        gl_FragColor = vec4(col, glow * (0.20 + 0.78 * sunTerm));
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  mat.customProgramCacheKey = () => 'astrum-planet-atmo-v1';
  return mat;
}

/**
 * Procedural Saturn / Uranus Ring Shader with Cassini Division, Encke Gap,
 * radial micro-ringlets, and analytic shadow cast by the parent planet sphere.
 */
export function createPlanetaryRingMaterial(
  colorHex: string,
  baseOpacity: number,
  innerFactor: number,
  outerFactor: number,
): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: baseOpacity },
      uInner: { value: innerFactor },
      uOuter: { value: outerFactor },
      uSunDir: { value: new THREE.Vector3(1, 0.2, 0.5).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vCenterWorld;
      varying float vPlanetR;

      void main() {
        vLocalPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vCenterWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vPlanetR = length((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uSunDir;

      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vCenterWorld;
      varying float vPlanetR;

      void main() {
        float r = length(vLocalPos.xy);
        float t = clamp((r - uInner) / max(0.001, uOuter - uInner), 0.0, 1.0);
        float edge = smoothstep(0.0, 0.04, t) * smoothstep(1.0, 0.94, t);

        float rings = 0.58
          + 0.22 * sin(t * 78.0)
          + 0.14 * cos(t * 195.0)
          + 0.08 * sin(t * 420.0);

        float cRing = smoothstep(0.0, 0.18, t) * 0.55 + 0.45;
        float cassini = 1.0 - smoothstep(0.60, 0.615, t) * (1.0 - smoothstep(0.655, 0.675, t)) * 0.92;
        float encke = 1.0 - smoothstep(0.875, 0.882, t) * (1.0 - smoothstep(0.892, 0.90, t)) * 0.78;
        float density = clamp(rings * cRing * cassini * encke, 0.0, 1.0) * edge;

        vec3 rel = vWorldPos - vCenterWorld;
        vec3 L = normalize(uSunDir);
        float proj = dot(rel, L);
        float shadow = 1.0;
        if (proj < 0.0) {
          float perpDist = length(rel - L * proj);
          shadow = smoothstep(vPlanetR * 0.96, vPlanetR * 1.04, perpDist);
          shadow = mix(0.08, 1.0, shadow);
        }

        vec3 tint = mix(uColor * 0.72, uColor * 1.18, smoothstep(0.18, 0.55, t));
        gl_FragColor = vec4(tint * shadow, density * uOpacity);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  mat.customProgramCacheKey = () => 'astrum-planet-ring-v1';
  return mat;
}
