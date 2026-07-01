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
exports.clearPeriods = exports.initPeriods = void 0;
var prisma_1 = require("@/lib/prisma");
function initPeriods() {
    return __awaiter(this, void 0, void 0, function () {
        var semester1, semester2, periodData, _i, periodData_1, pd, existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("📖 Initialisation des cours...");
                    return [4 /*yield*/, prisma_1["default"].semester.upsert({
                            where: { label: "Semester 1" },
                            update: {},
                            create: {
                                label: "Semester 1",
                                startDate: new Date("2025-01-15"),
                                endDate: new Date("2025-01-15")
                            }
                        })];
                case 1:
                    semester1 = _a.sent();
                    return [4 /*yield*/, prisma_1["default"].semester.upsert({
                            where: { label: "Semester 2" },
                            update: {},
                            create: {
                                label: "Semester 2",
                                startDate: new Date("2025-01-16"),
                                endDate: new Date("2025-01-16")
                            }
                        })];
                case 2:
                    semester2 = _a.sent();
                    periodData = [
                        {
                            label: "1st Period",
                            startDate: semester1.startDate,
                            endDate: new Date("2024-11-30"),
                            semesterId: semester1.id
                        },
                        {
                            label: "2nd Period",
                            startDate: new Date("2024-12-01"),
                            endDate: new Date("2025-01-15"),
                            semesterId: semester1.id
                        },
                        {
                            label: "Exam 1st semester",
                            startDate: new Date("2025-01-01"),
                            endDate: new Date("2025-01-15"),
                            semesterId: semester1.id
                        },
                        {
                            label: "3tr Period",
                            startDate: semester2.startDate,
                            endDate: new Date("2025-04-15"),
                            semesterId: semester2.id
                        },
                        {
                            label: "4th Period",
                            startDate: new Date("2025-04-16"),
                            endDate: new Date("2025-05-15"),
                            semesterId: semester2.id
                        },
                        {
                            label: "Exam 2nd semester",
                            startDate: new Date("2025-05-16"),
                            endDate: semester2.endDate,
                            semesterId: semester2.id
                        },
                    ];
                    _i = 0, periodData_1 = periodData;
                    _a.label = 3;
                case 3:
                    if (!(_i < periodData_1.length)) return [3 /*break*/, 7];
                    pd = periodData_1[_i];
                    return [4 /*yield*/, prisma_1["default"].period.findFirst({
                            where: { label: pd.label, semesterId: pd.semesterId }
                        })];
                case 4:
                    existing = _a.sent();
                    if (!!existing) return [3 /*break*/, 6];
                    return [4 /*yield*/, prisma_1["default"].period.create({
                            data: {
                                label: pd.label,
                                startDate: pd.startDate,
                                endDate: pd.endDate,
                                semesterId: pd.semesterId
                            }
                        })];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 3];
                case 7:
                    console.log("\u2705 " + periodData.length + " p\u00E9riodes cr\u00E9\u00E9es");
                    return [2 /*return*/];
            }
        });
    });
}
exports.initPeriods = initPeriods;
function clearPeriods() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🗑️  Suppression des périodes et semester...");
                    return [4 /*yield*/, prisma_1["default"].period.deleteMany({})];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, prisma_1["default"].semester.deleteMany({})];
                case 2:
                    _a.sent();
                    console.log("✅ Périodes supprimées");
                    console.log("✅ semester supprimées");
                    return [2 /*return*/];
            }
        });
    });
}
exports.clearPeriods = clearPeriods;
