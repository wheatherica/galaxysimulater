const AWS = require('aws-sdk');
const { Logger } = require('@aws-lambda-powertools/logger');
const { Metrics } = require('@aws-lambda-powertools/metrics');
const { Tracer } = require('@aws-lambda-powertools/tracer');
const Redis = require('ioredis');

// Initialize AWS services
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const stepfunctions = new AWS.StepFunctions();
const eventbridge = new AWS.EventBridge();

// Initialize Powertools
const logger = new Logger();
const metrics = new Metrics();
const tracer = new Tracer();

// Redis client (lazy initialization)
let redisClient = null;

// Advanced Galaxy Simulation with AWS Integration
class EnhancedGalaxySimulation {
  constructor(params, simulationId) {
    this.simulationId = simulationId;
    this.params = {
      nBodies: params.nBodies || 100000,
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
      haloMass: params.haloMass || 1e12,
      darkEnergyLambda: params.darkEnergyLambda || 0.7,
      useBarnesHut: params.useBarnesHut !== false,
      theta: params.theta || 0.5,
      maxTreeDepth: params.maxTreeDepth || 20
    };
    
    this.bodies = [];
    this.octree = null;
    this.statistics = {
      totalEnergy: 0,
      angularMomentum: [0, 0, 0],
      centerOfMass: [0, 0, 0],
      viralRatio: 0
    };
    
    this.initializeGalaxy();
  }
  
