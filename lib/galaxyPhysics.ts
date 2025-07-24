import * as THREE from 'three'
import { BarnesHutTree } from './barnesHut'

export interface GalaxyParams {
  nBodies: number
  galaxyRadius: number
  bulgeRadius: number
  diskHeight: number
  rotationSpeed: number
  spiralTightness: number
  nSpiralArms: number
  G: number
  softening: number
  dt: number
  centralMass: number  // Central supermassive black hole mass
  diskMass: number     // Total disk mass
  haloMass: number     // Dark matter halo mass
  solarMass: number    // Solar mass unit
}

export interface Body {
  position: THREE.Vector3
  velocity: THREE.Vector3
  mass: number
  color: THREE.Color
  type: 'bulge' | 'disk' | 'halo'
}

export class GalaxySimulation {
  params: GalaxyParams
  bodies: Body[]
  private barnesHutTree: BarnesHutTree
  private useBarnesHut: boolean = true
  
  constructor(params: Partial<GalaxyParams> = {}) {
    this.params = {
      nBodies: params.nBodies || 10000,
      galaxyRadius: params.galaxyRadius || 50,  // in kpc
      bulgeRadius: params.bulgeRadius || 10,    // in kpc
      diskHeight: params.diskHeight || 2,       // in kpc
      rotationSpeed: params.rotationSpeed || 220, // km/s at solar radius
      spiralTightness: params.spiralTightness || 0.3,
      nSpiralArms: params.nSpiralArms || 2,
      G: params.G || 4.3e-6,  // Gravitational constant in kpc³/(M⊙·Myr²)
      softening: params.softening || 0.01,  // in kpc
      dt: params.dt || 0.5,    // in Myr (larger timestep for better performance)
      centralMass: params.centralMass || 4.3e6,  // Sagittarius A* mass in M⊙
      diskMass: params.diskMass || 6e10,         // Milky Way disk mass in M⊙
      haloMass: params.haloMass || 1e12,         // Dark matter halo mass in M⊙
      solarMass: params.solarMass || 1.0          // Solar mass unit
    }
    
    this.bodies = []
    this.barnesHutTree = new BarnesHutTree(0.5)
    // Use Barnes-Hut for large simulations
    this.useBarnesHut = this.params.nBodies > 5000
    this.initializeGalaxy()
  }
  
