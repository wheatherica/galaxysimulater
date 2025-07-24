import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as xray from 'aws-cdk-lib/aws-xray';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import * as path from 'path';

export interface GalaxySimulatorStackProps extends cdk.StackProps {
  environment: 'development' | 'staging' | 'production';
  domainName?: string;
  enableMonitoring?: boolean;
  enableCache?: boolean;
  notificationEmail?: string;
}

export class GalaxySimulatorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GalaxySimulatorStackProps) {
    super(scope, id, props);

    const isProd = props.environment === 'production';
    const enableMonitoring = props.enableMonitoring ?? isProd;
    const enableCache = props.enableCache ?? isProd;

    // VPC for Lambda functions
    const vpc = new ec2.Vpc(this, 'SimulatorVPC', {
      maxAzs: 2,
      natGateways: isProd ? 2 : 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // S3 Buckets
    const dataBucket = new s3.Bucket(this, 'SimulationDataBucket', {
      bucketName: `galaxy-sim-data-${props.environment}-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldSimulations',
          enabled: true,
          expiration: cdk.Duration.days(30),
          noncurrentVersionExpiration: cdk.Duration.days(7),
          prefix: 'simulations/',
        },
        {
          id: 'TransitionToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(7),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          prefix: 'simulations/',
        },
      ],
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'],
          maxAge: 3600,
        },
      ],
    });

    const assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: `galaxy-sim-assets-${props.environment}-${this.account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: true,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
    });

    // DynamoDB Tables
    const metadataTable = new dynamodb.Table(this, 'SimulationMetadataTable', {
      tableName: `galaxy-sim-metadata-${props.environment}`,
      partitionKey: { name: 'simulationId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      pointInTimeRecovery: isProd,
      timeToLiveAttribute: 'ttl',
    });

    metadataTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
    });

    metadataTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
    });