  initializeGalaxy() {
    const segment = tracer.getSegment();
    const subsegment = segment.addNewSubsegment('initializeGalaxy');
    
    try {
      const { nBodies, bulgeRadius, galaxyRadius, diskHeight, nSpiralArms, spiralTightness, centralMass, diskMass, haloMass } = this.params;
      
      const nBulge = Math.floor(0.15 * nBodies);
      const nDisk = Math.floor(0.70 * nBodies);
      const nHalo = Math.floor(0.10 * nBodies);
      const nGas = nBodies - nBulge - nDisk - nHalo;
      
      // Super-massive black hole at center
      this.bodies.push({
        id: 'smbh',
        position: [0, 0, 0],
        velocity: [0, 0, 0],
        mass: centralMass,
        radius: 0.001,
        color: [1, 1, 1],
        type: 'smbh',
        temperature: 1e9
      });
      
      // Bulge stars with age distribution
      for (let i = 0; i < nBulge; i++) {
        const r = bulgeRadius * Math.pow(Math.random(), 0.5);
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(1 - 2 * Math.random());
        
        const age = 8 + Math.random() * 5; // 8-13 Gyr old stars
        const mass = this.sampleIMF() * centralMass / nBulge;
        
        this.bodies.push({
          id: `bulge_${i}`,
          position: [
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi) * 0.5
          ],
          velocity: this.calculateOrbitalVelocity(r, theta, phi, 'bulge'),
          mass: mass,
          radius: this.stellarRadius(mass),
          color: this.stellarColor(mass, age),
          type: 'bulge',
          age: age,
          metallicity: 0.02 + Math.random() * 0.01,
          temperature: this.stellarTemperature(mass)
        });
      }
      
      // Disk stars in spiral arms with star formation
      for (let i = 0; i < nDisk; i++) {
        const armIndex = i % nSpiralArms;
        const angleOffset = (armIndex * 2 * Math.PI) / nSpiralArms;
        const t = Math.random() * 4;
        
        let theta = t + angleOffset;
        let r = bulgeRadius * Math.exp(spiralTightness * t);
        
        // Add spiral arm density wave
        const armPhase = Math.sin(nSpiralArms * (theta - spiralTightness * r));
        r += armPhase * 2;
        theta += (Math.random() - 0.5) * 0.2;
        
        if (r > galaxyRadius) {
          r = galaxyRadius * (0.8 + Math.random() * 0.2);
        }
        
        const z = this.gaussianRandom() * diskHeight * Math.exp(-r / (galaxyRadius * 0.3));
        const inSpiral = Math.abs(armPhase) > 0.7;
        const age = inSpiral ? Math.random() * 2 : 2 + Math.random() * 8;
        const mass = this.sampleIMF() * diskMass / nDisk;
        
        this.bodies.push({
          id: `disk_${i}`,
          position: [r * Math.cos(theta), r * Math.sin(theta), z],
          velocity: this.calculateOrbitalVelocity(r, theta, 0, 'disk'),
          mass: mass,
          radius: this.stellarRadius(mass),
          color: this.stellarColor(mass, age),
          type: 'disk',
          age: age,
          metallicity: 0.008 + Math.random() * 0.012,
          temperature: this.stellarTemperature(mass),
          inSpiral: inSpiral
        });
      }
      
      // Dark matter halo with NFW profile
      for (let i = 0; i < nHalo; i++) {
        const r = this.sampleNFWRadius() * galaxyRadius * 2;
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(1 - 2 * Math.random());
        
        this.bodies.push({
          id: `halo_${i}`,
          position: [
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
          ],
          velocity: this.calculateOrbitalVelocity(r, theta, phi, 'halo'),
          mass: haloMass / nHalo,
          radius: 0.1,
          color: [0.05, 0.03, 0.03],
          type: 'halo',
          temperature: 0
        });
      }
      
      // Gas particles for star formation
      for (let i = 0; i < nGas; i++) {
        const r = galaxyRadius * Math.random();
        const theta = Math.random() * 2 * Math.PI;
        const z = this.gaussianRandom() * diskHeight * 0.5;
        
        this.bodies.push({
          id: `gas_${i}`,
          position: [r * Math.cos(theta), r * Math.sin(theta), z],
          velocity: this.calculateOrbitalVelocity(r, theta, 0, 'gas'),
          mass: diskMass * 0.1 / nGas,
          radius: 1,
          color: [0.1, 0.15, 0.2],
          type: 'gas',
          density: Math.random() * 10,
          temperature: 100 + Math.random() * 1000
        });
      }
      
      this.calculateStatistics();
      
      metrics.addMetric('BodiesInitialized', 'Count', this.bodies.length);
      logger.info('Galaxy initialized', { 
        simulationId: this.simulationId, 
        nBodies: this.bodies.length,
        statistics: this.statistics
      });
      
    } finally {
      subsegment.close();
    }
  }
  
  // Sample from Initial Mass Function (Kroupa IMF)
  sampleIMF() {
    const r = Math.random();
    if (r < 0.5) {
      return 0.08 + (0.5 - 0.08) * Math.pow(r / 0.5, -1.3);
    } else {
      return 0.5 + (120 - 0.5) * Math.pow((r - 0.5) / 0.5, -2.3);
    }
  }
  
  // Sample from NFW profile
  sampleNFWRadius() {
    const c = 10; // concentration parameter
    const u = Math.random();
    const f = u * (Math.log(1 + c) - c / (1 + c));
    
    // Newton-Raphson to solve for r
    let x = c * u;
    for (let i = 0; i < 5; i++) {
      const fx = Math.log(1 + x) - x / (1 + x) - f;
      const dfx = 1 / (1 + x) - 1 / Math.pow(1 + x, 2);
      x = x - fx / dfx;
    }
    
    return x / c;
  }
  
  calculateOrbitalVelocity(r, theta, phi, type) {
    const mEnc = this.getEnclosedMass(r);
    const vCircular = Math.sqrt(this.params.G * mEnc / r);
    
    const dispersion = {
      'bulge': 0.4,
      'disk': 0.2,
      'halo': 0.3,
      'gas': 0.1
    }[type] || 0.2;
    
    return [
      -vCircular * Math.sin(theta) + this.gaussianRandom() * dispersion,
      vCircular * Math.cos(theta) + this.gaussianRandom() * dispersion,
      this.gaussianRandom() * dispersion * 0.5
    ];
  }
  
  stellarRadius(mass) {
    // Mass-radius relation for main sequence stars
    if (mass < 1) {
      return Math.pow(mass, 0.8);
    } else {
      return Math.pow(mass, 0.57);
    }
  }
  
  stellarTemperature(mass) {
    // Mass-temperature relation
    return 5780 * Math.pow(mass, 0.65);
  }
  
  stellarColor(mass, age) {
    const temp = this.stellarTemperature(mass);
    const ageFactor = Math.max(0.5, 1 - age / 20);
    
    // Temperature to RGB (simplified)
    let r, g, b;
    if (temp < 3500) {
      r = 1; g = 0.3; b = 0;
    } else if (temp < 5000) {
      r = 1; g = 0.6; b = 0.2;
    } else if (temp < 6000) {
      r = 1; g = 0.9; b = 0.7;
    } else if (temp < 7500) {
      r = 0.9; g = 0.9; b = 1;
    } else {
      r = 0.7; g = 0.8; b = 1;
    }
    
    return [r * ageFactor, g * ageFactor, b * ageFactor];
  }
  
  gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  
  getEnclosedMass(r) {
    const { centralMass, diskMass, haloMass, galaxyRadius, bulgeRadius } = this.params;
    
    // Hernquist profile for bulge
    const bulgeContribution = centralMass * Math.pow(r, 2) / Math.pow(r + bulgeRadius, 2);
    
    // Exponential disk
    const scaleLength = galaxyRadius / 3;
    const diskContribution = diskMass * (1 - Math.exp(-r / scaleLength) * (1 + r / scaleLength));
    
    // NFW profile for halo
    const rs = galaxyRadius / 5;
    const x = r / rs;
    const haloContribution = haloMass * (Math.log(1 + x) - x / (1 + x));
    
    return bulgeContribution + diskContribution + haloContribution;
  }
  
  // Barnes-Hut tree construction
  buildOctree() {
    const bounds = this.calculateBounds();
    this.octree = new OctreeNode(bounds.center, bounds.size);
    
    for (const body of this.bodies) {
      this.octree.insert(body);
    }
  }
  
  calculateBounds() {
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    
    for (const body of this.bodies) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], body.position[i]);
        max[i] = Math.max(max[i], body.position[i]);
      }
    }
    
    const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    
    return { center, size };
  }
  
  // Calculate forces using Barnes-Hut algorithm
  calculateForcesBarnesHut() {
    const segment = tracer.getSegment();
    const subsegment = segment.addNewSubsegment('calculateForces');
    
    try {
      this.buildOctree();
      const forces = new Array(this.bodies.length);
      const { G, softening, theta } = this.params;
      
      for (let i = 0; i < this.bodies.length; i++) {
        forces[i] = [0, 0, 0];
        const body = this.bodies[i];
        
        // Dark matter doesn't interact with baryonic matter directly
        if (body.type === 'halo') continue;
        
        this.octree.calculateForce(body, forces[i], G, softening, theta);
        
        // Add dark energy repulsion
        const r = Math.sqrt(body.position[0]**2 + body.position[1]**2 + body.position[2]**2);
        const darkEnergyForce = this.params.darkEnergyLambda * body.mass * r;
        for (let j = 0; j < 3; j++) {
          forces[i][j] += darkEnergyForce * body.position[j] / r;
        }
      }
      
      return forces;
    } finally {
      subsegment.close();
    }
  }
  
  // Hydrodynamics for gas particles
  calculateGasPressure() {
    const gasParticles = this.bodies.filter(b => b.type === 'gas');
    const k = 1.38e-23; // Boltzmann constant
    
    for (const gas of gasParticles) {
      // Simple SPH pressure calculation
      gas.pressure = gas.density * k * gas.temperature;
      
      // Star formation criteria
      if (gas.density > 100 && gas.temperature < 100) {
        this.formStar(gas);
      }
    }
  }
  
  formStar(gasParticle) {
    gasParticle.type = 'disk';
    gasParticle.age = 0;
    gasParticle.color = [0.5, 0.7, 1]; // Young blue star
    gasParticle.temperature = this.stellarTemperature(gasParticle.mass);
    
    logger.info('Star formed', { 
      simulationId: this.simulationId,
      position: gasParticle.position 
    });
  }
  
  // Advanced integration with adaptive timestep
  update() {
    const segment = tracer.getSegment();
    const subsegment = segment.addNewSubsegment('update');
    
    try {
      const forces = this.params.useBarnesHut ? 
        this.calculateForcesBarnesHut() : 
        this.calculateForcesDirect();
      
      this.calculateGasPressure();
      
      // Adaptive timestep based on acceleration
      let minTimestep = this.params.dt;
      
      // Leapfrog integration with individual timesteps
      for (let i = 0; i < this.bodies.length; i++) {
        const body = this.bodies[i];
        const force = forces[i];
        
        const acc = [
          force[0] / body.mass,
          force[1] / body.mass,
          force[2] / body.mass
        ];
        
        // Calculate adaptive timestep
        const accMag = Math.sqrt(acc[0]**2 + acc[1]**2 + acc[2]**2);
        const dt = Math.min(this.params.dt, 0.01 * Math.sqrt(this.params.softening / accMag));
        minTimestep = Math.min(minTimestep, dt);
        
        // Update velocity (half step)
        for (let j = 0; j < 3; j++) {
          body.velocity[j] += acc[j] * dt * 0.5;
        }
        
        // Update position
        for (let j = 0; j < 3; j++) {
          body.position[j] += body.velocity[j] * dt;
        }
        
        // Second half of velocity update
        for (let j = 0; j < 3; j++) {
          body.velocity[j] += acc[j] * dt * 0.5;
        }
        
        // Stellar evolution
        if (body.type === 'disk' || body.type === 'bulge') {
          body.age += dt * 1e-3; // Convert to Gyr
          body.color = this.stellarColor(body.mass, body.age);
        }
      }
      
      this.calculateStatistics();
      
      metrics.addMetric('MinTimestep', 'Milliseconds', minTimestep * 1000);
      metrics.addMetric('TotalEnergy', 'Count', Math.abs(this.statistics.totalEnergy));
      
    } finally {
      subsegment.close();
    }
  }
  
  calculateStatistics() {
    let totalKE = 0;
    let totalPE = 0;
    let totalMass = 0;
    let com = [0, 0, 0];
    let angMom = [0, 0, 0];
    
    for (const body of this.bodies) {
      const v2 = body.velocity[0]**2 + body.velocity[1]**2 + body.velocity[2]**2;
      totalKE += 0.5 * body.mass * v2;
      totalMass += body.mass;
      
      for (let i = 0; i < 3; i++) {
        com[i] += body.mass * body.position[i];
      }
      
      // Angular momentum L = r × p
      angMom[0] += body.mass * (body.position[1] * body.velocity[2] - body.position[2] * body.velocity[1]);
      angMom[1] += body.mass * (body.position[2] * body.velocity[0] - body.position[0] * body.velocity[2]);
      angMom[2] += body.mass * (body.position[0] * body.velocity[1] - body.position[1] * body.velocity[0]);
    }
    
    // Potential energy (simplified)
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j += Math.max(1, Math.floor(this.bodies.length / 1000))) {
        const dx = this.bodies[j].position[0] - this.bodies[i].position[0];
        const dy = this.bodies[j].position[1] - this.bodies[i].position[1];
        const dz = this.bodies[j].position[2] - this.bodies[i].position[2];
        const r = Math.sqrt(dx*dx + dy*dy + dz*dz + this.params.softening**2);
        totalPE -= this.params.G * this.bodies[i].mass * this.bodies[j].mass / r;
      }
    }
    
    this.statistics = {
      totalEnergy: totalKE + totalPE,
      angularMomentum: angMom,
      centerOfMass: com.map(x => x / totalMass),
      viralRatio: 2 * totalKE / Math.abs(totalPE),
      kineticEnergy: totalKE,
      potentialEnergy: totalPE
    };
  }
  
  // Compress state for efficient storage
  getCompressedState() {
    const positions = new Float32Array(this.bodies.length * 3);
    const velocities = new Float32Array(this.bodies.length * 3);
    const properties = new Uint8Array(this.bodies.length * 4);
    
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      positions[i * 3] = body.position[0];
      positions[i * 3 + 1] = body.position[1];
      positions[i * 3 + 2] = body.position[2];
      
      velocities[i * 3] = body.velocity[0];
      velocities[i * 3 + 1] = body.velocity[1];
      velocities[i * 3 + 2] = body.velocity[2];
      
      properties[i * 4] = Math.floor(body.color[0] * 255);
      properties[i * 4 + 1] = Math.floor(body.color[1] * 255);
      properties[i * 4 + 2] = Math.floor(body.color[2] * 255);
      properties[i * 4 + 3] = { 'smbh': 0, 'bulge': 1, 'disk': 2, 'halo': 3, 'gas': 4 }[body.type] || 2;
    }
    
    return {
      positions: Buffer.from(positions.buffer).toString('base64'),
      velocities: Buffer.from(velocities.buffer).toString('base64'),
      properties: Buffer.from(properties.buffer).toString('base64'),
      statistics: this.statistics,
      timestamp: Date.now(),
      simulationTime: this.simulationTime || 0
    };
  }
}

