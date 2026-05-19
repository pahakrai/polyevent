# Kubernetes bootstrap for home-lab
#
# Creates the production namespace, image pull secret for ghcr.io,
# and installs ArgoCD. Application workloads are managed by ArgoCD,
# NOT by Terraform (separation of concerns: Terraform = infra, ArgoCD = apps).

resource "kubernetes_namespace" "production" {
  metadata {
    name = "polydom-production"
    labels = {
      environment = "production"
      managed-by  = "terraform"
    }
  }
}

resource "kubernetes_namespace" "argocd" {
  metadata {
    name = "argocd"
    labels = {
      managed-by = "terraform"
    }
  }
}
