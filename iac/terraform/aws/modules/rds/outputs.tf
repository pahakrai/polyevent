output "endpoints" {
  value = {
    for i, db in aws_db_instance.main :
    db.db_name => db.endpoint
  }
}

output "connection_urls" {
  value = {
    for i, db in aws_db_instance.main :
    db.db_name => "postgresql://${var.db_username}:<password>@${db.endpoint}/${db.db_name}"
  }
  description = "Connection URLs (replace <password>)"
}
