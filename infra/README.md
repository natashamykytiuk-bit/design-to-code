# Infrastructure

Terraform for the AWS deployment. The design keeps idle cost near zero:

| Piece | Service | Idle cost |
|---|---|---|
| API (Express) | Lambda + API Gateway HTTP API | Pay per request (free tier) |
| Database | DynamoDB, 5 read / 5 write capacity units | $0 (inside the always-free allowance) |
| Auth | Cognito user pool, JWT checked by API Gateway | Free at small user counts |
| Frontend | S3 + CloudFront | Cents |
| Image uploads | Separate S3 bucket, pre-signed POST from the API, served at `/uploads/*` on CloudFront | ~2¢ per GB stored |

There is no VPC, NAT Gateway or load balancer, so nothing bills while idle.

## Local development

```sh
docker compose up --build   # DynamoDB Local + API on http://localhost:3000
```

Sign-in is replaced by a dev user locally. Send `x-dev-user: <name>` to act as
a different user.

## Deploy

Needs the AWS CLI signed in and Terraform 1.6+.

```sh
cd backend && npm ci && npm run build && cd ..   # bundles backend/dist/index.mjs
cd infra && terraform init && terraform apply
```

Then upload the frontend:

```sh
npm run build
aws s3 sync dist/ s3://$(terraform -chdir=infra output -raw site_bucket) --delete
aws cloudfront create-invalidation --distribution-id $(terraform -chdir=infra output -raw cloudfront_distribution_id) --paths "/*"
```

## Tear down

```sh
cd infra && terraform destroy
```

This deletes the table **and every saved design**.

## Known trade-offs

- Each design is one DynamoDB item, capped at 400 KB; the API rejects bodies over 350 KB
  and designs containing `data:` URLs. Images go through `POST /uploads` instead
  (PNG, JPEG, WebP or GIF, up to 5 MB), and the design stores only the URL.
- Uploads are off in local dev (no S3); `POST /uploads` returns 501 there.
- Deleting a design does not delete its uploaded images.
- 5 capacity units handle roughly 5 saves and 10 loads per second, plenty for a demo.
  Raising them past 25 total leaves the free allowance.
- State is local. For a team, move it to an S3 backend.
- At higher traffic, the Docker image in `backend/` can run on ECS Fargate.
