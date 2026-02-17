import { Link } from "react-router-dom";
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Mail,
  Phone,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  
  return (
    <footer className="bg-card mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Company Info */}
          <div>
            <h3 className="font-semibold text-lg mb-4 text-[#182B53]">
              {t("footer.aboutUs")}
            </h3>
            <p className="text-[#182B53]">
              {t("footer.aboutUsDescription")}
            </p>
            <div className="flex space-x-4 mt-4">
              <a 
                href="https://www.facebook.com/haycWebsites" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#182B53] hover:text-primary"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a 
                href="https://www.instagram.com/hayc_websites/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#182B53] hover:text-primary"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4 text-[#182B53]">
              {t("footer.quickLinks")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="text-[#182B53] hover:text-primary">
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link to="/templates" className="text-[#182B53] hover:text-primary">
                  {t("nav.templates")}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-[#182B53] hover:text-primary">
                  {t("nav.contact")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold text-lg mb-4 text-[#182B53]">
              {t("footer.contactUs")}
            </h3>
            <ul className="space-y-2">
              <li className="flex items-center">
                <a
                  href="mailto:info@hayc.gr"
                  className="flex items-center text-[#182B53]"
                >
                  <Mail className="h-5 w-5 mr-2" />
                  info@hayc.gr
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4 text-[#182B53]">{t("footer.legal")}</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/legal" className="text-[#182B53] hover:text-primary">
                  {t("footer.legalInfo")}
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="text-[#182B53] hover:text-primary">
                  {t("footer.termsOfService")}
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="text-[#182B53] hover:text-primary">
                  {t("footer.privacyPolicy")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center text-[#182B53]">
          <p>&copy; {new Date().getFullYear()} hayc. {t("footer.allRightsReserved")}.</p>
        </div>
      </div>
    </footer>
  );
}
