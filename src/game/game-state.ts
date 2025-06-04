import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import {
  AssetManager,
  AudioAsset,
  ModelAsset,
  TextureAsset,
} from "./asset-manager";
import { KeyboardListener } from "../listeners/keyboard-listener";
import { GRAVITY, JUMP_VELOCITY, Player } from "./player";
import { eventListener } from "../events/event-listener";
import { seededRandom } from "./seeded-random";
import { BGPass } from "./bg-pass";
import { Bird } from "./bird";

interface Platform {
  position: number;
  width: number;
  height: number;
}

interface Level {
  chunks: PlatformChunk[];
}

interface PlatformChunk {
  medianPosition: number;
  platforms: Platform[];
}

// reused
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: "#02151c" });

export class GameState {
  private gameOver = false;
  private updateFrameRequest = 0;
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private viewSize = 10; // meters
  //private controls: OrbitControls;

  private keyboardListener = new KeyboardListener();
  private audioListener = new THREE.AudioListener();
  private ambience: THREE.Audio;

  private player: Player;

  private treadmillTravel = 0; // how many units the treadmill has moved
  private treadmillSpeed = 8;

  private level: Level = {
    chunks: [],
  };

  private platformMeshes: THREE.Mesh[] = [];
  private playerMarkers: THREE.Mesh[] = [];
  private readonly birds: Bird[] = [];

  private reused = {
    overlap: new THREE.Box3(),
    vec3: new THREE.Vector3(),
    floorBounds: new THREE.Box3(),
  };

  private readonly bgPass: BGPass;

  constructor(private assetManager: AssetManager) {
    this.setupCamera();
    this.renderer = this.setupRenderer();
    //this.controls = this.setupControls();
    this.ambience = this.setupAmbienceAudio();

    // Set up all the background images
    this.bgPass = new BGPass([
      this.assetManager.textures.get(TextureAsset.Background1)!,
      this.assetManager.textures.get(TextureAsset.Background2)!,
      this.assetManager.textures.get(TextureAsset.Background3)!,
      this.assetManager.textures.get(TextureAsset.Background4)!,
      this.assetManager.textures.get(TextureAsset.Background5)!,
    ]);

    // Listeners
    this.keyboardListener.on(" ", this.onJump);
    window.onblur = this.pause;
    window.onblur = this.pause;
    window.onfocus = this.play;
    window.addEventListener("pointerdown", this.onJump);
    window.addEventListener("touchstart", () => this.onJump);

    //

    // const skull = this.createPlayerMarker(new THREE.Vector3(20, 5, 0));
    // this.scene.add(skull);

    //

    this.player = new Player(assetManager, this.audioListener);
    this.scene.add(this.player);

    //

    const startingPlatform: Platform = {
      position: 3,
      width: 10,
      height: 0,
    };
    const startingPlatformMesh = this.createPlatformMesh(startingPlatform);
    const startingChunk: PlatformChunk = {
      medianPosition: 3,
      platforms: [startingPlatform],
    };
    this.level.chunks.push(startingChunk);

    this.platformMeshes.push(startingPlatformMesh);
    this.scene.add(startingPlatformMesh);

    const chunk = generateChunk(
      this.level,
      this.treadmillSpeed,
      this.viewSize,
      5,
      5
    ); // todo expose player jump height
    this.level.chunks.push(chunk);
    chunk.platforms.forEach((p) => {
      const mesh = this.createPlatformMesh(p);
      this.platformMeshes.push(mesh);
      this.scene.add(mesh);
    });

    // Start game
    this.play();
  }

  private getDistanceTravelled() {
    return this.treadmillTravel - Math.abs(this.player.position.x);
  }

  private getLeaderboardData() {
    // Get so many entries

    // Fetch data on leaderboard entries
    const data = [{}];
  }

  private setupCamera() {
    this.camera.far = 200;
    this.camera.position.set(10, 0, 10);
    this.camera.add(this.audioListener);
  }

  private setupRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.autoClear = false;

    document.body.append(renderer.domElement);

