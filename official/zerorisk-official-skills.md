# anthropics.claude-for-legal.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [review](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/commercial-legal/skills/review) | Review a vendor agreement, NDA, or SaaS subscription against your playbook. Identifies the agreement structure from titles, routes to the right review skill (vendor-agreement-review, nda-review, saas-msa-review), and integrates the output into a single memo. Use when the user says "review this contract", "check this MSA", "is this NDA okay", "look at this SaaS agreement", or attaches an inbound agreement for review. | None | 0 (SAFE) |
| [review-proposals](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/commercial-legal/skills/review-proposals) | Review and approve (or reject) pending playbook update proposals from the playbook-monitor agent and apply approved changes to the practice profile. Use when the playbook-monitor agent has surfaced proposals, when the user says "review playbook proposals", "what playbook updates are pending", or wants to step through deviation-driven playbook changes. | None | 0 (SAFE) |
| [expansion-update](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/employment-legal/skills/expansion-update) | Update the status of an in-progress international expansion project — recalculates what is now unblocked, flags anything overdue, and surfaces the next priorities. Use when work has happened since the last session and the expansion tracker needs to reflect the current state. | None | 0 (SAFE) |
| [investigation-add](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/employment-legal/skills/investigation-add) | Add data to an open investigation — documents, interview notes, or observations. Processes batches against the documented pull criteria, surfaces significant items, and logs everything reviewed for coverage verification. Use when new evidence, interview notes, or document productions come in for an open investigation. | None | 0 (SAFE) |
| [investigation-memo](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/employment-legal/skills/investigation-memo) | Draft or update the privileged investigation memo from the investigation log. Use when an investigation is far enough along to write the first memo cut, or when new data has been added and the existing draft needs updating. | None | 0 (SAFE) |
| [investigation-open](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/employment-legal/skills/investigation-open) | Open a new internal investigation matter — runs intake, generates the sources checklist, and creates the persistent investigation log. Use when a complaint or allegation comes in and the attorney needs to stand up a privileged investigation workspace. | None | 0 (SAFE) |
| [investigation-query](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/employment-legal/skills/investigation-query) | Ask questions against an open investigation log — what witnesses said, where accounts conflict, what gaps exist, what the strongest evidence is on each issue. Use when the attorney needs to query the investigation record without re-reading every entry. | None | 0 (SAFE) |
| [investigation-summary](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/employment-legal/skills/investigation-summary) | Draft an audience-specific summary from the privileged investigation memo — HR, leadership, or outside counsel versions. Use when an investigation memo needs to be communicated to an audience that should not see the full privileged work product. | None | 0 (SAFE) |
| [leave-tracker](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/employment-legal/skills/leave-tracker) | Check open leaves for deadline alerts and required decisions. Surfaces only the leaves that require an action and explains why — not a status board. Use weekly, or whenever the attorney needs to know which leaves have upcoming designation, certification, or exhaustion deadlines. | None | 0 (SAFE) |
| [customize](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/legal-clinic/skills/customize) | Guided customization of your legal clinic profile — change one thing without re-running the whole cold-start interview. Adjust clinic profile, jurisdiction, supervision style, practice-area templates, semester configuration, or output safeguards. Use when the user says "change my [thing]", "new semester", "add a practice area", "update my config", or "customize". | None | 0 (SAFE) |
| [plain-language-letters](https://github.com/anthropics/claude-for-legal/tree/4a6c651889c97cc9140580363c73e0eb17379c2b/legal-clinic/skills/plain-language-letters) | Reference: DEPRECATED — use `/client-letter` for routine correspondence or `/status client` for substantive updates. Split into two more focused skills during the v2 rebuild. Kept as a redirect for migration. | None | 0 (SAFE) |

# anthropics.knowledge-work-plugins.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [write-query](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/data/skills/write-query) | Write optimized SQL for your dialect with best practices. Use when translating a natural-language data need into SQL, building a multi-CTE query with joins and aggregations, optimizing a query against a large partitioned table, or getting dialect-specific syntax for Snowflake, BigQuery, Postgres, etc. | None | 0 (SAFE) |
| [ux-copy](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/design/skills/ux-copy) | Write or review UX copy — microcopy, error messages, empty states, CTAs. Trigger with "write copy for", "what should this button say?", "review this error message", or when naming a CTA, wording a confirmation dialog, filling an empty state, or writing onboarding text. | None | 0 (SAFE) |
| [debug](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/engineering/skills/debug) | Structured debugging session — reproduce, isolate, diagnose, and fix. Trigger with an error message or stack trace, "this works in staging but not prod", "something broke after the deploy", or when behavior diverges from expected and the cause isn't obvious. | None | 0 (SAFE) |
| [tech-debt](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/engineering/skills/tech-debt) | Identify, categorize, and prioritize technical debt. Trigger with "tech debt", "technical debt audit", "what should we refactor", "code health", or when the user asks about code quality, refactoring priorities, or maintenance backlog. | None | 0 (SAFE) |
| [interview-prep](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/human-resources/skills/interview-prep) | Create structured interview plans with competency-based questions and scorecards. Trigger with "interview plan for", "interview questions for", "how should we interview", "scorecard for", or when the user is preparing to interview candidates. | None | 0 (SAFE) |
| [org-planning](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/human-resources/skills/org-planning) | Headcount planning, org design, and team structure optimization. Trigger with "org planning", "headcount plan", "team structure", "reorg", "who should we hire next", or when the user is thinking about team size, reporting structure, or organizational design. | None | 0 (SAFE) |
| [compliance-tracking](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/operations/skills/compliance-tracking) | Track compliance requirements and audit readiness. Trigger with "compliance", "audit prep", "SOC 2", "ISO 27001", "GDPR", "regulatory requirement", or when the user needs help tracking, preparing for, or documenting compliance activities. | None | 0 (SAFE) |
| [risk-assessment](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/operations/skills/risk-assessment) | Identify, assess, and mitigate operational risks. Trigger with "what are the risks", "risk assessment", "risk register", "what could go wrong", or when the user is evaluating risks associated with a project, vendor, process, or decision. | None | 0 (SAFE) |
| [sequence-load](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/partner-built/apollo/skills/sequence-load) | Find leads matching criteria and bulk-add them to an Apollo outreach sequence. Handles enrichment, contact creation, deduplication, and enrollment in one flow. | None | 0 (SAFE) |
| [prospect](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/partner-built/common-room/skills/prospect) | Build targeted account or contact lists using Common Room's Prospector. Triggers on 'find companies that match [criteria]', 'build a prospect list', 'find contacts at [type of company]', 'show me companies hiring [role]', or any list-building request. | `references/prospect-guide.md` | 0 (SAFE) |
| [slack-search](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/partner-built/slack/skills/slack-search) | Guidance for effectively searching Slack to find messages, files, channels, and people | None | 0 (SAFE) |
| [choose-zoom-approach](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/partner-built/zoom-plugin/skills/choose-zoom-approach) | Choose the right Zoom architecture for a use case. Use when deciding between REST API, Webhooks, WebSockets, Meeting SDK, Video SDK, Zoom Apps SDK, Zoom MCP, Phone, Contact Center, or a hybrid approach. | None | 0 (SAFE) |
| [zoom-meeting-sdk-unreal](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/partner-built/zoom-plugin/skills/meeting-sdk/unreal) | Zoom Meeting SDK for Unreal Engine wrapper integrations. Use when building Unreal projects that embed Zoom meetings with C++ and Blueprint wrappers, including wrapper-to-SDK mapping concerns. | `RUNBOOK.md`, `unreal.md`, `concepts` (2 files), `examples/join-start-pattern.md`, `references` (3 files), `scenarios/high-level-scenarios.md`, `troubleshooting/common-issues.md` | 0 (SAFE) |
| [plan-zoom-integration](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/partner-built/zoom-plugin/skills/plan-zoom-integration) | Turn a Zoom integration idea into an implementation plan with architecture, auth, and delivery milestones. Use when you need a practical build plan, phased delivery sequence, risk list, and next-step recommendation. | None | 0 (SAFE) |
| [setup-zoom-mcp](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/partner-built/zoom-plugin/skills/setup-zoom-mcp) | Decide when Zoom MCP is the right fit and produce a safe setup plan for Claude. Use when planning AI workflows over Zoom data, deciding between MCP and REST, or defining a hybrid MCP architecture. | None | 0 (SAFE) |
| [start](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/partner-built/zoom-plugin/skills/start) | Start here for any Zoom integration or app idea. Use when you need to choose the right Zoom surface, shape the architecture, or route into the correct implementation skill without reading the whole Zoom doc set first. | None | 0 (SAFE) |
| [zoom-video-sdk-android](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/partner-built/zoom-plugin/skills/video-sdk/android) | Zoom Video SDK for Android native apps. Use when building custom Android video experiences with full UI control, session tokens, raw media options, and event-driven participant state. | `android.md`, `RUNBOOK.md`, `concepts` (2 files), `examples/session-join-pattern.md`, `references` (3 files), `scenarios/high-level-scenarios.md`, `troubleshooting/common-issues.md` | 0 (SAFE) |
| [product-brainstorming](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/product-management/skills/product-brainstorming) | Brainstorm product ideas, explore problem spaces, and challenge assumptions as a thinking partner. Use when exploring a new opportunity, generating solutions to a product problem, stress-testing an idea, or when a PM needs to think out loud with a sharp sparring partner before converging on a direction. | None | 0 (SAFE) |
| [customer-pulse-check](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/small-business/skills/customer-pulse-check) | Synthesizes themes from PayPal disputes, HubSpot tickets, and review exports into a top-3 fixable issues list with drafted response templates. Accepts optional since-date argument. | None | 0 (SAFE) |
| [invoice-chase](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/small-business/skills/invoice-chase) | Drafts overdue-invoice reminder emails from QuickBooks and PayPal data, matched to each customer's payment history and tone (gentle for good customers, firm for repeat late payers). Sends via PayPal with owner approval; non-PayPal invoices queue as mail drafts. Use when the user asks "who owes me money," mentions overdue invoices, or wants to follow up on unpaid invoices. | `reference` (2 files), `reference/examples` (2 files) | 0 (SAFE) |
| [quarterly-review](https://github.com/anthropics/knowledge-work-plugins/tree/c0272508353e205f014b20f7b9bce69f71b4f032/small-business/skills/quarterly-review) | Generates a full QBR narrative — revenue trend, margin trend, customer health, top opportunities and risks — as a presentation-ready PDF or deck. Accepts optional quarter and save-to arguments. | None | 0 (SAFE) |

# aws.agent-toolkit-for-aws.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [aws-cleanrooms](https://github.com/aws/agent-toolkit-for-aws/tree/2fcec193b56f64c64ba1d6570642faf0674d9e49/skills/specialized-skills/analytics-skills/aws-cleanrooms) | Troubleshoots and debugs AWS Clean Rooms collaboration issues related to IAM roles, S3 bucket policies, KMS keys, Lake Formation permissions, and CloudWatch logging for custom ML model training and inference jobs. Use when a customer reports permission failures, access errors, or log publishing issues in Clean Rooms. | `references/custom-model-logging-debugging.md`, `references/permission-debugging.md` | 0 (SAFE) |
| [creating-amazon-aurora-db-cluster-with-instances](https://github.com/aws/agent-toolkit-for-aws/tree/2fcec193b56f64c64ba1d6570642faf0674d9e49/skills/specialized-skills/database-skills/creating-amazon-aurora-db-cluster-with-instances) | Creates a complete Amazon Aurora database cluster with instances, handling cluster creation, instance provisioning, and Secrets Manager password management in the proper sequence. Use when setting up new Aurora MySQL or PostgreSQL clusters with production-ready configuration. | `references/create-amazon-aurora-db-cluster-with-instances.md` | 0 (SAFE) |
| [cloudfront](https://github.com/aws/agent-toolkit-for-aws/tree/2fcec193b56f64c64ba1d6570642faf0674d9e49/skills/specialized-skills/networking-and-content-delivery-skills/cloudfront) | Configures Amazon CloudFront content delivery across six workflows: when to use CloudFront and how it fits with AWS WAF, Shield, CloudFront Functions, Lambda@Edge, Route 53, and origins (creating a distribution, caching, and Flat Rate Pricing (FRP) versus pay-as-you-go pricing); managing custom-domain TLS certificates (ACM in us-east-1); configuring multi-tenant distributions; protecting origins with origin access control (OAC), VPC origins, and origin mutual TLS (mTLS); securing content with signed URLs and cookies, geographic restrictions, viewer mutual TLS, and edge token validation; and observing traffic with standard and real-time logs. Applicable when the customer wants to put CloudFront in front of content, choose pricing, lock an origin, restrict who can view content, or analyze logs. Not applicable for the Route 53 DNS side of a CloudFront custom domain or failover between distributions (see the route53-cloudfront skill), or for pure-Route 53 DNS work (see the route53 skill). | `references` (6 files) | 0 (SAFE) |
| [connecting-vpcs-with-peering](https://github.com/aws/agent-toolkit-for-aws/tree/2fcec193b56f64c64ba1d6570642faf0674d9e49/skills/specialized-skills/networking-and-content-delivery-skills/connecting-vpcs-with-peering) | Establishes VPC peering connections between two VPCs for direct private network connectivity. Always use this skill when creating or managing VPC peering — it validates CIDR overlap, updates all route tables in both VPCs, configures DNS resolution, and provides security group guidance that are critical for correct connectivity. | `references/vpc-peering-connection.md` | 0 (SAFE) |
| [sitetositevpn](https://github.com/aws/agent-toolkit-for-aws/tree/2fcec193b56f64c64ba1d6570642faf0674d9e49/skills/specialized-skills/networking-and-content-delivery-skills/sitetositevpn) | Configures AWS Site-to-Site VPN: creating an IPsec VPN connection between an on-premises network and a VPC, choosing the target gateway (virtual private gateway, transit gateway, or AWS Cloud WAN), choosing static or dynamic (BGP) routing, sizing tunnel bandwidth (Standard 1.25 Gbps or Large 5 Gbps), connecting many sites through a VPN Concentrator, applying the customer gateway device configuration, making a connection highly available, and monitoring tunnels with CloudWatch. Applicable when the user wants to connect a data center or branch office to AWS over an encrypted tunnel, choose how routes are exchanged, scale throughput, consolidate sites, or diagnose a down tunnel. Routes to the right per-task procedure in references. Not for AWS Direct Connect (its own service), Client VPN for individual remote users, the transit gateway side of a VPN attachment (transitgateway skill), or Route 53 DNS work. | `references` (7 files) | 0 (SAFE) |
| [transitgateway](https://github.com/aws/agent-toolkit-for-aws/tree/2fcec193b56f64c64ba1d6570642faf0674d9e49/skills/specialized-skills/networking-and-content-delivery-skills/transitgateway) | Configures AWS Transit Gateway: creating a hub and attaching VPCs, segmenting traffic with route tables, centralizing egress and inspection through a hub (appliances or a Gateway Load Balancer endpoint), forcing east-west traffic between VPCs through AWS Network Firewall, connecting on-premises networks over the transit-gateway side of a Site-to-Site VPN or Direct Connect attachment (including ECMP to aggregate bandwidth across multiple VPN tunnels), peering transit gateways across Regions, migrating from a VPC peering mesh, and routing IP multicast. Applicable when connecting many VPCs through one router, isolating environments, forcing VPC-to-VPC traffic through a central Network Firewall, reaching on-premises over the hub, linking Regions, or moving off a peering mesh. Not applicable for single-VPC routing, VPC peering between two VPCs (vpcpeering skill), Direct Connect gateway or virtual interface setup (directconnect skill), or Route 53 DNS work. | `references` (8 files) | 0 (SAFE) |
| [troubleshooting-application-failures](https://github.com/aws/agent-toolkit-for-aws/tree/2fcec193b56f64c64ba1d6570642faf0674d9e49/skills/specialized-skills/operations-skills/troubleshooting-application-failures) | Troubleshoots failing applications by discovering and analyzing CloudWatch log groups to identify error patterns, root causes, and actionable solutions. Use when an application is experiencing failures and log-based diagnosis is needed. | `references/application-failure-troubleshooting.md` | 0 (SAFE) |
| [resilience-hub-failure-mode-assessment](https://github.com/aws/agent-toolkit-for-aws/tree/2fcec193b56f64c64ba1d6570642faf0674d9e49/skills/specialized-skills/resilience-skills/resilience-hub-failure-mode-assessment) | Runs and interprets AWS Resilience Hub v2 failure mode assessments. Covers starting assessments, understanding findings (severity, categories, recommendations), triaging by achievability, working with AI-generated service functions, and resolving findings. Applies when the user wants to run an assessment, review findings, or understand failure modes, or has a specific finding and asks how to resolve, remediate, or fix it. Does not apply to initial setup (use resilience-hub-getting-started) or FIS experiments. | `references/assessment-workflow.md` | 0 (SAFE) |
| [creating-api-gateway-stage](https://github.com/aws/agent-toolkit-for-aws/tree/2fcec193b56f64c64ba1d6570642faf0674d9e49/skills/specialized-skills/serverless-skills/creating-api-gateway-stage) | Creates an API Gateway stage with CloudWatch logging, X-Ray tracing, throttling, WAF integration, and IAM roles following AWS best practices. Use when deploying a REST API to different environments such as dev, test, or production. | `references/create-api-gateway-stage.md` | 0 (SAFE) |

# google.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [google-cloud-waf-reliability](https://github.com/google/skills/tree/c4386c398f1f5f0b78d493612df5dbd0bd8baf49/plugins/cloud/google-cloud-well-architected/skills/google-cloud-waf-reliability) | Generates guidance for reliability, resilience, availability, redundancy, fault-tolerance, and disaster recovery (DR) for Google Cloud workloads based on the design principles and recommendations in the Google Cloud Well-Architected Framework. Use when the user asks to evaluate, design, or improve the reliability, resilience, availability, or disaster recovery capabilities of Google Cloud workloads. | None | 0 (SAFE) |
| [google-cloud-waf-reliability](https://github.com/google/skills/tree/c4386c398f1f5f0b78d493612df5dbd0bd8baf49/skills/cloud/google-cloud-waf-reliability) | Generates guidance for reliability, resilience, availability, redundancy, fault-tolerance, and disaster recovery (DR) for Google Cloud workloads based on the design principles and recommendations in the Google Cloud Well-Architected Framework. Use when the user asks to evaluate, design, or improve the reliability, resilience, availability, or disaster recovery capabilities of Google Cloud workloads. | None | 0 (SAFE) |

# GoogleChrome.modern-web-guidance.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# Kotlin.kotlin-agent-skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# Kotlin.kotlin-agent.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# Unity-Technologies.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# android.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [adaptive](https://github.com/android/skills/tree/a8e8d000ef5a15f0a8850f8d98bbef7cb2182cce/jetpack-compose/adaptive) | Instructions to make or update an app's UI so that it adapts to different Android devices including phones, tablets, foldables, laptops, desktop, TV, Auto and XR. It includes how to handle different window sizes, pointing devices (such as mouse) and text entry devices (such as keyboard) using the Compose MediaQuery API. It also covers multi-pane layouts using Navigation3 Scenes, adaptive UI components (such as buttons) with varying target sizes, and adaptive layouts (including navigation areas - nav rails and nav bars) using the Compose Grid and FlexBox APIs. | `references/android/develop/ui/compose/layouts/adaptive/flexbox` (4 files), `references/android/develop/ui/compose/layouts/adaptive/grid` (4 files), `references/android/develop/ui/compose/layouts/adaptive/mediaquery/index.md`, `references/android/develop/ui/compose/tooling/debug.md`, `references/android/guide/navigation/navigation-3/recipes/material-listdetail.md` | 0 (SAFE) |

# anthropics.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# browser-use.browser-use.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# cloudflare.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# dotnet.skills.plugins.dotnet-diag.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# dotnet.skills.plugins.dotnet-test.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# dotnet.skills.plugins.dotnet.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# facebook.react..claude.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [extract-errors](https://github.com/facebook/react/tree/a0566250b210499b4c5677f5ac2eedbd71d51a1b/.claude/skills/extract-errors) | Use when adding new error messages to React, or seeing "unknown error code" warnings. | None | 0 (SAFE) |
| [fix](https://github.com/facebook/react/tree/a0566250b210499b4c5677f5ac2eedbd71d51a1b/.claude/skills/fix) | Use when you have lint errors, formatting issues, or before committing code to ensure it passes CI. | None | 0 (SAFE) |
| [flags](https://github.com/facebook/react/tree/a0566250b210499b4c5677f5ac2eedbd71d51a1b/.claude/skills/flags) | Use when you need to check feature flag states, compare channels, or debug why a feature behaves differently across release channels. | None | 0 (SAFE) |
| [flow](https://github.com/facebook/react/tree/a0566250b210499b4c5677f5ac2eedbd71d51a1b/.claude/skills/flow) | Use when you need to run Flow type checking, or when seeing Flow type errors in React code. | None | 0 (SAFE) |
| [verify](https://github.com/facebook/react/tree/a0566250b210499b4c5677f5ac2eedbd71d51a1b/.claude/skills/verify) | Use when you want to validate changes before committing, or when you need to check all React contribution requirements. | None | 0 (SAFE) |

# figma.mcp-server-guide.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [figma-create-new-file](https://github.com/figma/mcp-server-guide/tree/72fcf1f4b170bcaa78fa8bef2f27cce15f4d58f4/skills/figma-create-new-file) | **MANDATORY prerequisite** — you MUST invoke this skill BEFORE every `create_new_file` tool call. NEVER call `create_new_file` directly without loading this skill first. Trigger whenever the user wants a new blank Figma file — a new design, FigJam, or Slides file — or when you need a fresh file before calling `use_figma`. Usage — /figma-create-new-file [editorType] [fileName] (e.g. /figma-create-new-file figjam My Whiteboard, /figma-create-new-file slides Q3 Review) | None | 0 (SAFE) |

# firebase.agent-skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# firebase.agent.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# google-gemini.gemini-cli..gemini.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# google-labs-code.stitch-skills.plugins.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# openai.skills.skills..curated.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [figma-create-new-file](https://github.com/openai/skills/tree/972cb867affac58fda9afa76bb1a19b399a278cf/skills/.curated/figma-create-new-file) | Create a new blank Figma file. Use when the user wants to create a new Figma design or FigJam file, or when you need a new file before calling use_figma. Handles plan resolution via whoami if needed. Usage — /figma-create-new-file [editorType] [fileName] (e.g. /figma-create-new-file figjam My Whiteboard) | `LICENSE.TXT`, `maintainers.yml`, `agents/openai.yaml`, `assets` (3 files) | 0 (SAFE) |

# openai.skills.skills..system.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# vercel-labs.agent-skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# vercel-labs.agent.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# vercel-labs.emulate.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

