import { cn } from "@/lib/utils";

/** Selected state for lifetime / limited access toggles in course & enrollment editors. */
export function accessToggleButtonClass(
  selected: boolean,
  mode: "lifetime" | "limited",
): string {
  if (!selected) return "";
  if (mode === "lifetime") {
    return cn(
      "bg-green-600 text-white border-green-600",
      "hover:bg-green-700 hover:text-white",
    );
  }
  return cn(
    "border-[#ED4C14] bg-[#ED4C14]/10 text-[#ED4C14]",
    "hover:bg-[#ED4C14]/15 hover:text-[#ED4C14]",
  );
}
