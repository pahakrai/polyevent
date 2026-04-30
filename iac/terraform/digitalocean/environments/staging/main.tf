# ============================================================
# Polydom staging — DigitalOcean ams3
# ============================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {}

module "networking" {
  source = "../../modules/networking"

  environment = "staging"
  region      = var.region
}

module "doks" {
  source = "../../modules/doks"

  environment = "staging"
  region      = var.region
  vpc_id      = module.networking.vpc_id

  node_size  = "s-2vcpu-4gb"
  node_count = 2
  node_min   = 1
  node_max   = 4
}

module "database" {
  source = "../../modules/database"

  environment  = "staging"
  region       = var.region
  vpc_id       = module.networking.vpc_id
  vpc_ip_range = module.networking.vpc_ip_range

  cluster_size = "db-s-1vcpu-1gb"
  node_count   = 1
}

module "redis" {
  source = "../../modules/redis"

  environment  = "staging"
  region       = var.region
  vpc_id       = module.networking.vpc_id
  vpc_ip_range = module.networking.vpc_ip_range
}

module "spaces" {
  source = "../../modules/spaces"

  environment = "staging"
  region      = var.region
}
