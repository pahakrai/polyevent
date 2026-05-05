# /debug-info

## How debugging works in this project

Three layers make it work:

```
SOURCE   Local .ts  ──skaffold sync──►  Container /app/
BUILD    nx serve --configuration=debug → webpack build → node --inspect=0.0.0.0:<port>
ATTACH   VS Code attach to localhost:<port> → inspector protocol → container
```

## Flow

1. **Source sync**: Skaffold syncs local `.ts` files to `/app/` in the container on save
2. **Build**: `nx serve <service> --configuration=debug` runs inside the container:
   - `nest build --webpack` compiles with sourcemaps
   - `node --inspect=0.0.0.0:<port>` starts the V8 debug server
3. **Port-forward tunnel**: Skaffold reads `portForward` in `skaffold.yaml`, opens a TCP tunnel from `localhost:<port>` directly to the pod's debug port
4. **Attach**: VS Code `launch.json` "Attach to X (Docker)" connects to `localhost:<port>` via Node inspector protocol

## Why 0.0.0.0

Without `0.0.0.0`, Node defaults to `127.0.0.1` — only reachable inside the container. `host: "0.0.0.0"` in `project.json` debug config lets external traffic (port-forward, K8s services) reach the inspector.

## Port-forwarding

Skaffold creates a TCP tunnel: `localhost:<port> → pod:<port>`. Without it, your local machine has no route to the pod's network. The `--port-forward` flag enables this; the mappings are defined in `skaffold.yaml` under `portForward`.

## Debug ports

| Service       | Port |
|---------------|------|
| api-gateway   | 9229 |
| auth-service  | 9230 |
| user-service  | 9231 |
| vendor-service| 9232 |
| event-service | 9233 |
| agent-service | 9234 |

## Commands

- `npm run skaffold:dev:debug` — start with port-forwarding for debug
- VS Code: F5 → pick "Attach to <Service> (Docker)"

## Key distinction

- **Port-forward** = the tunnel (connectivity)
- **--inspect** = the debug server behind the tunnel (breakpoints, stepping, inspection)
- **Sync** = hot reload (not required for debugging, just developer speed)
