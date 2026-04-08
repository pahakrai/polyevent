# Shared Libraries

## Overview
This directory contains shared libraries used across the event booking platform microservices. Libraries follow a monorepo pattern with NX workspace and TypeScript path mapping.

## Library Catalog

### 🟢 `shared-types` - Framework-agnostic
**Purpose**: TypeScript interfaces and domain models  
**Coupling**: None - pure TypeScript types  
**Usage**: Any TypeScript project  
**Status**: ✅ Implemented

### 🟡 `kafka-client` - NestJS-coupled  
**Purpose**: Kafka message production and consumption  
**Coupling**: Uses `@Injectable()` and `@nestjs/common`  
**Usage**: NestJS applications only  
**Status**: 🚧 Stub implementation

### 🟡 `database-client` - NestJS-coupled
**Purpose**: Database connections (PostgreSQL, MongoDB, Redis)  
**Coupling**: Uses `@Injectable()` and `@nestjs/common`  
**Usage**: NestJS applications only  
**Status**: 🚧 Stub implementation

### 🟡 `elasticsearch-client` - Mixed
**Purpose**: Elasticsearch client and query utilities  
**Coupling**: Client is NestJS-coupled, query builders are framework-agnostic  
**Usage**: NestJS for client, any TS for query builders  
**Status**: 🚧 Partial implementation

### 🟡 `utils` - Mixed
**Purpose**: Logging, validation, data transformation  
**Coupling**: Logger is NestJS-coupled, validators/transformers are framework-agnostic  
**Usage**: Mixed - depends on utility  
**Status**: ✅ Partial implementation

## Framework Coupling Strategy

### Current Approach
Most libraries are **NestJS-coupled** (`@Injectable()` decorator, `@nestjs/common` imports) because:
1. All consumers in this monorepo are NestJS applications
2. Dependency injection provides clean integration
3. Development velocity outweighs framework lock-in concerns

### When to Use Framework-Agnostic
1. **Domain models** (`shared-types`) - Always framework-agnostic
2. **Pure utilities** (validators, transformers) - Prefer framework-agnostic
3. **Potential open-source** - Consider framework-agnostic with adapters

### Future Considerations
If needed outside NestJS:
1. **Adapter pattern**: Framework-agnostic core + NestJS adapter
2. **Interface segregation**: Define contracts, multiple implementations
3. **Dependency injection abstraction**: Accept dependencies via constructor

## Development Commands

```bash
# Build all libraries
nx run-many --target=build --projects=shared-types,kafka-client,database-client,elasticsearch-client,utils

# Build specific library
nx build shared-types

# Test all libraries  
nx run-many --target=test --projects=shared-types,kafka-client,database-client,elasticsearch-client,utils
```

## Adding a New Library

1. **Determine coupling**: Will it be used outside NestJS?
2. **Choose pattern**: 
   - NestJS-coupled for infrastructure clients
   - Framework-agnostic for business logic
   - Mixed with clear separation
3. **Follow conventions**:
   - Export from `src/index.ts`
   - Use TypeScript path aliases
   - Include README with coupling documentation

## Versioning & Dependencies
- Libraries share version with monorepo (single version)
- Peer dependencies for framework-specific imports
- Framework-agnostic libraries have minimal dependencies
- All dependencies managed at root `package.json`