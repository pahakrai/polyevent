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

variable "kms_key_arn" {
  description = "KMS key ARN for encryption at rest"
  type        = string
  default     = ""
}

variable "kafka_version" {
  description = "MSK Kafka version"
  type        = string
  default     = "3.7.0"
}

variable "broker_count" {
  description = "Number of broker nodes (min 1 per AZ, recommended 3)"
  type        = number
  default     = 3
}

variable "broker_instance_type" {
  description = "MSK broker instance type"
  type        = string
  default     = "kafka.t3.small"
}

variable "broker_volume_size" {
  description = "EBS volume size in GB per broker"
  type        = number
  default     = 100
}
