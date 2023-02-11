resource "aws_dynamodb_table" "DynamoDBTable" {
  name         = "pasteportal"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}
