import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const linkedUserInclude = {
  branchMember: {
    include: {
      member: {
        include: {
          user: true,
        },
      },
    },
  },
};

function getLinkedUser(record: any) {
  return record?.branchMember?.member?.user ?? null;
}

export async function POST(req: Request) {
  try {
    const { classId } = await req.json();

    // ===============================
    // 1. Récupérer étudiants + parents
    // ===============================
    const students = await prisma.student.findMany({
      where: {
        classEnrollment: {
          some: {
            classeId: classId,
          },
        },
      },
      include: {
        parent: { include: linkedUserInclude },
        ...linkedUserInclude,
      },
    });

    // ===============================
    // 2. Transporter EMAIL
    // ===============================
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // ===============================
    // 3. Loop étudiants
    // ===============================
    for (const student of students) {
      const studentUser = getLinkedUser(student);
      const parentUser = getLinkedUser(student.parent);
      const email = parentUser?.email;
      if (!email) continue;

      // ===============================
      // 🔥 REMPLACER PAR TES VRAIES NOTES
      // ===============================
      const results = [
        { subject: "Math", note: 15, total: 20 },
        { subject: "Physique", note: 12, total: 20 },
        { subject: "Anglais", note: 18, total: 20 },
      ];

      let totalNote = 0;
      let totalMax = 0;

      // ===============================
      // TABLE HTML
      // ===============================
      const rows = results
        .map((r) => {
          totalNote += r.note;
          totalMax += r.total;

          const isGood = r.note / r.total >= 0.5;

          return `
            <tr style="background:${isGood ? "#e8f5e9" : "#fdecea"};">
              <td style="padding:10px;border:1px solid #ddd;">${r.subject}</td>
              <td style="padding:10px;border:1px solid #ddd;text-align:center;">
                <strong>${r.note}/${r.total}</strong>
              </td>
            </tr>
          `;
        })
        .join("");

      const percent =
        totalMax > 0 ? ((totalNote / totalMax) * 100).toFixed(1) : "0";

      const isSuccess = Number(percent) >= 50;

      // ===============================
      // EMAIL HTML DESIGN
      // ===============================
      const html = `
      <div style="font-family: Arial, sans-serif; background:#f4f6f9; padding:20px;">
        
        <div style="max-width:600px;margin:auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 5px 15px rgba(0,0,0,0.1);">
          
          <!-- HEADER -->
          <div style="background:linear-gradient(135deg,#4CAF50,#2ECC71);color:white;padding:20px;text-align:center;">
            <h2 style="margin:0;">📊 Bulletin scolaire</h2>
            <p style="margin:5px 0;">${studentUser?.name ?? ""} ${studentUser?.postnom ?? ""}</p>
          </div>

          <!-- TABLE -->
          <div style="padding:20px;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#f1f1f1;">
                  <th style="padding:10px;border:1px solid #ddd;">Matière</th>
                  <th style="padding:10px;border:1px solid #ddd;">Note</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>

            <!-- SUMMARY -->
            <div style="margin-top:20px;text-align:center;">
              <h3 style="margin:5px 0;">Moyenne générale</h3>
              <p style="font-size:24px;font-weight:bold;color:${
                isSuccess ? "#2ecc71" : "#e74c3c"
              };">
                ${percent}%
              </p>
            </div>

            <!-- RESULT BLOCK -->
            ${
              isSuccess
                ? `
              <div style="margin-top:20px;padding:15px;background:#e8f5e9;border-radius:8px;text-align:center;">
                <h3 style="color:#2ecc71;">🎉 Félicitations !</h3>
                <p>L'élève a réussi avec succès. Continuez ainsi 👏</p>
                <img src="https://media.giphy.com/media/111ebonMs90YLu/giphy.gif" width="120" />
              </div>
            `
                : `
              <div style="margin-top:20px;padding:15px;background:#fdecea;border-radius:8px;text-align:center;">
                <h3 style="color:#e74c3c;">⚠️ Encouragement</h3>
                <p>L'élève doit fournir plus d'efforts 💪</p>
              </div>
            `
            }

          </div>

          <!-- FOOTER -->
          <div style="background:#fafafa;padding:10px;text-align:center;font-size:12px;color:#999;">
            © École - Système de gestion scolaire
          </div>

        </div>
      </div>
      `;

      // ===============================
      // ENVOI EMAIL
      // ===============================
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Résultats de ${studentUser?.name ?? ""}`,
        html,
      });

      console.log("EMAIL SENT TO:", email);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("ERROR MAIL:", err);
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
