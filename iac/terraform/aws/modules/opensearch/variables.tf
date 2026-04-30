variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs"
  type        = list(string)
}

variable "eks_security_group_id" {
  description = "EKS node security group ID"
  type        = string
}

variable "engine_version" {
  description = "OpenSearch engine version"
  type        = string
  default     = "2.15"
}

variable "instance_type" {
  description = "OpenSearch instance type"
  type        = string
  default     = "t3.small.search"
}

variable "instance_count" {
  description = "Number of data nodes"
  type        = number
  default     = 1
}

variable "volume_size" {
  description = "EBS volume size in GB per node"
  type        = number
  default     = 20
}

variable "master_user" {
  description = "OpenSearch master username"
  type        = string
  sensitive   = true
}

variable "master_password" {
  description = "OpenSearch master password"
  type        = string
  sensitive   = true
}
