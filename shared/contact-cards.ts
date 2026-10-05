/** Demo στοιχεία για τις κάρτες. Άλλαξέ τα εδώ. */

export type ContactCardLinkKind =
  | "phone"
  | "email"
  | "website"
  | "instagram"
  | "facebook"
  | "linkedin";

export type ContactCardLink = {
  kind: ContactCardLinkKind;
  label: string;
  text: string;
  href: string;
};

export type ContactCard = {
  slug: string;
  name: string;
  role: string;
  bio: string;
  initials: string;
  links: ContactCardLink[];
};

export const CONTACT_CARDS: ContactCard[] = [
  {
    slug: "petros-pollakis",
    name: "Πέτρος Πολλάκης",
    role: "Ιδρυτής · hayc",
    bio: "Φτιάχνουμε ιστοσελίδες που δουλεύουν για την επιχείρησή σου.",
    initials: "ΠΠ",
    links: [
      {
        kind: "phone",
        label: "Τηλέφωνο",
        text: "+30 690 000 0000",
        href: "tel:+306900000000",
      },
      {
        kind: "website",
        label: "Ιστοσελίδα",
        text: "hayc.gr",
        href: "https://hayc.gr",
      },
      {
        kind: "instagram",
        label: "Instagram",
        text: "Instagram",
        href: "https://instagram.com/hayc.gr",
      },
      {
        kind: "facebook",
        label: "Facebook",
        text: "Facebook",
        href: "https://facebook.com/hayc.gr",
      },
      {
        kind: "linkedin",
        label: "LinkedIn",
        text: "LinkedIn",
        href: "https://www.linkedin.com/in/petros-pollakis",
      },
      {
        kind: "email",
        label: "Email",
        text: "petros.demo@hayc.gr",
        href: "mailto:petros.demo@hayc.gr",
      },
    ],
  },
  {
    slug: "alexandra-kritikou",
    name: "Αλεξάνδρα Κριτικού",
    role: "Συνεργάτιδα · hayc",
    bio: "Σε βοηθάω να βρεις τη σωστή λύση για την online παρουσία σου.",
    initials: "ΑΚ",
    links: [
      {
        kind: "phone",
        label: "Τηλέφωνο",
        text: "+30 690 000 0001",
        href: "tel:+306900000001",
      },
      {
        kind: "website",
        label: "Ιστοσελίδα",
        text: "hayc.gr",
        href: "https://hayc.gr",
      },
      {
        kind: "instagram",
        label: "Instagram",
        text: "Instagram",
        href: "https://instagram.com/hayc.gr",
      },
      {
        kind: "facebook",
        label: "Facebook",
        text: "Facebook",
        href: "https://facebook.com/hayc.gr",
      },
      {
        kind: "linkedin",
        label: "LinkedIn",
        text: "LinkedIn",
        href: "https://www.linkedin.com/in/alexandra-kritikou",
      },
      {
        kind: "email",
        label: "Email",
        text: "alexandra.demo@hayc.gr",
        href: "mailto:alexandra.demo@hayc.gr",
      },
    ],
  },
];

export function getContactCard(slug: string | undefined): ContactCard | undefined {
  if (!slug) return undefined;
  return CONTACT_CARDS.find((card) => card.slug === slug);
}

export function contactCardLink(
  card: ContactCard,
  kind: ContactCardLinkKind,
): ContactCardLink | undefined {
  return card.links.find((link) => link.kind === kind);
}

export function contactCardUrl(slug: string, origin = "https://hayc.gr"): string {
  return `${origin.replace(/\/+$/, "")}/card/${slug}`;
}

export function isContactCardPath(pathname: string): boolean {
  return pathname === "/card" || pathname.startsWith("/card/");
}
