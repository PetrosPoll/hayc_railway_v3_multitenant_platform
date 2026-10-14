export type PortfolioSite = {
  domain: string;
  name: string;
  url: string;
  thumb: string | null;
  category: string;
};

/**
 * Client websites for the public portfolio offer page.
 * Thumbs live in /public/portfolio-thumbs (captured from live or *.hayc.gr).
 */
export const portfolioSites: PortfolioSite[] = [
  {
    domain: "ak-business-consultant.gr",
    name: "AK Business Consultant",
    url: "https://ak-business-consultant.gr",
    thumb: "/portfolio-thumbs/ak-business-consultant-gr.jpg",
    category: "Business",
  },
  {
    domain: "carinapinzer.com",
    name: "Carina Pinzer",
    url: "https://carinapinzer.com",
    thumb: "/portfolio-thumbs/carinaprizer-com.jpg",
    category: "Coaching",
  },
  {
    domain: "gsacademy.gr",
    name: "GS Academy",
    url: "https://gsacademy.gr",
    thumb: "/portfolio-thumbs/gsacademy-gr.jpg",
    category: "Education",
  },
  {
    domain: "kavalahospitality.gr",
    name: "Kavala Hospitality",
    url: "https://kavalahospitality.gr",
    thumb: "/portfolio-thumbs/kavalahospitality-gr.jpg",
    category: "Hospitality",
  },
  {
    domain: "mamacoach.gr",
    name: "Mama Coach",
    url: "https://mamacoach.gr",
    thumb: "/portfolio-thumbs/mamacoach-gr.jpg",
    category: "Coaching",
  },
  {
    domain: "marianthikatsouda.gr",
    name: "Marianthi Katsouda",
    url: "https://marianthikatsouda.gr",
    thumb: "/portfolio-thumbs/marianthikatsouda-gr.jpg",
    category: "Health",
  },
  {
    domain: "nathaliespiliopoulou.com",
    name: "Nathalie Spiliopoulou",
    url: "https://nathaliespiliopoulou.com",
    thumb: "/portfolio-thumbs/nathaliespiliopoulou-com.jpg",
    category: "Professional",
  },
  {
    domain: "primaverastudios.net",
    name: "Primavera Studios",
    url: "https://primaverastudios.net",
    thumb: "/portfolio-thumbs/primaverastudios-net.jpg",
    category: "Wellness",
  },
  {
    domain: "solar-house.gr",
    name: "Solar House",
    url: "https://solar-house.gr",
    thumb: "/portfolio-thumbs/solar-house-gr.jpg",
    category: "Energy",
  },
  {
    domain: "spanishwithdiaconis.com",
    name: "Spanish with Diaconis",
    url: "https://spanishwithdiaconis.com",
    thumb: "/portfolio-thumbs/spanishwithdiaconis-com.jpg",
    category: "Education",
  },
  {
    domain: "stamatopoulosbakery.gr",
    name: "Stamatopoulos Bakery",
    url: "https://stamatopoulosbakery.gr",
    thumb: "/portfolio-thumbs/stamatopoulosbakery-gr.jpg",
    category: "Food",
  },
  {
    domain: "vayo.gr",
    name: "Vayo Tours & Transfers",
    url: "https://vayo.gr",
    thumb: "/portfolio-thumbs/vayo-gr.jpg",
    category: "Travel",
  },
  // Domains from Cloudflare without a public homepage we could screenshot yet
  {
    domain: "accountnr.gr",
    name: "Account NR",
    url: "https://accountnr.gr",
    thumb: null,
    category: "In progress",
  },
  {
    domain: "adytomykonos.com",
    name: "Adyto Mykonos",
    url: "https://adytomykonos.com",
    thumb: null,
    category: "In progress",
  },
  {
    domain: "dexapus.com.gr",
    name: "Dexapus",
    url: "https://dexapus.com.gr",
    thumb: null,
    category: "In progress",
  },
  {
    domain: "elm-routes.gr",
    name: "ELM Routes",
    url: "https://elm-routes.gr",
    thumb: null,
    category: "In progress",
  },
  {
    domain: "filippouinbuildtech.gr",
    name: "Filippou In Build Tech",
    url: "https://filippouinbuildtech.gr",
    thumb: null,
    category: "In progress",
  },
  {
    domain: "georgiachogloubaltravel.com",
    name: "Georgia Choglou Bal Travel",
    url: "https://georgiachogloubaltravel.com",
    thumb: null,
    category: "In progress",
  },
  {
    domain: "mahiba.gr",
    name: "Mahiba",
    url: "https://mahiba.gr",
    thumb: null,
    category: "In progress",
  },
  {
    domain: "nickshurgamandfriends.com",
    name: "Nicks Hurgam & Friends",
    url: "https://nickshurgamandfriends.com",
    thumb: null,
    category: "In progress",
  },
  {
    domain: "primelustransfer.com",
    name: "Prime Lus Transfer",
    url: "https://primelustransfer.com",
    thumb: null,
    category: "In progress",
  },
  {
    domain: "proisoffice.com",
    name: "Prois Office",
    url: "https://proisoffice.com",
    thumb: null,
    category: "In progress",
  },
  {
    domain: "taniamillou.com",
    name: "Tania Millou",
    url: "https://taniamillou.com",
    thumb: null,
    category: "In progress",
  },
];
