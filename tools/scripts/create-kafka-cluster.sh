#!/usr/bin/env bash
# Deploy a Strimzi Kafka cluster.
#
# Storage class per cloud:
#   DO:  do-block-storage
#   AWS: gp3
#   GCP: standard-rwo
#
# Usage:
#   STORAGE_CLASS=do-block-storage ./tools/scripts/create-kafka-cluster.sh

set -euo pipefail

STORAGE_CLASS="${STORAGE_CLASS:-standard}"
NAMESPACE="${NAMESPACE:-production}"

echo "==> Creating Kafka cluster (storage: $STORAGE_CLASS, namespace: $NAMESPACE)..."

cat <<EOF | kubectl apply -f -
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: polydom-kafka
  namespace: $NAMESPACE
spec:
  kafka:
    version: 3.6.0
    replicas: 3
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
      - name: tls
        port: 9093
        type: internal
        tls: true
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
      default.replication.factor: 3
      min.insync.replicas: 2
    storage:
      type: jbod
      volumes:
        - id: 0
          type: persistent-claim
          size: 50Gi
          class: $STORAGE_CLASS
          deleteClaim: false
    resources:
      requests:
        memory: "2Gi"
        cpu: "1000m"
      limits:
        memory: "4Gi"
        cpu: "2000m"
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 20Gi
      class: $STORAGE_CLASS
      deleteClaim: false
    resources:
      requests:
        memory: "1Gi"
        cpu: "500m"
      limits:
        memory: "2Gi"
        cpu: "1000m"
  entityOperator:
    topicOperator: {}
    userOperator: {}
EOF

echo "==> Kafka cluster created. Waiting for readiness..."
kubectl wait kafka/polydom-kafka --for=condition=Ready --timeout=600s -n "$NAMESPACE"
echo "==> Kafka cluster ready."
