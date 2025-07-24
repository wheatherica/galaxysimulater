import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from mpl_toolkits.mplot3d import Axes3D
import time
from dataclasses import dataclass
from typing import Optional, List

@dataclass
class OctreeNode:
    """Node for Barnes-Hut octree"""
    center: np.ndarray
    size: float
    total_mass: float = 0.0
    center_of_mass: np.ndarray = None
    body_index: Optional[int] = None
    children: Optional[List['OctreeNode']] = None
    
    def __post_init__(self):
        if self.center_of_mass is None:
            self.center_of_mass = np.zeros(3)

class GalaxyOptimized:
    def __init__(self, n_bodies=10000):
        self.n_bodies = n_bodies
        self.G = 1.0  # Gravitational constant (normalized)
        self.softening = 0.01  # Softening parameter
        self.dt = 0.001  # Time step
        self.theta = 0.5  # Barnes-Hut opening angle
        
        # Galaxy parameters
        self.galaxy_radius = 50.0
        self.disk_height = 2.0
        self.bulge_radius = 10.0
        self.rotation_speed = 0.5
        self.spiral_tightness = 0.3
        self.n_spiral_arms = 2
        
        # Dark matter parameters
        self.dark_matter_fraction = 0.85  # 85% of total mass
        self.halo_scale_radius = 20.0
        
        # Initialize arrays
        self.positions = np.zeros((n_bodies, 3))
        self.velocities = np.zeros((n_bodies, 3))
        self.masses = np.zeros(n_bodies)
        self.colors = np.zeros((n_bodies, 3))
        self.types = np.zeros(n_bodies, dtype=int)  # 0=bulge, 1=disk, 2=halo
        
        self._initialize_galaxy()
        
    def _initialize_galaxy(self):
        """Initialize galaxy with realistic structure"""
        # Component distribution
        n_bulge = int(0.15 * self.n_bodies)
        n_disk = int(0.75 * self.n_bodies)
        n_halo = self.n_bodies - n_bulge - n_disk
        
        idx = 0
        
        # Central bulge (Hernquist profile)
        for i in range(n_bulge):
            # Hernquist profile for realistic bulge
            u = np.random.random()
            r = self.bulge_radius * u / (1 - u)**2
            
            theta = np.random.uniform(0, 2*np.pi)
            phi = np.arccos(1 - 2*np.random.random())
            
            self.positions[idx] = [
                r * np.sin(phi) * np.cos(theta),
                r * np.sin(phi) * np.sin(theta),
                r * np.cos(phi) * 0.6  # Slightly flattened
            ]
            
            self.masses[idx] = np.random.lognormal(0.0, 0.3) * 0.8
            self.colors[idx] = [1.0, 0.85, 0.7]  # Old stellar population
            self.types[idx] = 0
            
            # Velocity dispersion
            sigma = np.sqrt(self.G * self.bulge_radius * 5) / (r + 0.1)
            self.velocities[idx] = np.random.normal(0, sigma, 3)
            idx += 1
        
        # Galactic disk (exponential profile with spiral arms)
        for i in range(n_disk):
            # Exponential radial distribution
            scale_length = self.galaxy_radius / 3
            r = -scale_length * np.log(1 - np.random.random() * (1 - np.exp(-self.galaxy_radius/scale_length)))
            
            # Spiral arm position
            arm_index = i % self.n_spiral_arms
            base_angle = 2 * np.pi * arm_index / self.n_spiral_arms
            
            # Logarithmic spiral
            theta = base_angle + np.log(r/self.bulge_radius + 1) / self.spiral_tightness
            
            # Add dispersion around arms
            theta += np.random.normal(0, 0.15 * np.exp(-r/20))
            r += np.random.normal(0, 1.5)
            
            # Vertical structure (sech^2 profile)
            z_scale = self.disk_height * (1 + r/self.galaxy_radius)
            z = z_scale * np.arctanh(np.random.uniform(-0.99, 0.99))
            
            self.positions[idx] = [r * np.cos(theta), r * np.sin(theta), z]
            
            # Star formation regions in spiral arms
            arm_phase = (theta - base_angle) % (2*np.pi/self.n_spiral_arms)
            in_arm = arm_phase < 0.5
            
            if in_arm and r < 30:
                self.masses[idx] = np.random.lognormal(-0.5, 0.5) * 0.5
                self.colors[idx] = [0.7, 0.85, 1.0]  # Young blue stars
            else:
                self.masses[idx] = np.random.lognormal(-0.2, 0.4) * 0.7
                self.colors[idx] = [1.0, 0.8, 0.6]  # Older stars
            
            self.types[idx] = 1
            
            # Rotation curve (flat rotation curve due to dark matter)
            v_rot = self.rotation_speed * np.sqrt(self.G * self.galaxy_radius * 10 / (r + 1))
            v_rot = min(v_rot, 220)  # Cap at realistic galaxy rotation speed
            
            # Add velocity dispersion
            sigma_r = 30 * np.exp(-r/20)
            sigma_z = 20 * np.exp(-r/25)
            
            self.velocities[idx] = [
                -v_rot * np.sin(theta) + np.random.normal(0, sigma_r),
                v_rot * np.cos(theta) + np.random.normal(0, sigma_r),
                np.random.normal(0, sigma_z)
            ]
            idx += 1
        
        # Dark matter halo (NFW profile)
        for i in range(n_halo):
            # NFW profile
            c = 10  # Concentration parameter
            f = lambda x: np.log(1+c*x) - c*x/(1+c*x)
            x = np.random.random() * f(1)
            
            # Solve for radius using Newton's method
            r_s = self.halo_scale_radius
            r = r_s
            for _ in range(10):
                r = r - (f(r/r_s) - x) / (c/(r_s*(1+r/r_s)) - c/(r_s*(1+r/r_s)**2))
            
            r *= r_s
            
            theta = np.random.uniform(0, 2*np.pi)
            phi = np.arccos(1 - 2*np.random.random())
            
            self.positions[idx] = [
                r * np.sin(phi) * np.cos(theta),
                r * np.sin(phi) * np.sin(theta),
                r * np.cos(phi)
            ]
            
            # Dark matter particles
            self.masses[idx] = 10.0  # Much more massive
            self.colors[idx] = [0.2, 0.2, 0.2]  # Nearly invisible
            self.types[idx] = 2
            
            # Velocity dispersion from Jeans equation
            sigma = np.sqrt(self.G * self.halo_scale_radius * 50 / (r + r_s))
            self.velocities[idx] = np.random.normal(0, sigma, 3)
            idx += 1
    
    def build_octree(self, indices=None):
        """Build Barnes-Hut octree"""
        if indices is None:
            indices = np.arange(self.n_bodies)
        
        if len(indices) == 0:
            return None
        
        # Find bounding box
        positions = self.positions[indices]
        min_pos = np.min(positions, axis=0)
        max_pos = np.max(positions, axis=0)
        center = (min_pos + max_pos) / 2
        size = np.max(max_pos - min_pos) * 1.1
        
        root = OctreeNode(center=center, size=size)
        
        for idx in indices:
            self._insert_body(root, idx)
        
        return root
    
    def _insert_body(self, node, body_idx):
        """Insert body into octree node"""
        if node.body_index is None and node.children is None:
            # Empty node - insert body
            node.body_index = body_idx
            node.total_mass = self.masses[body_idx]
            node.center_of_mass = self.positions[body_idx].copy()
        else:
            # Node contains body or is internal
            if node.children is None:
                # Create children and redistribute
                node.children = self._create_children(node)
                old_idx = node.body_index
                node.body_index = None
                
                # Reinsert old body
                child_idx = self._get_octant(node, self.positions[old_idx])
                self._insert_body(node.children[child_idx], old_idx)
            
            # Insert new body
            child_idx = self._get_octant(node, self.positions[body_idx])
            self._insert_body(node.children[child_idx], body_idx)
            
            # Update node mass and center of mass
            node.total_mass += self.masses[body_idx]
            node.center_of_mass = (node.center_of_mass * (node.total_mass - self.masses[body_idx]) + 
                                 self.positions[body_idx] * self.masses[body_idx]) / node.total_mass
    
    def _create_children(self, node):
        """Create 8 children for octree node"""
        children = []
        half_size = node.size / 2
        
        for i in range(8):
            offset = np.array([
                -half_size if i & 1 == 0 else half_size,
                -half_size if i & 2 == 0 else half_size,
                -half_size if i & 4 == 0 else half_size
            ])
            child_center = node.center + offset / 2
            children.append(OctreeNode(center=child_center, size=half_size))
        
        return children
    
    def _get_octant(self, node, position):
        """Get octant index for position"""
        idx = 0
        if position[0] > node.center[0]: idx |= 1
        if position[1] > node.center[1]: idx |= 2
        if position[2] > node.center[2]: idx |= 4
        return idx
    
    def calculate_force_on_body(self, body_idx, node):
        """Calculate force on body using Barnes-Hut algorithm"""
        if node is None or node.total_mass == 0:
            return np.zeros(3)
        
        dr = node.center_of_mass - self.positions[body_idx]
        r2 = np.sum(dr**2) + self.softening**2
        
        if node.body_index is not None and node.body_index != body_idx:
            # Leaf node with different body
            r = np.sqrt(r2)
            return self.G * self.masses[body_idx] * node.total_mass * dr / (r2 * r)
        elif node.children is not None:
            # Internal node
            r = np.sqrt(r2)
            if node.size / r < self.theta:
                # Use node as single body
                return self.G * self.masses[body_idx] * node.total_mass * dr / (r2 * r)
            else:
                # Recurse to children
                force = np.zeros(3)
                for child in node.children:
                    force += self.calculate_force_on_body(body_idx, child)
                return force
        
        return np.zeros(3)
    
    def calculate_forces_barnes_hut(self):
        """Calculate forces using Barnes-Hut algorithm"""
        # Build octree
        root = self.build_octree()
        
        # Calculate forces
        forces = np.zeros_like(self.positions)
        for i in range(self.n_bodies):
            forces[i] = self.calculate_force_on_body(i, root)
        
        return forces
    
    def update(self, use_barnes_hut=True):
        """Update simulation with choice of algorithm"""
        if use_barnes_hut:
            forces = self.calculate_forces_barnes_hut()
        else:
            # Fallback to direct summation
            forces = self.calculate_forces_direct()
        
        # Leapfrog integration
        accelerations = forces / self.masses[:, np.newaxis]
        self.velocities += accelerations * self.dt * 0.5
        self.positions += self.velocities * self.dt
        
        if use_barnes_hut:
            forces = self.calculate_forces_barnes_hut()
        else:
            forces = self.calculate_forces_direct()
        
        accelerations = forces / self.masses[:, np.newaxis]
        self.velocities += accelerations * self.dt * 0.5
    
    def calculate_forces_direct(self):
        """Direct O(N^2) force calculation for comparison"""
        forces = np.zeros_like(self.positions)
        
        for i in range(self.n_bodies):
            for j in range(i+1, self.n_bodies):
                dr = self.positions[j] - self.positions[i]
                r2 = np.sum(dr**2) + self.softening**2
                r = np.sqrt(r2)
                
                F = self.G * self.masses[i] * self.masses[j] * dr / (r2 * r)
                
                forces[i] += F
                forces[j] -= F
        
        return forces
    
    def get_statistics(self):
        """Calculate simulation statistics"""
        # Energy
        ke, pe, total_e = self.get_energy()
        
        # Angular momentum
        L = np.sum(self.masses[:, np.newaxis] * np.cross(self.positions, self.velocities))
        
        # Center of mass
        com = np.sum(self.masses[:, np.newaxis] * self.positions, axis=0) / np.sum(self.masses)
        
        # Virial ratio
        virial = 2 * ke / abs(pe)
        
        return {
            'kinetic_energy': ke,
            'potential_energy': pe,
            'total_energy': total_e,
            'angular_momentum': L,
            'center_of_mass': com,
            'virial_ratio': virial
        }
    
    def get_energy(self):
        """Calculate system energy"""
        # Kinetic energy
        kinetic = 0.5 * np.sum(self.masses * np.sum(self.velocities**2, axis=1))
        
        # Potential energy (approximate for Barnes-Hut)
        potential = 0
        for i in range(min(1000, self.n_bodies)):  # Sample for performance
            for j in range(i+1, min(1000, self.n_bodies)):
                dr = self.positions[j] - self.positions[i]
                r = np.sqrt(np.sum(dr**2) + self.softening**2)
                potential -= self.G * self.masses[i] * self.masses[j] / r
        
        # Scale up estimate
        if self.n_bodies > 1000:
            potential *= (self.n_bodies / 1000)**2
        
        return kinetic, potential, kinetic + potential
    
    def visualize_3d_advanced(self, save_animation=False):
        """Advanced 3D visualization with multiple views"""
        fig = plt.figure(figsize=(16, 12))
        
        # Main 3D view
        ax1 = fig.add_subplot(221, projection='3d')
        ax1.set_title('3D View')
        
        # Top view (X-Y)
        ax2 = fig.add_subplot(222)
        ax2.set_title('Top View (X-Y)')
        ax2.set_xlabel('X (kpc)')
        ax2.set_ylabel('Y (kpc)')
        
        # Side view (X-Z)
        ax3 = fig.add_subplot(223)
        ax3.set_title('Side View (X-Z)')
        ax3.set_xlabel('X (kpc)')
        ax3.set_ylabel('Z (kpc)')
        
        # Statistics
        ax4 = fig.add_subplot(224)
        ax4.axis('off')
        
        # Set limits
        limit = self.galaxy_radius * 1.5
        ax1.set_xlim(-limit, limit)
        ax1.set_ylim(-limit, limit)
        ax1.set_zlim(-limit/3, limit/3)
        ax2.set_xlim(-limit, limit)
        ax2.set_ylim(-limit, limit)
        ax3.set_xlim(-limit, limit)
        ax3.set_ylim(-limit/3, limit/3)
        
        # Separate by type for different visualization
        bulge_mask = self.types == 0
        disk_mask = self.types == 1
        halo_mask = self.types == 2
        
        # Initial plots
        scatter1_bulge = ax1.scatter([], [], [], c='gold', s=3, alpha=0.8)
        scatter1_disk = ax1.scatter([], [], [], c='cyan', s=1, alpha=0.6)
        
        scatter2_bulge, = ax2.plot([], [], 'o', c='gold', markersize=2, alpha=0.8)
        scatter2_disk, = ax2.plot([], [], 'o', c='cyan', markersize=1, alpha=0.6)
        
        scatter3_bulge, = ax3.plot([], [], 'o', c='gold', markersize=2, alpha=0.8)
        scatter3_disk, = ax3.plot([], [], 'o', c='cyan', markersize=1, alpha=0.6)
        
        # Statistics text
        stats_text = ax4.text(0.1, 0.9, '', transform=ax4.transAxes, 
                            fontsize=10, verticalalignment='top', 
                            fontfamily='monospace')
        
        def animate(frame):
            # Update simulation
            self.update(use_barnes_hut=True)
            
            # Update 3D view
            scatter1_bulge._offsets3d = (self.positions[bulge_mask, 0],
                                        self.positions[bulge_mask, 1],
                                        self.positions[bulge_mask, 2])
            scatter1_disk._offsets3d = (self.positions[disk_mask, 0],
                                      self.positions[disk_mask, 1],
                                      self.positions[disk_mask, 2])
            
            # Update 2D views
            scatter2_bulge.set_data(self.positions[bulge_mask, 0],
                                  self.positions[bulge_mask, 1])
            scatter2_disk.set_data(self.positions[disk_mask, 0],
                                 self.positions[disk_mask, 1])
            
            scatter3_bulge.set_data(self.positions[bulge_mask, 0],
                                  self.positions[bulge_mask, 2])
            scatter3_disk.set_data(self.positions[disk_mask, 0],
                                 self.positions[disk_mask, 2])
            
            # Update statistics every 10 frames
            if frame % 10 == 0:
                stats = self.get_statistics()
                stats_text.set_text(
                    f"Galaxy Simulation Statistics\n"
                    f"{'='*30}\n"
                    f"Time: {frame*self.dt:.2f} Gyr\n"
                    f"Bodies: {self.n_bodies:,}\n"
                    f"  Bulge: {np.sum(bulge_mask):,}\n"
                    f"  Disk:  {np.sum(disk_mask):,}\n"
                    f"  Halo:  {np.sum(halo_mask):,}\n\n"
                    f"Energy:\n"
                    f"  Kinetic:   {stats['kinetic_energy']:12.2f}\n"
                    f"  Potential: {stats['potential_energy']:12.2f}\n"
                    f"  Total:     {stats['total_energy']:12.2f}\n"
                    f"  Virial:    {stats['virial_ratio']:12.3f}\n\n"
                    f"Angular Momentum: {stats['angular_momentum']:.2f}\n"
                    f"COM: [{stats['center_of_mass'][0]:.1f}, "
                    f"{stats['center_of_mass'][1]:.1f}, "
                    f"{stats['center_of_mass'][2]:.1f}]"
                )
            
            # Rotate 3D view
            ax1.view_init(elev=20, azim=frame*0.3)
            
            return (scatter1_bulge, scatter1_disk, scatter2_bulge, scatter2_disk, 
                   scatter3_bulge, scatter3_disk, stats_text)
        
        anim = FuncAnimation(fig, animate, frames=2000, interval=50, blit=True)
        
        if save_animation:
            print("Saving animation... This may take a while.")
            anim.save('galaxy_simulation_advanced.gif', writer='pillow', fps=20)
        
        plt.tight_layout()
        plt.show()
    
    def benchmark_performance(self):
        """Compare performance of direct vs Barnes-Hut algorithms"""
        print("\nPerformance Benchmark")
        print("="*50)
        
        # Direct method (sample)
        if self.n_bodies <= 1000:
            start = time.time()
            for _ in range(10):
                self.calculate_forces_direct()
            direct_time = (time.time() - start) / 10
            print(f"Direct O(N²) method: {direct_time*1000:.2f} ms per step")
        else:
            print(f"Direct O(N²) method: Skipped (too many bodies)")
        
        # Barnes-Hut method
        start = time.time()
        for _ in range(10):
            self.calculate_forces_barnes_hut()
        bh_time = (time.time() - start) / 10
        print(f"Barnes-Hut O(N log N): {bh_time*1000:.2f} ms per step")
        
        if self.n_bodies <= 1000:
            print(f"Speedup: {direct_time/bh_time:.1f}x")
        
        # Memory usage estimate
        memory_mb = (self.positions.nbytes + self.velocities.nbytes + 
                    self.masses.nbytes + self.colors.nbytes) / 1024**2
        print(f"\nMemory usage: {memory_mb:.1f} MB")


if __name__ == "__main__":
    # Create optimized galaxy simulation
    print("Initializing optimized galaxy simulation...")
    galaxy = GalaxyOptimized(n_bodies=10000)
    
    # Show benchmark
    galaxy.benchmark_performance()
    
    # Run visualization
    print("\nStarting visualization...")
    galaxy.visualize_3d_advanced(save_animation=False)