import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as python from '@aws-cdk/aws-lambda-python-alpha'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import { Construct } from 'constructs'
import * as path from 'path'

export interface TonariStackProps extends cdk.StackProps {
  // Cognito User Pool ID for API Gateway authorization
  cognitoUserPoolId: string
  // Cognito Client ID for M2M authentication
  cognitoClientId: string
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
      memorySize: 256,
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
      memorySize: 256,
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
