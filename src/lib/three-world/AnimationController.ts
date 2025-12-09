import * as THREE from 'three';

export interface AnimationControllerOptions {
  mesh: THREE.Group;
  animations?: THREE.AnimationClip[];
}

export class AnimationController {
  private mixer?: THREE.AnimationMixer;
  private animations: Map<string, THREE.AnimationAction> = new Map();
  private currentAnimation?: THREE.AnimationAction;
  private mesh: THREE.Group;

  constructor(options: AnimationControllerOptions) {
    this.mesh = options.mesh;

    if (options.animations && options.animations.length > 0) {
      this.setupAnimations(options.animations);
    }
  }

  /**
   * Setup animations from animation clips
   */
  public setupAnimations(clips: THREE.AnimationClip[]): void {
    this.mixer = new THREE.AnimationMixer(this.mesh);

    clips.forEach((clip) => {
      const action = this.mixer!.clipAction(clip);
      this.animations.set(clip.name, action);
      console.log(`[AnimationController] Loaded animation: ${clip.name}`);
    });
  }

  /**
   * Play an animation by name with optional fade time
   */
  public playAnimation(
    name: string, 
    fadeTime: number = 0.2,
    loop: THREE.AnimationActionLoopStyles = THREE.LoopRepeat
  ): boolean {
    const nextAnimation = this.animations.get(name);
    
    if (!nextAnimation) {
      console.warn(`[AnimationController] Animation "${name}" not found`);
      return false;
    }

    if (this.currentAnimation === nextAnimation) {
      return true; // Already playing this animation
    }

    if (this.currentAnimation) {
      this.currentAnimation.fadeOut(fadeTime);
    }

    nextAnimation.setLoop(loop, Infinity);
    nextAnimation.reset().fadeIn(fadeTime).play();
    this.currentAnimation = nextAnimation;
    
    return true;
  }

  /**
   * Fade from current animation to target animation
   */
  public fadeToAnimation(name: string, fadeTime: number = 0.5): boolean {
    return this.playAnimation(name, fadeTime);
  }

  /**
   * Play animation once (no loop)
   */
  public playAnimationOnce(
    name: string, 
    fadeTime: number = 0.2,
    onComplete?: () => void
  ): boolean {
    const nextAnimation = this.animations.get(name);
    
    if (!nextAnimation) {
      console.warn(`[AnimationController] Animation "${name}" not found`);
      return false;
    }

    if (this.currentAnimation) {
      this.currentAnimation.fadeOut(fadeTime);
    }

    nextAnimation.setLoop(THREE.LoopOnce, 1);
    nextAnimation.clampWhenFinished = true;
    nextAnimation.reset().fadeIn(fadeTime).play();
    this.currentAnimation = nextAnimation;

    // Setup completion callback
    if (onComplete && this.mixer) {
      const onFinished = (event: any) => {
        if (event.action === nextAnimation) {
          this.mixer?.removeEventListener('finished', onFinished);
          onComplete();
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    }
    
    return true;
  }

  /**
   * Stop all animations
   */
  public stopAllAnimations(): void {
    this.animations.forEach((action) => {
      action.stop();
    });
    this.currentAnimation = undefined;
  }

  /**
   * Stop specific animation
   */
  public stopAnimation(name: string): boolean {
    const action = this.animations.get(name);
    if (action) {
      action.stop();
      if (this.currentAnimation === action) {
        this.currentAnimation = undefined;
      }
      return true;
    }
    return false;
  }

  /**
   * Check if animation exists
   */
  public hasAnimation(name: string): boolean {
    return this.animations.has(name);
  }

  /**
   * Get current animation name
   */
  public getCurrentAnimationName(): string | undefined {
    if (!this.currentAnimation) return undefined;
    
    for (const [name, action] of this.animations) {
      if (action === this.currentAnimation) {
        return name;
      }
    }
    return undefined;
  }

  /**
   * Get all available animation names
   */
  public getAnimationNames(): string[] {
    return Array.from(this.animations.keys());
  }

  /**
   * Update animation mixer - should be called in update loop
   */
  public update(deltaTime: number): void {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
  }

  /**
   * Get the animation mixer
   */
  public getMixer(): THREE.AnimationMixer | undefined {
    return this.mixer;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.stopAllAnimations();
    this.animations.clear();
    this.mixer = undefined;
    this.currentAnimation = undefined;
  }
}
