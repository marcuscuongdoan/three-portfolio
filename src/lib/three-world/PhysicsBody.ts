import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface PhysicsBodyOptions {
  mass?: number;
  friction?: number;
  restitution?: number;
  fixedRotation?: boolean;
  linearDamping?: number;
  angularDamping?: number;
  position?: THREE.Vector3;
  material?: CANNON.Material;
}

export class PhysicsBody {
  private body: CANNON.Body;
  private world: CANNON.World;

  constructor(
    world: CANNON.World,
    shape: CANNON.Shape,
    options: PhysicsBodyOptions = {}
  ) {
    this.world = world;

    // Create material if not provided
    const material = options.material || new CANNON.Material({
      friction: options.friction ?? 0,
      restitution: options.restitution ?? 0
    });

    // Create physics body
    this.body = new CANNON.Body({
      mass: options.mass ?? 1,
      shape: shape,
      material: material,
      fixedRotation: options.fixedRotation ?? true,
      linearDamping: options.linearDamping ?? 0.5,
      angularDamping: options.angularDamping ?? 0.5
    });

    // Set initial position
    if (options.position) {
      this.body.position.set(
        options.position.x,
        options.position.y,
        options.position.z
      );
    }

    // Add body to physics world
    world.addBody(this.body);
  }

  /**
   * Sync physics body position to mesh
   */
  public syncToMesh(mesh: THREE.Object3D): void {
    mesh.position.set(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
    mesh.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
  }

  /**
   * Sync mesh position to physics body
   */
  public syncFromMesh(mesh: THREE.Object3D): void {
    this.body.position.set(
      mesh.position.x,
      mesh.position.y,
      mesh.position.z
    );
    this.body.quaternion.set(
      mesh.quaternion.x,
      mesh.quaternion.y,
      mesh.quaternion.z,
      mesh.quaternion.w
    );
  }

  /**
   * Set velocity of physics body
   */
  public setVelocity(x: number, y: number, z: number): void {
    this.body.velocity.set(x, y, z);
  }

  /**
   * Get velocity as THREE.Vector3
   */
  public getVelocity(): THREE.Vector3 {
    return new THREE.Vector3(
      this.body.velocity.x,
      this.body.velocity.y,
      this.body.velocity.z
    );
  }

  /**
   * Set position of physics body
   */
  public setPosition(x: number, y: number, z: number): void {
    this.body.position.set(x, y, z);
  }

  /**
   * Get position as THREE.Vector3
   */
  public getPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
  }

  /**
   * Get position as CANNON.Vec3
   */
  public getPositionCannonVec3(): CANNON.Vec3 {
    return this.body.position;
  }

  /**
   * Apply force to physics body
   */
  public applyForce(force: THREE.Vector3, worldPoint?: THREE.Vector3): void {
    const cannonForce = new CANNON.Vec3(force.x, force.y, force.z);
    const cannonPoint = worldPoint 
      ? new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z)
      : undefined;
    
    if (cannonPoint) {
      this.body.applyForce(cannonForce, cannonPoint);
    } else {
      this.body.applyForce(cannonForce);
    }
  }

  /**
   * Apply impulse to physics body
   */
  public applyImpulse(impulse: THREE.Vector3, worldPoint?: THREE.Vector3): void {
    const cannonImpulse = new CANNON.Vec3(impulse.x, impulse.y, impulse.z);
    const cannonPoint = worldPoint 
      ? new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z)
      : undefined;
    
    if (cannonPoint) {
      this.body.applyImpulse(cannonImpulse, cannonPoint);
    } else {
      this.body.applyImpulse(cannonImpulse);
    }
  }

  /**
   * Set mass of physics body
   */
  public setMass(mass: number): void {
    this.body.mass = mass;
    this.body.updateMassProperties();
  }

  /**
   * Get the CANNON.js body
   */
  public getBody(): CANNON.Body {
    return this.body;
  }

  /**
   * Check if body is on ground using raycast
   */
  public isOnGround(rayLength: number = 0.1): boolean {
    const from = new CANNON.Vec3(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
    const to = new CANNON.Vec3(from.x, from.y - rayLength, from.z);

    const result = new CANNON.RaycastResult();
    return this.world.raycastClosest(from, to, {}, result);
  }

  /**
   * Perform a raycast from the body
   */
  public raycast(
    direction: THREE.Vector3,
    maxDistance: number = 10
  ): CANNON.RaycastResult | null {
    const from = this.body.position.clone();
    const to = new CANNON.Vec3(
      from.x + direction.x * maxDistance,
      from.y + direction.y * maxDistance,
      from.z + direction.z * maxDistance
    );

    const result = new CANNON.RaycastResult();
    const hasHit = this.world.raycastClosest(from, to, {}, result);
    
    return hasHit ? result : null;
  }

  /**
   * Reset velocity to zero
   */
  public resetVelocity(): void {
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
  }

  /**
   * Wake up the physics body
   */
  public wakeUp(): void {
    this.body.wakeUp();
  }

  /**
   * Put the physics body to sleep
   */
  public sleep(): void {
    this.body.sleep();
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.world.removeBody(this.body);
  }
}
