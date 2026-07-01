import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: "243844952966",
          type: "template",
          template: {
            name: "hello_world", // ⚠️ PAS "hello_world kilem"
            language: { code: "en_US" },
          },
        }),
      },
    );

    const data = await res.json();

    console.log("WHATSAPP RESPONSE:", data);

    return NextResponse.json(data);
  } catch (err) {
    console.error("ERROR:", err);
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
