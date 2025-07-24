const AWS = require('aws-sdk');
const { Logger } = require('@aws-lambda-powertools/logger');
const { Metrics, MetricUnits } = require('@aws-lambda-powertools/metrics');
const { Tracer } = require('@aws-lambda-powertools/tracer');

// Initialize AWS services
const cloudwatch = new AWS.CloudWatch();
const xray = AWS.XRay;

// Initialize Powertools
const logger = new Logger({ serviceName: 'galaxy-simulator' });
const metrics = new Metrics({ namespace: 'GalaxySimulator', serviceName: 'galaxy-simulator' });
const tracer = new Tracer({ serviceName: 'galaxy-simulator' });

// Custom metrics helper
class SimulationMetrics {
  constructor(environment = 'development') {
    this.environment = environment;
    this.namespace = 'GalaxySimulator';
    this.dimensions = [
      { Name: 'Environment', Value: environment },
      { Name: 'Service', Value: 'GalaxySimulator' }
    ];
  }

  // Record simulation performance metrics
  async recordSimulationMetrics(simulationId, metrics) {
    const timestamp = new Date();
    
    const metricData = [
      {
        MetricName: 'SimulationBodyCount',
        Value: metrics.bodyCount,
        Unit: 'Count',
        Dimensions: [...this.dimensions, { Name: 'SimulationId', Value: simulationId }],
        Timestamp: timestamp
      },
      {
        MetricName: 'SimulationComputeTime',
        Value: metrics.computeTime,
        Unit: 'Milliseconds',
        Dimensions: [...this.dimensions, { Name: 'SimulationId', Value: simulationId }],
        Timestamp: timestamp
      },
      {
        MetricName: 'SimulationMemoryUsage',
        Value: metrics.memoryUsage,
        Unit: 'Megabytes',
        Dimensions: [...this.dimensions, { Name: 'SimulationId', Value: simulationId }],
        Timestamp: timestamp
      },
      {
        MetricName: 'SimulationTotalEnergy',
        Value: Math.abs(metrics.totalEnergy),
        Unit: 'None',
        Dimensions: [...this.dimensions, { Name: 'SimulationId', Value: simulationId }],
        Timestamp: timestamp
      },
      {
        MetricName: 'SimulationViralRatio',
        Value: metrics.viralRatio,
        Unit: 'None',
        Dimensions: [...this.dimensions, { Name: 'SimulationId', Value: simulationId }],
        Timestamp: timestamp
      }
    ];

    if (metrics.frameRate) {
      metricData.push({
        MetricName: 'SimulationFrameRate',
        Value: metrics.frameRate,
        Unit: 'Count/Second',
        Dimensions: [...this.dimensions, { Name: 'SimulationId', Value: simulationId }],
        Timestamp: timestamp
      });
    }

    try {
      await cloudwatch.putMetricData({
        Namespace: this.namespace,
        MetricData: metricData
      }).promise();
      
      logger.info('Simulation metrics recorded', { simulationId, metrics });
    } catch (error) {
      logger.error('Failed to record simulation metrics', { error: error.message, simulationId });
    }
  }

  // Record API performance metrics
  async recordAPIMetrics(endpoint, method, statusCode, latency) {
    const timestamp = new Date();
    
    const metricData = [
      {
        MetricName: 'APIRequestCount',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          ...this.dimensions,
          { Name: 'Endpoint', Value: endpoint },
          { Name: 'Method', Value: method },
          { Name: 'StatusCode', Value: statusCode.toString() }
        ],
        Timestamp: timestamp
      },
      {
        MetricName: 'APILatency',
        Value: latency,
        Unit: 'Milliseconds',
        Dimensions: [
          ...this.dimensions,
          { Name: 'Endpoint', Value: endpoint },
          { Name: 'Method', Value: method }
        ],
        Timestamp: timestamp
      }
    ];

