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

variable "kubernetes_version" {
  type    = string
  default = "1.31"
}

variable "node_size" {
  type    = string
  default = "s-2vcpu-4gb"
}

variable "node_count" {
  type    = number
  default = 2
}

variable "auto_scale" {
  type    = bool
  default = true
}

variable "node_min" {
  type    = number
  default = 1
}

variable "node_max" {
  type    = number
  default = 5
}

variable "registry_tier" {
  type    = string
  default = "basic"
}
