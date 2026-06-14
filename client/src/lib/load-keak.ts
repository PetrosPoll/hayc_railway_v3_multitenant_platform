const KEAK_SCRIPT_ID = "keak-script";
const KEAK_SCRIPT_SRC = "https://script.keak.com/v1/2304";

export function loadKeakScript(): void {
  if (typeof document === "undefined" || document.getElementById(KEAK_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement("script");
  script.id = KEAK_SCRIPT_ID;
  script.src = KEAK_SCRIPT_SRC;
  script.dataset.domain = "2304";
  script.defer = true;
  document.body.appendChild(script);
}
