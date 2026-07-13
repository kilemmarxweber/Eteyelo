"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
exports.generauxConfig = exports.drawMatiere = exports.drawSubjectRow = exports.drawSemesterRow1 = exports.drawCell1 = exports.computeTotSem2 = exports.computeTotSem1 = exports.canShowTot2 = exports.canShowTot1 = exports.canShowPeriod = exports.periodKeyDefinitions = exports.getPlaceValue = exports.getLastValue = exports.SEM_ORDER = exports.periodKeyMap = exports.formatOrdinalFR = void 0;
function formatOrdinalFR(rank, total) {
    var suffix;
    if (rank === 1) {
        suffix = "e"; // "1e"
    }
    else {
        suffix = "è"; // 2è, 3è, etc.
    }
    return "" + rank + suffix + "/" + total;
}
exports.formatOrdinalFR = formatOrdinalFR;
exports.periodKeyMap = {
    "1st Period": "p1",
    "2nd Period": "p2",
    "Exam 1st semester": "exam1",
    "3tr Period": "p3",
    "4th Period": "p4",
    "Exam 2nd semester": "exam2"
};
exports.SEM_ORDER = {
    sem1: ["p1", "p2", "exam1", "tt1"],
    sem2: ["p3", "p4", "exam2", "tt2"]
};
function getLastValue(semObj, order, currentKey) {
    var index = order.indexOf(currentKey);
    if (index === -1)
        return "-";
    for (var i = index; i >= 0; i--) {
        var key = order[i];
        var value = semObj[key];
        if (value && value !== "")
            return value;
    }
    return "-";
}
exports.getLastValue = getLastValue;
// --- Exemple pour un étudiant ---
function getPlaceValue(student, selectedPeriod) {
    // 1️⃣ Déterminer la clé de la période sélectionnée
    var selectedKey = exports.periodKeyMap[selectedPeriod];
    if (!selectedKey)
        return "-";
    // 2️⃣ Déterminer le semestre
    var semester = selectedKey === "p1" || selectedKey === "p2" ? "sem1" : "sem2";
    // 3️⃣ Filtrer toutes les périodes jusqu'à la sélection
    var activePeriods = student.periods.filter(function (p) {
        var pKey = exports.periodKeyMap[p.periodName];
        if (!pKey)
            return false;
        // ne garder que les périodes dans le même semestre et avant ou égales à la sélection
        var order = exports.SEM_ORDER[semester].filter(function (k) { return k !== "tt1" && k !== "tt2"; });
        return order.indexOf(pKey) <= order.indexOf(selectedKey);
    });
    // 4️⃣ Parcourir toutes ces périodes pour récupérer la dernière valeur non vide
    var placeValue = "-";
    for (var _i = 0, activePeriods_1 = activePeriods; _i < activePeriods_1.length; _i++) {
        var p = activePeriods_1[_i];
        var autresData = p.autres;
        var pKey = exports.periodKeyMap[p.periodName];
        if (!pKey)
            continue;
        var semObj = autresData["POURCENTAGES"][semester];
        // getLastValue parcourt l'ordre sem1 ou sem2 pour trouver la dernière valeur non vide jusqu'à pKey
        var order = exports.SEM_ORDER[semester].filter(function (k) { return k !== "tt1" && k !== "tt2"; });
        var last = getLastValue(semObj, order, pKey);
        if (last && last !== "-")
            placeValue = last; // garder la dernière valeur non vide
    }
    return placeValue;
}
exports.getPlaceValue = getPlaceValue;
// Define period keys and semester mapping
exports.periodKeyDefinitions = {
    p1: "sem1",
    p2: "sem1",
    exam1: "sem1",
    p3: "sem2",
    p4: "sem2",
    exam2: "sem2"
};
function canShowPeriod(sem, key, active) {
    // --- SEMESTRE 1 ---
    if (sem === "sem1") {
        // Dès qu'on est en semestre 2 → tout sem1 visible
        if (active.some(function (k) { return ["p3", "p4"].includes(k); }))
            return true;
        // Exam 1er semestre → tout sem1 visible
        if (active.includes("exam1"))
            return true;
        // Sinon cumul progressif
        if (key === "p1")
            return active.includes("p1");
        if (key === "p2")
            return active.includes("p2");
        if (key === "exam1")
            return false;
        return false;
    }
    // --- SEMESTRE 2 ---
    if (sem === "sem2") {
        if (key === "p3")
            return active.includes("p3");
        if (key === "p4")
            return active.includes("p4");
        if (key === "exam2")
            return active.includes("exam2");
    }
    return false;
}
exports.canShowPeriod = canShowPeriod;
function canShowTot1(active) {
    // tant qu'on est uniquement en p1 ou p2 → pas visible
    return active.some(function (k) { return ["exam1", "p3", "p4"].includes(k); });
}
exports.canShowTot1 = canShowTot1;
function canShowTot2(active) {
    return active.some(function (k) { return ["exam2"].includes(k); });
}
exports.canShowTot2 = canShowTot2;
function computeTotSem1(subject, active) {
    var total = 0;
    if (canShowPeriod("sem1", "p1", active)) {
        total += subject.sem1.p1 || 0;
    }
    if (canShowPeriod("sem1", "p2", active)) {
        total += subject.sem1.p2 || 0;
    }
    if (canShowPeriod("sem1", "exam1", active)) {
        total += subject.sem1.exam1 || 0;
    }
    return total;
}
exports.computeTotSem1 = computeTotSem1;
function computeTotSem2(subject, active) {
    var total = 0;
    if (canShowPeriod("sem2", "p3", active)) {
        total += subject.sem2.p3 || 0;
    }
    if (canShowPeriod("sem2", "p4", active)) {
        total += subject.sem2.p4 || 0;
    }
    if (canShowPeriod("sem2", "exam2", active)) {
        total += subject.sem2.exam2 || 0;
    }
    return total;
}
exports.computeTotSem2 = computeTotSem2;
function drawCell1(doc, x, y, w, h, text, options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var palette = {
        black: [0, 0, 0],
        white: [255, 255, 255],
        red: [255, 0, 0],
        blue: [0, 0, 255],
        green: [0, 128, 0],
        yellow: [255, 255, 0],
        gray: [128, 128, 128]
    };
    var align = (_a = options === null || options === void 0 ? void 0 : options.align) !== null && _a !== void 0 ? _a : "center";
    var isMaxima = (_b = options === null || options === void 0 ? void 0 : options.isMaxima) !== null && _b !== void 0 ? _b : false;
    var textColor = palette[(_c = options === null || options === void 0 ? void 0 : options.color) !== null && _c !== void 0 ? _c : "black"];
    var fillColor = palette[(_d = options === null || options === void 0 ? void 0 : options.fill) !== null && _d !== void 0 ? _d : "white"];
    if (isMaxima) {
        textColor = palette.white;
        fillColor = palette.black;
    }
    doc.setFillColor.apply(doc, fillColor);
    doc.setTextColor.apply(doc, textColor);
    // fond
    doc.rect(x, y, w, h, "F");
    var borders = (_e = options === null || options === void 0 ? void 0 : options.borders) !== null && _e !== void 0 ? _e : {};
    if ((_f = borders.top) !== null && _f !== void 0 ? _f : true)
        doc.line(x, y, x + w, y);
    if ((_g = borders.bottom) !== null && _g !== void 0 ? _g : true)
        doc.line(x, y + h, x + w, y + h);
    if ((_h = borders.left) !== null && _h !== void 0 ? _h : true)
        doc.line(x, y, x, y + h);
    if ((_j = borders.right) !== null && _j !== void 0 ? _j : true)
        doc.line(x + w, y, x + w, y + h);
    var textX = x + w / 2;
    if (align === "left")
        textX = x + 2;
    if (align === "right")
        textX = x + w - 2;
    doc.text(text, textX, y + h / 2, {
        align: align,
        baseline: "middle"
    });
}
exports.drawCell1 = drawCell1;
function drawSemesterRow1(doc, y, sem1, sem2, config) {
    var colPos = config.colPos, shiftX = config.shiftX, sem1PeriodWidths = config.sem1PeriodWidths, sem2PeriodWidths = config.sem2PeriodWidths, sem1SubWidths = config.sem1SubWidths, sem2SubWidths = config.sem2SubWidths, totX1 = config.totX1, totX2 = config.totX2, examX1 = config.examX1, examX2 = config.examX2, maximaHeight = config.maximaHeight;
    var values = [
        [colPos[1] + shiftX, sem1PeriodWidths[0], sem1 === null || sem1 === void 0 ? void 0 : sem1.p1],
        [colPos[1] + shiftX + sem1PeriodWidths[0], sem1PeriodWidths[1], sem1 === null || sem1 === void 0 ? void 0 : sem1.p2],
        [totX1, sem1SubWidths[1], sem1 === null || sem1 === void 0 ? void 0 : sem1.exam1],
        [examX1, sem1SubWidths[2], sem1 === null || sem1 === void 0 ? void 0 : sem1.tt1],
        [colPos[2] + shiftX, sem2PeriodWidths[0], sem2 === null || sem2 === void 0 ? void 0 : sem2.p3],
        [colPos[2] + shiftX + sem2PeriodWidths[0], sem2PeriodWidths[1], sem2 === null || sem2 === void 0 ? void 0 : sem2.p4],
        [totX2, sem2SubWidths[1], sem2 === null || sem2 === void 0 ? void 0 : sem2.exam2],
        [examX2, sem2SubWidths[2], sem2 === null || sem2 === void 0 ? void 0 : sem2.tt2],
    ];
    values.forEach(function (_a) {
        var x = _a[0], w = _a[1], value = _a[2];
        drawCell1(doc, x, y, w, maximaHeight, String(value !== null && value !== void 0 ? value : ""), {
            isMaxima: true
        });
    });
}
exports.drawSemesterRow1 = drawSemesterRow1;
function drawSubjectRow(drawCell, yPosBlocs, shiftX, colPos, colWidths, sem1PeriodWidths, sem2PeriodWidths, sem1SubWidths, sem2SubWidths, totX1, examX1, totX2, examX2, maximaHeight, subject, autresByPeriod, generalesMaximaSem1P1, generalesMaximaSem1P2, generalesMaximaTot1, generalesMaximaSem2P3, generalesMaximaSem2P4, generalesMaximaTot2, getColorPourcentage, safeStr, isGeneraux) {
    /* --------------------------------------------------------- */
    /* LIGNES SPECIALES (PLACE / APPLICATIONS / CONDUITE) */
    /* --------------------------------------------------------- */
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26;
    var specialRows = ["APPLICATIONS", "CONDUITE"];
    if (isGeneraux && specialRows.includes(subject.name)) {
        var key_1 = subject.name;
        drawCell(colPos[0] + shiftX, yPosBlocs, colWidths[0], maximaHeight, key_1, false, "left");
        /* Semestre 1 périodes */
        [0, 1].forEach(function (i) {
            var _a, _b, _c;
            drawCell(colPos[1] +
                shiftX +
                sem1PeriodWidths.slice(0, i).reduce(function (a, b) { return a + b; }, 0), yPosBlocs, sem1PeriodWidths[i], maximaHeight, (_c = (_b = (_a = autresByPeriod["p" + (i + 1)]) === null || _a === void 0 ? void 0 : _a[key_1]) === null || _b === void 0 ? void 0 : _b.sem1) === null || _c === void 0 ? void 0 : _c["p" + (i + 1)], false, "center");
        });
        /* Semestre 1 exam */
        drawCell(totX1, yPosBlocs, sem1SubWidths[1], maximaHeight, "", false, "center", { text: "black", fill: "black" });
        /* Semestre 1 total */
        drawCell(examX1, yPosBlocs, sem1SubWidths[2], maximaHeight, (_d = (_c = (_b = (_a = autresByPeriod["exam1"]) === null || _a === void 0 ? void 0 : _a[key_1]) === null || _b === void 0 ? void 0 : _b.sem1) === null || _c === void 0 ? void 0 : _c.tt1) !== null && _d !== void 0 ? _d : "", false, "center", { text: "black", fill: "black" });
        /* Semestre 2 périodes */
        [2, 3].forEach(function (i, idx) {
            var _a, _b, _c;
            drawCell(colPos[2] +
                shiftX +
                sem2PeriodWidths.slice(0, idx).reduce(function (a, b) { return a + b; }, 0), yPosBlocs, sem2PeriodWidths[idx], maximaHeight, (_c = (_b = (_a = autresByPeriod["p" + (i + 1)]) === null || _a === void 0 ? void 0 : _a[key_1]) === null || _b === void 0 ? void 0 : _b.sem2) === null || _c === void 0 ? void 0 : _c["p" + (i + 1)], false, "center");
        });
        /* Semestre 2 exam */
        drawCell(totX2, yPosBlocs, sem2SubWidths[1], maximaHeight, "", false, "center", { text: "black", fill: "black" });
        /* Semestre 2 total */
        drawCell(examX2, yPosBlocs, sem2SubWidths[2], maximaHeight, (_h = (_g = (_f = (_e = autresByPeriod["exam2"]) === null || _e === void 0 ? void 0 : _e[key_1]) === null || _f === void 0 ? void 0 : _f.sem2) === null || _g === void 0 ? void 0 : _g.tt2) !== null && _h !== void 0 ? _h : "", false, "center", { text: "black", fill: "black" });
        /* Total général */
        drawCell(colPos[3] + shiftX, yPosBlocs, colWidths[3], maximaHeight, (_m = (_l = (_k = (_j = autresByPeriod["exam2"]) === null || _j === void 0 ? void 0 : _j[key_1]) === null || _k === void 0 ? void 0 : _k.sem2) === null || _l === void 0 ? void 0 : _l.tg) !== null && _m !== void 0 ? _m : "", false, "center", { text: "black", fill: "black" });
        drawCell(colPos[4] + shiftX, yPosBlocs, colWidths[4], maximaHeight, "", false, "center", { text: "black", fill: "black" });
        drawCell(colPos[5] + shiftX, yPosBlocs, 4, maximaHeight, "", true, "center", { text: "white", fill: "white" }, { top: false, bottom: true, left: true, right: false });
        return yPosBlocs + maximaHeight;
    }
    /* --------------------------------------------------------- */
    /* SIGNATURE PARENTS */
    /* --------------------------------------------------------- */
    if (isGeneraux && subject.name === "PLACE/NOMBRE D'ELEVES") {
        var key_2 = subject.name;
        drawCell(colPos[0] + shiftX, yPosBlocs, colWidths[0], maximaHeight, subject.name, false, "left");
        /* Semestre 1 périodes */
        [0, 1].forEach(function (i) {
            var _a, _b, _c;
            drawCell(colPos[1] +
                shiftX +
                sem1PeriodWidths.slice(0, i).reduce(function (a, b) { return a + b; }, 0), yPosBlocs, sem1PeriodWidths[i], maximaHeight, (_c = (_b = (_a = autresByPeriod["p" + (i + 1)]) === null || _a === void 0 ? void 0 : _a[key_2]) === null || _b === void 0 ? void 0 : _b.sem1) === null || _c === void 0 ? void 0 : _c["p" + (i + 1)], false, "center");
        });
        var sem1ExamStr_1 = safeStr((_q = (_p = (_o = autresByPeriod["exam1"]) === null || _o === void 0 ? void 0 : _o[key_2]) === null || _p === void 0 ? void 0 : _p.sem1) === null || _q === void 0 ? void 0 : _q.exam1);
        drawCell(totX1, yPosBlocs, sem1SubWidths[1], maximaHeight, sem1ExamStr_1, false, "center", {
            text: "black",
            fill: "black"
        });
        var sem1TotStr_1 = safeStr((_t = (_s = (_r = autresByPeriod["exam1"]) === null || _r === void 0 ? void 0 : _r[key_2]) === null || _s === void 0 ? void 0 : _s.sem1) === null || _t === void 0 ? void 0 : _t.tt1);
        drawCell(examX1, yPosBlocs, sem1SubWidths[2], maximaHeight, sem1TotStr_1, false, "center", {
            text: "black",
            fill: "white"
        });
        for (var i = 0; i < 2; i++) {
            var periodKey = "p" + (i + 3); // p3, p4
            var valStr = safeStr((_w = (_v = (_u = autresByPeriod[periodKey]) === null || _u === void 0 ? void 0 : _u[key_2]) === null || _v === void 0 ? void 0 : _v.sem2) === null || _w === void 0 ? void 0 : _w[periodKey]);
            var valNum = parseInt(valStr) || 0;
            var max = i === 0 ? generalesMaximaSem2P3 : generalesMaximaSem2P4;
            drawCell(colPos[2] +
                shiftX +
                sem2PeriodWidths.slice(0, i).reduce(function (a, b) { return a + b; }, 0), yPosBlocs, sem2PeriodWidths[i], maximaHeight, valStr, false, "center", {
                text: "Black",
                fill: "white"
            });
        }
        var sem2ExamStr_1 = safeStr((_z = (_y = (_x = autresByPeriod["exam2"]) === null || _x === void 0 ? void 0 : _x[key_2]) === null || _y === void 0 ? void 0 : _y.sem2) === null || _z === void 0 ? void 0 : _z.exam2);
        drawCell(totX2, yPosBlocs, sem2SubWidths[1], maximaHeight, sem2ExamStr_1, false, "center", {
            text: "black",
            fill: "black"
        });
        var sem2TotStr_1 = safeStr((_2 = (_1 = (_0 = autresByPeriod["exam2"]) === null || _0 === void 0 ? void 0 : _0[key_2]) === null || _1 === void 0 ? void 0 : _1.sem2) === null || _2 === void 0 ? void 0 : _2.tt2);
        drawCell(examX2, yPosBlocs, sem2SubWidths[2], maximaHeight, sem2TotStr_1, false, "center", {
            text: "black",
            fill: "white"
        });
        var sem2GenStr_1 = safeStr((_5 = (_4 = (_3 = autresByPeriod["exam2"]) === null || _3 === void 0 ? void 0 : _3[key_2]) === null || _4 === void 0 ? void 0 : _4.sem2) === null || _5 === void 0 ? void 0 : _5.tg);
        var sem2GenNum_1 = parseInt(sem2GenStr_1) || 0;
        drawCell(colPos[3] + shiftX, yPosBlocs, colWidths[3], maximaHeight, sem2GenStr_1, false, "center", {
            text: "black",
            fill: "white"
        });
        drawCell(colPos[4] + shiftX, yPosBlocs, colWidths[4], maximaHeight, "", false, "center");
        drawCell(colPos[5] + shiftX, yPosBlocs, 4, maximaHeight, "", true, "center", { text: "white", fill: "white" }, { top: false, bottom: true, left: true, right: false });
        return yPosBlocs + maximaHeight;
    }
    /* --------------------------------------------------------- */
    /* SIGNATURE PARENTS */
    /* --------------------------------------------------------- */
    if (isGeneraux && subject.name === "SIGNATURE PARENTS") {
        drawCell(colPos[0] + shiftX, yPosBlocs, colWidths[0], maximaHeight, subject.name, false, "left");
        var blank = { text: "white", fill: "white" };
        var borders = {
            top: true,
            bottom: true,
            left: false,
            right: false
        };
        drawCell(colPos[1] + shiftX, yPosBlocs, sem1PeriodWidths[0], maximaHeight, "", false, "center", blank, __assign(__assign({}, borders), { left: true }));
        drawCell(colPos[1] + shiftX + sem1PeriodWidths[0], yPosBlocs, sem1PeriodWidths[1], maximaHeight, "", false, "center", blank, borders);
        drawCell(totX1, yPosBlocs, sem1SubWidths[1], maximaHeight, "", false, "center", blank, borders);
        drawCell(examX1, yPosBlocs, sem1SubWidths[2], maximaHeight, "", false, "center", blank, borders);
        drawCell(colPos[2] + shiftX, yPosBlocs, sem2PeriodWidths[0], maximaHeight, "", false, "center", blank, __assign(__assign({}, borders), { left: true }));
        drawCell(colPos[2] + shiftX + sem2PeriodWidths[0], yPosBlocs, sem2PeriodWidths[1], maximaHeight, "", false, "center", blank, borders);
        drawCell(totX2, yPosBlocs, sem2SubWidths[1], maximaHeight, "", false, "center", blank, borders);
        drawCell(examX2, yPosBlocs, sem2SubWidths[2], maximaHeight, "", false, "center", blank, borders);
        drawCell(colPos[3] + shiftX, yPosBlocs, colWidths[3], maximaHeight, "", false, "center", blank, borders);
        drawCell(colPos[4] + shiftX, yPosBlocs, colWidths[4], maximaHeight, "", false, "center", blank, borders);
        drawCell(colPos[5] + shiftX, yPosBlocs, 4, maximaHeight, "", true, "center", blank, { top: false, bottom: true, left: true, right: false });
        drawCell(colPos[6] + shiftX, yPosBlocs, 34.1, maximaHeight, "", false, "center", blank, { top: false, bottom: true, left: true, right: true });
        return yPosBlocs + maximaHeight;
    }
    /* --------------------------------------------------------- */
    /* CAS NORMAL (TOTAUX / POURCENTAGES) */
    /* --------------------------------------------------------- */
    var isPercentage = isGeneraux && subject.name === "POURCENTAGES";
    var dataKey = isPercentage ? "POURCENTAGES" : "TOTAUX";
    drawCell(colPos[0] + shiftX, yPosBlocs, colWidths[0], maximaHeight, subject.name, false, "left");
    for (var i = 0; i < 2; i++) {
        var valStr = safeStr((_8 = (_7 = (_6 = autresByPeriod["p" + (i + 1)]) === null || _6 === void 0 ? void 0 : _6[dataKey]) === null || _7 === void 0 ? void 0 : _7.sem1) === null || _8 === void 0 ? void 0 : _8["p" + (i + 1)]);
        var valNum = parseInt(valStr) || 0;
        var max = i === 0 ? generalesMaximaSem1P1 : generalesMaximaSem1P2;
        drawCell(colPos[1] +
            shiftX +
            sem1PeriodWidths.slice(0, i).reduce(function (a, b) { return a + b; }, 0), yPosBlocs, sem1PeriodWidths[i], maximaHeight, valStr, false, "center", {
            text: getColorPourcentage(valNum, isPercentage ? "percentage" : "score", max),
            fill: "white"
        });
    }
    var sem1ExamStr = safeStr((_11 = (_10 = (_9 = autresByPeriod["exam1"]) === null || _9 === void 0 ? void 0 : _9[dataKey]) === null || _10 === void 0 ? void 0 : _10.sem1) === null || _11 === void 0 ? void 0 : _11.exam1);
    drawCell(totX1, yPosBlocs, sem1SubWidths[1], maximaHeight, sem1ExamStr, false, "center", {
        text: "black",
        fill: "black"
    });
    var sem1TotStr = safeStr((_14 = (_13 = (_12 = autresByPeriod["exam1"]) === null || _12 === void 0 ? void 0 : _12[dataKey]) === null || _13 === void 0 ? void 0 : _13.sem1) === null || _14 === void 0 ? void 0 : _14.tt1);
    drawCell(examX1, yPosBlocs, sem1SubWidths[2], maximaHeight, sem1TotStr, false, "center", {
        text: "black",
        fill: "white"
    });
    for (var i = 0; i < 2; i++) {
        var periodKey = "p" + (i + 3); // p3, p4
        var valStr = safeStr((_17 = (_16 = (_15 = autresByPeriod[periodKey]) === null || _15 === void 0 ? void 0 : _15[dataKey]) === null || _16 === void 0 ? void 0 : _16.sem2) === null || _17 === void 0 ? void 0 : _17[periodKey]);
        var valNum = parseInt(valStr) || 0;
        var max = i === 0 ? generalesMaximaSem2P3 : generalesMaximaSem2P4;
        drawCell(colPos[2] +
            shiftX +
            sem2PeriodWidths.slice(0, i).reduce(function (a, b) { return a + b; }, 0), yPosBlocs, sem2PeriodWidths[i], maximaHeight, valStr, false, "center", {
            text: getColorPourcentage(valNum, isPercentage ? "percentage" : "score", max),
            fill: "white"
        });
    }
    var sem2ExamStr = safeStr((_20 = (_19 = (_18 = autresByPeriod["exam2"]) === null || _18 === void 0 ? void 0 : _18[dataKey]) === null || _19 === void 0 ? void 0 : _19.sem2) === null || _20 === void 0 ? void 0 : _20.exam2);
    drawCell(totX2, yPosBlocs, sem2SubWidths[1], maximaHeight, sem2ExamStr, false, "center", {
        text: "black",
        fill: "black"
    });
    var sem2TotStr = safeStr((_23 = (_22 = (_21 = autresByPeriod["exam2"]) === null || _21 === void 0 ? void 0 : _21[dataKey]) === null || _22 === void 0 ? void 0 : _22.sem2) === null || _23 === void 0 ? void 0 : _23.tt2);
    drawCell(examX2, yPosBlocs, sem2SubWidths[2], maximaHeight, sem2TotStr, false, "center", {
        text: "black",
        fill: "white"
    });
    var sem2GenStr = safeStr((_26 = (_25 = (_24 = autresByPeriod["exam2"]) === null || _24 === void 0 ? void 0 : _24[dataKey]) === null || _25 === void 0 ? void 0 : _25.sem2) === null || _26 === void 0 ? void 0 : _26.tg);
    var sem2GenNum = parseInt(sem2GenStr) || 0;
    drawCell(colPos[3] + shiftX, yPosBlocs, colWidths[3], maximaHeight, sem2GenStr, false, "center", {
        text: getColorPourcentage(sem2GenNum, isPercentage ? "percentage" : "score", generalesMaximaTot1 + generalesMaximaTot2),
        fill: "white"
    });
    drawCell(colPos[4] + shiftX, yPosBlocs, colWidths[4], maximaHeight, "", false, "center");
    drawCell(colPos[5] + shiftX, yPosBlocs, 4, maximaHeight, "", true, "center", { text: "white", fill: "white" }, { top: false, bottom: true, left: true, right: false });
    return yPosBlocs + maximaHeight;
}
exports.drawSubjectRow = drawSubjectRow;
var getColorPourcentage = function (value, type, maxValue) {
    if (type === "percentage") {
        return value < 50 ? "red" : "black";
    }
    if (!maxValue)
        return "black";
    return value < maxValue / 2 ? "red" : "black";
};
function drawMatiere(drawCell, yPosBlocs, shiftX, colPos, colWidths, sem1PeriodWidths, sem2PeriodWidths, sem1SubWidths, sem2SubWidths, totX1, examX1, totX2, examX2, maximaHeight, subject, activePeriodKeys, getColor, computeTotSem1, computeTotSem2, canShowTot1, canShowTot2, maximaTot1, maximaTot2, maximaTG) {
    /* ------------------ NOM MATIERE ------------------ */
    drawCell(colPos[0] + shiftX, yPosBlocs, colWidths[0], maximaHeight, subject.name.toUpperCase(), false, "left");
    /* ------------------ SEMESTRE 1 ------------------ */
    var getVal = function (key, val) {
        return activePeriodKeys.includes(key) && val !== 0 ? String(val) : "";
    };
    drawCell(colPos[1] + shiftX, yPosBlocs, sem1PeriodWidths[0], maximaHeight, getVal("p1", subject.sem1.p1), false, "center", {
            text: getColor(subject.sem1.p1, "score", subject.maxima && subject.maxima.p1 || subject.baseMaxScore),
        fill: "white"
    });
    drawCell(colPos[1] + shiftX + sem1PeriodWidths[0], yPosBlocs, sem1PeriodWidths[1], maximaHeight, getVal("p2", subject.sem1.p2), false, "center", {
            text: getColor(subject.sem1.p2, "score", subject.maxima && subject.maxima.p2 || subject.baseMaxScore),
        fill: "white"
    });
    drawCell(totX1, yPosBlocs, sem1SubWidths[1], maximaHeight, getVal("exam1", subject.sem1.exam1), false, "center", {
            text: getColor(subject.sem1.exam1, "score", subject.maxima && subject.maxima.exam1 || subject.baseMaxScore * 2),
        fill: "white"
    });
    var tt1TotalScore = computeTotSem1(subject, activePeriodKeys);
    drawCell(examX1, yPosBlocs, sem1SubWidths[2], maximaHeight, canShowTot1(activePeriodKeys) && tt1TotalScore !== 0
        ? String(tt1TotalScore)
        : "", false, "center", {
        text: getColor(tt1TotalScore, "score", maximaTot1),
        fill: "white"
    });
    /* ------------------ SEMESTRE 2 ------------------ */
    drawCell(colPos[2] + shiftX, yPosBlocs, sem2PeriodWidths[0], maximaHeight, getVal("p3", subject.sem2.p3), false, "center", {
            text: getColor(subject.sem2.p3, "score", subject.maxima && subject.maxima.p3 || subject.baseMaxScore),
        fill: "white"
    });
    drawCell(colPos[2] + shiftX + sem2PeriodWidths[0], yPosBlocs, sem2PeriodWidths[1], maximaHeight, getVal("p4", subject.sem2.p4), false, "center", {
            text: getColor(subject.sem2.p4, "score", subject.maxima && subject.maxima.p4 || subject.baseMaxScore),
        fill: "white"
    });
    drawCell(totX2, yPosBlocs, sem2SubWidths[1], maximaHeight, getVal("exam2", subject.sem2.exam2), false, "center", {
            text: getColor(subject.sem2.exam2, "score", subject.maxima && subject.maxima.exam2 || subject.baseMaxScore * 2),
        fill: "white"
    });
    var tt2TotalScore = computeTotSem2(subject, activePeriodKeys);
    drawCell(examX2, yPosBlocs, sem2SubWidths[2], maximaHeight, canShowTot2(activePeriodKeys) && tt2TotalScore !== 0
        ? String(tt2TotalScore)
        : "", false, "center", {
        text: getColor(tt2TotalScore, "score", maximaTot2),
        fill: "white"
    });
    /* ------------------ TOTAL GENERAL ------------------ */
    var tgTotalScore = tt1TotalScore > 0 &&
        tt2TotalScore > 0 &&
        canShowTot1(activePeriodKeys) &&
        canShowTot2(activePeriodKeys)
        ? tt1TotalScore + tt2TotalScore
        : 0;
    drawCell(colPos[3] + shiftX, yPosBlocs, colWidths[3], maximaHeight, tgTotalScore !== 0 ? String(tgTotalScore) : "", false, "center", {
        text: getColor(tgTotalScore, "score", maximaTG),
        fill: "white"
    });
    /* ------------------ COLONNES VIDES ------------------ */
    drawCell(colPos[4] + shiftX, yPosBlocs, colWidths[4], maximaHeight, "", false);
    drawCell(colPos[5] + shiftX, yPosBlocs, 16, maximaHeight, "", true, "left");
    drawCell(colPos[6] + shiftX, yPosBlocs, 13, maximaHeight, "", false, "left");
    drawCell(colPos[7] - 2, yPosBlocs, 21, maximaHeight, "", false, "center", { text: "white", fill: "white" }, { top: true, bottom: true, left: true, right: true });
    return yPosBlocs + maximaHeight;
}
exports.drawMatiere = drawMatiere;
exports.generauxConfig = {
    TOTAUX: {
        getColor: getColorPourcentage,
        isGeneraux: false
    },
    POURCENTAGES: {
        getColor: getColorPourcentage,
        isGeneraux: true
    },
    "PLACE/NOMBRE D'ELEVES": {
        getColor: getColorPourcentage,
        isGeneraux: true
    },
    APPLICATIONS: {
        getColor: getColorPourcentage,
        isGeneraux: true
    },
    CONDUITE: {
        getColor: getColorPourcentage,
        isGeneraux: true
    },
    "SIGNATURE PARENTS": {
        getColor: getColorPourcentage,
        isGeneraux: true
    }
};
