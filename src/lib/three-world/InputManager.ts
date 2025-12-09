import * as THREE from 'three';

export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private shiftPressed: boolean = false;
  private mousePosition: THREE.Vector2 = new THREE.Vector2();
  private mouseDelta: THREE.Vector2 = new THREE.Vector2();
  private isPointerLocked: boolean = false;

  // Mouse button tracking for camera controls
  private leftMouseDown: boolean = false;
  private rightMouseDown: boolean = false;
  private middleMouseDown: boolean = false;
  private lastMousePosition: THREE.Vector2 = new THREE.Vector2();
  private mouseDrag: THREE.Vector2 = new THREE.Vector2();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    this.keys.set(event.code, true);
    this.shiftPressed = event.shiftKey;
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    this.keys.set(event.code, false);
    this.shiftPressed = event.shiftKey;
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (this.isPointerLocked) {
      this.mouseDelta.x = event.movementX || 0;
      this.mouseDelta.y = event.movementY || 0;
    }
    
    const currentX = event.clientX;
    const currentY = event.clientY;
    
    // Calculate drag delta if mouse button is pressed
    if (this.rightMouseDown || this.middleMouseDown) {
      this.mouseDrag.x = currentX - this.lastMousePosition.x;
      this.mouseDrag.y = currentY - this.lastMousePosition.y;
    }
    
    this.lastMousePosition.set(currentX, currentY);
    this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
  };

  private handleMouseDown = (event: MouseEvent) => {
    if (event.button === 0) {
      this.leftMouseDown = true;
    } else if (event.button === 1) {
      this.middleMouseDown = true;
      event.preventDefault(); // Prevent middle mouse default behavior
    } else if (event.button === 2) {
      this.rightMouseDown = true;
      event.preventDefault(); // Prevent right-click context menu
    }
    this.lastMousePosition.set(event.clientX, event.clientY);
  };

  private handleMouseUp = (event: MouseEvent) => {
    if (event.button === 0) {
      this.leftMouseDown = false;
    } else if (event.button === 1) {
      this.middleMouseDown = false;
    } else if (event.button === 2) {
      this.rightMouseDown = false;
    }
    this.mouseDrag.set(0, 0);
  };

  private handlePointerLockChange = () => {
    this.isPointerLocked = document.pointerLockElement !== null;
  };

  public isKeyPressed(code: string): boolean {
    return this.keys.get(code) || false;
  }

  public isShiftPressed(): boolean {
    return this.shiftPressed;
  }

  public getMovementInput(): THREE.Vector3 {
    const forward = this.isKeyPressed('KeyW') || this.isKeyPressed('ArrowUp') ? 1 : 0;
    const backward = this.isKeyPressed('KeyS') || this.isKeyPressed('ArrowDown') ? -1 : 0;
    const left = this.isKeyPressed('KeyA') || this.isKeyPressed('ArrowLeft') ? 1 : 0;
    const right = this.isKeyPressed('KeyD') || this.isKeyPressed('ArrowRight') ? -1 : 0;

    const x = left + right;
    const z = forward + backward;

    return new THREE.Vector3(x, 0, z).normalize();
  }

  public getMouseDelta(): THREE.Vector2 {
    const delta = this.mouseDelta.clone();
    this.mouseDelta.set(0, 0);
    return delta;
  }

  public getMousePosition(): THREE.Vector2 {
    return this.mousePosition.clone();
  }

  public getMouseDrag(): THREE.Vector2 {
    const drag = this.mouseDrag.clone();
    this.mouseDrag.set(0, 0);
    return drag;
  }

  public isRightMouseDown(): boolean {
    return this.rightMouseDown;
  }

  public isMiddleMouseDown(): boolean {
    return this.middleMouseDown;
  }

  public isLeftMouseDown(): boolean {
    return this.leftMouseDown;
  }

  public requestPointerLock(element: HTMLElement) {
    element.requestPointerLock();
  }

  public exitPointerLock() {
    document.exitPointerLock();
  }

  public dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }
}
