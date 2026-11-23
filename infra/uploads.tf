# User-uploaded images. A separate private bucket (so deploying the frontend with
# `s3 sync --delete` can never wipe them), served through the site's CloudFront
# distribution under /uploads/*.

resource "aws_s3_bucket" "uploads" {
  bucket_prefix = "${var.project}-uploads-"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Browsers upload directly to S3 with a pre-signed POST, so S3 must accept
# cross-origin POSTs from the app.
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_methods = ["POST"]
    allowed_origins = local.app_origins
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}

# Clear out uploads that never completed.
resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    id     = "abort-incomplete"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.uploads.arn}/uploads/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site.arn } }
    }]
  })
}

# The API Lambda may only sign uploads into uploads/.
resource "aws_iam_role_policy" "api_uploads" {
  name = "uploads-bucket"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "s3:PutObject"
      Resource = "${aws_s3_bucket.uploads.arn}/uploads/*"
    }]
  })
}
