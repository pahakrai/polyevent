"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PostgresClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresClient = exports.POSTGRES_CLIENT_CONFIG = void 0;
const common_1 = require("@nestjs/common");
exports.POSTGRES_CLIENT_CONFIG = 'POSTGRES_CLIENT_CONFIG';
let PostgresClient = PostgresClient_1 = class PostgresClient {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(PostgresClient_1.name);
    }
    initialize(databaseUrl, schema) {
        const { Pool } = require('pg');
        const { drizzle } = require('drizzle-orm/node-postgres');
        const pool = new Pool({ connectionString: databaseUrl, max: 10 });
        this._client = pool;
        this._db = drizzle(pool, { schema });
        this.logger.log('PostgreSQL client initialized');
        return this._db;
    }
    get dbInstance() {
        if (!this._db) {
            throw new Error('PostgresClient not initialized. Call initialize() with a database URL and schema first.');
        }
        return this._db;
    }
    get rawClient() {
        if (!this._client) {
            throw new Error('PostgresClient not initialized. Call initialize() first.');
        }
        return this._client;
    }
    async connect() {
        this.logger.log('PostgreSQL client connected (Neon serverless)');
    }
    async disconnect() {
        this.logger.log('PostgreSQL client disconnected');
    }
    isConnected() {
        return this._client !== undefined && this._db !== undefined;
    }
    async executeQuery(sql, params) {
        if (!this._client) {
            throw new Error('PostgresClient not initialized');
        }
        const result = await this._client(sql, params);
        return result;
    }
};
exports.PostgresClient = PostgresClient;
exports.PostgresClient = PostgresClient = PostgresClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(exports.POSTGRES_CLIENT_CONFIG)),
    __metadata("design:paramtypes", [Object])
], PostgresClient);
//# sourceMappingURL=client.js.map