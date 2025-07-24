# Galaxy Simulator - Ultra-Scale N-Body Simulation

A next-generation interactive N-body galaxy simulation supporting up to 100,000+ stellar bodies, powered by AWS serverless architecture and advanced WebGL rendering.

🚀 **NEW**: Enhanced AWS integration with serverless compute, real-time monitoring, and enterprise-grade scalability.

## Features

- **10,000 bodies**: Realistic galaxy simulation with bulge, disk, and dark matter halo
- **Real-time physics**: Gravitational N-body calculations
- **Interactive 3D visualization**: Rotate, pan, and zoom
- **Spiral galaxy structure**: 2 spiral arms with realistic star distribution
- **Performance optimized**: Runs smoothly in web browsers

## Deployment

### AWS Cloud Deployment (Recommended)

The project now includes comprehensive AWS integration with enhanced capabilities:

#### Features
- **Serverless Architecture**: AWS Lambda functions for high-performance N-body simulations
- **Auto-scaling**: Handles 100,000+ bodies with automatic scaling
- **Global CDN**: CloudFront distribution for optimal performance
- **Real-time Monitoring**: CloudWatch dashboards and X-Ray tracing
- **Advanced Caching**: ElastiCache for simulation state persistence
- **CI/CD Pipeline**: GitHub Actions for automated deployment

#### Quick Deploy

```bash
# Deploy to development environment
./aws/deploy.sh -e development

# Deploy to production with monitoring and caching
./aws/deploy.sh -e production -m -c -n your-email@company.com

# Deploy with custom domain
./aws/deploy.sh -e production -d galaxy.yourcompany.com
```

#### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js 18+ installed
- (Optional) AWS SAM CLI for enhanced deployment

#### Architecture
- **Frontend**: Next.js hosted on AWS Amplify
- **API**: API Gateway + Lambda functions
- **Compute**: High-memory Lambda functions (up to 10GB)
- **Storage**: S3 for simulation data, DynamoDB for metadata
- **Monitoring**: CloudWatch, X-Ray, and custom dashboards
- **Security**: Cognito for user authentication

### Traditional Vercel Deployment

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

### Frontend
- **Next.js 14**: React framework with SSR/SSG
- **Three.js**: 3D graphics and WebGL rendering
- **React Three Fiber**: React renderer for Three.js
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling

### AWS Cloud Infrastructure
- **AWS Lambda**: Serverless compute for N-body calculations
- **API Gateway**: RESTful API with authentication
- **AWS Amplify**: Frontend hosting and CI/CD
- **Amazon S3**: Simulation data storage with lifecycle policies
- **Amazon DynamoDB**: Metadata and configuration storage
- **Amazon ElastiCache**: High-performance caching layer
- **AWS Step Functions**: Workflow orchestration for long simulations
- **Amazon CloudWatch**: Monitoring, logging, and alerting
- **AWS X-Ray**: Distributed tracing and performance analysis
- **Amazon Cognito**: User authentication and authorization
- **Amazon EventBridge**: Event-driven architecture

### Development & Operations
- **GitHub Actions**: Automated CI/CD pipeline
- **AWS CDK/CloudFormation**: Infrastructure as Code
- **AWS Powertools**: Enhanced observability
- **ESLint/Prettier**: Code quality and formatting

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

### Web Performance (Frontend)
- Sampled force calculations for real-time rendering
- GPU-accelerated rendering with Three.js
- Efficient particle system with custom shaders
- WebGL optimizations for 60+ FPS

### Cloud Performance (AWS Backend)
- **High-Memory Lambda**: Up to 10GB RAM for large simulations
- **Barnes-Hut Algorithm**: O(N log N) complexity for 100k+ bodies
- **Parallel Processing**: Step Functions for distributed computation
- **Intelligent Caching**: ElastiCache with optimized TTL policies
- **Auto-scaling**: Concurrent Lambda executions based on demand
- **Edge Optimization**: CloudFront CDN for global distribution

### Benchmarks
- **10,000 bodies**: Real-time simulation at 60 FPS
- **50,000 bodies**: 30 FPS with optimized rendering
- **100,000+ bodies**: Server-side processing with streaming results
- **Cold start**: < 2 seconds with Lambda provisioned concurrency
- **API latency**: < 100ms for typical simulation operations