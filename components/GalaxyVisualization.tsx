'use client'

import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import * as THREE from 'three'
import { GalaxySimulation } from '@/lib/galaxyPhysics'
import { AWSGalaxyClient, AWSSimulationState } from '@/lib/awsGalaxyClient'

interface GalaxyPointsProps {
  simulation: GalaxySimulation
  isPaused: boolean
  onSimulationUpdate?: (simulation: GalaxySimulation) => void
  awsState?: AWSSimulationState | null
  awsClient?: AWSGalaxyClient
  useAWSMode?: boolean
  effectiveParams?: any
}

interface PerformanceSettings {
  maxParticles: number
  updateFrequency: number
  lodDistance: number
}

function GalaxyPoints({ simulation, isPaused, onSimulationUpdate, awsState, awsClient, useAWSMode, effectiveParams }: GalaxyPointsProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const { camera } = useThree()
  const [frameCount, setFrameCount] = useState(0)
  const [performance, setPerformance] = useState<PerformanceSettings>({
    maxParticles: simulation.bodies.length,
    updateFrequency: 1,
    lodDistance: 100
  })

  // Create geometry and attributes with LOD (AWS or local)
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    
    // Use AWS state if available, otherwise local simulation
    const sourceData = useAWSMode && awsState ? awsState : null
    const bodies = sourceData ? awsClient?.convertAWSStateToBodies(sourceData) || [] : simulation.bodies
    
    const maxBodies = Math.min(performance.maxParticles, bodies.length)
    const positions = new Float32Array(maxBodies * 3)
    const colors = new Float32Array(maxBodies * 3)
    const sizes = new Float32Array(maxBodies)
    
    // Use only a subset of bodies for better performance
    const step = Math.max(1, Math.floor(bodies.length / maxBodies))
    let index = 0
    
    for (let i = 0; i < bodies.length && index < maxBodies; i += step) {
      const body = bodies[i]
      
      if (sourceData) {
        // AWS data format
        positions[index * 3] = sourceData.positions[i][0]
        positions[index * 3 + 1] = sourceData.positions[i][1]
        positions[index * 3 + 2] = sourceData.positions[i][2]
        
        colors[index * 3] = sourceData.colors[i][0]
        colors[index * 3 + 1] = sourceData.colors[i][1]
        colors[index * 3 + 2] = sourceData.colors[i][2]
      } else {
        // Local simulation format
        positions[index * 3] = body.position.x
        positions[index * 3 + 1] = body.position.y
        positions[index * 3 + 2] = body.position.z
        
        colors[index * 3] = body.color.r
        colors[index * 3 + 1] = body.color.g
        colors[index * 3 + 2] = body.color.b
      }
      
      // Size based on type
      if (body.type === 'halo') {
        sizes[index] = 0.3
      } else {
        sizes[index] = Math.min(1.5, 0.3 + (body.mass || 1) * 0.3)
      }
      index++
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    
    return geo
  }, [simulation, performance.maxParticles, useAWSMode, awsState, awsClient])

  // Update positions with performance optimization
  useFrame((state, delta) => {
    if (!pointsRef.current || isPaused) return
    
    setFrameCount(prev => prev + 1)
    
    // Adaptive performance: reduce update frequency based on frame rate
    const targetFPS = 30
    const currentFPS = 1 / delta
    
    if (currentFPS < targetFPS && frameCount % 2 === 0) {
      return
    }
    
    // Update simulation based on mode (AWS or local)
    if (frameCount % performance.updateFrequency === 0) {
      if (useAWSMode && awsClient && effectiveParams) {
        // Update AWS simulation every few frames
        if (frameCount % (performance.updateFrequency * 10) === 0) {
          awsClient.updateSimulation(effectiveParams, performance.updateFrequency)
            .then(response => {
              if (response.success && onSimulationUpdate) {
                const bodies = awsClient.convertAWSStateToBodies(response.state)
                const mockSimulation = { ...simulation, bodies }
                onSimulationUpdate(mockSimulation as any)
              }
            })
            .catch(error => {
              console.warn('AWS update failed, continuing with local simulation:', error)
            })
        }
      } else {
        simulation.update()
      }
    }
    
    // Update visible particles
    const positions = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const sourceData = useAWSMode && awsState ? awsState : null
    const bodies = sourceData ? awsClient?.convertAWSStateToBodies(sourceData) || [] : simulation.bodies
    const maxBodies = Math.min(performance.maxParticles, bodies.length)
    const step = Math.max(1, Math.floor(bodies.length / maxBodies))
    let index = 0
    
    for (let i = 0; i < bodies.length && index < maxBodies; i += step) {
      if (sourceData) {
        positions.setXYZ(index, sourceData.positions[i][0], sourceData.positions[i][1], sourceData.positions[i][2])
      } else {
        const body = bodies[i]
        positions.setXYZ(index, body.position.x, body.position.y, body.position.z)
      }
      index++
    }
    
    positions.needsUpdate = true
    
    // Slower camera rotation for better performance
    const time = state.clock.getElapsedTime()
    camera.position.x = Math.cos(time * 0.05) * 100
    camera.position.z = Math.sin(time * 0.05) * 100
    camera.lookAt(0, 0, 0)
    
    // Adaptive performance adjustment
    if (frameCount % 60 === 0) {
      if (currentFPS < 20 && performance.maxParticles > 2000) {
        setPerformance(prev => ({
          ...prev,
          maxParticles: Math.max(2000, prev.maxParticles * 0.8),
          updateFrequency: Math.min(4, prev.updateFrequency + 1)
        }))
      } else if (currentFPS > 45 && performance.maxParticles < simulation.bodies.length) {
        setPerformance(prev => ({
          ...prev,
          maxParticles: Math.min(simulation.bodies.length, prev.maxParticles * 1.2),
          updateFrequency: Math.max(1, prev.updateFrequency - 1)
        }))
      }
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        vertexShader={`
          attribute float size;
          varying vec3 vColor;
          
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (200.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          
          void main() {
            float r = 0.0, delta = 0.0, alpha = 1.0;
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            r = dot(cxy, cxy);
            
            if (r > 1.0) {
              discard;
            }
            
            // Soft edges
            delta = fwidth(r);
            alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);
            
            // Glow effect
            vec3 glowColor = vColor * 1.5;
            vec3 finalColor = mix(glowColor, vColor, r);
            
            gl_FragColor = vec4(finalColor, alpha);
          }
        `}
        vertexColors
        transparent
        blending={THREE.NormalBlending}
        depthWrite={false}
      />
    </points>
  )
}

interface GalaxyVisualizationProps {
  isPaused: boolean
  showStats: boolean
  galaxyParams?: Partial<import('@/lib/galaxyPhysics').GalaxyParams>
  onSimulationUpdate?: (simulation: GalaxySimulation) => void
  useAWS?: boolean
  maxBodies?: number
}

export default function GalaxyVisualization({ isPaused, showStats, galaxyParams, onSimulationUpdate, useAWS = false, maxBodies }: GalaxyVisualizationProps) {
  const [awsClient] = useState(() => new AWSGalaxyClient())
  const [awsState, setAWSState] = useState<AWSSimulationState | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [useAWSMode, setUseAWSMode] = useState(useAWS && awsClient.isAWSAvailable())
  
  // Determine body count based on AWS availability
  const effectiveParams = useMemo(() => {
    const params = { ...galaxyParams }
    if (useAWSMode && maxBodies && maxBodies > 50000) {
      params.nBodies = maxBodies
    }
    return params
  }, [galaxyParams, useAWSMode, maxBodies])
  
  const simulation = useMemo(() => {
    if (useAWSMode) {
      // Create a minimal local simulation for fallback
      return new GalaxySimulation({ ...effectiveParams, nBodies: 1000 })
    }
    return new GalaxySimulation(effectiveParams)
  }, [effectiveParams, useAWSMode])

  // Initialize AWS simulation
  useEffect(() => {
    if (useAWSMode && !awsState && !isInitializing && awsClient.isAWSAvailable()) {
      setIsInitializing(true)
      awsClient.initializeSimulation(effectiveParams as any)
        .then(response => {
          if (response.success) {
            setAWSState(response.state)
          } else {
            console.error('AWS initialization failed, falling back to local')
            setUseAWSMode(false)
          }
        })
        .catch(error => {
          console.error('AWS initialization error, falling back to local:', error)
          setUseAWSMode(false)
        })
        .finally(() => {
          setIsInitializing(false)
        })
    }
  }, [useAWSMode, awsState, effectiveParams, isInitializing, awsClient])
  
  // Report simulation updates
  useEffect(() => {
    if (onSimulationUpdate) {
      onSimulationUpdate(simulation)
    }
  }, [simulation, onSimulationUpdate])
  
  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{ position: [0, 30, 100], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={0.1} />
        
        <GalaxyPoints 
          simulation={simulation} 
          isPaused={isPaused} 
          onSimulationUpdate={onSimulationUpdate}
          awsState={awsState}
          awsClient={awsClient}
          useAWSMode={useAWSMode}
          effectiveParams={effectiveParams}
        />
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={10}
          maxDistance={500}
        />
        
        {showStats && <Stats />}
      </Canvas>
    </div>
  )
}