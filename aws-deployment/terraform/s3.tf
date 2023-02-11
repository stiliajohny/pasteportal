# S3 bucket for website.
resource "aws_s3_bucket" "www_bucket" {
  bucket = "www.pasteportal.info"
  acl    = "public-read"
  policy = templatefile("templates/s3-policy.json", { bucket = "www.pasteportal.info" })

  cors_rule {
    allowed_headers = ["Authorization", "Content-Length"]
    allowed_methods = ["GET", "POST"]
    allowed_origins = ["https://www.pasteportal.info"]
    max_age_seconds = 3000
  }

  website {
    index_document = "index.html"
    error_document = "404.html"
  }

  tags = var.common_tags
}

# S3 bucket for redirecting non-www to www.
resource "aws_s3_bucket" "root_bucket" {
  bucket = var.bucket_name
  acl    = "public-read"
  policy = templatefile("templates/s3-policy.json", { bucket = var.bucket_name })

  website {
    redirect_all_requests_to = "https://www.pasteportal.info"
  }

}