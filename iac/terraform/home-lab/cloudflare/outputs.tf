output "tunnel_id" {
  description = "Cloudflare Tunnel ID"
  value       = cloudflare_tunnel.main.id
}

output "tunnel_cname" {
  description = "Cloudflare Tunnel CNAME target"
  value       = "${cloudflare_tunnel.main.id}.cfargotunnel.com"
}

output "tunnel_token" {
  description = "Cloudflare Tunnel token for cloudflared authentication"
  value       = cloudflare_tunnel.main.tunnel_token
  sensitive   = true
}