// Octree node for Barnes-Hut algorithm
class OctreeNode {
  constructor(center, size) {
    this.center = center;
    this.size = size;
    this.mass = 0;
    this.centerOfMass = [0, 0, 0];
    this.body = null;
    this.children = null;
  }
  
  insert(body) {
    if (this.body === null && this.children === null) {
      this.body = body;
      this.mass = body.mass;
      this.centerOfMass = [...body.position];
      return;
    }
    
    if (this.children === null) {
      this.subdivide();
      const existingBody = this.body;
      this.body = null;
      this.insertIntoChild(existingBody);
    }
    
    this.insertIntoChild(body);
    this.updateCenterOfMass(body);
  }
  
  subdivide() {
    this.children = [];
    const halfSize = this.size / 2;
    
    for (let i = 0; i < 8; i++) {
      const childCenter = [
        this.center[0] + (i & 1 ? halfSize / 2 : -halfSize / 2),
        this.center[1] + (i & 2 ? halfSize / 2 : -halfSize / 2),
        this.center[2] + (i & 4 ? halfSize / 2 : -halfSize / 2)
      ];
      this.children.push(new OctreeNode(childCenter, halfSize));
    }
  }
  
  insertIntoChild(body) {
    let index = 0;
    if (body.position[0] > this.center[0]) index |= 1;
    if (body.position[1] > this.center[1]) index |= 2;
    if (body.position[2] > this.center[2]) index |= 4;
    
    this.children[index].insert(body);
  }
  
