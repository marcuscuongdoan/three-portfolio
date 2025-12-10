import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CameraController } from './CameraController';
import { ClickToMoveController } from './ClickToMoveController';
import { InputManager } from './InputManager';
import * as TWEEN from '@tweenjs/tween.js';

export class World3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private world: CANNON.World;

  // Controllers
  private cameraController: CameraController;
  private characterController?: ClickToMoveController;
  private inputManager: InputManager;

  // Ground mesh for raycasting
  private groundMesh?: THREE.Mesh;

  // Raycasting
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouse: THREE.Vector2 = new THREE.Vector2();

  // Game loop
  private animationFrameId?: number;
  private clock: THREE.Clock;
  private lastTime: number = 0;

  // State
  private isRunning: boolean = false;
  private characterModel?: THREE.Group;
  private mixer?: THREE.AnimationMixer;
  private idleAction?: THREE.AnimationAction;
  private sneakPoseAction?: THREE.AnimationAction;
  private sadPoseAction?: THREE.AnimationAction;
  private agreeAction?: THREE.AnimationAction;
  private runAction?: THREE.AnimationAction;
  private walkAction?: THREE.AnimationAction;
  private onCameraAnimationComplete?: () => void;
  private tweenGroup: TWEEN.Group;
  private currentAnimationAction?: THREE.AnimationAction;

  // Double-click detection
  private lastClickTime: number = 0;
  private doubleClickDelay: number = 300; // milliseconds

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.tweenGroup = new TWEEN.Group();

    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    // Transparent background
    this.scene.background = null;

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 5, 10);

    // Setup renderer with alpha for transparency
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true // Enable transparency
    });
    this.renderer.setClearColor(0x000000, 0); // Transparent clear color
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Initialize Cannon.js physics world
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    (this.world.solver as CANNON.GSSolver).iterations = 10;

    // Initialize input manager
    this.inputManager = new InputManager();

    // Initialize camera controller
    this.cameraController = new CameraController(this.camera);

    // Setup scene
    this.setupLights();
    // this.setupGround();

    // Handle window resize
    window.addEventListener('resize', this.handleResize);
  }

  private setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
  }

  private setupGround() {
    // Invisible ground for raycasting (no visual)
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      visible: false // Make ground invisible
    });
    this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.groundMesh.name = 'ground';
    this.scene.add(this.groundMesh);

    // Physics ground
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: groundShape,
      material: new CANNON.Material({ friction: 0.5, restitution: 0.3 })
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);

    // Add grid helper for reference
    const gridHelper = new THREE.GridHelper(100, 100, 0x000000, 0x000000);
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  public async loadCharacter(modelPath: string): Promise<void> {
    const loader = new GLTFLoader();
    
    return new Promise((resolve, reject) => {
      loader.load(
        modelPath,
        (gltf: GLTF) => {
          this.characterModel = gltf.scene;
          this.characterModel.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Scale character if needed
          this.characterModel.scale.set(1, 1, 1);
          
          // Position character at origin
          this.characterModel.position.set(0, 0, 0);
          
          // Rotate character to look slightly to the right
          this.characterModel.rotation.y = Math.PI * 0.15; // About 27 degrees to the right

          this.scene.add(this.characterModel);

          // Log available animations
          console.log('Available animations:', gltf.animations.map(a => a.name));

          // Setup animation mixer and find animations
          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.characterModel);
            
            // Find sneak_pose animation
            const sneakPoseAnimation = gltf.animations.find(anim => 
              anim.name.toLowerCase().includes('sneak')
            );

            // Find sneak_pose animation
            const sadPoseAnimation = gltf.animations.find(anim => 
              anim.name.toLowerCase().includes('sad')
            );
            
            // Find agree animation
            const agreeAnimation = gltf.animations.find(anim => 
              anim.name.toLowerCase().includes('agree')
            );
            
            // Find idle animation
            const idleAnimation = gltf.animations.find(anim => 
              anim.name.toLowerCase().includes('idle')
            );
            
            // Find run animation
            const runAnimation = gltf.animations.find(anim => 
              anim.name.toLowerCase().includes('run')
            );
            
            // Find walk animation
            const walkAnimation = gltf.animations.find(anim => 
              anim.name.toLowerCase().includes('walk')
            );
            
            // Setup animation actions
            if (sneakPoseAnimation) {
              this.sneakPoseAction = this.mixer.clipAction(sneakPoseAnimation);
              this.sneakPoseAction.setLoop(THREE.LoopOnce, 1);
              this.sneakPoseAction.clampWhenFinished = true;
            }

            if (sadPoseAnimation) {
              this.sadPoseAction = this.mixer.clipAction(sadPoseAnimation);
              this.sadPoseAction.setLoop(THREE.LoopOnce, 1);
              this.sadPoseAction.clampWhenFinished = true;
            }
            
            if (agreeAnimation) {
              this.agreeAction = this.mixer.clipAction(agreeAnimation);
              this.agreeAction.setLoop(THREE.LoopOnce, 1);
              this.agreeAction.clampWhenFinished = true;
            }
            
            if (idleAnimation) {
              this.idleAction = this.mixer.clipAction(idleAnimation);
              this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
            }
            
            if (runAnimation) {
              this.runAction = this.mixer.clipAction(runAnimation);
              this.runAction.setLoop(THREE.LoopRepeat, Infinity);
            }
            
            if (walkAnimation) {
              this.walkAction = this.mixer.clipAction(walkAnimation);
              this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
            }
            
            // Start with sneak_pose animation
            if (this.sadPoseAction) {
              this.sadPoseAction.play();
              console.log('Playing sneak_pose animation');
            } else if (this.idleAction) {
              // Fallback to idle if sneak_pose not found
              this.idleAction.play();
              console.log('sneak_pose not found, playing idle animation');
            }
          }

          // Start camera far away for zoom animation
          const startPosition = { x: 0, y: 10, z: 15 };
          const endPosition = { x: 0, y: 1.7, z: 1 }; // Include right movement in end position
          const lookAtStart = { x: 0, y: 2, z: 0 };
          const lookAtEnd = { x: 0.5, y: 1.5, z: 0 };
          
          this.camera.position.set(startPosition.x, startPosition.y, startPosition.z);
          this.camera.lookAt(lookAtStart.x, lookAtStart.y, lookAtStart.z);
          
          // Delay the tween start slightly to ensure everything is initialized
          setTimeout(() => {
            // Animate camera zoom using TWEEN with specific group
            const cameraPositionTween = new TWEEN.Tween(this.camera.position, this.tweenGroup)
              .to(endPosition, 2000) // 2 seconds
              .easing(TWEEN.Easing.Quadratic.Out);
            
            const lookAtTarget = { ...lookAtStart };
            const lookAtTween = new TWEEN.Tween(lookAtTarget, this.tweenGroup)
              .to(lookAtEnd, 2000)
              .easing(TWEEN.Easing.Quadratic.Out)
              .onUpdate(() => {
                this.camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
              })
              .onComplete(() => {
                // Camera animation complete - switch to agree animation
                this.switchToAgreeAnimation();
                
                if (this.onCameraAnimationComplete) {
                  this.onCameraAnimationComplete();
                }
              });
            
            cameraPositionTween.start();
            lookAtTween.start();
          }, 100);

          resolve();
        },
        (progress: ProgressEvent) => {
          console.log('Loading character:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error: ErrorEvent) => {
          console.error('Error loading character:', error);
          reject(error);
        }
      );
    });
  }

  private handleResize = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private update = (time?: number) => {
    if (!this.isRunning) return;

    const deltaTime = this.clock.getDelta();

    // Update TWEEN animations with timestamp using our group
    this.tweenGroup.update(time);

    // Update animation mixer for idle animation
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // Render the scene
    this.renderer.render(this.scene, this.camera);

    this.animationFrameId = requestAnimationFrame(this.update);
  };

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.update();
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.clock.stop();
  }

  private handleClick = (event: MouseEvent) => {
    if (!this.characterController || !this.groundMesh) return;

    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - this.lastClickTime;

    // Check for double-click
    if (timeSinceLastClick < this.doubleClickDelay) {
      // Double-click detected - trigger jump
      console.log('Double-click detected - Jump!');
      this.characterController.jump();
      this.lastClickTime = 0; // Reset to prevent triple-click
      return;
    }

    // Single click - move character
    this.lastClickTime = currentTime;

    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check intersection with ground
    const intersects = this.raycaster.intersectObject(this.groundMesh);

    if (intersects.length > 0) {
      const targetPosition = intersects[0].point;
      targetPosition.y = 2; // Keep character at proper height
      
      console.log('Moving to:', targetPosition);
      this.characterController.moveTo(targetPosition);
    }
  };

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    
    // Normalize wheel delta (different browsers have different scales)
    const delta = Math.sign(event.deltaY);
    
    // Update camera zoom
    this.cameraController.zoom(delta);
  };

  public dispose() {
    this.stop();
    
    // Cleanup
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('click', this.handleClick);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);
    
    // Dispose input manager
    this.inputManager.dispose();
    
    if (this.characterController) {
      this.characterController.dispose(this.world);
    }

    // Dispose Three.js objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public getCharacterController(): ClickToMoveController | undefined {
    return this.characterController;
  }

  public onCameraZoomComplete(callback: () => void) {
    this.onCameraAnimationComplete = callback;
  }

  /**
   * Adjust camera position and rotation with smooth animation
   * @param options - Camera adjustment options
   * @param options.position - Target camera position {x, y, z}
   * @param options.lookAt - Target look-at position {x, y, z}
   * @param options.duration - Animation duration in milliseconds (default: 1000)
   * @param options.easing - TWEEN easing function (default: Quadratic.InOut)
   * @param options.onComplete - Callback when animation completes
   */
  public adjustCamera(options: {
    position?: { x: number; y: number; z: number };
    lookAt?: { x: number; y: number; z: number };
    duration?: number;
    easing?: (amount: number) => number;
    onComplete?: () => void;
  }): void {
    const {
      position,
      lookAt,
      duration = 1000,
      easing = TWEEN.Easing.Quadratic.InOut,
      onComplete
    } = options;

    // Stop any existing tweens on the camera
    this.tweenGroup.removeAll();

    if (position) {
      // Animate camera position
      const cameraPositionTween = new TWEEN.Tween(this.camera.position, this.tweenGroup)
        .to(position, duration)
        .easing(easing);
      
      if (lookAt) {
        // Animate look-at target as well
        const currentLookAt = new THREE.Vector3();
        this.camera.getWorldDirection(currentLookAt);
        currentLookAt.add(this.camera.position);
        
        const lookAtTarget = { 
          x: currentLookAt.x, 
          y: currentLookAt.y, 
          z: currentLookAt.z 
        };
        
        const lookAtTween = new TWEEN.Tween(lookAtTarget, this.tweenGroup)
          .to(lookAt, duration)
          .easing(easing)
          .onUpdate(() => {
            this.camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
          })
          .onComplete(() => {
            if (onComplete) {
              onComplete();
            }
          });
        
        cameraPositionTween.start();
        lookAtTween.start();
      } else {
        // Only position, no look-at
        cameraPositionTween.onComplete(() => {
          if (onComplete) {
            onComplete();
          }
        });
        cameraPositionTween.start();
      }
    } else if (lookAt) {
      // Only animate look-at
      const currentLookAt = new THREE.Vector3();
      this.camera.getWorldDirection(currentLookAt);
      currentLookAt.add(this.camera.position);
      
      const lookAtTarget = { 
        x: currentLookAt.x, 
        y: currentLookAt.y, 
        z: currentLookAt.z 
      };
      
      const lookAtTween = new TWEEN.Tween(lookAtTarget, this.tweenGroup)
        .to(lookAt, duration)
        .easing(easing)
        .onUpdate(() => {
          this.camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
        })
        .onComplete(() => {
          if (onComplete) {
            onComplete();
          }
        });
      
      lookAtTween.start();
    }
  }

  /**
   * Play a character animation by name
   * @param animationName - Name of the animation to play (e.g., 'run', 'walk', 'idle', 'agree')
   * @param loop - Whether to loop the animation (default: true for continuous animations)
   * @param fadeTime - Fade transition time in seconds (default: 0.3)
   * @returns true if animation exists and was played, false otherwise
   */
  public playCharacterAnimation(
    animationName: string, 
    loop: boolean = true, 
    fadeTime: number = 0.3
  ): boolean {
    if (!this.mixer) {
      console.warn('Animation mixer not initialized');
      return false;
    }

    const animName = animationName.toLowerCase();
    let targetAction: THREE.AnimationAction | undefined;

    // Map animation name to action
    switch (animName) {
      case 'run':
        targetAction = this.runAction;
        break;
      case 'walk':
        targetAction = this.walkAction;
        break;
      case 'idle':
        targetAction = this.idleAction;
        break;
      case 'agree':
        targetAction = this.agreeAction;
        break;
      case 'sneak':
        targetAction = this.sneakPoseAction;
        break;
      case 'sad':
        targetAction = this.sadPoseAction;
        break;
      default:
        console.warn(`Animation '${animationName}' not found`);
        return false;
    }

    if (!targetAction) {
      console.warn(`Animation '${animationName}' is not loaded`);
      return false;
    }

    // If it's already the current animation, don't restart
    if (this.currentAnimationAction === targetAction && targetAction.isRunning()) {
      return true;
    }

    // Fade out current animation
    if (this.currentAnimationAction && this.currentAnimationAction !== targetAction) {
      this.currentAnimationAction.fadeOut(fadeTime);
    }

    // Set loop mode
    if (loop) {
      targetAction.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      targetAction.setLoop(THREE.LoopOnce, 1);
      targetAction.clampWhenFinished = true;
    }

    // Fade in and play new animation
    targetAction.reset();
    targetAction.fadeIn(fadeTime);
    targetAction.play();
    
    this.currentAnimationAction = targetAction;
    console.log(`Playing animation: ${animationName}`);

    // If it's a one-time animation, listen for completion and return to idle
    if (!loop && animName !== 'idle') {
      const onAnimationComplete = (event: any) => {
        if (event.action === targetAction) {
          this.mixer?.removeEventListener('finished', onAnimationComplete);
          // Return to idle after one-time animation completes
          setTimeout(() => {
            this.playCharacterAnimation('idle', true, fadeTime);
          }, 500);
        }
      };
      this.mixer.addEventListener('finished', onAnimationComplete);
    }

    return true;
  }

  private switchToAgreeAnimation() {
    if (!this.mixer || !this.agreeAction) {
      // If agree animation not available, just switch to idle
      this.switchToIdleAnimation();
      return;
    }

    // Fade out sneak_pose
    if (this.sneakPoseAction) {
      this.sneakPoseAction.fadeOut(0.5);
    }

    // Fade in and play agree animation
    this.agreeAction.reset();
    this.agreeAction.fadeIn(0.5);
    this.agreeAction.play();
    
    console.log('Playing agree animation');

    // Listen for agree animation completion
    const onAgreeComplete = (event: any) => {
      if (event.action === this.agreeAction) {
        this.mixer?.removeEventListener('finished', onAgreeComplete);
        this.switchToIdleAnimation();
      }
    };
    
    this.mixer.addEventListener('finished', onAgreeComplete);
  }

  private switchToIdleAnimation() {
    if (!this.mixer || !this.idleAction) return;

    // Fade out agree animation if it's playing
    if (this.agreeAction) {
      this.agreeAction.fadeOut(0.5);
    }

    // Fade in and play idle animation
    this.idleAction.reset();
    this.idleAction.fadeIn(0.5);
    this.idleAction.play();
    
    console.log('Playing idle animation');
  }
}
