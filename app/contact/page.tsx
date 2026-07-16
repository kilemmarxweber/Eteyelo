import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import ContactForm from "./contact-form";
import { HomeNavbar } from "@/components/home-navbar";

type ContactPageProps = {
  searchParams: Promise<{ user?: string }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { user } = await searchParams;
  const contactEmail = process.env.SMTP_USER || "";

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <HomeNavbar />

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-between rounded-3xl bg-blue-950 p-7 text-white shadow-2xl shadow-blue-950/10 md:p-9">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs">
              <MessageCircle className="size-4" />
              Contact Klambocore Sarl
            </div>

            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Parlons de votre établissement
            </h1>

            <p className="mt-4 max-w-[350px] text-sm leading-7 text-blue-50">
              Écrivez-nous pour une inscription, un partenariat, une demande de
              support ou une question sur les établissements référencés.
            </p>
          </div>

          <div className="mt-10 grid gap-3 text-sm">
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4">
              <Mail className="size-5" />
              <span>{contactEmail || "Email non configure"}</span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4">
              <Phone className="size-5" />
              <span>Téléphone disponible : +(243) 84 495 2966</span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4">
              <MapPin className="size-5" />
              <span>Kinshasa, RDC</span>
            </div>
          </div>
        </section>

        <section>
          <ContactForm recipientId={user} subject="Demande de contact" />
        </section>
      </main>
    </div>
  );
}
