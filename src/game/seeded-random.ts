class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // LCG parameters from Numerical Recipes
  private nextSeed(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 0x100000000;
    return this.seed;
  }

  random(): number {
    return this.nextSeed() / 0x100000000;
  }

  // Helper: random integer between min and max (inclusive)
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  // Helper: random float between min and max
  randomFloat(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }
}

export const seededRandom = new SeededRandom(12345678);
