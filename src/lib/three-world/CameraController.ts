import * as THREE from 'three';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3 = new THREE.Vector3();

  // Camera settings
  private distance: number = 12.5; // Distance from target
  private minDistance: number = 2; // Minimum zoom distance (allows closer zoom)
  private maxDistance: number = 30; // Maximum zoom distance
  private zoomSpeed: number = 2; // Zoom speed multiplier

  // Spherical coordinates for orbit
  private theta: number = 0; // Horizontal angle (rotation around Y axis)
  private phi: number = Math.PI / 4; // Vertical angle (45 degrees from top)
  private minPhi: number = 0.1; // Prevent camera from going through ground
  private maxPhi: number = Math.PI / 2 - 0.1; // Prevent camera from going below horizon

  // Panning offset
  private panOffset: THREE.Vector3 = new THREE.Vector3();
  private maxPanDistance: number = 20; // Maximum distance to pan from character

  // Sensitivity settings
  private rotationSpeed: number = 0.005;
  private panSpeed: number = 0.01;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  public zoom(delta: number) {
    // Adjust distance based on scroll delta
    this.distance += delta * this.zoomSpeed;
    
    // Clamp distance to min/max bounds
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
    
    console.log(`Camera distance: ${this.distance.toFixed(1)}`);
  }

  public rotate(deltaX: number, deltaY: number) {
    // Update spherical angles
    this.theta -= deltaX * this.rotationSpeed;
    this.phi += deltaY * this.rotationSpeed;
    
    // Clamp phi to prevent camera flipping
    this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
    
    console.log(`Camera rotation - theta: ${(this.theta * 180 / Math.PI).toFixed(1)}°, phi: ${(this.phi * 180 / Math.PI).toFixed(1)}°`);
  }

  public pan(deltaX: number, deltaY: number) {
    // Calculate pan direction based on camera orientation
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Keep panning horizontal
    cameraDirection.normalize();
    
    // Calculate right vector
    const right = new THREE.Vector3();
    right.crossVectors(cameraDirection, this.camera.up).normalize();
    
    // Apply panning
    const panDeltaX = right.multiplyScalar(-deltaX * this.panSpeed * this.distance);
    const panDeltaY = cameraDirection.multiplyScalar(deltaY * this.panSpeed * this.distance);
    
    this.panOffset.add(panDeltaX).add(panDeltaY);
    
    // Clamp panning to max distance
    if (this.panOffset.length() > this.maxPanDistance) {
      this.panOffset.normalize().multiplyScalar(this.maxPanDistance);
    }
    
    console.log(`Camera pan offset: ${this.panOffset.x.toFixed(1)}, ${this.panOffset.z.toFixed(1)}`);
  }

  public getDistance(): number {
    return this.distance;
  }

  public update(targetPosition: THREE.Vector3, _deltaTime: number) {
    // Update target position (character position + pan offset)
    this.target.copy(targetPosition).add(this.panOffset);

    // Calculate camera position using spherical coordinates
    const x = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.distance * Math.cos(this.phi);
    const z = this.distance * Math.sin(this.phi) * Math.cos(this.theta);

    this.camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z
    );

    // Look at the target
    this.camera.lookAt(this.target);
  }

  public setDistance(distance: number) {
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
  }

  public resetRotation() {
    this.theta = 0;
    this.phi = Math.PI / 4;
  }

  public resetPan() {
    this.panOffset.set(0, 0, 0);
  }

  public reset(position: THREE.Vector3) {
    this.target.copy(position);
    this.theta = 0;
    this.phi = Math.PI / 4;
    this.panOffset.set(0, 0, 0);
    
    // Update camera to new position
    const x = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.distance * Math.cos(this.phi);
    const z = this.distance * Math.sin(this.phi) * Math.cos(this.theta);
    
    this.camera.position.set(
      position.x + x,
      position.y + y,
      position.z + z
    );
    this.camera.lookAt(position);
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get the forward direction of the camera (horizontal plane)
   */
  public getForwardDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.y = 0; // Flatten to horizontal plane
    direction.normalize();
    return direction;
  }
}
