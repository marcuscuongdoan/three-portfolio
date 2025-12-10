# BaseLayout Component Usage

The `BaseLayout` component provides a reusable layout that includes:
- 3D Canvas with World3DCanvas
- CloudBackground with animated clouds
- Navbar
- Fade-in animations

## Basic Usage

```tsx
import BaseLayout from "@/components/BaseLayout";

export default function MyPage() {
  return (
    <BaseLayout>
      {/* Your page content here */}
      <div className="w-full h-full flex items-center justify-center">
        <h1 className="text-white text-4xl">My Page Content</h1>
      </div>
    </BaseLayout>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | ReactNode | - | Page-specific content to render |
| `showNavbar` | boolean | `true` | Whether to show the navbar |
| `cloudOpacity` | number | `0.3` | Opacity of cloud background (0-1) |
| `maxClouds` | number | `50` | Maximum number of clouds to render |
| `characterModelPath` | string | `'/models/bot.glb'` | Path to 3D character model |
| `enableCloudControls` | boolean | `true` | Enable keyboard controls for clouds |
| `className` | string | `""` | Additional CSS classes for the main container |

## Cloud Keyboard Controls

When `enableCloudControls` is enabled:
- `+` or `=` - Add more clouds
- `-` or `_` - Remove clouds
- `↑` (Arrow Up) - Increase cloud speed
- `↓` (Arrow Down) - Decrease cloud speed

## Examples

### Minimal Page
```tsx
<BaseLayout>
  <div className="w-full h-full flex items-center justify-center">
    <h1 className="text-white">Simple Page</h1>
  </div>
</BaseLayout>
```

### Page Without Navbar
```tsx
<BaseLayout showNavbar={false}>
  <div className="w-full h-full">
    {/* Your content */}
  </div>
</BaseLayout>
```

### Custom Cloud Settings
```tsx
<BaseLayout
  cloudOpacity={0.5}
  maxClouds={30}
  enableCloudControls={false}
>
  <div className="w-full h-full">
    {/* Your content */}
  </div>
</BaseLayout>
```

### Different Character Model
```tsx
<BaseLayout characterModelPath="/models/my-character.glb">
  <div className="w-full h-full">
    {/* Your content */}
  </div>
</BaseLayout>
```

## Injected Props

The `BaseLayout` component automatically injects functions into its children components:

### `playCharacterAnimation(animationName: string, loop?: boolean, fadeTime?: number): boolean`
- Controls the 3D character animations
- `animationName`: Name of the animation (e.g., 'run', 'walk', 'idle', 'agree')
- `loop`: Whether to loop the animation (default: true)
- `fadeTime`: Fade transition time in seconds (default: 0.3)
- Returns: `true` if animation exists and was played, `false` otherwise

### `adjustCamera(options): void`
- Smoothly animates camera position and/or look-at target
- `options.position`: Target camera position `{ x, y, z }`
- `options.lookAt`: Target look-at position `{ x, y, z }`
- `options.duration`: Animation duration in milliseconds (default: 1000)
- `options.easing`: TWEEN easing function (default: Quadratic.InOut)
- `options.onComplete`: Callback when animation completes

For detailed camera adjustment documentation, see [CAMERA-ADJUSTMENT-FEATURE.md](./CAMERA-ADJUSTMENT-FEATURE.md).

## Important Notes

- The children content is wrapped in a `pointer-events-none` container to allow 3D canvas interactions
- Add `pointer-events-auto` to specific elements that need to be interactive
- Content area starts with `pt-16` (4rem) padding-top to account for navbar height
- The layout uses absolute positioning, so children should be positioned accordingly

## Example with Interactive Elements

```tsx
<BaseLayout>
  <div className="w-full h-full flex items-center justify-center">
    <div className="pointer-events-auto">
      <button className="bg-blue-500 px-4 py-2 rounded">
        Click Me
      </button>
    </div>
  </div>
</BaseLayout>
```
