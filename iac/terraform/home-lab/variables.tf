# ── Cloudflare ───────────────────────────────────────────────────────

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone.DNS + Tunnel edit permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for pahakrai.xyz"
  type        = string
}

variable "domain" {
  description = "Primary domain for the application"
  type        = string
  default     = "polydom.pahakrai.xyz"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID (found in dashboard URL)"
  type        = string
}

# ── Kubernetes ────────────────────────────────────────────────────────

variable "kube_config_path" {
  description = "Path to Minikube kubeconfig"
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "Kubeconfig context name for Minikube"
  type        = string
  default     = "minikube"
}

variable "github_packages_token" {
  description = "GitHub PAT with read:packages scope for pulling images from ghcr.io"
  type        = string
  sensitive   = true
}

variable "postgres_password" {
  description = "PostgreSQL password for production"
  type        = string
  sensitive   = true
  default     = "replace-me-production-password"
}

variable "jwt_secret" {
  description = "JWT signing secret (min 32 chars)"
  type        = string
  sensitive   = true
  default     = "replace-me-jwt-secret-at-least-32-chars"
}

variable "llm_api_key" {
  description = "LLM API key (DeepSeek or Anthropic)"
  type        = string
  sensitive   = true
  default     = ""
}

# ── GitHub ────────────────────────────────────────────────────────────

variable "github_token" {
  description = "GitHub personal access token (repo + workflow scope)"
  type        = string
  sensitive   = true
}

variable "github_owner" {
  description = "GitHub username or org that owns the repo"
  type        = string
  default     = "pahakrai"
}

variable "github_repo" {
  description = "Repository name"
  type        = string
  default     = "polydom"
}

# ── General ───────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}
