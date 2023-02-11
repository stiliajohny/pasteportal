resource "aws_acm_certificate" "pasteportal-api-cert" {
  domain_name       = "api.pasteportal.info"
  validation_method = "DNS"
}

resource "aws_route53_record" "pasteportal-api-cert-validation" {
  for_each = {
    for dvo in aws_acm_certificate.pasteportal-api-cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.pasteportal.zone_id
}

resource "aws_acm_certificate_validation" "pasteportal-api-cert" {
  certificate_arn         = aws_acm_certificate.pasteportal-api-cert.arn
  validation_record_fqdns = [for record in aws_route53_record.pasteportal-api-cert-validation : record.fqdn]
}


# SSL Certificate
resource "aws_acm_certificate" "ssl_certificate" {
  provider                  = aws.acm_provider
  domain_name               = "pasteportal.info"
  subject_alternative_names = ["*.pasteportal.info"]
  # validation_method         = "EMAIL"
  validation_method         = "DNS"


  lifecycle {
    create_before_destroy = true
  }
}

# Uncomment the validation_record_fqdns line if you do DNS validation instead of Email.
resource "aws_acm_certificate_validation" "cert_validation" {
  provider        = aws.acm_provider
  certificate_arn = aws_acm_certificate.ssl_certificate.arn
  #validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}