"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var members_1 = __importDefault(require("./members"));
var events_1 = require("./events");
var jwt_1 = require("./jwt");
exports.default = (function (secretKey, test) {
    if (test === void 0) { test = false; }
    return ({
        members: new members_1.default(secretKey, test),
        verifySignature: events_1.verifySignature,
        verifyWebhookSignature: events_1.verifyWebhookSignature,
        verifyToken: jwt_1.verifyToken,
    });
});
