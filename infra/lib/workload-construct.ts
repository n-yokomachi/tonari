import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as python from '@aws-cdk/aws-lambda-python-alpha'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as scheduler from 'aws-cdk-lib/aws-scheduler'
import * as targets from 'aws-cdk-lib/aws-scheduler-targets'
import { Construct } from 'constructs'
import * as path from 'path'

export interface WorkloadConstructProps {
  /** Cognito User Pool ID for API Gateway authorizer Lambda */
  cognitoUserPoolId: string
  /** Cognito Client ID for API Gateway authorizer Lambda */
  cognitoClientId: string
  /** Tweet scheduler config (optional) */
  tweetScheduler?: {
    ownerTwitterUserId: string
    /** Cognito Token Endpoint (CDK-created) */
    cognitoTokenEndpoint: string
    /** Cognito OAuth scope (CDK-created) */
    cognitoScope: string
    /** SSM parameter path for Cognito client secret */
    ssmCognitoClientSecret: string
  }
}

export class WorkloadConstruct extends Construct {
  public readonly perfumeTable: dynamodb.Table
  public readonly searchLambda: python.PythonFunction
  public readonly crudApi: apigateway.RestApi
  public readonly twitterReadLambda?: python.PythonFunction
  public readonly twitterWriteLambda?: python.PythonFunction
  public readonly tweetTriggerLambda?: python.PythonFunction

