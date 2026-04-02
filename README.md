# TSinger

A browser-based procedural music player built with TypeScript, React, and the Web Audio API. Generates and plays compositions in real time using configurable voice presets and music-theory-driven authoring.

## Development

```bash
npm install
npm run dev          # Start Vite dev server
npm run build        # Typecheck + production build
npm run typecheck    # TypeScript type checking only
npm run preview      # Preview production build locally
npm run analyze      # Run audio analysis CLI
```

## Docker

The app is packaged as an nginx container serving the built SPA on port 8080.

```bash
docker build -t tsinger .
docker run --rm -p 8080:8080 tsinger
```

Endpoints:

| Path | Behavior |
|------|----------|
| `/` | Serves `index.html` |
| `/healthz` | Returns `200 ok` |
| `/assets/*` | Immutable cached static assets |
| `/*` (other) | SPA fallback to `index.html` |

## Infrastructure

See [`cdk/README.md`](cdk/README.md) for full AWS CDK deployment documentation including architecture, security model, and operational procedures.

**Architecture:** CloudFront (WAF + optional Basic Auth) → EC2 (nginx reverse proxy + origin secret validation) → Docker container on port 8080. Images are stored in ECR; the EC2 instance runs a systemd service (`tsinger.service`) that pulls and runs the container.

---

## CI/CD Pipeline

Three GitHub Actions workflows form a sequential pipeline:

```
Push to main → CI → Docker Publish → Deploy to EC2
```

### Workflow 1: CI (`.github/workflows/ci.yml`)

**Triggers:** Pull requests, pushes to `main`.

**Jobs:**
- **validate** — Install deps, typecheck, build
- **docker-validation** — Build Docker image, start container, verify `/healthz`, `/`, and SPA deep-link routing
- **cdk-synth** — Synthesize CDK stack (only when `cdk/` files change)

### Workflow 2: Docker Publish (`.github/workflows/docker-publish.yml`)

**Triggers:** Successful CI on `main`, or manual dispatch.

**Publishes:**
- `wleonhardt/tsinger:<8-char-sha>`
- `wleonhardt/tsinger:main`

### Workflow 3: Deploy to EC2 (`.github/workflows/deploy-ec2.yml`)

**Triggers:** Successful Docker Publish on `main`, or manual dispatch with optional `image_tag` input.

**Steps:**
1. Pull image from Docker Hub, re-tag and push to ECR
2. Send deploy script to EC2 via SSM
3. Update `IMAGE_IDENTIFIER` in `/usr/local/bin/tsinger-run.sh`
4. Restart `tsinger.service`
5. Poll `/healthz` with origin secret header until healthy (90s timeout)

**Manual deploy with a specific tag:**

Go to Actions → "Deploy to EC2" → Run workflow → enter the image tag (e.g., an 8-char SHA from a previous Docker Publish run).

### Required GitHub Configuration

#### Secrets

| Name | Purpose | Example |
|------|---------|---------|
| `DOCKERHUB_USERNAME` | Docker Hub login username | `wleonhardt` |
| `DOCKERHUB_TOKEN` | Docker Hub access token | `dckr_pat_...` |
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for GitHub OIDC | `arn:aws:iam::123456789012:role/...` |
| `AWS_ORIGIN_SECRET` | Origin secret header value for health checks | `a1b2c3d4e5f6...` (hex, 16+ chars) |

#### Variables

| Name | Default | Purpose |
|------|---------|---------|
| `AWS_REGION` | `us-east-1` | AWS region for deployment |
| `ECR_REPO` | `tsinger` | ECR repository name |
| `INSTANCE_ID` | *(required)* | EC2 instance ID target |
| `SERVICE_NAME` | `tsinger` | Systemd service and script name |
| `DOCKERHUB_IMAGE` | `wleonhardt/tsinger` | Docker Hub image repository |
| `ORIGIN_SECRET_HEADER_NAME` | `x-tsinger-origin-secret` | Origin secret HTTP header name |
| `CF_STACK_NAME` | `TsingerStack` | CloudFormation stack name (for summaries) |
| `DOCKER_PLATFORM` | `linux/amd64` | Docker build platform |

#### Environment

The deploy workflow requires a GitHub environment named **`production`** configured on the repository. This enables environment protection rules (e.g., required reviewers) if desired.
