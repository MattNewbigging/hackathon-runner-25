import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import * as THREE from "three";

const invTexel = 1 / 576;

const renderSize = new THREE.Vector2();
export class BGPass {
  private readonly fsQuad: FullScreenQuad;
  readonly material: THREE.ShaderMaterial;

  treadmillMovement = 0;

  constructor(textures: THREE.Texture[]) {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `
        uniform float aspect;

        out vec2 vUv;
        void main() {
          vUv = vec2(uv.x * aspect, uv.y);

          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        precision highp int;

        layout(location = 0) out vec4 pc_fragColor;

        uniform sampler2D background0;
        uniform sampler2D background1;
        uniform sampler2D background2;
        uniform sampler2D background3;
        uniform sampler2D background4;
        uniform float treadmillMovement;

        in vec2 vUv;

        void main() {
          vec4 diffuseColor;

          float offset = treadmillMovement;

          vec4 texel = texture(background0, vec2(vUv.x, vUv.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, texel.rgb, texel.a);

          texel = texture(background1, vec2(vUv.x + offset * 0.05, vUv.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, texel.rgb, texel.a);
          
          texel = texture(background2, vec2(vUv.x + offset * 0.125, vUv.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, texel.rgb, texel.a);
          
          texel = texture(background3, vec2(vUv.x + offset * 0.3, vUv.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, texel.rgb, texel.a);
          
          texel = texture(background4, vec2(vUv.x + offset, vUv.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, texel.rgb, texel.a);

          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.015);
          pc_fragColor = vec4(diffuseColor.rgb, 1.0);
          pc_fragColor = linearToOutputTexel(pc_fragColor);
        }
      `,
      uniforms: {
        aspect: { value: 1 },
        background0: { value: textures[0] },
        background1: { value: textures[1] },
        background2: { value: textures[2] },
        background3: { value: textures[3] },
        background4: { value: textures[4] },
        treadmillMovement: { value: 0 },
      },
      //depthWrite: false,
      //depthFunc: THREE.Alwa,
    });

    this.fsQuad = new FullScreenQuad(this.material);
  }

  // addOffset(val: number) {
  //   this.material.uniforms["treadmillMovement"].value += val;
  //   invTexel * Math.round(val / invTexel);
  // }

  render(renderer: THREE.WebGLRenderer, aspect: number) {
    this.material.uniforms["aspect"].value = aspect / 1.777777;
    renderer.getSize(renderSize);
    this.material.uniforms["treadmillMovement"].value =
      (1.0 / renderSize.x) *
      Math.round((this.treadmillMovement * 0.01) / invTexel);

    this.fsQuad.render(renderer);
  }
}
