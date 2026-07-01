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
exports.clearClassEnrollments = exports.initClassEnrollments = void 0;
var prisma_1 = require("@/lib/prisma");
// Définition des inscriptions par classe et année scolaire
var enrollmentData = [
    // Année 2024-2025 (année courante)
    {
        schoolYear: "2024-2025",
        classe: "7E-GEN-A",
        studentUsernames: [
            "eleve.kasongo.junior",
            "eleve.kalombo.grâce",
            "eleve.mukendi.sarah",
        ]
    },
    {
        schoolYear: "2024-2025",
        classe: "7E-GEN-B",
        studentUsernames: ["eleve.tshiamala.michel", "eleve.kabongo.ruth"]
    },
    {
        schoolYear: "2024-2025",
        classe: "5E-BIO-A",
        studentUsernames: ["eleve.mulumba.prince", "eleve.mwamba.esther"]
    },
    {
        schoolYear: "2024-2025",
        classe: "5E-MATH-A",
        studentUsernames: ["eleve.katanga.david", "eleve.mputu.samuel"]
    },
    {
        schoolYear: "2024-2025",
        classe: "5E-INFO-A",
        studentUsernames: ["eleve.tshilombo.joie"]
    },
    // Année 2023-2024 (année précédente)
    {
        schoolYear: "2023-2024",
        classe: "6E-BIO-A",
        studentUsernames: [
            "eleve.mulumba.prince",
            "eleve.mwamba.esther",
        ]
    },
    {
        schoolYear: "2023-2024",
        classe: "6E-MATH-A",
        studentUsernames: ["eleve.katanga.david", "eleve.mputu.samuel"]
    },
];
function initClassEnrollments() {
    return __awaiter(this, void 0, void 0, function () {
        var schoolYears, classes, students, schoolYearMap, classeMap, studentMap, createdCount, _i, enrollmentData_1, enrollment, schoolYearId, classeId, _a, _b, studentUsername, studentId, existingEnrollment;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log("📝 Initialisation des inscriptions de classe...");
                    return [4 /*yield*/, prisma_1["default"].schoolYear.findMany()];
                case 1:
                    schoolYears = _c.sent();
                    return [4 /*yield*/, prisma_1["default"].classe.findMany()];
                case 2:
                    classes = _c.sent();
                    return [4 /*yield*/, prisma_1["default"].student.findMany({
                            include: { user: true }
                        })];
                case 3:
                    students = _c.sent();
                    schoolYearMap = new Map(schoolYears.map(function (sy) { return [sy.nameYear, sy.id]; }));
                    classeMap = new Map(classes.map(function (c) { return [c.codeClasse, c.id]; }));
                    studentMap = new Map(students.map(function (s) { var _a; return [(_a = s.user) === null || _a === void 0 ? void 0 : _a.username, s.id]; }));
                    createdCount = 0;
                    _i = 0, enrollmentData_1 = enrollmentData;
                    _c.label = 4;
                case 4:
                    if (!(_i < enrollmentData_1.length)) return [3 /*break*/, 10];
                    enrollment = enrollmentData_1[_i];
                    schoolYearId = schoolYearMap.get(enrollment.schoolYear);
                    classeId = classeMap.get(enrollment.classe);
                    if (!schoolYearId) {
                        console.warn("\u26A0\uFE0F  Ann\u00E9e scolaire " + enrollment.schoolYear + " non trouv\u00E9e");
                        return [3 /*break*/, 9];
                    }
                    if (!classeId) {
                        console.warn("\u26A0\uFE0F  Classe " + enrollment.classe + " non trouv\u00E9e");
                        return [3 /*break*/, 9];
                    }
                    _a = 0, _b = enrollment.studentUsernames;
                    _c.label = 5;
                case 5:
                    if (!(_a < _b.length)) return [3 /*break*/, 9];
                    studentUsername = _b[_a];
                    studentId = studentMap.get(studentUsername);
                    if (!studentId) {
                        console.warn("\u26A0\uFE0F  \u00C9tudiant " + studentUsername + " non trouv\u00E9");
                        return [3 /*break*/, 8];
                    }
                    return [4 /*yield*/, prisma_1["default"].classEnrollment.findFirst({
                            where: {
                                schoolYearId: schoolYearId,
                                studentId: studentId
                            }
                        })];
                case 6:
                    existingEnrollment = _c.sent();
                    if (!!existingEnrollment) return [3 /*break*/, 8];
                    return [4 /*yield*/, prisma_1["default"].classEnrollment.create({
                            data: {
                                schoolYearId: schoolYearId,
                                classeId: classeId,
                                studentId: studentId,
                                statusEnrollment: true
                            }
                        })];
                case 7:
                    _c.sent();
                    createdCount++;
                    _c.label = 8;
                case 8:
                    _a++;
                    return [3 /*break*/, 5];
                case 9:
                    _i++;
                    return [3 /*break*/, 4];
                case 10:
                    console.log("\u2705 " + createdCount + " inscriptions cr\u00E9\u00E9es");
                    return [2 /*return*/];
            }
        });
    });
}
exports.initClassEnrollments = initClassEnrollments;
function clearClassEnrollments() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🗑️  Suppression des inscriptions...");
                    return [4 /*yield*/, prisma_1["default"].classEnrollment.deleteMany({})];
                case 1:
                    _a.sent();
                    console.log("✅ Inscriptions supprimées");
                    return [2 /*return*/];
            }
        });
    });
}
exports.clearClassEnrollments = clearClassEnrollments;
