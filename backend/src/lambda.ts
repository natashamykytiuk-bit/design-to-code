// AWS Lambda entry point: the same Express app, wrapped for API Gateway.
// The table and uploads bucket are created by Terraform.
import serverlessExpress from "@codegenie/serverless-express";
import { createApp } from "./app.js";
import { dynamoConfigFromEnv, dynamoRepo } from "./dynamoRepo.js";
import { uploaderFromEnv } from "./uploads.js";

export const handler = serverlessExpress({
	app: createApp(dynamoRepo(dynamoConfigFromEnv()), "apigateway", uploaderFromEnv()),
});
