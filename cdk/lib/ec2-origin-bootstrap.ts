import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface Ec2OriginBootstrapProps {
  readonly awsRegion: string;
  readonly imageIdentifier: string;
  readonly originSecret: string;
  readonly originSecretHeaderName: string;
  readonly logGroupName: string;
  readonly registryUri: string;
  readonly containerPort: number;
  readonly originPort: number;
  readonly containerName: string;
  readonly serviceName: string;
}

export function buildEc2OriginUserData(props: Ec2OriginBootstrapProps): ec2.UserData {
  const userData = ec2.UserData.forLinux();
  const runScriptPath = `/usr/local/bin/${props.serviceName}-run.sh`;
  const serviceUnitName = `${props.serviceName}.service`;

  userData.addCommands(
    "set -euxo pipefail",
    "dnf install -y docker nginx awscli",
    "systemctl enable --now docker",
    "systemctl enable --now amazon-ssm-agent || true",
    "rm -f /etc/nginx/conf.d/default.conf",
    `cat <<'EOF' >/etc/nginx/conf.d/${props.serviceName}.conf`,
    "map_hash_bucket_size 128;",
    "",
    `map $http_${props.originSecretHeaderName.replace(/-/g, "_")} $origin_secret_valid {`,
    "  default 0;",
    `  "${props.originSecret}" 1;`,
    "}",
    "",
    "server {",
    `  listen ${props.originPort} default_server;`,
    `  listen [::]:${props.originPort} default_server;`,
    "  server_name _;",
    "",
    "  if ($origin_secret_valid = 0) {",
    "    return 403;",
    "  }",
    "",
    "  location / {",
    `    proxy_pass http://127.0.0.1:${props.containerPort};`,
    "    proxy_http_version 1.1;",
    "    proxy_set_header Host $host;",
    "    proxy_set_header X-Real-IP $remote_addr;",
    "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    "    proxy_set_header X-Forwarded-Proto https;",
    "    proxy_set_header X-Forwarded-Host $host;",
    "    proxy_read_timeout 60s;",
    "    proxy_send_timeout 60s;",
    "  }",
    "}",
    "EOF",
    "nginx -t",
    `cat <<'EOF' >${runScriptPath}`,
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `AWS_REGION="${props.awsRegion}"`,
    `REGISTRY_URI="${props.registryUri}"`,
    `IMAGE_IDENTIFIER="${props.imageIdentifier}"`,
    `CONTAINER_NAME="${props.containerName}"`,
    `LOG_GROUP_NAME="${props.logGroupName}"`,
    "",
    'aws ecr get-login-password --region "$AWS_REGION" | \\',
    '  docker login --username AWS --password-stdin "$REGISTRY_URI"',
    "",
    'TOKEN="$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" || true)"',
    'if [ -n "$TOKEN" ]; then',
    '  INSTANCE_ID="$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id || hostname)"',
    "else",
    '  INSTANCE_ID="$(hostname)"',
    "fi",
    'LOG_STREAM_NAME="${CONTAINER_NAME}-${INSTANCE_ID}"',
    "",
    'docker pull "$IMAGE_IDENTIFIER"',
    'docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true',
    "",
    "exec docker run \\",
    "  --rm \\",
    '  --name "$CONTAINER_NAME" \\',
    `  --publish 127.0.0.1:${props.containerPort}:${props.containerPort} \\`,
    "  --log-driver awslogs \\",
    '  --log-opt awslogs-region="$AWS_REGION" \\',
    '  --log-opt awslogs-group="$LOG_GROUP_NAME" \\',
    '  --log-opt awslogs-stream="$LOG_STREAM_NAME" \\',
    "  --log-opt awslogs-create-group=false \\",
    '  "$IMAGE_IDENTIFIER"',
    "EOF",
    `chmod 755 ${runScriptPath}`,
    `cat <<'EOF' >/etc/systemd/system/${serviceUnitName}`,
    "[Unit]",
    `Description=${props.serviceName} Docker container`,
    "After=docker.service network-online.target",
    "Wants=docker.service network-online.target",
    "StartLimitIntervalSec=0",
    "",
    "[Service]",
    "Type=simple",
    "Restart=always",
    "RestartSec=15",
    "TimeoutStartSec=0",
    "TimeoutStopSec=30",
    `ExecStart=${runScriptPath}`,
    `ExecStop=-/usr/bin/docker stop ${props.containerName}`,
    "",
    "[Install]",
    "WantedBy=multi-user.target",
    "EOF",
    "systemctl daemon-reload",
    "systemctl enable --now nginx",
    `systemctl enable --now ${serviceUnitName}`
  );

  return userData;
}
