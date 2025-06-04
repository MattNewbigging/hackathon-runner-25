import * as THREE from "three";
import { seededRandom } from "./seeded-random";
import { randomFloat } from "./game-state";
import { AssetManager, AudioAsset, TextureAsset } from "./asset-manager";

export class Bird extends THREE.Mesh {
  private flying = false;
  private direction: THREE.Vector3;

  private readonly speed = randomFloat(10, 14);

  private readonly flyingMaterial: THREE.ShaderMaterial;
  // private readonly standingMaterial: THREE.MeshBasicMaterial;

  private readonly flapSound?: THREE.Audio;

  constructor(
    position: THREE.Vector3Like,
    private readonly assetManager: AssetManager,
    private readonly audioListener: THREE.AudioListener
  ) {
    const standingTexture = assetManager.textures.get(TextureAsset.Crow)!;
    const flyingTexture = assetManager.textures.get(TextureAsset.Crow_Flying)!;

    const geometry = new THREE.PlaneGeometry().translate(0, 0.5, 0);
    const material = new THREE.MeshBasicMaterial({
      map: standingTexture,
      alphaTest: 0.5,
      //color: 0xff0000,
      //depthFunc: THREE.AlwaysDepth,
    });
    super(geometry, material);

    this.position.x = position.x;
    this.position.y = position.y;

    this.flapSound = this.createAudioFor(AudioAsset.Bird)!;
    this.flapSound.setVolume(0.5);
    this.flapSound.detune = (Math.random() * 2 - 1) * 100; // up or down a semitone

    // Random direction that the bird will fly in
    const randomSign = Math.sign(Math.random() * 2.0 - 1.0);
    this.scale.x *= randomSign;

    const xDir = randomFloat(0.25, 0.5) * randomSign;
    this.direction = new THREE.Vector3(xDir, 0.5, 0).normalize();

    // flying material
    this.flyingMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `
        uniform float elapsed;
        out vec2 vUv;

        const float speed = 12.0; // fps

        void main() {
          int frame = int(mod(floor(elapsed * speed), 4.0));
          vec2 frameOffset = vec2(float(frame % 2), float(frame / 2)) * 0.5;
          vec2 scaledUV = uv * 0.5;
          vec2 finalUV = scaledUV + frameOffset;

          vUv = finalUV;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        precision highp int;

        layout(location = 0) out vec4 pc_fragColor;

        uniform sampler2D spriteSheet;
        in vec2 vUv;

        void main() {
          vec4 texel = texture(spriteSheet, vUv);

          if (texel.a < 0.8) discard;

          pc_fragColor = texel;
          pc_fragColor = linearToOutputTexel(pc_fragColor);
        }
      `,
      uniforms: {
        elapsed: { value: 0 },
        spriteSheet: { value: flyingTexture },
      },
      alphaTest: 0.5,
    });
  }

  update(dt: number) {
    if (!this.flying) {
      this.checkDistance();

      return;
    }

    this.flyingMaterial.uniforms["elapsed"].value += dt;
    const step = this.direction.clone().multiplyScalar(this.speed * dt);
    this.position.add(step);
  }

  checkDistance() {
    if (this.position.x < 8) {
      this.flying = true;
      this.material = this.flyingMaterial;
      this.flapSound?.play();
    }
  }

  private createAudioFor(name: AudioAsset) {
    const buffer = this.assetManager.audioBuffers.get(name);
    if (!buffer) return;

    const sound = new THREE.Audio(this.audioListener);
    sound.setBuffer(buffer);

    return sound;
  }
}
