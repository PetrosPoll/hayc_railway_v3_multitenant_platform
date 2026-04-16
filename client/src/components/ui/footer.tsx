import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  
  return (
    <footer className="w-full bg-black flex flex-col items-center">
      {/* Mobile footer */}
      <div className="md:hidden w-full max-w-96 px-4 py-12 inline-flex flex-col justify-start items-center gap-6">
        <div className="self-stretch py-6 border-b border-zinc-800 flex flex-col justify-start items-center gap-6">
          <div className="self-stretch flex flex-col justify-start items-start gap-3">
            <div className="self-stretch flex flex-col justify-start items-start">
              <Link to="/">
                <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="6em" height="3em" viewBox="0 0 148 49.81">
                  <defs>
                    <clipPath id="clip-path-footer-mobile">
                      <rect width="148" height="49.81" fill="none" />
                    </clipPath>
                  </defs>
                  <g transform="translate(0 0)">
                    <path d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z" fill="#ed4c14" />
                    <g clipPath="url(#clip-path-footer-mobile)">
                      <path d="M61.828,22.27V38.076H53.823V23.5c0-4.465-2.052-6.518-5.594-6.518-3.849,0-6.619,2.362-6.619,7.441V38.076H33.6V0H41.61V13.34a12.138,12.138,0,0,1,8.775-3.285c6.517,0,11.444,3.8,11.444,12.215" transform="translate(-6.611 0)" fill="#ffffff" />
                      <path d="M102.242,12.917v27.61H94.6v-3.18c-2,2.41-4.927,3.591-8.622,3.591-7.8,0-13.8-5.542-13.8-14.214s6-14.216,13.8-14.216a10.606,10.606,0,0,1,8.263,3.338V12.917ZM94.39,26.723c0-4.774-3.079-7.648-7.03-7.648-4,0-7.082,2.874-7.082,7.648s3.079,7.646,7.082,7.646c3.951,0,7.03-2.873,7.03-7.646" transform="translate(-14.197 -2.46)" fill="#ffffff" />
                      <path d="M140.745,13.019V37.388c0,10.264-5.388,14.983-15.037,14.983-5.08,0-10.006-1.282-13.187-3.8l3.182-5.747a15.335,15.335,0,0,0,9.339,3.079c5.388,0,7.7-2.514,7.7-7.494V37.49a11.314,11.314,0,0,1-8.159,3.183c-6.928,0-11.8-3.849-11.8-12.42V13.019h8.006V27.072c0,4.67,2.053,6.723,5.594,6.723,3.7,0,6.364-2.362,6.364-7.44V13.019Z" transform="translate(-22.135 -2.561)" fill="#ffffff" />
                      <path d="M149.683,26.724c0-8.315,6.414-14.214,15.395-14.214,5.8,0,10.366,2.513,12.367,7.03l-6.209,3.335a6.881,6.881,0,0,0-6.209-3.8c-4.054,0-7.236,2.821-7.236,7.646s3.182,7.646,7.236,7.646a6.794,6.794,0,0,0,6.209-3.8l6.209,3.386c-2,4.414-6.569,6.979-12.367,6.979-8.981,0-15.395-5.9-15.395-14.214" transform="translate(-29.445 -2.461)" fill="#ffffff" />
                    </g>
                  </g>
                </svg>
              </Link>
              <div className="self-stretch text-white text-base font-normal font-['Inter'] leading-6">
                {t("footer.descriptionLine1")}<br />{t("footer.descriptionLine2")}
              </div>
            </div>
            <div className="inline-flex justify-start items-center gap-3">
              <a href="https://www.facebook.com/haycWebsites" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                <img src="/images/facebook_icon.svg" alt={t("footer.social.facebookAlt")} className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/hayc_websites/" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                <img src="/images/insta_icon.svg" alt={t("footer.social.instagramAlt")} className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-3">
            <div className="self-stretch text-white text-base font-bold font-['Inter'] leading-7">{t("footer.quickLinks")}</div>
            <div className="flex flex-col justify-start items-start gap-3">
              <Link to="/about" className="text-white text-base font-normal font-['Inter'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.about")}</Link>
              <Link to="/templates" className="text-white text-base font-normal font-['Inter'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.templates")}</Link>
              <Link to="/contact" className="text-white text-base font-normal font-['Inter'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.contact")}</Link>
            </div>
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-3">
            <div className="self-stretch text-white text-base font-bold font-['Inter'] leading-7">{t("footer.legal")}</div>
            <div className="self-stretch flex flex-col justify-start items-start gap-3">
              <Link to="/terms-of-service" className="text-white text-base font-normal font-['Inter'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.termsOfService")}</Link>
              <Link to="/privacy-policy" className="text-white text-base font-normal font-['Inter'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.privacyPolicy")}</Link>
              <Link to="/cookie-policy" className="text-white text-base font-normal font-['Inter'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.cookiePolicy")}</Link>
            </div>
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-3">
            <div className="self-stretch text-white text-lg font-bold font-['Inter'] leading-7">{t("footer.contactUs")}</div>
            <div className="self-stretch inline-flex justify-start items-center gap-2">
              <img src="/images/mail_icon.svg" alt={t("footer.emailAlt")} className="w-5 h-5" />
              <a href="mailto:info@hayc.gr" className="text-white text-base font-normal font-['Inter'] leading-6 hover:opacity-70 transition-opacity">
                info@hayc.gr
              </a>
            </div>
          </div>
        </div>
        <div className="self-stretch text-center text-white text-base font-normal font-['Inter'] leading-6">
          {t("footer.copyright")}
        </div>
      </div>

      {/* Desktop footer */}
      <div className="hidden md:flex w-full px-16 py-12 flex-col items-center gap-12">
      {/* Main footer grid */}
      <div className="w-full py-12 border-b border-zinc-800 flex justify-center items-start gap-24">
        {/* Col 1 — Logo + description + socials */}
        <div className="flex-1 flex flex-col justify-start items-start gap-3">
          <div className="flex flex-col justify-start items-start">
            {/* Logo — reuse existing SVG from nav-menu.tsx */}
            <Link to="/">
              <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="6em" height="3em" viewBox="0 0 148 49.81">
                <defs>
                  <clipPath id="clip-path-footer">
                    <rect width="148" height="49.81" fill="none" />
                  </clipPath>
                </defs>
                <g transform="translate(0 0)">
                  <path d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z" fill="#ed4c14" />
                  <g clipPath="url(#clip-path-footer)">
                    <path d="M61.828,22.27V38.076H53.823V23.5c0-4.465-2.052-6.518-5.594-6.518-3.849,0-6.619,2.362-6.619,7.441V38.076H33.6V0H41.61V13.34a12.138,12.138,0,0,1,8.775-3.285c6.517,0,11.444,3.8,11.444,12.215" transform="translate(-6.611 0)" fill="#ffffff" />
                    <path d="M102.242,12.917v27.61H94.6v-3.18c-2,2.41-4.927,3.591-8.622,3.591-7.8,0-13.8-5.542-13.8-14.214s6-14.216,13.8-14.216a10.606,10.606,0,0,1,8.263,3.338V12.917ZM94.39,26.723c0-4.774-3.079-7.648-7.03-7.648-4,0-7.082,2.874-7.082,7.648s3.079,7.646,7.082,7.646c3.951,0,7.03-2.873,7.03-7.646" transform="translate(-14.197 -2.46)" fill="#ffffff" />
                    <path d="M140.745,13.019V37.388c0,10.264-5.388,14.983-15.037,14.983-5.08,0-10.006-1.282-13.187-3.8l3.182-5.747a15.335,15.335,0,0,0,9.339,3.079c5.388,0,7.7-2.514,7.7-7.494V37.49a11.314,11.314,0,0,1-8.159,3.183c-6.928,0-11.8-3.849-11.8-12.42V13.019h8.006V27.072c0,4.67,2.053,6.723,5.594,6.723,3.7,0,6.364-2.362,6.364-7.44V13.019Z" transform="translate(-22.135 -2.561)" fill="#ffffff" />
                    <path d="M149.683,26.724c0-8.315,6.414-14.214,15.395-14.214,5.8,0,10.366,2.513,12.367,7.03l-6.209,3.335a6.881,6.881,0,0,0-6.209-3.8c-4.054,0-7.236,2.821-7.236,7.646s3.182,7.646,7.236,7.646a6.794,6.794,0,0,0,6.209-3.8l6.209,3.386c-2,4.414-6.569,6.979-12.367,6.979-8.981,0-15.395-5.9-15.395-14.214" transform="translate(-29.445 -2.461)" fill="#ffffff" />
                  </g>
                </g>
              </svg>
            </Link>
            <p className="text-white text-base font-normal font-['Montserrat'] leading-6 mt-2">
              {t("footer.descriptionLine1")}
              <br />
              {t("footer.descriptionLine2")}
            </p>
          </div>
          {/* Social icons */}
          <div className="flex items-center gap-3">
            <a href="https://www.facebook.com/haycWebsites" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
              <img src="/images/facebook_icon.svg" alt={t("footer.social.facebookAlt")} className="w-5 h-5" />
            </a>
            <a href="https://www.instagram.com/hayc_websites/" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
            <img src="/images/insta_icon.svg" alt={t("footer.social.instagramAlt")} className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Col 2 — Quick Links */}
        <div className="flex-1 self-stretch pt-11 flex flex-col justify-start items-start gap-6">
          <p className="text-white text-base font-bold font-['Inter'] leading-7">{t("footer.quickLinks")}</p>
          <div className="flex flex-col justify-start items-start gap-3">
            <Link to="/about" className="text-white text-base font-normal font-['Montserrat'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.about")}</Link>
            <Link to="/templates" className="text-white text-base font-normal font-['Montserrat'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.templates")}</Link>
            <Link to="/contact" className="text-white text-base font-normal font-['Montserrat'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.contact")}</Link>
          </div>
        </div>

        {/* Col 3 — Legal */}
        <div className="flex-1 self-stretch pt-11 flex flex-col justify-start items-start gap-6">
          <p className="text-white text-base font-bold font-['Inter'] leading-7">{t("footer.legal")}</p>
          <div className="flex flex-col justify-start items-start gap-3">
            <Link to="/terms-of-service" className="text-white text-base font-normal font-['Montserrat'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.termsOfService")}</Link>
            <Link to="/privacy-policy" className="text-white text-base font-normal font-['Montserrat'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.privacyPolicy")}</Link>
            <Link to="/cookie-policy" className="text-white text-base font-normal font-['Montserrat'] leading-6 hover:opacity-70 transition-opacity">{t("footer.links.cookiePolicy")}</Link>
          </div>
        </div>

        {/* Col 4 — Contact Us */}
        <div className="flex-1 self-stretch pt-11 flex flex-col justify-start items-start gap-6">
          <p className="text-white text-lg font-bold font-['Inter'] leading-7">{t("footer.contactUs")}</p>
          <div className="flex items-center gap-2">
            <img src="/images/mail_icon.svg" alt={t("footer.emailAlt")} className="w-5 h-5" />
            <a href="mailto:info@hayc.gr" className="text-white text-base font-normal font-['Montserrat'] leading-6 hover:opacity-70 transition-opacity">
              info@hayc.gr
            </a>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <p className="text-white text-base font-normal font-['Inter'] leading-6 text-center">
        {t("footer.copyright")}
      </p>
      </div>
    </footer>
  );
}
