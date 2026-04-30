# Terraform IaC — Polydom

Reference infrastructure-as-code, organized by cloud provider.
No binaries installed — these are template files for reference.

## Structure

```
iac/terraform/
├── aws/                         AWS (us-east-1)
│   ├── modules/
│   │   ├── networking/          VPC, subnets, NAT, IGW
│   │   ├── eks/                 EKS cluster + managed node group
│   │   ├── rds/                 PostgreSQL per microservice (5 instances)
│   │   ├── elasticache/         Redis replication group
│   │   ├── opensearch/          Managed search
│   │   ├── msk/                 Managed Kafka (SASL/SCRAM)
│   │   └── security/            KMS, SGs, ECR, S3, ACM, Route53
│   └── environments/
│       ├── production/          Multi-AZ, 3+ nodes, full HA
│       └── staging/             Single-AZ, lighter resources
│
└── digitalocean/                DigitalOcean (ams3)
    ├── modules/
    │   ├── networking/          DO VPC
    │   ├── doks/                DOKS cluster + Container Registry
    │   ├── database/            DO Managed PostgreSQL (1 cluster, 5 DBs)
    │   ├── redis/               DO Managed Redis
    │   └── spaces/              DO Spaces (S3) + CDN
    └── environments/
        ├── production/          HA database, 4+ nodes
        └── staging/             Single node, minimal sizing
```

## Usage (reference only)

```bash
# After installing Terraform and configuring credentials:

# AWS
cd iac/terraform/aws/environments/production
cp terraform.tfvars.example terraform.tfvars   # fill in real values
terraform init
terraform plan
terraform apply

# DigitalOcean
cd iac/terraform/digitalocean/environments/production
export DIGITALOCEAN_TOKEN=...
terraform init
terraform plan
terraform apply
```
