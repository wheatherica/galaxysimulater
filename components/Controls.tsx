'use client'

import { useState } from 'react'

interface ControlsProps {
  onPauseToggle: (paused: boolean) => void
  onStatsToggle: (show: boolean) => void
}

export default function Controls({ onPauseToggle, onStatsToggle }: ControlsProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  const handlePauseToggle = () => {
    const newPaused = !isPaused
    setIsPaused(newPaused)
    onPauseToggle(newPaused)
  }
  
  const handleStatsToggle = () => {
    const newShowStats = !showStats
    setShowStats(newShowStats)
    onStatsToggle(newShowStats)
  }
  
  return (
    <div className={`absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-300 shadow-lg p-4 text-black transition-all duration-300 ${isCollapsed ? 'w-12' : 'w-64'}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className={`text-lg font-bold ${isCollapsed ? 'hidden' : ''}`}>Galaxy Controls</h2>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-600 hover:text-black transition-colors"
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>
      
      {!isCollapsed && (
        <>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Simulation</p>
              <button
                onClick={handlePauseToggle}
                className={`w-full py-2 px-4 rounded transition-colors ${
                  isPaused 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 mb-2">Display</p>
              <button
                onClick={handleStatsToggle}
                className={`w-full py-2 px-4 rounded transition-colors ${
                  showStats 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {showStats ? 'Hide Stats' : 'Show Stats'}
              </button>
            </div>
            
            <div className="pt-4 border-t border-gray-300">
              <h3 className="text-sm font-semibold mb-2">Galaxy Parameters</h3>
              <ul className="text-xs space-y-1 text-gray-600">
                <li>Bodies: 10,000</li>
                <li>Galaxy Radius: 50 kpc</li>
                <li>Bulge: 15% (1,500 stars)</li>
                <li>Disk: 75% (7,500 stars)</li>
                <li>Dark Matter: 10% (1,000)</li>
                <li>Spiral Arms: 2</li>
              </ul>
            </div>
            
            <div className="pt-4 border-t border-gray-300">
              <h3 className="text-sm font-semibold mb-2">Controls</h3>
              <ul className="text-xs space-y-1 text-gray-600">
                <li>🖱️ Left click + drag: Rotate</li>
                <li>🖱️ Right click + drag: Pan</li>
                <li>🖱️ Scroll: Zoom</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}