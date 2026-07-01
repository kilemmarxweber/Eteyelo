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
exports.clearClasses = exports.initClasses = exports.classesData = void 0;
var prisma_1 = require("@/lib/prisma");
exports.classesData = [
    // Classes Générales
    {
        codeClasse: "7E-A",
        nameClasse: "7ème A Cycle d’orientation",
        optionCode: "CYC-ORIEN",
        creneauName: "Horaire Standard Matin",
        statusClasse: true
    },
    {
        codeClasse: "7E-B",
        nameClasse: "7ème B Cycle d’orientation",
        optionCode: "CYC-ORIEN",
        creneauName: "Horaire Standard Matin",
        statusClasse: true
    },
    {
        codeClasse: "8E-A",
        nameClasse: "8ème Cycle d’orientation",
        optionCode: "CYC-ORIEN",
        creneauName: "Horaire Standard Matin",
        statusClasse: true
    },
    // Classes Biologie-Chimie
    {
        codeClasse: "5E-BIO-A",
        nameClasse: "5ème Bio-Chimie A",
        optionCode: "BIO-CHI",
        creneauName: "Horaire Standard Matin",
        statusClasse: true
    },
    {
        codeClasse: "6E-BIO-A",
        nameClasse: "6ème Biologie-Chimie A",
        optionCode: "BIO-CHI",
        creneauName: "Horaire Standard Matin",
        statusClasse: true
    },
    // Classes Mathématiques-Physique
    {
        codeClasse: "5E-MATH-A",
        nameClasse: "5ème Mathématiques-Physique A",
        optionCode: "MATH-PHYS",
        creneauName: "Horaire Standard Matin",
        statusClasse: true
    },
    {
        codeClasse: "6E-MATH-A",
        nameClasse: "6ème Mathématiques-Physique A",
        optionCode: "MATH-PHYS",
        creneauName: "Horaire Standard Après-midi",
        statusClasse: true
    },
    // Classes Commercial et Gestion
    {
        codeClasse: "5E-COMM-A",
        nameClasse: "5ème Commercial et Gestion A",
        optionCode: "COMM-GEST",
        creneauName: "Horaire Standard Matin",
        statusClasse: true
    },
    {
        codeClasse: "6E-COMM-A",
        nameClasse: "6ème Commercial et Gestion A",
        optionCode: "COMM-GEST",
        creneauName: "Horaire Standard Après-midi",
        statusClasse: true
    },
];
function initClasses() {
    return __awaiter(this, void 0, void 0, function () {
        var options, creneaux, optionMap, creneauMap, _i, classesData_1, classe, optionId, creneauId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🏛️  Initialisation des classes...");
                    return [4 /*yield*/, prisma_1["default"].option.findMany()];
                case 1:
                    options = _a.sent();
                    return [4 /*yield*/, prisma_1["default"].creneau.findMany()];
                case 2:
                    creneaux = _a.sent();
                    optionMap = new Map(options.map(function (o) { return [o.codeOption, o.id]; }));
                    creneauMap = new Map(creneaux.map(function (c) { return [c.nameCreneau, c.id]; }));
                    _i = 0, classesData_1 = exports.classesData;
                    _a.label = 3;
                case 3:
                    if (!(_i < classesData_1.length)) return [3 /*break*/, 6];
                    classe = classesData_1[_i];
                    optionId = optionMap.get(classe.optionCode);
                    creneauId = creneauMap.get(classe.creneauName);
                    if (!optionId) {
                        console.warn("\u26A0\uFE0F  Option " + classe.optionCode + " non trouv\u00E9e pour la classe " + classe.nameClasse);
                        return [3 /*break*/, 5];
                    }
                    if (!creneauId) {
                        console.warn("\u26A0\uFE0F  Cr\u00E9neau " + classe.creneauName + " non trouv\u00E9 pour la classe " + classe.nameClasse);
                        return [3 /*break*/, 5];
                    }
                    return [4 /*yield*/, prisma_1["default"].classe.upsert({
                            where: { codeClasse: classe.codeClasse },
                            update: {
                                nameClasse: classe.nameClasse,
                                optionId: optionId,
                                creneauId: creneauId,
                                statusClasse: classe.statusClasse
                            },
                            create: {
                                codeClasse: classe.codeClasse,
                                nameClasse: classe.nameClasse,
                                optionId: optionId,
                                creneauId: creneauId,
                                statusClasse: classe.statusClasse
                            }
                        })];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    console.log("\u2705 " + exports.classesData.length + " classes cr\u00E9\u00E9es");
                    return [2 /*return*/];
            }
        });
    });
}
exports.initClasses = initClasses;
function clearClasses() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🗑️  Suppression des classes...");
                    return [4 /*yield*/, prisma_1["default"].classe.deleteMany({})];
                case 1:
                    _a.sent();
                    console.log("✅ Classes supprimées");
                    return [2 /*return*/];
            }
        });
    });
}
exports.clearClasses = clearClasses;
