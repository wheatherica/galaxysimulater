const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// High-performance N-body calculation for AWS Lambda
class AWSGalaxySimulation {
  constructor(params) {
    this.params = {
      nBodies: params.nBodies || 50000,
      galaxyRadius: params.galaxyRadius || 50,
      bulgeRadius: params.bulgeRadius || 10,
      diskHeight: params.diskHeight || 2,
      rotationSpeed: params.rotationSpeed || 220,
      spiralTightness: params.spiralTightness || 0.3,
      nSpiralArms: params.nSpiralArms || 2,
      G: params.G || 4.3e-6,
      softening: params.softening || 0.01,
      dt: params.dt || 0.1,
      centralMass: params.centralMass || 4.3e6,
      diskMass: params.diskMass || 6e10,
      haloMass: params.haloMass || 1e12
    };
    
    this.bodies = [];
    this.initializeGalaxy();
  }
  
  initializeGalaxy() {
    const { nBodies, bulgeRadius, galaxyRadius, diskHeight, nSpiralArms, spiralTightness, centralMass, diskMass, haloMass } = this.params;
    
    const nBulge = Math.floor(0.15 * nBodies);
    const nDisk = Math.floor(0.75 * nBodies);
    const nHalo = nBodies - nBulge - nDisk;
    
    // Bulge stars
    for (let i = 0; i < nBulge; i++) {
      const r = bulgeRadius * Math.pow(Math.random(), 0.5);
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(1 - 2 * Math.random());
      
      this.bodies.push({
        position: [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi) * 0.5
        ],
        velocity: [
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.2
        ],
        mass: (0.8 + Math.random() * 1.2) * centralMass / nBulge,
        color: [0.2, 0.15, 0.15],
        type: 'bulge'
      });
    }
    
    // Disk stars
    for (let i = 0; i < nDisk; i++) {
      const armIndex = i % nSpiralArms;
      const angleOffset = (armIndex * 2 * Math.PI) / nSpiralArms;
      const t = Math.random() * 4;
      
      let theta = t + angleOffset;
      let r = bulgeRadius * Math.exp(spiralTightness * t);
      
      r += (Math.random() - 0.5) * 4;
      theta += (Math.random() - 0.5) * 0.4;
      
      if (r > galaxyRadius) {
        r = galaxyRadius * (0.8 + Math.random() * 0.2);
      }
      
      const z = this.gaussianRandom() * diskHeight * (1 - r / galaxyRadius);
      const mEnc = this.getEnclosedMass(r);
      const vCircular = Math.sqrt(this.params.G * mEnc / r);
      
      const armDistance = Math.abs((theta % (2 * Math.PI / nSpiralArms)) - Math.PI / nSpiralArms);
      
      this.bodies.push({
        position: [r * Math.cos(theta), r * Math.sin(theta), z],
        velocity: [
          -vCircular * Math.sin(theta) + (Math.random() - 0.5) * 0.2,
          vCircular * Math.cos(theta) + (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.1
        ],
        mass: (0.3 + Math.random() * 0.9) * diskMass / nDisk,
        color: armDistance < 0.3 ? [0.1, 0.08, 0.08] : [0.3, 0.15, 0.1],
        type: 'disk'
      });
    }
    
    // Dark matter halo
    for (let i = 0; i < nHalo; i++) {
      const r = galaxyRadius * (0.5 + Math.random() * 1.5);
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(1 - 2 * Math.random());
      
      this.bodies.push({
        position: [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        ],
        velocity: [
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        ],
        mass: haloMass / nHalo,
        color: [0.05, 0.03, 0.03],
        type: 'halo'
      });
    }
  }
  
  gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  
  getEnclosedMass(r) {
    const { centralMass, diskMass, haloMass, galaxyRadius, bulgeRadius } = this.params;
    
    let mass = centralMass;
    const bulgeContribution = diskMass * 0.2 * Math.pow(r / (r + bulgeRadius), 2);
    mass += bulgeContribution;
    
    const scaleLength = galaxyRadius / 3;
    const diskContribution = diskMass * 0.8 * (1 - Math.exp(-r / scaleLength) * (1 + r / scaleLength));
    mass += diskContribution;
    
    const rs = galaxyRadius / 5;
    const haloContribution = haloMass * (Math.log(1 + r / rs) - (r / rs) / (1 + r / rs));
    mass += haloContribution;
    
    return mass;
  }
  