  constructor(scope: Construct, id: string, props: WorkloadConstructProps) {
    super(scope, id)

    const { cognitoUserPoolId, cognitoClientId } = props
    // Use stack scope for all resources to preserve CloudFormation logical IDs
    // from before the WorkloadConstruct refactoring
    const stack = cdk.Stack.of(this)
    const region = stack.region
    const account = stack.account

    // DynamoDB Table (PK=brand, SK=name)
    this.perfumeTable = new dynamodb.Table(stack, 'PerfumeTable', {
      tableName: 'tonari-perfumes',
      partitionKey: { name: 'brand', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'name', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // Lambda for perfume search (AgentCore Gateway Target)
    this.searchLambda = new python.PythonFunction(
      stack,
      'PerfumeSearchLambda',
      {
        functionName: 'tonari-perfume-search',
        entry: path.join(__dirname, '../lambda/perfume-search'),
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 128,
        environment: {
          TABLE_NAME: this.perfumeTable.tableName,
        },
      }
    )

    // Grant read access to the Lambda
    this.perfumeTable.grantReadData(this.searchLambda)

    // Lambda for CRUD operations (API Gateway)
    const crudLambda = new python.PythonFunction(stack, 'PerfumeCrudLambda', {
      functionName: 'tonari-perfume-crud',
      entry: path.join(__dirname, '../lambda/perfume-crud'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        TABLE_NAME: this.perfumeTable.tableName,
      },
    })

    // Grant full access to CRUD Lambda
    this.perfumeTable.grantReadWriteData(crudLambda)

    // Lambda Authorizer for M2M token validation
    const authorizerLambda = new python.PythonFunction(
      stack,
      'ApiAuthorizerLambda',
      {
        functionName: 'tonari-api-authorizer',
        entry: path.join(__dirname, '../lambda/api-authorizer'),
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'handler',
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          COGNITO_REGION: region,
          COGNITO_USER_POOL_ID: cognitoUserPoolId,
          COGNITO_CLIENT_ID: cognitoClientId,
        },
      }
    )

    // API Gateway
    this.crudApi = new apigateway.RestApi(stack, 'PerfumeCrudApi', {
      restApiName: 'tonari-perfume-api',
      description: 'Tonari Perfume CRUD API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    })

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(crudLambda)

    // Lambda Authorizer for M2M authentication
    const lambdaAuthorizer = new apigateway.TokenAuthorizer(
      stack,
      'LambdaAuthorizer',
      {
        handler: authorizerLambda,
        resultsCacheTtl: cdk.Duration.minutes(5),
      }
    )

    // Method options with authorizer
    const authorizedMethodOptions: apigateway.MethodOptions = {
      authorizer: lambdaAuthorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    }

    // TTS Lambda (Amazon Polly)
    const ttsLambda = new python.PythonFunction(stack, 'TtsLambda', {
      functionName: 'tonari-tts',
      entry: path.join(__dirname, '../lambda/tts'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
    })

    ttsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['polly:SynthesizeSpeech'],
        resources: ['*'],
      })
    )

    // API Routes (M2M auth)
    const perfumes = this.crudApi.root.addResource('perfumes')
    perfumes.addMethod('GET', lambdaIntegration, authorizedMethodOptions)
    perfumes.addMethod('POST', lambdaIntegration, authorizedMethodOptions)

    const perfumeByBrand = perfumes.addResource('{brand}')
    const perfumeByName = perfumeByBrand.addResource('{name}')
    perfumeByName.addMethod('GET', lambdaIntegration, authorizedMethodOptions)
    perfumeByName.addMethod('PUT', lambdaIntegration, authorizedMethodOptions)
    perfumeByName.addMethod(
      'DELETE',
      lambdaIntegration,
      authorizedMethodOptions
    )

    // POST /tts - Text-to-Speech
    const tts = this.crudApi.root.addResource('tts')
    tts.addMethod(
      'POST',
      new apigateway.LambdaIntegration(ttsLambda),
      authorizedMethodOptions
    )

    // ========== Twitter Gateway Tools ==========
    if (props.tweetScheduler) {
      const ts = props.tweetScheduler

      // Twitter Read Lambda (AgentCore Gateway Target)
      this.twitterReadLambda = new python.PythonFunction(
        stack,
        'TwitterReadLambda',
        {
          functionName: 'tonari-twitter-read',
          entry: path.join(__dirname, '../lambda/twitter-read'),
          runtime: lambda.Runtime.PYTHON_3_12,
          handler: 'handler',
          timeout: cdk.Duration.seconds(30),
          memorySize: 128,
        }
      )

      this.twitterReadLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [
            `arn:aws:ssm:${region}:${account}:parameter/tonari/twitter/bearer_token`,
          ],
        })
      )

      // Twitter Write Lambda (AgentCore Gateway Target)
      this.twitterWriteLambda = new python.PythonFunction(
        stack,
        'TwitterWriteLambda',
        {
          functionName: 'tonari-twitter-write',
          entry: path.join(__dirname, '../lambda/twitter-write'),
          runtime: lambda.Runtime.PYTHON_3_12,
          handler: 'handler',
          timeout: cdk.Duration.seconds(30),
          memorySize: 128,
        }
      )

      this.twitterWriteLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ssm:GetParametersByPath'],
          resources: [
            `arn:aws:ssm:${region}:${account}:parameter/tonari/twitter`,
            `arn:aws:ssm:${region}:${account}:parameter/tonari/twitter/*`,
          ],
        })
      )

      // Tweet Trigger Lambda
      // AGENTCORE_RUNTIME_ARN is set by the stack after AgentCoreConstruct creation
      this.tweetTriggerLambda = new python.PythonFunction(
        stack,
        'TweetTriggerLambda',
        {
          functionName: 'tonari-tweet-trigger',
          entry: path.join(__dirname, '../lambda/tweet-trigger'),
          runtime: lambda.Runtime.PYTHON_3_12,
          handler: 'handler',
          timeout: cdk.Duration.minutes(5),
          memorySize: 128,
          environment: {
            OWNER_TWITTER_USER_ID: ts.ownerTwitterUserId,
            AGENTCORE_REGION: region,
            COGNITO_TOKEN_ENDPOINT: ts.cognitoTokenEndpoint,
            COGNITO_CLIENT_ID: cognitoClientId,
            COGNITO_SCOPE: ts.cognitoScope,
            SSM_COGNITO_CLIENT_SECRET: ts.ssmCognitoClientSecret,
          },
        }
      )

      this.tweetTriggerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [
            `arn:aws:ssm:${region}:${account}:parameter${ts.ssmCognitoClientSecret}`,
          ],
        })
      )

      const tweetTarget = new targets.LambdaInvoke(this.tweetTriggerLambda)

      // EventBridge Schedules
      new scheduler.Schedule(stack, 'TweetScheduleMorning', {
        scheduleName: 'tonari-tweet-morning',
        schedule: scheduler.ScheduleExpression.cron({
          minute: '0',
          hour: '9',
          timeZone: cdk.TimeZone.ASIA_TOKYO,
        }),
        target: tweetTarget,
      })

      new scheduler.Schedule(stack, 'TweetScheduleNoon', {
        scheduleName: 'tonari-tweet-noon',
        schedule: scheduler.ScheduleExpression.cron({
          minute: '0',
          hour: '12',
          timeZone: cdk.TimeZone.ASIA_TOKYO,
        }),
        target: tweetTarget,
      })

      new scheduler.Schedule(stack, 'TweetScheduleEvening', {
        scheduleName: 'tonari-tweet-evening',
        schedule: scheduler.ScheduleExpression.cron({
          minute: '0',
          hour: '18',
          timeZone: cdk.TimeZone.ASIA_TOKYO,
        }),
        target: tweetTarget,
      })

      new scheduler.Schedule(stack, 'TweetScheduleNight', {
        scheduleName: 'tonari-tweet-night',
        schedule: scheduler.ScheduleExpression.cron({
          minute: '0',
          hour: '21',
          timeZone: cdk.TimeZone.ASIA_TOKYO,
        }),
        target: tweetTarget,
      })
    }
  }
}
