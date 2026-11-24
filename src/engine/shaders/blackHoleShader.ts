import * as THREE from 'three';

/**
 * Interstellar / Gargantua Relativistic Black Hole Shader.
 * Uses real-time null-geodesic raymarching inside a bounding sphere so the accretion disk
 * visibly bends OVER the top and UNDER the bottom of the pitch-black event horizon shadow,
 * complete with thin golden photon ring, Doppler beaming asymmetry, and lensed background stars.
 */
export function createBlackHoleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLocalCamPos: { value: new THREE.Vector3(0, 1.8, 9.0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform vec3 uLocalCamPos;

      varying vec3 vLocalPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbmDisk(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise2(p);
          p *= 2.12;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        // Bounding sphere radius = 10.0; event horizon = 1.0
        vec3 ro = uLocalCamPos;
        vec3 rd = normalize(vLocalPos - ro);

        float b = dot(ro, rd);
        float c = dot(ro, ro) - 100.0;
        float h = b * b - c;
        if (h < 0.0) discard;

        float tStart = max(0.0, -b - sqrt(h));
        vec3 pos = ro + rd * tStart;
        vec3 vel = rd;

        vec3 accumColor = vec3(0.0);
        float transmittance = 1.0;
        bool swallowed = false;
        float minR = 100.0;

        // 34 adaptive geodesic steps: iconic Interstellar upper/lower lensed disk + fast SwiftShader execution
        const int STEPS = 34;
        for (int i = 0; i < STEPS; i++) {
          float r2 = dot(pos, pos);
          float r = sqrt(r2);
          minR = min(minR, r);

          if (r < 1.02) {
            swallowed = true;
            break;
          }
          if (r > 10.6 && i > 2) {
            break;
          }

          float dt = clamp(0.14 * r, 0.11, 0.62);
          vec3 accel = -1.72 * pos / (r2 * r2 + 0.02);
          vec3 prevPos = pos;
          vel = normalize(vel + accel * dt);
          pos += vel * dt;

          // Equatorial accretion disk crossing (y = 0)
          if (prevPos.y * pos.y <= 0.0 || abs(pos.y) < 0.16) {
            float frac = abs(prevPos.y) / max(0.0001, abs(prevPos.y - pos.y));
            vec3 hit = mix(prevPos, pos, clamp(frac, 0.0, 1.0));
            float hr = length(hit.xz);

            if (hr > 1.45 && hr < 7.2) {
              float angle = atan(hit.z, hit.x);
              float omega = 1.8 / pow(hr, 1.25);
              float spiral = angle + uTime * omega + 2.4 / hr;

              float radialProfile = smoothstep(1.45, 2.0, hr) * smoothstep(7.2, 2.3, hr);
              float bands = fbmDisk(vec2(hr * 2.5, spiral * 2.2));
              float streaks = 0.58 + 0.42 * sin(hr * 9.0 + bands * 5.0);

              // Relativistic Doppler beaming
              vec3 tangent = normalize(vec3(-hit.z, 0.0, hit.x));
              float doppler = dot(tangent, -rd);
              float beam = pow(clamp(1.0 + doppler * 0.50, 0.35, 1.8), 1.9);

              float heat = clamp(1.0 - (hr - 1.45) / 5.0, 0.0, 1.0);
              vec3 coolAmber = vec3(0.92, 0.34, 0.08);
              vec3 hotGold = vec3(1.0, 0.80, 0.42);
              vec3 whiteBlue = vec3(0.98, 0.98, 1.0);
              vec3 diskCol = mix(coolAmber, hotGold, smoothstep(0.0, 0.62, heat));
              diskCol = mix(diskCol, whiteBlue, smoothstep(0.58, 1.0, heat) * clamp(beam * 0.72, 0.0, 1.0));

              float thicknessFade = exp(-abs(pos.y) * 8.0);
              float sampleAlpha = radialProfile * (0.40 + 0.60 * bands) * streaks * thicknessFade * 0.52;

              accumColor += diskCol * beam * sampleAlpha * transmittance * 2.35;
              transmittance *= (1.0 - clamp(sampleAlpha * 0.62, 0.0, 0.85));
              if (transmittance < 0.03) break;
            }
          }
        }

        // Crisp golden-white photon ring hugging the black event horizon shadow
        float photonRing = exp(-pow((minR - 1.38) * 9.0, 2.0)) * (swallowed ? 0.38 : 1.0);
        accumColor += vec3(1.0, 0.90, 0.66) * photonRing * 1.25 * transmittance;

        if (!swallowed) {
          vec2 skyUv = vec2(atan(vel.z, vel.x) * 18.0, asin(clamp(vel.y, -1.0, 1.0)) * 18.0) * 4.5;
          vec2 cellId = floor(skyUv);
          vec2 cellF = fract(skyUv) - 0.5;
          float starRnd = hash21(cellId);
          float d2 = dot(cellF, cellF);
          float star = smoothstep(0.972, 0.998, starRnd) * exp(-d2 * 48.0);
          accumColor += vec3(0.88, 0.94, 1.0) * star * transmittance * 1.1;
        }

        float alpha = swallowed ? 1.0 : clamp(1.0 - transmittance + photonRing * 0.85 + length(accumColor) * 0.5, 0.0, 1.0);
        if (alpha < 0.01) discard;

        gl_FragColor = vec4(accumColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
  });
}
