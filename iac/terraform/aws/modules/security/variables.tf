variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "root_domain" {
  description = "Root domain name (e.g. polydom.io)"
  type        = string
}

variable "service_names" {
  description = "Microservice image names for ECR repos"
  type        = list(string)
  default = [
    "api-gateway",
    "auth-service",
    "user-service",
    "vendor-service",
    "event-service",
    "frontend",
  ]
}
