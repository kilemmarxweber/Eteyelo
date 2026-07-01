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
exports.clearFrais = exports.initFrais = void 0;
var prisma_1 = require("@/lib/prisma");
// ===================== DATA =====================
var fraisData = [
    {
        nameFrais: "Frais de Scolarité 7ème Générale A",
        montantFrais: 500,
        classeCode: "7E-GEN-A",
        typeFraisCode: "SCOL",
        echeance: new Date("2024-12-31"),
        statusFrais: true
    },
    {
        nameFrais: "Frais d'Inscription 7ème Générale A",
        montantFrais: 50,
        classeCode: "7E-GEN-A",
        typeFraisCode: "INSC",
        echeance: new Date("2024-10-31"),
        statusFrais: true
    },
    {
        nameFrais: "Frais d'Examen 7ème Générale A",
        montantFrais: 25,
        classeCode: "7E-GEN-A",
        typeFraisCode: "EXAM",
        echeance: new Date("2025-05-31"),
        statusFrais: true
    },
    {
        nameFrais: "Frais de Scolarité 5ème Biologie A",
        montantFrais: 500,
        classeCode: "5E-BIO-A",
        typeFraisCode: "SCOL",
        echeance: new Date("2024-12-31"),
        statusFrais: true
    },
    {
        nameFrais: "Frais de Laboratoire 5ème Biologie A",
        montantFrais: 35,
        classeCode: "5E-BIO-A",
        typeFraisCode: "LABO",
        echeance: new Date("2024-11-30"),
        statusFrais: true
    },
    {
        nameFrais: "Frais d'Inscription 5ème Biologie A",
        montantFrais: 30,
        classeCode: "5E-BIO-A",
        typeFraisCode: "INSC",
        echeance: new Date("2024-10-31"),
        statusFrais: true
    },
    {
        nameFrais: "Frais de Scolarité 5ème Informatique A",
        montantFrais: 220000,
        classeCode: "5E-INFO-A",
        typeFraisCode: "SCOL",
        echeance: new Date("2024-12-31"),
        statusFrais: true
    },
    {
        nameFrais: "Frais de Laboratoire Informatique 5ème A",
        montantFrais: 50000,
        classeCode: "5E-INFO-A",
        typeFraisCode: "LABO",
        echeance: new Date("2024-11-30"),
        statusFrais: true
    },
    {
        nameFrais: "Frais d'Inscription 5ème Informatique A",
        montantFrais: 35000,
        classeCode: "5E-INFO-A",
        typeFraisCode: "INSC",
        echeance: new Date("2024-10-31"),
        statusFrais: true
    },
    {
        nameFrais: "Frais de Tenue Uniforme",
        montantFrais: 12000,
        classeCode: "7E-GEN-A",
        typeFraisCode: "TENUE",
        echeance: new Date("2024-11-15"),
        statusFrais: true
    },
    {
        nameFrais: "Frais de Fournitures Scolaires",
        montantFrais: 8000,
        classeCode: "7E-GEN-A",
        typeFraisCode: "FOURNI",
        echeance: new Date("2024-10-15"),
        statusFrais: true
    },
];
function getPriority(typeCode) {
    switch (typeCode) {
        case "INSC":
        case "TENUE":
        case "FOURNI":
            return 1; // inscription (prioritaire)
        case "SCOL":
            return 2; // scolarité
        case "EXAM":
        case "LABO":
            return 3;
        default:
            return 99;
    }
}
// ===================== INIT =====================
function initFrais() {
    return __awaiter(this, void 0, void 0, function () {
        var classes, typeFrais, classeMap, typeMap, createdCount, _i, fraisData_1, frais, classeId, typeFraisId, existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("💳 Initialisation des frais scolaires...");
                    return [4 /*yield*/, prisma_1["default"].classe.findMany()];
                case 1:
                    classes = _a.sent();
                    return [4 /*yield*/, prisma_1["default"].typeFrais.findMany()];
                case 2:
                    typeFrais = _a.sent();
                    classeMap = new Map(classes.map(function (c) { return [c.codeClasse, c.id]; }));
                    typeMap = new Map(typeFrais.map(function (t) { return [t.codeType, t.id]; }));
                    createdCount = 0;
                    _i = 0, fraisData_1 = fraisData;
                    _a.label = 3;
                case 3:
                    if (!(_i < fraisData_1.length)) return [3 /*break*/, 7];
                    frais = fraisData_1[_i];
                    classeId = classeMap.get(frais.classeCode);
                    typeFraisId = typeMap.get(frais.typeFraisCode);
                    if (!classeId) {
                        console.warn("\u26A0\uFE0F Classe " + frais.classeCode + " introuvable");
                        return [3 /*break*/, 6];
                    }
                    if (!typeFraisId) {
                        console.warn("\u26A0\uFE0F Type " + frais.typeFraisCode + " introuvable");
                        return [3 /*break*/, 6];
                    }
                    return [4 /*yield*/, prisma_1["default"].frais.findFirst({
                            where: {
                                nameFrais: frais.nameFrais,
                                classeId: classeId
                            }
                        })];
                case 4:
                    existing = _a.sent();
                    if (!!existing) return [3 /*break*/, 6];
                    return [4 /*yield*/, prisma_1["default"].frais.create({
                            data: {
                                nameFrais: frais.nameFrais,
                                montantFrais: frais.montantFrais,
                                classeId: classeId,
                                typeFraisId: typeFraisId,
                                echeance: frais.echeance,
                                statusFrais: frais.statusFrais,
                                priority: getPriority(frais.typeFraisCode)
                            }
                        })];
                case 5:
                    _a.sent();
                    createdCount++;
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 3];
                case 7:
                    console.log("\u2705 " + createdCount + " frais cr\u00E9\u00E9s");
                    return [2 /*return*/];
            }
        });
    });
}
exports.initFrais = initFrais;
// ===================== CLEAR =====================
function clearFrais() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🗑️ Suppression des frais...");
                    return [4 /*yield*/, prisma_1["default"].frais.deleteMany({})];
                case 1:
                    _a.sent();
                    console.log("✅ OK supprimé");
                    return [2 /*return*/];
            }
        });
    });
}
exports.clearFrais = clearFrais;
