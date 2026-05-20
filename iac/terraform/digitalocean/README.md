# DigitalOcean Terraform IaC — Polydom
#
# Key differences from the AWS variant:
#   - DOKS instead of EKS
#   - DO Managed Database instead of RDS
#   - DO Managed Redis instead of ElastiCache
#   - DO Spaces instead of S3
#   - DO Container Registry instead of ECR
#   - No managed OpenSearch → run ECK on DOKS. Redpanda deployed via Kubernetes.
#   - cert-manager on DOKS instead of ACM
#
# Provider: digitalocean/digitalocean