  updateCenterOfMass(body) {
    const totalMass = this.mass + body.mass;
    for (let i = 0; i < 3; i++) {
      this.centerOfMass[i] = (this.centerOfMass[i] * this.mass + body.position[i] * body.mass) / totalMass;
    }
    this.mass = totalMass;
  }
  
  calculateForce(body, force, G, softening, theta) {
    if (this.body !== null && this.body !== body) {
      const dx = this.body.position[0] - body.position[0];
      const dy = this.body.position[1] - body.position[1];
      const dz = this.body.position[2] - body.position[2];
      const r2 = dx*dx + dy*dy + dz*dz + softening*softening;
      const r = Math.sqrt(r2);
      const F = G * body.mass * this.body.mass / (r2 * r);
      
      force[0] += F * dx;
      force[1] += F * dy;
      force[2] += F * dz;
      return;
    }
    
    if (this.children === null) return;
    
    const dx = this.centerOfMass[0] - body.position[0];
    const dy = this.centerOfMass[1] - body.position[1];
    const dz = this.centerOfMass[2] - body.position[2];
    const r = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    if (this.size / r < theta) {
      const r2 = dx*dx + dy*dy + dz*dz + softening*softening;
      const F = G * body.mass * this.mass / (r2 * Math.sqrt(r2));
      
      force[0] += F * dx;
      force[1] += F * dy;
      force[2] += F * dz;
    } else {
      for (const child of this.children) {
        child.calculateForce(body, force, G, softening, theta);
      }
    }
  }
}