    try {
      await cloudwatch.putMetricData({
        Namespace: this.namespace,
        MetricData: metricData
      }).promise();
    } catch (error) {
      logger.error('Failed to record API metrics', { error: error.message });
    }
  }

  // Record cache performance metrics
  async recordCacheMetrics(operation, hit, latency) {
    const timestamp = new Date();
    
    const metricData = [
      {
        MetricName: hit ? 'CacheHits' : 'CacheMisses',
        Value: 1,
        Unit: 'Count',
        Dimensions: [...this.dimensions, { Name: 'Operation', Value: operation }],
        Timestamp: timestamp
      },
      {
        MetricName: 'CacheLatency',
        Value: latency,
        Unit: 'Milliseconds',
        Dimensions: [...this.dimensions, { Name: 'Operation', Value: operation }],
        Timestamp: timestamp
      }
    ];

    try {
      await cloudwatch.putMetricData({
        Namespace: this.namespace,
        MetricData: metricData
      }).promise();
    } catch (error) {
      logger.error('Failed to record cache metrics', { error: error.message });
    }
  }

  // Record custom business metrics
  async recordBusinessMetrics(metricName, value, unit = 'Count', additionalDimensions = []) {
    const timestamp = new Date();
    
    try {
      await cloudwatch.putMetricData({
        Namespace: this.namespace,
        MetricData: [{
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Dimensions: [...this.dimensions, ...additionalDimensions],
          Timestamp: timestamp
        }]
      }).promise();
    } catch (error) {
      logger.error('Failed to record business metrics', { error: error.message, metricName });
    }
  }
}

// Enhanced logging with structured data
class StructuredLogger {
  constructor(context = {}) {
    this.context = context;
  }

  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data,
      environment: process.env.ENVIRONMENT || 'development',
      service: 'galaxy-simulator',
      version: process.env.VERSION || 'unknown'
    };

    // Add correlation ID from X-Ray if available
    const segment = tracer.getSegment();
    if (segment) {
      logEntry.traceId = segment.trace_id;
      logEntry.segmentId = segment.id;
    }

    logger[level](message, logEntry);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  debug(message, data) {
    this.log('debug', message, data);
  }

  // Log performance data
  performance(operation, duration, data = {}) {
    this.log('info', `Performance: ${operation}`, {
      operation,
      duration,
      performanceData: data
    });
  }

  // Log business events
  event(eventType, data = {}) {
    this.log('info', `Business Event: ${eventType}`, {
      eventType,
      eventData: data
    });
  }
}

// Distributed tracing helper
class DistributedTracer {
  constructor() {
    this.tracer = tracer;
  }

  // Create a new subsegment for tracking operations
  async traceOperation(name, operation, metadata = {}) {
    const segment = this.tracer.getSegment();
    const subsegment = segment.addNewSubsegment(name);
    
    try {
      // Add metadata to subsegment
      Object.entries(metadata).forEach(([key, value]) => {
        subsegment.addMetadata(key, value);
      });
      
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      
      subsegment.addAnnotation('duration', duration);
      subsegment.addAnnotation('success', true);
      
      return result;
    } catch (error) {
      subsegment.addError(error);
      subsegment.addAnnotation('success', false);
      throw error;
    } finally {
      subsegment.close();
    }
  }

  // Add custom annotations to current segment
  addAnnotation(key, value) {
    const segment = this.tracer.getSegment();
    if (segment) {
      segment.addAnnotation(key, value);
    }
  }

  // Add custom metadata to current segment
  addMetadata(namespace, key, value) {
    const segment = this.tracer.getSegment();
    if (segment) {
      segment.addMetadata(namespace, key, value);
    }
  }

