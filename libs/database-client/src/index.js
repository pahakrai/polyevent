"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDIS_CLIENT_CONFIG = exports.RedisClient = exports.MONGODB_CLIENT_CONFIG = exports.MongoDBClient = exports.POSTGRES_CLIENT_CONFIG = exports.PostgresClient = void 0;
var client_1 = require("./postgres/client");
Object.defineProperty(exports, "PostgresClient", { enumerable: true, get: function () { return client_1.PostgresClient; } });
Object.defineProperty(exports, "POSTGRES_CLIENT_CONFIG", { enumerable: true, get: function () { return client_1.POSTGRES_CLIENT_CONFIG; } });
var client_2 = require("./mongodb/client");
Object.defineProperty(exports, "MongoDBClient", { enumerable: true, get: function () { return client_2.MongoDBClient; } });
Object.defineProperty(exports, "MONGODB_CLIENT_CONFIG", { enumerable: true, get: function () { return client_2.MONGODB_CLIENT_CONFIG; } });
var client_3 = require("./redis/client");
Object.defineProperty(exports, "RedisClient", { enumerable: true, get: function () { return client_3.RedisClient; } });
Object.defineProperty(exports, "REDIS_CLIENT_CONFIG", { enumerable: true, get: function () { return client_3.REDIS_CLIENT_CONFIG; } });
//# sourceMappingURL=index.js.map