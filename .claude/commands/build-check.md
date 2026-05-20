# /build-check

Run a comprehensive build health audit to catch issues that would break Docker or Skaffold before they happen. Invoke this when a new service/library is created, dependencies change, or before pushing.

## Audit Checklist

### 1. Library `package.json` — `main`/`types` fields

For every `libs/*/package.json`, verify:
- `main` points to an **existing file**. If `"main": "./dist/index.js"`, then `libs/<name>/dist/index.js` must exist (or a build target must generate it).
- `types` points to an **existing file**. If `"types": "./dist/index.d.ts"`, the declaration must exist.

Run this check:
```
for lib in libs/*/; do
  name=$(basename "$lib")
  main=$(node -e "try { console.log(require('./$lib/package.json').main) } catch(e) {}")
  types=$(node -e "try { console.log(require('./$lib/package.json').types) } catch(e) {}")
  if [ -n "$main" ] && [ ! -f "$lib/$main" ]; then
    echo "BROKEN: @polydom/$name — main \"$main\" does not exist"
  fi
  if [ -n "$types" ] && [ ! -f "$lib/$types" ]; then
    echo "BROKEN: @polydom/$name — types \"$types\" does not exist"
  fi
done
```

If a library's `main` points to `./src/index.ts` (raw TS), it has no build target and will force every consuming service to recompile it via webpack. This is a perf issue, not a breakage, but it should be flagged.

### 2. Library `tsconfig.lib.json` — compilation overrides

Root `tsconfig.base.json` sets `noEmit: true`, `moduleResolution: "bundler"`, `allowImportingTsExtensions: true` — all incompatible with `tsc` compilation to CommonJS.

Every `libs/*/tsconfig.lib.json` must override these. Verify each has:
```json
{
  "compilerOptions": {
    "noEmit": false,
    "moduleResolution": "node",
    "allowImportingTsExtensions": false
  }
}
```

Read all `libs/*/tsconfig.lib.json` files and check for these three keys. Also verify they have `"declaration": true` so `.d.ts` files are generated.

### 3. Library `project.json` — build target

Every `libs/*/` directory must have a `project.json` with a `build` target. Check:
```
for lib in libs/*/; do
  if [ ! -f "$lib/project.json" ]; then
    echo "MISSING: $(basename "$lib") has no project.json"
  elif ! node -e "const p = require('./$lib/project.json'); if (!p.targets?.build) process.exit(1)"; then
    echo "MISSING: $(basename "$lib") has no build target"
  fi
done
```

### 4. `tsc` compilation — build all libraries

Run the actual TypeScript compiler on each library to catch errors that raw TS imports previously hid:
```
npx nx run-many --target=build --projects=<all-libs>
```

Common errors to expect (all found in the 2026-05-11 audit):
- **TS5095**: `moduleResolution: "bundler"` leaking from base tsconfig (fix: override in tsconfig.lib.json)
- **TS4111**: Property access on index signature (fix: use bracket notation `env['VAR']`)
- **TS4114**: Missing `override` modifier on methods that override base class members
- **TS6133**: Unused imports/variables (fix: remove unused imports)
- **TS6138**: Property declared but never read (fix: remove unused properties or prefix with `_` if config-injected)

### 5. Service build — verify with webpack

Pick one service that depends on shared libraries and build it to verify the NX dependency chain:
```
npx nx build <service> --skip-nx-cache
```

Verify:
- Dependency libs built first (NX outputs "Running target build for project <service> and N tasks it depends on")
- Service webpack compiles successfully (no module resolution errors for `@polydom/*` packages)
- No "Cannot find project" errors

### 6. `tsconfig.build.json` — no excessive `rootDir`

For each `apps/nestjs-services/*/tsconfig.build.json`, check that `rootDir` is NOT set to `"../../.."`. This value causes `tsc` (non-webpack) to emit to `dist/apps/nestjs-services/<name>/src/main.js` instead of `dist/main.js`.

The fix is to remove `rootDir` entirely — with `include: ["src/**/*"]`, TypeScript infers the correct root.

### 7. New service checklist (when a service is added)

When a new NestJS service is generated, verify:
- `apps/nestjs-services/<name>/project.json` exists with `build`, `serve`, `lint`, `test` targets
- Build command uses `nest build --webpack` (NOT plain `nest build`)
- `Dockerfile` exposes the correct port and references the service name in CMD
- `kubernetes/local/services.yaml` has the Deployment and Service entries
- `skaffold.yaml` includes the service in the build/deploy/portForward sections
- The service's `package.json` declares all runtime dependencies (not relying on workspace hoisting)

### 8. Dependency verification

When new packages are added to a library or service:
- Libraries: the dependency must be in `libs/<name>/package.json` (not just hoisted from root)
- Check that the dependency is actually importable: `node -e "require('<package>')"` from the lib/service directory
- For `@polydom/*` inter-library dependencies: verify the consumed library has a build target and its `main` field resolves

## Common Root Causes (reference)

From the 2026-05-11 audit:
| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Readiness probe "connection refused" | `nest build` without `--webpack` + `rootDir: "../../.."` → entry file not found | Use `nest build --webpack` in project.json |
| Module not found `@polydom/x/y` | Import path missing `src/` segment (raw TS lib) | Either add `src/` to import OR pre-compile the lib |
| Skaffold build hangs/slow | Webpack recompiles 4 raw-TS libraries from scratch every service build | Add build targets + pre-compile libs to `dist/` |
| `require('@polydom/x')` crash at runtime | `main` points to `./dist/index.js` but dist/ doesn't exist | Either pre-compile or change `main` to `./src/index.ts` temporarily |

## Verification Commands

```bash
# Build all libraries (should all pass)
npx nx run-many --target=build --projects=shared-types,elasticsearch-client,utils,auth,nats-client,database-client

# Build a service (should pull libs from cache)
npx nx build api-gateway

# Full build (everything)
npx nx run-many --target=build --all

# Check cache (second run should show "existing outputs match the cache")
npx nx build api-gateway
```
