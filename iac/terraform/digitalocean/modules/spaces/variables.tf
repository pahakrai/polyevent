variable "environment" {
  type = string
}

variable "region" {
  type    = string
  default = "ams3"
}

variable "cdn_domain" {
  description = "Custom domain for Spaces CDN (optional)"
  type        = string
  default     = ""
}

variable "certificate_id" {
  description = "DO certificate ID for CDN custom domain (optional)"
  type        = string
  default     = ""
}
