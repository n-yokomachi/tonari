#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { ScenseiStack } from '../lib/scensei-stack'

const app = new cdk.App()

// Cognito User Pool ID (AgentCore M2M用と同じものを使用)
const cognitoUserPoolId = app.node.tryGetContext('cognitoUserPoolId') || 'ap-northeast-1_9YLOHAYn6'

new ScenseiStack(app, 'ScenseiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  cognitoUserPoolId,
})
