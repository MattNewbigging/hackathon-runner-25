import * as THREE from "three";
import {
  AnimationAsset,
  AssetManager,
  AudioAsset,
  ModelAsset,
  TextureAsset,
} from "./asset-manager";

export const JUMP_VELOCITY = 10;
export const GRAVITY = 9.81 * 1.5;

export class Player extends THREE.Object3D {
  velocity = new THREE.Vector3();
  jumping = false;
  falling = false;
  bounds: THREE.Box3;
  private gravity = new THREE.Vector3(0, -GRAVITY, 0);
  private mixer: THREE.AnimationMixer;
  private actions = new Map<AnimationAsset, THREE.AnimationAction>();
  private currentAction?: THREE.AnimationAction;

  private runningAnimSpeed = 1;

  private stepSounds: THREE.Audio[] = [];
  private jumpSounds: THREE.Audio[] = [];
  private landSounds: THREE.Audio[] = [];
  airSound: THREE.Audio;
  splatSound: THREE.Audio;
  private stepTimer = 0;
  soundsPaused = false;

  constructor(
    private assetManager: AssetManager,
    private audioListener: THREE.AudioListener
  ) {
    super();

    // Setup mesh
    const mesh = assetManager.getModel(ModelAsset.DummyCharacter);
    mesh.scale.multiplyScalar(0.01);
    mesh.rotateY(Math.PI / 2);

    mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        // todo custom fresnel shader
        obj.material = new THREE.MeshBasicMaterial({
          color: "#02151c",
        });
      }
    });

    //assetManager.applyModelTexture(mesh, TextureAsset.Dummy);
    this.add(mesh);

    // Bounds
    this.bounds = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(0, 0.9, 0),
      new THREE.Vector3(0.6, 1.8, 0.6)
    );

    // Animations
    this.mixer = new THREE.AnimationMixer(mesh);
    this.setupAnimations();
    this.mixer.addEventListener("finished", this.onAnimationFinish);
    this.playAnimation(AnimationAsset.Sprint);

    // SFX
    this.setupAudio();
    this.airSound = this.createAudioFor(AudioAsset.AirA)!;
    this.splatSound = this.createAudioFor(AudioAsset.Splat)!;
  }

  jump() {
    if (!this.jumping && !this.falling) {
      this.velocity.y += JUMP_VELOCITY;
      this.jumping = true;
      this.playAnimation(AnimationAsset.JumpStart);
      this.playRandomSound(this.jumpSounds);
      this.airSound.stop();
      setTimeout(() => {
        if (this.jumping && !this.soundsPaused) {
          this.airSound.stop().play();
        }
      }, 750);
    }
  }

  land() {
    if (this.jumping || this.falling) {
      this.playAnimation(AnimationAsset.JumpEnd);
      this.airSound.stop();
      this.playRandomSound(this.landSounds);

      this.jumping = false;
      this.falling = false;
    }

    this.velocity.y = 0;
  }

  fall() {
    if (!this.jumping && !this.falling) {
      this.playAnimation(AnimationAsset.JumpLoop);
      this.falling = true;
      this.airSound.stop().play();
    }
  }

  splat() {
    this.airSound.stop();
    this.splatSound.stop().play();
  }

  pauseSounds() {
    this.soundsPaused = true;
    this.airSound.pause();
  }

  resumeSounds() {
    this.soundsPaused = false;
  }

  playAnimation(name: AnimationAsset) {
    // Find the new action with the given name
    const nextAction = this.actions.get(name);
    if (!nextAction) {
      throw Error(
        "Could not find action with name " + name + "for character " + this
      );
    }

    // Reset the next action then fade to it from the current action
    nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);

    if (name === AnimationAsset.Sprint) {
      this.currentAction?.stop();
      nextAction.play();
    } else if (this.currentAction) {
      nextAction.crossFadeFrom(this.currentAction, 0.25, false).play();
    }

    // Next is now current
    this.currentAction = nextAction;
  }

  update(dt: number, treadmillSpeed: number) {
    // Velocity is always affected by gravity
    this.velocity.add(this.gravity.clone().multiplyScalar(dt));

    // Move according to velocity
    this.position.add(this.velocity.clone().multiplyScalar(dt));

    this.runningAnimSpeed += treadmillSpeed * dt * 0.0005;
    const sprintAnim = this.actions.get(AnimationAsset.Sprint);
    const jumpAnim = this.actions.get(AnimationAsset.JumpEnd);
    if (sprintAnim && jumpAnim) {
      sprintAnim.setEffectiveTimeScale(this.runningAnimSpeed);
      jumpAnim.setEffectiveTimeScale(this.runningAnimSpeed);
    }

    // Play running sfx
    if (!this.jumping && !this.falling) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.playRandomSound(this.stepSounds);
        this.stepTimer = 1 / 3;
      }
    }

    this.mixer.update(dt);
  }

  private onAnimationFinish = (event: { action: THREE.AnimationAction }) => {
    const actionName = event.action.getClip().name as AnimationAsset;

    switch (actionName) {
      case AnimationAsset.JumpStart:
        this.playAnimation(AnimationAsset.JumpLoop);
        break;
      case AnimationAsset.JumpEnd:
        if (!this.jumping) {
          this.playAnimation(AnimationAsset.Sprint);
        }
        break;
    }
  };

  private setupAnimations() {
    this.createActionFor(AnimationAsset.Sprint, { timescale: 0.8 });
    this.createActionFor(AnimationAsset.JumpStart, {
      loopOnce: true,
      clampWhenFinished: true,
    });
    this.createActionFor(AnimationAsset.JumpLoop, { loopRepeat: true });
    this.createActionFor(AnimationAsset.JumpEnd, { loopOnce: true });
  }

  private createActionFor(
    anim: AnimationAsset,
    options?: {
      ignoreRootMotion?: boolean;
      loopOnce?: boolean;
      loopRepeat?: boolean;
      clampWhenFinished?: boolean;
      timescale?: number;
    }
  ) {
    const clip = this.assetManager.animations.get(anim);
    if (!clip) return;

    clip.name = anim.toString();

    if (options?.ignoreRootMotion) {
      clip.tracks[0].values = new Float32Array();
    }

    const action = this.mixer.clipAction(clip);

    if (options?.loopOnce) {
      action.setLoop(THREE.LoopOnce, 1);
    }
    if (options?.loopRepeat) {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    if (options?.clampWhenFinished) {
      action.clampWhenFinished = true;
    }
    if (options?.timescale !== undefined) {
      action.timeScale = options.timescale;
    }

    this.actions.set(anim, action);
  }

  private playRandomSound(sounds: THREE.Audio[]) {
    const rnd = Math.floor(Math.random() * sounds.length);
    sounds[rnd].stop().play();
  }

  private setupAudio() {
    this.stepSounds = [
      this.createAudioFor(AudioAsset.StepA),
      this.createAudioFor(AudioAsset.StepB),
      this.createAudioFor(AudioAsset.StepC),
      this.createAudioFor(AudioAsset.StepD),
      this.createAudioFor(AudioAsset.StepE),
    ].filter((sound) => !!sound);

    this.jumpSounds = [
      this.createAudioFor(AudioAsset.JumpA),
      this.createAudioFor(AudioAsset.JumpB),
      this.createAudioFor(AudioAsset.JumpC),
      this.createAudioFor(AudioAsset.JumpD),
    ].filter((sound) => !!sound);

    this.landSounds = [
      this.createAudioFor(AudioAsset.LandA),
      this.createAudioFor(AudioAsset.LandB),
      this.createAudioFor(AudioAsset.LandC),
      this.createAudioFor(AudioAsset.LandD),
    ].filter((sound) => !!sound);
  }

  private createAudioFor(name: AudioAsset) {
    const buffer = this.assetManager.audioBuffers.get(name);
    if (!buffer) return;

    const sound = new THREE.Audio(this.audioListener);
    sound.setBuffer(buffer);

    return sound;
  }
}
