# ============================================================
# Polydom staging environment — mirrors production with less capacity
# ============================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # backend "s3" {
  #   bucket         = "polydom-terraform-state"
  #   key            = "staging/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "polydom-terraform-lock"
  # }
}

provider "aws" {
  region = var.region
}

module "networking" {
  source = "../../modules/networking"

  environment = "staging"
  vpc_cidr    = "10.1.0.0/16"
}

module "security" {
  source = "../../modules/security"

  environment = "staging"
  vpc_id      = module.networking.vpc_id
  root_domain = "staging.polydom.io"
}

module "rds" {
  source = "../../modules/rds"

  environment          = "staging"
  private_subnet_ids   = module.networking.private_subnet_ids
  db_security_group_id = module.security.rds_security_group_id

  db_username = var.db_username
  db_password = var.db_password

  instance_class        = "db.t3.small"
  allocated_storage     = 20
  max_allocated_storage = 50
  multi_az              = false
}

module "elasticache" {
  source = "../../modules/elasticache"

  environment           = "staging"
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  eks_security_group_id = module.security.eks_security_group_id
}

module "opensearch" {
  source = "../../modules/opensearch"

  environment           = "staging"
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  eks_security_group_id = module.security.eks_security_group_id

  master_user     = var.opensearch_user
  master_password = var.opensearch_password
}

module "msk" {
  source = "../../modules/msk"

  environment           = "staging"
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  eks_security_group_id = module.security.eks_security_group_id
  kms_key_arn           = module.security.kms_key_arn

  broker_count         = 1
  broker_instance_type = "kafka.t3.small"
  broker_volume_size   = 100
}

module "eks" {
  source = "../../modules/eks"

  environment        = "staging"
  private_subnet_ids = module.networking.private_subnet_ids

  node_desired_count = 2
  node_min_count     = 1
  node_max_count     = 4
}
