# Character System Architecture

## Overview

The character controller system has been refactored into separate, reusable components for better maintainability, testability, and flexibility.

## Component Separation

### 1. **AnimationController** (`AnimationController.ts`)
Handles all animation-related functionality.

**Responsibilities:**
- Manages THREE.AnimationMixer
- Stores and plays animation actions
- Handles animation transitions with fade in/out
- Provides animation state queries

**Key Methods:**
```typescript
// Setup animations from clips
setupAnimations(clips: THREE.AnimationClip[]): void

// Play an animation
playAnimation(name: string, fadeTime?: number, loop?: THREE.AnimationActionLoopStyles): boolean

// Play animation once with callback
playAnimationOnce(name: string, fadeTime?: number, onComplete?: () => void): boolean

// Check if animation exists
hasAnimation(name: string): boolean

// Update (call in game loop)
update(deltaTime: number): void
```

**Usage Example:**
```typescript
const animationController = new AnimationController({
  mesh: characterMesh,
  animations: gltf.animations
});

// Play idle animation
animationController.playAnimation('Idle');

// Update in game loop
animationController.update(deltaTime);
```

---

### 2. **PhysicsBody** (`PhysicsBody.ts`)
Manages physics body creation and interactions with CANNON.js.

**Responsibilities:**
- Creates and manages CANNON.Body
- Handles position/velocity synchronization
- Provides physics utilities (raycast, ground detection)
- Manages forces and impulses

**Key Methods:**
```typescript
// Sync physics to mesh
syncToMesh(mesh: THREE.Object3D): void

// Sync mesh to physics
syncFromMesh(mesh: THREE.Object3D): void

// Set/Get velocity
setVelocity(x: number, y: number, z: number): void
getVelocity(): THREE.Vector3

// Ground detection
isOnGround(rayLength?: number): boolean

// Apply forces
applyForce(force: THREE.Vector3, worldPoint?: THREE.Vector3): void
applyImpulse(impulse: THREE.Vector3, worldPoint?: THREE.Vector3): void
```

**Usage Example:**
```typescript
const shape = new CANNON.Cylinder(0.3, 0.3, 1.7, 8);
const physicsBody = new PhysicsBody(world, shape, {
  mass: 1,
  friction: 0,
  restitution: 0,
  fixedRotation: true,
  position: new THREE.Vector3(0, 2, 0)
});

// Sync physics position to mesh
physicsBody.syncToMesh(mesh);

// Check if on ground
if (physicsBody.isOnGround(0.1)) {
  // Character is on ground
}
```

---

### 3. **MovementController** (`MovementController.ts`)
Handles movement calculations and velocity management.

**Responsibilities:**
- Calculates keyboard-based movement
- Manages velocity and direction
- Handles ground and air movement separately
- Provides movement settings (walk/run speeds)

**Key Methods:**
```typescript
// Calculate movement from input
calculateKeyboardMovement(
  inputVector: THREE.Vector2,
  cameraForward: THREE.Vector3,
  isRunning: boolean,
  isOnGround: boolean,
  deltaTime: number
): THREE.Vector3

// Get horizontal speed
getHorizontalSpeed(): number

// Calculate rotation to face movement direction
calculateRotation(currentQuaternion: THREE.Quaternion, deltaTime: number): THREE.Quaternion

// Setters for speeds
setWalkSpeed(speed: number): void
setRunSpeed(speed: number): void
```

**Usage Example:**
```typescript
const movementController = new MovementController({
  walkSpeed: 2.5,
  runSpeed: 4.5,
  jumpSpeed: 5,
  acceleration: 12,
  deceleration: 12
});

// Calculate movement
const velocity = movementController.calculateKeyboardMovement(
  inputVector,
  cameraForward,
  isRunning,
  isOnGround,
  deltaTime
);

// Get current speed
const speed = movementController.getHorizontalSpeed();
```

---

### 4. **CharacterController** (`CharacterController.ts`)
Orchestrates the above components for keyboard-based character control.

**Uses:**
- `AnimationController` for animations
- `PhysicsBody` for physics
- `MovementController` for movement calculations
- `InputManager` for keyboard input
- `CameraController` for camera-relative movement

**Key Features:**
- Keyboard movement (WASD)
- Running (Shift)
- Jumping (Space) with double-jump support
- Ground detection
- Automatic animation switching based on state

**Usage Example:**
```typescript
const characterController = new CharacterController({
  mesh: characterMesh,
  world: physicsWorld,
  inputManager: inputManager,
  cameraController: cameraController,
  initialPosition: new THREE.Vector3(0, 2, 0),
  animations: gltf.animations,
  maxJumps: 2
});

// In game loop
characterController.update(deltaTime);

// Access sub-controllers
const animController = characterController.getAnimationController();
const physicsBody = characterController.getPhysicsBody();
const movementController = characterController.getMovementController();
```

---

### 5. **ClickToMoveController** (`ClickToMoveController.ts`)
Orchestrates components for click-to-move character control.

**Uses:**
- `AnimationController` for animations
- `PhysicsBody` for physics
- `TWEEN.js` for smooth movement

