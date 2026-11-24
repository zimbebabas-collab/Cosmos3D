import * as THREE from 'three';

/**
 * Active Galactic Nucleus / Quasar 3C 273 relativistic accretion disk shader
 * (blazing blue-white superheated core with turbulent spiral inflow).
 */
export function createQuasarDiskMaterial(): THREE.ShaderMaterial {
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

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;

        float angle = atan(p.y, p.x);
        float spiral = angle + 4.2 / (r + 0.12) - uTime * 1.4;
        float turb = vnoise(vec2(r * 10.0, spiral * 3.0)) * 0.65
                   + vnoise(vec2(r * 22.0 - uTime * 0.5, spiral * 6.0)) * 0.35;

        float innerVoid = smoothstep(0.08, 0.14, r);
        float outerFade = smoothstep(1.0, 0.18, r);
        float coreFlare = exp(-r * 6.5) * 2.2;

        vec3 outerViolet = vec3(0.42, 0.25, 0.96);
        vec3 midCyan = vec3(0.22, 0.72, 1.0);
        vec3 hotWhite = vec3(0.98, 0.99, 1.0);

        vec3 col = mix(outerViolet, midCyan, smoothstep(0.85, 0.28, r));
        col = mix(col, hotWhite, smoothstep(0.36, 0.10, r));

        float intensity = innerVoid * outerFade * (0.45 + 0.85 * turb) + coreFlare;
        gl_FragColor = vec4(col * intensity, clamp(intensity, 0.0, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Twin Relativistic Polar Jet Shader for Quasar 3C 273:
 * Volumetric collimated plasma stream with moving synchrotron shock knots and helical sheath.
 */
export function createQuasarJetMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
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
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      void main() {
        // vUv.y goes 0 at core base -> 1 at outer jet tip
        float y = vUv.y;
        float x = vUv.x;

        // Soft cylindrical core falloff using view normal alignment
        float edge = pow(abs(dot(normalize(vNormal), normalize(vViewPos))), 1.35);

        // Moving synchrotron shock knots racing outward at relativistic speed
        float helix = sin(x * 18.8495 + y * 14.0 - uTime * 3.8) * 0.5 + 0.5;
        float knots = pow(sin(y * 16.0 - uTime * 5.2) * 0.5 + 0.5, 3.0);
        float lengthFade = smoothstep(0.0, 0.06, y) * pow(1.0 - y, 1.45);

        vec3 coreBlue = vec3(0.45, 0.86, 1.0);
        vec3 outerIndigo = vec3(0.48, 0.32, 1.0);
        vec3 col = mix(coreBlue, outerIndigo, y * 0.75) + vec3(0.95, 0.98, 1.0) * knots * 0.65;

        float alpha = edge * lengthFade * (0.38 + 0.35 * helix + 0.45 * knots);
        gl_FragColor = vec4(col * alpha * 1.4, clamp(alpha, 0.0, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
