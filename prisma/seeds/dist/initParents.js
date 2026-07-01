"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.clearParents = exports.initParents = void 0;
var prisma_1 = require("@/lib/prisma");
function initParents() {
    return __awaiter(this, void 0, void 0, function () {
        var parentUsers, createdCount, _i, parentUsers_1, user, existingParent, parent, existingDiscount;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("👨‍👩‍👧‍👦 Initialisation des parents...");
                    return [4 /*yield*/, prisma_1["default"].user.findMany({
                            where: {
                                username: {
                                    startsWith: "parent."
                                }
                            }
                        })];
                case 1:
                    parentUsers = _a.sent();
                    createdCount = 0;
                    _i = 0, parentUsers_1 = parentUsers;
                    _a.label = 2;
                case 2:
                    if (!(_i < parentUsers_1.length)) return [3 /*break*/, 10];
                    user = parentUsers_1[_i];
                    return [4 /*yield*/, prisma_1["default"].parent.findFirst({
                            where: { userId: user.id }
                        })];
                case 3:
                    existingParent = _a.sent();
                    parent = void 0;
                    if (!!existingParent) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma_1["default"].parent.create({
                            data: {
                                userId: user.id
                            }
                        })];
                case 4:
                    parent = _a.sent();
                    createdCount++;
                    return [3 /*break*/, 6];
                case 5:
                    parent = existingParent;
                    _a.label = 6;
                case 6: return [4 /*yield*/, prisma_1["default"].discountRule.findFirst({
                        where: {
                            scope: "PARENT",
                            parentId: parent.id
                        }
                    })];
                case 7:
                    existingDiscount = _a.sent();
                    if (!!existingDiscount) return [3 /*break*/, 9];
                    return [4 /*yield*/, prisma_1["default"].discountRule.create({
                            data: {
                                scope: "PARENT",
                                parentId: parent.id,
                                percentage: 10
                            }
                        })];
                case 8:
                    _a.sent();
                    _a.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 2];
                case 10:
                    console.log("\u2705 " + createdCount + " parents cr\u00E9\u00E9s");
                    return [2 /*return*/];
            }
        });
    });
}
exports.initParents = initParents;
function clearParents() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🗑️  Suppression des parents...");
                    return [4 /*yield*/, prisma_1["default"].parent.deleteMany({})];
                case 1:
                    _a.sent();
                    console.log("✅ Parents supprimées");
                    return [2 /*return*/];
            }
        });
    });
}
exports.clearParents = clearParents;
