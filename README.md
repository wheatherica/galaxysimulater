# Galaxy Simulator - 10,000 Bodies

An interactive N-body galaxy simulation featuring 10,000 stellar bodies, implemented with Three.js and Next.js.

## Features

- **10,000 bodies**: Realistic galaxy simulation with bulge, disk, and dark matter halo
- **Real-time physics**: Gravitational N-body calculations
- **Interactive 3D visualization**: Rotate, pan, and zoom
- **Spiral galaxy structure**: 2 spiral arms with realistic star distribution
- **Performance optimized**: Runs smoothly in web browsers

## Deployment

### Deploy to Vercel

1. Install dependencies:
```bash
npm install
```

2. Run locally:
```bash
npm run dev
```

3. Deploy to Vercel:
```bash
npx vercel
```

Or use the Vercel Dashboard:
1. Import this repository to Vercel
2. Deploy with default settings
3. Your galaxy simulation will be live!

## Technology Stack

- **Next.js 14**: React framework
- **Three.js**: 3D graphics
- **React Three Fiber**: React renderer for Three.js
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling

## Galaxy Parameters

- Total bodies: 10,000
- Galaxy radius: 50 kpc
- Components:
  - Bulge (15%): Central spherical component
  - Disk (75%): Spiral arms with young and old stars
  - Dark Matter Halo (10%): Invisible mass component
- Spiral arms: 2
- Physics timestep: 0.001

## Performance

The simulation uses optimized algorithms for web performance:
- Sampled force calculations for real-time performance
- GPU-accelerated rendering with Three.js
- Efficient particle system with custom shaders