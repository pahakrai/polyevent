variable "environment" {
  type = string
}

variable "region" {
  type    = string
  default = "ams3"
}

variable "vpc_id" {
  type = string
}

variable "vpc_ip_range" {
  type = string
}

variable "postgres_version" {
  type    = string
  default = "16"
}

variable "cluster_size" {
  type    = string
  default = "db-s-1vcpu-1gb"
}

variable "node_count" {
  description = "1 = single node, 2+ = HA cluster"
  type        = number
  default     = 1
}
