import { GalaxyParams, Body } from './galaxyPhysics'

export interface AWSSimulationState {
  positions: number[][]
  colors: number[][]
  types: string[]
  timestamp: number
}

export interface AWSSimulationResponse {
  success: boolean
  simulationId: string
  bodyCount?: number
  state: AWSSimulationState
  error?: string
}

export class AWSGalaxyClient {
  private apiEndpoint: string
  private simulationId: string | null = null
  private isConnected: boolean = false
  
  constructor(apiEndpoint?: string) {
    // Use environment variable or default endpoint
    this.apiEndpoint = apiEndpoint || process.env.NEXT_PUBLIC_AWS_API_ENDPOINT || ''
    
    // Enable demo mode if no valid endpoint is configured
    if (!this.isValidEndpoint(this.apiEndpoint)) {
      console.log('AWS Demo Mode: Using mock simulation data')
    }
  }
  
  private isValidEndpoint(endpoint: string): boolean {
    return !!endpoint && 
      endpoint.length > 0 && 
      !endpoint.includes('your-api-id') && 
      endpoint.startsWith('https://')
  }
  
  // Initialize a new simulation on AWS or demo mode
  async initializeSimulation(params: GalaxyParams): Promise<AWSSimulationResponse> {
    try {
      this.simulationId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Use demo mode if no valid endpoint
      if (!this.isValidEndpoint(this.apiEndpoint)) {
        return this.createDemoSimulation(params)
      }
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'initialize',
          params,
          simulationId: this.simulationId
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result: AWSSimulationResponse = await response.json()
      
      if (result.success) {
        this.isConnected = true
      }
      
      return result
    } catch (error) {
      console.error('Failed to initialize AWS simulation, using demo mode:', error)
      return this.createDemoSimulation(params)
    }
  }
  
  // Update simulation on AWS or demo mode (run N steps)
  async updateSimulation(params: GalaxyParams, steps: number = 1): Promise<AWSSimulationResponse> {
    if (!this.simulationId) {
      throw new Error('Simulation not initialized. Call initializeSimulation first.')
    }
    
    try {
      // Use demo mode if no valid endpoint
      if (!this.isValidEndpoint(this.apiEndpoint)) {
        return this.updateDemoSimulation(params, steps)
      }
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'step',
          params,
          simulationId: this.simulationId,
          steps
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result: AWSSimulationResponse = await response.json()
      return result
    } catch (error) {
      console.error('Failed to update AWS simulation, using demo mode:', error)
      return this.updateDemoSimulation(params, steps)
    }
  }
  
  // Convert AWS state to local Body format
  convertAWSStateToBodies(state: AWSSimulationState): Body[] {
    const bodies: Body[] = []
    
    for (let i = 0; i < state.positions.length; i++) {
      bodies.push({
        position: {
          x: state.positions[i][0],
          y: state.positions[i][1],
          z: state.positions[i][2]
        } as any, // THREE.Vector3 will be created in the component
        velocity: { x: 0, y: 0, z: 0 } as any, // Not needed for rendering
        mass: 1, // Not needed for rendering
        color: {
          r: state.colors[i][0],
          g: state.colors[i][1],
          b: state.colors[i][2]
        } as any, // THREE.Color will be created in the component
        type: state.types[i] as 'bulge' | 'disk' | 'halo'
      })
    }
    
    return bodies
  }
  
  // Demo simulation data
  private demoState: AWSSimulationState | null = null
  private demoTime: number = 0
  
  private createDemoSimulation(params: GalaxyParams): AWSSimulationResponse {
    console.log('🚀 Creating AWS Demo Simulation with', params.nBodies, 'bodies')
    
    const nBodies = params.nBodies || 50000
    const positions: number[][] = []
    const colors: number[][] = []
    const types: string[] = []
    
    // Generate demo galaxy data
    for (let i = 0; i < nBodies; i++) {
      const r = Math.random() * 50
      const theta = Math.random() * 2 * Math.PI
      const z = (Math.random() - 0.5) * 4
      
      positions.push([
        r * Math.cos(theta),
        r * Math.sin(theta),
        z
      ])
      
      // Color based on distance from center
      const distanceColor = Math.min(1, r / 30)
      colors.push([
        0.1 + distanceColor * 0.2,
        0.08 + distanceColor * 0.1,
        0.08 + distanceColor * 0.1
      ])
      
      types.push(i < nBodies * 0.1 ? 'halo' : i < nBodies * 0.25 ? 'bulge' : 'disk')
    }
    
    this.demoState = {
      positions,
      colors,
      types,
      timestamp: Date.now()
    }
    
    this.isConnected = true
    
    return {
      success: true,
      simulationId: this.simulationId!,
      bodyCount: nBodies,
      state: this.demoState
    }
  }
  
  private updateDemoSimulation(params: GalaxyParams, steps: number): AWSSimulationResponse {
    if (!this.demoState) {
      return this.createDemoSimulation(params)
    }
    
    // Simulate galaxy rotation
    this.demoTime += steps * 0.01
    const rotationSpeed = 0.1
    
    for (let i = 0; i < this.demoState.positions.length; i++) {
      const [x, y, z] = this.demoState.positions[i]
      const r = Math.sqrt(x * x + y * y)
      const currentTheta = Math.atan2(y, x)
      const newTheta = currentTheta + rotationSpeed * this.demoTime / (r + 1)
      
      this.demoState.positions[i] = [
        r * Math.cos(newTheta),
        r * Math.sin(newTheta),
        z + Math.sin(this.demoTime + i * 0.001) * 0.1
      ]
    }
    
    this.demoState.timestamp = Date.now()
    
    return {
      success: true,
      simulationId: this.simulationId!,
      state: this.demoState
    }
  }
  
  // Check if AWS simulation is available (always true for demo)
  isAWSAvailable(): boolean {
    const hasValidEndpoint = this.isValidEndpoint(this.apiEndpoint)
    
    console.log('AWS Availability Check:', {
      endpoint: this.apiEndpoint,
      isValid: hasValidEndpoint,
      demoMode: !hasValidEndpoint
    })
    
    // Always return true to enable demo mode
    return true
  }
  
  // Get connection status
  getConnectionStatus(): boolean {
    return this.isConnected
  }
  
  // Reset simulation
  reset(): void {
    this.simulationId = null
    this.isConnected = false
  }
  
  // Estimate cost for simulation
  estimateCost(nBodies: number, hours: number): number {
    // AWS Lambda pricing estimate (simplified)
    const lambdaRequestCost = 0.0000002 // per request
    const lambdaComputeCost = 0.0000166667 // per GB-second
    const s3StorageCost = 0.023 // per GB per month
    
    const requestsPerHour = 60 * 60 / 2 // assuming 2-second intervals
    const memoryGB = 3.008 // Lambda memory in GB
    const storageGB = (nBodies * 100) / (1024 * 1024 * 1024) // approximate
    
    const totalRequests = requestsPerHour * hours
    const totalComputeSeconds = totalRequests * 5 // avg 5 seconds per request
    
    const requestsCost = totalRequests * lambdaRequestCost
    const computeCost = totalComputeSeconds * memoryGB * lambdaComputeCost
    const storageCost = storageGB * s3StorageCost * (hours / (24 * 30))
    
    return requestsCost + computeCost + storageCost
  }
}