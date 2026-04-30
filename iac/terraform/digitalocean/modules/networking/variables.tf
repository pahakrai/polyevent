variable "environment" {
  type = string
}

variable "region" {
  type    = string
  default = "ams3"
}

variable "vpc_ip_range" {
  type    = string
  default = "10.0.0.0/20"
}
