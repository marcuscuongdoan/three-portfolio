import * as THREE from 'three';

export interface MovementSettings {
  walkSpeed?: number;
  runSpeed?: number;
  jumpSpeed?: number;
  airControl?: number;
  turnSpeed?: number;
  acceleration?: number;
  deceleration?: number;
}

export class MovementController {
  // Movement speeds
  private walkSpeed: number;
  private runSpeed: number;
  private jumpSpeed: number;
  private airControl: number;
  private turnSpeed: number;
  private acceleration: number;
  private deceleration: number;

  // Current velocity
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private velocityDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  private targetDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 1);

  constructor(settings: MovementSettings = {}) {
    this.walkSpeed = settings.walkSpeed ?? 2.5;
    this.runSpeed = settings.runSpeed ?? 4.5;
    this.jumpSpeed = settings.jumpSpeed ?? 5;
    this.airControl = settings.airControl ?? 2;
    this.turnSpeed = settings.turnSpeed ?? 10;
    this.acceleration = settings.acceleration ?? 12;
    this.deceleration = settings.deceleration ?? 12;
  }

  /**
   * Calculate keyboard-based movement
   */
  public calculateKeyboardMovement(
    inputVector: THREE.Vector2,
    cameraForward: THREE.Vector3,
    isRunning: boolean,
    isOnGround: boolean,
    deltaTime: number
  ): THREE.Vector3 {
    if (inputVector.length() > 0.01) {
      // Calculate camera right vector
      const cameraRight = new THREE.Vector3()
        .crossVectors(cameraForward, new THREE.Vector3(0, 1, 0))
        .normalize();

      // Calculate movement direction relative to camera
      this.targetDirection
        .copy(cameraForward)
        .multiplyScalar(inputVector.y)
        .add(cameraRight.multiplyScalar(inputVector.x))
        .normalize();

      if (isOnGround) {
        this.calculateGroundMovement(isRunning, deltaTime);
      } else {
        this.calculateAirMovement(deltaTime);
      }
    } else {
      if (isOnGround) {
        // Decelerate when no input
        this.velocity.lerp(new THREE.Vector3(0, 0, 0), deltaTime * this.deceleration);
      }
    }

    return this.velocity.clone();
  }

  /**
   * Calculate ground movement
   */
  private calculateGroundMovement(isRunning: boolean, deltaTime: number): void {
    // Smoothly rotate velocity direction
    this.velocityDirection.lerp(this.targetDirection, deltaTime * this.turnSpeed);

    // Determine speed based on running state
    const speed = isRunning ? this.runSpeed : this.walkSpeed;

    // Calculate target velocity
    const targetVelocity = this.velocityDirection.clone().multiplyScalar(speed);

    // Smoothly interpolate to target velocity
    this.velocity.lerp(targetVelocity, deltaTime * this.acceleration);
  }

  /**
   * Calculate air movement (limited control)
   */
  private calculateAirMovement(deltaTime: number): void {
    // Limited air control
    this.velocityDirection.lerp(this.targetDirection, deltaTime * this.airControl);

    const airControl = deltaTime * 10;
    this.velocity.x += this.targetDirection.x * airControl;
    this.velocity.z += this.targetDirection.z * airControl;

    // Limit air speed
    const horizontalSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    const maxSpeed = this.runSpeed;
    if (horizontalSpeed > maxSpeed) {
      const scale = maxSpeed / horizontalSpeed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }
  }

  /**
   * Get current velocity
   */
  public getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }

  /**
   * Get horizontal speed
   */
  public getHorizontalSpeed(): number {
    return Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
  }

  /**
   * Get velocity direction
   */
  public getVelocityDirection(): THREE.Vector3 {
    return this.velocityDirection.clone();
  }

  /**
   * Set velocity
   */
  public setVelocity(velocity: THREE.Vector3): void {
    this.velocity.copy(velocity);
  }

  /**
   * Reset velocity
   */
  public resetVelocity(): void {
    this.velocity.set(0, 0, 0);
  }

  /**
   * Get jump speed
   */
  public getJumpSpeed(): number {
    return this.jumpSpeed;
  }

  /**
   * Set walk speed
   */
  public setWalkSpeed(speed: number): void {
    this.walkSpeed = speed;
  }

  /**
   * Set run speed
   */
  public setRunSpeed(speed: number): void {
    this.runSpeed = speed;
  }

  /**
   * Set jump speed
   */
  public setJumpSpeed(speed: number): void {
    this.jumpSpeed = speed;
  }

  /**
   * Get walk speed
   */
  public getWalkSpeed(): number {
    return this.walkSpeed;
  }

  /**
   * Get run speed
   */
  public getRunSpeed(): number {
    return this.runSpeed;
  }

  /**
   * Calculate rotation for character to face movement direction
   */
  public calculateRotation(
    currentQuaternion: THREE.Quaternion,
    deltaTime: number
  ): THREE.Quaternion {
    if (this.velocity.length() > 0.1) {
      const rotationMatrix = new THREE.Matrix4().lookAt(
        this.velocityDirection,
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 1, 0)
      );
      const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
      return currentQuaternion.clone().slerp(targetQuaternion, deltaTime * 10);
    }
    return currentQuaternion;
  }
}
