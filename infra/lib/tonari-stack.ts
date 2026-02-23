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

export interface TonariStackProps extends cdk.StackProps {
  // Cognito User Pool ID for API Gateway authorization
  cognitoUserPoolId: string
  // Cognito Client ID for M2M authentication
  cognitoClientId: string
  // Tweet scheduler config (optional)
  tweetScheduler?: {
    ownerTwitterUserId: string
    agentcoreRuntimeArn: string
    cognitoTokenEndpoint: string
    cognitoScope: string
    ssmCognitoClientSecret: string
  }
}

export class TonariStack extends cdk.Stack {
  public readonly perfumeTable: dynamodb.Table
  public readonly searchLambda: lambda.IFunction
  public readonly crudApi: apigateway.RestApi

  constructor(scope: Construct, id: string, props: TonariStackProps) {
    super(scope, id, props)

    const { cognitoUserPoolId, cognitoClientId } = props

    // DynamoDB Table (PK=brand, SK=name)
    this.perfumeTable = new dynamodb.Table(this, 'PerfumeTable', {
      tableName: 'tonari-perfumes',
      partitionKey: { name: 'brand', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'name', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // Lambda for perfume search (AgentCore Gateway Target)
    this.searchLambda = new python.PythonFunction(this, 'PerfumeSearchLambda', {
      functionName: 'tonari-perfume-search',
      entry: path.join(__dirname, '../lambda/perfume-search'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        TABLE_NAME: this.perfumeTable.tableName,
      },
    })

    // Grant read access to the Lambda
    this.perfumeTable.grantReadData(this.searchLambda)

    // Lambda for CRUD operations (API Gateway)
    const crudLambda = new python.PythonFunction(this, 'PerfumeCrudLambda', {
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
      this,
      'ApiAuthorizerLambda',
      {
        functionName: 'tonari-api-authorizer',
        entry: path.join(__dirname, '../lambda/api-authorizer'),
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'handler',
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          COGNITO_REGION: 'ap-northeast-1',
          COGNITO_USER_POOL_ID: cognitoUserPoolId,
          COGNITO_CLIENT_ID: cognitoClientId,
        },
      }
    )

    // API Gateway
    this.crudApi = new apigateway.RestApi(this, 'PerfumeCrudApi', {
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
      this,
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

    // TTS Lambda (Amazon Polly音声合成)
    const ttsLambda = new python.PythonFunction(this, 'TtsLambda', {
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

    // API Routes (M2M認証: サーバーサイドからのみ呼び出し)
    const perfumes = this.crudApi.root.addResource('perfumes')

    // GET /perfumes - List all
    perfumes.addMethod('GET', lambdaIntegration, authorizedMethodOptions)

    // POST /perfumes - Create
    perfumes.addMethod('POST', lambdaIntegration, authorizedMethodOptions)

    // /perfumes/{brand}/{name}
    const perfumeByBrand = perfumes.addResource('{brand}')
    const perfumeByName = perfumeByBrand.addResource('{name}')

    // GET /perfumes/{brand}/{name} - Get one
    perfumeByName.addMethod('GET', lambdaIntegration, authorizedMethodOptions)

    // PUT /perfumes/{brand}/{name} - Update
    perfumeByName.addMethod('PUT', lambdaIntegration, authorizedMethodOptions)

    // DELETE /perfumes/{brand}/{name} - Delete
    perfumeByName.addMethod('DELETE', lambdaIntegration, authorizedMethodOptions)

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
      const twitterReadLambda = new python.PythonFunction(
        this,
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

      twitterReadLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [
            `arn:aws:ssm:ap-northeast-1:${this.account}:parameter/tonari/twitter/bearer_token`,
          ],
        })
      )

      // Twitter Write Lambda (AgentCore Gateway Target)
      const twitterWriteLambda = new python.PythonFunction(
        this,
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

      twitterWriteLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ssm:GetParametersByPath'],
          resources: [
            `arn:aws:ssm:ap-northeast-1:${this.account}:parameter/tonari/twitter`,
            `arn:aws:ssm:ap-northeast-1:${this.account}:parameter/tonari/twitter/*`,
          ],
        })
      )

      // Tweet Trigger Lambda (replaces tweet-scheduler)
      const tweetTriggerLambda = new python.PythonFunction(
        this,
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
            AGENTCORE_REGION: 'ap-northeast-1',
            AGENTCORE_RUNTIME_ARN: ts.agentcoreRuntimeArn,
            COGNITO_TOKEN_ENDPOINT: ts.cognitoTokenEndpoint,
            COGNITO_CLIENT_ID: props.cognitoClientId,
            COGNITO_SCOPE: ts.cognitoScope,
            SSM_COGNITO_CLIENT_SECRET: ts.ssmCognitoClientSecret,
          },
        }
      )

      tweetTriggerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [
            `arn:aws:ssm:ap-northeast-1:${this.account}:parameter${ts.ssmCognitoClientSecret}`,
          ],
        })
      )

      const tweetTarget = new targets.LambdaInvoke(tweetTriggerLambda)

      // EventBridge Schedule: 09:00 JST
      new scheduler.Schedule(this, 'TweetScheduleMorning', {
        scheduleName: 'tonari-tweet-morning',
        schedule: scheduler.ScheduleExpression.cron({
          minute: '0',
          hour: '9',
          timeZone: cdk.TimeZone.ASIA_TOKYO,
        }),
        target: tweetTarget,
      })

      // EventBridge Schedule: 12:00 JST
      new scheduler.Schedule(this, 'TweetScheduleNoon', {
        scheduleName: 'tonari-tweet-noon',
        schedule: scheduler.ScheduleExpression.cron({
          minute: '0',
          hour: '12',
          timeZone: cdk.TimeZone.ASIA_TOKYO,
        }),
        target: tweetTarget,
      })

      // EventBridge Schedule: 18:00 JST
      new scheduler.Schedule(this, 'TweetScheduleEvening', {
        scheduleName: 'tonari-tweet-evening',
        schedule: scheduler.ScheduleExpression.cron({
          minute: '0',
          hour: '18',
          timeZone: cdk.TimeZone.ASIA_TOKYO,
        }),
        target: tweetTarget,
      })

      // Outputs for Gateway target registration
      new cdk.CfnOutput(this, 'TwitterReadLambdaArn', {
        value: twitterReadLambda.functionArn,
        description: 'Lambda ARN for Twitter Read Gateway Target',
      })

      new cdk.CfnOutput(this, 'TwitterWriteLambdaArn', {
        value: twitterWriteLambda.functionArn,
        description: 'Lambda ARN for Twitter Write Gateway Target',
      })
    }

    // Outputs
    new cdk.CfnOutput(this, 'PerfumeTableName', {
      value: this.perfumeTable.tableName,
      description: 'DynamoDB table name for perfume data',
    })

    new cdk.CfnOutput(this, 'PerfumeSearchLambdaArn', {
      value: this.searchLambda.functionArn,
      description: 'Lambda ARN for AgentCore Gateway Target',
    })

    new cdk.CfnOutput(this, 'PerfumeSearchLambdaName', {
      value: this.searchLambda.functionName!,
      description: 'Lambda function name',
    })

    new cdk.CfnOutput(this, 'PerfumeCrudApiUrl', {
      value: this.crudApi.url,
      description: 'API Gateway URL for CRUD operations',
    })
  }
}
