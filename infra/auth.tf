# Cognito user pool: sign-up/sign-in handled by AWS. API Gateway verifies its tokens.

resource "aws_cognito_user_pool" "users" {
  name                     = var.project
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

# Public client for the browser app (no client secret).
resource "aws_cognito_user_pool_client" "web" {
  name                          = "${var.project}-web"
  user_pool_id                  = aws_cognito_user_pool.users.id
  generate_secret               = false
  explicit_auth_flows           = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors = "ENABLED"
}
