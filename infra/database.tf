# DynamoDB table for designs. Provisioned at 5 read / 5 write capacity units,
# inside the always-free allowance (25 of each, plus 25 GB of storage), so it
# costs nothing whether it is used or idle.

resource "aws_dynamodb_table" "designs" {
  name           = "${var.project}-designs"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5

  hash_key  = "ownerId"
  range_key = "id"

  attribute {
    name = "ownerId"
    type = "S"
  }

  attribute {
    name = "id"
    type = "S"
  }

  point_in_time_recovery {
    # Costs extra; off for a portfolio project.
    enabled = false
  }
}
