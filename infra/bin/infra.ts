#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { TonariStack } from '../lib/tonari-stack'

const app = new cdk.App()

const tweetSchedulerConfig = app.node.tryGetContext('tweetScheduler')
const newsSchedulerConfig = app.node.tryGetContext('newsScheduler')

new TonariStack(app, 'TonariStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
  },
  tweetScheduler: tweetSchedulerConfig
    ? {
        ownerTwitterUserId: tweetSchedulerConfig.ownerTwitterUserId,
        ssmCognitoClientSecret: tweetSchedulerConfig.ssmCognitoClientSecret,
      }
    : undefined,
  newsScheduler: newsSchedulerConfig
    ? {
        notificationEmail: newsSchedulerConfig.notificationEmail,
        ssmCognitoClientSecret:
          tweetSchedulerConfig?.ssmCognitoClientSecret ??
          '/tonari/cognito/client_secret',
      }
    : undefined,
})
