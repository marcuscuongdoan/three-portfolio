# 3D World Controller - Implementation Guide

This project implements a 3D world with character controller using Three.js, Cannon.js physics, and React with TypeScript in Next.js.

## Architecture

The implementation follows a class-based TypeScript architecture inspired by the Bandwagon SDK:

### Core Classes

1. **World3D** (`src/lib/three-world/World3D.ts`)
   - Main engine class that orchestrates the 3D scene
   - Manages Three.js renderer, scene, and Cannon.js physics world
   - Handles environment setup (lights, ground, objects)
   - Provides game loop and lifecycle management

2. **CharacterController** (`src/lib/three-world/CharacterController.ts`)
   - Controls character movement with physics simulation
   - Handles walking, running, jumping (double jump supported)
   - Smooth acceleration/deceleration
   - Ground detection using raycasting
   - Camera-relative movement controls

3. **CameraController** (`src/lib/three-world/CameraController.ts`)
   - Third-person orbital camera system
   - Mouse-controlled camera rotation (with pointer lock)
   - Smooth camera following with interpolation
   - Adjustable distance, height, and sensitivity

4. **InputManager** (`src/lib/three-world/InputManager.ts`)
   - Centralized keyboard and mouse input handling
   - Support for WASD + Arrow keys
   - Pointer lock support for camera control
   - Extensible for future input methods

## Features

✅ **Physics Simulation**: Full physics using Cannon.js
- Gravity, collision detection, ground raycasting
- Capsule-shaped character collider
- Static environment objects

✅ **Character Movement**:
- Walk (WASD/Arrows)
- Run (Hold Shift)
- Jump (Space) with double jump
- Smooth transitions and momentum

✅ **Camera System**:
- Third-person orbital camera
- Mouse-controlled rotation (click to lock pointer)
- Smooth following with lag for cinematic feel
- Camera-relative movement controls

✅ **React Integration**:
- Clean component wrapper (`World3DCanvas`)
- Proper lifecycle management
- Loading states and error handling
- Responsive canvas sizing

## Controls

- **WASD / Arrow Keys** - Move character
- **Shift** - Run (hold while moving)
- **Space** - Jump (press twice for double jump)
- **Mouse Move** - Rotate camera (click canvas to lock pointer)
- **ESC** - Release pointer lock

## File Structure

```
src/
├── lib/
│   └── three-world/
│       ├── World3D.ts              # Main 3D engine
│       ├── CharacterController.ts  # Character physics & movement
│       ├── CameraController.ts     # Camera system
│       ├── InputManager.ts         # Input handling
│       └── index.ts                # Exports
├── components/
│   └── World3DCanvas.tsx           # React wrapper component
└── app/
    └── page.tsx                    # Main page
```

## Usage

### Basic Setup

```tsx
import World3DCanvas from '@/components/World3DCanvas';

export default function Page() {
  return (
    <div className="w-screen h-screen">
      <World3DCanvas characterModelPath="/models/character.gltf" />
    </div>
  );
}
```

### Advanced Usage

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { World3D } from '@/lib/three-world';

export default function CustomWorld() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const world = new World3D(containerRef.current);
    
    // Load character and start
    world.loadCharacter('/models/character.gltf')
      .then(() => world.start())
      .catch(console.error);
    
    // Cleanup
    return () => world.dispose();
  }, []);
  
  return <div ref={containerRef} className="w-full h-full" />;
}
```

## Configuration

### Character Controller Settings

Edit `CharacterController.ts`:

```typescript
private walkSpeed: number = 2.5;    // Walking speed
private runSpeed: number = 4.5;     // Running speed
private jumpSpeed: number = 5;      // Jump force
private maxJumps: number = 2;       // Allow double jump
```

### Camera Settings

Edit `CameraController.ts`:

```typescript
private distance: number = 5;       // Distance from character
private height: number = 2;         // Height offset
private sensitivity: number = 0.003; // Mouse sensitivity
private smoothFactor: number = 0.1; // Camera smoothing
```

### Physics Settings

Edit `World3D.ts`:

```typescript
this.world.gravity.set(0, -9.82, 0); // Gravity
(this.world.solver as CANNON.GSSolver).iterations = 10; // Solver iterations
```

## Dependencies

- **three**: 3D rendering library
- **@types/three**: TypeScript definitions for Three.js
- **cannon-es**: Physics engine
- **@types/cannon-es**: TypeScript definitions for Cannon.js

## Character Model Requirements

The character model should be:
- GLTF format (`.gltf` or `.glb`)
- Properly scaled (adjust in `World3D.loadCharacter()`)
- Located in `public/models/` directory

To adjust character scale:
```typescript
this.characterModel.scale.set(1, 1, 1); // Change these values
```

## Extending the System

### Adding New Features

1. **Custom Animations**: Extend `CharacterController` to add animation mixer
2. **Additional Controls**: Add methods to `InputManager`
3. **New Camera Modes**: Create new camera controller classes
4. **Multiplayer**: Add networking layer to sync character positions

### Example: Adding Animation Support

```typescript
// In CharacterController
private mixer?: THREE.AnimationMixer;
private animations: Map<string, THREE.AnimationAction> = new Map();

// Load animations from GLTF
gltf.animations.forEach((clip) => {
  const action = this.mixer!.createAction(clip);
  this.animations.set(clip.name, action);
});
```

## Performance Tips

1. **Lower Shadow Map Size**: Reduce `shadowMapSize` in `setupLights()`
2. **Reduce Physics Steps**: Lower iterations in physics world
3. **Optimize Models**: Use lower poly models for better performance
4. **Frustum Culling**: Enabled by default in Three.js

## Troubleshooting

**Character falls through ground:**
- Check that ground physics body is added before character
- Verify ground quaternion rotation

**Camera too fast/slow:**
- Adjust `sensitivity` in CameraController
- Modify `smoothFactor` for different camera feel

**Movement feels sluggish:**
- Increase acceleration values in `calculateGroundMovement()`
- Reduce `linearDamping` on character body

## Reference Projects

This implementation is based on:
- Bandwagon SDK (C:\Work\Bandwagon\sdk)
- Friendship Checker (https://github.com/marcuscuongdoan/friendship-checker)

## License

Same as the parent project.
