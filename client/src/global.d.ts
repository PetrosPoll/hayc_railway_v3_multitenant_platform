// Global type declarations

// Facebook Pixel
declare global {
  interface Window {
    fbq?: (action: string, eventName: string, params?: Record<string, any>) => void;
  }
}

export {};
