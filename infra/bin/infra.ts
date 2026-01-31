#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { ScenseiStack } from '../lib/scensei-stack'

const app = new cdk.App()

const cognitoUserPoolId = app.node.tryGetContext('cognitoUserPoolId')
const cognitoClientId = app.node.tryGetContext('cognitoClientId')

new ScenseiStack(app, 'ScenseiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  cognitoUserPoolId,
  cognitoClientId,
})
