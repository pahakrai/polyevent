# DigitalOcean Terraform IaC — Polydom
#
# Key differences from the AWS variant:
#   - DOKS instead of EKS
#   - DO Managed Database instead of RDS
#   - DO Managed Redis instead of ElastiCache
#   - DO Spaces instead of S3
#   - DO Container Registry instead of ECR
#   - No managed Kafka / OpenSearch → run Strimzi + ECK on DOKS
#   - cert-manager on DOKS instead of ACM
#
# Provider: digitalocean/digitalocean
