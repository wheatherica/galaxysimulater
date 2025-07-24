import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from mpl_toolkits.mplot3d import Axes3D
import time

class Galaxy:
    def __init__(self, n_bodies=10000):
        self.n_bodies = n_bodies
        self.G = 1.0  # Gravitational constant (normalized)
        self.softening = 0.01  # Softening parameter to avoid singularities
        self.dt = 0.001  # Time step
        
        # Galaxy parameters
        self.galaxy_radius = 50.0
        self.disk_height = 2.0
        self.bulge_radius = 10.0
        self.rotation_speed = 0.5
        
        # Initialize arrays
        self.positions = np.zeros((n_bodies, 3))
        self.velocities = np.zeros((n_bodies, 3))
        self.masses = np.zeros(n_bodies)
        self.colors = np.zeros((n_bodies, 3))
        
        self._initialize_galaxy()
        
    def _initialize_galaxy(self):
        """Initialize galaxy with spiral structure and proper mass distribution"""
        # Separate bodies into components
        n_bulge = int(0.2 * self.n_bodies)  # 20% in central bulge
        n_disk = int(0.7 * self.n_bodies)   # 70% in disk
        n_halo = self.n_bodies - n_bulge - n_disk  # 10% in halo
        
        idx = 0
        
        # Central bulge (spherical distribution)
        for i in range(n_bulge):
            r = self.bulge_radius * np.random.power(0.5)
            theta = np.random.uniform(0, 2*np.pi)
            phi = np.arccos(1 - 2*np.random.random())
            
            self.positions[idx] = [
                r * np.sin(phi) * np.cos(theta),
                r * np.sin(phi) * np.sin(theta),
                r * np.cos(phi) * 0.5  # Flatten slightly
            ]
            
            # Bulge stars are more massive
            self.masses[idx] = np.random.uniform(0.8, 2.0)
            self.colors[idx] = [1.0, 0.8, 0.6]  # Yellowish (older stars)
            
            # Random velocities with slight rotation
            v_random = np.random.normal(0, 0.2, 3)
            self.velocities[idx] = v_random
            idx += 1
        
        # Disk (spiral arms)
        n_arms = 2  # Number of spiral arms
        for i in range(n_disk):
            # Logarithmic spiral
            angle_offset = (i % n_arms) * 2 * np.pi / n_arms
            t = np.random.uniform(0, 4)  # Parameter along spiral
            
            # Spiral equation
            theta = t + angle_offset
            r = self.bulge_radius * np.exp(0.3 * t)
            
            # Add some scatter
            r += np.random.normal(0, 2)
            theta += np.random.normal(0, 0.2)
            
            # Limit to galaxy radius
            if r > self.galaxy_radius:
                r = self.galaxy_radius * np.random.uniform(0.8, 1.0)
            
            # Position with disk height
            z = np.random.normal(0, self.disk_height * (1 - r/self.galaxy_radius))
            
            self.positions[idx] = [
                r * np.cos(theta),
                r * np.sin(theta),
                z
            ]
            
            # Disk stars have varied masses
            self.masses[idx] = np.random.uniform(0.3, 1.2)
            
            # Color based on position (blue in arms, red in between)
            arm_distance = abs((theta % (2*np.pi/n_arms)) - np.pi/n_arms)
            if arm_distance < 0.3:
                self.colors[idx] = [0.6, 0.8, 1.0]  # Blue (young stars)
            else:
                self.colors[idx] = [1.0, 0.7, 0.5]  # Reddish
            
            # Circular velocity with Kepler rotation
            v_circular = np.sqrt(self.G * np.sum(self.masses[:idx]) / r) if r > 0 else 0
            v_circular *= self.rotation_speed
            
            self.velocities[idx] = [
                -v_circular * np.sin(theta),
                v_circular * np.cos(theta),
                np.random.normal(0, 0.1)
            ]
            idx += 1
        
        # Dark matter halo (spherical)
        for i in range(n_halo):
            r = self.galaxy_radius * np.random.uniform(0.5, 2.0)
            theta = np.random.uniform(0, 2*np.pi)
            phi = np.arccos(1 - 2*np.random.random())
            
            self.positions[idx] = [
                r * np.sin(phi) * np.cos(theta),
                r * np.sin(phi) * np.sin(theta),
                r * np.cos(phi)
            ]
            
            # Dark matter particles (invisible but massive)
            self.masses[idx] = 5.0
            self.colors[idx] = [0.1, 0.1, 0.1]  # Dark
            
            # Small random velocities
            self.velocities[idx] = np.random.normal(0, 0.1, 3)
            idx += 1
    
    def calculate_forces(self):
        """Calculate gravitational forces between all bodies"""
        forces = np.zeros_like(self.positions)
        
        # Simple O(N^2) calculation - for better performance use Barnes-Hut
        for i in range(self.n_bodies):
            for j in range(i+1, self.n_bodies):
                # Vector from i to j
                dr = self.positions[j] - self.positions[i]
                r2 = np.sum(dr**2) + self.softening**2
                r = np.sqrt(r2)
                
                # Gravitational force
                F = self.G * self.masses[i] * self.masses[j] * dr / (r2 * r)
                
                forces[i] += F
                forces[j] -= F
        
        return forces
    
    def update(self):
        """Update positions and velocities using leapfrog integration"""
        # Calculate forces
        forces = self.calculate_forces()
        
        # Update velocities (half step)
        accelerations = forces / self.masses[:, np.newaxis]
        self.velocities += accelerations * self.dt * 0.5
        
        # Update positions
        self.positions += self.velocities * self.dt
        
        # Recalculate forces at new positions
        forces = self.calculate_forces()
        
        # Update velocities (half step)
        accelerations = forces / self.masses[:, np.newaxis]
        self.velocities += accelerations * self.dt * 0.5
    
    def get_energy(self):
        """Calculate total energy of the system"""
        # Kinetic energy
        kinetic = 0.5 * np.sum(self.masses * np.sum(self.velocities**2, axis=1))
        
        # Potential energy
        potential = 0
        for i in range(self.n_bodies):
            for j in range(i+1, self.n_bodies):
                dr = self.positions[j] - self.positions[i]
                r = np.sqrt(np.sum(dr**2) + self.softening**2)
                potential -= self.G * self.masses[i] * self.masses[j] / r
        
        return kinetic, potential, kinetic + potential
    
    def visualize_3d(self, save_animation=False):
        """Create 3D visualization of the galaxy"""
        fig = plt.figure(figsize=(12, 10))
        ax = fig.add_subplot(111, projection='3d')
        
        # Set up the plot
        ax.set_xlim(-self.galaxy_radius*1.5, self.galaxy_radius*1.5)
        ax.set_ylim(-self.galaxy_radius*1.5, self.galaxy_radius*1.5)
        ax.set_zlim(-self.galaxy_radius*0.5, self.galaxy_radius*0.5)
        ax.set_xlabel('X (kpc)')
        ax.set_ylabel('Y (kpc)')
        ax.set_zlabel('Z (kpc)')
        ax.set_title(f'Galaxy Simulation: {self.n_bodies} bodies')
        
        # Initial scatter plot
        scatter = ax.scatter(self.positions[:, 0], 
                           self.positions[:, 1], 
                           self.positions[:, 2],
                           c=self.colors,
                           s=self.masses*2,
                           alpha=0.6)
        
        # Info text
        time_text = ax.text2D(0.02, 0.95, '', transform=ax.transAxes)
        energy_text = ax.text2D(0.02, 0.90, '', transform=ax.transAxes)
        
        def animate(frame):
            # Update simulation
            self.update()
            
            # Update scatter plot
            scatter._offsets3d = (self.positions[:, 0], 
                                self.positions[:, 1], 
                                self.positions[:, 2])
            
            # Update info
            if frame % 10 == 0:
                ke, pe, te = self.get_energy()
                time_text.set_text(f'Time: {frame*self.dt:.2f}')
                energy_text.set_text(f'Energy: KE={ke:.2f}, PE={pe:.2f}, Total={te:.2f}')
            
            # Rotate view
            ax.view_init(elev=20, azim=frame*0.5)
            
            return scatter, time_text, energy_text
        
        anim = FuncAnimation(fig, animate, frames=1000, 
                           interval=50, blit=False)
        
        if save_animation:
            anim.save('galaxy_simulation.gif', writer='pillow', fps=20)
        
        plt.show()
    
    def run_simulation(self, steps=1000, visualize=True):
        """Run the simulation"""
        print(f"Starting galaxy simulation with {self.n_bodies} bodies...")
        print(f"Galaxy parameters:")
        print(f"  - Radius: {self.galaxy_radius} kpc")
        print(f"  - Disk height: {self.disk_height} kpc")
        print(f"  - Bulge radius: {self.bulge_radius} kpc")
        print(f"  - Time step: {self.dt}")
        print(f"  - Softening: {self.softening}")
        
        if visualize:
            self.visualize_3d()
        else:
            # Run without visualization
            start_time = time.time()
            initial_energy = self.get_energy()[2]
            
            for step in range(steps):
                self.update()
                
                if step % 100 == 0:
                    current_energy = self.get_energy()[2]
                    energy_error = abs((current_energy - initial_energy) / initial_energy)
                    print(f"Step {step}: Energy error = {energy_error:.6f}")
            
            elapsed = time.time() - start_time
            print(f"Simulation completed in {elapsed:.2f} seconds")
            print(f"Average time per step: {elapsed/steps*1000:.2f} ms")


if __name__ == "__main__":
    # Create and run galaxy simulation
    galaxy = Galaxy(n_bodies=10000)
    galaxy.run_simulation(visualize=True)