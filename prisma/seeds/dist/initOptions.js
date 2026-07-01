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
exports.clearOptions = exports.initOptions = exports.optionsData = void 0;
var prisma_1 = require("@/lib/prisma");
exports.optionsData = [
    // Section Général
    {
        codeOption: "CYC-ORIEN",
        nameOption: "CYCLE D'ORIENTATION",
        sectionCode: "HUM-GEN",
        statusOption: true
    },
    // Section Biologie-Chimie
    {
        codeOption: "BIO-CHI",
        nameOption: "Biologie-Chimie",
        sectionCode: "SCIE",
        statusOption: true
    },
    // Section Mathématiques-Physique
    {
        codeOption: "MATH-PHYS",
        nameOption: "Mathématiques – Physique",
        sectionCode: "SCIE",
        statusOption: true
    },
    // Section Commercial et Gestion
    {
        codeOption: "COMM-GEST",
        nameOption: "Commerciale et gestion",
        sectionCode: "COMM-AD",
        statusOption: true
    },
    {
        codeOption: "COMM-SEC-ADM",
        nameOption: "Secrétariat administratif",
        sectionCode: "COMM-AD",
        statusOption: true
    },
    {
        codeOption: "COMM-COMPTE",
        nameOption: "Comptabilité",
        sectionCode: "COMM-AD",
        statusOption: true
    },
    // Section Technique
    {
        codeOption: "TECH-ELEC",
        nameOption: "Électricité générale",
        sectionCode: "TECH",
        statusOption: true
    },
    {
        codeOption: "TECH-MECA",
        nameOption: "Mécanique générale",
        sectionCode: "TECH",
        statusOption: true
    },
    {
        codeOption: "TECH-CONSTR",
        nameOption: "Technique Construction",
        sectionCode: "TECH",
        statusOption: true
    },
    {
        codeOption: "TECH-ELEC",
        nameOption: "Électronique",
        sectionCode: "TECH",
        statusOption: true
    },
    // Section Lettres et Philosophie
    {
        codeOption: "LATIN-PHILO",
        nameOption: "Latin – Philosophie",
        sectionCode: "LITT",
        statusOption: true
    },
    {
        codeOption: "LETT-PHIL",
        nameOption: "Philosophie – Lettres",
        sectionCode: "LITT",
        statusOption: true
    },
    // Section Pédagogique
    {
        codeOption: "PED-GEN",
        nameOption: "Pédagogie générale",
        sectionCode: "PEDA",
        statusOption: true
    },
    {
        codeOption: "PED-SCIE",
        nameOption: "Pédagogie des sciences",
        sectionCode: "PEDA",
        statusOption: true
    },
    {
        codeOption: "PED-LAN",
        nameOption: "Pédagogie des langues",
        sectionCode: "PEDA",
        statusOption: true
    },
];
function initOptions() {
    return __awaiter(this, void 0, void 0, function () {
        var sections, sectionMap, _i, optionsData_1, option, sectionId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("📚 Initialisation des options...");
                    return [4 /*yield*/, prisma_1["default"].section.findMany()];
                case 1:
                    sections = _a.sent();
                    sectionMap = new Map(sections.map(function (s) { return [s.codeSection, s.id]; }));
                    _i = 0, optionsData_1 = exports.optionsData;
                    _a.label = 2;
                case 2:
                    if (!(_i < optionsData_1.length)) return [3 /*break*/, 5];
                    option = optionsData_1[_i];
                    sectionId = sectionMap.get(option.sectionCode);
                    if (!sectionId) {
                        console.warn("\u26A0\uFE0F  Section " + option.sectionCode + " non trouv\u00E9e pour l'option " + option.nameOption);
                        return [3 /*break*/, 4];
                    }
                    return [4 /*yield*/, prisma_1["default"].option.upsert({
                            where: { codeOption: option.codeOption },
                            update: {
                                nameOption: option.nameOption,
                                sectionId: sectionId,
                                statusOption: option.statusOption
                            },
                            create: {
                                codeOption: option.codeOption,
                                nameOption: option.nameOption,
                                sectionId: sectionId,
                                statusOption: option.statusOption
                            }
                        })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    console.log("\u2705 " + exports.optionsData.length + " options cr\u00E9\u00E9es");
                    return [2 /*return*/];
            }
        });
    });
}
exports.initOptions = initOptions;
function clearOptions() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🗑️  Suppression des options...");
                    return [4 /*yield*/, prisma_1["default"].option.deleteMany({})];
                case 1:
                    _a.sent();
                    console.log("✅ Options supprimées");
                    return [2 /*return*/];
            }
        });
    });
}
exports.clearOptions = clearOptions;
