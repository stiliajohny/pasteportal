
# cant import
resource "aws_route53_zone" "pasteportal" {
  name = "pasteportal.info."
}

resource "aws_route53_record" "github_pages_servers" {
  name = "pasteportal.info."
  type = "A"
  ttl  = 60
  records = [
    "185.199.111.153",
    "185.199.110.153",
    "185.199.109.153",
    "185.199.108.153"
  ]
  zone_id = aws_route53_zone.pasteportal.zone_id
}

resource "aws_route53_record" "github_pages_challenge" {
  name = "_github-pages-challenge-stiliajohny"
  type = "TXT"
  ttl  = 60
  records = [
    "4f558aa0d4ef01dfd2488d8f5fb149"
  ]
  zone_id = aws_route53_zone.pasteportal.zone_id
}

resource "aws_route53_record" "github_pages_challenge" {
  name = "_github-pages-challenge-stiliajohny"
  type = "TXT"
  ttl  = 60
  records = [
    "4f558aa0d4ef01dfd2488d8f5fb149"
  ]
  zone_id = aws_route53_zone.pasteportal.zone_id
}

resource "aws_route53_record" "visual-studio-marketplace_challenge" {
  name = "_visual-studio-marketplace-johnstilia.pasteportal.info"
  type = "TXT"
  ttl  = 60
  records = [
    "42f88f42-a0f6-465f-842e-26857d8fb106"
  ]
  zone_id = aws_route53_zone.pasteportal.zone_id
}
