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
exports.clearUsers = exports.initUsers = exports.usersData = void 0;
var client_1 = require("@prisma/client");
var bcrypt_1 = require("bcrypt");
var prisma = new client_1.PrismaClient();
// Fonction pour hasher les mots de passe
function hashPassword(password) {
    return __awaiter(this, void 0, Promise, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, bcrypt_1["default"].hash(password, 10)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
exports.usersData = [
    // Enseignants
    {
        username: "prof.mukendi",
        email: "mukendi@eteyelo.cd",
        telephone: "+243812345601",
        nom: "Mukendi",
        postnom: "Kabongo",
        prenom: "Jean",
        dateOfBirth: new Date("1985-03-15"),
        sexe: "M",
        password: "Password123!",
        statusUser: true,
        userType: "teacher"
    },
    {
        username: "prof.mbuyi",
        email: "mbuyi@eteyelo.cd",
        telephone: "+243812345602",
        nom: "Mbuyi",
        postnom: "Kalala",
        prenom: "Marie",
        dateOfBirth: new Date("1990-07-22"),
        sexe: "F",
        password: "Password123!",
        statusUser: true,
        userType: "teacher"
    },
    {
        username: "prof.tshimanga",
        email: "tshimanga@eteyelo.cd",
        telephone: "+243812345603",
        nom: "Tshimanga",
        postnom: "Mutombo",
        prenom: "Pierre",
        dateOfBirth: new Date("1982-11-08"),
        sexe: "M",
        password: "Password123!",
        statusUser: true,
        userType: "teacher"
    },
    {
        username: "prof.ndaya",
        email: "ndaya@eteyelo.cd",
        telephone: "+243812345604",
        nom: "Ndaya",
        postnom: "Kilolo",
        prenom: "Brigitte",
        dateOfBirth: new Date("1988-01-30"),
        sexe: "F",
        password: "Password123!",
        statusUser: true,
        userType: "teacher"
    },
    {
        username: "prof.kabila",
        email: "kabila@eteyelo.cd",
        telephone: "+243812345605",
        nom: "Kabila",
        postnom: "Mwamba",
        prenom: "Joseph",
        dateOfBirth: new Date("1979-05-12"),
        sexe: "M",
        password: "Password123!",
        statusUser: true,
        userType: "teacher"
    },
    {
        username: "prof.mpiana",
        email: "mpiana@eteyelo.cd",
        telephone: "+243812345606",
        nom: "Mpiana",
        postnom: "Tshisekedi",
        prenom: "Antoinette",
        dateOfBirth: new Date("1987-09-18"),
        sexe: "F",
        password: "Password123!",
        statusUser: true,
        userType: "teacher"
    },
    // Parents
    {
        username: "parent.kasongo",
        email: "kasongo@parent.cd",
        telephone: "+243812345701",
        nom: "Kasongo",
        postnom: "Mwanza",
        prenom: "André",
        dateOfBirth: new Date("1975-04-20"),
        sexe: "M",
        password: "Password123!",
        statusUser: true,
        userType: "parent"
    },
    {
        username: "parent.kalombo",
        email: "kalombo@parent.cd",
        telephone: "+243812345702",
        nom: "Kalombo",
        postnom: "Ngoy",
        prenom: "Thérèse",
        dateOfBirth: new Date("1978-08-14"),
        sexe: "F",
        password: "Password123!",
        statusUser: true,
        userType: "parent"
    },
    {
        username: "parent.mulumba",
        email: "mulumba@parent.cd",
        telephone: "+243812345703",
        nom: "Mulumba",
        postnom: "Kabongo",
        prenom: "François",
        dateOfBirth: new Date("1972-12-05"),
        sexe: "M",
        password: "Password123!",
        statusUser: true,
        userType: "parent"
    },
    {
        username: "parent.mwamba",
        email: "mwamba@parent.cd",
        telephone: "+243812345704",
        nom: "Mwamba",
        postnom: "Lukoji",
        prenom: "Clémentine",
        dateOfBirth: new Date("1980-02-28"),
        sexe: "F",
        password: "Password123!",
        statusUser: true,
        userType: "parent"
    },
    {
        username: "parent.katanga",
        email: "katanga@parent.cd",
        telephone: "+243812345705",
        nom: "Katanga",
        postnom: "Mujinga",
        prenom: "Daniel",
        dateOfBirth: new Date("1976-06-10"),
        sexe: "M",
        password: "Password123!",
        statusUser: true,
        userType: "parent"
    },
    // Élèves
    {
        username: "eleve.kasongo.junior",
        email: "kasongo.junior@eleve.cd",
        telephone: "+243812345801",
        nom: "Kasongo",
        postnom: "Mwanza",
        prenom: "Junior",
        dateOfBirth: new Date("2007-03-15"),
        sexe: "M",
        password: "Student123!",
        statusUser: true,
        userType: "student"
    },
    {
        username: "eleve.kalombo.grâce",
        email: "kalombo.grace@eleve.cd",
        telephone: "+243812345802",
        nom: "Kalombo",
        postnom: "Ngoy",
        prenom: "Grâce",
        dateOfBirth: new Date("2008-01-22"),
        sexe: "F",
        password: "Student123!",
        statusUser: true,
        userType: "student"
    },
    {
        username: "eleve.mulumba.prince",
        email: "mulumba.prince@eleve.cd",
        telephone: "+243812345803",
        nom: "Mulumba",
        postnom: "Kabongo",
        prenom: "Prince",
        dateOfBirth: new Date("2007-11-08"),
        sexe: "M",
        password: "Student123!",
        statusUser: true,
        userType: "student"
    },
    {
        username: "eleve.mwamba.esther",
        email: "mwamba.esther@eleve.cd",
        telephone: "+243812345804",
        nom: "Mwamba",
        postnom: "Lukoji",
        prenom: "Esther",
        dateOfBirth: new Date("2008-05-30"),
        sexe: "F",
        password: "Student123!",
        statusUser: true,
        userType: "student"
    },
    {
        username: "eleve.katanga.david",
        email: "katanga.david@eleve.cd",
        telephone: "+243812345805",
        nom: "Katanga",
        postnom: "Mujinga",
        prenom: "David",
        dateOfBirth: new Date("2007-09-12"),
        sexe: "M",
        password: "Student123!",
        statusUser: true,
        userType: "student"
    },
    {
        username: "eleve.mukendi.sarah",
        email: "mukendi.sarah@eleve.cd",
        telephone: "+243812345806",
        nom: "Mukendi",
        postnom: "Kabamba",
        prenom: "Sarah",
        dateOfBirth: new Date("2008-07-18"),
        sexe: "F",
        password: "Student123!",
        statusUser: true,
        userType: "student"
    },
    {
        username: "eleve.tshiamala.michel",
        email: "tshiamala.michel@eleve.cd",
        telephone: "+243812345807",
        nom: "Tshiamala",
        postnom: "Ngalula",
        prenom: "Michel",
        dateOfBirth: new Date("2007-12-25"),
        sexe: "M",
        password: "Student123!",
        statusUser: true,
        userType: "student"
    },
    {
        username: "eleve.kabongo.ruth",
        email: "kabongo.ruth@eleve.cd",
        telephone: "+243812345808",
        nom: "Kabongo",
        postnom: "Mputu",
        prenom: "Ruth",
        dateOfBirth: new Date("2008-04-03"),
        sexe: "F",
        password: "Student123!",
        statusUser: true,
        userType: "student"
    },
    {
        username: "eleve.mputu.samuel",
        email: "mputu.samuel@eleve.cd",
        telephone: "+243812345809",
        nom: "Mputu",
        postnom: "Kasadi",
        prenom: "Samuel",
        dateOfBirth: new Date("2007-08-14"),
        sexe: "M",
        password: "Student123!",
        statusUser: true,
        userType: "student"
    },
    {
        username: "eleve.tshilombo.joie",
        email: "tshilombo.joie@eleve.cd",
        telephone: "+243812345810",
        nom: "Tshilombo",
        postnom: "Kapinga",
        prenom: "Joie",
        dateOfBirth: new Date("2008-10-07"),
        sexe: "F",
        password: "Student123!",
        statusUser: true,
        userType: "student"
    },
    // Administrateur
    {
        username: "admin",
        email: "admin@eteyelo.cd",
        telephone: "+243812345900",
        nom: "Administrateur",
        postnom: "Système",
        prenom: "Admin",
        dateOfBirth: new Date("1980-01-01"),
        sexe: "M",
        password: "Admin123!",
        statusUser: true,
        userType: "admin"
    }
];
function initUsers() {
    return __awaiter(this, void 0, void 0, function () {
        var _i, usersData_1, userData, hashedPassword;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('👥 Initialisation des utilisateurs...');
                    _i = 0, usersData_1 = exports.usersData;
                    _a.label = 1;
                case 1:
                    if (!(_i < usersData_1.length)) return [3 /*break*/, 5];
                    userData = usersData_1[_i];
                    return [4 /*yield*/, hashPassword(userData.password)];
                case 2:
                    hashedPassword = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { username: userData.username },
                            update: {
                                email: userData.email,
                                telephone: userData.telephone,
                                nom: userData.nom,
                                postnom: userData.postnom,
                                prenom: userData.prenom,
                                dateOfBirth: userData.dateOfBirth,
                                sexe: userData.sexe,
                                password: hashedPassword,
                                statusUser: userData.statusUser
                            },
                            create: {
                                username: userData.username,
                                email: userData.email,
                                telephone: userData.telephone,
                                nom: userData.nom,
                                postnom: userData.postnom,
                                prenom: userData.prenom,
                                dateOfBirth: userData.dateOfBirth,
                                sexe: userData.sexe,
                                password: hashedPassword,
                                statusUser: userData.statusUser
                            }
                        })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 1];
                case 5:
                    console.log("\u2705 " + exports.usersData.length + " utilisateurs cr\u00E9\u00E9s");
                    return [2 /*return*/];
            }
        });
    });
}
exports.initUsers = initUsers;
function clearUsers() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🗑️  Suppression des utilisateurs...');
                    return [4 /*yield*/, prisma.user.deleteMany({})];
                case 1:
                    _a.sent();
                    console.log('✅ Utilisateurs supprimés');
                    return [2 /*return*/];
            }
        });
    });
}
exports.clearUsers = clearUsers;