  private initializeGalaxy() {
    const { nBodies, bulgeRadius, galaxyRadius, diskHeight, nSpiralArms, spiralTightness, rotationSpeed, G, centralMass, diskMass, haloMass } = this.params
    
    // Component distribution
    const nBulge = Math.floor(0.15 * nBodies)
    const nDisk = Math.floor(0.75 * nBodies)
    const nHalo = nBodies - nBulge - nDisk
    
    // Bulge stars (spherical distribution)
    for (let i = 0; i < nBulge; i++) {
      const r = bulgeRadius * Math.pow(Math.random(), 0.5)
      const theta = Math.random() * 2 * Math.PI
      const phi = Math.acos(1 - 2 * Math.random())
      
      const position = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi) * 0.5
      )
      
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.2
      )
      
      this.bodies.push({
        position,
        velocity,
        mass: (0.8 + Math.random() * 1.2) * centralMass / nBulge,
        color: new THREE.Color(0.2, 0.15, 0.15),
        type: 'bulge'
      })
    }
    
    // Disk stars (spiral arms)
    for (let i = 0; i < nDisk; i++) {
      const armIndex = i % nSpiralArms
      const angleOffset = (armIndex * 2 * Math.PI) / nSpiralArms
      const t = Math.random() * 4
      
      // Logarithmic spiral
      let theta = t + angleOffset
      let r = bulgeRadius * Math.exp(spiralTightness * t)
      
      // Add scatter
      r += (Math.random() - 0.5) * 4
      theta += (Math.random() - 0.5) * 0.4
      
      // Limit to galaxy radius
      if (r > galaxyRadius) {
        r = galaxyRadius * (0.8 + Math.random() * 0.2)
      }
      
      // Position with disk height
      const z = this.gaussianRandom() * diskHeight * (1 - r / galaxyRadius)
      
      const position = new THREE.Vector3(
        r * Math.cos(theta),
        r * Math.sin(theta),
        z
      )
      
      // Circular velocity using actual mass distribution
      const mEnc = this.getEnclosedMass(r)
      const vCircular = Math.sqrt(G * mEnc / r)
      
      const velocity = new THREE.Vector3(
        -vCircular * Math.sin(theta) + (Math.random() - 0.5) * 0.2,
        vCircular * Math.cos(theta) + (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.1
      )
      
      // Color based on position (darker with reddish tint)
      const armDistance = Math.abs((theta % (2 * Math.PI / nSpiralArms)) - Math.PI / nSpiralArms)
      const color = armDistance < 0.3 
        ? new THREE.Color(0.1, 0.08, 0.08)  // Very dark young stars
        : new THREE.Color(0.3, 0.15, 0.1)   // Dark reddish older stars
      
      this.bodies.push({
        position,
        velocity,
        mass: (0.3 + Math.random() * 0.9) * diskMass / nDisk,
        color,
        type: 'disk'
      })
    }
    
    // Dark matter halo
    for (let i = 0; i < nHalo; i++) {
      const r = galaxyRadius * (0.5 + Math.random() * 1.5)
      const theta = Math.random() * 2 * Math.PI
      const phi = Math.acos(1 - 2 * Math.random())
      
      const position = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )
      
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      )
      
      this.bodies.push({
        position,
        velocity,
        mass: haloMass / nHalo,
        color: new THREE.Color(0.05, 0.03, 0.03),
        type: 'halo'
      })
    }
  }
  
  private gaussianRandom(): number {
    let u = 0, v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  }
  
  private getEnclosedMass(r: number): number {
    const { centralMass, diskMass, haloMass, galaxyRadius, bulgeRadius } = this.params
    
    // Central black hole contribution
    let mass = centralMass
    
    // Bulge contribution (Hernquist profile)
    const bulgeContribution = diskMass * 0.2 * Math.pow(r / (r + bulgeRadius), 2)
    mass += bulgeContribution
    
    // Disk contribution (exponential profile)
    const scaleLength = galaxyRadius / 3
    const diskContribution = diskMass * 0.8 * (1 - Math.exp(-r / scaleLength) * (1 + r / scaleLength))
    mass += diskContribution
    
    // Dark matter halo contribution (NFW profile)
    const rs = galaxyRadius / 5  // scale radius
    const haloContribution = haloMass * (Math.log(1 + r / rs) - (r / rs) / (1 + r / rs))
    mass += haloContribution
    
    return mass
  }
  
  calculateForces(): THREE.Vector3[] {
    const forces: THREE.Vector3[] = []
    const { G, softening } = this.params
    const n = this.bodies.length
    
    // Initialize forces
    for (let i = 0; i < n; i++) {
      forces.push(new THREE.Vector3(0, 0, 0))
    }
    
    if (this.useBarnesHut) {
      // Use Barnes-Hut algorithm for O(N log N) complexity
      this.barnesHutTree.buildTree(this.bodies)
      
      for (let i = 0; i < n; i++) {
        forces[i] = this.barnesHutTree.calculateForce(this.bodies[i], G, softening)
      }
    } else {
      // Direct N-body calculation with sampling for small systems
      const maxInteractions = 2000
      const step = Math.max(1, Math.floor(n * n / maxInteractions))
      
      for (let i = 0; i < n; i += step) {
        for (let j = i + step; j < n; j += step) {
          const dr = new THREE.Vector3().subVectors(
            this.bodies[j].position,
            this.bodies[i].position
          )
          
          const r2 = dr.lengthSq() + softening * softening
          const r = Math.sqrt(r2)
          const F = (G * this.bodies[i].mass * this.bodies[j].mass) / (r2 * r)
          
          const force = dr.multiplyScalar(F)
          forces[i].add(force)
          forces[j].sub(force)
        }
      }
    }
    
    return forces
  }
  
  update() {
    const { dt } = this.params
    const forces = this.calculateForces()
    
    // Update velocities and positions (leapfrog integration)
    for (let i = 0; i < this.bodies.length; i++) {
      const acceleration = forces[i].divideScalar(this.bodies[i].mass)
      
      // Update velocity (half step)
      this.bodies[i].velocity.add(
        acceleration.multiplyScalar(dt * 0.5)
      )
      
      // Update position
      this.bodies[i].position.add(
        this.bodies[i].velocity.clone().multiplyScalar(dt)
      )
    }
    
    // Second half of velocity update
    const newForces = this.calculateForces()
    for (let i = 0; i < this.bodies.length; i++) {
      const acceleration = newForces[i].divideScalar(this.bodies[i].mass)
      this.bodies[i].velocity.add(
        acceleration.multiplyScalar(dt * 0.5)
      )
    }
  }
  
  getEnergy(): { kinetic: number; potential: number; total: number } {
    const { G, softening } = this.params
    let kinetic = 0
    let potential = 0
    
    // Kinetic energy
    for (const body of this.bodies) {
      kinetic += 0.5 * body.mass * body.velocity.lengthSq()
    }
    
    // Potential energy (sample for performance)
    const step = Math.max(1, Math.floor(this.bodies.length / 100))
    for (let i = 0; i < this.bodies.length; i += step) {
      for (let j = i + step; j < this.bodies.length; j += step) {
        const dr = new THREE.Vector3().subVectors(
          this.bodies[j].position,
          this.bodies[i].position
        )
        const r = Math.sqrt(dr.lengthSq() + softening * softening)
        potential -= G * this.bodies[i].mass * this.bodies[j].mass / r
      }
    }
    
    // Scale up estimate
    const scaleFactor = (this.bodies.length / 100) ** 2
    potential *= scaleFactor
    
    return {
      kinetic,
      potential,
      total: kinetic + potential
    }
  }
}