  // Trace HTTP requests
  async traceHTTPRequest(url, options, metadata = {}) {
    return this.traceOperation('HTTP Request', async () => {
      const https = tracer.captureHTTPsGlobal(require('https'));
      const http = tracer.captureHTTPsGlobal(require('http'));
      
      // Add request metadata
      this.addMetadata('http', 'url', url);
      this.addMetadata('http', 'method', options.method || 'GET');
      
      // Make request (simplified - in production use proper HTTP client)
      const response = await new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.request(url, options, resolve);
        req.on('error', reject);
        req.end();
      });
      
      this.addMetadata('http', 'statusCode', response.statusCode);
      return response;
    }, metadata);
  }

  // Trace AWS SDK calls
  captureAWS(awsService) {
    return tracer.captureAWS(awsService);
  }
}

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = new SimulationMetrics(process.env.ENVIRONMENT);
    this.logger = new StructuredLogger();
  }

  // Monitor Lambda function performance
  async monitorLambdaPerformance(handler, event, context) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await handler(event, context);
      
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      const memoryDelta = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;
      
      // Record performance metrics
      await this.metrics.recordBusinessMetrics('LambdaExecutionTime', duration, 'Milliseconds', [
        { Name: 'FunctionName', Value: context.functionName }
      ]);
      
      await this.metrics.recordBusinessMetrics('LambdaMemoryDelta', memoryDelta, 'Megabytes', [
        { Name: 'FunctionName', Value: context.functionName }
      ]);
      
      this.logger.performance('Lambda Execution', duration, {
        functionName: context.functionName,
        requestId: context.awsRequestId,
        memoryDelta,
        memoryLimit: context.memoryLimitInMB
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await this.metrics.recordBusinessMetrics('LambdaErrors', 1, 'Count', [
        { Name: 'FunctionName', Value: context.functionName },
        { Name: 'ErrorType', Value: error.constructor.name }
      ]);
      
      this.logger.error('Lambda execution failed', {
        functionName: context.functionName,
        requestId: context.awsRequestId,
        duration,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  // Create performance checkpoint
  checkpoint(name) {
    const timestamp = Date.now();
    return {
      name,
      timestamp,
      elapsed: () => Date.now() - timestamp
    };
  }

  // Monitor database operations
  async monitorDatabaseOperation(operation, operationType, table) {
    const checkpoint = this.checkpoint(`DB:${operationType}:${table}`);
    
    try {
      const result = await operation();
      const elapsed = checkpoint.elapsed();
      
      await this.metrics.recordBusinessMetrics('DatabaseOperationLatency', elapsed, 'Milliseconds', [
        { Name: 'Operation', Value: operationType },
        { Name: 'Table', Value: table }
      ]);
      
      this.logger.performance(`Database ${operationType}`, elapsed, { table });
      
      return result;
    } catch (error) {
      const elapsed = checkpoint.elapsed();
      
      await this.metrics.recordBusinessMetrics('DatabaseOperationErrors', 1, 'Count', [
        { Name: 'Operation', Value: operationType },
        { Name: 'Table', Value: table },
        { Name: 'ErrorType', Value: error.constructor.name }
      ]);
      
      this.logger.error(`Database operation failed`, {
        operation: operationType,
        table,
        elapsed,
        error: error.message
      });
      
      throw error;
    }
  }
}

// Alert manager for critical events
class AlertManager {
  constructor() {
    this.sns = new AWS.SNS();
    this.logger = new StructuredLogger();
  }

  async sendAlert(severity, title, message, data = {}) {
    const topicArn = process.env.ALERT_TOPIC_ARN;
    if (!topicArn) {
      this.logger.warn('Alert topic ARN not configured', { severity, title });
      return;
    }

    const alertMessage = {
      severity,
      title,
      message,
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'development',
      service: 'galaxy-simulator',
      data
    };

    try {
      await this.sns.publish({
        TopicArn: topicArn,
        Subject: `[${severity.toUpperCase()}] ${title}`,
        Message: JSON.stringify(alertMessage, null, 2)
      }).promise();
      
      this.logger.info('Alert sent', { severity, title });
    } catch (error) {
      this.logger.error('Failed to send alert', {
        error: error.message,
        severity,
        title
      });
    }
  }

  async critical(title, message, data) {
    await this.sendAlert('critical', title, message, data);
  }

  async warning(title, message, data) {
    await this.sendAlert('warning', title, message, data);
  }

  async info(title, message, data) {
    await this.sendAlert('info', title, message, data);
  }
}

// Export monitoring utilities
module.exports = {
  logger,
  metrics,
  tracer,
  SimulationMetrics,
  StructuredLogger,
  DistributedTracer,
  PerformanceMonitor,
  AlertManager,
  
  // Middleware for automatic tracing
  tracingMiddleware: (handler) => async (event, context) => {
    return tracer.captureLambdaHandler(handler)(event, context);
  },
  
  // Middleware for automatic metrics
  metricsMiddleware: (handler) => async (event, context) => {
    metrics.captureColdStartMetric();
    
    try {
      const result = await handler(event, context);
      metrics.addMetric('SuccessfulInvocation', MetricUnits.Count, 1);
      return result;
    } catch (error) {
      metrics.addMetric('FailedInvocation', MetricUnits.Count, 1);
      throw error;
    } finally {
      metrics.publishStoredMetrics();
    }
  },
  
  // Combined middleware
  withMonitoring: (handler) => {
    const monitor = new PerformanceMonitor();
    return tracer.captureLambdaHandler(async (event, context) => {
      return monitor.monitorLambdaPerformance(
        metricsMiddleware(handler),
        event,
        context
      );
    });
  }
};