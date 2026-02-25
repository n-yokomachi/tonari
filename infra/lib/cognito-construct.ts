import * as cdk from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as cr from 'aws-cdk-lib/custom-resources'
import { Construct } from 'constructs'

export interface CognitoConstructProps {
  /** User Pool Domain prefix (must be globally unique) */
  domainPrefix?: string
  /** SSM parameter path for storing client secret */
  ssmClientSecretPath?: string
}

export class CognitoConstruct extends Construct {
  public readonly userPool: cognito.UserPool
  public readonly appClient: cognito.UserPoolClient
  public readonly resourceServer: cognito.UserPoolResourceServer
  public readonly domain: cognito.UserPoolDomain

  /** Cognito User Pool ID */
  public readonly userPoolId: string
  /** App Client ID */
  public readonly clientId: string
  /** OIDC Discovery URL for JWT authorizer configuration */
  public readonly discoveryUrl: string
  /** OAuth2 Token Endpoint */
  public readonly tokenEndpoint: string
  /** OAuth2 Scope string */
  public readonly scope: string
  /** SSM parameter path where client secret is stored */
  public readonly ssmClientSecretPath: string

  constructor(scope: Construct, id: string, props: CognitoConstructProps = {}) {
    super(scope, id)

    const domainPrefix = props.domainPrefix ?? 'tonari-m2m'
    this.ssmClientSecretPath =
      props.ssmClientSecretPath ?? '/tonari/cognito/client_secret'

    // User Pool (M2M only, no sign-up)
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'tonari-agentcore-m2m',
      selfSignUpEnabled: false,
      signInAliases: { username: false, email: false },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Resource Server with read/write scopes
    this.resourceServer = this.userPool.addResourceServer('ResourceServer', {
      identifier: 'agentcore-m2m',
      scopes: [
        new cognito.ResourceServerScope({
          scopeName: 'read',
          scopeDescription: 'Read access',
        }),
        new cognito.ResourceServerScope({
          scopeName: 'write',
          scopeDescription: 'Write access',
        }),
      ],
    })

    // App Client (client_credentials flow)
    this.appClient = this.userPool.addClient('M2MClient', {
      userPoolClientName: 'tonari-m2m-client',
      generateSecret: true,
      oAuth: {
        flows: { clientCredentials: true },
        scopes: [
          cognito.OAuthScope.custom('agentcore-m2m/read'),
          cognito.OAuthScope.custom('agentcore-m2m/write'),
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    })

    // Ensure App Client is created after Resource Server
    this.appClient.node.addDependency(this.resourceServer)

    // User Pool Domain
    this.domain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix },
    })

    // Derive public properties
    const region = cdk.Stack.of(this).region
    this.userPoolId = this.userPool.userPoolId
    this.clientId = this.appClient.userPoolClientId
    this.discoveryUrl = `https://cognito-idp.${region}.amazonaws.com/${this.userPool.userPoolId}/.well-known/openid-configuration`
    this.tokenEndpoint = `https://${domainPrefix}.auth.${region}.amazoncognito.com/oauth2/token`
    this.scope = 'agentcore-m2m/read agentcore-m2m/write'

    // Store Client Secret in SSM via Custom Resource
    const describeClient = new cr.AwsCustomResource(
      this,
      'DescribeUserPoolClient',
      {
        onCreate: {
          service: 'CognitoIdentityServiceProvider',
          action: 'describeUserPoolClient',
          parameters: {
            UserPoolId: this.userPool.userPoolId,
            ClientId: this.appClient.userPoolClientId,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            'cognito-client-secret'
          ),
        },
        onUpdate: {
          service: 'CognitoIdentityServiceProvider',
          action: 'describeUserPoolClient',
          parameters: {
            UserPoolId: this.userPool.userPoolId,
            ClientId: this.appClient.userPoolClientId,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            'cognito-client-secret'
          ),
        },
        policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
          resources: [this.userPool.userPoolArn],
        }),
      }
    )

    const clientSecret = describeClient.getResponseField(
      'UserPoolClient.ClientSecret'
    )

    // Store as SecureString via custom resource (CDK StringParameter doesn't support SecureString)
    new cr.AwsCustomResource(this, 'ClientSecretSecure', {
      onCreate: {
        service: 'SSM',
        action: 'putParameter',
        parameters: {
          Name: this.ssmClientSecretPath,
          Value: clientSecret,
          Type: 'SecureString',
          Description: 'Cognito M2M App Client Secret for Tonari',
          Overwrite: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of('cognito-client-secret-ssm'),
      },
      onUpdate: {
        service: 'SSM',
        action: 'putParameter',
        parameters: {
          Name: this.ssmClientSecretPath,
          Value: clientSecret,
          Type: 'SecureString',
          Description: 'Cognito M2M App Client Secret for Tonari',
          Overwrite: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of('cognito-client-secret-ssm'),
      },
      onDelete: {
        service: 'SSM',
        action: 'deleteParameter',
        parameters: {
          Name: this.ssmClientSecretPath,
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['ssm:PutParameter', 'ssm:DeleteParameter'],
          resources: [
            `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${this.ssmClientSecretPath}`,
          ],
        }),
      ]),
    })
  }
}
