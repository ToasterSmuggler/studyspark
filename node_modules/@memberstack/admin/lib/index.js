"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = void 0;
var methods_1 = __importDefault(require("./methods"));
var init = function (secretKey) {
    return (0, methods_1.default)(secretKey);
};
exports.init = init;
exports.default = { init: exports.init };
