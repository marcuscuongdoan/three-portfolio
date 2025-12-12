import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
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

  // State
  private isRunning: boolean = false;
  private characterModel?: THREE.Group;
  private mixer?: THREE.AnimationMixer;
  private idleAction?: THREE.AnimationAction;
  private sneakPoseAction?: THREE.AnimationAction;
  private sadPoseAction?: THREE.AnimationAction;
  private agreeAction?: THREE.AnimationAction;
  private headShakeAction?: THREE.AnimationAction;
  private runAction?: THREE.AnimationAction;
  private walkAction?: THREE.AnimationAction;
  private fallingAction?: THREE.AnimationAction;
  private fallingImpactAction?: THREE.AnimationAction;
  private standingUpAction?: THREE.AnimationAction;
  private enteringCodeAction?: THREE.AnimationAction;
  private onCameraAnimationComplete?: () => void;
  private tweenGroup: TWEEN.Group;
  private currentAnimationAction?: THREE.AnimationAction;
  private spawnSequenceComplete: boolean = false;
  private activeCameraTweens: TWEEN.Tween<any>[] = [];

  // Character highlighting lights
  private characterSpotlight?: THREE.SpotLight;
  private characterRimLight?: THREE.PointLight;

  // Head bone for look-at
  private headBone?: THREE.Bone;
  private enableHeadTracking: boolean = false; // Control head look-at behavior (disabled by default)
  private mousePosition: THREE.Vector2 = new THREE.Vector2(0, 0);
  private lookAtTarget: THREE.Vector3 = new THREE.Vector3();
  private defaultLookAtTarget?: THREE.Object3D; // Default target in front of character
  private isMouseInWindow: boolean = true; // Track if mouse is in window

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

    // Detect if mobile for performance optimizations
    const isMobile = window.innerWidth < 640;
    
    // Setup renderer with alpha for transparency
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: !isMobile, // Disable antialiasing on mobile for performance
      alpha: true, // Enable transparency
      powerPreference: isMobile ? 'low-power' : 'high-performance'
    });
    this.renderer.setClearColor(0x000000, 0); // Transparent clear color
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    // Use lower pixel ratio on mobile for better performance
    this.renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
    // Disable shadows on mobile for performance
    this.renderer.shadowMap.enabled = !isMobile;
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

    // Handle window resize
    window.addEventListener('resize', this.handleResize);
    
    // Track mouse movement for head tracking on document level
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseleave', this.handleMouseLeave);
  }

  private setupLights() {
    // Balanced ambient light for natural visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    this.scene.add(ambientLight);

    // Strong directional light for definition and depth
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
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

    // Moderate spotlight for character accent without washing out
    this.characterSpotlight = new THREE.SpotLight(0xffffff, 5);
    this.characterSpotlight.position.set(0, 6, 3);
    this.characterSpotlight.angle = Math.PI / 3; // 60 degrees - very wide cone
    this.characterSpotlight.penumbra = 0.95; // Almost completely diffuse edge
    this.characterSpotlight.decay = 2;
    this.characterSpotlight.distance = 20;
    this.characterSpotlight.castShadow = false; // Disable shadow for softer look
    this.scene.add(this.characterSpotlight);
    this.scene.add(this.characterSpotlight.target);

    // Subtle rim light for depth without overpowering
    this.characterRimLight = new THREE.PointLight(0xaabbff, 4, 12);
    this.characterRimLight.position.set(0, 2, -2);
    this.scene.add(this.characterRimLight);
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
          
          // Rotate character to look slightly to the right (body angle)
          this.characterModel.rotation.y = Math.PI * 0.15; // About 27 degrees to the right

          this.scene.add(this.characterModel);

          // Create default look-at target in front of character
          this.defaultLookAtTarget = new THREE.Object3D();
          this.defaultLookAtTarget.position.set(0, 2.2, 2); // In front and slightly above head height
          this.scene.add(this.defaultLookAtTarget);

          // Find the head bone to make it look at camera
          this.findHeadBone(this.characterModel);

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
            
            // Find headShake animation
            const headShakeAnimation = gltf.animations.find(anim => 
              anim.name.toLowerCase().includes('headshake')
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
            
            if (headShakeAnimation) {
              this.headShakeAction = this.mixer.clipAction(headShakeAnimation);
              this.headShakeAction.setLoop(THREE.LoopOnce, 1);
              this.headShakeAction.clampWhenFinished = true;
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
          const endPosition = { x: 0, y: 1.7, z: 1 };
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

  /**
   * Load FBX character with separate animation files
   * @param modelPath - Path to the base character FBX model
   * @param animationPaths - Object mapping animation names to their file paths
   */
  public async loadCharacterFBX(
    modelPath: string,
    animationPaths: Record<string, string>
  ): Promise<void> {
    const loader = new FBXLoader();
    
    return new Promise((resolve, reject) => {
      // Load base character model
      loader.load(
        modelPath,
        async (fbxModel: THREE.Group) => {
          this.characterModel = fbxModel;
          this.characterModel.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              // Fix FBX material lighting issues
              const mesh = child as THREE.Mesh;
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach(mat => {
                    if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
                      mat.needsUpdate = true;
                      // Subtle emission for definition without washing out
                      mat.emissive = new THREE.Color(0x202020); // Subtle gray emission
                      mat.emissiveIntensity = 0.15; // Low intensity for solid look
                    }
                  });
                } else {
                  const mat = mesh.material;
                  if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
                    mat.needsUpdate = true;
                    // Subtle emission for definition without washing out
                    mat.emissive = new THREE.Color(0x202020); // Subtle gray emission
                    mat.emissiveIntensity = 0.15; // Low intensity for solid look
                  }
                }
              }
            }
          });

          // Scale character if needed
          this.characterModel.scale.set(0.01, 0.01, 0.01); // FBX models often need scaling
          
          // Position character at origin
          this.characterModel.position.set(0, 0, 0);
          
          // Rotate character to look slightly to the right (body angle)
          this.characterModel.rotation.y = Math.PI * 0.15; // About 27 degrees to the right

          this.scene.add(this.characterModel);

          // Create default look-at target in front of character
          this.defaultLookAtTarget = new THREE.Object3D();
          this.defaultLookAtTarget.position.set(0, 2.2, 2); // In front and slightly above head height
          this.scene.add(this.defaultLookAtTarget);

          // Find the head bone to make it look at camera
          this.findHeadBone(this.characterModel);

          // Initialize animation mixer
          this.mixer = new THREE.AnimationMixer(this.characterModel);

          // Load all animation files
          console.log('Loading animations...');
          const animationLoadPromises: Promise<void>[] = [];

          for (const [animName, animPath] of Object.entries(animationPaths)) {
            const animPromise = new Promise<void>((resolveAnim, rejectAnim) => {
              loader.load(
                animPath,
                (animFbx: THREE.Group) => {
                  if (animFbx.animations && animFbx.animations.length > 0) {
                    const clip = animFbx.animations[0]; // Get first animation from file
                    if (!clip) {
                      console.warn(`No animation clip found in ${animPath}`);
                      rejectAnim(new Error(`No animation clip in ${animPath}`));
                      return;
                    }
                    clip.name = animName; // Rename to our mapping name
                    
                    // Create animation action
                    const action = this.mixer!.clipAction(clip);
                    
                    // Map to appropriate action variable
                    switch (animName.toLowerCase()) {
                      case 'idle':
                        this.idleAction = action;
                        action.setLoop(THREE.LoopRepeat, Infinity);
                        console.log('Loaded idle animation');
                        break;
                      case 'walk':
                      case 'walking':
                        this.walkAction = action;
                        action.setLoop(THREE.LoopRepeat, Infinity);
                        console.log('Loaded walking animation');
                        break;
                      case 'run':
                        this.runAction = action;
                        action.setLoop(THREE.LoopRepeat, Infinity);
                        console.log('Loaded run animation');
                        break;
                      case 'cheering':
                      case 'agree':
                        this.agreeAction = action;
                        action.setLoop(THREE.LoopOnce, 1);
                        action.clampWhenFinished = true;
                        console.log('Loaded cheering animation');
                        break;
                      case 'falling':
                        this.fallingAction = action;
                        action.setLoop(THREE.LoopRepeat, Infinity);
                        console.log('Loaded falling animation');
                        break;
                      case 'falling-impact':
                      case 'impact':
                        this.fallingImpactAction = action;
                        action.setLoop(THREE.LoopOnce, 1);
                        action.clampWhenFinished = true;
                        console.log('Loaded falling-impact animation');
                        break;
                      case 'standing-up':
                      case 'standup':
                        this.standingUpAction = action;
                        action.setLoop(THREE.LoopOnce, 1);
                        action.clampWhenFinished = true;
                        console.log('Loaded standing-up animation');
                        break;
                      case 'entering-code':
                      case 'enteringcode':
                        this.enteringCodeAction = action;
                        action.setLoop(THREE.LoopRepeat, Infinity);
                        console.log('Loaded entering-code animation');
                        break;
                    }
                    
                    resolveAnim();
                  } else {
                    console.warn(`No animations found in ${animPath}`);
                    rejectAnim(new Error(`No animations in ${animPath}`));
                  }
                },
                undefined,
                (error) => {
                  console.error(`Error loading animation ${animName}:`, error);
                  rejectAnim(error);
                }
              );
            });
            
            animationLoadPromises.push(animPromise);
          }

          try {
            // Wait for all animations to load
            await Promise.all(animationLoadPromises);
            console.log('All animations loaded successfully');

            // Start with falling animation sequence
            this.playFallingSequence();

            // Start camera far away for zoom animation
            const startPosition = { x: 0, y: -10, z: 1 };
            const endPosition = { x: 0, y: 1.25, z: 1 };
            const lookAtStart = { x: 0, y: 2, z: 0 };
            const lookAtEnd = { x: 0.5, y: 1.5, z: 0 };
            
            this.camera.position.set(startPosition.x, startPosition.y, startPosition.z);
            this.camera.lookAt(lookAtStart.x, lookAtStart.y, lookAtStart.z);
            
            // Delay the tween start slightly to ensure everything is initialized
            setTimeout(() => {
              // Animate camera zoom using TWEEN with specific group
              const cameraPositionTween = new TWEEN.Tween(this.camera.position, this.tweenGroup)
                .to(endPosition, 1500)
                .easing(TWEEN.Easing.Quadratic.Out);
              
              const lookAtTarget = { ...lookAtStart };
              const lookAtTween = new TWEEN.Tween(lookAtTarget, this.tweenGroup)
                .to(lookAtEnd, 1500)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(() => {
                  this.camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
                })
                .onComplete(() => {
                  // Camera animation complete - keep playing idle
                  console.log('Camera zoom animation complete');
                  
                  if (this.onCameraAnimationComplete) {
                    this.onCameraAnimationComplete();
                  }
                });
              
              cameraPositionTween.start();
              lookAtTween.start();
            }, 100);

            resolve();
          } catch (error) {
            console.error('Error loading animations:', error);
            reject(error);
          }
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

    // Update animation mixer for idle animation FIRST
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // IMPORTANT: Make head look at camera AFTER animation update
    // Only override if head tracking is enabled
    if (this.headBone && this.characterModel && this.enableHeadTracking) {
      this.updateHeadLookAt();
    }

    // Update character highlighting lights to follow character
    if (this.characterModel) {
      const characterPosition = this.characterModel.position;
      
      // Update spotlight position and target (from front and above)
      if (this.characterSpotlight) {
        this.characterSpotlight.position.set(
          characterPosition.x,
          characterPosition.y + 6,
          characterPosition.z + 3
        );
        this.characterSpotlight.target.position.set(
          characterPosition.x,
          characterPosition.y + 1,
          characterPosition.z
        );
        this.characterSpotlight.target.updateMatrixWorld();
      }

      // Update rim light position (behind character for backlight effect)
      if (this.characterRimLight) {
        this.characterRimLight.position.set(
          characterPosition.x,
          characterPosition.y + 2,
          characterPosition.z - 2
        );
      }
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

    if (intersects.length > 0 && intersects[0]) {
      const targetPosition = intersects[0].point;
      targetPosition.y = 2; // Keep character at proper height
      
      console.log('Moving to:', targetPosition);
      this.characterController.moveTo(targetPosition);
    }
  };

  private handleMouseMove = (event: MouseEvent) => {
    // Check if mouse is within window bounds
    const isInBounds = 
      event.clientX >= 0 && 
      event.clientX <= window.innerWidth && 
      event.clientY >= 0 && 
      event.clientY <= window.innerHeight;
    
    this.isMouseInWindow = isInBounds;
    
    // Update mouse position in normalized device coordinates (-1 to +1)
    this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
  };

  private handleMouseLeave = () => {
    this.isMouseInWindow = false;
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
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseleave', this.handleMouseLeave);
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
    // Don't allow camera adjustments until the initial spawn sequence is complete
    if (!this.spawnSequenceComplete) {
      console.log('Camera adjustment blocked - waiting for spawn sequence to complete');
      return;
    }

    const {
      position,
      lookAt,
      duration = 1000,
      easing = TWEEN.Easing.Quadratic.InOut,
      onComplete
    } = options;

    // Stop any existing camera tweens
    this.activeCameraTweens.forEach(tween => tween.stop());
    this.activeCameraTweens = [];

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
   * @param lookAtCamera - Whether the character's head should look at the camera (default: true)
   * @returns true if animation exists and was played, false otherwise
   */
  public playCharacterAnimation(
    animationName: string, 
    loop: boolean = true, 
    fadeTime: number = 0.3,
    lookAtCamera: boolean = false
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
      case 'walking':
        targetAction = this.walkAction;
        break;
      case 'idle':
        targetAction = this.idleAction;
        break;
      case 'cheering':
        targetAction = this.agreeAction;
        break;
      case 'headshake':
        targetAction = this.headShakeAction;
        break;
      case 'sneak':
        targetAction = this.sneakPoseAction;
        break;
      case 'sad':
        targetAction = this.sadPoseAction;
        break;
      case 'entering-code':
      case 'enteringcode':
      case 'typing':
      case 'coding':
        targetAction = this.enteringCodeAction;
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
    
    // Set head tracking based on parameter
    this.enableHeadTracking = lookAtCamera;
    
    console.log(`Playing animation: ${animationName}, head tracking: ${lookAtCamera}`);

    // If it's a one-time animation, listen for completion and return to idle
    if (!loop && animName !== 'idle') {
      const onAnimationComplete = (event: any) => {
        if (event.action === targetAction) {
          this.mixer?.removeEventListener('finished', onAnimationComplete);
          // Return to idle after one-time animation completes
          setTimeout(() => {
            this.playCharacterAnimation('idle', true, fadeTime, lookAtCamera);
          }, 500);
        }
      };
      this.mixer.addEventListener('finished', onAnimationComplete);
    }

    return true;
  }

  /**
   * Enable or disable head tracking to camera
   * @param enable - Whether to enable head tracking
   */
  public setHeadTracking(enable: boolean): void {
    this.enableHeadTracking = enable;
    console.log(`Head tracking ${enable ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current head tracking state
   * @returns true if head tracking is enabled
   */
  public isHeadTrackingEnabled(): boolean {
    return this.enableHeadTracking;
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

  /**
   * Play the falling animation sequence: falling → impact → standing-up → idle
   */
  private playFallingSequence(): void {
    if (!this.mixer) return;

    // Step 1: Play falling animation for a short duration
    if (this.fallingAction) {
      this.fallingAction.reset();
      this.fallingAction.fadeIn(0.3);
      this.fallingAction.play();
      this.currentAnimationAction = this.fallingAction;
      console.log('Step 1: Playing falling animation');

      // Start fading out before transition (800ms play + 200ms fade = 1000ms)
      setTimeout(() => {
        if (this.fallingAction) {
          this.fallingAction.fadeOut(0.4);
          this.playFallingImpact();
        }
      }, 800);
    } else {
      // If falling not available, skip to idle
      console.warn('Falling animation not available, skipping to idle');
      if (this.idleAction) {
        this.idleAction.play();
        this.currentAnimationAction = this.idleAction;
      }
    }
  }

  /**
   * Play the falling impact animation, then standing-up
   */
  private playFallingImpact(): void {
    if (!this.mixer || !this.fallingImpactAction) {
      this.playStandingUp();
      return;
    }

    // Play impact animation (falling should already be fading out)
    this.fallingImpactAction.reset();
    this.fallingImpactAction.fadeIn(0.4);
    this.fallingImpactAction.play();
    this.currentAnimationAction = this.fallingImpactAction;
    console.log('Step 2: Playing falling-impact animation');

    // Listen for impact animation completion
    const onImpactComplete = (event: any) => {
      if (event.action === this.fallingImpactAction) {
        this.mixer?.removeEventListener('finished', onImpactComplete);
        this.playStandingUp();
      }
    };

    this.mixer.addEventListener('finished', onImpactComplete);
  }

  /**
   * Play the standing-up animation, then idle
   */
  private playStandingUp(): void {
    if (!this.mixer || !this.standingUpAction) {
      this.playIdleAfterSequence();
      return;
    }

    // Fade out previous animation
    if (this.fallingImpactAction) {
      this.fallingImpactAction.fadeOut(0.3);
    }

    // Play standing-up animation with faster speed
    this.standingUpAction.reset();
    this.standingUpAction.setEffectiveTimeScale(2.5); // 2.5x speed
    this.standingUpAction.fadeIn(0.3);
    this.standingUpAction.play();
    this.currentAnimationAction = this.standingUpAction;
    console.log('Step 3: Playing standing-up animation (2.5x speed)');

    // Listen for standing-up animation completion
    const onStandUpComplete = (event: any) => {
      if (event.action === this.standingUpAction) {
        this.mixer?.removeEventListener('finished', onStandUpComplete);
        // Reset time scale back to normal
        if (this.standingUpAction) {
          this.standingUpAction.setEffectiveTimeScale(1.0);
        }
        this.playIdleAfterSequence();
      }
    };

    this.mixer.addEventListener('finished', onStandUpComplete);
  }

  /**
   * Play idle animation after the falling sequence completes
   */
  private playIdleAfterSequence(): void {
    if (!this.mixer || !this.idleAction) return;

    // Fade out previous animation
    if (this.standingUpAction) {
      this.standingUpAction.fadeOut(0.5);
    }

    // Play idle animation
    this.idleAction.reset();
    this.idleAction.fadeIn(0.5);
    this.idleAction.play();
    this.currentAnimationAction = this.idleAction;
    
    // Mark spawn sequence as complete
    this.spawnSequenceComplete = true;
    console.log('Step 4: Playing idle animation - sequence complete!');
  }

  /**
   * Check if the spawn animation sequence is complete
   * @returns true if spawn sequence is complete and character is ready for interaction
   */
  public isSpawnSequenceComplete(): boolean {
    return this.spawnSequenceComplete;
  }

  /**
   * Find the head bone in the character model
   */
  private findHeadBone(model: THREE.Group): void {
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Bone) {
        const boneName = child.name.toLowerCase();
        // Look for common head bone names
        if (boneName.includes('head') && !boneName.includes('top')) {
          if (!this.headBone) { // Only get the first head bone found
            this.headBone = child;
            console.log('Found head bone:', child.name);
            return;
          }
        }
      }
    });

    if (!this.headBone) {
      console.warn('Head bone not found in character model');
    }
  }

  /**
   * Make the character's head look at the mouse cursor position or default target
   */
  private updateHeadLookAt(): void {
    if (!this.headBone || !this.camera || !this.defaultLookAtTarget) return;

    // Get head world position
    const headWorldPos = new THREE.Vector3();
    this.headBone.getWorldPosition(headWorldPos);
    
    // If mouse is outside window, look at default target
    if (!this.isMouseInWindow) {
      this.lookAtTarget.copy(this.defaultLookAtTarget.position);
    } else {
      // Create a raycaster from mouse position
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(this.mousePosition, this.camera);
      
      // Create an invisible plane at the character's position, facing the camera
      // This gives us a consistent reference plane to raycast against
      const planeNormal = new THREE.Vector3();
      planeNormal.subVectors(this.camera.position, headWorldPos).normalize();
      const plane = new THREE.Plane();
      plane.setFromNormalAndCoplanarPoint(planeNormal, headWorldPos);
      
      // Raycast to the plane to get the 3D point where mouse is pointing
      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersectPoint);
      
      if (intersectPoint) {
        this.lookAtTarget.copy(intersectPoint);
      } else {
        // Fallback to default target
        this.lookAtTarget.copy(this.defaultLookAtTarget.position);
      }
    }

    // Get parent's world quaternion to convert to local space
    if (this.headBone.parent) {
      const parentWorldQuat = new THREE.Quaternion();
      this.headBone.parent.getWorldQuaternion(parentWorldQuat);
      
      // Create a temporary object to calculate look-at in world space
      const lookAtHelper = new THREE.Object3D();
      lookAtHelper.position.copy(headWorldPos);
      lookAtHelper.lookAt(this.lookAtTarget);
      
      // Get the world quaternion for looking at target
      const targetWorldQuat = lookAtHelper.quaternion.clone();
      
      // Convert to local space by multiplying with parent's inverse
      const parentInverseQuat = parentWorldQuat.clone().invert();
      const targetLocalQuat = parentInverseQuat.multiply(targetWorldQuat);
      
      // Smoothly interpolate to target rotation for very smooth, gradual movement
      this.headBone.quaternion.slerp(targetLocalQuat, 0.05);
      
      // Force matrix update
      this.headBone.updateMatrix();
    }
  }
}
