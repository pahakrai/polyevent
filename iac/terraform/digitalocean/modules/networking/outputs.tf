output "vpc_id" {
  value = digitalocean_vpc.main.id
}

output "vpc_ip_range" {
  value = digitalocean_vpc.main.ip_range
}
