# Character Animation Feature

## Overview

A new feature has been implemented that allows sections to trigger character animations when they come into view during scrolling. The character will automatically play different animations based on which section the user is viewing.

## Implementation

### Key Components

#### 1. **World3D.ts** - Animation Control
Added a public method to play character animations:

```typescript
public playCharacterAnimation(
  animationName: string, 
  loop: boolean = true, 
  fadeTime: number = 0.3
): boolean
```

**Supported Animations:**
- `'run'` - Running animation
- `'walk'` - Walking animation
- `'idle'` - Idle/standing animation
- `'agree'` - Agreement/nodding animation
- `'sneak'` - Sneaking pose
- `'sad'` - Sad pose

**Parameters:**
- `animationName`: Name of the animation to play
- `loop`: Whether to loop the animation (default: true)
- `fadeTime`: Transition fade time in seconds (default: 0.3)

**Returns:** `true` if animation exists and was played, `false` otherwise

#### 2. **World3DCanvas.tsx** - Ref Exposure
Exposed the animation function through a React ref using `forwardRef` and `useImperativeHandle`:

```typescript
export interface World3DCanvasRef {
  playCharacterAnimation: (animationName: string, loop?: boolean, fadeTime?: number) => boolean;
}
```

#### 3. **BaseLayout.tsx** - Function Distribution
The BaseLayout component:
- Creates a ref to World3DCanvas
- Provides a `playCharacterAnimation` function
- Clones children and injects the function as a prop

```typescript
const playCharacterAnimation = (animationName: string, loop: boolean = true, fadeTime: number = 0.3) => {
  if (world3DRef.current) {
    return world3DRef.current.playCharacterAnimation(animationName, loop, fadeTime);
  }
  return false;
};
```

#### 4. **About.tsx** - Scroll Detection
The About section uses `useInView` from Framer Motion to detect when it's visible and triggers animations:

```typescript
useEffect(() => {
  if (isInView && !hasTriggeredAnimation.current && playCharacterAnimation) {
    console.log('About section in view - triggering run animation');
    playCharacterAnimation('run', true, 0.5);
    hasTriggeredAnimation.current = true;
  } else if (!isInView && hasTriggeredAnimation.current && playCharacterAnimation) {
    console.log('About section out of view - returning to idle');
    playCharacterAnimation('idle', true, 0.5);
    hasTriggeredAnimation.current = false;
  }
}, [isInView, playCharacterAnimation]);
```

## Usage Example

### Adding Animation Triggers to a New Section

1. **Update the component interface to accept the animation function:**

```typescript
interface MySectionProps {
  playCharacterAnimation?: (animationName: string, loop?: boolean, fadeTime?: number) => boolean;
}

export default function MySection({ playCharacterAnimation }: MySectionProps) {
  // ...
}
```

2. **Use Framer Motion's `useInView` hook for scroll detection:**

```typescript
import { useInView } from "framer-motion";
import { useRef, useEffect } from "react";

export default function MySection({ playCharacterAnimation }: MySectionProps) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.3 });
  const hasTriggeredAnimation = useRef(false);

  useEffect(() => {
    if (isInView && !hasTriggeredAnimation.current && playCharacterAnimation) {
      // Trigger your animation when section comes into view
      playCharacterAnimation('walk', true, 0.5);
      hasTriggeredAnimation.current = true;
    } else if (!isInView && hasTriggeredAnimation.current && playCharacterAnimation) {
      // Return to idle when scrolling away
      playCharacterAnimation('idle', true, 0.5);
      hasTriggeredAnimation.current = false;
    }
  }, [isInView, playCharacterAnimation]);

  return (
    <section ref={containerRef}>
      {/* Your section content */}
    </section>
  );
}
```

3. **Pass the section as a child in page.tsx:**

The BaseLayout automatically injects the `playCharacterAnimation` prop into its children, so you just need to structure your page correctly:

```typescript
export default function Home() {
  return (
    <BaseLayout>
      <HomeContent />
    </BaseLayout>
  );
}

function HomeContent({ playCharacterAnimation }: HomeContentProps) {
  return (
    <>
      <HeroSection />
      <MySection playCharacterAnimation={playCharacterAnimation} />
      <About playCharacterAnimation={playCharacterAnimation} />
    </>
  );
}
```

## Current Behavior

### Hero Section
- Character plays **sad pose** animation initially
- After camera zoom animation completes, transitions to **agree** animation
- Finally settles into **idle** animation

### About Section (Projects)
- When scrolling into view: Character plays **run** animation
- When scrolling out of view: Character returns to **idle** animation

## Animation Flow

```
Page Load → Sad Pose → (Camera Zoom) → Agree → Idle
                                                  ↓
                                    User Scrolls to About
                                                  ↓
                                    Character Runs → Run Animation
                                                  ↓
                                    User Scrolls Away
                                                  ↓
                                    Character Returns → Idle Animation
```

## Technical Notes

### Animation Transitions
- All animations use smooth fade transitions (default 0.3s, customizable)
- Previous animations automatically fade out when a new one starts
- One-time animations (loop=false) automatically return to idle after completion

### State Management
- Uses `useRef` to track if animation has been triggered for a section
- Prevents duplicate animation triggers
- Properly handles scrolling back and forth between sections

### Performance
- Animations are managed by Three.js AnimationMixer
- Efficient fade transitions between animations
- No re-renders triggered by animation changes

## Debugging

Enable console logs to see when animations are triggered:
- "About section in view - triggering run animation"
- "About section out of view - returning to idle"
- "Playing animation: [animation_name]"

## Future Enhancements

Potential improvements:
- Add more animations (jump, dance, wave, etc.)
- Create animation sequences (chained animations)
- Add animation callbacks for custom logic
- Support for animation speed control
- Direction-aware animations (walking left/right based on scroll direction)
