# Security groups, IAM roles, KMS — shared security resources

# KMS key for envelope encryption (secrets, RDS, MSK, S3)
resource "aws_kms_key" "main" {
  description             = "Polydom ${var.environment} encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "polydom-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_kms_alias" "main" {
  name          = "alias/polydom-${var.environment}"
  target_key_id = aws_kms_key.main.key_id
}

# Security group for EKS cluster shared by all nodes
resource "aws_security_group" "eks_cluster" {
  name        = "polydom-${var.environment}-eks-cluster"
  description = "EKS cluster communication"
  vpc_id      = var.vpc_id

  ingress {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
    self      = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "polydom-${var.environment}-eks-cluster"
    Environment = var.environment
  }
}

# SG for RDS — allows Postgres from EKS nodes
resource "aws_security_group" "rds" {
  name        = "polydom-${var.environment}-rds"
  description = "RDS access from EKS nodes"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
    description     = "PostgreSQL from EKS"
  }

  tags = {
    Name        = "polydom-${var.environment}-rds"
    Environment = var.environment
  }
}

# ECR repositories for Docker images (one per service)
resource "aws_ecr_repository" "services" {
  for_each = toset(var.service_names)

  name                 = "polydom/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.main.arn
  }

  tags = {
    Name        = "polydom-${each.key}"
    Environment = var.environment
  }
}

# S3 bucket for backups, assets, static files
resource "aws_s3_bucket" "assets" {
  bucket = "polydom-${var.environment}-assets"

  tags = {
    Name        = "polydom-${var.environment}-assets"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.main.key_id
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ACM certificate for ingress TLS
resource "aws_acm_certificate" "main" {
  domain_name               = var.root_domain
  subject_alternative_names = ["*.${var.root_domain}"]
  validation_method         = "DNS"

  tags = {
    Name        = "polydom-${var.environment}"
    Environment = var.environment
  }
}

# Route53 zone (if managing DNS through Terraform)
resource "aws_route53_zone" "main" {
  name = var.root_domain

  tags = {
    Name        = "polydom-${var.environment}"
    Environment = var.environment
  }
}
