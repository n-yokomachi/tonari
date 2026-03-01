import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha'
import * as cdk from 'aws-cdk-lib'
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore'
import { Platform } from 'aws-cdk-lib/aws-ecr-assets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'
import * as path from 'path'

export interface AgentCoreConstructProps {
  /** Cognito OIDC Discovery URL for JWT authorizer */
  cognitoDiscoveryUrl: string
  /** Cognito App Client ID for JWT authorizer */
  cognitoClientId: string
  /** perfume-search Lambda function (Gateway target) */
  searchLambda: lambda.IFunction
  /** twitter-read Lambda function (Gateway target, optional) */
  twitterReadLambda?: lambda.IFunction
  /** twitter-write Lambda function (Gateway target, optional) */
  twitterWriteLambda?: lambda.IFunction
  /** diary-tool Lambda function (Gateway target, optional) */
  diaryLambda?: lambda.IFunction
  /** task-tool Lambda function (Gateway target) */
  taskToolLambda: lambda.IFunction
  /** calendar-tool Lambda function (Gateway target) */
  calendarToolLambda: lambda.IFunction
  /** date-tool Lambda function (Gateway target) */
  dateToolLambda: lambda.IFunction
}

export class AgentCoreConstruct extends Construct {
  /** AgentCore Memory ID */
  public readonly memoryId: string
  /** AgentCore Gateway URL */
  public readonly gatewayUrl: string
  /** AgentCore Runtime ARN */
  public readonly runtimeArn: string

