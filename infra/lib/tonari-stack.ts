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
    })

    // ========== AgentCore (Runtime, Memory, Gateway, Build, Observability) ==========
    const agentcore = new AgentCoreConstruct(this, 'AgentCore', {
      cognitoDiscoveryUrl: cognito.discoveryUrl,
      cognitoClientId: cognito.clientId,
      searchLambdaArn: workload.searchLambda.functionArn,
      twitterReadLambdaArn: workload.twitterReadLambda?.functionArn,
      twitterWriteLambdaArn: workload.twitterWriteLambda?.functionArn,
      skipRuntime: false,
    })

    // ========== Cross-Construct Wiring ==========
    // Set Runtime ARN on tweet-trigger Lambda (breaks circular dependency)
    if (workload.tweetTriggerLambda) {
      workload.tweetTriggerLambda.addEnvironment(
        'AGENTCORE_RUNTIME_ARN',
        agentcore.runtimeArn
      )
    }

    // ========== Outputs ==========
    new cdk.CfnOutput(this, 'PerfumeTableName', {
      value: workload.perfumeTable.tableName,
      description: 'DynamoDB table name for perfume data',
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

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: agentcore.ecrRepositoryUri,
      description: 'ECR Repository URI for agent container',
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
  }
}
