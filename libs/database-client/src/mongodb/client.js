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
var MongoDBClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDBClient = exports.MONGODB_CLIENT_CONFIG = void 0;
const common_1 = require("@nestjs/common");
exports.MONGODB_CLIENT_CONFIG = 'MONGODB_CLIENT_CONFIG';
let MongoDBClient = MongoDBClient_1 = class MongoDBClient {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(MongoDBClient_1.name);
    }
    async connect(uri) {
        try {
            this.mongoose = require('mongoose');
            const connectionUri = uri || this.config?.uri;
            if (!connectionUri) {
                throw new Error('MongoDB connection URI not provided');
            }
            await this.mongoose.connect(connectionUri, {
                dbName: this.config?.dbName,
            });
            this.connection = this.mongoose.connection;
            this.logger.log('Connected to MongoDB');
        }
        catch (error) {
            this.logger.error('Failed to connect to MongoDB', error);
            throw error;
        }
    }
    async disconnect() {
        if (this.mongoose) {
            await this.mongoose.disconnect();
            this.logger.log('Disconnected from MongoDB');
        }
    }
    isConnected() {
        return this.mongoose?.connection?.readyState === 1;
    }
    getModel(name, schema) {
        if (!this.mongoose) {
            throw new Error('MongoDB not connected. Call connect() first.');
        }
        if (schema) {
            const mongooseSchema = new this.mongoose.Schema(schema.definition, schema.options);
            return this.mongoose.model(name, mongooseSchema);
        }
        return this.mongoose.model(name);
    }
    async find(collection, filter = {}) {
        const model = this.getModel(collection);
        return model.find(filter).exec();
    }
    async insert(collection, document) {
        const model = this.getModel(collection);
        return model.create(document);
    }
    getClient() {
        return this.mongoose;
    }
};
exports.MongoDBClient = MongoDBClient;
exports.MongoDBClient = MongoDBClient = MongoDBClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(exports.MONGODB_CLIENT_CONFIG)),
    __metadata("design:paramtypes", [Object])
], MongoDBClient);
//# sourceMappingURL=client.js.map