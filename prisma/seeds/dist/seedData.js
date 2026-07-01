#!/usr/bin/env node
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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.INIT_ORDER = exports.clearSpecific = exports.seedSpecific = exports.clearAll = exports.seedAll = void 0;
var client_1 = require("@prisma/client");
var initSchoolYears_1 = require("./initSchoolYears");
var initSections_1 = require("./initSections");
var initOptions_1 = require("./initOptions");
var initCreneaux_1 = require("./initCreneaux");
var initClasses_1 = require("./initClasses");
var initCours_1 = require("./initCours");
var initUsers_1 = require("./initUsers");
var initAdmin_1 = require("./initAdmin");
var initTeachers_1 = require("./initTeachers");
var initParents_1 = require("./initParents");
var initStudents_1 = require("./initStudents");
var initClassEnrollments_1 = require("./initClassEnrollments");
var initTeaching_1 = require("./initTeaching");
var initSchedules_1 = require("./initSchedules");
var initTypeFrais_1 = require("./initTypeFrais");
var initFrais_1 = require("./initFrais");
var initPeriod_1 = require("./initPeriod");
var prisma = new client_1.PrismaClient();
// Ordre d'exécution des scripts (important pour les dépendances)
var INIT_ORDER = [
    { name: "schoolYears", init: initSchoolYears_1.initSchoolYears, clear: initSchoolYears_1.clearSchoolYears },
    { name: "sections", init: initSections_1.initSections, clear: initSections_1.clearSections },
    { name: "options", init: initOptions_1.initOptions, clear: initOptions_1.clearOptions },
    { name: "creneaux", init: initCreneaux_1.initCreneaux, clear: initCreneaux_1.clearCreneaux },
    { name: "classes", init: initClasses_1.initClasses, clear: initClasses_1.clearClasses },
    { name: "cours", init: initCours_1.initCours, clear: initCours_1.clearCours },
    { name: "users", init: initUsers_1.initUsers, clear: initUsers_1.clearUsers },
    { name: "admin", init: initAdmin_1.initAdmin, clear: initAdmin_1.clearAdmin },
    { name: "teachers", init: initTeachers_1.initTeachers, clear: initTeachers_1.clearTeachers },
    { name: "parents", init: initParents_1.initParents, clear: initParents_1.clearParents },
    { name: "students", init: initStudents_1.initStudents, clear: initStudents_1.clearStudents },
    {
        name: "classEnrollments",
        init: initClassEnrollments_1.initClassEnrollments,
        clear: initClassEnrollments_1.clearClassEnrollments
    },
    { name: "teaching", init: initTeaching_1.initTeaching, clear: initTeaching_1.clearTeaching },
    { name: "schedules", init: initSchedules_1.initSchedules, clear: initSchedules_1.clearSchedules },
    { name: "typeFrais", init: initTypeFrais_1.initTypeFrais, clear: initTypeFrais_1.clearTypeFrais },
    { name: "frais", init: initFrais_1.initFrais, clear: initFrais_1.clearFrais },
    { name: "periods", init: initPeriod_1.initPeriods, clear: initPeriod_1.clearPeriods },
];
exports.INIT_ORDER = INIT_ORDER;
// Ordre inverse pour la suppression
var CLEAR_ORDER = __spreadArrays(INIT_ORDER).reverse();
function seedAll() {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, _i, INIT_ORDER_1, script, endTime, duration, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🚀 Initialisation complète de la base de données...\n");
                    startTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    _i = 0, INIT_ORDER_1 = INIT_ORDER;
                    _a.label = 2;
                case 2:
                    if (!(_i < INIT_ORDER_1.length)) return [3 /*break*/, 5];
                    script = INIT_ORDER_1[_i];
                    return [4 /*yield*/, script.init()];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    endTime = Date.now();
                    duration = ((endTime - startTime) / 1000).toFixed(2);
                    console.log("\n\uD83C\uDF89 Initialisation compl\u00E8te termin\u00E9e en " + duration + "s");
                    console.log("\n📊 Résumé des données créées:");
                    console.log("   - Années scolaires: 3");
                    console.log("   - Sections: 7");
                    console.log("   - Options: 15");
                    console.log("   - Créneaux: 4");
                    console.log("   - Classes: 17");
                    console.log("   - Cours: 31");
                    console.log("   - Utilisateurs: 22");
                    console.log("   - Enseignants: 6");
                    console.log("   - Parents: 5");
                    console.log("   - Étudiants: 10");
                    console.log("   - Inscriptions: Variable");
                    console.log("   - Enseignements: Variable");
                    console.log("   - Horaires: Variable");
                    console.log("   - Types de frais: 10");
                    console.log("   - Frais scolaires: Variable");
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    console.error("❌ Erreur lors de l'initialisation:", error_1);
                    throw error_1;
                case 7: return [2 /*return*/];
            }
        });
    });
}
exports.seedAll = seedAll;
function clearAll() {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, _i, CLEAR_ORDER_1, script, endTime, duration, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🗑️  Suppression complète de la base de données...\n");
                    startTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    _i = 0, CLEAR_ORDER_1 = CLEAR_ORDER;
                    _a.label = 2;
                case 2:
                    if (!(_i < CLEAR_ORDER_1.length)) return [3 /*break*/, 5];
                    script = CLEAR_ORDER_1[_i];
                    return [4 /*yield*/, script.clear()];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    endTime = Date.now();
                    duration = ((endTime - startTime) / 1000).toFixed(2);
                    console.log("\n\u2705 Suppression compl\u00E8te termin\u00E9e en " + duration + "s");
                    return [3 /*break*/, 7];
                case 6:
                    error_2 = _a.sent();
                    console.error("❌ Erreur lors de la suppression:", error_2);
                    throw error_2;
                case 7: return [2 /*return*/];
            }
        });
    });
}
exports.clearAll = clearAll;
function seedSpecific(scriptNames) {
    return __awaiter(this, void 0, void 0, function () {
        var _loop_1, _i, scriptNames_1, scriptName;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\uD83C\uDFAF Initialisation sp\u00E9cifique: " + scriptNames.join(", ") + "\n");
                    _loop_1 = function (scriptName) {
                        var script;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    script = INIT_ORDER.find(function (s) { return s.name === scriptName; });
                                    if (!script) return [3 /*break*/, 2];
                                    return [4 /*yield*/, script.init()];
                                case 1:
                                    _a.sent();
                                    return [3 /*break*/, 3];
                                case 2:
                                    console.warn("\u26A0\uFE0F  Script '" + scriptName + "' non trouv\u00E9");
                                    _a.label = 3;
                                case 3: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, scriptNames_1 = scriptNames;
                    _a.label = 1;
                case 1:
                    if (!(_i < scriptNames_1.length)) return [3 /*break*/, 4];
                    scriptName = scriptNames_1[_i];
                    return [5 /*yield**/, _loop_1(scriptName)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.seedSpecific = seedSpecific;
function clearSpecific(scriptNames) {
    return __awaiter(this, void 0, void 0, function () {
        var reversedNames, _loop_2, _i, reversedNames_1, scriptName;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\uD83D\uDDD1\uFE0F  Suppression sp\u00E9cifique: " + scriptNames.join(", ") + "\n");
                    reversedNames = scriptNames.reverse();
                    _loop_2 = function (scriptName) {
                        var script;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    script = INIT_ORDER.find(function (s) { return s.name === scriptName; });
                                    if (!script) return [3 /*break*/, 2];
                                    return [4 /*yield*/, script.clear()];
                                case 1:
                                    _a.sent();
                                    return [3 /*break*/, 3];
                                case 2:
                                    console.warn("\u26A0\uFE0F  Script '" + scriptName + "' non trouv\u00E9");
                                    _a.label = 3;
                                case 3: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, reversedNames_1 = reversedNames;
                    _a.label = 1;
                case 1:
                    if (!(_i < reversedNames_1.length)) return [3 /*break*/, 4];
                    scriptName = reversedNames_1[_i];
                    return [5 /*yield**/, _loop_2(scriptName)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.clearSpecific = clearSpecific;
function printHelp() {
    console.log("\n\uD83C\uDF93 Syst\u00E8me de gestion des donn\u00E9es de test pour ETEYELO\n\nUsage: pnpm run seed [options]\n\nOptions:\n  --all, -a                    Initialiser toutes les donn\u00E9es\n  --clear, -c                  Supprimer toutes les donn\u00E9es\n  --init <scripts>             Initialiser des scripts sp\u00E9cifiques\n  --clear-specific <scripts>   Supprimer des scripts sp\u00E9cifiques\n  --list, -l                   Lister tous les scripts disponibles\n  --help, -h                   Afficher cette aide\n\nScripts disponibles:\n" + INIT_ORDER.map(function (s) { return "  - " + s.name; }).join("\n") + "\n\nExemples:\n  pnpm run seed --all                           # Initialiser tout\n  pnpm run seed --clear                         # Supprimer tout\n  pnpm run seed --init users,teachers           # Initialiser uniquement users et teachers\n  pnpm run seed --clear-specific frais          # Supprimer uniquement les frais\n  pnpm run seed --list                          # Lister les scripts disponibles\n\nOrdre recommand\u00E9 pour les d\u00E9pendances:\n1. schoolYears, sections, options, creneaux, cours, users\n2. teachers, parents, students, classes\n3. classEnrollments, teaching, schedules\n4. typeFrais, frais\n");
}
function listScripts() {
    console.log("📋 Scripts disponibles:\n");
    INIT_ORDER.forEach(function (script, index) {
        console.log(index + 1 + ". " + script.name);
    });
}
function main() {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var args, index, scriptNames, index, scriptNames, error_3;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 14, 15, 17]);
                    args = process.argv.slice(2);
                    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
                        printHelp();
                        return [2 /*return*/];
                    }
                    if (args.includes("--list") || args.includes("-l")) {
                        listScripts();
                        return [2 /*return*/];
                    }
                    if (!(args.includes("--all") || args.includes("-a"))) return [3 /*break*/, 2];
                    return [4 /*yield*/, seedAll()];
                case 1:
                    _c.sent();
                    return [3 /*break*/, 13];
                case 2:
                    if (!(args.includes("--clear") || args.includes("-c"))) return [3 /*break*/, 4];
                    return [4 /*yield*/, clearAll()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 13];
                case 4:
                    if (!args.includes("--init")) return [3 /*break*/, 8];
                    index = args.indexOf("--init");
                    scriptNames = ((_a = args[index + 1]) === null || _a === void 0 ? void 0 : _a.split(",")) || [];
                    if (!(scriptNames.length > 0)) return [3 /*break*/, 6];
                    return [4 /*yield*/, seedSpecific(scriptNames)];
                case 5:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 6:
                    console.error("❌ Veuillez spécifier les scripts à initialiser");
                    _c.label = 7;
                case 7: return [3 /*break*/, 13];
                case 8:
                    if (!args.includes("--clear-specific")) return [3 /*break*/, 12];
                    index = args.indexOf("--clear-specific");
                    scriptNames = ((_b = args[index + 1]) === null || _b === void 0 ? void 0 : _b.split(",")) || [];
                    if (!(scriptNames.length > 0)) return [3 /*break*/, 10];
                    return [4 /*yield*/, clearSpecific(scriptNames)];
                case 9:
                    _c.sent();
                    return [3 /*break*/, 11];
                case 10:
                    console.error("❌ Veuillez spécifier les scripts à supprimer");
                    _c.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    console.error("❌ Option non reconnue. Utilisez --help pour voir les options disponibles.");
                    _c.label = 13;
                case 13: return [3 /*break*/, 17];
                case 14:
                    error_3 = _c.sent();
                    console.error("❌ Erreur:", error_3);
                    process.exit(1);
                    return [3 /*break*/, 17];
                case 15: return [4 /*yield*/, prisma.$disconnect()];
                case 16:
                    _c.sent();
                    return [7 /*endfinally*/];
                case 17: return [2 /*return*/];
            }
        });
    });
}
// Exécuter si appelé directement
if (require.main === module) {
    main();
}
