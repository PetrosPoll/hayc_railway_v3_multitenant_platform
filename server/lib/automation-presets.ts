import type { AutomationGraph } from "@shared/schema";

export type PresetGoalCategory =
  | "popular"
  | "forms_leads"
  | "newsletter"
  | "bookings"
  | "contacts"
  | "time"
  | "reception";

export type PresetBuildContext = {
  formId?: string;
  formName?: string;
};

export type AutomationPreset = {
  key: string;
  name: string;
  nameGr: string;
  description: string;
  descriptionGr: string;
  /** Short "Trigger → Action" line for gallery rows */
  logic: string;
  logicGr: string;
  category: PresetGoalCategory;
  /** Also listed under Popular */
  popular?: boolean;
  /** Shown on the main “Suggested for you” strip (keep to ~3) */
  featured?: boolean;
  triggerType: string;
  /** For form.submitted presets — which form type to prefer */
  formType?: "contact" | "newsletter" | "any";
  defaultTriggerConfig?: Record<string, unknown>;
  buildGraph: (ctx: PresetBuildContext) => AutomationGraph;
};

const VERTICAL_X = 40;
const GAP = 140;

function chain(
  trigger: AutomationGraph["nodes"][0],
  steps: Omit<AutomationGraph["nodes"][0], "position">[],
): AutomationGraph {
  const nodes: AutomationGraph["nodes"] = [
    { ...trigger, position: { x: VERTICAL_X, y: 40 } },
  ];
  const edges: AutomationGraph["edges"] = [];
  let prev = trigger.id;
  steps.forEach((step, i) => {
    nodes.push({
      ...step,
      position: { x: VERTICAL_X, y: 40 + (i + 1) * GAP },
    });
    edges.push({
      id: `e-${prev}-${step.id}`,
      source: prev,
      target: step.id,
    });
    prev = step.id;
  });
  return { nodes, edges };
}

function formTrigger(formId: string, formName: string) {
  return {
    id: "trigger-1",
    type: "trigger" as const,
    data: {
      formId,
      formName,
      eventType: "form.submitted",
      triggerType: "form.submitted",
    },
  };
}

function eventTrigger(eventType: string, label: string, extra: Record<string, unknown> = {}) {
  return {
    id: "trigger-1",
    type: "trigger" as const,
    data: {
      eventType,
      triggerType: eventType,
      formName: label,
      ...extra,
    },
  };
}

function replyAndNotify(ctx: PresetBuildContext): AutomationGraph {
  const formId = ctx.formId || "form";
  const formName = ctx.formName || "Form";
  return chain(formTrigger(formId, formName), [
    {
      id: "email-1",
      type: "email",
      data: {
        subject: "We received your message — {{siteLabel}}",
        body: "Hi {{name}},\n\nThank you for contacting us. We will get back to you soon.\n\n— {{siteLabel}}",
      },
    },
    {
      id: "notify-1",
      type: "notify_owner",
      data: {
        subject: "New message from {{name}} — {{siteLabel}}",
        body: "Name: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\n\n{{message}}",
      },
    },
  ]);
}

