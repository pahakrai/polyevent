# ============================================================
# Polydom production environment — AWS us-east-1
# ============================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — uncomment and configure before first apply
  # backend "s3" {
  #   bucket         = "polydom-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "polydom-terraform-lock"
  # }
}

provider "aws" {
  region = var.region
}

# ---- Foundation ----

module "networking" {
  source = "../../modules/networking"

  environment = "production"
  vpc_cidr    = "10.0.0.0/16"
}

module "security" {
  source = "../../modules/security"

  environment = "production"
  vpc_id      = module.networking.vpc_id
  root_domain = "polydom.io"
}

# ---- Data layer ----

module "rds" {
  source = "../../modules/rds"

  environment          = "production"
  private_subnet_ids   = module.networking.private_subnet_ids
  db_security_group_id = module.security.rds_security_group_id

  db_username = var.db_username
  db_password = var.db_password

  instance_class        = "db.t3.medium"
  allocated_storage     = 50
  max_allocated_storage = 200
  multi_az              = true
  backup_retention_days = 30
}

module "elasticache" {
  source = "../../modules/elasticache"

  environment            = "production"
  vpc_id                 = module.networking.vpc_id
  private_subnet_ids     = module.networking.private_subnet_ids
  eks_security_group_id  = module.security.eks_security_group_id

  node_type    = "cache.t3.small"
  cluster_size = 2
}

module "opensearch" {
  source = "../../modules/opensearch"

  environment = "production"
  vpc_id      = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  eks_security_group_id = module.security.eks_security_group_id

  instance_type  = "t3.small.search"
  instance_count = 3
  volume_size    = 50

  master_user     = var.opensearch_user
  master_password = var.opensearch_password
}

module "msk" {
  source = "../../modules/msk"

  environment           = "production"
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  eks_security_group_id = module.security.eks_security_group_id
  kms_key_arn           = module.security.kms_key_arn

  broker_instance_type = "kafka.t3.small"
  broker_count         = 3
  broker_volume_size   = 250
}

# ---- Compute ----

module "eks" {
  source = "../../modules/eks"

  environment        = "production"
  private_subnet_ids = module.networking.private_subnet_ids

  node_instance_types = ["t3.medium"]
  node_desired_count  = 4
  node_min_count      = 3
  node_max_count      = 10
}
