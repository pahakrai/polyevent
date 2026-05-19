# ArgoCD installation in Minikube
#
# Installs ArgoCD from its upstream manifests and creates
# an Application CRD that watches kubernetes/home-lab/ in the repo.
# Sync policy: automated — every push to main triggers a sync.

resource "kubernetes_manifest" "argocd_core_install" {
  manifest = yamldecode(data.http.argocd_install_yaml.body)

  depends_on = [kubernetes_namespace.argocd]
}

data "http" "argocd_install_yaml" {
  url = "https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/core-install.yaml"
}

# ArgoCD Application — watches kubernetes/home-lab/ in the polydom repo
resource "kubernetes_manifest" "polydom_app" {
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = "polydom"
      namespace = kubernetes_namespace.argocd.metadata[0].name
    }
    spec = {
      project = "default"
      source = {
        repoURL        = "https://github.com/${var.github_owner}/${var.github_repo}.git"
        targetRevision = "main"
        path           = "kubernetes/home-lab"
      }
      destination = {
        server    = "https://kubernetes.default.svc"
        namespace = kubernetes_namespace.production.metadata[0].name
      }
      syncPolicy = {
        automated = {
          prune    = true
          selfHeal = true
        }
        syncOptions = ["CreateNamespace=true"]
      }
    }
  }

  depends_on = [kubernetes_manifest.argocd_core_install]
}
