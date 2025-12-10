# Camera Adjustment Feature

## Overview

The `adjustCamera` function allows you to smoothly animate the camera position and look-at target in your 3D world. This feature is similar to the `playCharacterAnimation` function and provides smooth, customizable camera movements.

## Usage

### Basic Setup

First, create a ref to the World3DCanvas component:

```tsx
import { useRef } from 'react';
import World3DCanvas, { World3DCanvasRef } from '@/components/World3DCanvas';

function MyComponent() {
  const worldRef = useRef<World3DCanvasRef>(null);

  return (
    <World3DCanvas ref={worldRef} />
  );
}
```

### Adjusting Camera Position

Call the `adjustCamera` function through the ref:

```tsx
// Move camera to a new position
worldRef.current?.adjustCamera({
  position: { x: 2, y: 3, z: 5 }
});

// Change what the camera is looking at
worldRef.current?.adjustCamera({
  lookAt: { x: 0, y: 1.5, z: 0 }
});

// Move camera position AND change look-at target
worldRef.current?.adjustCamera({
  position: { x: 2, y: 3, z: 5 },
  lookAt: { x: 0, y: 1.5, z: 0 }
});
```

### Advanced Options

#### Custom Duration

Control how long the animation takes (in milliseconds):

```tsx
worldRef.current?.adjustCamera({
  position: { x: 2, y: 3, z: 5 },
  duration: 2000 // 2 seconds
});
```

#### Custom Easing

Use different easing functions for smooth animations:

```tsx
import * as TWEEN from '@tweenjs/tween.js';

worldRef.current?.adjustCamera({
  position: { x: 2, y: 3, z: 5 },
  easing: TWEEN.Easing.Bounce.Out
});
```

Available easing functions include:
- `TWEEN.Easing.Linear.None`
- `TWEEN.Easing.Quadratic.In/Out/InOut`
- `TWEEN.Easing.Cubic.In/Out/InOut`
- `TWEEN.Easing.Quartic.In/Out/InOut`
- `TWEEN.Easing.Quintic.In/Out/InOut`
- `TWEEN.Easing.Sinusoidal.In/Out/InOut`
- `TWEEN.Easing.Exponential.In/Out/InOut`
- `TWEEN.Easing.Circular.In/Out/InOut`
- `TWEEN.Easing.Elastic.In/Out/InOut`
- `TWEEN.Easing.Back.In/Out/InOut`
- `TWEEN.Easing.Bounce.In/Out/InOut`

#### Completion Callback

Execute code when the animation completes:

```tsx
worldRef.current?.adjustCamera({
  position: { x: 2, y: 3, z: 5 },
  lookAt: { x: 0, y: 1.5, z: 0 },
  onComplete: () => {
    console.log('Camera movement complete!');
    // Play an animation, show UI, etc.
  }
});
```

## Complete Example

```tsx
import { useRef } from 'react';
import World3DCanvas, { World3DCanvasRef } from '@/components/World3DCanvas';
import * as TWEEN from '@tweenjs/tween.js';

function AboutPage() {
  const worldRef = useRef<World3DCanvasRef>(null);

  const handleZoomIn = () => {
    // Zoom in on character's face
    worldRef.current?.adjustCamera({
      position: { x: 0, y: 1.7, z: 1 },
      lookAt: { x: 0, y: 1.5, z: 0 },
      duration: 1500,
      easing: TWEEN.Easing.Quadratic.InOut,
      onComplete: () => {
        // Play a wave animation when camera arrives
        worldRef.current?.playCharacterAnimation('agree', false);
      }
    });
  };

  const handleZoomOut = () => {
    // Zoom out to full body view
    worldRef.current?.adjustCamera({
      position: { x: 0, y: 3, z: 5 },
      lookAt: { x: 0, y: 2, z: 0 },
      duration: 1500,
      easing: TWEEN.Easing.Quadratic.InOut
    });
  };

  return (
    <div>
      <World3DCanvas ref={worldRef} className="w-full h-screen" />
      
      <div className="fixed bottom-4 left-4 space-x-2">
        <button onClick={handleZoomIn}>Zoom In</button>
        <button onClick={handleZoomOut}>Zoom Out</button>
      </div>
    </div>
  );
}

export default AboutPage;
```

## Parameters Reference

### `adjustCamera(options)`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `position` | `{ x: number, y: number, z: number }` | No | - | Target camera position in 3D space |
| `lookAt` | `{ x: number, y: number, z: number }` | No | - | Target position for camera to look at |
| `duration` | `number` | No | `1000` | Animation duration in milliseconds |
| `easing` | `(amount: number) => number` | No | `TWEEN.Easing.Quadratic.InOut` | Easing function for smooth animation |
| `onComplete` | `() => void` | No | - | Callback executed when animation completes |

**Note:** At least one of `position` or `lookAt` must be provided.

## Common Camera Positions

Here are some useful camera positions for character viewing:

```tsx
// Close-up face view
{ position: { x: 0, y: 1.7, z: 1 }, lookAt: { x: 0, y: 1.5, z: 0 } }

// Full body view
{ position: { x: 0, y: 3, z: 5 }, lookAt: { x: 0, y: 2, z: 0 } }

// Side view
{ position: { x: 3, y: 2, z: 0 }, lookAt: { x: 0, y: 2, z: 0 } }

// Bird's eye view
{ position: { x: 0, y: 8, z: 2 }, lookAt: { x: 0, y: 0, z: 0 } }

// Dramatic low angle
{ position: { x: 0, y: 0.5, z: 3 }, lookAt: { x: 0, y: 2.5, z: 0 } }
```

## Combining with Animations

You can combine camera movements with character animations for cinematic effects:

```tsx
const handleIntroSequence = () => {
  // First, zoom in on character
  worldRef.current?.adjustCamera({
    position: { x: 0, y: 1.7, z: 1 },
    lookAt: { x: 0, y: 1.5, z: 0 },
    duration: 2000,
    onComplete: () => {
      // Then play agree animation
      worldRef.current?.playCharacterAnimation('agree', false);
      
      // After animation, zoom out
      setTimeout(() => {
        worldRef.current?.adjustCamera({
          position: { x: 0, y: 3, z: 5 },
          lookAt: { x: 0, y: 2, z: 0 },
          duration: 1500
        });
      }, 2000);
    }
  });
};
```

## Implementation Details

The `adjustCamera` function uses the TWEEN.js library for smooth animations. It:
1. Stops any existing camera animations
2. Creates smooth transitions for camera position and/or look-at target
3. Updates the camera in real-time during the animation
4. Calls the completion callback when finished

The camera animations run independently of the character animations, allowing you to create complex, coordinated movements.
