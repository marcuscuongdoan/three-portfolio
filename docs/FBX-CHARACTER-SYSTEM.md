# FBX Character System Documentation

## Overview

The FBX Character System allows you to load 3D character models in FBX format with separate animation files. This provides flexibility in managing animations and reduces file sizes compared to embedding all animations in a single file.

## Features

- ✅ Load FBX character models with separate animation files
- ✅ Automatic format detection (FBX vs GLTF/GLB)
- ✅ Support for multiple animation types
- ✅ Smooth animation transitions with crossfading
- ✅ Head tracking to mouse cursor
- ✅ Camera animation system
- ✅ Backward compatible with GLTF/GLB models

## File Structure

```
public/models/
├── bot.fbx              # Base character model (no animations)
├── idle.fbx             # Idle animation
├── walking.fbx          # Walking animation
├── cheering.fbx         # Cheering animation
├── falling.fbx          # Falling animation
├── falling-impact.fbx   # Falling impact animation
└── standing-up.fbx      # Standing up animation
```

## How It Works

### 1. Character Model Loading

The system detects the file extension and uses the appropriate loader:

- **FBX files** → `FBXLoader` with separate animations
- **GLB/GLTF files** → `GLTFLoader` with embedded animations

```tsx
// In World3DCanvas.tsx
const fileExtension = characterModelPath.split('.').pop()?.toLowerCase();

if (fileExtension === 'fbx') {
  // Load FBX with separate animations
  await world.loadCharacterFBX(characterModelPath, animationPaths);
} else {
  // Load GLTF/GLB with embedded animations
  await world.loadCharacter(characterModelPath);
}
```

### 2. Animation Loading

Each animation file is loaded separately and mapped to a name:

```typescript
const animationPaths = {
  'idle': '/models/idle.fbx',
  'walking': '/models/walking.fbx',
  'cheering': '/models/cheering.fbx',
  'falling': '/models/falling.fbx',
  'falling-impact': '/models/falling-impact.fbx',
  'standing-up': '/models/standing-up.fbx'
};
```

### 3. Animation Mapping

Animations are automatically mapped to internal actions:

| Animation File | Internal Name | Loop Type | Description |
|---------------|---------------|-----------|-------------|
| `idle.fbx` | `idle` | LoopRepeat | Default idle animation |
| `walking.fbx` | `walk` | LoopRepeat | Walking animation |
| `cheering.fbx` | `cheering` | LoopOnce | One-time celebration animation |
| `falling.fbx` | `falling` | LoopRepeat | Continuous falling animation |
| `falling-impact.fbx` | `impact` | LoopOnce | Landing impact animation |
| `standing-up.fbx` | `standup` | LoopOnce | Getting up animation |

## Usage

### Basic Setup

**1. Use FBX model in your page:**

```tsx
// src/app/page.tsx
export default function Page() {
  return (
    <BaseLayout
      characterModelPath="/models/bot.fbx"  // FBX model path
      showNavbar={true}
      cloudOpacity={0.3}
    >
      <YourContent />
    </BaseLayout>
  );
}
```

**2. Default configuration in BaseLayout:**

The system is now configured to use FBX by default:

```tsx
// src/components/BaseLayout.tsx
characterModelPath = '/models/bot.fbx'  // Default is now FBX
```

### Playing Animations

Use the `playCharacterAnimation` function to control animations:

```tsx
// Play idle animation with head tracking
playCharacterAnimation('idle', true, 0.5, true);

// Play cheering animation (one-time)
playCharacterAnimation('cheering', false, 0.3, false);

// Play walking animation
playCharacterAnimation('walking', true, 0.5, false);
```

**Parameters:**
- `animationName` (string): Name of the animation to play
- `loop` (boolean): Whether to loop the animation (default: true)
- `fadeTime` (number): Crossfade duration in seconds (default: 0.3)
- `lookAtCamera` (boolean): Enable head tracking (default: false)

### Available Animations

| Animation | Command | Loop | Use Case |
|-----------|---------|------|----------|
| Idle | `'idle'` | Yes | Default state |
| Walk | `'walk'` or `'walking'` | Yes | Movement |
| Cheering | `'cheering'` or `'agree'` | No | Celebration |
| Falling | `'falling'` | Yes | Falling motion |
| Impact | `'falling-impact'` or `'impact'` | No | Landing |
| Stand Up | `'standing-up'` or `'standup'` | No | Getting up |

## Adding New Animations

### Step 1: Add FBX File

Place your new animation FBX file in `public/models/`:

```
public/models/
└── your-new-animation.fbx
```

### Step 2: Update Animation Paths

Add the animation path to `World3DCanvas.tsx`:

```tsx
const animationPaths = {
  'idle': '/models/idle.fbx',
  'walking': '/models/walking.fbx',
  // ... existing animations
  'your-animation': '/models/your-new-animation.fbx',  // Add this
};
```

### Step 3: Map Animation in World3D.ts

Add the animation mapping in the `loadCharacterFBX` method:

```typescript
switch (animName.toLowerCase()) {
  // ... existing cases
  case 'your-animation':
    this.yourAnimationAction = action;
    action.setLoop(THREE.LoopRepeat, Infinity);  // or LoopOnce
    console.log('Loaded your animation');
    break;
}
```

### Step 4: Add to Animation Switch

Update the `playCharacterAnimation` method:

```typescript
switch (animName) {
  // ... existing cases
  case 'your-animation':
    targetAction = this.yourAnimationAction;
    break;
}
```

## Initial Animation Behavior

### FBX Characters

