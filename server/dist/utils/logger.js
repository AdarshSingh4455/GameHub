"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = exports.initSentry = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const Sentry = __importStar(require("@sentry/node"));
// Initialize Pino Structured Logger
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        }
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime
});
// Initialize Sentry SDK
const initSentry = () => {
    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: 0.1
        });
        exports.logger.info('Sentry Error Tracking initialized successfully.');
    }
    else {
        exports.logger.warn('Sentry DSN not found in environment variables. Error reporting is disabled.');
    }
};
exports.initSentry = initSentry;
/**
 * Capture and report errors with structured context to Sentry and Pino logs.
 */
const logError = (err, context) => {
    exports.logger.error({ err, ...context }, err.message);
    if (process.env.SENTRY_DSN) {
        Sentry.withScope((scope) => {
            if (context) {
                Object.keys(context).forEach((key) => {
                    scope.setExtra(key, context[key]);
                });
            }
            Sentry.captureException(err);
        });
    }
};
exports.logError = logError;
