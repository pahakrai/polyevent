output "doks_endpoint" {
  value     = module.doks.cluster_endpoint
  sensitive = true
}

output "postgres_host" {
  value     = module.database.host
  sensitive = true
}

output "redis_url" {
  value     = module.redis.url
  sensitive = true
}

output "container_registry" {
  value = module.doks.registry_url
}
