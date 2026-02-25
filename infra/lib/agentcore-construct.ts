import * as cdk from 'aws-cdk-lib'
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as cr from 'aws-cdk-lib/custom-resources'
import { Construct } from 'constructs'

export interface AgentCoreConstructProps {
  /** Cognito OIDC Discovery URL for JWT authorizer */
  cognitoDiscoveryUrl: string
  /** Cognito App Client ID for JWT authorizer */
  cognitoClientId: string
  /** perfume-search Lambda ARN (Gateway target) */
  searchLambdaArn: string
  /** twitter-read Lambda ARN (Gateway target, optional) */
  twitterReadLambdaArn?: string
  /** twitter-write Lambda ARN (Gateway target, optional) */
  twitterWriteLambdaArn?: string
  /** Skip Runtime creation (for initial deploy before ECR image exists) */
  skipRuntime?: boolean
}

export class AgentCoreConstruct extends Construct {
  /** AgentCore Memory ID */
  public readonly memoryId: string
  /** AgentCore Gateway URL */
  public readonly gatewayUrl: string
  /** AgentCore Runtime ARN */
  public readonly runtimeArn: string
  /** ECR Repository URI */
  public readonly ecrRepositoryUri: string

  constructor(scope: Construct, id: string, props: AgentCoreConstructProps) {
    super(scope, id)

    const region = cdk.Stack.of(this).region
    const account = cdk.Stack.of(this).account

    // ========== Memory ==========
    const memory = new bedrockagentcore.CfnMemory(this, 'AgentCoreMemory', {
      name: 'tonari_memory',
      eventExpiryDuration: 30,
      memoryStrategies: [
        {
          userPreferenceMemoryStrategy: {
            name: 'preferences',
            namespaces: ['/preferences/{actorId}/'],
          },
        },
        {
          semanticMemoryStrategy: {
            name: 'facts',
            namespaces: ['/facts/{actorId}/'],
          },
        },
        {
          summaryMemoryStrategy: {
            name: 'summaries',
            namespaces: ['/summaries/{actorId}/{sessionId}/'],
          },
        },
        {
          episodicMemoryStrategy: {
            name: 'episodes',
            namespaces: ['/episodes/{actorId}/'],
            reflectionConfiguration: {
              namespaces: ['/episodes/{actorId}/'],
            },
          },
        },
      ],
    })
    this.memoryId = memory.attrMemoryId

    // ========== ECR + CodeBuild ==========
    const ecrRepo = new ecr.Repository(this, 'AgentCoreEcr', {
      repositoryName: 'tonari-agentcore',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    })
    this.ecrRepositoryUri = ecrRepo.repositoryUri

    const buildProject = new codebuild.Project(this, 'AgentCoreBuild', {
      projectName: 'tonari-agentcore-build',
      environment: {
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true,
      },
      source: codebuild.Source.gitHub({
        owner: 'n-yokomachi',
        repo: 'tonari',
        branchOrRef: 'main',
      }),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI',
            ],
          },
          build: {
            commands: [
              'cd agentcore',
              'docker build -t $ECR_REPO_URI:latest -f Dockerfile .',
            ],
          },
          post_build: {
            commands: ['docker push $ECR_REPO_URI:latest'],
          },
        },
      }),
      environmentVariables: {
        ECR_REPO_URI: { value: ecrRepo.repositoryUri },
      },
    })

    ecrRepo.grantPush(buildProject)

    // Trigger CodeBuild on every cdk deploy
    const buildTrigger = new cr.AwsCustomResource(this, 'BuildTrigger', {
      onCreate: {
        service: 'CodeBuild',
        action: 'startBuild',
        parameters: {
          projectName: buildProject.projectName,
        },
        physicalResourceId: cr.PhysicalResourceId.of(
          'agentcore-build-trigger'
        ),
      },
      onUpdate: {
        service: 'CodeBuild',
        action: 'startBuild',
        parameters: {
          projectName: buildProject.projectName,
        },
        physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString()),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['codebuild:StartBuild'],
          resources: [buildProject.projectArn],
        }),
      ]),
    })

    // ========== Gateway ==========
    const lambdaArns = [props.searchLambdaArn]
    if (props.twitterReadLambdaArn) lambdaArns.push(props.twitterReadLambdaArn)
    if (props.twitterWriteLambdaArn)
      lambdaArns.push(props.twitterWriteLambdaArn)

    const gatewayRole = new iam.Role(this, 'GatewayRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      inlinePolicies: {
        LambdaInvoke: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['lambda:InvokeFunction'],
              resources: lambdaArns,
            }),
          ],
        }),
        CredentialProviderAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['secretsmanager:GetSecretValue'],
              resources: [
                `arn:aws:secretsmanager:${region}:${account}:secret:bedrock-agentcore-identity*`,
              ],
            }),
            new iam.PolicyStatement({
              actions: [
                'bedrock-agentcore:GetApiKeyCredentialProvider',
                'bedrock-agentcore:GetCredentialProvider',
                'bedrock-agentcore:GetResourceApiKey',
              ],
              resources: [
                `arn:aws:bedrock-agentcore:${region}:${account}:token-vault/*`,
              ],
            }),
            new iam.PolicyStatement({
              actions: [
                'bedrock-agentcore:GetWorkloadAccessToken',
                'bedrock-agentcore:GetWorkloadAccessTokenForJWT',
                'bedrock-agentcore:GetWorkloadAccessTokenForUserId',
                'bedrock-agentcore:GetResourceApiKey',
              ],
              resources: [
                `arn:aws:bedrock-agentcore:${region}:${account}:workload-identity-directory/default`,
                `arn:aws:bedrock-agentcore:${region}:${account}:workload-identity-directory/default/workload-identity/*`,
              ],
            }),
          ],
        }),
      },
    })

    const gateway = new bedrockagentcore.CfnGateway(
      this,
      'ToolsGateway',
      {
        name: 'tonari-gateway',
        protocolType: 'MCP',
        authorizerType: 'AWS_IAM',
        roleArn: gatewayRole.roleArn,
      }
    )
    this.gatewayUrl = gateway.attrGatewayUrl

    // Credential provider configuration for Lambda targets (IAM-based)
    const lambdaCredentialProvider = [
      {
        credentialProviderType: 'GATEWAY_IAM_ROLE',
      },
    ]

    // Gateway Target: perfume-search
    new bedrockagentcore.CfnGatewayTarget(this, 'PerfumeSearchTool', {
      gatewayIdentifier: gateway.attrGatewayIdentifier,
      name: 'perfume-search',
      credentialProviderConfigurations: lambdaCredentialProvider,
      targetConfiguration: {
        mcp: {
          lambda: {
            lambdaArn: props.searchLambdaArn,
            toolSchema: {
              inlinePayload: [
                {
                  name: 'search_perfumes',
                  description:
                    'Search perfume database by keyword. Returns matching perfumes with details like notes, scenes, seasons, and ratings.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description:
                          'Search keyword for perfume name, brand, notes, scenes, or seasons',
                      },
                      limit: {
                        type: 'number',
                        description:
                          'Maximum number of results to return (default: 5)',
                      },
                    },
                    required: ['query'],
                  },
                },
              ],
            },
          },
        },
      },
    })

    // Gateway Target: twitter-read (conditional)
    if (props.twitterReadLambdaArn) {
      new bedrockagentcore.CfnGatewayTarget(this, 'TwitterReadTool', {
        gatewayIdentifier: gateway.attrGatewayIdentifier,
        name: 'twitter-read',
        credentialProviderConfigurations: lambdaCredentialProvider,
        targetConfiguration: {
          mcp: {
            lambda: {
              lambdaArn: props.twitterReadLambdaArn,
              toolSchema: {
                inlinePayload: [
                  {
                    name: 'get_todays_tweets',
                    description:
                      "Fetch the owner's tweets posted today. Returns tweet text and timestamps.",
                    inputSchema: {
                      type: 'object',
                      properties: {
                        owner_user_id: {
                          type: 'string',
                          description:
                            'Twitter user ID of the account owner',
                        },
                        max_count: {
                          type: 'number',
                          description:
                            'Maximum number of tweets to fetch (default: 3)',
                        },
                      },
                      required: ['owner_user_id'],
                    },
                  },
                ],
              },
            },
          },
        },
      })
    }

    // Gateway Target: twitter-write (conditional)
    if (props.twitterWriteLambdaArn) {
      new bedrockagentcore.CfnGatewayTarget(this, 'TwitterWriteTool', {
        gatewayIdentifier: gateway.attrGatewayIdentifier,
        name: 'twitter-write',
        credentialProviderConfigurations: lambdaCredentialProvider,
        targetConfiguration: {
          mcp: {
            lambda: {
              lambdaArn: props.twitterWriteLambdaArn,
              toolSchema: {
                inlinePayload: [
                  {
                    name: 'post_tweet',
                    description:
                      'Post a tweet on behalf of the Tonari account.',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        text: {
                          type: 'string',
                          description:
                            'The tweet text to post (max 280 characters)',
                        },
                      },
                      required: ['text'],
                    },
                  },
                ],
              },
            },
          },
        },
      })
    }

    // ========== Runtime ==========
    if (props.skipRuntime) {
      this.runtimeArn = 'PENDING_RUNTIME_DEPLOY'
      return
    }

    const runtimeRole = new iam.Role(this, 'RuntimeRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      inlinePolicies: {
        BedrockInvoke: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: ['*'],
            }),
          ],
        }),
        MemoryAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'bedrock-agentcore:Invoke*',
                'bedrock-agentcore:Retrieve*',
                'bedrock-agentcore:ListEvents',
                'bedrock-agentcore:CreateEvent',
                'bedrock-agentcore:GetMemory',
              ],
              resources: [memory.attrMemoryArn],
            }),
          ],
        }),
        GatewayAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['bedrock-agentcore:InvokeGateway'],
              resources: [gateway.attrGatewayArn],
            }),
          ],
        }),
        Observability: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              actions: [
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords',
                'xray:GetSamplingRules',
                'xray:GetSamplingTargets',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              actions: ['cloudwatch:PutMetricData'],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'cloudwatch:namespace': 'bedrock-agentcore',
                },
              },
            }),
          ],
        }),
        EcrPull: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['ecr:GetAuthorizationToken'],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              actions: [
                'ecr:BatchGetImage',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchCheckLayerAvailability',
              ],
              resources: [ecrRepo.repositoryArn],
            }),
          ],
        }),
        WorkloadIdentity: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'bedrock-agentcore:GetWorkloadAccessToken',
                'bedrock-agentcore:GetWorkloadAccessTokenForJWT',
                'bedrock-agentcore:GetWorkloadAccessTokenForUserId',
              ],
              resources: [
                `arn:aws:bedrock-agentcore:${region}:${account}:workload-identity-directory/default`,
                `arn:aws:bedrock-agentcore:${region}:${account}:workload-identity-directory/default/workload-identity/*`,
              ],
            }),
          ],
        }),
      },
    })

    const runtime = new bedrockagentcore.CfnRuntime(
      this,
      'AgentCoreRuntime',
      {
        agentRuntimeName: 'tonari',
        agentRuntimeArtifact: {
          containerConfiguration: {
            containerUri: `${ecrRepo.repositoryUri}:latest`,
          },
        },
        networkConfiguration: {
          networkMode: 'PUBLIC',
        },
        protocolConfiguration: 'HTTP',
        roleArn: runtimeRole.roleArn,
        authorizerConfiguration: {
          customJwtAuthorizer: {
            discoveryUrl: props.cognitoDiscoveryUrl,
            allowedClients: [props.cognitoClientId],
          },
        },
        environmentVariables: {
          AGENTCORE_MEMORY_ID: memory.attrMemoryId,
          AGENTCORE_GATEWAY_URL: gateway.attrGatewayUrl,
          AWS_REGION: region,
          BEDROCK_MODEL_ID: 'jp.anthropic.claude-haiku-4-5-20251001-v1:0',
          DEPLOY_VERSION: new Date().toISOString(),
        },
      }
    )
    this.runtimeArn = runtime.attrAgentRuntimeArn

    // Build must complete before Runtime creation
    runtime.node.addDependency(buildTrigger)

    // ========== Observability ==========
    const logGroup = new logs.LogGroup(this, 'RuntimeLogGroup', {
      logGroupName: `/aws/vendedlogs/bedrock-agentcore/${runtime.attrAgentRuntimeId}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Application Logs delivery pipeline
    const logsSource = new logs.CfnDeliverySource(
      this,
      'LogsDeliverySource',
      {
        name: `${runtime.attrAgentRuntimeId}-logs-source`,
        logType: 'APPLICATION_LOGS',
        resourceArn: runtime.attrAgentRuntimeArn,
      }
    )
    logsSource.addDependency(runtime)

    const logsDestination = new logs.CfnDeliveryDestination(
      this,
      'LogsDeliveryDestination',
      {
        name: `${runtime.attrAgentRuntimeId}-logs-destination`,
        deliveryDestinationType: 'CWL',
        destinationResourceArn: logGroup.logGroupArn,
      }
    )

    const logsDelivery = new logs.CfnDelivery(this, 'LogsDelivery', {
      deliverySourceName: logsSource.ref,
      deliveryDestinationArn: logsDestination.attrArn,
    })
    logsDelivery.addDependency(logsSource)
    logsDelivery.addDependency(logsDestination)

    // X-Ray Traces delivery pipeline
    const tracesSource = new logs.CfnDeliverySource(
      this,
      'TracesDeliverySource',
      {
        name: `${runtime.attrAgentRuntimeId}-traces-source`,
        logType: 'TRACES',
        resourceArn: runtime.attrAgentRuntimeArn,
      }
    )
    tracesSource.addDependency(runtime)

    const tracesDestination = new logs.CfnDeliveryDestination(
      this,
      'TracesDeliveryDestination',
      {
        name: `${runtime.attrAgentRuntimeId}-traces-destination`,
        deliveryDestinationType: 'XRAY',
      }
    )

    const tracesDelivery = new logs.CfnDelivery(this, 'TracesDelivery', {
      deliverySourceName: tracesSource.ref,
      deliveryDestinationArn: tracesDestination.attrArn,
    })
    tracesDelivery.addDependency(tracesSource)
    tracesDelivery.addDependency(tracesDestination)
  }
}
