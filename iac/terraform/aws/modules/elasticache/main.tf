# ElastiCache Redis — session store, rate limiting, caching

resource "aws_elasticache_subnet_group" "main" {
  name       = "polydom-${var.environment}-redis"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "redis" {
  name        = "polydom-${var.environment}-redis"
  description = "Redis access from EKS nodes"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
    description     = "Redis from EKS"
  }

  tags = {
    Name        = "polydom-${var.environment}-redis"
    Environment = var.environment
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "polydom-${var.environment}-redis"
  description          = "Redis for polydom ${var.environment}"

  engine         = "redis"
  engine_version = var.redis_version
  node_type      = var.node_type

  num_cache_clusters = var.cluster_size
  port               = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  automatic_failover_enabled = var.cluster_size > 1
  multi_az_enabled           = var.cluster_size > 1

  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true

  tags = {
    Name        = "polydom-${var.environment}-redis"
    Environment = var.environment
  }
}