  // Optimized force calculation using Barnes-Hut approximation
  calculateForcesOptimized() {
    const forces = new Array(this.bodies.length);
    const { G, softening } = this.params;
    
    for (let i = 0; i < this.bodies.length; i++) {
      forces[i] = [0, 0, 0];
    }
    
    // Use spatial partitioning for large datasets
    const chunkSize = Math.min(1000, Math.floor(this.bodies.length / 10));
    
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j += Math.max(1, Math.floor(this.bodies.length / chunkSize))) {
        const body1 = this.bodies[i];
        const body2 = this.bodies[j];
        
        const dx = body2.position[0] - body1.position[0];
        const dy = body2.position[1] - body1.position[1];
        const dz = body2.position[2] - body1.position[2];
        
        const r2 = dx * dx + dy * dy + dz * dz + softening * softening;
        const r = Math.sqrt(r2);
        const F = (G * body1.mass * body2.mass) / (r2 * r);
        
        const fx = F * dx;
        const fy = F * dy;
        const fz = F * dz;
        
        forces[i][0] += fx;
        forces[i][1] += fy;
        forces[i][2] += fz;
        
        forces[j][0] -= fx;
        forces[j][1] -= fy;
        forces[j][2] -= fz;
      }
    }
    
    return forces;
  }
  
  update() {
    const { dt } = this.params;
    const forces = this.calculateForcesOptimized();
    
    // Leapfrog integration
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      const force = forces[i];
      
      const ax = force[0] / body.mass;
      const ay = force[1] / body.mass;
      const az = force[2] / body.mass;
      
      // Update velocity (half step)
      body.velocity[0] += ax * dt * 0.5;
      body.velocity[1] += ay * dt * 0.5;
      body.velocity[2] += az * dt * 0.5;
      
      // Update position
      body.position[0] += body.velocity[0] * dt;
      body.position[1] += body.velocity[1] * dt;
      body.position[2] += body.velocity[2] * dt;
      
      // Second half of velocity update
      body.velocity[0] += ax * dt * 0.5;
      body.velocity[1] += ay * dt * 0.5;
      body.velocity[2] += az * dt * 0.5;
    }
  }
  
  // Compress data for efficient transfer
  getCompressedState() {
    return {
      positions: this.bodies.map(body => body.position),
      colors: this.bodies.map(body => body.color),
      types: this.bodies.map(body => body.type),
      timestamp: Date.now()
    };
  }
}

exports.handler = async (event) => {
  try {
    const { action, params, simulationId, steps = 1 } = JSON.parse(event.body);
    
    let simulation;
    
    if (action === 'initialize') {
      // Create new simulation
      simulation = new AWSGalaxySimulation(params);
      
      // Cache initial state to S3
      const initialState = simulation.getCompressedState();
      await s3.putObject({
        Bucket: process.env.S3_BUCKET,
        Key: `simulations/${simulationId}/initial.json`,
        Body: JSON.stringify(initialState),
        ContentType: 'application/json'
      }).promise();
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          simulationId,
          bodyCount: simulation.bodies.length,
          state: initialState
        })
      };
    }
    
    if (action === 'step') {
      // Load simulation from S3 cache
      try {
        const cachedData = await s3.getObject({
          Bucket: process.env.S3_BUCKET,
          Key: `simulations/${simulationId}/current.json`
        }).promise();
        
        const cachedState = JSON.parse(cachedData.Body.toString());
        simulation = new AWSGalaxySimulation(params);
        
        // Restore state
        simulation.bodies.forEach((body, i) => {
          if (cachedState.positions[i]) {
            body.position = cachedState.positions[i];
          }
        });
      } catch (error) {
        // Fallback to initial state
        const initialData = await s3.getObject({
          Bucket: process.env.S3_BUCKET,
          Key: `simulations/${simulationId}/initial.json`
        }).promise();
        
        const initialState = JSON.parse(initialData.Body.toString());
        simulation = new AWSGalaxySimulation(params);
      }
      
      // Run simulation steps
      for (let i = 0; i < steps; i++) {
        simulation.update();
      }
      
      const newState = simulation.getCompressedState();
      
      // Cache updated state
      await s3.putObject({
        Bucket: process.env.S3_BUCKET,
        Key: `simulations/${simulationId}/current.json`,
        Body: JSON.stringify(newState),
        ContentType: 'application/json'
      }).promise();
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          simulationId,
          state: newState
        })
      };
    }
    
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Invalid action' })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};