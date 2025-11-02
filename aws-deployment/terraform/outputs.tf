# output the default nameservers
output "nameservers" {
  value = aws_route53_zone.pasteportal.name_servers
}
