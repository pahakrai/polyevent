# ============================================================
# Polydom production — DigitalOcean ams3
# ============================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }

  # backend "s3" {
  #   endpoint                    = "ams3.digitaloceanspaces.com"
  #   bucket                      = "polydom-terraform-state"
  #   key                         = "production/terraform.tfstate"
  #   region                      = "us-east-1"             # Spaces uses us-east-1 for endpoint routing
  #   skip_credentials_validation = true
  #   skip_metadata_api_check     = true
  #   skip_region_validation      = true
  # }
}

provider "digitalocean" {
  # DO_TOKEN env var or set here via variable
}

module "networking" {
  source = "../../modules/networking"

  environment  = "production"
  region       = var.region
  vpc_ip_range = "10.0.0.0/20"
}

module "doks" {
  source = "../../modules/doks"

  environment = "production"
  region      = var.region
  vpc_id      = module.networking.vpc_id

  node_size  = "s-4vcpu-8gb"
  node_count = 4
  node_min   = 3
  node_max   = 10

  registry_tier = "professional"
}

module "database" {
  source = "../../modules/database"

  environment  = "production"
  region       = var.region
  vpc_id       = module.networking.vpc_id
  vpc_ip_range = module.networking.vpc_ip_range

  cluster_size = "db-s-2vcpu-4gb"
  node_count   = 2   # HA cluster
}

module "redis" {
  source = "../../modules/redis"

  environment  = "production"
  region       = var.region
  vpc_id       = module.networking.vpc_id
  vpc_ip_range = module.networking.vpc_ip_range

  cluster_size = "db-s-1vcpu-2gb"
  node_count   = 2
}

module "spaces" {
  source = "../../modules/spaces"

  environment = "production"
  region      = var.region
  cdn_domain  = "cdn.polydom.io"
}
