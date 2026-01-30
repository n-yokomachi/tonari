import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
export interface ScenseiStackProps extends cdk.StackProps {
    cognitoUserPoolId?: string;
}
export declare class ScenseiStack extends cdk.Stack {
    readonly perfumeTable: dynamodb.Table;
    readonly searchLambda: lambda.IFunction;
    readonly crudApi: apigateway.RestApi;
    constructor(scope: Construct, id: string, props?: ScenseiStackProps);
}
