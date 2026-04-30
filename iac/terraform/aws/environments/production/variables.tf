variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "opensearch_user" {
  description = "OpenSearch master username"
  type        = string
  sensitive   = true
}

variable "opensearch_password" {
  description = "OpenSearch master password"
  type        = string
  sensitive   = true
}
