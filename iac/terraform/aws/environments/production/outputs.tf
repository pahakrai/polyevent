output "vpc_id" {
  value = module.networking.vpc_id
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "rds_endpoints" {
  value     = module.rds.endpoints
  sensitive = true
}

output "elasticache_url" {
  value     = module.elasticache.url
  sensitive = true
}

output "opensearch_url" {
  value     = module.opensearch.url
  sensitive = true
}

output "msk_bootstrap_brokers" {
  value     = module.msk.bootstrap_brokers
  sensitive = true
}

output "ecr_repositories" {
  value = module.security.ecr_repository_urls
}

output "certificate_arn" {
  value = module.security.certificate_arn
}
