# DO Spaces — S3-compatible object storage for assets, backups

resource "digitalocean_spaces_bucket" "assets" {
  name   = "polydom-${var.environment}-assets"
  region = var.region
  acl    = "private"
}

# CDN for Spaces (optional, for serving static assets)
resource "digitalocean_cdn" "assets" {
  origin         = digitalocean_spaces_bucket.assets.bucket_domain_name
  ttl            = 3600
  custom_domain  = var.cdn_domain != "" ? var.cdn_domain : null
  certificate_id = var.certificate_id != "" ? var.certificate_id : null
}
