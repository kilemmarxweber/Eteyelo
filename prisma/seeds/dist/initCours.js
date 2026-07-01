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
exports.clearCours = exports.initCours = exports.coursData = void 0;
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
exports.coursData = [
    // Matières de base commune
    {
        codeCours: "FRAN",
        nameCours: "Français",
        description: "Langue française et littérature",
        ponderation: 5,
        statusCours: true
    },
    {
        codeCours: "MATH",
        nameCours: "Mathématiques",
        description: "Mathématiques générales",
        ponderation: 5,
        statusCours: true
    },
    {
        codeCours: "ANG",
        nameCours: "Anglais",
        description: "Langue anglaise",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "HIST",
        nameCours: "Histoire",
        description: "Histoire générale et du Congo",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "GEO",
        nameCours: "Géographie",
        description: "Géographie du Congo et du monde",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "ECM",
        nameCours: "Éducation Civ & Mo",
        description: "Civisme et valeurs morales",
        ponderation: 1,
        statusCours: true
    },
    {
        codeCours: "EPS",
        nameCours: "Éducation Physique",
        description: "Activités sportives et physiques",
        ponderation: 1,
        statusCours: true
    },
    {
        codeCours: "REL",
        nameCours: "Religion",
        description: "Éducation religieuse",
        ponderation: 1,
        statusCours: true
    },
    // Sciences
    {
        codeCours: "PHYS",
        nameCours: "Physique",
        description: "Physique générale",
        ponderation: 4,
        statusCours: true
    },
    {
        codeCours: "CHIM",
        nameCours: "Chimie",
        description: "Chimie générale et organique",
        ponderation: 4,
        statusCours: true
    },
    {
        codeCours: "BIO",
        nameCours: "Biologie",
        description: "Sciences de la vie",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "SCI",
        nameCours: "Sciences",
        description: "Biologie et géologie",
        ponderation: 2,
        statusCours: true
    },
    // Commercial et Gestion
    {
        codeCours: "COMPTA",
        nameCours: "Comptabilité",
        description: "Comptabilité générale et analytique",
        ponderation: 4,
        statusCours: true
    },
    {
        codeCours: "ECO",
        nameCours: "Économie",
        description: "Économie générale et d'entreprise",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "GEST",
        nameCours: "Gestion",
        description: "Gestion d'entreprise",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "DROIT",
        nameCours: "Droit",
        description: "Droit commercial et civil",
        ponderation: 1,
        statusCours: true
    },
    {
        codeCours: "MARK",
        nameCours: "Marketing",
        description: "Techniques de marketing",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "STAT",
        nameCours: "Statistiques",
        description: "Statistiques appliquées",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "ELEC-PRAT",
        nameCours: "Électricité",
        description: "Travaux pratiques d'électricité",
        ponderation: 4,
        statusCours: true
    },
    {
        codeCours: "MECA-PRAT",
        nameCours: "Mécanique",
        description: "Travaux pratiques de mécanique",
        ponderation: 4,
        statusCours: true
    },
    {
        codeCours: "DESSIN-TECH",
        nameCours: "Dessin Technique",
        description: "Dessin industriel et technique",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "TECHNO",
        nameCours: "Technologie",
        description: "Technologie générale",
        ponderation: 2,
        statusCours: true
    },
    // Informatique
    {
        codeCours: "INFO",
        nameCours: "Informatique",
        description: "Initiation à l'informatique",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "PROG",
        nameCours: "Programmation",
        description: "Bases de la programmation",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "RESEAU",
        nameCours: "Réseaux",
        description: "Réseaux informatiques",
        ponderation: 2,
        statusCours: true
    },
    // Lettres et Philosophie
    {
        codeCours: "PHIL",
        nameCours: "Philosophie",
        description: "Philosophie générale",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "LITT",
        nameCours: "Littérature",
        description: "Littérature française et africaine",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "LAT",
        nameCours: "Latin",
        description: "Langue latine",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "LING",
        nameCours: "Lingala",
        description: "Langue nationale lingala",
        ponderation: 2,
        statusCours: true
    },
    // Pédagogique
    {
        codeCours: "PEDAG",
        nameCours: "Pédagogie",
        description: "Sciences de l'éducation",
        ponderation: 4,
        statusCours: true
    },
    {
        codeCours: "PSYCHO",
        nameCours: "Psychologie",
        description: "Psychologie de l'enfant",
        ponderation: 2,
        statusCours: true
    },
    {
        codeCours: "DIDACT",
        nameCours: "Didactique",
        description: "Méthodes d'enseignement",
        ponderation: 1,
        statusCours: true
    },
];
function initCours() {
    return __awaiter(this, void 0, void 0, function () {
        var _i, coursData_1, cours;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("📖 Initialisation des cours...");
                    _i = 0, coursData_1 = exports.coursData;
                    _a.label = 1;
                case 1:
                    if (!(_i < coursData_1.length)) return [3 /*break*/, 4];
                    cours = coursData_1[_i];
                    return [4 /*yield*/, prisma.cours.upsert({
                            where: { codeCours: cours.codeCours },
                            update: cours,
                            create: cours
                        })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("\u2705 " + exports.coursData.length + " cours cr\u00E9\u00E9s");
                    return [2 /*return*/];
            }
        });
    });
}
exports.initCours = initCours;
function clearCours() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🗑️  Suppression des cours...");
                    return [4 /*yield*/, prisma.cours.deleteMany({})];
                case 1:
                    _a.sent();
                    console.log("✅ Cours supprimés");
                    return [2 /*return*/];
            }
        });
    });
}
exports.clearCours = clearCours;