    return renderer;
  }

  private setupControls() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.target.copy(this.camera.position);
    controls.target.z = 0;

    return controls;
  }

  private setupAmbienceAudio() {
    const buffer = this.assetManager.audioBuffers.get(AudioAsset.Ambience)!;
    const sound = new THREE.Audio(this.audioListener);
    sound.setBuffer(buffer);
    sound.setVolume(0.1);
    sound.loop = true;
    return sound;
  }

  private createPlayerMarker(pos: THREE.Vector3) {
    const skull = this.assetManager.getModel(ModelAsset.Skull) as THREE.Mesh;
    skull.scale.multiplyScalar(0.015);
    skull.position.copy(pos);

    this.assetManager.applyModelTexture(skull, TextureAsset.SkullGrey);

    this.playerMarkers.push(skull);

    return skull;
  }

  private createPlatformMesh(platform: Platform): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.x = platform.position;
    mesh.scale.x = platform.width;
    mesh.scale.y = platform.height + 25;
    mesh.position.y = platform.height * 0.5 - 12.5;

    return mesh;
  }

  private onJump = () => {
    this.player.jump();
  };

  private updateAspect(): number {
    const canvas = this.renderer.domElement;
    this.renderer.setSize(
      canvas.clientWidth * 0.5,
      canvas.clientHeight * 0.5,
      false
    );

    const aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.left = -this.viewSize * aspect;
    this.camera.right = this.viewSize * aspect;
    this.camera.top = this.viewSize;
    this.camera.bottom = -this.viewSize;

    this.camera.position.x = this.viewSize * aspect * 0.5;

    this.camera.updateProjectionMatrix();

    return aspect;
  }

  private isPlayerOffScreen() {
    return this.player.position.y + 1.8 < -this.viewSize;
  }

  private updateTreadmill(dt: number) {
    // Treadmill is always speeding up
    this.treadmillSpeed += dt * 0.1;

    const treadmillMovement = this.treadmillSpeed * dt;

    // Floors
    for (const floor of this.platformMeshes) {
      floor.position.x -= treadmillMovement;
    }

    // Player markers
    for (const marker of this.playerMarkers) {
      marker.position.x -= treadmillMovement;
      marker.rotation.y += dt;
    }

    // birds
    for (const bird of this.birds) {
      bird.position.x -= treadmillMovement;
    }

    // Keep track of treadmill distance travelled
    this.treadmillTravel += treadmillMovement;

    // update BG uniforms
    this.bgPass.treadmillMovement += treadmillMovement;
  }

  private collisions() {
    this.player.updateMatrixWorld();

    const playerBounds = this.player.bounds.clone();
    playerBounds.applyMatrix4(this.player.matrixWorld);

    for (const floor of this.platformMeshes) {
      const overlap = this.reused.overlap;
      const floorBounds = this.reused.floorBounds.setFromObject(floor);
      overlap.copy(playerBounds);
      overlap.intersect(floorBounds);

      // No intersection with this floor - check others
      const overlapSize = overlap.getSize(this.reused.vec3);

      if (overlapSize.length() < 0.01) continue;

      // Find the side with the smallest overlap and push out in that direction
      if (overlapSize.y < overlapSize.x) {
        this.player.position.y += overlapSize.y;
        // We hit the floor - reset velocity so it does not accumulate while on the floor
        this.player.land();
      } else {
        this.player.position.x -= overlapSize.x;
      }

      return;
    }

    this.player.fall();
  }

  private pause = () => {
    cancelAnimationFrame(this.updateFrameRequest);
    this.clock.stop();
    eventListener.fire("game-paused", null);
    this.ambience.pause();
    this.player.pauseSounds();
  };

  private play = () => {
    this.clock.start();
    this.ambience.play();
    this.player.resumeSounds();
    this.update();
  };

  private update = () => {
    this.updateFrameRequest = requestAnimationFrame(this.update);

    const dt = this.clock.getDelta();

    //this.controls.update();

    //

    this.player.update(dt, this.treadmillSpeed);

    if (this.isPlayerOffScreen()) {
      // Game over
      this.pause();
      this.onGameOver();
    }

    this.updateTreadmill(dt);

    //

    this.collisions();

    this.generateNewChunk();

    const aspect = this.updateAspect();

    for (let i = this.birds.length; i--; ) {
      const bird = this.birds[i];

      bird.update(dt);

      if (bird.position.y >= this.viewSize) {
        this.scene.remove(bird);
        this.birds.splice(i, 1);
      }
    }

    this.renderer.clear();
    this.bgPass.render(this.renderer, aspect);

    this.renderer.render(this.scene, this.camera);
  };

  private onGameOver() {
    if (this.gameOver) return;

    this.player.splat();
    // Send request to backend with name + distance travelled
    const distanceTravelled = this.getDistanceTravelled();
    console.error("GAME OVER!", distanceTravelled);
    this.gameOver = true;
  }

  private generateNewChunk() {
    const lastChunk = this.level.chunks.at(-1);
    if (!lastChunk) {
      throw new Error("malformed level structure");
    }

    if (lastChunk.medianPosition > this.treadmillTravel) return;

    const newChunk = generateChunk(
      this.level,
      this.treadmillSpeed,
      this.viewSize,
      JUMP_VELOCITY * 0.95, // add some leeway
      5
    );

    // birds
    newChunk.platforms.forEach((platform) => {
      const random = Math.random();
      if (random <= 0.4) {
        // make some birds
        const amount = Math.ceil(Math.random() * 3);

        for (let i = 0; i < amount; i++) {
          const xPos =
            randomFloat(
              platform.position - platform.width * 0.45,
              platform.position + platform.width * 0.45
            ) - this.treadmillTravel;
          const birdPos = { x: xPos, y: platform.height, z: 0 };
          const bird = new Bird(birdPos, this.assetManager, this.audioListener);
          this.birds.push(bird);
          this.scene.add(bird);
        }
      }
    });

    this.level.chunks.push(newChunk);
    newChunk.platforms.forEach((p) => {
      const mesh = this.createPlatformMesh(p);
      mesh.position.x -= this.treadmillTravel;
      this.platformMeshes.push(mesh);
      this.scene.add(mesh);
    });
  }
}

