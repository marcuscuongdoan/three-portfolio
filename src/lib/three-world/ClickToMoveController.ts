import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as TWEEN from '@tweenjs/tween.js';
import { AnimationController } from './AnimationController';
import { PhysicsBody } from './PhysicsBody';

export enum MovementState {
  Idle = 'idle',
  Moving = 'moving'
}

export interface ClickToMoveControllerOptions {
  mesh: THREE.Group;
  world: CANNON.World;
  initialPosition?: THREE.Vector3;
  animations?: THREE.AnimationClip[];
  radius?: number;
  height?: number;
  moveSpeed?: number;
  jumpForce?: number;
  gravity?: number;
}

export class ClickToMoveController {
  private mesh: THREE.Group;

  // Separated controllers
  private animationController: AnimationController;
  private physicsBody: PhysicsBody;

  // Character dimensions
  private radius: number;
  private height: number;

  // Movement state
  private currentState: MovementState = MovementState.Idle;
  private isMoving: boolean = false;

  // Jumping
  private isJumping: boolean = false;
  private jumpVelocity: number = 0;
  private groundHeight: number = 2; // Default ground height
  private jumpForce: number;
  private gravity: number;

  // Tween
  private tweenGroup: TWEEN.Group = new TWEEN.Group();
  private currentTween?: TWEEN.Tween<THREE.Vector3>;

  // Movement settings
  private moveSpeed: number;

  constructor(options: ClickToMoveControllerOptions) {
    this.mesh = options.mesh;
    this.radius = options.radius ?? 0.3;
    this.height = options.height ?? 1.7;
    this.moveSpeed = options.moveSpeed ?? 100;
    this.jumpForce = options.jumpForce ?? 8;
    this.gravity = options.gravity ?? 20;

    const initialPosition = options.initialPosition ?? new THREE.Vector3(0, 2, 0);

    // Initialize animation controller
    this.animationController = new AnimationController({
      mesh: this.mesh,
      animations: options.animations
    });

    // Initialize physics body (capsule approximation using cylinder)
    const shape = new CANNON.Cylinder(this.radius, this.radius, this.height, 8);
    this.physicsBody = new PhysicsBody(options.world, shape, {
      mass: 1,
      friction: 0,
      restitution: 0,
      fixedRotation: true,
      linearDamping: 0.5,
      position: initialPosition
    });

    // Position mesh
    this.mesh.position.copy(initialPosition);

    // Play idle animation by default
    this.playIdleAnimation();
  }

  /**
   * Play idle animation
   */
  private playIdleAnimation(): void {
    // Play 'idle' animation (bot.glb has only one idle)
    if (this.animationController.hasAnimation('idle')) {
      this.animationController.playAnimation('idle');
      console.log('[ClickToMoveController] Playing idle animation');
    }
  }

  /**
   * Move character to target position
   */
  public moveTo(targetPosition: THREE.Vector3): void {
    // Cancel existing tween
    if (this.currentTween) {
      this.currentTween.stop();
      this.tweenGroup.removeAll();
    }

    this.isMoving = true;

    // Calculate distance and time
    const distance = this.mesh.position.distanceTo(targetPosition);
    const time = distance * this.moveSpeed;

    // Make character look at target
    const lookAtTarget = targetPosition.clone();
    lookAtTarget.y = this.mesh.position.y;
    this.mesh.lookAt(lookAtTarget);

    // Create tween for smooth movement
    this.currentTween = new TWEEN.Tween(this.mesh.position, this.tweenGroup)
      .to({ x: targetPosition.x, z: targetPosition.z }, time)
      .easing(TWEEN.Easing.Linear.None)
      .onStart(() => {
        this.currentState = MovementState.Moving;
        // Try 'run' first, fallback to 'walk'
        if (this.animationController.hasAnimation('run')) {
          this.animationController.playAnimation('run');
        } else if (this.animationController.hasAnimation('walk')) {
          this.animationController.playAnimation('walk');
        }
      })
      .onComplete(() => {
        this.isMoving = false;
        this.currentState = MovementState.Idle;
        this.playIdleAnimation();
      })
      .start();
  }

  /**
   * Make character jump
   */
  public jump(): void {
    // Only jump if on ground
    if (!this.isJumping && Math.abs(this.mesh.position.y - this.groundHeight) < 0.1) {
      this.isJumping = true;
      this.jumpVelocity = this.jumpForce;
      console.log('[ClickToMoveController] Jump!');
      
      // Play jump animation if available
      if (this.animationController.hasAnimation('Jump')) {
        this.animationController.playAnimation('Jump', 0.1);
      }
    }
  }

  /**
   * Main update loop
   */
  public update(deltaTime: number, _world: CANNON.World): void {
    // Update animation controller
    this.animationController.update(deltaTime);

    // Update tween group
    this.tweenGroup.update();

    // Handle jumping physics
    if (this.isJumping) {
      // Apply gravity
      this.jumpVelocity -= this.gravity * deltaTime;
      
      // Update vertical position
      this.mesh.position.y += this.jumpVelocity * deltaTime;
      
      // Check if landed
      if (this.mesh.position.y <= this.groundHeight) {
        this.mesh.position.y = this.groundHeight;
        this.isJumping = false;
        this.jumpVelocity = 0;
        
        // Resume appropriate animation after landing
        if (this.isMoving) {
          // Resume run or walk animation
          if (this.animationController.hasAnimation('run')) {
            this.animationController.playAnimation('run', 0.1);
          } else if (this.animationController.hasAnimation('walk')) {
            this.animationController.playAnimation('walk', 0.1);
          }
        } else {
          this.playIdleAnimation();
        }
      }
    }

    // Sync physics body with mesh
    this.physicsBody.syncFromMesh(this.mesh);
    this.physicsBody.resetVelocity();
  }

  /**
   * Get character position
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  /**
   * Set character position
   */
  public setPosition(position: THREE.Vector3): void {
    this.physicsBody.setPosition(position.x, position.y, position.z);
    this.mesh.position.copy(position);
  }

  /**
   * Get current movement state
   */
  public getState(): MovementState {
    return this.currentState;
  }

  /**
   * Get character mesh
   */
  public getMesh(): THREE.Group {
    return this.mesh;
  }

  /**
   * Get physics body
   */
  public getBody(): CANNON.Body {
    return this.physicsBody.getBody();
  }

  /**
   * Check if character is currently moving
   */
  public isCurrentlyMoving(): boolean {
    return this.isMoving;
  }

  /**
   * Get animation controller
   */
  public getAnimationController(): AnimationController {
    return this.animationController;
  }

  /**
   * Get physics body controller
   */
  public getPhysicsBody(): PhysicsBody {
    return this.physicsBody;
  }

  /**
   * Dispose of resources
   */
  public dispose(_world: CANNON.World): void {
    if (this.currentTween) {
      this.currentTween.stop();
    }
    this.tweenGroup.removeAll();
    this.physicsBody.dispose();
    this.animationController.dispose();
  }
}
