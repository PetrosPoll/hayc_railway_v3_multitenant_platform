import type { AutomationGraph } from "@shared/schema";

export type AutomationPreset = {
  key: string;
  name: string;
  nameGr: string;
  description: string;
  descriptionGr: string;
  /** Prefer contact forms; newsletter for welcome preset */
  formType?: "contact" | "newsletter" | "any";
  buildGraph: (formId: string, formName: string) => AutomationGraph;
};

function replyAndNotify(formId: string, formName: string): AutomationGraph {
  return {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 40, y: 140 },
        data: { formId, formName },
      },
      {
        id: "email-1",
        type: "email",
        position: { x: 280, y: 80 },
        data: {
          subject: "We received your message — {{siteLabel}}",
          body: "Hi {{name}},\n\nThank you for contacting us. We will get back to you soon.\n\n— {{siteLabel}}",
        },
      },
      {
        id: "notify-1",
        type: "notify_owner",
        position: { x: 280, y: 220 },
        data: {
          subject: "New message from {{name}} — {{siteLabel}}",
          body: "Name: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\n\n{{message}}",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "email-1" },
      { id: "e2", source: "email-1", target: "notify-1" },
    ],
  };
}

function hotLead(formId: string, formName: string): AutomationGraph {
  return {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 40, y: 160 },
        data: { formId, formName },
      },
      {
        id: "email-1",
        type: "email",
        position: { x: 260, y: 80 },
        data: {
          subject: "Thanks {{name}} — {{siteLabel}}",
          body: "Hi {{name}},\n\nWe got your message and will reply shortly.",
        },
      },
      {
        id: "notify-1",
        type: "notify_owner",
        position: { x: 260, y: 220 },
        data: {
          subject: "New lead — {{name}}",
          body: "{{name}} <{{email}}>\n{{phone}}\n\n{{message}}",
        },
      },
      {
        id: "cond-1",
        type: "condition",
        position: { x: 500, y: 160 },
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
        position: { x: 740, y: 100 },
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

function welcomeNewsletter(formId: string, formName: string): AutomationGraph {
  return {
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 40, y: 140 },
        data: { formId, formName },
      },
      {
        id: "email-1",
        type: "email",
        position: { x: 280, y: 140 },
        data: {
          subject: "Welcome to {{siteLabel}}",
          body: "Hi {{name}},\n\nThanks for subscribing!",
        },
      },
      {
        id: "tag-1",
        type: "add_tag",
        position: { x: 520, y: 140 },
        data: { tag: "newsletter" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "email-1" },
      { id: "e2", source: "email-1", target: "tag-1" },
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
    formType: "contact",
    buildGraph: replyAndNotify,
  },
  {
    key: "hot_lead",
    name: "Hot lead",
    nameGr: "Ζεστό lead",
    description: "Reply, notify you, then remind you in 2h if there is a message.",
    descriptionGr: "Απάντηση, ειδοποίηση, υπενθύμιση σε 2ώρες αν υπάρχει μήνυμα.",
    formType: "contact",
    buildGraph: hotLead,
  },
  {
    key: "welcome_subscriber",
    name: "Welcome subscriber",
    nameGr: "Welcome νέου συνδρομητή",
    description: "Welcome email and tag newsletter.",
    descriptionGr: "Welcome email και tag newsletter.",
    formType: "newsletter",
    buildGraph: welcomeNewsletter,
  },
];

export function getAutomationPreset(key: string): AutomationPreset | undefined {
  return AUTOMATION_PRESETS.find((p) => p.key === key);
}
