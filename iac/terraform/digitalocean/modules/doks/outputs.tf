output "cluster_id" {
  value = digitalocean_kubernetes_cluster.main.id
}

output "cluster_endpoint" {
  value = digitalocean_kubernetes_cluster.main.endpoint
}

output "registry_url" {
  value = digitalocean_container_registry.main.server_url
}
