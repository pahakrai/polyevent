# DO Managed PostgreSQL — one cluster with multiple databases (per-service pattern)
# DO managed databases are full clusters, so we create one cluster with
# multiple logical databases inside it using the digitalocean_database_db resource.

locals {
  databases = [
    "gateway_db",
    "auth_db",
    "user_db",
    "vendor_db",
    "event_db",
  ]
}

resource "digitalocean_database_cluster" "main" {
  name       = "polydom-${var.environment}-pg"
  engine     = "pg"
  version    = var.postgres_version
  size       = var.cluster_size
  region     = var.region
  node_count = var.node_count
  private_network_uuid = var.vpc_id

  tags = ["polydom", var.environment]
}

# Create one logical database per microservice inside the cluster
resource "digitalocean_database_db" "service_dbs" {
  for_each   = toset(local.databases)
  cluster_id = digitalocean_database_cluster.main.id
  name       = each.key
}

# Firewall — allow access from DOKS VPC
resource "digitalocean_database_firewall" "main" {
  cluster_id = digitalocean_database_cluster.main.id

  rule {
    type  = "ip_addr"
    value = var.vpc_ip_range
  }
}
