# GitHub Actions secrets for CI/CD
#
# These secrets are used by .github/workflows/deploy.yaml
# REGISTRY and REGISTRY_USER are set here; REGISTRY_TOKEN is set manually
# since Terraform managing PATs creates a chicken-and-egg problem at initial setup.

resource "github_actions_secret" "registry" {
  repository      = var.github_repo
  secret_name     = "REGISTRY"
  plaintext_value = "ghcr.io"
}

resource "github_actions_secret" "registry_user" {
  repository      = var.github_repo
  secret_name     = "REGISTRY_USER"
  plaintext_value = var.github_owner
}
