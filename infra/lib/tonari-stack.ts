import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { CognitoConstruct } from './cognito-construct'
import { WorkloadConstruct } from './workload-construct'
import { AgentCoreConstruct } from './agentcore-construct'

export interface TonariStackProps extends cdk.StackProps {
  /** Tweet scheduler config (optional) */
  tweetScheduler?: {
    ownerTwitterUserId: string
    ssmCognitoClientSecret: string
  }
  /** News scheduler config (optional) */
  newsScheduler?: {
    notificationEmail: string
    /** Cognito client secret SSM path (shared with tweetScheduler) */
    ssmCognitoClientSecret: string
  }
}

export class TonariStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TonariStackProps) {
    super(scope, id, props)

    // ========== Cognito (Identity) ==========
    const cognito = new CognitoConstruct(this, 'Cognito')

    // ========== Workload (Existing Resources) ==========
    const workload = new WorkloadConstruct(this, 'Workload', {
      cognitoUserPoolId: cognito.userPoolId,
      cognitoClientId: cognito.clientId,
      tweetScheduler: props.tweetScheduler
        ? {
            ownerTwitterUserId: props.tweetScheduler.ownerTwitterUserId,
            cognitoTokenEndpoint: cognito.tokenEndpoint,
            cognitoScope: cognito.scope,
            ssmCognitoClientSecret:
              props.tweetScheduler.ssmCognitoClientSecret,
          }
        : undefined,
      newsScheduler: props.newsScheduler
        ? {
            notificationEmail: props.newsScheduler.notificationEmail,
            cognitoTokenEndpoint: cognito.tokenEndpoint,
            cognitoScope: cognito.scope,
            ssmCognitoClientSecret:
              props.newsScheduler.ssmCognitoClientSecret,
          }
        : undefined,
    })

    // ========== AgentCore (Runtime, Memory, Gateway, Build, Observability) ==========
    const agentcore = new AgentCoreConstruct(this, 'AgentCore', {
      cognitoDiscoveryUrl: cognito.discoveryUrl,
      cognitoClientId: cognito.clientId,
      searchLambda: workload.searchLambda,
      twitterReadLambda: workload.twitterReadLambda,
      twitterWriteLambda: workload.twitterWriteLambda,
      diaryLambda: workload.diaryToolLambda,
      taskToolLambda: workload.taskToolLambda,
    })

    // ========== Cross-Construct Wiring ==========
    // Set Runtime ARN on tweet-trigger Lambda (breaks circular dependency)
    if (workload.tweetTriggerLambda) {
      workload.tweetTriggerLambda.addEnvironment(
        'AGENTCORE_RUNTIME_ARN',
        agentcore.runtimeArn
      )
    }

    // Set Runtime ARN on news-trigger Lambda
    if (workload.newsTriggerLambda) {
      workload.newsTriggerLambda.addEnvironment(
        'AGENTCORE_RUNTIME_ARN',
        agentcore.runtimeArn
      )
    }

    // ========== Outputs ==========
    new cdk.CfnOutput(this, 'PerfumeTableName', {
      value: workload.perfumeTable.tableName,
      description: 'DynamoDB table name for perfume data',
    })

    new cdk.CfnOutput(this, 'DiaryTableName', {
      value: workload.diaryTable.tableName,
      description: 'DynamoDB table name for diary data',
    })

    new cdk.CfnOutput(this, 'PerfumeSearchLambdaArn', {
      value: workload.searchLambda.functionArn,
      description: 'Lambda ARN for perfume search',
    })

    new cdk.CfnOutput(this, 'PerfumeCrudApiUrl', {
      value: workload.crudApi.url,
      description: 'API Gateway URL for CRUD operations',
    })

    new cdk.CfnOutput(this, 'AgentCoreRuntimeArn', {
      value: agentcore.runtimeArn,
      description: 'AgentCore Runtime ARN',
    })

    new cdk.CfnOutput(this, 'AgentCoreMemoryId', {
      value: agentcore.memoryId,
      description: 'AgentCore Memory ID',
    })

    new cdk.CfnOutput(this, 'AgentCoreGatewayUrl', {
      value: agentcore.gatewayUrl,
      description: 'AgentCore Gateway URL',
    })

    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: cognito.userPoolId,
      description: 'Cognito User Pool ID',
    })

    new cdk.CfnOutput(this, 'CognitoClientId', {
      value: cognito.clientId,
      description: 'Cognito App Client ID',
    })

    new cdk.CfnOutput(this, 'CognitoTokenEndpoint', {
      value: cognito.tokenEndpoint,
      description: 'Cognito OAuth2 Token Endpoint',
    })

    new cdk.CfnOutput(this, 'CognitoScope', {
      value: cognito.scope,
      description: 'Cognito OAuth2 Scope',
    })

    new cdk.CfnOutput(this, 'TasksTableName', {
      value: workload.tasksTable.tableName,
      description: 'DynamoDB table name for task data',
    })

    if (workload.newsTable) {
      new cdk.CfnOutput(this, 'NewsTableName', {
        value: workload.newsTable.tableName,
        description: 'DynamoDB table name for news data',
      })
    }

    if (workload.newsNotificationTopic) {
      new cdk.CfnOutput(this, 'NewsNotificationTopicArn', {
        value: workload.newsNotificationTopic.topicArn,
        description: 'SNS Topic ARN for news notifications',
      })
    }
  }
}
