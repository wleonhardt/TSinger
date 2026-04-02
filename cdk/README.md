# TSinger — AWS Deployment (CDK)

Optional infrastructure-as-code for deploying TSinger to AWS behind CloudFront on a single EC2 instance.

> TSinger is a static SPA. This stack keeps the same deployment philosophy as YASP while adapting the runtime correctly for a static nginx-served application.

## Architecture

```text
                                    ┌─────────────────┐
                                    │  Edge WAF       │
                                    │  (CLOUDFRONT)   │
                                    │  • Managed rules│
                                    │  • Rate limit   │
                                    └────────┬────────┘
                                             │
┌──────────┐     Basic Auth      ┌───────────▼───┐   Origin Secret   ┌────────────────────────────┐
│ Browser  │ ──────────────────▶ │  CloudFront    │ ────────────────▶ │ EC2 + host nginx + Docker  │
└──────────┘                     │ + CF Function  │   (custom header) │ TSinger container:8080     │
                                 └───────────────┘                    └────────────────────────────┘
```

1. CloudFront WAF evaluates managed rules and rate limits
2. A CloudFront Function can enforce HTTP Basic Auth
3. CloudFront adds `x-tsinger-origin-secret`
4. EC2 security group allows inbound only from CloudFront origin-facing IP ranges
5. Host nginx validates the origin secret before proxying
6. The Docker container serves the built TSinger SPA through nginx

## Runtime model

TSinger does not need a Node server in production.

- Docker image is built from the Vite `dist/` output
- Container runtime is `nginx:alpine`
- SPA deep links fall back to `index.html`
- `/healthz` is served by the container with HTTP 200
- The EC2 host nginx only exists to guard the origin and proxy to the container

## Security model

This stack is appropriate for lightweight controlled access, not a high-assurance perimeter.

- Optional Basic Auth at the CloudFront edge
- Origin secret header validated by host nginx
- EC2 security group restricted to the CloudFront origin-facing managed prefix list
- WAF with managed common rules and a rate limit
- Secrets passed as CloudFormation `NoEcho` parameters

## Prerequisites

- AWS account with permissions for EC2, CloudFront, WAF, ECR, IAM, S3, SNS, CloudWatch, and SSM
- AWS CLI v2 configured
- CDK bootstrapped in `us-east-1`
- Node.js 20+, npm, Docker
- An x86_64 EC2 instance type such as `t3.micro` or `t3.small`

## Setup

### 1. Install and bootstrap

```bash
cd cdk
npm install
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
```

### 2. Choose ECR repository behavior

Either:

- import an existing repo (default name: `tsinger`)
- or let CDK create one with `-c createRepository=true`

### 3. Build and push the image

The supplied workflows handle this automatically, but you can do it manually:

```bash
docker build --platform linux/amd64 -t tsinger:0.1.0 ..

aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

docker tag tsinger:0.1.0 <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/tsinger:0.1.0
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/tsinger:0.1.0
```

### 4. Generate secrets

```bash
ORIGIN_SECRET=$(openssl rand -hex 32)
BASIC_AUTH_PASSWORD=$(openssl rand -base64 24)
```

### 5. Deploy

```bash
npx cdk deploy \
  -c imageTag=0.1.0 \
  -c createRepository=true \
  -c enableBasicAuth=true \
  --parameters OriginSecret="$ORIGIN_SECRET" \
  --parameters BasicAuthUsername=tsinger \
  --parameters BasicAuthPassword="$BASIC_AUTH_PASSWORD"
```

For digest pinning, replace `-c imageTag=...` with `-c imageDigest=sha256:...`.

## Configuration

### CloudFormation parameters

| Parameter | Required | Default | Description |
| --- | --- | --- | --- |
| `OriginSecret` | Yes | none | Hex secret validated by host nginx |
| `BasicAuthUsername` | If auth enabled | `tsinger` | CloudFront Basic Auth username |
| `BasicAuthPassword` | If auth enabled | none | CloudFront Basic Auth password |

### CDK context

| Context key | Required | Default | Description |
| --- | --- | --- | --- |
| `imageTag` | * | none | Image tag to deploy |
| `imageDigest` | * | none | Image digest to deploy |
| `ecrRepoName` | No | `tsinger` | ECR repository name |
| `serviceName` | No | `tsinger` | Resource naming prefix and host service name |
| `createRepository` | No | `false` | Create the ECR repository |
| `retainLogBucket` | No | `false` | Retain CloudFront access logs on teardown |
| `enableBasicAuth` | No | `true` | Enable Basic Auth at CloudFront |
| `alarmTopicArn` | No | none | SNS topic ARN for alarm notifications |
| `instanceType` | No | `t3.micro` | EC2 instance type |
| `domainName` | No | none | Custom domain for CloudFront |
| `certificateArn` | No | none | ACM certificate ARN for the custom domain |

\* Exactly one of `imageTag` or `imageDigest` is required.

## Stack outputs

| Output | Description |
| --- | --- |
| `CloudFrontUrl` | Main TSinger entry point |
| `InstanceId` | EC2 origin instance ID |
| `OriginLogGroupName` | CloudWatch Logs group for container logs |
| `SsmStartSessionCommand` | Ready-to-run SSM session command |
| `EcrRepositoryUri` | ECR repository URI |
| `DeployedImageReference` | Exact deployed image |
| `EdgeWafArn` | WAF ARN |
| `AccessLogsBucket` | CloudFront access logs bucket |

## Operations

### SSM access

```bash
aws ssm start-session --target <INSTANCE_ID>
```

Useful commands on the instance:

```bash
sudo systemctl status tsinger.service
sudo systemctl restart tsinger.service
sudo docker logs tsinger --tail 200
curl -fsS -H 'x-tsinger-origin-secret: <ORIGIN_SECRET>' http://127.0.0.1/healthz
```

If you override `serviceName`, replace `tsinger.service` and `/usr/local/bin/tsinger-run.sh` with your chosen name prefix.

### Container launcher

The EC2 origin installs:

- `/usr/local/bin/<serviceName>-run.sh`
- `<serviceName>.service`

The launcher:

1. logs into ECR
2. pulls the configured image
3. removes any previous container
4. starts the TSinger nginx container bound to `127.0.0.1:8080`

### Deploying a new image

The GitHub Actions deploy workflow updates:

```bash
/usr/local/bin/<serviceName>-run.sh
```

Specifically it changes `IMAGE_IDENTIFIER=...`, restarts `<serviceName>.service`, and polls:

```bash
http://127.0.0.1/healthz
```

with the correct origin secret header.

## Known tradeoffs

- Single instance, no HA
- CloudFront to EC2 stays on HTTP to keep the stack lightweight
- Static assets are served from EC2 rather than S3 so the deployment model stays aligned with YASP
- Basic Auth at CloudFront is pragmatic access control, not a replacement for a full identity layer

## Tear down

```bash
npx cdk destroy
```

If CDK created the repository, ECR is retained and must be deleted manually if you no longer need it.
