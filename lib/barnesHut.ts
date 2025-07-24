import * as THREE from 'three'
import { Body } from './galaxyPhysics'

interface OctreeNode {
  centerOfMass: THREE.Vector3
  totalMass: number
  bounds: {
    min: THREE.Vector3
    max: THREE.Vector3
    center: THREE.Vector3
    size: number
  }
  children: OctreeNode[] | null
  body: Body | null
  isLeaf: boolean
}

export class BarnesHutTree {
  root: OctreeNode | null = null
  theta: number = 0.5  // Barnes-Hut opening angle parameter
  
  constructor(theta: number = 0.5) {
    this.theta = theta
  }
  
  buildTree(bodies: Body[]) {
    if (bodies.length === 0) return
    
    // Find bounds
    const min = new THREE.Vector3(Infinity, Infinity, Infinity)
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
    
    bodies.forEach(body => {
      min.min(body.position)
      max.max(body.position)
    })
    
    // Make cubic bounds
    const size = Math.max(max.x - min.x, max.y - min.y, max.z - min.z)
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5)
    
    this.root = {
      centerOfMass: new THREE.Vector3(),
      totalMass: 0,
      bounds: {
        min: new THREE.Vector3(center.x - size/2, center.y - size/2, center.z - size/2),
        max: new THREE.Vector3(center.x + size/2, center.y + size/2, center.z + size/2),
        center,
        size
      },
      children: null,
      body: null,
      isLeaf: true
    }
    
    // Insert all bodies
    bodies.forEach(body => this.insert(this.root!, body))
  }
  
  private insert(node: OctreeNode, body: Body) {
    // If node doesn't contain a body, add it
    if (node.body === null && node.isLeaf) {
      node.body = body
      node.centerOfMass = body.position.clone()
      node.totalMass = body.mass
      return
    }
    
    // If node is a leaf with a body, subdivide
    if (node.isLeaf && node.body !== null) {
      const existingBody = node.body
      node.body = null
      node.isLeaf = false
      node.children = this.createChildren(node)
      
      // Reinsert existing body
      this.insertIntoChildren(node, existingBody)
    }
    
    // Insert new body into children
    if (!node.isLeaf && node.children) {
      this.insertIntoChildren(node, body)
    }
    
    // Update center of mass
    const newTotalMass = node.totalMass + body.mass
    node.centerOfMass.multiplyScalar(node.totalMass)
    node.centerOfMass.add(body.position.clone().multiplyScalar(body.mass))
    node.centerOfMass.divideScalar(newTotalMass)
    node.totalMass = newTotalMass
  }
  
  private createChildren(parent: OctreeNode): OctreeNode[] {
    const children: OctreeNode[] = []
    const { center, size } = parent.bounds
    const halfSize = size / 2
    const quarterSize = size / 4
    
    // Create 8 octants
    for (let i = 0; i < 8; i++) {
      const x = i & 1 ? 1 : -1
      const y = i & 2 ? 1 : -1
      const z = i & 4 ? 1 : -1
      
      const childCenter = new THREE.Vector3(
        center.x + x * quarterSize,
        center.y + y * quarterSize,
        center.z + z * quarterSize
      )
      
      children.push({
        centerOfMass: new THREE.Vector3(),
        totalMass: 0,
        bounds: {
          min: new THREE.Vector3(
            childCenter.x - quarterSize,
            childCenter.y - quarterSize,
            childCenter.z - quarterSize
          ),
          max: new THREE.Vector3(
            childCenter.x + quarterSize,
            childCenter.y + quarterSize,
            childCenter.z + quarterSize
          ),
          center: childCenter,
          size: halfSize
        },
        children: null,
        body: null,
        isLeaf: true
      })
    }
    
    return children
  }
  
  private insertIntoChildren(node: OctreeNode, body: Body) {
    if (!node.children) return
    
    // Find which octant the body belongs to
    const index = this.getOctantIndex(node.bounds.center, body.position)
    if (index >= 0 && index < 8) {
      this.insert(node.children[index], body)
    }
  }
  
  private getOctantIndex(center: THREE.Vector3, position: THREE.Vector3): number {
    let index = 0
    if (position.x > center.x) index |= 1
    if (position.y > center.y) index |= 2
    if (position.z > center.z) index |= 4
    return index
  }
  
  calculateForce(body: Body, G: number, softening: number): THREE.Vector3 {
    const force = new THREE.Vector3()
    if (!this.root) return force
    
    this.calculateForceRecursive(this.root, body, force, G, softening)
    return force
  }
  
  private calculateForceRecursive(
    node: OctreeNode, 
    body: Body, 
    force: THREE.Vector3, 
    G: number, 
    softening: number
  ) {
    if (node.totalMass === 0) return
    
    // Skip self-interaction
    if (node.body === body) return
    
    const dr = new THREE.Vector3().subVectors(node.centerOfMass, body.position)
    const distance = dr.length()
    
    // Use Barnes-Hut criterion
    const ratio = node.bounds.size / distance
    
    if (node.isLeaf || ratio < this.theta) {
      // Treat as single body
      const r2 = distance * distance + softening * softening
      const r = Math.sqrt(r2)
      const F = (G * body.mass * node.totalMass) / (r2 * r)
      force.add(dr.normalize().multiplyScalar(F))
    } else if (node.children) {
      // Recurse into children
      node.children.forEach(child => {
        this.calculateForceRecursive(child, body, force, G, softening)
      })
    }
  }
}