**Key Features:**
- Click-to-move with path following
- Jump on command
- Automatic animation switching
- Smooth interpolation using tweens

**Usage Example:**
```typescript
const clickToMoveController = new ClickToMoveController({
  mesh: characterMesh,
  world: physicsWorld,
  initialPosition: new THREE.Vector3(0, 2, 0),
  animations: gltf.animations,
  moveSpeed: 100
});

// Move to position
clickToMoveController.moveTo(new THREE.Vector3(5, 2, 5));

// Jump
clickToMoveController.jump();

// In game loop
clickToMoveController.update(deltaTime, world);
```

---

## Benefits of This Architecture

### ✅ **Reusability**
Each component can be used independently or combined in different ways:
```typescript
// Use only animation controller for a static NPC
const npc = new AnimationController({ mesh: npcMesh, animations: clips });

// Use physics body for a physics-only object
const physicsObject = new PhysicsBody(world, shape, { mass: 10 });
```

### ✅ **Testability**
Each component can be unit tested in isolation:
```typescript
// Test animation controller
const animController = new AnimationController({ mesh, animations });
expect(animController.hasAnimation('Idle')).toBe(true);

// Test movement calculations
const movementController = new MovementController({ walkSpeed: 3 });
const velocity = movementController.calculateKeyboardMovement(...);
```

### ✅ **Maintainability**
Clear separation of concerns makes code easier to understand and modify:
- Animation logic is in `AnimationController`
- Physics logic is in `PhysicsBody`
- Movement logic is in `MovementController`

### ✅ **Flexibility**
Easy to create new character types by mixing components:
```typescript
// Create a flying character (no physics)
class FlyingCharacter {
  private animationController: AnimationController;
  private movementController: MovementController;
  // No physics body needed!
}

// Create an AI character
class AICharacter {
  private animationController: AnimationController;
  private physicsBody: PhysicsBody;
  private aiController: AIController; // Custom AI logic
}
```

### ✅ **Extensibility**
Easy to extend functionality:
```typescript
// Add custom animation behavior
class CustomAnimationController extends AnimationController {
  playRandomIdleAnimation() {
    const idles = ['Idle1', 'Idle2', 'Idle3'];
    const random = idles[Math.floor(Math.random() * idles.length)];
    this.playAnimation(random);
  }
}
```

---

## Migration Guide

### From Old CharacterController

**Before:**
```typescript
const controller = new CharacterController(
  mesh,
  world,
  inputManager,
  cameraController,
  position,
  animations
);
```

**After:**
```typescript
const controller = new CharacterController({
  mesh: mesh,
  world: world,
  inputManager: inputManager,
  cameraController: cameraController,
  initialPosition: position,
  animations: animations
});
```

### From Old ClickToMoveController

**Before:**
```typescript
const controller = new ClickToMoveController(
  mesh,
  world,
  position,
  animations
);
```

**After:**
```typescript
const controller = new ClickToMoveController({
  mesh: mesh,
  world: world,
  initialPosition: position,
  animations: animations
});
```

---

## File Structure

```
src/lib/three-world/
├── AnimationController.ts      (NEW - Animation management)
├── PhysicsBody.ts              (NEW - Physics management)
├── MovementController.ts       (NEW - Movement calculations)
├── CharacterController.ts      (REFACTORED - Keyboard character)
├── ClickToMoveController.ts    (REFACTORED - Click-to-move character)
├── CameraController.ts         (Unchanged)
├── InputManager.ts             (Unchanged)
├── World3D.ts                  (Unchanged)
└── index.ts                    (Updated exports)
```

---

## Exports

All components and types are exported from `index.ts`:

```typescript
import {
  // Controllers
  CharacterController,
  ClickToMoveController,
  AnimationController,
  PhysicsBody,
  MovementController,
  CameraController,
  InputManager,
  
  // Types
  CharacterControllerOptions,
  ClickToMoveControllerOptions,
  AnimationControllerOptions,
  PhysicsBodyOptions,
  MovementSettings,
  CharacterMovementState
} from '@/lib/three-world';
```

---

## Best Practices

1. **Always dispose of resources:**
   ```typescript
   characterController.dispose(world);
   ```

2. **Update controllers in game loop:**
   ```typescript
   animationController.update(deltaTime);
   characterController.update(deltaTime);
   ```

3. **Use type-safe options:**
   ```typescript
   const options: CharacterControllerOptions = {
     mesh: mesh,
     world: world,
     // TypeScript will enforce all required options
   };
   ```

4. **Access sub-controllers when needed:**
   ```typescript
   const animController = character.getAnimationController();
   animController.playAnimation('SpecialMove');
   ```

---

## Future Enhancements

Potential additions with this architecture:
- **NetworkedCharacter** - Syncs over network
- **AICharacter** - AI-controlled movement
- **VehicleController** - Different physics model
- **AnimationBlending** - Blend multiple animations
- **RagdollPhysics** - Advanced physics on death
- **IKController** - Inverse kinematics for feet placement

The modular design makes these enhancements straightforward to implement!
