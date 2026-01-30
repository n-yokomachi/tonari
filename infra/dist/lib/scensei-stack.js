"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenseiStack = void 0;
const cdk = require("aws-cdk-lib");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const lambda = require("aws-cdk-lib/aws-lambda");
const python = require("@aws-cdk/aws-lambda-python-alpha");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const cognito = require("aws-cdk-lib/aws-cognito");
const path = require("path");
class ScenseiStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // DynamoDB Table (PK=brand, SK=name)
        this.perfumeTable = new dynamodb.Table(this, 'PerfumeTable', {
            tableName: 'scensei-perfumes',
            partitionKey: { name: 'brand', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'name', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
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
        });
        // Grant read access to the Lambda
        this.perfumeTable.grantReadData(this.searchLambda);
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
        });
        // Grant full access to CRUD Lambda
        this.perfumeTable.grantReadWriteData(crudLambda);
        // API Gateway
        this.crudApi = new apigateway.RestApi(this, 'PerfumeCrudApi', {
            restApiName: 'scensei-perfume-api',
            description: 'Scensei Perfume CRUD API',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });
        // Cognito Authorizer (use existing User Pool)
        const cognitoUserPoolId = props?.cognitoUserPoolId || 'ap-northeast-1_9YLOHAYn6';
        const userPool = cognito.UserPool.fromUserPoolId(this, 'ExistingUserPool', cognitoUserPoolId);
        const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [userPool],
            identitySource: 'method.request.header.Authorization',
        });
        // Lambda integration
        const lambdaIntegration = new apigateway.LambdaIntegration(crudLambda);
        // API Routes
        const perfumes = this.crudApi.root.addResource('perfumes');
        // GET /perfumes - List all
        perfumes.addMethod('GET', lambdaIntegration, {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // POST /perfumes - Create
        perfumes.addMethod('POST', lambdaIntegration, {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // /perfumes/{brand}/{name}
        const perfumeByBrand = perfumes.addResource('{brand}');
        const perfumeByName = perfumeByBrand.addResource('{name}');
        // GET /perfumes/{brand}/{name} - Get one
        perfumeByName.addMethod('GET', lambdaIntegration, {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // PUT /perfumes/{brand}/{name} - Update
        perfumeByName.addMethod('PUT', lambdaIntegration, {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // DELETE /perfumes/{brand}/{name} - Delete
        perfumeByName.addMethod('DELETE', lambdaIntegration, {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // Outputs
        new cdk.CfnOutput(this, 'PerfumeTableName', {
            value: this.perfumeTable.tableName,
            description: 'DynamoDB table name for perfume data',
        });
        new cdk.CfnOutput(this, 'PerfumeSearchLambdaArn', {
            value: this.searchLambda.functionArn,
            description: 'Lambda ARN for AgentCore Gateway Target',
        });
        new cdk.CfnOutput(this, 'PerfumeSearchLambdaName', {
            value: this.searchLambda.functionName,
            description: 'Lambda function name',
        });
        new cdk.CfnOutput(this, 'PerfumeCrudApiUrl', {
            value: this.crudApi.url,
            description: 'API Gateway URL for CRUD operations',
        });
    }
}
exports.ScenseiStack = ScenseiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbnNlaS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9zY2Vuc2VpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFrQztBQUNsQyxxREFBb0Q7QUFDcEQsaURBQWdEO0FBQ2hELDJEQUEwRDtBQUMxRCx5REFBd0Q7QUFDeEQsbURBQWtEO0FBRWxELDZCQUE0QjtBQU01QixNQUFhLFlBQWEsU0FBUSxHQUFHLENBQUMsS0FBSztJQUt6QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFBO1FBRXZCLHFDQUFxQztRQUNyQyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQzNELFNBQVMsRUFBRSxrQkFBa0I7WUFDN0IsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDcEUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDOUQsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO1NBQ3hDLENBQUMsQ0FBQTtRQUVGLHVEQUF1RDtRQUN2RCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDekUsWUFBWSxFQUFFLHdCQUF3QjtZQUN0QyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsMEJBQTBCLENBQUM7WUFDdkQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFP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RTtZQUMzQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHO1lBQ3ZCLFdBQVcsRUFBRSxxQ0FBcUM7U0FDbkQsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQUNGO0FBMUlELG9DQTBJQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYidcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYidcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJ1xuaW1wb3J0ICogYXMgcHl0aG9uIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEtcHl0aG9uLWFscGhhJ1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSdcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJ1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJ1xuXG5leHBvcnQgaW50ZXJmYWNlIFNjZW5zZWlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBjb2duaXRvVXNlclBvb2xJZD86IHN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgU2NlbnNlaVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHBlcmZ1bWVUYWJsZTogZHluYW1vZGIuVGFibGVcbiAgcHVibGljIHJlYWRvbmx5IHNlYXJjaExhbWJkYTogbGFtYmRhLklGdW5jdGlvblxuICBwdWJsaWMgcmVhZG9ubHkgY3J1ZEFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpXG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBTY2Vuc2VpU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpXG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZSAoUEs9YnJhbmQsIFNLPW5hbWUpXG4gICAgdGhpcy5wZXJmdW1lVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1BlcmZ1bWVUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ3NjZW5zZWktcGVyZnVtZXMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdicmFuZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICduYW1lJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSlcblxuICAgIC8vIExhbWJkYSBmb3IgcGVyZnVtZSBzZWFyY2ggKEFnZW50Q29yZSBHYXRld2F5IFRhcmdldClcbiAgICB0aGlzLnNlYXJjaExhbWJkYSA9IG5ldyBweXRob24uUHl0aG9uRnVuY3Rpb24odGhpcywgJ1BlcmZ1bWVTZWFyY2hMYW1iZGEnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdzY2Vuc2VpLXBlcmZ1bWUtc2VhcmNoJyxcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL3BlcmZ1bWUtc2VhcmNoJyksXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHRoaXMucGVyZnVtZVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIC8vIEdyYW50IHJlYWQgYWNjZXNzIHRvIHRoZSBMYW1iZGFcbiAgICB0aGlzLnBlcmZ1bWVUYWJsZS5ncmFudFJlYWREYXRhKHRoaXMuc2VhcmNoTGFtYmRhKVxuXG4gICAgLy8gTGFtYmRhIGZvciBDUlVEIG9wZXJhdGlvbnMgKEFQSSBHYXRld2F5KVxuICAgIGNvbnN0IGNydWRMYW1iZGEgPSBuZXcgcHl0aG9uLlB5dGhvbkZ1bmN0aW9uKHRoaXMsICdQZXJmdW1lQ3J1ZExhbWJkYScsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3NjZW5zZWktcGVyZnVtZS1jcnVkJyxcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL3BlcmZ1bWUtY3J1ZCcpLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBUQUJMRV9OQU1FOiB0aGlzLnBlcmZ1bWVUYWJsZS50YWJsZU5hbWUsXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICAvLyBHcmFudCBmdWxsIGFjY2VzcyB0byBDUlVEIExhbWJkYVxuICAgIHRoaXMucGVyZnVtZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjcnVkTGFtYmRhKVxuXG4gICAgLy8gQVBJIEdhdGV3YXlcbiAgICB0aGlzLmNydWRBcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdQZXJmdW1lQ3J1ZEFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnc2NlbnNlaS1wZXJmdW1lLWFwaScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NjZW5zZWkgUGVyZnVtZSBDUlVEIEFQSScsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nXSxcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIC8vIENvZ25pdG8gQXV0aG9yaXplciAodXNlIGV4aXN0aW5nIFVzZXIgUG9vbClcbiAgICBjb25zdCBjb2duaXRvVXNlclBvb2xJZCA9IHByb3BzPy5jb2duaXRvVXNlclBvb2xJZCB8fCAnYXAtbm9ydGhlYXN0LTFfOVlMT0hBWW42J1xuICAgIGNvbnN0IHVzZXJQb29sID0gY29nbml0by5Vc2VyUG9vbC5mcm9tVXNlclBvb2xJZChcbiAgICAgIHRoaXMsXG4gICAgICAnRXhpc3RpbmdVc2VyUG9vbCcsXG4gICAgICBjb2duaXRvVXNlclBvb2xJZFxuICAgIClcblxuICAgIGNvbnN0IGF1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcihcbiAgICAgIHRoaXMsXG4gICAgICAnQ29nbml0b0F1dGhvcml6ZXInLFxuICAgICAge1xuICAgICAgICBjb2duaXRvVXNlclBvb2xzOiBbdXNlclBvb2xdLFxuICAgICAgICBpZGVudGl0eVNvdXJjZTogJ21ldGhvZC5yZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uJyxcbiAgICAgIH1cbiAgICApXG5cbiAgICAvLyBMYW1iZGEgaW50ZWdyYXRpb25cbiAgICBjb25zdCBsYW1iZGFJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGNydWRMYW1iZGEpXG5cbiAgICAvLyBBUEkgUm91dGVzXG4gICAgY29uc3QgcGVyZnVtZXMgPSB0aGlzLmNydWRBcGkucm9vdC5hZGRSZXNvdXJjZSgncGVyZnVtZXMnKVxuXG4gICAgLy8gR0VUIC9wZXJmdW1lcyAtIExpc3QgYWxsXG4gICAgcGVyZnVtZXMuYWRkTWV0aG9kKCdHRVQnLCBsYW1iZGFJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcixcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgfSlcblxuICAgIC8vIFBPU1QgL3BlcmZ1bWVzIC0gQ3JlYXRlXG4gICAgcGVyZnVtZXMuYWRkTWV0aG9kKCdQT1NUJywgbGFtYmRhSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgIH0pXG5cbiAgICAvLyAvcGVyZnVtZXMve2JyYW5kfS97bmFtZX1cbiAgICBjb25zdCBwZXJmdW1lQnlCcmFuZCA9IHBlcmZ1bWVzLmFkZFJlc291cmNlKCd7YnJhbmR9JylcbiAgICBjb25zdCBwZXJmdW1lQnlOYW1lID0gcGVyZnVtZUJ5QnJhbmQuYWRkUmVzb3VyY2UoJ3tuYW1lfScpXG5cbiAgICAvLyBHRVQgL3BlcmZ1bWVzL3ticmFuZH0ve25hbWV9IC0gR2V0IG9uZVxuICAgIHBlcmZ1bWVCeU5hbWUuYWRkTWV0aG9kKCdHRVQnLCBsYW1iZGFJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcixcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgfSlcblxuICAgIC8vIFBVVCAvcGVyZnVtZXMve2JyYW5kfS97bmFtZX0gLSBVcGRhdGVcbiAgICBwZXJmdW1lQnlOYW1lLmFkZE1ldGhvZCgnUFVUJywgbGFtYmRhSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxuICAgIH0pXG5cbiAgICAvLyBERUxFVEUgL3BlcmZ1bWVzL3ticmFuZH0ve25hbWV9IC0gRGVsZXRlXG4gICAgcGVyZnVtZUJ5TmFtZS5hZGRNZXRob2QoJ0RFTEVURScsIGxhbWJkYUludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyLFxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICB9KVxuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQZXJmdW1lVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMucGVyZnVtZVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgbmFtZSBmb3IgcGVyZnVtZSBkYXRhJyxcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1BlcmZ1bWVTZWFyY2hMYW1iZGFBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zZWFyY2hMYW1iZGEuZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBBUk4gZm9yIEFnZW50Q29yZSBHYXRld2F5IFRhcmdldCcsXG4gICAgfSlcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQZXJmdW1lU2VhcmNoTGFtYmRhTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnNlYXJjaExhbWJkYS5mdW5jdGlvbk5hbWUhLFxuICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgZnVuY3Rpb24gbmFtZScsXG4gICAgfSlcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQZXJmdW1lQ3J1ZEFwaVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNydWRBcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBVUkwgZm9yIENSVUQgb3BlcmF0aW9ucycsXG4gICAgfSlcbiAgfVxufVxuIl19