import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from './InputManager';
import { CameraController } from './CameraController';
import { AnimationController } from './AnimationController';
import { PhysicsBody } from './PhysicsBody';
import { MovementController } from './MovementController';

export enum MovementState {
  Idle = 'idle',
  Walking = 'walking',
  Running = 'running',
  Jumping = 'jumping',
  Falling = 'falling'
}

export interface CharacterControllerOptions {
  mesh: THREE.Group;
  world: CANNON.World;
  inputManager: InputManager;
  cameraController: CameraController;
  initialPosition?: THREE.Vector3;
  animations?: THREE.AnimationClip[];
  radius?: number;
  height?: number;
  maxJumps?: number;
}

export class CharacterController {
  private mesh: THREE.Group;
  private inputManager: InputManager;
  private cameraController: CameraController;

  // Separated controllers
  private animationController: AnimationController;
  private physicsBody: PhysicsBody;
  private movementController: MovementController;

  // Character dimensions
  private radius: number;
  private height: number;

  // Jump settings
  private maxJumps: number;
  private jumpsRemaining: number;

  // State
  private currentState: MovementState = MovementState.Idle;
  private isOnGround: boolean = false;
  private world: CANNON.World;

  constructor(options: CharacterControllerOptions) {
    this.mesh = options.mesh;
    this.inputManager = options.inputManager;
    this.cameraController = options.cameraController;
    this.world = options.world;
    this.radius = options.radius ?? 0.3;
    this.height = options.height ?? 1.7;
    this.maxJumps = options.maxJumps ?? 2;
    this.jumpsRemaining = this.maxJumps;

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

    // Initialize movement controller
    this.movementController = new MovementController({
      walkSpeed: 2.5,
      runSpeed: 4.5,
      jumpSpeed: 5,
      airControl: 2,
      turnSpeed: 10,
      acceleration: 12,
      deceleration: 12
    });

    // Play idle animation by default
    this.animationController.playAnimation('Idle');
  }

  /**
   * Main update loop
   */
  public update(deltaTime: number): void {
    // Update animation controller
    this.animationController.update(deltaTime);

    // Check if on ground
    this.checkGroundContact();

    // Handle jump input
    if (this.inputManager.isKeyPressed('Space') && this.jumpsRemaining > 0) {
      this.jump();
    }

    // Calculate movement
    const inputVector3 = this.inputManager.getMovementInput();
    const inputVector = new THREE.Vector2(inputVector3.x, inputVector3.z);
    const cameraForward = this.cameraController.getForwardDirection();
    const isRunning = this.inputManager.isShiftPressed();

    const velocity = this.movementController.calculateKeyboardMovement(
      inputVector,
      cameraForward,
      isRunning,
      this.isOnGround,
      deltaTime
    );

    // Update physics body velocity (horizontal only, preserve vertical)
    const physicsVelocity = this.physicsBody.getVelocity();
    this.physicsBody.setVelocity(velocity.x, physicsVelocity.y, velocity.z);

    // Sync mesh with physics body
    this.physicsBody.syncToMesh(this.mesh);

    // Update character rotation to face movement direction
    if (velocity.length() > 0.1) {
      const newQuaternion = this.movementController.calculateRotation(
        this.mesh.quaternion,
        deltaTime
      );
      this.mesh.quaternion.copy(newQuaternion);
    }

    // Update movement state and animations
    this.updateMovementState();
    this.updateAnimation();
  }

  /**
   * Check if character is on ground using raycast
   */
  private checkGroundContact(): void {
    const rayLength = this.radius + 0.1;
    const wasOnGround = this.isOnGround;
    
    this.isOnGround = this.physicsBody.isOnGround(rayLength);

    if (this.isOnGround && !wasOnGround) {
      // Just landed
      this.jumpsRemaining = this.maxJumps;
    } else if (!this.isOnGround && wasOnGround) {
      // Just left ground
      if (this.jumpsRemaining === this.maxJumps) {
        this.jumpsRemaining = this.maxJumps - 1;
      }
    }
  }

  /**
   * Make the character jump
   */
  private jump(): void {
    if (this.jumpsRemaining <= 0) return;

    this.jumpsRemaining--;
    const velocity = this.physicsBody.getVelocity();
    this.physicsBody.setVelocity(
      velocity.x,
      this.movementController.getJumpSpeed(),
      velocity.z
    );
    this.isOnGround = false;
  }

  /**
   * Update movement state based on current conditions
   */
  private updateMovementState(): void {
    const horizontalSpeed = this.movementController.getHorizontalSpeed();
    const verticalVelocity = this.physicsBody.getVelocity().y;

    if (!this.isOnGround) {
      if (verticalVelocity > 0.5) {
        this.currentState = MovementState.Jumping;
      } else {
        this.currentState = MovementState.Falling;
      }
    } else if (horizontalSpeed > 0.1) {
      this.currentState = this.inputManager.isShiftPressed() 
        ? MovementState.Running 
        : MovementState.Walking;
    } else {
      this.currentState = MovementState.Idle;
    }
  }

  /**
   * Update animation based on movement state
   */
  private updateAnimation(): void {
    if (!this.animationController.getMixer()) {
      return;
    }

    // Determine which animation to play based on movement state
    switch (this.currentState) {
      case MovementState.Idle:
        this.animationController.playAnimation('Idle');
        break;
      case MovementState.Walking:
      case MovementState.Running:
        // Play Fast_Run animation when moving (walking or running)
        this.animationController.playAnimation('Fast_Run');
        break;
      case MovementState.Jumping:
      case MovementState.Falling:
        // Keep current animation or play a jump animation if available
        if (this.animationController.hasAnimation('Jump')) {
          this.animationController.playAnimation('Jump');
        }
        break;
    }
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
    this.movementController.resetVelocity();
    this.physicsBody.resetVelocity();
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
   * Get animation controller
   */
  public getAnimationController(): AnimationController {
    return this.animationController;
  }

  /**
   * Get movement controller
   */
  public getMovementController(): MovementController {
    return this.movementController;
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
  public dispose(world: CANNON.World): void {
    this.physicsBody.dispose();
    this.animationController.dispose();
    this.movementController.resetVelocity();
  }
}
