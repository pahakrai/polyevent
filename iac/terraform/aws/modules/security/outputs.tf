output "kms_key_arn" {
  value = aws_kms_key.main.arn
}

output "eks_security_group_id" {
  value = aws_security_group.eks_cluster.id
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}

output "ecr_repository_urls" {
  value = { for name, repo in aws_ecr_repository.services : name => repo.repository_url }
}

output "certificate_arn" {
  value = aws_acm_certificate.main.arn
}

output "route53_zone_id" {
  value = aws_route53_zone.main.zone_id
}