function generateChunk(
  level: Level,
  currSpeed: number,
  heightRadius: number,
  playerJumpHeight: number,
  count: number
): PlatformChunk {
  const lastChunk = level.chunks.at(-1);
  let lastPlatform = lastChunk?.platforms.at(-1);
  if (!lastPlatform || !lastPlatform)
    throw new Error("malformed level structure");

  const platforms: Platform[] = [];
  let medianPosition = 0;

  for (let i = 0; i < count; i++) {
    let platformFurthestRightPoint =
      lastPlatform.position + lastPlatform.width * 0.5;

    const width = seededRandom.randomFloat(6, 15); // todo decrease minimum width over time?

    const maxReachableHeightFromLast =
      lastPlatform.height +
      (playerJumpHeight * playerJumpHeight) / (2 * GRAVITY); // vertical apex

    // Random absolute height within the allowed range
    let desiredHeight = seededRandom.randomFloat(-heightRadius, heightRadius);

    // Clamp to physically reachable apex from the last platform
    desiredHeight = Math.min(desiredHeight, maxReachableHeightFromLast);

    // Also clamp to the vertical bounds of the level
    desiredHeight = Math.max(
      -heightRadius + 1,
      Math.min(desiredHeight, heightRadius - 1)
    );

    const { distance: xPosition, adjustedY1: yPosition } =
      horizontalDistanceWithVyMax(
        currSpeed,
        playerJumpHeight,
        lastPlatform.height,
        desiredHeight
      );

    const edgeToEdgeDistance = xPosition;
    const newPlatform: Platform = {
      //position: platformFurthestRightPoint + xPosition + width * 0.5, // -2m for leeway - todo change this to something better
      position: platformFurthestRightPoint + edgeToEdgeDistance + width * 0.5,
      width: width,
      height: yPosition,
    };

    platforms.push(newPlatform);
    lastPlatform = newPlatform;
    medianPosition += newPlatform.position;
  }

  medianPosition /= 5;

  return {
    medianPosition,
    platforms,
  };
}

function horizontalDistanceWithVyMax(
  vx: number,
  vyMax: number,
  y0: number,
  y1: number
): { distance: number; adjustedY1: number } {
  const maxHeight = y0 + (vyMax * vyMax) / (2 * GRAVITY);

  let adjustedY1 = y1;
  if (y1 > maxHeight) {
    adjustedY1 = maxHeight;
  }

  const deltaY = adjustedY1 - y0;
  let time: number;

  if (deltaY >= 0) {
    // Ascending jump — split time into rise + fall
    const timeToApex = vyMax / GRAVITY;
    const fallDistance = maxHeight - adjustedY1;
    const timeToFall = Math.sqrt((2 * fallDistance) / GRAVITY);
    time = timeToApex + timeToFall;
  } else {
    const rnd = seededRandom.random();
    //if (rnd < 0.5) {
    const timeToApex = vyMax / GRAVITY;
    const fallDistance = maxHeight - adjustedY1 * rnd * 0.9;
    const timeToFall = Math.sqrt((2 * fallDistance) / GRAVITY);
    time = timeToApex + timeToFall;
    // } else {
    //   // Falling down directly
    //   time = Math.sqrt((2 * -deltaY) / GRAVITY);
    // }
  }

  const horizontalLeeway = 1;
  const distance = vx * time - horizontalLeeway;

  return {
    distance,
    adjustedY1,
  };
}

export function randomFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
