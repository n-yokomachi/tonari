import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as python from '@aws-cdk/aws-lambda-python-alpha'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import { Construct } from 'constructs'
import * as path from 'path'

export interface ScenseiStackProps extends cdk.StackProps {
  cognitoUserPoolId?: string
}

export class ScenseiStack extends cdk.Stack {
  public readonly perfumeTable: dynamodb.Table
  public readonly searchLambda: lambda.IFunction
  public readonly crudApi: apigateway.RestApi

  constructor(scope: Construct, id: string, props?: ScenseiStackProps) {
    super(scope, id, props)

    // DynamoDB Table (PK=brand, SK=name)
    this.perfumeTable = new dynamodb.Table(this, 'PerfumeTable', {
      tableName: 'scensei-perfumes',
      partitionKey: { name: 'brand', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'name', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // Lambda for perfume search (AgentCore Gateway Target)
    this.searchLambda = new python.PythonFunction(this, 'PerfumeSearchLambda', {
      functionName: 'scensei-perfume-search',
      entry: path.join(__dirname, '../lambda/perfume-search'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: this.perfumeTable.tableName,
      },
    })

    // Grant read access to the Lambda
    this.perfumeTable.grantReadData(this.searchLambda)

    // Lambda for CRUD operations (API Gateway)
    const crudLambda = new python.PythonFunction(this, 'PerfumeCrudLambda', {
      functionName: 'scensei-perfume-crud',
      entry: path.join(__dirname, '../lambda/perfume-crud'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: this.perfumeTable.tableName,
      },
    })

    // Grant full access to CRUD Lambda
    this.perfumeTable.grantReadWriteData(crudLambda)

    // API Gateway
    this.crudApi = new apigateway.RestApi(this, 'PerfumeCrudApi', {
      restApiName: 'scensei-perfume-api',
      description: 'Scensei Perfume CRUD API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    })

    // Cognito Authorizer (use existing User Pool)
    const cognitoUserPoolId = props?.cognitoUserPoolId || 'ap-northeast-1_9YLOHAYn6'
    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      'ExistingUserPool',
      cognitoUserPoolId
    )

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [userPool],
        identitySource: 'method.request.header.Authorization',
      }
    )

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(crudLambda)

    // API Routes
    const perfumes = this.crudApi.root.addResource('perfumes')

    // GET /perfumes - List all
    perfumes.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    })

    // POST /perfumes - Create
    perfumes.addMethod('POST', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    })

    // /perfumes/{brand}/{name}
    const perfumeByBrand = perfumes.addResource('{brand}')
    const perfumeByName = perfumeByBrand.addResource('{name}')

    // GET /perfumes/{brand}/{name} - Get one
    perfumeByName.addMethod('GET', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    })

    // PUT /perfumes/{brand}/{name} - Update
    perfumeByName.addMethod('PUT', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    })

    // DELETE /perfumes/{brand}/{name} - Delete
    perfumeByName.addMethod('DELETE', lambdaIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    })

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
