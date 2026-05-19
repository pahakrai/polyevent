# Home-Lab Production Infrastructure
#
# Manages: Cloudflare Tunnel + DNS, K8s namespace + secrets + ArgoCD, GitHub CI secrets
# App deployments are managed by ArgoCD (watching kubernetes/home-lab/), NOT Terraform.

module "cloudflare" {
  source = "./cloudflare"

  zone_id        = var.cloudflare_zone_id
  account_id     = var.cloudflare_account_id
  domain         = var.domain
}

module "kubernetes" {
  source = "./kubernetes"

  github_owner           = var.github_owner
  github_repo            = var.github_repo
  github_username        = var.github_owner
  github_packages_token  = var.github_packages_token
  postgres_password      = var.postgres_password
  jwt_secret             = var.jwt_secret
  llm_api_key            = var.llm_api_key
  cloudflare_tunnel_token = module.cloudflare.tunnel_token

  depends_on = [module.cloudflare]
}

module "github" {
  source = "./github"

  github_owner = var.github_owner
  github_repo  = var.github_repo
}
