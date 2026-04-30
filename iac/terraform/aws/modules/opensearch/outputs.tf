output "endpoint" {
  value = aws_opensearch_domain.main.endpoint
}

output "url" {
  value = "https://${aws_opensearch_domain.main.endpoint}"
}