// Initialize Redis connection
async function initRedis() {
  if (!redisClient && process.env.CACHE_ENDPOINT) {
    redisClient = new Redis({
      host: process.env.CACHE_ENDPOINT,
      port: 6379,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });
  }
}

// Cache operations
async function getCachedState(simulationId) {
  if (!redisClient) return null;
  
  try {
    const cached = await redisClient.get(`sim:${simulationId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.error('Cache get error', { error: error.message });
    return null;
  }
}

async function setCachedState(simulationId, state, ttl = 3600) {
  if (!redisClient) return;
  
  try {
    await redisClient.setex(`sim:${simulationId}`, ttl, JSON.stringify(state));
  } catch (error) {
    logger.error('Cache set error', { error: error.message });
  }
}

// DynamoDB operations
async function saveSimulationMetadata(metadata) {
  const params = {
    TableName: process.env.METADATA_TABLE,
    Item: {
      ...metadata,
      ttl: Math.floor(Date.now() / 1000) + 86400 * 7 // 7 days TTL
    }
  };
  
  await dynamodb.put(params).promise();
}

async function getSimulationMetadata(simulationId) {
  const params = {
    TableName: process.env.METADATA_TABLE,
    Key: { simulationId }
  };
  
  const result = await dynamodb.get(params).promise();
  return result.Item;
}

async function updateSimulationStatus(simulationId, status, additionalData = {}) {
  const params = {
    TableName: process.env.METADATA_TABLE,
    Key: { simulationId },
    UpdateExpression: 'SET #status = :status, #updated = :updated, #data = :data',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updated': 'lastUpdated',
      '#data': 'additionalData'
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':updated': Date.now(),
      ':data': additionalData
    }
  };
  
  await dynamodb.update(params).promise();
}

// EventBridge operations
async function publishEvent(eventType, detail) {
  const params = {
    Entries: [{
      Source: 'galaxy.simulator',
      DetailType: eventType,
      Detail: JSON.stringify(detail),
      EventBusName: process.env.EVENT_BUS_NAME || 'default'
    }]
  };
  
  await eventbridge.putEvents(params).promise();
}

// S3 operations with multipart upload for large simulations
async function saveToS3(key, data, metadata = {}) {
  const buffer = Buffer.from(JSON.stringify(data));
  
  if (buffer.length > 5 * 1024 * 1024) { // 5MB threshold
    return await multipartUpload(key, buffer, metadata);
  }
  
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'application/json',
    Metadata: metadata
  };
  
  return await s3.putObject(params).promise();
}

async function multipartUpload(key, buffer, metadata) {
  const partSize = 5 * 1024 * 1024; // 5MB parts
  const numParts = Math.ceil(buffer.length / partSize);
  
  const createParams = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: 'application/json',
    Metadata: metadata
  };
  
  const { UploadId } = await s3.createMultipartUpload(createParams).promise();
  
  const uploadPromises = [];
  for (let i = 0; i < numParts; i++) {
    const start = i * partSize;
    const end = Math.min((i + 1) * partSize, buffer.length);
    const partBuffer = buffer.slice(start, end);
    
    const uploadParams = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      PartNumber: i + 1,
      UploadId,
      Body: partBuffer
    };
    
    uploadPromises.push(
      s3.uploadPart(uploadParams).promise()
        .then(data => ({ ETag: data.ETag, PartNumber: i + 1 }))
    );
  }
  
  const parts = await Promise.all(uploadPromises);
  
  const completeParams = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    UploadId,
    MultipartUpload: { Parts: parts }
  };
  
  return await s3.completeMultipartUpload(completeParams).promise();
}

// Main Lambda handler
exports.handler = async (event, context) => {
  // Add context to logger
  logger.addContext(context);
  
  // Add tracing
  const segment = tracer.getSegment();
  const subsegment = segment.addNewSubsegment('handler');
  
  try {
    await initRedis();
    
    const { action, params, simulationId, steps = 1, userId } = JSON.parse(event.body || '{}');
    
    logger.info('Processing request', { action, simulationId, steps });
    metrics.addMetric('RequestReceived', 'Count', 1);
    
    switch (action) {
      case 'initialize': {
        const simulation = new EnhancedGalaxySimulation(params, simulationId);
        const initialState = simulation.getCompressedState();
        
        // Save to S3
        await saveToS3(
          `simulations/${simulationId}/initial.json`,
          initialState,
          { userId, createdAt: new Date().toISOString() }
        );
        
        // Save metadata to DynamoDB
        await saveSimulationMetadata({
          simulationId,
          userId,
          status: 'initialized',
          params,
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          bodyCount: simulation.bodies.length,
          statistics: simulation.statistics
        });
        
        // Cache initial state
        await setCachedState(simulationId, initialState);
        
        // Publish event
        await publishEvent('Simulation Started', {
          simulationId,
          userId,
          bodyCount: simulation.bodies.length
        });
        
        // Start Step Functions workflow for long-running simulations
        if (params.autoRun) {
          const execution = await stepfunctions.startExecution({
            stateMachineArn: process.env.STATE_MACHINE_ARN,
            name: `sim-${simulationId}-${Date.now()}`,
            input: JSON.stringify({
              simulationId,
              params,
              iterations: Array(100).fill(0).map((_, i) => i)
            })
          }).promise();
          
          await updateSimulationStatus(simulationId, 'running', {
            executionArn: execution.executionArn
          });
        }
        
        metrics.addMetric('SimulationInitialized', 'Count', 1);
        
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
          },
          body: JSON.stringify({
            success: true,
            simulationId,
            bodyCount: simulation.bodies.length,
            statistics: simulation.statistics,
            state: initialState
          })
        };
      }
      
      case 'step': {
        // Try to get from cache first
        let currentState = await getCachedState(simulationId);
        
        if (!currentState) {
          // Load from S3
          try {
            const s3Data = await s3.getObject({
              Bucket: process.env.S3_BUCKET,
              Key: `simulations/${simulationId}/current.json`
            }).promise();
            currentState = JSON.parse(s3Data.Body.toString());
          } catch (error) {
            // Fallback to initial state
            const initialData = await s3.getObject({
              Bucket: process.env.S3_BUCKET,
              Key: `simulations/${simulationId}/initial.json`
            }).promise();
            currentState = JSON.parse(initialData.Body.toString());
          }
        }
        
        // Get metadata
        const metadata = await getSimulationMetadata(simulationId);
        if (!metadata) {
          throw new Error('Simulation not found');
        }
        
        // Recreate simulation and run steps
        const simulation = new EnhancedGalaxySimulation(metadata.params, simulationId);
        
        // Restore state (simplified - in production would restore full state)
        if (currentState.positions) {
          // Decode positions from base64
          const positions = new Float32Array(
            Buffer.from(currentState.positions, 'base64').buffer
          );
          
          for (let i = 0; i < simulation.bodies.length && i * 3 < positions.length; i++) {
            simulation.bodies[i].position = [
              positions[i * 3],
              positions[i * 3 + 1],
              positions[i * 3 + 2]
            ];
          }
        }
        
        // Run simulation steps
        const startTime = Date.now();
        for (let i = 0; i < steps; i++) {
          simulation.update();
          simulation.simulationTime = (currentState.simulationTime || 0) + (i + 1) * simulation.params.dt;
        }
        const computeTime = Date.now() - startTime;
        
        const newState = simulation.getCompressedState();
        
        // Save to S3
        await saveToS3(
          `simulations/${simulationId}/current.json`,
          newState,
          { userId: metadata.userId, step: (metadata.currentStep || 0) + steps }
        );
        
        // Update cache
        await setCachedState(simulationId, newState);
        
        // Update metadata
        await updateSimulationStatus(simulationId, 'running', {
          currentStep: (metadata.currentStep || 0) + steps,
          simulationTime: newState.simulationTime,
          lastComputeTime: computeTime
        });
        
        metrics.addMetric('SimulationStepTime', 'Milliseconds', computeTime);
        metrics.addMetric('SimulationSteps', 'Count', steps);
        
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
          },
          body: JSON.stringify({
            success: true,
            simulationId,
            state: newState,
            computeTime,
            statistics: simulation.statistics
          })
        };
      }
      
      case 'query': {
        const metadata = await getSimulationMetadata(simulationId);
        if (!metadata) {
          return {
            statusCode: 404,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Simulation not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            success: true,
            metadata
          })
        };
      }
      
      case 'export': {
        const format = params.format || 'json';
        const includeHistory = params.includeHistory || false;
        
        // Generate signed URL for download
        const key = `exports/${simulationId}/export-${Date.now()}.${format}`;
        
        // TODO: Implement export logic based on format
        
        const signedUrl = await s3.getSignedUrlPromise('getObject', {
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Expires: 3600
        });
        
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            success: true,
            downloadUrl: signedUrl
          })
        };
      }
      
      default:
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }
    
  } catch (error) {
    logger.error('Handler error', { error: error.message, stack: error.stack });
    metrics.addMetric('HandlerError', 'Count', 1);
    
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
    
  } finally {
    subsegment.close();
    metrics.publishStoredMetrics();
  }
};