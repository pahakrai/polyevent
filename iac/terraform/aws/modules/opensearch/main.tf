# OpenSearch — full-text search for events

resource "aws_security_group" "opensearch" {
  name        = "polydom-${var.environment}-opensearch"
  description = "OpenSearch access from EKS"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
    description     = "OpenSearch from EKS"
  }

  tags = {
    Name        = "polydom-${var.environment}-opensearch"
    Environment = var.environment
  }
}

resource "aws_opensearch_domain" "main" {
  domain_name    = "polydom-${var.environment}"
  engine_version = var.engine_version

  cluster_config {
    instance_type          = var.instance_type
    instance_count         = var.instance_count
    dedicated_master_enabled = var.instance_count > 2
    dedicated_master_type  = var.instance_count > 2 ? "t3.small.search" : null
    dedicated_master_count = var.instance_count > 2 ? 3 : null
    zone_awareness_enabled = var.instance_count > 1

    zone_awareness_config {
      availability_zone_count = var.instance_count > 1 ? min(var.instance_count, 3) : null
    }
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = var.volume_size
  }

  vpc_options {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.opensearch.id]
  }

  encrypt_at_rest {
    enabled = true
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  advanced_security_options {
    enabled                        = true
    internal_user_database_enabled = true
    master_user_options {
      master_user_name     = var.master_user
      master_user_password = var.master_password
    }
  }

  tags = {
    Name        = "polydom-${var.environment}"
    Environment = var.environment
  }
}
