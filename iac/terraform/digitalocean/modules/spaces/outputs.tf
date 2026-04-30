output "bucket_name" {
  value = digitalocean_spaces_bucket.assets.name
}

output "bucket_endpoint" {
  value = digitalocean_spaces_bucket.assets.bucket_domain_name
}

output "cdn_endpoint" {
  value = digitalocean_cdn.assets.endpoint
}