    const configTable = new dynamodb.Table(this, 'SimulationConfigTable', {
      tableName: `galaxy-sim-config-${props.environment}`,
      partitionKey: { name: 'configId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // ElastiCache
    let cacheCluster: elasticache.CfnCacheCluster | undefined;
    let cacheSecurityGroup: ec2.SecurityGroup | undefined;

    if (enableCache) {
      const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, 'CacheSubnetGroup', {
        description: 'Subnet group for Galaxy Simulator cache',
        subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      });

      cacheSecurityGroup = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
        vpc,
        description: 'Security group for ElastiCache',
        allowAllOutbound: false,
      });

      cacheCluster = new elasticache.CfnCacheCluster(this, 'SimulationCache', {
        cacheNodeType: isProd ? 'cache.r6g.large' : 'cache.t3.micro',
        engine: 'redis',
        numCacheNodes: 1,
        cacheSubnetGroupName: cacheSubnetGroup.ref,
        vpcSecurityGroupIds: [cacheSecurityGroup.securityGroupId],
      });
    }

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `galaxy-simulator-users-${props.environment}`,
      selfSignUpEnabled: true,
      userVerification: {
        emailSubject: 'Verify your Galaxy Simulator account',
        emailBody: 'Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      signInAliases: {
        email: true,
        username: false,
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: `galaxy-simulator-client-${props.environment}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
    });

    // Lambda Layers
    const dependenciesLayer = new lambda.LayerVersion(this, 'DependenciesLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../aws/lambda/layers/dependencies')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Common dependencies for Galaxy Simulator',
    });

    // Lambda Functions
    const lambdaRole = new iam.Role(this, 'SimulationLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    if (enableMonitoring) {
      lambdaRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
      );
    }

    // Grant permissions
    dataBucket.grantReadWrite(lambdaRole);
    metadataTable.grantReadWriteData(lambdaRole);
    configTable.grantReadWriteData(lambdaRole);

    const lambdaEnvironment: { [key: string]: string } = {
      S3_BUCKET: dataBucket.bucketName,
      METADATA_TABLE: metadataTable.tableName,
      CONFIG_TABLE: configTable.tableName,
      ENVIRONMENT: props.environment,
      POWERTOOLS_SERVICE_NAME: 'galaxy-simulator',
      POWERTOOLS_METRICS_NAMESPACE: 'GalaxySimulator',
      LOG_LEVEL: isProd ? 'INFO' : 'DEBUG',
    };

    if (cacheCluster) {
      lambdaEnvironment.CACHE_ENDPOINT = cacheCluster.attrRedisEndpointAddress;
    }

    const simulationFunction = new lambda.Function(this, 'SimulationFunction', {
      functionName: `galaxy-simulator-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'enhanced-index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../aws/lambda/galaxy-simulator')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(300),
      memorySize: 3008,
      layers: [dependenciesLayer],
      vpc: enableCache ? vpc : undefined,
      vpcSubnets: enableCache ? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } : undefined,
      tracing: enableMonitoring ? lambda.Tracing.ACTIVE : lambda.Tracing.PASS_THROUGH,
      reservedConcurrentExecutions: isProd ? 100 : undefined,
    });

    if (cacheSecurityGroup) {
      cacheSecurityGroup.addIngressRule(
        simulationFunction.connections.securityGroups[0],
        ec2.Port.tcp(6379),
        'Allow Lambda to access Redis'
      );
    }

    const batchProcessorFunction = new lambda.Function(this, 'BatchProcessorFunction', {
      functionName: `galaxy-batch-processor-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../aws/lambda/batch-processor')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(900),
      memorySize: 10240,
      ephemeralStorageSize: cdk.Size.gibibytes(10),
      layers: [dependenciesLayer],
      tracing: enableMonitoring ? lambda.Tracing.ACTIVE : lambda.Tracing.PASS_THROUGH,
    });

    const analyticsFunction = new lambda.Function(this, 'AnalyticsFunction', {
      functionName: `galaxy-analytics-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../aws/lambda/analytics')),
      role: lambdaRole,
      environment: lambdaEnvironment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      layers: [dependenciesLayer],
      tracing: enableMonitoring ? lambda.Tracing.ACTIVE : lambda.Tracing.PASS_THROUGH,
    });

    // Step Functions
    const waitState = new stepfunctions.Wait(this, 'WaitBetweenSteps', {
      time: stepfunctions.WaitTime.duration(cdk.Duration.seconds(1)),
    });

    const initializeTask = new sfnTasks.LambdaInvoke(this, 'InitializeSimulation', {
      lambdaFunction: simulationFunction,
      outputPath: '$.Payload',
    });

    const batchProcessTask = new sfnTasks.LambdaInvoke(this, 'ProcessBatch', {
      lambdaFunction: batchProcessorFunction,
      outputPath: '$.Payload',
    });

    const finalizeTask = new sfnTasks.LambdaInvoke(this, 'FinalizeSimulation', {
      lambdaFunction: simulationFunction,
      outputPath: '$.Payload',
    });

    const definition = initializeTask
      .next(waitState)
      .next(
        new stepfunctions.Map(this, 'ProcessBatches', {
          maxConcurrency: 10,
          itemsPath: '$.iterations',
        }).iterator(batchProcessTask)
      )
      .next(finalizeTask);

    const stateMachine = new stepfunctions.StateMachine(this, 'SimulationStateMachine', {
      stateMachineName: `galaxy-simulation-workflow-${props.environment}`,
      definition,
      timeout: cdk.Duration.hours(24),
      tracingEnabled: enableMonitoring,
    });

    stateMachine.grantStartExecution(lambdaRole);
    lambdaEnvironment.STATE_MACHINE_ARN = stateMachine.stateMachineArn;

    // API Gateway
    const api = new apigateway.RestApi(this, 'SimulationAPI', {
      restApiName: `galaxy-simulator-api-${props.environment}`,
      deployOptions: {
        stageName: props.environment,
        tracingEnabled: enableMonitoring,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: !isProd,
        metricsEnabled: true,
        throttlingBurstLimit: isProd ? 5000 : 1000,
        throttlingRateLimit: isProd ? 2000 : 500,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'CognitoAuthorizer',
    });

    const simulateIntegration = new apigateway.LambdaIntegration(simulationFunction);
    
    const simulateResource = api.root.addResource('simulate');
    simulateResource.addMethod('POST', simulateIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // API Gateway Usage Plan
    const usagePlan = new apigateway.UsagePlan(this, 'UsagePlan', {
      name: `galaxy-simulator-usage-${props.environment}`,
      throttle: {
        rateLimit: isProd ? 10000 : 1000,
        burstLimit: isProd ? 20000 : 2000,
      },
      quota: {
        limit: isProd ? 1000000 : 10000,
        period: apigateway.Period.DAY,
      },
    });

    usagePlan.addApiStage({
      api,
      stage: api.deploymentStage,
    });

    // EventBridge
    const eventBus = new events.EventBus(this, 'SimulationEventBus', {
      eventBusName: `galaxy-simulator-events-${props.environment}`,
    });

    const eventRule = new events.Rule(this, 'SimulationEventRule', {
      eventBus,
      eventPattern: {
        source: ['galaxy.simulator'],
        detailType: ['Simulation Started', 'Simulation Completed', 'Simulation Failed'],
      },
    });

    eventRule.addTarget(new targets.LambdaFunction(analyticsFunction));

    // Scheduled Analytics
    const scheduledRule = new events.Rule(this, 'ScheduledAnalytics', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      enabled: isProd,
    });

    scheduledRule.addTarget(new targets.LambdaFunction(analyticsFunction));

    // Monitoring and Alarms
    if (enableMonitoring) {
      const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
        topicName: `galaxy-sim-alarms-${props.environment}`,
        displayName: 'Galaxy Simulator Alarms',
      });

      if (props.notificationEmail) {
        alarmTopic.addSubscription(
          new snsSubscriptions.EmailSubscription(props.notificationEmail)
        );
      }

      // Lambda Function Alarms
      const functionErrorAlarm = new cloudwatch.Alarm(this, 'FunctionErrorAlarm', {
        alarmName: `galaxy-sim-function-errors-${props.environment}`,
        metric: simulationFunction.metricErrors(),
        threshold: 10,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      functionErrorAlarm.addAlarmAction(
        new cloudwatchActions.SnsAction(alarmTopic)
      );

      const functionDurationAlarm = new cloudwatch.Alarm(this, 'FunctionDurationAlarm', {
        alarmName: `galaxy-sim-function-duration-${props.environment}`,
        metric: simulationFunction.metricDuration(),
        threshold: 240000, // 4 minutes
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      functionDurationAlarm.addAlarmAction(
        new cloudwatchActions.SnsAction(alarmTopic)
      );

      const apiGateway4xxAlarm = new cloudwatch.Alarm(this, 'ApiGateway4xxAlarm', {
        alarmName: `galaxy-sim-api-4xx-${props.environment}`,
        metric: api.metricClientError(),
        threshold: 100,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      apiGateway4xxAlarm.addAlarmAction(
        new cloudwatchActions.SnsAction(alarmTopic)
      );

      const apiGateway5xxAlarm = new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
        alarmName: `galaxy-sim-api-5xx-${props.environment}`,
        metric: api.metricServerError(),
        threshold: 10,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      apiGateway5xxAlarm.addAlarmAction(
        new cloudwatchActions.SnsAction(alarmTopic)
      );

      // DynamoDB Alarms
      const userErrorsAlarm = new cloudwatch.Alarm(this, 'DynamoDBUserErrorsAlarm', {
        alarmName: `galaxy-sim-dynamodb-errors-${props.environment}`,
        metric: metadataTable.metricUserErrors(),
        threshold: 10,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      userErrorsAlarm.addAlarmAction(
        new cloudwatchActions.SnsAction(alarmTopic)
      );

      // CloudWatch Dashboard
      const dashboard = new cloudwatch.Dashboard(this, 'SimulationDashboard', {
        dashboardName: `galaxy-simulator-${props.environment}`,
      });

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Lambda Function Metrics',
          left: [simulationFunction.metricInvocations()],
          right: [simulationFunction.metricErrors()],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'Lambda Duration',
          left: [simulationFunction.metricDuration()],
          width: 12,
        })
      );

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'API Gateway Requests',
          left: [api.metricCount()],
          right: [api.metricClientError(), api.metricServerError()],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'API Gateway Latency',
          left: [api.metricLatency()],
          width: 12,
        })
      );

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'DynamoDB Consumed Capacity',
          left: [
            metadataTable.metricConsumedReadCapacityUnits(),
            metadataTable.metricConsumedWriteCapacityUnits(),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'Step Functions Executions',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/States',
              metricName: 'ExecutionsStarted',
              dimensionsMap: {
                StateMachineArn: stateMachine.stateMachineArn,
              },
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/States',
              metricName: 'ExecutionsSucceeded',
              dimensionsMap: {
                StateMachineArn: stateMachine.stateMachineArn,
              },
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/States',
              metricName: 'ExecutionsFailed',
              dimensionsMap: {
                StateMachineArn: stateMachine.stateMachineArn,
              },
            }),
          ],
          width: 12,
        })
      );

      // X-Ray Service Map
      new xray.CfnGroup(this, 'XRayServiceGroup', {
        groupName: `galaxy-simulator-${props.environment}`,
        filterExpression: `service("galaxy-simulator")`,
      });

      // Synthetic Monitoring (Canaries)
      if (isProd) {
        const canaryRole = new iam.Role(this, 'CanaryRole', {
          assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
          managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchSyntheticsFullAccess'),
          ],
        });

        const canaryBucket = new s3.Bucket(this, 'CanaryBucket', {
          bucketName: `galaxy-sim-canary-${props.environment}-${this.account}`,
          encryption: s3.BucketEncryption.S3_MANAGED,
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          lifecycleRules: [
            {
              expiration: cdk.Duration.days(30),
            },
          ],
        });

        new synthetics.Canary(this, 'ApiCanary', {
          canaryName: `galaxy-sim-api-${props.environment}`,
          runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_9,
          test: synthetics.Test.custom({
            code: lambda.Code.fromAsset(path.join(__dirname, '../../../tests/canary')),
            handler: 'api-canary.handler',
          }),
          schedule: synthetics.Schedule.rate(cdk.Duration.minutes(5)),
          environmentVariables: {
            API_ENDPOINT: api.url,
            USER_POOL_ID: userPool.userPoolId,
            USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
          },
          role: canaryRole,
          artifactsBucketLocation: {
            bucket: canaryBucket,
          },
          failureRetentionPeriod: cdk.Duration.days(30),
          successRetentionPeriod: cdk.Duration.days(7),
        });
      }
    }

    // Amplify App
    const amplifyRole = new iam.Role(this, 'AmplifyRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
    });

    assetsBucket.grantReadWrite(amplifyRole);

    const amplifyApp = new amplify.CfnApp(this, 'AmplifyApp', {
      name: `galaxy-simulator-${props.environment}`,
      repository: 'https://github.com/yourusername/galaxy-simulator',
      iamServiceRole: amplifyRole.roleArn,
      environmentVariables: [
        {
          name: 'REACT_APP_API_ENDPOINT',
          value: api.url,
        },
        {
          name: 'REACT_APP_USER_POOL_ID',
          value: userPool.userPoolId,
        },
        {
          name: 'REACT_APP_USER_POOL_CLIENT_ID',
          value: userPoolClient.userPoolClientId,
        },
        {
          name: 'REACT_APP_ASSETS_BUCKET',
          value: assetsBucket.bucketName,
        },
        {
          name: 'REACT_APP_ENVIRONMENT',
          value: props.environment,
        },
      ],
      buildSpec: `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*`,
    });

    const amplifyBranch = new amplify.CfnBranch(this, 'AmplifyBranch', {
      appId: amplifyApp.attrAppId,
      branchName: props.environment,
      enableAutoBuild: true,
      enablePullRequestPreview: !isProd,
    });

    if (props.domainName) {
      new amplify.CfnDomain(this, 'AmplifyDomain', {
        appId: amplifyApp.attrAppId,
        domainName: props.domainName,
        subDomainSettings: [
          {
            branchName: amplifyBranch.branchName,
            prefix: '',
          },
        ],
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: `${this.stackName}-api-endpoint`,
    });

    new cdk.CfnOutput(this, 'WebAppURL', {
      value: props.domainName
        ? `https://${props.domainName}`
        : `https://${amplifyBranch.branchName}.${amplifyApp.attrDefaultDomain}`,
      description: 'Amplify web app URL',
      exportName: `${this.stackName}-webapp-url`,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${this.stackName}-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: dataBucket.bucketName,
      description: 'S3 bucket for simulation data',
      exportName: `${this.stackName}-s3-bucket`,
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: metadataTable.tableName,
      description: 'DynamoDB table for metadata',
      exportName: `${this.stackName}-metadata-table`,
    });

    if (cacheCluster) {
      new cdk.CfnOutput(this, 'CacheEndpoint', {
        value: cacheCluster.attrRedisEndpointAddress,
        description: 'ElastiCache endpoint',
        exportName: `${this.stackName}-cache-endpoint`,
      });
    }

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
      description: 'Step Functions state machine ARN',
      exportName: `${this.stackName}-state-machine`,
    });
  }
}