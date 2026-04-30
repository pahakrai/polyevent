# MSK (Managed Kafka) — event streaming between microservices

resource "aws_security_group" "msk" {
  name        = "polydom-${var.environment}-msk"
  description = "Kafka access from EKS"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 9094
    to_port         = 9094
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
    description     = "Kafka SASL/SCRAM from EKS"
  }

  ingress {
    from_port       = 2181
    to_port         = 2181
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
    description     = "Zookeeper from EKS"
  }

  tags = {
    Name        = "polydom-${var.environment}-msk"
    Environment = var.environment
  }
}

resource "aws_msk_cluster" "main" {
  cluster_name           = "polydom-${var.environment}"
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.broker_count

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.private_subnet_ids
    security_groups = [aws_security_group.msk.id]

    storage_info {
      ebs_storage_info {
        volume_size = var.broker_volume_size
      }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
    encryption_at_rest_kms_key_arn = var.kms_key_arn
  }

  client_authentication {
    sasl {
      scram = true
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.main.arn
    revision = aws_msk_configuration.main.latest_revision
  }

  tags = {
    Name        = "polydom-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_msk_configuration" "main" {
  name        = "polydom-${var.environment}"
  kafka_versions = [var.kafka_version]

  server_properties = <<PROPERTIES
auto.create.topics.enable = false
default.replication.factor = ${var.broker_count >= 3 ? 3 : var.broker_count}
min.insync.replicas = ${var.broker_count >= 3 ? 2 : 1}
num.partitions = 6
log.retention.hours = 168
PROPERTIES
}
