data "aws_api_gateway_rest_api" "pasteportal-rest-listener" {
  name = "pasteportal-rest-listener"
}

# Get the arn of the lambda post function
data "aws_lambda_function" "pasteportal-post" {
  function_name = "PasteportalRestListenerApiPOST"
}

data "aws_lambda_function" "pasteportal-get" {
  function_name = "PasteportalRestListenerApiGET"
}