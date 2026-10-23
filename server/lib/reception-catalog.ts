import type { ReceptionTypeDoc, ReceptionTypeField } from "@shared/schema";
import { CROSS_SELL_OPTIONS } from "./reception-logic";

const crossSellField: ReceptionTypeField = {
  key: "cross_sell",
  label: "Ενδιαφέρομαι και για…",
  type: "multiselect",
  options: CROSS_SELL_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
};

const notesField: ReceptionTypeField = {
  key: "notes",
  label: "Σημειώσεις",
  type: "textarea",
};

const policyField: ReceptionTypeField = {
  key: "policy_ref",
  label: "Αριθμός συμβολαίου (προαιρετικό)",
  type: "text",
};

const branchField: ReceptionTypeField = {
  key: "branch",
  label: "Κλάδος",
  type: "select",
  required: true,
  options: CROSS_SELL_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
};

export type ReceptionTypeSeed = {
  key: string;
  label: string;
  kind: "lead" | "service";
  fields: ReceptionTypeField[];
  requiredDocs: ReceptionTypeDoc[];
  allowUploads: boolean;
};

export const RECEPTION_TYPE_SEEDS: ReceptionTypeSeed[] = [
  {
    key: "quote",
    label: "Αίτημα προσφοράς (κλάδος: υγεία, ζωή, αυτοκίνητο, κατοικία, επιχείρηση)",
    kind: "lead",
    allowUploads: false,
    fields: [branchField, notesField, crossSellField],
    requiredDocs: [],
  },
  {
    key: "claim_health",
    label: "Αποζημίωση υγείας (νοσοκομειακή / εξωνοσοκομειακή)",
    kind: "service",
    allowUploads: false,
    fields: [
      {
        key: "care_type",
        label: "Είδος",
        type: "select",
        required: true,
        options: [
          { value: "inpatient", label: "Νοσοκομειακή" },
          { value: "outpatient", label: "Εξωνοσοκομειακή" },
        ],
      },
      policyField,
      notesField,
      crossSellField,
    ],
    requiredDocs: [
      { key: "discharge", label: "Εξιτήριο / βεβαίωση νοσηλείας", required: true },
      { key: "medical_note", label: "Ιατρική γνωμάτευση", required: true },
      { key: "invoices", label: "Αποδείξεις / τιμολόγια", required: true },
      { key: "referral", label: "Παραπεμπτικό", required: false },
    ],
  },
  {
    key: "claim_vehicle",
    label: "Ζημιά οχήματος",
    kind: "service",
    allowUploads: true,
    fields: [policyField, notesField, crossSellField],
    requiredDocs: [
      { key: "photos", label: "Φωτογραφίες", required: true },
      { key: "registration", label: "Άδεια κυκλοφορίας", required: true },
      { key: "licence", label: "Δίπλωμα", required: true },
      { key: "accident_statement", label: "Δήλωση ατυχήματος", required: true },
    ],
  },
  {
    key: "claim_home",
    label: "Ζημιά κατοικίας",
    kind: "service",
    allowUploads: true,
    fields: [policyField, notesField, crossSellField],
    requiredDocs: [
      { key: "photos", label: "Φωτογραφίες", required: true },
      { key: "estimates", label: "Εκτιμήσεις/τιμολόγια επισκευής", required: true },
    ],
  },
  {
    key: "general",
    label: "Γενικό αίτημα / αλλαγή στοιχείων",
    kind: "service",
    allowUploads: true,
    fields: [policyField, notesField, crossSellField],
    requiredDocs: [{ key: "attachment", label: "Συνημμένο", required: false }],
  },
];
