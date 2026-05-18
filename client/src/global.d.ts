// Global type declarations

// Facebook Pixel
declare global {
  interface Window {
    fbq?: (action: string, eventName: string, params?: Record<string, any>) => void;
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (error: unknown, result: { event?: string; info?: Record<string, unknown> }) => void,
      ) => { open: () => void };
    };
  }
}

export {};
