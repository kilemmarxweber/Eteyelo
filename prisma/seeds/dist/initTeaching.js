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
exports.clearTeaching = exports.initTeaching = void 0;
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
// Définition des enseignements par enseignant, cours, classe et année scolaire
var teachingData = [
    // Année 2024-2025
    {
        schoolYear: "2024-2025",
        teacherUsername: "prof.mukendi",
        cours: "MATH",
        classes: ["7E-GEN-A", "7E-GEN-B"],
        titulaire: true // Titulaire de 7E-GEN-A
    },
    {
        schoolYear: "2024-2025",
        teacherUsername: "prof.mbuyi",
        cours: "FRAN",
        classes: ["7E-GEN-A", "7E-GEN-B", "5E-BIO-A"],
        titulaire: false
    },
    {
        schoolYear: "2024-2025",
        teacherUsername: "prof.tshimanga",
        cours: "PHYS",
        classes: ["5E-MATH-A", "5E-BIO-A"],
        titulaire: true // Titulaire de 5E-MATH-A
    },
    {
        schoolYear: "2024-2025",
        teacherUsername: "prof.ndaya",
        cours: "BIO",
        classes: ["5E-BIO-A", "6E-BIO-A"],
        titulaire: true // Titulaire de 5E-BIO-A
    },
    {
        schoolYear: "2024-2025",
        teacherUsername: "prof.kabila",
        cours: "CHIM",
        classes: ["5E-BIO-A", "6E-BIO-A"],
        titulaire: false
    },
    {
        schoolYear: "2024-2025",
        teacherUsername: "prof.mpiana",
        cours: "ANG",
        classes: ["7E-GEN-A", "7E-GEN-B", "5E-MATH-A", "5E-BIO-A"],
        titulaire: false
    },
    {
        schoolYear: "2024-2025",
        teacherUsername: "prof.mukendi",
        cours: "PROG",
        classes: ["5E-INFO-A"],
        titulaire: false
    },
    {
        schoolYear: "2024-2025",
        teacherUsername: "prof.tshimanga",
        cours: "INFO",
        classes: ["5E-INFO-A"],
        titulaire: true // Titulaire de 5E-INFO-A
    },
    // Année 2023-2024 (historique)
    {
        schoolYear: "2023-2024",
        teacherUsername: "prof.ndaya",
        cours: "BIO",
        classes: ["6E-BIO-A"],
        titulaire: true
    },
    {
        schoolYear: "2023-2024",
        teacherUsername: "prof.kabila",
        cours: "CHIM",
        classes: ["6E-BIO-A", "6E-MATH-A"],
        titulaire: false
    },
    {
        schoolYear: "2023-2024",
        teacherUsername: "prof.tshimanga",
        cours: "PHYS",
        classes: ["6E-MATH-A"],
        titulaire: true // Titulaire de 6E-MATH-A
    }
];
function initTeaching() {
    return __awaiter(this, void 0, void 0, function () {
        var schoolYears, teachers, cours, classes, schoolYearMap, teacherMap, coursMap, classeMap, createdCount, _i, teachingData_1, teaching, schoolYearId, teacherId, coursId, _a, _b, className, classeId, isTitulaire, existingTeaching;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('👨‍🏫📚 Initialisation des enseignements...');
                    return [4 /*yield*/, prisma.schoolYear.findMany()];
                case 1:
                    schoolYears = _c.sent();
                    return [4 /*yield*/, prisma.teacher.findMany({
                            include: { user: true }
                        })];
                case 2:
                    teachers = _c.sent();
                    return [4 /*yield*/, prisma.cours.findMany()];
                case 3:
                    cours = _c.sent();
                    return [4 /*yield*/, prisma.classe.findMany()
                        // Créer des maps pour faciliter la recherche
                    ];
                case 4:
                    classes = _c.sent();
                    schoolYearMap = new Map(schoolYears.map(function (sy) { return [sy.nameYear, sy.id]; }));
                    teacherMap = new Map(teachers.map(function (t) { var _a; return [(_a = t.user) === null || _a === void 0 ? void 0 : _a.username, t.id]; }));
                    coursMap = new Map(cours.map(function (c) { return [c.codeCours, c.id]; }));
                    classeMap = new Map(classes.map(function (c) { return [c.codeClasse, c.id]; }));
                    createdCount = 0;
                    _i = 0, teachingData_1 = teachingData;
                    _c.label = 5;
                case 5:
                    if (!(_i < teachingData_1.length)) return [3 /*break*/, 11];
                    teaching = teachingData_1[_i];
                    schoolYearId = schoolYearMap.get(teaching.schoolYear);
                    teacherId = teacherMap.get(teaching.teacherUsername);
                    coursId = coursMap.get(teaching.cours);
                    if (!schoolYearId) {
                        console.warn("\u26A0\uFE0F  Ann\u00E9e scolaire " + teaching.schoolYear + " non trouv\u00E9e");
                        return [3 /*break*/, 10];
                    }
                    if (!teacherId) {
                        console.warn("\u26A0\uFE0F  Enseignant " + teaching.teacherUsername + " non trouv\u00E9");
                        return [3 /*break*/, 10];
                    }
                    if (!coursId) {
                        console.warn("\u26A0\uFE0F  Cours " + teaching.cours + " non trouv\u00E9");
                        return [3 /*break*/, 10];
                    }
                    _a = 0, _b = teaching.classes;
                    _c.label = 6;
                case 6:
                    if (!(_a < _b.length)) return [3 /*break*/, 10];
                    className = _b[_a];
                    classeId = classeMap.get(className);
                    if (!classeId) {
                        console.warn("\u26A0\uFE0F  Classe " + className + " non trouv\u00E9e");
                        return [3 /*break*/, 9];
                    }
                    isTitulaire = teaching.titulaire && teaching.classes.indexOf(className) === 0;
                    return [4 /*yield*/, prisma.teaching.findFirst({
                            where: {
                                teacherId: teacherId,
                                classeId: classeId,
                                schoolYearId: schoolYearId,
                                coursId: coursId
                            }
                        })];
                case 7:
                    existingTeaching = _c.sent();
                    if (!!existingTeaching) return [3 /*break*/, 9];
                    return [4 /*yield*/, prisma.teaching.create({
                            data: {
                                teacherId: teacherId,
                                classeId: classeId,
                                schoolYearId: schoolYearId,
                                coursId: coursId,
                                titulaire: isTitulaire,
                                statusTeaching: true
                            }
                        })];
                case 8:
                    _c.sent();
                    createdCount++;
                    _c.label = 9;
                case 9:
                    _a++;
                    return [3 /*break*/, 6];
                case 10:
                    _i++;
                    return [3 /*break*/, 5];
                case 11:
                    console.log("\u2705 " + createdCount + " enseignements cr\u00E9\u00E9s");
                    return [2 /*return*/];
            }
        });
    });
}
exports.initTeaching = initTeaching;
function clearTeaching() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🗑️  Suppression des enseignements...');
                    return [4 /*yield*/, prisma.teaching.deleteMany({})];
                case 1:
                    _a.sent();
                    console.log('✅ Enseignements supprimés');
                    return [2 /*return*/];
            }
        });
    });
}
exports.clearTeaching = clearTeaching;
