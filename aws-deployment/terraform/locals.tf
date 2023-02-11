# create the prefix for all names usoing locals

resource "random_id" "bucket" {
  byte_length = 16
}


locals {
  prefix = "pasteportal-${random_id.bucket.hex}"
}