# DO Managed Redis — equivalent to AWS ElastiCache

resource "digitalocean_database_cluster" "redis" {
  name       = "polydom-${var.environment}-redis"
  engine     = "redis"
  version    = var.redis_version
  size       = var.cluster_size
  region     = var.region
  node_count = var.node_count
  private_network_uuid = var.vpc_id

  tags = ["polydom", var.environment]
}

resource "digitalocean_database_firewall" "redis" {
  cluster_id = digitalocean_database_cluster.redis.id

  rule {
    type  = "ip_addr"
    value = var.vpc_ip_range
  }
}
