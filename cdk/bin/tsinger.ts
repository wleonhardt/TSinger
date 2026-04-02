#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TsingerStack } from "../lib/tsinger-stack";

const app = new cdk.App();

const ecrRepoName = app.node.tryGetContext("ecrRepoName") ?? "tsinger";
const serviceName = app.node.tryGetContext("serviceName") ?? "tsinger";
const createRepository = app.node.tryGetContext("createRepository") === "true";
const retainLogBucket = app.node.tryGetContext("retainLogBucket") === "true";
const enableBasicAuth = app.node.tryGetContext("enableBasicAuth") !== "false";
const instanceType = (app.node.tryGetContext("instanceType") as string | undefined) ?? "t3.micro";

const imageTag = app.node.tryGetContext("imageTag") as string | undefined;
const imageDigest = app.node.tryGetContext("imageDigest") as string | undefined;
const alarmTopicArn = app.node.tryGetContext("alarmTopicArn") as string | undefined;
const domainName = app.node.tryGetContext("domainName") as string | undefined;
const certificateArn = app.node.tryGetContext("certificateArn") as string | undefined;

if ((domainName && !certificateArn) || (!domainName && certificateArn)) {
  throw new Error("Provide domainName and certificateArn together, or omit both.");
}

new TsingerStack(app, "TsingerStack", {
  ecrRepoName,
  serviceName,
  createRepository,
  retainLogBucket,
  enableBasicAuth,
  imageTag,
  imageDigest,
  alarmTopicArn,
  instanceType,
  domainName,
  certificateArn,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
