#!/usr/bin/env bash
# Deploy an ECK Elasticsearch cluster.
#
# Storage class per cloud:
#   DO:  do-block-storage
#   AWS: gp3
#   GCP: standard-rwo
#
# Usage:
#   STORAGE_CLASS=do-block-storage ./tools/scripts/create-es-cluster.sh

set -euo pipefail

STORAGE_CLASS="${STORAGE_CLASS:-standard}"
NAMESPACE="${NAMESPACE:-production}"

echo "==> Creating Elasticsearch cluster (storage: $STORAGE_CLASS, namespace: $NAMESPACE)..."

cat <<EOF | kubectl apply -f -
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: polydom-es
  namespace: $NAMESPACE
spec:
  version: 8.11.0
  nodeSets:
    - name: default
      count: 3
      config:
        node.store.allow_mmap: false
      volumeClaimTemplates:
        - metadata:
            name: elasticsearch-data
          spec:
            accessModes:
              - ReadWriteOnce
            resources:
              requests:
                storage: 50Gi
            storageClassName: $STORAGE_CLASS
      podTemplate:
        spec:
          containers:
            - name: elasticsearch
              resources:
                requests:
                  memory: "2Gi"
                  cpu: "1000m"
                limits:
                  memory: "4Gi"
                  cpu: "2000m"
EOF

echo "==> Elasticsearch cluster created. Waiting for readiness..."
kubectl wait elasticsearch/polydom-es --for=condition=Ready --timeout=600s -n "$NAMESPACE"
echo "==> Elasticsearch cluster ready."
