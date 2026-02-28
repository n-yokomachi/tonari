import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as python from '@aws-cdk/aws-lambda-python-alpha'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as scheduler from 'aws-cdk-lib/aws-scheduler'
import * as targets from 'aws-cdk-lib/aws-scheduler-targets'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
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
  /** News scheduler config (optional) */
  newsScheduler?: {
    notificationEmail: string
    cognitoTokenEndpoint: string
    cognitoScope: string
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
  public readonly diaryTable: dynamodb.Table
  public readonly diaryToolLambda: python.PythonFunction
  public readonly tasksTable: dynamodb.Table
  public readonly taskCrudLambda: python.PythonFunction
  public readonly taskToolLambda: python.PythonFunction
  public readonly newsNotificationTopic?: sns.Topic
  public readonly newsTable?: dynamodb.Table
  public readonly newsTriggerLambda?: python.PythonFunction

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

    // ========== Diary ==========
    this.diaryTable = new dynamodb.Table(stack, 'DiaryTable', {
      tableName: 'tonari-diary',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    this.diaryToolLambda = new python.PythonFunction(
      stack,
      'DiaryToolLambda',
      {
        functionName: 'tonari-diary-tool',
        entry: path.join(__dirname, '../lambda/diary-tool'),
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 128,
        environment: {
          TABLE_NAME: this.diaryTable.tableName,
        },
      }
    )

    this.diaryTable.grantReadWriteData(this.diaryToolLambda)

    // Lambda for diary CRUD operations (API Gateway)
    const diaryCrudLambda = new python.PythonFunction(
      stack,
      'DiaryCrudLambda',
      {
        functionName: 'tonari-diary-crud',
        entry: path.join(__dirname, '../lambda/diary-crud'),
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 128,
        environment: {
          TABLE_NAME: this.diaryTable.tableName,
        },
      }
    )

    this.diaryTable.grantReadData(diaryCrudLambda)

    // API Routes: diary (M2M auth)
    const diaryCrudIntegration = new apigateway.LambdaIntegration(
      diaryCrudLambda
    )
    const diaries = this.crudApi.root.addResource('diaries')
    diaries.addMethod('GET', diaryCrudIntegration, authorizedMethodOptions)

    const diaryByDate = diaries.addResource('{date}')
    diaryByDate.addMethod('GET', diaryCrudIntegration, authorizedMethodOptions)

    // ========== Tasks ==========
    this.tasksTable = new dynamodb.Table(stack, 'TasksTable', {
      tableName: 'tonari-tasks',
      partitionKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    })

    // Task CRUD Lambda (API Gateway)
    this.taskCrudLambda = new python.PythonFunction(
      stack,
      'TaskCrudLambda',
      {
        functionName: 'tonari-task-crud',
        entry: path.join(__dirname, '../lambda/task-crud'),
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 128,
        environment: {
          TABLE_NAME: this.tasksTable.tableName,
        },
      }
    )

    this.tasksTable.grantReadWriteData(this.taskCrudLambda)

    // API Routes: tasks (M2M auth)
    const taskCrudIntegration = new apigateway.LambdaIntegration(
      this.taskCrudLambda
    )
    const tasks = this.crudApi.root.addResource('tasks')
    tasks.addMethod('GET', taskCrudIntegration, authorizedMethodOptions)
    tasks.addMethod('POST', taskCrudIntegration, authorizedMethodOptions)

    const taskReorder = tasks.addResource('reorder')
    taskReorder.addMethod('PUT', taskCrudIntegration, authorizedMethodOptions)

    const taskById = tasks.addResource('{taskId}')
    taskById.addMethod('GET', taskCrudIntegration, authorizedMethodOptions)
    taskById.addMethod('PUT', taskCrudIntegration, authorizedMethodOptions)
    taskById.addMethod('DELETE', taskCrudIntegration, authorizedMethodOptions)

    // Task Tool Lambda (MCP Gateway Target)
    this.taskToolLambda = new python.PythonFunction(
      stack,
      'TaskToolLambda',
      {
        functionName: 'tonari-task-tool',
        entry: path.join(__dirname, '../lambda/task-tool'),
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 128,
        environment: {
          TABLE_NAME: this.tasksTable.tableName,
        },
      }
    )

    this.tasksTable.grantReadWriteData(this.taskToolLambda)

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

    // ========== News Notification ==========
    if (props.newsScheduler) {
      const ns = props.newsScheduler

      // DynamoDB Table for News (1 user = 1 record, overwrite)
      this.newsTable = new dynamodb.Table(stack, 'NewsTable', {
        tableName: 'tonari-news',
        partitionKey: {
          name: 'userId',
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      })

      // SNS Topic for email notifications
      this.newsNotificationTopic = new sns.Topic(
        stack,
        'NewsNotificationTopic',
        {
          topicName: 'tonari-news-notification',
          displayName: 'TONaRi News Notification',
        }
      )

      this.newsNotificationTopic.addSubscription(
        new subscriptions.EmailSubscription(ns.notificationEmail)
      )

      // News CRUD Lambda (API Gateway)
      const newsCrudLambda = new python.PythonFunction(
        stack,
        'NewsCrudLambda',
        {
          functionName: 'tonari-news-crud',
          entry: path.join(__dirname, '../lambda/news-crud'),
          runtime: lambda.Runtime.PYTHON_3_12,
          handler: 'handler',
          timeout: cdk.Duration.seconds(30),
          memorySize: 128,
          environment: {
            TABLE_NAME: this.newsTable.tableName,
          },
        }
      )

      this.newsTable.grantReadWriteData(newsCrudLambda)

      // API Routes: news (M2M auth)
      const newsCrudIntegration = new apigateway.LambdaIntegration(
        newsCrudLambda
      )
      const news = this.crudApi.root.addResource('news')
      news.addMethod('GET', newsCrudIntegration, authorizedMethodOptions)
      news.addMethod('DELETE', newsCrudIntegration, authorizedMethodOptions)

      // News Trigger Lambda
      // AGENTCORE_RUNTIME_ARN is set by the stack after AgentCoreConstruct creation
      this.newsTriggerLambda = new python.PythonFunction(
        stack,
        'NewsTriggerLambda',
        {
          functionName: 'tonari-news-trigger',
          entry: path.join(__dirname, '../lambda/news-trigger'),
          runtime: lambda.Runtime.PYTHON_3_12,
          handler: 'handler',
          timeout: cdk.Duration.minutes(5),
          memorySize: 256,
          environment: {
            AGENTCORE_REGION: region,
            COGNITO_TOKEN_ENDPOINT: ns.cognitoTokenEndpoint,
            COGNITO_CLIENT_ID: cognitoClientId,
            COGNITO_SCOPE: ns.cognitoScope,
            SSM_COGNITO_CLIENT_SECRET: ns.ssmCognitoClientSecret,
            SNS_TOPIC_ARN: this.newsNotificationTopic.topicArn,
            NEWS_TABLE: this.newsTable.tableName,
            TASKS_TABLE: this.tasksTable.tableName,
          },
        }
      )

      // IAM permissions
      this.newsTriggerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [
            `arn:aws:ssm:${region}:${account}:parameter${ns.ssmCognitoClientSecret}`,
          ],
        })
      )

      this.newsNotificationTopic.grantPublish(this.newsTriggerLambda)
      this.newsTable.grantReadWriteData(this.newsTriggerLambda)
      this.tasksTable.grantReadData(this.newsTriggerLambda)

      const newsTarget = new targets.LambdaInvoke(this.newsTriggerLambda)

      // EventBridge Schedules (9:00 and 21:00 JST)
      new scheduler.Schedule(stack, 'NewsScheduleMorning', {
        scheduleName: 'tonari-news-morning',
        schedule: scheduler.ScheduleExpression.cron({
          minute: '0',
          hour: '9',
          timeZone: cdk.TimeZone.ASIA_TOKYO,
        }),
        target: newsTarget,
      })

      new scheduler.Schedule(stack, 'NewsScheduleEvening', {
        scheduleName: 'tonari-news-evening',
        schedule: scheduler.ScheduleExpression.cron({
          minute: '0',
          hour: '21',
          timeZone: cdk.TimeZone.ASIA_TOKYO,
        }),
        target: newsTarget,
      })
    }
  }
}
