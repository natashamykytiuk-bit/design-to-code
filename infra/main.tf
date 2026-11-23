terraform {
  required_version = ">= 1.6"
  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 5.70" }
    archive = { source = "hashicorp/archive", version = "~> 2.6" }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = var.project }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "design-to-code"
}

variable "extra_cors_origins" {
  description = "Origins besides the CloudFront site allowed to call the API (e.g. the Vite dev server)."
  type        = list(string)
  default     = ["http://localhost:5173"]
}

locals {
  # Browser origins allowed to call the API and upload to S3.
  app_origins = concat(["https://${aws_cloudfront_distribution.site.domain_name}"], var.extra_cors_origins)
}
