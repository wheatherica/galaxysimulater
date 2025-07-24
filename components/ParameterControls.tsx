import React from 'react'
import { GalaxyParams } from '../lib/galaxyPhysics'

interface ParameterControlsProps {
  params: GalaxyParams
  onParamChange: (params: Partial<GalaxyParams>) => void
  onReset: () => void
  useAWS?: boolean
  onAWSToggle?: (useAWS: boolean) => void
  awsCost?: number
}

export const ParameterControls: React.FC<ParameterControlsProps> = ({ params, onParamChange, onReset, useAWS = false, onAWSToggle, awsCost }) => {
  const handleChange = (key: keyof GalaxyParams, value: number) => {
    onParamChange({ [key]: value })
  }

  return (
    <div className="absolute top-4 right-4 bg-white/90 text-black border border-gray-300 shadow-lg p-6 rounded-lg w-80 max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Galaxy Parameters</h2>
      
      <div className="space-y-4">
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">System Properties</h3>
          
          {onAWSToggle && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-blue-900">AWS High-Performance Mode</label>
                <input
                  type="checkbox"
                  checked={useAWS}
                  onChange={(e) => onAWSToggle(e.target.checked)}
                  className="ml-2"
                />
              </div>
              <p className="text-xs text-blue-700 mb-1">
                {useAWS ? '🚀 AWS Demo Mode: Up to 500,000 stars (simulated)' : 'Local simulation (up to 50,000 stars)'}
              </p>
              {awsCost && useAWS && (
                <p className="text-xs text-blue-600">
                  Estimated cost: ${awsCost.toFixed(4)}/hour
                </p>
              )}
            </div>
          )}
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Number of Bodies: {params.nBodies.toLocaleString()}</label>
            <input
              type="range"
              min="1000"
              max={useAWS ? "500000" : "50000"}
              step={useAWS ? "10000" : "1000"}
              value={params.nBodies}
              onChange={(e) => handleChange('nBodies', Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Time Step (Myr): {params.dt.toFixed(2)}</label>
            <input
              type="range"
              min="0.01"
              max="1"
              step="0.01"
              value={params.dt}
              onChange={(e) => handleChange('dt', Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Galaxy Structure</h3>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Galaxy Radius (kpc): {params.galaxyRadius}</label>
            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={params.galaxyRadius}
              onChange={(e) => handleChange('galaxyRadius', Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Bulge Radius (kpc): {params.bulgeRadius}</label>
            <input
              type="range"
              min="5"
              max="20"
              step="1"
              value={params.bulgeRadius}
              onChange={(e) => handleChange('bulgeRadius', Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Disk Height (kpc): {params.diskHeight.toFixed(1)}</label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={params.diskHeight}
              onChange={(e) => handleChange('diskHeight', Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Spiral Arms: {params.nSpiralArms}</label>
            <input
              type="range"
              min="0"
              max="6"
              step="1"
              value={params.nSpiralArms}
              onChange={(e) => handleChange('nSpiralArms', Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Spiral Tightness: {params.spiralTightness.toFixed(2)}</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={params.spiralTightness}
              onChange={(e) => handleChange('spiralTightness', Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Mass Distribution (M☉)</h3>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Central Black Hole: {(params.centralMass / 1e6).toFixed(1)}M</label>
            <input
              type="range"
              min="1e6"
              max="1e7"
              step="1e5"
              value={params.centralMass}
              onChange={(e) => handleChange('centralMass', Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Disk Mass: {(params.diskMass / 1e10).toFixed(1)}×10¹⁰</label>
            <input
              type="range"
              min="1e10"
              max="2e11"
              step="1e10"
              value={params.diskMass}
              onChange={(e) => handleChange('diskMass', Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Dark Matter Halo: {(params.haloMass / 1e12).toFixed(1)}×10¹²</label>
            <input
              type="range"
              min="1e11"
              max="5e12"
              step="1e11"
              value={params.haloMass}
              onChange={(e) => handleChange('haloMass', Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Physics</h3>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Rotation Speed (km/s): {params.rotationSpeed}</label>
            <input
              type="range"
              min="100"
              max="300"
              step="10"
              value={params.rotationSpeed}
              onChange={(e) => handleChange('rotationSpeed', Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="mb-3">
            <label className="text-sm text-gray-700">Softening (kpc): {params.softening.toFixed(3)}</label>
            <input
              type="range"
              min="0.001"
              max="0.1"
              step="0.001"
              value={params.softening}
              onChange={(e) => handleChange('softening', Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <button
          onClick={onReset}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}