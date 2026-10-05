/** Στοιχεία καρτών. Ρόλος και κείμενο μένουν επεξεργάσιμα εδώ. */

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
        text: "+30 698 224 9034",
        href: "tel:+306982249034",
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
        href: "https://www.instagram.com/petros_pollakis/",
      },
      {
        kind: "linkedin",
        label: "LinkedIn",
        text: "LinkedIn",
        href: "https://www.linkedin.com/in/petros-pollakis-740924163/",
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
        text: "+30 698 658 7889",
        href: "tel:+306986587889",
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
        href: "https://www.instagram.com/a_kritikou/",
      },
      {
        kind: "linkedin",
        label: "LinkedIn",
        text: "LinkedIn",
        href: "https://www.linkedin.com/in/alexandra-kritikou/",
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
