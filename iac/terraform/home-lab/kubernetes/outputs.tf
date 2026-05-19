output "production_namespace" {
  description = "Production namespace name"
  value       = kubernetes_namespace.production.metadata[0].name
}

output "argocd_namespace" {
  description = "ArgoCD namespace name"
  value       = kubernetes_namespace.argocd.metadata[0].name
}
