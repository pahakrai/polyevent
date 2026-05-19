# Home-Lab Deployment — Polydom

Self-hosted production deployment on Minikube behind a Cloudflare Tunnel, using ArgoCD for GitOps.

## Architecture

```
Internet → Cloudflare Tunnel → cloudflared pod → api-gateway:3000
                                                      ├── auth-service:3000
                                                      ├── user-service:3000
                                                      ├── vendor-service:3000
                                                      ├── event-service:3000
                                                      ├── agent-service:3010
                                                      ├── search-service:3000
                                                      ├── inference:8000 (FastAPI)
                                                      └── frontend:3005 / admin-frontend:3004

Infrastructure (all in polydom-prod namespace):
  PostgreSQL 16 + pgvector  |  Redis 7  |  NATS 2.10

CI/CD (GitHub Actions):
  push to main → detect affected services (NX) → build + push to ghcr.io
  → update image tags in kustomization.yaml → ArgoCD syncs cluster

Terraform bootstraps:  Cloudflare Tunnel, K8s secrets, ArgoCD, GitHub secrets
ArgoCD manages:         All application workloads (infra + services + frontends + workers)
```

## Prerequisites

- **Minikube** running with RBAC: `minikube start --cpus=4 --memory=8192 --addons=rbac`
- **kubectl** pointing to Minikube: `kubectl config current-context` → `minikube`
- **Terraform** ≥ 1.7
- **Cloudflare** account with a domain (Zone ID and Account ID)
- **GitHub** personal access tokens (see below)

### Required CLIs

```bash
# Windows (winget)
winget install TerraformCloudflare.cloudflared
winget install Helm.Helm

# macOS
brew install cloudflared helm terraform

# ArgoCD CLI (optional, for debugging)
choco install argocd-cli       # Windows
brew install argocd             # macOS
```

## Step 1 — Set up Terraform variables

```bash
cd iac/terraform/home-lab
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

| Variable | Source |
|----------|--------|
| `cloudflare_api_token` | Cloudflare Dashboard → My Profile → API Tokens → Create Token → "Create Additional Tokens" |
| `cloudflare_zone_id` | Cloudflare Dashboard → your domain → Overview (right sidebar, "Zone ID") |
| `cloudflare_account_id` | Same page as Zone ID |
| `domain` | Your domain, e.g. `polydom.yourdomain.xyz` |
| `github_packages_token` | GitHub → Settings → Developer settings → Personal access tokens (classic) → `read:packages`, `write:packages`, `delete:packages` |
| `github_token` | GitHub PAT → `repo` scope (needed for Terraform to manage GitHub Actions secrets) |
| `postgres_password` | Generate: `openssl rand -base64 32` |
| `jwt_secret` | Generate: `openssl rand -base64 32` |
| `llm_api_key` | Your LLM provider key (DeepSeek or Anthropic) |
| `github_owner` | Your GitHub username (default: `pahakrai`) |
| `github_repo` | Repository name (default: `polydom`) |

## Step 2 — Terraform apply (bootstrap infrastructure)

```bash
cd iac/terraform/home-lab

terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

What this creates:

| Module | Resources |
|--------|-----------|
| **cloudflare** | Tunnel, tunnel config (ingress rules), DNS CNAME records (`polydom.xyz` + wildcard) |
| **kubernetes** | Namespaces (`polydom-prod`, `argocd`), all K8s secrets, ArgoCD core install, ArgoCD Application CRD |
| **github** | GitHub Actions secrets (`REGISTRY`, `REGISTRY_USER`) |

## Step 3 — Set GitHub REGISTRY_TOKEN manually

Terraform cannot manage this PAT (chicken-and-egg problem). Set it in the GitHub UI:

1. Go to `https://github.com/<owner>/<repo>/settings/secrets/actions`
2. **New repository secret** → Name: `REGISTRY_TOKEN` → Value: your `github_packages_token` PAT

## Step 4 — Push to main (trigger CI + ArgoCD)

```bash
cd /path/to/polydom   # repository root

git add -A
git commit -m "production Dockerfiles and home-lab configs"
git push origin main
```

GitHub Actions (`deploy.yaml`) runs automatically on push to main:

1. **detect-changes** — `yarn nx show projects --affected` identifies which services changed
2. **test** — lint + unit tests
3. **build-and-push** — builds Docker images (target `production`) per affected service, pushes to `ghcr.io`
4. **update-manifests** — runs `kustomize edit set image` to update image tags in `kubernetes/home-lab/kustomization.yaml`, commits back to `main`

ArgoCD watches `kubernetes/home-lab/` on `main`. When the image tag commit lands, it syncs the cluster automatically.

## Step 5 — Verify

```bash
# Check ArgoCD sync status
kubectl get applications -n argocd polydom

# All pods should be Running or healthy
kubectl get pods -n polydom-prod

# Check cloudflared tunnel connected
kubectl logs -n polydom-prod -l app=cloudflared

# Test API externally
curl https://polydom.yourdomain.xyz/health
```

## ArgoCD CLI (optional, easier debugging)

```bash
# Port-forward the API server
kubectl port-forward -n argocd svc/argocd-server 8080:443

# Login (default admin password)
argocd login localhost:8080 --insecure

# View app status
argocd app get polydom

# Manual sync if needed
argocd app sync polydom
```

## Day-to-day workflow

After initial setup, the full GitOps loop is:

```
git push main → CI builds affected → pushes to ghcr.io → updates kustomization.yaml
→ ArgoCD detects commit → syncs cluster
```

No manual `kubectl apply` or `terraform apply` needed for application changes. Terraform is only re-run when changing infrastructure config (secrets, tunnel, ArgoCD settings).

## Debugging

```bash
# Pod not starting?
kubectl describe pod -n polydom-prod <pod-name>
kubectl logs -n polydom-prod <pod-name>

# Image pull error? Check the secret
kubectl get secret ghcr-image-pull -n polydom-prod -o jsonpath="{.data.\.dockerconfigjson}" | base64 -d

# ArgoCD not syncing?
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller
kubectl get events -n polydom-prod --sort-by=.metadata.creationTimestamp

# Cloudflare tunnel not connecting?
kubectl logs -n polydom-prod -l app=cloudflared
```
