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
exports.clearTypeFrais = exports.initTypeFrais = exports.typeFraisData = void 0;
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
exports.typeFraisData = [
    {
        codeType: "SCOL",
        nameType: "Frais de Scolarité",
        description: "Frais de scolarité annuels ou mensuels",
        statusType: true
    },
    {
        codeType: "INSC",
        nameType: "Frais d'Inscription",
        description: "Frais d'inscription en début d'année",
        statusType: true
    },
    {
        codeType: "EXAM",
        nameType: "Frais d'Examen",
        description: "Frais pour les examens de fin d'année",
        statusType: true
    },
    {
        codeType: "TENUE",
        nameType: "Frais de Tenue",
        description: "Frais pour l'uniforme scolaire",
        statusType: true
    },
    {
        codeType: "FOURNI",
        nameType: "Frais de Fournitures",
        description: "Frais pour les fournitures scolaires",
        statusType: true
    },
    {
        codeType: "BIBLIO",
        nameType: "Frais de Bibliothèque",
        description: "Frais d'accès à la bibliothèque",
        statusType: true
    },
    {
        codeType: "LABO",
        nameType: "Frais de Laboratoire",
        description: "Frais d'utilisation des laboratoires",
        statusType: true
    },
    {
        codeType: "TRANS",
        nameType: "Frais de Transport",
        description: "Frais de transport scolaire",
        statusType: true
    },
    {
        codeType: "CANTINE",
        nameType: "Frais de Cantine",
        description: "Frais de restauration scolaire",
        statusType: true
    },
    {
        codeType: "ACTIVITE",
        nameType: "Frais d'Activités",
        description: "Frais pour les activités extra-scolaires",
        statusType: true
    }
];
function initTypeFrais() {
    return __awaiter(this, void 0, void 0, function () {
        var _i, typeFraisData_1, typeFrais;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('💰 Initialisation des types de frais...');
                    _i = 0, typeFraisData_1 = exports.typeFraisData;
                    _a.label = 1;
                case 1:
                    if (!(_i < typeFraisData_1.length)) return [3 /*break*/, 4];
                    typeFrais = typeFraisData_1[_i];
                    return [4 /*yield*/, prisma.typeFrais.upsert({
                            where: { codeType: typeFrais.codeType },
                            update: typeFrais,
                            create: typeFrais
                        })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("\u2705 " + exports.typeFraisData.length + " types de frais cr\u00E9\u00E9s");
                    return [2 /*return*/];
            }
        });
    });
}
exports.initTypeFrais = initTypeFrais;
function clearTypeFrais() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🗑️  Suppression des types de frais...');
                    return [4 /*yield*/, prisma.typeFrais.deleteMany({})];
                case 1:
                    _a.sent();
                    console.log('✅ Types de frais supprimés');
                    return [2 /*return*/];
            }
        });
    });
}
exports.clearTypeFrais = clearTypeFrais;
