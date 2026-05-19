# Image pull secret for ghcr.io
#
# Authenticates Minikube to pull private images from ghcr.io.
# Even for public repos, this avoids Docker Hub rate limits.
#
# Create the token at: https://github.com/settings/tokens
# Scope: read:packages (minimum) or repo (full)

resource "kubernetes_secret_v1" "ghcr_pull" {
  metadata {
    name      = "ghcr-image-pull"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "ghcr.io" = {
          username = var.github_username
          password = var.github_packages_token
          auth = base64encode("${var.github_username}:${var.github_packages_token}")
        }
      }
    })
  }
}

# Database secrets — these will be used by services at runtime.
# In production, consider SealedSecrets or External Secrets Operator instead.

resource "kubernetes_secret_v1" "db_credentials" {
  metadata {
    name      = "db-credentials"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  data = {
    postgres-user     = "eventbooking"
    postgres-password = var.postgres_password
    postgres-host     = "postgres.polydom-prod.svc.cluster.local"
    postgres-port     = "5432"

    # Per-service database URLs
    gateway-database-url      = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/gateway_db"
    auth-database-url         = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/auth_db"
    user-database-url         = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/user_db"
    vendor-database-url       = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/vendor_db"
    event-database-url        = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/event_db"
    booking-database-url      = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/booking_db"
    agent-database-url        = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/agent_db"
    search-database-url       = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/vector_db"
    vector-database-url       = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/vector_db"
    notification-database-url = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/notification_db"
    analytics-database-url    = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/analytics_db"
    admin-database-url        = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/admin_db"

    # Shared infra
    redis-url           = "redis://redis:6379"
    elasticsearch-url     = "http://elasticsearch:9200"
    source-database-url  = "postgresql://eventbooking:${var.postgres_password}@postgres.polydom-prod.svc.cluster.local:5432/eventbooking"
  }
}

resource "kubernetes_secret_v1" "jwt" {
  metadata {
    name      = "jwt-secret"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  data = {
    jwt-secret = var.jwt_secret
  }
}

# Cloudflare Tunnel token — used by the cloudflared pod
resource "kubernetes_secret_v1" "cloudflared_token" {
  metadata {
    name      = "cloudflared-tunnel-token"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  data = {
    "tunnel-token" = var.cloudflare_tunnel_token
  }
}

# LLM API keys — used by the agent service
resource "kubernetes_secret_v1" "llm" {
  metadata {
    name      = "llm-secrets"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  data = {
    api-key         = var.llm_api_key
    deepseek-api-key = var.llm_api_key
  }
}