function hotLead(ctx: PresetBuildContext): AutomationGraph {
  const formId = ctx.formId || "form";
  const formName = ctx.formName || "Form";
  return {
    nodes: [
      {
        ...formTrigger(formId, formName),
        position: { x: VERTICAL_X, y: 40 },
      },
      {
        id: "email-1",
        type: "email",
        position: { x: VERTICAL_X, y: 180 },
        data: {
          subject: "Thanks {{name}} — {{siteLabel}}",
          body: "Hi {{name}},\n\nWe got your message and will reply shortly.",
        },
      },
      {
        id: "notify-1",
        type: "notify_owner",
        position: { x: VERTICAL_X, y: 320 },
        data: {
          subject: "New lead — {{name}}",
          body: "{{name}} <{{email}}>\n{{phone}}\n\n{{message}}",
        },
      },
      {
        id: "cond-1",
        type: "condition",
        position: { x: VERTICAL_X, y: 460 },
        data: {
          rules: [
            {
              kind: "form_field",
              fieldKey: "message",
              operator: "is_not_empty",
            },
          ],
        },
      },
      {
        id: "remind-1",
        type: "owner_reminder",
        position: { x: VERTICAL_X, y: 600 },
        data: {
          amount: 2,
          unit: "hours",
          subject: "Follow up: {{name}}",
          body: "Reminder — no reply yet?\n\n{{name}} <{{email}}>\n{{message}}",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "email-1" },
      { id: "e2", source: "email-1", target: "notify-1" },
      { id: "e3", source: "notify-1", target: "cond-1" },
      {
        id: "e4",
        source: "cond-1",
        target: "remind-1",
        sourceHandle: "yes",
      },
    ],
  };
}

function welcomeSubscriberEvent(): AutomationGraph {
  return chain(
    eventTrigger("newsletter.subscribed", "Newsletter subscribed"),
    [
      {
        id: "email-1",
        type: "email",
        data: {
          subject: "Welcome to {{siteLabel}}",
          body: "Hi {{name}},\n\nThanks for subscribing!",
        },
      },
      {
        id: "tag-1",
        type: "add_tag",
        data: { tag: "newsletter" },
      },
    ],
  );
}

/** Legacy form-based welcome (newsletter form submit) */
function welcomeSubscriberForm(ctx: PresetBuildContext): AutomationGraph {
  const formId = ctx.formId || "newsletter";
  const formName = ctx.formName || "Newsletter";
  return chain(formTrigger(formId, formName), [
    {
      id: "email-1",
      type: "email",
      data: {
        subject: "Welcome to {{siteLabel}}",
        body: "Hi {{name}},\n\nThanks for subscribing!",
      },
    },
    {
      id: "tag-1",
      type: "add_tag",
      data: { tag: "newsletter" },
    },
  ]);
}

function bookingCreatedNotify(): AutomationGraph {
  return chain(eventTrigger("booking.created", "Booking created"), [
    {
      id: "notify-1",
      type: "notify_owner",
      data: {
        subject: "New booking — {{name}}",
        body: "New booking from {{name}} <{{email}}>\nPhone: {{phone}}",
      },
    },
  ]);
}

function bookingCompletedReview(): AutomationGraph {
  return chain(eventTrigger("booking.completed", "Appointment completed"), [
    {
      id: "delay-1",
      type: "delay",
      data: { amount: 1, unit: "hours" },
    },
    {
      id: "review-1",
      type: "review_request",
      data: {
        subject: "How was your visit, {{name}}?",
        body: "Hi {{name}},\n\nThanks for visiting {{siteLabel}}. We would love a Google review if you have a moment.",
      },
    },
  ]);
}

function bookingCancelledNotify(): AutomationGraph {
  return chain(eventTrigger("booking.cancelled", "Booking cancelled"), [
    {
      id: "notify-1",
      type: "notify_owner",
      data: {
        subject: "Booking cancelled — {{name}}",
        body: "{{name}} <{{email}}> cancelled a booking.\nPhone: {{phone}}",
      },
    },
    {
      id: "email-1",
      type: "email",
      data: {
        subject: "Your booking was cancelled — {{siteLabel}}",
        body: "Hi {{name}},\n\nYour booking with {{siteLabel}} has been cancelled. Reply if you need to rebook.",
      },
    },
  ]);
}

function contactCreatedWelcome(): AutomationGraph {
  return chain(eventTrigger("contact.created", "New contact"), [
    {
      id: "email-1",
      type: "email",
      data: {
        subject: "Welcome — {{siteLabel}}",
        body: "Hi {{name}},\n\nNice to meet you. We are glad you are here.",
      },
    },
  ]);
}

function tagAddedFollowup(): AutomationGraph {
  return chain(
    eventTrigger("contact.tag_added", "Tag added", { tag: "lead" }),
    [
      {
        id: "email-1",
        type: "email",
        data: {
          subject: "A quick follow-up — {{siteLabel}}",
          body: "Hi {{name}},\n\nWe wanted to follow up after updating your profile.",
        },
      },
    ],
  );
}

function dateOffsetFollowup(): AutomationGraph {
  return chain(
    eventTrigger("schedule.date_offset", "X days after a date", {
      dateSource: "last_booking",
      offsetDays: 180,
      yearly: false,
    }),
    [
      {
        id: "email-1",
        type: "email",
        data: {
          subject: "We miss you — {{siteLabel}}",
          body: "Hi {{name}},\n\nIt has been a while since your last visit. We would love to see you again.",
        },
      },
    ],
  );
}

function receptionCreatedClient(): AutomationGraph {
  return chain(eventTrigger("request.created", "Νέο αίτημα"), [
    {
      id: "email-1",
      type: "email",
      data: {
        subject: "Λάβαμε το αίτημά σας — {{siteLabel}}",
        body: "Γεια σας {{client_name}},\n\nΛάβαμε το αίτημά σας ({{request_type}}).\n\n{{missing_docs_list}}\n\n{{magic_link}}",
      },
    },
  ]);
}

function receptionCreatedAgent(): AutomationGraph {
  return chain(eventTrigger("request.created", "Νέο αίτημα"), [
    {
      id: "notify-1",
      type: "notify_owner",
      data: {
        subject: "Νέο αίτημα από {{client_name}}",
        body: "Τύπος: {{request_type}}\nΚατάσταση: {{status}}\n\n{{client_name}}\n{{email}}\n{{phone}}",
      },
    },
  ]);
}

function receptionDocsMissing(offsetDays: number): AutomationGraph {
  return chain(
    eventTrigger("request.docs_missing", "Λείπουν έγγραφα", { offsetDays }),
    [
      {
        id: "email-1",
        type: "email",
        data: {
          subject: "Λείπουν έγγραφα για το αίτημά σας",
          body: "Γεια σας {{client_name}},\n\nΓια το αίτημα «{{request_type}}» λείπουν ακόμα:\n\n{{missing_docs_list}}\n\n{{magic_link}}",
        },
      },
    ],
  );
}

function receptionStatusUpdate(): AutomationGraph {
  return chain(eventTrigger("request.status_changed", "Αλλαγή κατάστασης"), [
    {
      id: "email-1",
      type: "email",
      data: {
        subject: "Ενημέρωση αιτήματος — {{status}}",
        body: "Γεια σας {{client_name}},\n\nΤο αίτημά σας ({{request_type}}) είναι πλέον: {{status}}.",
      },
    },
  ]);
}

function receptionStuckAgent(): AutomationGraph {
  return chain(
    eventTrigger("request.docs_missing", "Κολλημένο αίτημα", { offsetDays: 14 }),
    [
      {
        id: "notify-1",
        type: "notify_owner",
        data: {
          subject: "Πάρε τηλέφωνο τον πελάτη — {{client_name}}",
          body: "Το αίτημα ({{request_type}}) έχει έγγραφα που λείπουν.\n\n{{missing_docs_list}}\n\nΠάρε τηλέφωνο τον πελάτη {{client_name}}.",
        },
      },
    ],
  );
}

function receptionLeadUnanswered(): AutomationGraph {
  return {
    nodes: [
      { ...eventTrigger("request.created", "Νέο lead"), position: { x: VERTICAL_X, y: 40 } },
      {
        id: "delay-1",
        type: "delay",
        position: { x: VERTICAL_X, y: 180 },
        data: { amount: 24, unit: "hours" },
      },
      {
        id: "cond-1",
        type: "condition",
        position: { x: VERTICAL_X, y: 320 },
        data: {
          rules: [
            { kind: "form_field", fieldKey: "request_type", operator: "equals", value: "quote" },
            { kind: "form_field", fieldKey: "status", operator: "equals", value: "missing_docs" },
          ],
        },
      },
      {
        id: "notify-1",
        type: "notify_owner",
        position: { x: VERTICAL_X, y: 460 },
        data: {
          subject: "Lead χωρίς απάντηση — {{client_name}}",
          body: "Το lead {{client_name}} ({{email}}, {{phone}}) έχει ακόμα έγγραφα που λείπουν μετά από 24 ώρες.\n\n{{request_type}}",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "delay-1" },
      { id: "e2", source: "delay-1", target: "cond-1" },
      { id: "e3", source: "cond-1", target: "notify-1", sourceHandle: "yes" },
    ],
  };
}

export const AUTOMATION_PRESETS: AutomationPreset[] = [
  {
    key: "reply_and_notify",
    name: "Reply & notify",
    nameGr: "Απάντηση & ειδοποίηση",
    description: "Thank the visitor and email you the submission.",
    descriptionGr: "Ευχαριστία επισκέπτη και ειδοποίηση σε εσένα.",
    logic: "Form submitted → Send email + Notify me",
    logicGr: "Υποβολή φόρμας → Email + Ειδοποίηση",
    category: "forms_leads",
    popular: true,
    featured: true,
    triggerType: "form.submitted",
    formType: "contact",
    buildGraph: replyAndNotify,
  },
  {
    key: "welcome_subscriber",
    name: "Welcome newsletter subscriber",
    nameGr: "Welcome νέου συνδρομητή",
    description: "Welcome email and tag when someone subscribes.",
    descriptionGr: "Welcome email και tag όταν κάποιος εγγράφεται.",
    logic: "Newsletter subscribed → Send email + Add tag",
    logicGr: "Εγγραφή newsletter → Email + Tag",
    category: "newsletter",
    popular: true,
    featured: true,
    triggerType: "newsletter.subscribed",
    buildGraph: () => welcomeSubscriberEvent(),
  },
  {
    key: "booking_created_notify",
    name: "Notify me of new bookings",
    nameGr: "Ειδοποίηση για νέα κράτηση",
    description: "Get notified when a booking is created.",
    descriptionGr: "Ειδοποίηση όταν γίνεται νέα κράτηση.",
    logic: "Booking created → Notify me",
    logicGr: "Νέα κράτηση → Ειδοποίηση",
    category: "bookings",
    popular: true,
    featured: true,
    triggerType: "booking.created",
    buildGraph: () => bookingCreatedNotify(),
  },
  {
    key: "hot_lead",
    name: "Hot lead follow-up",
    nameGr: "Follow-up ζεστού lead",
    description: "Reply, notify you, then remind you in 2h if there is a message.",
    descriptionGr: "Απάντηση, ειδοποίηση, υπενθύμιση σε 2 ώρες αν υπάρχει μήνυμα.",
    logic: "Form submitted → Email + Notify + Reminder",
    logicGr: "Υποβολή φόρμας → Email + Ειδοποίηση + Υπενθύμιση",
    category: "forms_leads",
    triggerType: "form.submitted",
    formType: "contact",
    buildGraph: hotLead,
  },
  {
    key: "welcome_form_newsletter",
    name: "Welcome after newsletter form",
    nameGr: "Welcome από φόρμα newsletter",
    description: "When a newsletter form is submitted: welcome email + tag.",
    descriptionGr: "Όταν υποβάλλεται φόρμα newsletter: welcome email + tag.",
    logic: "Newsletter form → Send email + Add tag",
    logicGr: "Φόρμα newsletter → Email + Tag",
    category: "newsletter",
    triggerType: "form.submitted",
    formType: "newsletter",
    buildGraph: welcomeSubscriberForm,
  },
  {
    key: "booking_completed_review",
    name: "Ask for a review after appointment",
    nameGr: "Αίτημα κριτικής μετά το ραντεβού",
    description: "Wait, then send a Google review request.",
    descriptionGr: "Περίμενε και μετά στείλε αίτημα κριτικής Google.",
    logic: "Appointment completed → Wait → Review request",
    logicGr: "Ολοκλήρωση ραντεβού → Αναμονή → Κριτική",
    category: "bookings",
    triggerType: "booking.completed",
    buildGraph: () => bookingCompletedReview(),
  },
  {
    key: "booking_cancelled_notify",
    name: "Handle cancelled bookings",
    nameGr: "Διαχείριση ακυρωμένης κράτησης",
    description: "Notify you and email the customer when a booking is cancelled.",
    descriptionGr: "Ειδοποίηση σε εσένα και email στον πελάτη όταν ακυρώνεται κράτηση.",
    logic: "Booking cancelled → Notify me + Send email",
    logicGr: "Ακύρωση κράτησης → Ειδοποίηση + Email",
    category: "bookings",
    triggerType: "booking.cancelled",
    buildGraph: () => bookingCancelledNotify(),
  },
  {
    key: "contact_created_welcome",
    name: "Welcome new contacts",
    nameGr: "Welcome νέας επαφής",
    description: "Send a welcome email when a contact is created for the first time.",
    descriptionGr: "Welcome email όταν δημιουργείται επαφή για πρώτη φορά.",
    logic: "New contact → Send email",
    logicGr: "Νέα επαφή → Email",
    category: "contacts",
    triggerType: "contact.created",
    buildGraph: () => contactCreatedWelcome(),
  },
  {
    key: "tag_added_followup",
    name: "Follow up when a tag is added",
    nameGr: "Follow-up όταν προστίθεται tag",
    description: "Email the contact after the lead tag is added.",
    descriptionGr: "Email στην επαφή αφού προστεθεί το tag lead.",
    logic: "Tag added → Send email",
    logicGr: "Προσθήκη tag → Email",
    category: "contacts",
    triggerType: "contact.tag_added",
    defaultTriggerConfig: { tag: "lead" },
    buildGraph: () => tagAddedFollowup(),
  },
  {
    key: "date_offset_followup",
    name: "Re-engage after 180 days",
    nameGr: "Επαναπροσέγγιση μετά από 180 μέρες",
    description: "Email contacts 180 days after their last booking.",
    descriptionGr: "Email 180 μέρες μετά την τελευταία κράτηση.",
    logic: "X days after date → Send email",
    logicGr: "Χ μέρες μετά ημερομηνία → Email",
    category: "time",
    triggerType: "schedule.date_offset",
    defaultTriggerConfig: {
      dateSource: "last_booking",
      offsetDays: 180,
      yearly: false,
    },
    buildGraph: () => dateOffsetFollowup(),
  },
  {
    key: "reception_confirm",
    name: "Επιβεβαίωση αιτήματος",
    nameGr: "Επιβεβαίωση αιτήματος",
    description: "Επιβεβαίωση στον πελάτη, με σύνδεσμο αν λείπουν έγγραφα.",
    descriptionGr: "Επιβεβαίωση στον πελάτη, με σύνδεσμο αν λείπουν έγγραφα.",
    logic: "Νέο αίτημα → Email στον πελάτη",
    logicGr: "Νέο αίτημα → Email στον πελάτη",
    category: "reception",
    triggerType: "request.created",
    buildGraph: () => receptionCreatedClient(),
  },
  {
    key: "reception_notify_agent",
    name: "Νέο αίτημα",
    nameGr: "Νέο αίτημα",
    description: "Ειδοποίηση του ασφαλιστή για νέο αίτημα.",
    descriptionGr: "Ειδοποίηση του ασφαλιστή για νέο αίτημα.",
    logic: "Νέο αίτημα → Ειδοποίηση",
    logicGr: "Νέο αίτημα → Ειδοποίηση",
    category: "reception",
    triggerType: "request.created",
    buildGraph: () => receptionCreatedAgent(),
  },
  {
    key: "reception_docs_reminder",
    name: "Υπενθύμιση εγγράφων",
    nameGr: "Υπενθύμιση εγγράφων",
    description: "Στέλνει τα έγγραφα που λείπουν και τον σύνδεσμο. Η μέρα ρυθμίζεται στο automation.",
    descriptionGr: "Στέλνει τα έγγραφα που λείπουν και τον σύνδεσμο. Η μέρα ρυθμίζεται στο automation.",
    logic: "Λείπουν έγγραφα (3 μέρες) → Email",
    logicGr: "Λείπουν έγγραφα (3 μέρες) → Email",
    category: "reception",
    triggerType: "request.docs_missing",
    defaultTriggerConfig: { offsetDays: 3 },
    buildGraph: () => receptionDocsMissing(3),
  },
  {
    key: "reception_docs_reminder_7",
    name: "Υπενθύμιση εγγράφων (7 μέρες)",
    nameGr: "Υπενθύμιση εγγράφων (7 μέρες)",
    description: "Δεύτερη υπενθύμιση με τα έγγραφα που λείπουν.",
    descriptionGr: "Δεύτερη υπενθύμιση με τα έγγραφα που λείπουν.",
    logic: "Λείπουν έγγραφα (7 μέρες) → Email",
    logicGr: "Λείπουν έγγραφα (7 μέρες) → Email",
    category: "reception",
    triggerType: "request.docs_missing",
    defaultTriggerConfig: { offsetDays: 7 },
    buildGraph: () => receptionDocsMissing(7),
  },
  {
    key: "reception_status",
    name: "Ενημέρωση status",
    nameGr: "Ενημέρωση status",
    description: "Σύντομη ενημέρωση όταν αλλάζει η κατάσταση.",
    descriptionGr: "Σύντομη ενημέρωση όταν αλλάζει η κατάσταση.",
    logic: "Αλλαγή κατάστασης → Email",
    logicGr: "Αλλαγή κατάστασης → Email",
    category: "reception",
    triggerType: "request.status_changed",
    buildGraph: () => receptionStatusUpdate(),
  },
  {
    key: "reception_stuck",
    name: "Κολλημένο αίτημα",
    nameGr: "Κολλημένο αίτημα",
    description: "Υπενθύμιση να πάρεις τηλέφωνο τον πελάτη.",
    descriptionGr: "Υπενθύμιση να πάρεις τηλέφωνο τον πελάτη.",
    logic: "Λείπουν έγγραφα (14 μέρες) → Ειδοποίηση",
    logicGr: "Λείπουν έγγραφα (14 μέρες) → Ειδοποίηση",
    category: "reception",
    triggerType: "request.docs_missing",
    defaultTriggerConfig: { offsetDays: 14 },
    buildGraph: () => receptionStuckAgent(),
  },
  {
    key: "reception_lead_unanswered",
    name: "Lead χωρίς απάντηση",
    nameGr: "Lead χωρίς απάντηση",
    description: "Υπενθύμιση αν ένα lead μείνει «Νέο» για 24 ώρες.",
    descriptionGr: "Υπενθύμιση αν ένα lead μείνει «Νέο» για 24 ώρες.",
    logic: "Νέο lead → 24 ώρες → Ειδοποίηση",
    logicGr: "Νέο lead → 24 ώρες → Ειδοποίηση",
    category: "reception",
    triggerType: "request.created",
    buildGraph: () => receptionLeadUnanswered(),
  },
];

export const PRESET_GOAL_CATEGORIES: {
  id: PresetGoalCategory;
  label: string;
  labelGr: string;
}[] = [
  { id: "popular", label: "Popular", labelGr: "Δημοφιλή" },
  { id: "forms_leads", label: "Forms & leads", labelGr: "Φόρμες & leads" },
  { id: "newsletter", label: "Newsletter", labelGr: "Newsletter" },
  { id: "bookings", label: "Bookings", labelGr: "Κρατήσεις" },
  { id: "contacts", label: "Contacts", labelGr: "Επαφές" },
  { id: "time", label: "Time-based", labelGr: "Χρονικά" },
  { id: "reception", label: "Leads", labelGr: "Leads" },
];

export function getAutomationPreset(key: string): AutomationPreset | undefined {
  return AUTOMATION_PRESETS.find((p) => p.key === key);
}

export function presetsForCategory(category: PresetGoalCategory): AutomationPreset[] {
  if (category === "popular") {
    return AUTOMATION_PRESETS.filter((p) => p.popular || p.featured);
  }
  return AUTOMATION_PRESETS.filter((p) => p.category === category);
}

export function featuredPresets(): AutomationPreset[] {
  return AUTOMATION_PRESETS.filter((p) => p.featured);
}
