resource "aws_api_gateway_usage_plan" "pasteportal-usage-plan" {
  name        = "pasteportal-usage-plan"
  description = "Usage plan for pasteportal api gateway"

  api_stages {
    api_id = data.aws_api_gateway_rest_api.pasteportal-rest-listener.id
    stage  = "Stage"
  }

  api_stages {
    api_id = data.aws_api_gateway_rest_api.pasteportal-rest-listener.id
    stage  = "Prod"
  }

  quota_settings {
    limit  = 100
    offset = 0
    period = "DAY"
  }

  throttle_settings {
    burst_limit = 5
    rate_limit  = 1
  }
}

resource "aws_api_gateway_api_key" "pasteportal-api-key" {
  name = "pasteportal-api-key"
  value = "qVP1XsKWJF2vud7zo1jzS6BQ22xy4xXH4DY634py"

}

resource "aws_api_gateway_usage_plan_key" "main" {
  key_id        = aws_api_gateway_api_key.pasteportal-api-key.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.pasteportal-usage-plan.id
}


#  API GW Custom Domain Name
resource "aws_api_gateway_domain_name" "pasteportal-api-domain" {
  certificate_arn = aws_acm_certificate_validation.pasteportal-api-cert.certificate_arn
  domain_name     = "api.pasteportal.info"
}

# Example DNS record using Route53.
# Route53 is not specifically required; any DNS host can be used.
resource "aws_route53_record" "pasteportal-api-domain" {
  name    = aws_api_gateway_domain_name.pasteportal-api-domain.domain_name
  type    = "A"
  zone_id = aws_route53_zone.pasteportal.id
  alias {
    evaluate_target_health = true
    name                   = aws_api_gateway_domain_name.pasteportal-api-domain.cloudfront_domain_name
    zone_id                = aws_api_gateway_domain_name.pasteportal-api-domain.cloudfront_zone_id
  }
}


resource "aws_api_gateway_base_path_mapping" "pasteportal-api-base-path" {
  api_id      = data.aws_api_gateway_rest_api.pasteportal-rest-listener.id
  domain_name = aws_api_gateway_domain_name.pasteportal-api-domain.domain_name
  stage_name  = "Prod"
}