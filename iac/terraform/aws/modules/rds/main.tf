# RDS PostgreSQL — one instance per microservice (database-per-service pattern)

locals {
  databases = [
    "gateway_db",
    "auth_db",
    "user_db",
    "vendor_db",
    "event_db",
  ]
}

resource "aws_db_subnet_group" "main" {
  name       = "polydom-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "polydom-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_db_instance" "main" {
  count = length(local.databases)

  identifier = "polydom-${var.environment}-${local.databases[count.index]}"

  engine         = "postgres"
  engine_version = var.postgres_version
  instance_class = var.instance_class

  db_name  = local.databases[count.index]
  username = var.db_username
  password = var.db_password

  db_subnet_group_name = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.db_security_group_id]

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_encrypted     = true
  storage_type          = "gp3"

  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  multi_az               = var.multi_az
  skip_final_snapshot    = false
  final_snapshot_identifier = "polydom-${var.environment}-${local.databases[count.index]}-final"
  deletion_protection    = var.environment == "production" ? true : false

  tags = {
    Name        = "polydom-${var.environment}-${local.databases[count.index]}"
    Environment = var.environment
  }
}
