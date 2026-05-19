# Cloudflare Tunnel + DNS for home-lab production
#
# Creates a Cloudflare Tunnel and DNS CNAME records that route
# polydom.pahakrai.xyz traffic through the tunnel to the
# cloudflared pod running inside the Minikube cluster.

locals {
  tunnel_name = "polydom-tunnel"
}

resource "cloudflare_tunnel" "main" {
  account_id = var.account_id
  name       = local.tunnel_name
  secret     = base64encode(random_password.tunnel_secret.result)
}

resource "random_password" "tunnel_secret" {
  length  = 32
  special = false
}

# The tunnel token is what the cloudflared pod uses to authenticate.
# Format: <tunnel-id> + base64-encoded secret
resource "random_password" "tunnel_token" {
  length  = 64
  special = false
}

# ── Tunnel configuration — ingress rules ──────────────────────────────

resource "cloudflare_tunnel_config" "main" {
  account_id = var.account_id
  tunnel_id  = cloudflare_tunnel.main.id

  config {
    ingress_rule {
      hostname = var.domain
      service  = "http://api-gateway.polydom-prod.svc.cluster.local:3000"
    }

    ingress_rule {
      hostname = "*.${var.domain}"
      service  = "http://api-gateway.polydom-prod.svc.cluster.local:3000"
    }

    # Catch-all — drop everything else
    ingress_rule {
      service = "http_status:404"
    }
  }
}

# ── DNS — CNAME record pointing to the tunnel ────────────────────────

resource "cloudflare_record" "root" {
  zone_id = var.zone_id
  name    = var.domain
  type    = "CNAME"
  content = "${cloudflare_tunnel.main.id}.cfargotunnel.com"
  proxied = true # must be proxied for tunnel to work
  ttl     = 1    # auto-ttl when proxied
}

resource "cloudflare_record" "wildcard" {
  zone_id = var.zone_id
  name    = "*.${var.domain}"
  type    = "CNAME"
  content = "${cloudflare_tunnel.main.id}.cfargotunnel.com"
  proxied = true
  ttl     = 1
}
