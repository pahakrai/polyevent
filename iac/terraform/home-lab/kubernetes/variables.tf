variable "github_username" {
  description = "GitHub username for ghcr.io image pull"
  type        = string
  default     = "pahakrai"
}

variable "github_packages_token" {
  description = "GitHub PAT with read:packages scope for pulling images"
  type        = string
  sensitive   = true
}

variable "github_owner" {
  description = "GitHub owner/org"
  type        = string
  default     = "pahakrai"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "polydom"
}

variable "postgres_password" {
  description = "PostgreSQL password for production"
  type        = string
  sensitive   = true
  default     = "replace-me-production-password"
}

variable "jwt_secret" {
  description = "JWT signing secret for production"
  type        = string
  sensitive   = true
  default     = "replace-me-jwt-secret-at-least-32-chars"
}

variable "cloudflare_tunnel_token" {
  description = "Cloudflare Tunnel token for cloudflared pod"
  type        = string
  sensitive   = true
}

variable "llm_api_key" {
  description = "LLM API key for the agent service"
  type        = string
  sensitive   = true
  default     = ""
}
