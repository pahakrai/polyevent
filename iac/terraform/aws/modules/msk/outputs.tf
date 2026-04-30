output "bootstrap_brokers" {
  value = aws_msk_cluster.main.bootstrap_brokers_sasl_scram
}

output "zookeeper_connect" {
  value = aws_msk_cluster.main.zookeeper_connect_string
}
