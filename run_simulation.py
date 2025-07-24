#!/usr/bin/env python3
"""
Galaxy Simulation Runner
Run n=10,000 body galaxy simulation with various options
"""

import sys
import argparse
from galaxy_simulation import Galaxy
from galaxy_simulation_optimized import GalaxyOptimized

def main():
    parser = argparse.ArgumentParser(description='Run galaxy simulation with 10,000 bodies')
    parser.add_argument('--optimized', action='store_true', 
                       help='Use Barnes-Hut optimized version')
    parser.add_argument('--no-viz', action='store_true',
                       help='Run without visualization')
    parser.add_argument('--steps', type=int, default=1000,
                       help='Number of simulation steps (default: 1000)')
    parser.add_argument('--save-animation', action='store_true',
                       help='Save animation as GIF')
    parser.add_argument('--benchmark', action='store_true',
                       help='Run performance benchmark')
    
    args = parser.parse_args()
    
    print("="*60)
    print("Galaxy Simulation - N=10,000 Bodies")
    print("="*60)
    
    if args.optimized:
        print("\nUsing optimized Barnes-Hut algorithm...")
        galaxy = GalaxyOptimized(n_bodies=10000)
        
        if args.benchmark:
            galaxy.benchmark_performance()
        
        if args.no_viz:
            # Run without visualization
            import time
            start = time.time()
            initial_stats = galaxy.get_statistics()
            print(f"\nInitial state:")
            print(f"  Total energy: {initial_stats['total_energy']:.2f}")
            print(f"  Virial ratio: {initial_stats['virial_ratio']:.3f}")
            
            for step in range(args.steps):
                galaxy.update(use_barnes_hut=True)
                
                if step % 100 == 0:
                    stats = galaxy.get_statistics()
                    energy_drift = abs((stats['total_energy'] - initial_stats['total_energy']) / 
                                     initial_stats['total_energy'])
                    print(f"Step {step:4d}: Energy drift = {energy_drift:.6f}, "
                          f"Virial = {stats['virial_ratio']:.3f}")
            
            elapsed = time.time() - start
            print(f"\nSimulation completed in {elapsed:.2f} seconds")
            print(f"Average: {elapsed/args.steps*1000:.2f} ms per step")
        else:
            galaxy.visualize_3d_advanced(save_animation=args.save_animation)
    
    else:
        print("\nUsing basic simulation...")
        galaxy = Galaxy(n_bodies=10000)
        galaxy.run_simulation(steps=args.steps, visualize=not args.no_viz)
    
    print("\nSimulation complete!")

if __name__ == "__main__":
    main()