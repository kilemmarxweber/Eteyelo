import {
  Facebook,
  Globe,
  Instagram,
  Mail,
  MapPin,
  Phone,
  School,
  Youtube,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const socialLinks = [
  { icon: Facebook, label: "Facebook", className: "bg-blue-600" },
  { icon: Instagram, label: "Instagram", className: "bg-pink-600" },
  { icon: Youtube, label: "YouTube", className: "bg-red-600" },
  { icon: Globe, label: "Site web", className: "bg-blue-950" },
];

const footerLinkClass =
  "relative inline-block transition hover:text-white after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-white after:transition-all after:duration-300 hover:after:w-full";

export function HomeFooter() {
  return (
    <footer id="contact" className="bg-blue-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600">
              <School />
            </div>
            <div>
              <h3 className="text-2xl font-black">Klambocore</h3>
              <p className="text-xs text-blue-200/70">Marketing scolaire RDC</p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-blue-100/70">
            Plateforme moderne pour decouvrir, promouvoir et digitaliser les
            etablissements scolaires en RDC.
          </p>

          <div className="mt-6">
            <p className="text-sm font-bold text-white">
              Suivez la vie des ecoles
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {socialLinks.map(({ icon: Icon, label, className }) => (
                <Button
                  key={label}
                  size="icon"
                  className={`h-9 w-9 rounded-full text-white hover:opacity-90 ${className}`}
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-black text-white">Services</h4>
          <ul className="mt-5 space-y-3 text-sm text-blue-100/70">
            {[
              ["Etablissements", "/etablissements"],
              ["Inscription ecole", "/inscription-ecole"],
              ["Filieres", "/filieres"],
              ["Resultats en ligne", "/resultats"],
            ].map(([label, href]) => (
              <li key={label}>
                <a href={href} className={footerLinkClass}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-black text-white">Entreprise</h4>
          <ul className="mt-5 space-y-3 text-sm text-blue-100/70">
            {[
              ["A propos", "/about"],
              ["Contact", "/contact"],
              ["Support", "/support"],
              ["Partenaires", "/partenaires"],
            ].map(([label, href]) => (
              <li key={label}>
                <a href={href} className={footerLinkClass}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-black text-white">Contact</h4>
          <div className="mt-5 space-y-4 text-sm text-blue-100/70">
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> +243 844 952 966
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> contact@klambocore.com
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Kinshasa, RDC
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-6 text-center text-sm text-blue-100/60 md:flex-row md:items-center md:justify-between md:text-left">
        <p>
          © {new Date().getFullYear()} Klambocore Sarl - Tous droits reserves.
        </p>

        <div className="flex flex-wrap justify-center gap-5">
          {[
            ["Conditions", "/terms"],
            ["Confidentialite", "/privacy"],
            ["Cookies", "/cookies"],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="transition hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
