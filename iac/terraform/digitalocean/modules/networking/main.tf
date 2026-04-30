# DO VPC — simpler than AWS: no IGW/NAT/subnets, just a private network

resource "digitalocean_vpc" "main" {
  name     = "polydom-${var.environment}"
  region   = var.region
  ip_range = var.vpc_ip_range
}
