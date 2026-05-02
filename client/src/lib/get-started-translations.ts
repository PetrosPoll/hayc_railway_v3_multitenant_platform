import { BUSINESS_TYPES, GOALS } from "@/pages/get-started";

export const BUSINESS_TYPE_I18N_KEY: Record<
  (typeof BUSINESS_TYPES)[number],
  string
> = {
  "Local Business": "getStarted.businessType.options.localBusiness",
  "Service Business": "getStarted.businessType.options.serviceBusiness",
  "Personal Brand": "getStarted.businessType.options.personalBrand",
  "Creative Business": "getStarted.businessType.options.creativeBusiness",
  "Online Store": "getStarted.businessType.options.onlineStore",
  "Hospitality/Travel": "getStarted.businessType.options.hospitalityTravel",
  "Health/Wellness": "getStarted.businessType.options.healthWellness",
  Other: "getStarted.businessType.options.other",
};

export const GOAL_I18N_KEY: Record<(typeof GOALS)[number], string> = {
  "Get more enquiries": "getStarted.goal.options.getMoreEnquiries",
  "Book more appointments": "getStarted.goal.options.bookMoreAppointments",
  "Sell products online": "getStarted.goal.options.sellProductsOnline",
  "Showcase my work": "getStarted.goal.options.showcaseMyWork",
  "Build trust in my business": "getStarted.goal.options.buildTrust",
  "Share information clearly": "getStarted.goal.options.shareInformationClearly",
  "Something else": "getStarted.goal.options.somethingElse",
};

export const CHOOSE_DESIGN_OPTION_KEY = {
  "clean-minimal": "getStarted.chooseDesign.options.cleanMinimal",
  "bold-modern": "getStarted.chooseDesign.options.boldModern",
  "warm-organic": "getStarted.chooseDesign.options.warmOrganic",
} as const;

export type ChooseDesignOptionId = keyof typeof CHOOSE_DESIGN_OPTION_KEY;

export const SUMMARY_SELECTED_DESIGN_I18N_KEY: Record<string, string> = {
  auto: "getStarted.summary.designLabels.auto",
  "clean-minimal": "getStarted.summary.designLabels.cleanMinimal",
  "bold-modern": "getStarted.summary.designLabels.boldModern",
  "warm-organic": "getStarted.summary.designLabels.warmOrganic",
};
