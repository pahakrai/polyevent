output "host" {
  value = digitalocean_database_cluster.redis.host
}

output "port" {
  value = digitalocean_database_cluster.redis.port
}

output "url" {
  value     = "redis://${digitalocean_database_cluster.redis.host}:${digitalocean_database_cluster.redis.port}"
  sensitive = true
}
