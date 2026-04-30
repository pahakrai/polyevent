# DOKS — managed Kubernetes, equivalent to AWS EKS

resource "digitalocean_kubernetes_cluster" "main" {
  name    = "polydom-${var.environment}"
  region  = var.region
  version = var.kubernetes_version
  vpc_uuid = var.vpc_id

  node_pool {
    name       = "polydom-${var.environment}-pool"
    size       = var.node_size
    node_count = var.node_count
    auto_scale = var.auto_scale
    min_nodes  = var.auto_scale ? var.node_min : null
    max_nodes  = var.auto_scale ? var.node_max : null

    labels = {
      environment = var.environment
    }
  }
}

# Container registry — equivalent to AWS ECR
resource "digitalocean_container_registry" "main" {
  name                   = "polydom-${var.environment}"
  subscription_tier_slug = var.registry_tier
}
