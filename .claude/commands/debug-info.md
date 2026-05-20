# /debug-info

## NestJS services (Node.js — V8 inspector protocol)

Three layers make it work:

```
SOURCE   Local .ts  ──skaffold sync──►  Container /app/
BUILD    nx serve --configuration=debug → webpack build → node --inspect=0.0.0.0:<port>
ATTACH   VS Code attach to localhost:<port> → inspector protocol → container
```

### Flow

1. **Source sync**: Skaffold syncs local `.ts` files to `/app/` in the container on save
2. **Build**: `nx serve <service> --configuration=debug` runs inside the container:
   - `nest build --webpack` compiles with sourcemaps
   - `node --inspect=0.0.0.0:<port>` starts the V8 debug server
3. **Port-forward tunnel**: Skaffold reads `portForward` in `skaffold.yaml`, opens a TCP tunnel from `localhost:<port>` directly to the pod's debug port
4. **Attach**: VS Code `launch.json` "Attach to X (Docker)" connects to `localhost:<port>` via Node inspector protocol

### Why 0.0.0.0

Without `0.0.0.0`, Node defaults to `127.0.0.1` — only reachable inside the container. `host: "0.0.0.0"` in `project.json` debug config lets external traffic (port-forward, K8s services) reach the inspector.

### Debug ports

| Service       | Port |
|---------------|------|
| api-gateway   | 9229 |
| auth-service  | 9230 |
| user-service  | 9231 |
| vendor-service| 9232 |
| event-service | 9233 |
| agent-service | 9234 |
| search-service| 9235 |

### Commands

- `npm run skaffold:dev:debug` — start with port-forwarding for debug
- VS Code: F5 → pick "Attach to <Service> (Docker)"

### Key distinction

- **Port-forward** = the tunnel (connectivity)
- **--inspect** = the debug server behind the tunnel (breakpoints, stepping, inspection)
- **Sync** = hot reload (not required for debugging, just developer speed)

---

## Python workers (debugpy protocol)

Python debugging uses `debugpy` instead of Node's V8 inspector. The pattern is:

```
SOURCE   Local .py  ──docker volume mount──►  Container /app/
BUILD    python -m debugpy --listen 0.0.0.0:<port> --wait-for-client <entrypoint>
ATTACH   VS Code "Python: Remote Attach" → localhost:<port> → debugpy protocol → container
```

### Flow

1. **Source mount**: Docker Compose volume mounts `apps/python-workers/` to `/app/` for live edits (no Skaffold sync needed)
2. **Start with debugpy**: Replace the container command with:
   ```
   python -m debugpy --listen 0.0.0.0:<port> --wait-for-client -m <module>
   ```
   - `--listen 0.0.0.0:<port>` — bind to all interfaces (same reasoning as Node 0.0.0.0)
   - `--wait-for-client` — pause execution until VS Code attaches (remove to start immediately)
3. **Attach**: VS Code `launch.json` with `"type": "python"`, `"request": "attach"`, `"connect": { "host": "localhost", "port": <port> }`
4. **Path mapping**: Map `/app/` (container) → `${workspaceFolder}/apps/python-workers/` (local)

### Debug ports

| Service          | Port | Entry Point                                |
|------------------|------|--------------------------------------------|
| inference        | 9235 | `uvicorn inference.api:app`                |
| ml-training      | 9236 | `python -m ml-training.data_pipeline`      |
| event-consumers  | 9237 | `python -m kafka-consumers.user_activity`  |

### Commands

```bash
# Docker Compose with debugpy (override entrypoint in docker-compose.yml or use separate profile)
docker compose run --rm -p 9235:9235 inference \
  python -m debugpy --listen 0.0.0.0:9235 --wait-for-client \
  -m uvicorn inference.api:app --host 0.0.0.0 --port 8000

# VS Code: F5 → pick "Python: Attach to Inference" / "Attach to ML Training" / "Attach to Event Consumer"
```

### VS Code launch.json entries

```json
{
  "name": "Python: Attach to Inference",
  "type": "python",
  "request": "attach",
  "connect": { "host": "localhost", "port": 9235 },
  "pathMappings": [
    { "localRoot": "${workspaceFolder}/apps/python-workers", "remoteRoot": "/app" }
  ]
},
{
  "name": "Python: Attach to ML Training",
  "type": "python",
  "request": "attach",
  "connect": { "host": "localhost", "port": 9236 },
  "pathMappings": [
    { "localRoot": "${workspaceFolder}/apps/python-workers", "remoteRoot": "/app" }
  ]
},
{
  "name": "Python: Attach to Event Consumer",
  "type": "python",
  "request": "attach",
  "connect": { "host": "localhost", "port": 9237 },
  "pathMappings": [
    { "localRoot": "${workspaceFolder}/apps/python-workers", "remoteRoot": "/app" }
  ]
}
```

### Key differences from NestJS debugging

- **No Skaffold**: Python workers are excluded from `skaffold.yaml`. Use Docker Compose for local dev with volume mounts.
- **No NX build step**: Python is interpreted — just mount the source and restart.
- **debugpy instead of --inspect**: `pip install debugpy` is required. It's not in `requirements.txt` — add it for dev.
- **Single Dockerfile, three entrypoints**: All three services share the same image. Override `command:` in docker-compose or K8s.
- **No K8s debug config**: The Kubernetes manifests under `kubernetes/python-workers/` have no debug ports or probes. For K8s debugging, add a debug container port and port-forward manually.
