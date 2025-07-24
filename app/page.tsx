'use client'

import { useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Controls from '@/components/Controls'
import { GalaxyParams, GalaxySimulation } from '@/lib/galaxyPhysics'
import { AWSGalaxyClient } from '@/lib/awsGalaxyClient'

// Dynamic import to avoid SSR issues with Three.js
const GalaxyVisualization = dynamic(
  () => import('@/components/GalaxyVisualization'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="text-black text-center">
          <div className="mb-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
          <p className="text-xl">Initializing Galaxy...</p>
          <p className="text-sm text-gray-600 mt-2">Creating 10,000 stellar bodies</p>
        </div>
      </div>
    )
  }
)

// Dynamic import for ParameterControls
const ParameterControls = dynamic(
  () => import('@/components/ParameterControls').then(mod => mod.ParameterControls),
  { ssr: false }
)

export default function Home() {
  const [isPaused, setIsPaused] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showParams, setShowParams] = useState(true)
  const [galaxyParams, setGalaxyParams] = useState<Partial<GalaxyParams>>({})
  const [currentSimulation, setCurrentSimulation] = useState<GalaxySimulation | null>(null)
  const [useAWS, setUseAWS] = useState(false)
  
  const awsClient = useMemo(() => new AWSGalaxyClient(), [])
  
  const handleParamChange = useCallback((newParams: Partial<GalaxyParams>) => {
    setGalaxyParams(prev => ({ ...prev, ...newParams }))
  }, [])
  
  const handleAWSToggle = useCallback((enabled: boolean) => {
    setUseAWS(enabled)
    if (enabled && galaxyParams.nBodies && galaxyParams.nBodies < 50000) {
      // Automatically increase body count when AWS is enabled
      setGalaxyParams(prev => ({ ...prev, nBodies: 100000 }))
    }
  }, [galaxyParams.nBodies])
  
  const awsCost = useMemo(() => {
    if (!useAWS || !galaxyParams.nBodies) return 0
    return awsClient.estimateCost(galaxyParams.nBodies, 1)
  }, [useAWS, galaxyParams.nBodies, awsClient])
  
  const handleReset = useCallback(() => {
    setGalaxyParams({})
  }, [])
  
  const handleSimulationUpdate = useCallback((simulation: GalaxySimulation) => {
    setCurrentSimulation(simulation)
  }, [])
  
  return (
    <main className="relative w-full h-screen overflow-hidden">
      <GalaxyVisualization 
        isPaused={isPaused} 
        showStats={showStats}
        galaxyParams={galaxyParams}
        onSimulationUpdate={handleSimulationUpdate}
        useAWS={useAWS}
        maxBodies={galaxyParams.nBodies}
      />
      <Controls 
        onPauseToggle={setIsPaused}
        onStatsToggle={setShowStats}
      />
      
      {showParams && currentSimulation && (
        <ParameterControls
          params={currentSimulation.params}
          onParamChange={handleParamChange}
          onReset={handleReset}
          useAWS={useAWS}
          onAWSToggle={awsClient.isAWSAvailable() ? handleAWSToggle : undefined}
          awsCost={awsCost}
        />
      )}
      
      <button
        onClick={() => setShowParams(!showParams)}
        className="absolute top-4 left-4 bg-black/10 hover:bg-black/20 text-black border border-gray-300 px-4 py-2 rounded transition-colors"
      >
        {showParams ? 'Hide' : 'Show'} Parameters
      </button>
      
      <div className="absolute bottom-4 right-4 text-black/70 text-xs">
        <p>Galaxy Simulator - {currentSimulation ? currentSimulation.params.nBodies.toLocaleString() : '10,000'} Bodies</p>
        <p>N-body gravitational simulation with realistic physics</p>
      </div>
    </main>
  )
}