  constructor(scope: Construct, id: string, props: AgentCoreConstructProps) {
    super(scope, id)

    const region = cdk.Stack.of(this).region
    const account = cdk.Stack.of(this).account

    // ========== Memory (L1 — L2 strategies don't map to 4-strategy config) ==========
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

    // ========== Gateway (L2) ==========
    const lambdaFunctions = [
      props.searchLambda,
      props.taskToolLambda,
      props.calendarToolLambda,
      props.dateToolLambda,
    ]
    if (props.twitterReadLambda) lambdaFunctions.push(props.twitterReadLambda)
    if (props.twitterWriteLambda) lambdaFunctions.push(props.twitterWriteLambda)
    if (props.diaryLambda) lambdaFunctions.push(props.diaryLambda)

    const gatewayRole = new iam.Role(this, 'GatewayRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      inlinePolicies: {
        LambdaInvoke: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['lambda:InvokeFunction'],
              resources: lambdaFunctions.map((fn) => fn.functionArn),
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

    const gateway = new agentcore.Gateway(this, 'ToolsGateway', {
      gatewayName: 'tonari-gateway',
      protocolConfiguration: new agentcore.McpProtocolConfiguration({
        supportedVersions: [agentcore.MCPProtocolVersion.MCP_2025_03_26],
      }),
      authorizerConfiguration: agentcore.GatewayAuthorizer.usingAwsIam(),
      role: gatewayRole,
    })
    // Preserve CloudFormation logical IDs from L1 migration to avoid resource recreation
    const cfnGateway =
      gateway.node.defaultChild as bedrockagentcore.CfnGateway
    cfnGateway.overrideLogicalId('AgentCoreToolsGateway84E3F2E3')
    this.gatewayUrl = gateway.gatewayUrl!

    const iamCredential = [agentcore.GatewayCredentialProvider.fromIamRole()]

    // Gateway Target: perfume-search
    gateway.addLambdaTarget('PerfumeSearch', {
      gatewayTargetName: 'perfume-search',
      lambdaFunction: props.searchLambda,
      credentialProviderConfigurations: iamCredential,
      toolSchema: agentcore.ToolSchema.fromInline([
        {
          name: 'search_perfumes',
          description:
            'Search perfume database by keyword. Returns matching perfumes with details like notes, scenes, seasons, and ratings.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              query: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Search keyword for perfume name, brand, notes, scenes, or seasons',
              },
              limit: {
                type: agentcore.SchemaDefinitionType.NUMBER,
                description:
                  'Maximum number of results to return (default: 5)',
              },
            },
            required: ['query'],
          },
        },
      ]),
    })

    // Gateway Target: twitter-read (conditional)
    if (props.twitterReadLambda) {
      gateway.addLambdaTarget('TwitterRead', {
        gatewayTargetName: 'twitter-read',
        lambdaFunction: props.twitterReadLambda,
        credentialProviderConfigurations: iamCredential,
        toolSchema: agentcore.ToolSchema.fromInline([
          {
            name: 'get_todays_tweets',
            description:
              "Fetch the owner's tweets posted today. Returns tweet text and timestamps.",
            inputSchema: {
              type: agentcore.SchemaDefinitionType.OBJECT,
              properties: {
                owner_user_id: {
                  type: agentcore.SchemaDefinitionType.STRING,
                  description: 'Twitter user ID of the account owner',
                },
                max_count: {
                  type: agentcore.SchemaDefinitionType.NUMBER,
                  description:
                    'Maximum number of tweets to fetch (default: 3)',
                },
              },
              required: ['owner_user_id'],
            },
          },
        ]),
      })
    }

    // Gateway Target: twitter-write (conditional)
    if (props.twitterWriteLambda) {
      gateway.addLambdaTarget('TwitterWrite', {
        gatewayTargetName: 'twitter-write',
        lambdaFunction: props.twitterWriteLambda,
        credentialProviderConfigurations: iamCredential,
        toolSchema: agentcore.ToolSchema.fromInline([
          {
            name: 'post_tweet',
            description: 'Post a tweet on behalf of the Tonari account.',
            inputSchema: {
              type: agentcore.SchemaDefinitionType.OBJECT,
              properties: {
                text: {
                  type: agentcore.SchemaDefinitionType.STRING,
                  description:
                    'The tweet text to post (max 280 characters)',
                },
              },
              required: ['text'],
            },
          },
        ]),
      })
    }

    // Gateway Target: diary-tool (conditional)
    if (props.diaryLambda) {
      gateway.addLambdaTarget('DiaryTool', {
        gatewayTargetName: 'diary-tool',
        lambdaFunction: props.diaryLambda,
        credentialProviderConfigurations: iamCredential,
        toolSchema: agentcore.ToolSchema.fromInline([
          {
            name: 'save_diary',
            description:
              'Save a diary entry for the user. Use after hearing session is complete and user approves the generated diary.',
            inputSchema: {
              type: agentcore.SchemaDefinitionType.OBJECT,
              properties: {
                user_id: {
                  type: agentcore.SchemaDefinitionType.STRING,
                  description: 'User ID of the diary owner',
                },
                date: {
                  type: agentcore.SchemaDefinitionType.STRING,
                  description:
                    'Date of the diary entry in YYYY-MM-DD format',
                },
                body: {
                  type: agentcore.SchemaDefinitionType.STRING,
                  description: 'Body text of the diary entry',
                },
              },
              required: ['user_id', 'date', 'body'],
            },
          },
          {
            name: 'get_diaries',
            description:
              "Retrieve the user's diary entries sorted by date descending.",
            inputSchema: {
              type: agentcore.SchemaDefinitionType.OBJECT,
              properties: {
                user_id: {
                  type: agentcore.SchemaDefinitionType.STRING,
                  description: 'User ID of the diary owner',
                },
                limit: {
                  type: agentcore.SchemaDefinitionType.NUMBER,
                  description:
                    'Maximum number of diary entries to return (default: 10)',
                },
              },
              required: ['user_id'],
            },
          },
        ]),
      })
    }

    // Gateway Target: task-tool
    gateway.addLambdaTarget('TaskTool', {
      gatewayTargetName: 'task-tool',
      lambdaFunction: props.taskToolLambda,
      credentialProviderConfigurations: iamCredential,
      toolSchema: agentcore.ToolSchema.fromInline([
        {
          name: 'list_tasks',
          description:
            'List active tasks with optional deadline filter. Use to check current tasks or find tasks due soon.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              user_id: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'User ID of the task owner',
              },
              include_completed: {
                type: agentcore.SchemaDefinitionType.BOOLEAN,
                description:
                  'Include completed tasks in results (default: false)',
              },
              days_until_due: {
                type: agentcore.SchemaDefinitionType.NUMBER,
                description:
                  'Filter tasks with due date within N days from now',
              },
            },
            required: ['user_id'],
          },
        },
        {
          name: 'add_task',
          description:
            'Add a new task for the user. Use when the user wants to create a task or when auto-detecting task-like statements.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              user_id: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'User ID of the task owner',
              },
              title: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'Task title',
              },
              due_date: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Optional due date in YYYY-MM-DD format',
              },
            },
            required: ['user_id', 'title'],
          },
        },
        {
          name: 'complete_task',
          description:
            'Mark a task as completed. Use when the user says they finished a task.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              user_id: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'User ID of the task owner',
              },
              task_id: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'ID of the task to complete',
              },
            },
            required: ['user_id', 'task_id'],
          },
        },
        {
          name: 'update_task',
          description:
            'Update a task title or due date.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              user_id: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'User ID of the task owner',
              },
              task_id: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'ID of the task to update',
              },
              title: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'New task title',
              },
              due_date: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'New due date in YYYY-MM-DD format, or empty string to remove',
              },
            },
            required: ['user_id', 'task_id'],
          },
        },
      ]),
    })

    // Gateway Target: calendar-tool
    gateway.addLambdaTarget('CalendarTool', {
      gatewayTargetName: 'calendar-tool',
      lambdaFunction: props.calendarToolLambda,
      credentialProviderConfigurations: iamCredential,
      toolSchema: agentcore.ToolSchema.fromInline([
        {
          name: 'list_events',
          description:
            'List Google Calendar events for a specific date or date range. Returns event titles, times, locations, and IDs.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              date: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Date in YYYY-MM-DD format (for single day lookup). Defaults to today if neither date nor date_from/date_to is provided.',
              },
              date_from: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Start date in YYYY-MM-DD format (for date range lookup)',
              },
              date_to: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'End date in YYYY-MM-DD format (for date range lookup)',
              },
            },
            required: [],
          },
        },
        {
          name: 'check_availability',
          description:
            'Check calendar availability. Supports three modes: "day" (single day), "time_slot" (specific time range on a day), "range" (find free days in a period).',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              check_type: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Type of availability check: "day" (default), "time_slot", or "range"',
              },
              date: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Date in YYYY-MM-DD format (for "day" and "time_slot" modes)',
              },
              date_from: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Start date in YYYY-MM-DD format (for "range" mode)',
              },
              date_to: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'End date in YYYY-MM-DD format (for "range" mode)',
              },
              time_from: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Start time in HH:MM format (for "time_slot" mode, default: 09:00)',
              },
              time_to: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'End time in HH:MM format (for "time_slot" mode, default: 18:00)',
              },
            },
            required: ['check_type'],
          },
        },
        {
          name: 'create_event',
          description:
            'Create a new Google Calendar event. Supports both timed events (ISO 8601 datetime) and all-day events (YYYY-MM-DD date only).',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              title: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'Event title',
              },
              start: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Start date/time. Use YYYY-MM-DD for all-day events, or ISO 8601 datetime (e.g. 2025-03-01T14:00:00) for timed events.',
              },
              end: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'End date/time. Same format as start. If omitted, defaults to 1 hour after start for timed events, or single day for all-day events.',
              },
              location: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'Event location (optional)',
              },
              description: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'Event description (optional)',
              },
            },
            required: ['title', 'start'],
          },
        },
        {
          name: 'update_event',
          description:
            'Update an existing Google Calendar event. Only specified fields will be updated.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              event_id: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'ID of the event to update',
              },
              title: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'New event title',
              },
              start: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'New start date/time',
              },
              end: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'New end date/time',
              },
              location: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'New event location',
              },
              description: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'New event description',
              },
            },
            required: ['event_id'],
          },
        },
        {
          name: 'delete_event',
          description:
            'Delete a Google Calendar event by its ID.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              event_id: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'ID of the event to delete',
              },
            },
            required: ['event_id'],
          },
        },
        {
          name: 'suggest_schedule',
          description:
            'Suggest available time slots within a date range. Analyzes calendar to find up to 5 free slots that match the specified duration and preferred time range.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              date_from: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Start date of search range in YYYY-MM-DD format',
              },
              date_to: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'End date of search range in YYYY-MM-DD format',
              },
              duration_minutes: {
                type: agentcore.SchemaDefinitionType.NUMBER,
                description:
                  'Required duration in minutes (default: 60)',
              },
              preferred_time_from: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Preferred start time in HH:MM format (default: 09:00)',
              },
              preferred_time_to: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Preferred end time in HH:MM format (default: 18:00)',
              },
            },
            required: ['date_from', 'date_to', 'duration_minutes'],
          },
        },
      ]),
    })

    // Gateway Target: date-tool
    gateway.addLambdaTarget('DateTool', {
      gatewayTargetName: 'date-tool',
      lambdaFunction: props.dateToolLambda,
      credentialProviderConfigurations: iamCredential,
      toolSchema: agentcore.ToolSchema.fromInline([
        {
          name: 'get_current_datetime',
          description:
            'Get the current date, time, day of week, and ISO week number in JST (Asia/Tokyo). Use this when you need to know what day it is today or the current time.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {},
            required: [],
          },
        },
        {
          name: 'calculate_date',
          description:
            'Calculate a date by adding or subtracting days, weeks, or months from a base date. Use negative values to go backward. If base_date is omitted, uses today.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              base_date: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Base date in YYYY-MM-DD format (defaults to today if omitted)',
              },
              offset_days: {
                type: agentcore.SchemaDefinitionType.NUMBER,
                description:
                  'Number of days to add (positive) or subtract (negative)',
              },
              offset_weeks: {
                type: agentcore.SchemaDefinitionType.NUMBER,
                description:
                  'Number of weeks to add (positive) or subtract (negative)',
              },
              offset_months: {
                type: agentcore.SchemaDefinitionType.NUMBER,
                description:
                  'Number of months to add (positive) or subtract (negative)',
              },
            },
            required: [],
          },
        },
        {
          name: 'list_dates_in_range',
          description:
            'List all dates matching a specific weekday within a date range. For example, "all Tuesdays in March 2026". Supports Japanese and English weekday names.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              start_date: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'Start date of range in YYYY-MM-DD format',
              },
              end_date: {
                type: agentcore.SchemaDefinitionType.STRING,
                description: 'End date of range in YYYY-MM-DD format',
              },
              weekday: {
                type: agentcore.SchemaDefinitionType.STRING,
                description:
                  'Weekday name in Japanese (月〜日) or English (Monday〜Sunday, Mon〜Sun)',
              },
            },
            required: ['start_date', 'end_date', 'weekday'],
          },
        },
      ]),
    })

    // ========== Runtime (L2) ==========
    const artifact = agentcore.AgentRuntimeArtifact.fromAsset(
      path.join(__dirname, '../../agentcore'),
      { platform: Platform.LINUX_ARM64 }
    )

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
              resources: [gateway.gatewayArn],
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

    const runtime = new agentcore.Runtime(this, 'AgentCoreRuntime', {
      runtimeName: 'tonari',
      agentRuntimeArtifact: artifact,
      executionRole: runtimeRole,
      networkConfiguration:
        agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
      authorizerConfiguration:
        agentcore.RuntimeAuthorizerConfiguration.usingJWT(
          props.cognitoDiscoveryUrl,
          [props.cognitoClientId]
        ),
      environmentVariables: {
        AGENTCORE_MEMORY_ID: memory.attrMemoryId,
        AGENTCORE_GATEWAY_URL: gateway.gatewayUrl!,
        AWS_REGION: region,
        BEDROCK_MODEL_ID: 'jp.anthropic.claude-haiku-4-5-20251001-v1:0',
      },
    })
    this.runtimeArn = runtime.agentRuntimeArn

    // Preserve CloudFormation logical ID from L1 migration to avoid resource recreation
    const cfnRuntime = runtime.node.defaultChild as bedrockagentcore.CfnRuntime
    cfnRuntime.overrideLogicalId('AgentCoreAgentCoreRuntimeDD354A6E')

    // ========== Observability (L1 — no L2 equivalent) ==========

    const logGroup = new logs.LogGroup(this, 'RuntimeLogGroup', {
      logGroupName: `/aws/vendedlogs/bedrock-agentcore/${runtime.agentRuntimeId}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Application Logs delivery pipeline
    const logsSource = new logs.CfnDeliverySource(
      this,
      'LogsDeliverySource',
      {
        name: `${runtime.agentRuntimeId}-logs-source`,
        logType: 'APPLICATION_LOGS',
        resourceArn: runtime.agentRuntimeArn,
      }
    )
    logsSource.addDependency(cfnRuntime)

    const logsDestination = new logs.CfnDeliveryDestination(
      this,
      'LogsDeliveryDestination',
      {
        name: `${runtime.agentRuntimeId}-logs-destination`,
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
        name: `${runtime.agentRuntimeId}-traces-source`,
        logType: 'TRACES',
        resourceArn: runtime.agentRuntimeArn,
      }
    )
    tracesSource.addDependency(cfnRuntime)

    const tracesDestination = new logs.CfnDeliveryDestination(
      this,
      'TracesDeliveryDestination',
      {
        name: `${runtime.agentRuntimeId}-traces-destination`,
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
