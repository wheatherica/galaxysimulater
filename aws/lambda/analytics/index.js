const AWS = require('aws-sdk');
const { Logger } = require('@aws-lambda-powertools/logger');
const { Metrics } = require('@aws-lambda-powertools/metrics');
const { Tracer } = require('@aws-lambda-powertools/tracer');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();

const logger = new Logger();
const metrics = new Metrics();
const tracer = new Tracer();

exports.handler = async (event, context) => {
    logger.addContext(context);
    
    try {
        logger.info('Running analytics', { event });
        
        // Analyze simulation metrics
        const startTime = Date.now();
        
        // Get simulation statistics from DynamoDB
        const stats = await getSimulationStatistics();
        
        // Publish custom metrics
        await publishAnalyticsMetrics(stats);
        
        const processingTime = Date.now() - startTime;
        
        metrics.addMetric('AnalyticsProcessingTime', 'Milliseconds', processingTime);
        
        logger.info('Analytics completed', {
            stats,
            processingTime
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                stats,
                processingTime
            })
        };
        
    } catch (error) {
        logger.error('Analytics failed', { error: error.message });
        metrics.addMetric('AnalyticsErrors', 'Count', 1);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    } finally {
        metrics.publishStoredMetrics();
    }
};

async function getSimulationStatistics() {
    try {
        const params = {
            TableName: process.env.METADATA_TABLE,
            Select: 'COUNT'
        };
        
        const result = await dynamodb.scan(params).promise();
        
        return {
            totalSimulations: result.Count || 0,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.warn('Failed to get statistics', { error: error.message });
        return {
            totalSimulations: 0,
            timestamp: new Date().toISOString()
        };
    }
}

async function publishAnalyticsMetrics(stats) {
    try {
        const params = {
            Namespace: 'GalaxySimulator/Analytics',
            MetricData: [
                {
                    MetricName: 'TotalSimulations',
                    Value: stats.totalSimulations,
                    Unit: 'Count',
                    Timestamp: new Date()
                }
            ]
        };
        
        await cloudwatch.putMetricData(params).promise();
        logger.info('Published analytics metrics', { stats });
    } catch (error) {
        logger.error('Failed to publish metrics', { error: error.message });
    }
}