- Starts with **idle** animation
- Camera zooms in from distance
- Continues playing idle after zoom completes

### GLTF/GLB Characters (Legacy)

- Starts with **sad_pose** or **sneak_pose** animation
- Camera zooms in from distance
- Transitions to **agree** animation after zoom
- Finally transitions to **idle** animation

## Character Scaling

FBX models often require different scaling than GLTF models:

```typescript
// In World3D.ts - loadCharacterFBX method
this.characterModel.scale.set(0.01, 0.01, 0.01);  // Adjust as needed
```

Adjust these values based on your model's size.

## Skeleton Requirements

⚠️ **Important:** All animation FBX files must have the same skeleton structure as the base character model (`bot.fbx`).

### Checking Skeleton Compatibility

1. Import both the character and animation into Blender
2. Verify bone names match exactly
3. Ensure bone hierarchy is identical
4. Check that bone transforms are compatible

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Animation doesn't play | Skeleton mismatch | Ensure same skeleton in all files |
| Character deforms incorrectly | Different bone hierarchy | Re-export with matching skeleton |
| Animation clips not found | Missing animation in FBX | Verify animation data in file |

## Switching Between FBX and GLTF

The system automatically detects and handles both formats:

```tsx
// Use FBX
<BaseLayout characterModelPath="/models/bot.fbx">

// Use GLTF/GLB
<BaseLayout characterModelPath="/models/bot.glb">
```

No code changes needed - the format is auto-detected!

## Performance Considerations

### FBX Format

**Advantages:**
- Separate animation files for easier management
- Smaller individual file sizes
- Only load animations you need

**Disadvantages:**
- Multiple HTTP requests (one per animation)
- Slightly longer initial load time
- More complex loading logic

### GLTF/GLB Format

**Advantages:**
- Single file download
- Faster initial load for small animation sets
- Simpler loading logic

**Disadvantages:**
- Larger file size with multiple animations
- Must load all animations even if unused
- Harder to update individual animations

## Troubleshooting

### Character Doesn't Appear

1. **Check file path:**
   ```tsx
   characterModelPath="/models/bot.fbx"  // Correct
   characterModelPath="models/bot.fbx"   // Missing leading slash
   ```

2. **Verify file exists:**
   - Check `public/models/` directory
   - Ensure file name matches exactly (case-sensitive)

3. **Check browser console:**
   - Look for loading errors
   - Verify FBXLoader is imported correctly

### Animations Don't Play

1. **Check animation name:**
   ```tsx
   playCharacterAnimation('idle')      // Correct
   playCharacterAnimation('Idle')      // Wrong case
   ```

2. **Verify animation is loaded:**
   - Check console logs for "Loaded [animation] animation"
   - Ensure animation file path is correct

3. **Check skeleton compatibility:**
   - Animations must use same skeleton as character
   - Bone names must match exactly

### Character Scale Issues

Adjust scale in `loadCharacterFBX` method:

```typescript
// Too small?
this.characterModel.scale.set(0.02, 0.02, 0.02);

// Too large?
this.characterModel.scale.set(0.005, 0.005, 0.005);
```

### Animation Transitions Jerky

Increase fade time for smoother transitions:

```tsx
playCharacterAnimation('walk', true, 1.0);  // Longer fade time
```

## API Reference

### World3D.loadCharacterFBX()

```typescript
public async loadCharacterFBX(
  modelPath: string,
  animationPaths: Record<string, string>
): Promise<void>
```

**Parameters:**
- `modelPath`: Path to base FBX character model
- `animationPaths`: Object mapping animation names to file paths

**Returns:** Promise that resolves when character and all animations are loaded

### World3D.playCharacterAnimation()

```typescript
public playCharacterAnimation(
  animationName: string,
  loop: boolean = true,
  fadeTime: number = 0.3,
  lookAtCamera: boolean = false
): boolean
```

**Parameters:**
- `animationName`: Name of animation to play
- `loop`: Whether to loop animation
- `fadeTime`: Crossfade duration in seconds
- `lookAtCamera`: Enable head tracking

**Returns:** `true` if animation played successfully, `false` otherwise

## Best Practices

1. **File Naming:**
   - Use lowercase, hyphenated names
   - Be descriptive: `walking.fbx` not `anim1.fbx`

2. **Animation Organization:**
   - Keep all character files in same directory
   - Group by character if multiple characters

3. **Performance:**
   - Optimize FBX files before export
   - Remove unused bones/meshes
   - Keep animation clips concise

4. **Version Control:**
   - Track FBX files in git (they're binary)
   - Document any skeleton changes
   - Keep backup of working files

## Migration from GLTF to FBX

To migrate an existing GLTF character to FBX:

1. **Export character:**
   - Export base mesh without animations
   - Save as `bot.fbx`

2. **Export animations:**
   - Export each animation separately
   - Name files descriptively (e.g., `walking.fbx`)

3. **Update code:**
   ```tsx
   // Change this:
   characterModelPath="/models/bot.glb"
   
   // To this:
   characterModelPath="/models/bot.fbx"
   ```

4. **Test thoroughly:**
   - Verify all animations load
   - Check animation transitions
   - Test on different browsers

## Summary

The FBX Character System provides a flexible way to manage 3D characters with separate animation files. It automatically detects file formats and handles both FBX and GLTF models seamlessly.

**Key Benefits:**
- ✅ Modular animation management
- ✅ Automatic format detection
- ✅ Backward compatible
- ✅ Easy to extend

For additional help, refer to the Three.js FBXLoader documentation or check the console logs for detailed loading information.
