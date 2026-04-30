output "host" {
  value = digitalocean_database_cluster.main.host
}

output "port" {
  value = digitalocean_database_cluster.main.port
}

output "uri" {
  value     = digitalocean_database_cluster.main.uri
  sensitive = true
}

output "database_names" {
  value = [for db in digitalocean_database_db.service_dbs : db.name]
}
