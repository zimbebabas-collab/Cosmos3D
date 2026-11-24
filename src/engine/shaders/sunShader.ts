import * as THREE from 'three';
import { NOISE_GLSL } from './noiseGlsl';

/**
 * Animated solar photosphere shader with boiling 3D convection granulation,
 * dark magnetic sunspots, and realistic limb darkening.
 */
export function createSunMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalDir;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vLocalDir = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${NOISE_GLSL}
      uniform float uTime;
      varying vec3 vLocalDir;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 p = normalize(vLocalDir);
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);

        float t = uTime * 0.09;
        float warp = fbm4(p * 3.8 + vec3(t, -t * 0.6, t * 0.4));
        float gran = fbm5(p * 9.5 + vec3(warp * 1.8, -t * 0.5, warp));
        float flare = ridgedFbm(p * 5.2 + vec3(0.0, t * 0.3, warp), 4);

        // Magnetic sunspots (cooler darker patches)
        float spotNoise = snoise(p * 4.2 + vec3(0.2, 1.1, -0.7));
        float sunspot = smoothstep(0.58, 0.78, spotNoise);

        vec3 deepOrange = vec3(0.95, 0.30, 0.04);
        vec3 brightGold = vec3(1.0, 0.72, 0.22);
        vec3 whiteHot = vec3(1.0, 0.97, 0.88);

        vec3 col = mix(deepOrange, brightGold, smoothstep(-0.35, 0.45, gran));
        col = mix(col, whiteHot, smoothstep(0.45, 0.88, flare));
        col = mix(col, vec3(0.32, 0.08, 0.01), sunspot * 0.75);

        // Solar limb darkening + hot chromosphere edge
        float ndotv = max(0.0, dot(N, V));
        float limb = pow(ndotv, 0.42);
        float coronaEdge = pow(1.0 - ndotv, 3.2);
        col = col * (0.52 + 0.68 * limb) + vec3(1.0, 0.48, 0.12) * coronaEdge * 0.75;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Additive solar corona billboard glow so the Sun radiates warm light even from 1 AU away.
 */
export function createSunCoronaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 c = vUv * 2.0 - 1.0;
        float r = length(c);
        float angle = atan(c.y, c.x);

        float rays = 0.85
          + 0.15 * sin(angle * 7.0 + uTime * 0.25)
          + 0.10 * cos(angle * 13.0 - uTime * 0.18);

        float core = exp(-r * 4.4) * 1.35;
        float halo = exp(-r * 2.2) * 0.55 * rays;
        float alpha = clamp((core + halo) * smoothstep(1.0, 0.25, r), 0.0, 1.0);

        vec3 col = mix(vec3(1.0, 0.44, 0.08), vec3(1.0, 0.92, 0.72), clamp(core, 0.0, 1.0));
        gl_FragColor = vec4(col * alpha, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
