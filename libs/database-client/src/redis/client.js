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
var RedisClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisClient = exports.REDIS_CLIENT_CONFIG = void 0;
const common_1 = require("@nestjs/common");
exports.REDIS_CLIENT_CONFIG = 'REDIS_CLIENT_CONFIG';
let RedisClient = RedisClient_1 = class RedisClient {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(RedisClient_1.name);
        this.client = null;
    }
    async connect() {
        try {
            this.Redis = require('ioredis').default || require('ioredis');
            let redisOptions;
            if (this.config?.url) {
                redisOptions = { lazyConnect: true };
                this.client = new this.Redis(this.config.url, redisOptions);
            }
            else if (this.config?.host) {
                redisOptions = {
                    host: this.config.host,
                    port: this.config.port || 6379,
                    password: this.config.password,
                    db: this.config.db || 0,
                };
                this.client = new this.Redis(redisOptions);
            }
            else {
                throw new Error('Redis configuration not provided. Set REDIS_CLIENT_CONFIG with url or host/port.');
            }
            if (!this.client) {
                throw new Error('Redis client not initialized');
            }
            await this.client.connect();
            this.logger.log('Connected to Redis');
        }
        catch (error) {
            this.logger.error('Failed to connect to Redis', error);
            throw error;
        }
    }
    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            this.logger.log('Disconnected from Redis');
        }
    }
    isConnected() {
        return this.client?.status === 'ready';
    }
    async get(key) {
        if (!this.client)
            throw new Error('Redis not connected');
        return this.client.get(key);
    }
    async set(key, value, ttl) {
        if (!this.client)
            throw new Error('Redis not connected');
        if (ttl) {
            await this.client.set(key, value, 'EX', ttl);
        }
        else {
            await this.client.set(key, value);
        }
    }
    async del(key) {
        if (!this.client)
            throw new Error('Redis not connected');
        return this.client.del(key);
    }
    async exists(key) {
        if (!this.client)
            throw new Error('Redis not connected');
        return this.client.exists(key);
    }
    async expire(key, seconds) {
        if (!this.client)
            throw new Error('Redis not connected');
        return this.client.expire(key, seconds);
    }
    getClient() {
        return this.client;
    }
};
exports.RedisClient = RedisClient;
exports.RedisClient = RedisClient = RedisClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(exports.REDIS_CLIENT_CONFIG)),
    __metadata("design:paramtypes", [Object])
], RedisClient);
//# sourceMappingURL=client.js.map