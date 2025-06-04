import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";

export enum AnimationAsset {
  Sprint = "A_Sprint_F_Masc.fbx",
  JumpStart = "jump_start.fbx",
  JumpLoop = "jump_loop.fbx",
  JumpEnd = "jump_end.fbx",
}

export enum AudioAsset {
  StepA = "Bare Step Rug Hard A.wav",
  StepB = "Bare Step Rug Hard B.wav",
  StepC = "Bare Step Rug Hard C.wav",
  StepD = "Bare Step Rug Hard D.wav",
  StepE = "Bare Step Rug Hard E.wav",
  JumpA = "Jump Step Stone A.wav",
  JumpB = "Jump Step Stone B.wav",
  JumpC = "Jump Step Rug A.wav",
  JumpD = "Jump Step Rug B.wav",
  LandA = "Land Step Rug A.wav",
  LandB = "Land Step Rug B.wav",
  LandC = "Land Step Stone A.wav",
  LandD = "Land Step Stone B.wav",
  AirA = "Air Reverse Slow A.wav",
  Splat = "Concrete Trampoline.wav",
  Ambience = "Windy Roadside Loop.wav",
  Bird = "bird_flying.wav",
}

export enum ModelAsset {
  DummyCharacter = "PolygonSyntyCharacter.fbx",
  Skull = "SM_Icon_Skull_01.fbx",
}

export enum TextureAsset {
  Dummy = "T_Polygon_Dummy_01.png",
  HDR = "orchard_cartoony.hdr",
  Background1 = "/bg/1.png",
  Background2 = "/bg/2.png",
  Background3 = "/bg/3.png",
  Background4 = "/bg/4.png",
  Background5 = "/bg/5.png",
  SkullGrey = "PolygonIcons_Texture_01_A.png",
  Crow = "crow.png",
  Crow_Flying = "crow_flying.png",
}

const FOREGROUND_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x000000 });

export class AssetManager {
  private models = new Map<ModelAsset, THREE.Group>();
  textures = new Map<TextureAsset, THREE.Texture>();
  animations = new Map<AnimationAsset, THREE.AnimationClip>();
  audioBuffers = new Map<AudioAsset, AudioBuffer>();

  private loadingManager = new THREE.LoadingManager();
  private fbxLoader = new FBXLoader(this.loadingManager);
  private gltfLoader = new GLTFLoader(this.loadingManager);
  private rgbeLoader = new RGBELoader(this.loadingManager);
  private textureLoader = new THREE.TextureLoader(this.loadingManager);
  private audioLoader = new THREE.AudioLoader(this.loadingManager);

  applyModelTexture(model: THREE.Object3D, textureName: TextureAsset) {
    const texture = this.textures.get(textureName);
    if (!texture) {
      return;
    }

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material.map = texture;
        child.material.vertexColors = false;
      }
    });
  }

  getModel(name: ModelAsset): THREE.Object3D {
    const model = this.models.get(name);
    if (model) {
      return SkeletonUtils.clone(model);
    }

    // Ensure we always return an object 3d
    return new THREE.Mesh(
      new THREE.SphereGeometry(),
      new THREE.MeshBasicMaterial({ color: "red" })
    );
  }

  load(): Promise<void> {
    this.loadModels();
    this.loadTextures();
    this.loadAnimations();
    this.loadAudios();

    return new Promise((resolve) => {
      this.loadingManager.onLoad = () => {
        resolve();
      };
    });
  }

  private loadModels() {
    this.loadModel(ModelAsset.DummyCharacter);
    this.loadModel(ModelAsset.Skull);
  }

  private loadTextures() {
    this.loadTexture(
      TextureAsset.Dummy,
      (texture) => (texture.colorSpace = THREE.SRGBColorSpace)
    );

    this.loadTexture(
      TextureAsset.HDR,
      (texture) => (texture.mapping = THREE.EquirectangularReflectionMapping)
    );

    const bgs = [
      TextureAsset.Background1,
      TextureAsset.Background2,
      TextureAsset.Background3,
      TextureAsset.Background4,
      TextureAsset.Background5,
    ];

    bgs.map((x) =>
      this.loadTexture(x, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
      })
    );

    this.loadTexture(
      TextureAsset.SkullGrey,
      (texture) => (texture.colorSpace = THREE.SRGBColorSpace)
    );

    this.loadTexture(TextureAsset.Crow, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
    });

    this.loadTexture(TextureAsset.Crow_Flying, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
    });
  }

  private loadAnimations() {
    Object.values(AnimationAsset).forEach((filename) =>
      this.loadAnimation(filename)
    );
  }

  private loadAudios() {
    Object.values(AudioAsset).forEach((filename) => this.loadAudio(filename));
  }

  private loadModel(
    filename: ModelAsset,
    onLoad?: (group: THREE.Group) => void
  ) {
    const path = `${getPathPrefix()}/models/${filename}`;
    const url = getUrl(path);

    const filetype = filename.split(".")[1];

    // FBX
    if (filetype === "fbx") {
      this.fbxLoader.load(url, (group: THREE.Group) => {
        onLoad?.(group);

        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.material = FOREGROUND_MATERIAL;
          }
        });

        this.models.set(filename, group);
      });

      return;
    }

    // GLTF
    this.gltfLoader.load(url, (gltf: GLTF) => {
      onLoad?.(gltf.scene);
      this.models.set(filename, gltf.scene);
    });
  }

  private loadTexture(
    filename: TextureAsset,
    onLoad?: (texture: THREE.Texture) => void
  ) {
    const path = `${getPathPrefix()}/textures/${filename}`;
    const url = getUrl(path);

    const filetype = filename.split(".")[1];
    const loader = filetype === "png" ? this.textureLoader : this.rgbeLoader;

    loader.load(url, (texture) => {
      onLoad?.(texture);
      this.textures.set(filename, texture);
    });
  }

  private loadAnimation(filename: AnimationAsset) {
    const path = `${getPathPrefix()}/anims/${filename}`;
    const url = getUrl(path);

    this.fbxLoader.load(url, (group) => {
      if (group.animations.length) {
        const clip = group.animations[0];
        clip.name = filename;
        this.animations.set(filename, clip);
      }
    });
  }

  private loadAudio(filename: AudioAsset) {
    const path = `${getPathPrefix()}/audio/${filename}`;
    const url = getUrl(path);

    this.audioLoader.load(url, (buffer) => {
      this.audioBuffers.set(filename, buffer);
    });
  }
}

function getPathPrefix() {
  // Using template strings to create url paths breaks on github pages
  // We need to manually add the required /repo/ prefix to the path if not on localhost
  return location.hostname === "localhost" ? "" : "/hackathon-runner-25";
}

function getUrl(path: string) {
  return new URL(path, import.meta.url).href;
}
