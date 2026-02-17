export interface SampleTemplate {
  id: string;
  name: string;
  category: string;
  htmlPath: string;
  thumbnail?: string;
  description?: string;
}

export const sampleTemplates: SampleTemplate[] = [
  {
    id: "sports-newsletter",
    name: "Sports Newsletter",
    category: "Newsletter",
    htmlPath: "/email-templates/sports-newsletter/template.html",
    description: "A modern sports-themed newsletter template",
  },
  {
    id: "restaurant-email",
    name: "Restaurant Email",
    category: "Restaurant",
    htmlPath: "/email-templates/restaurant-email/template.html",
    description: "A restaurant email template for new subscribers",
  }
];

/**
 * Converts an image file to a base64 data URL
 */
async function imageToDataUrl(imagePath: string): Promise<string> {
  try {
    const response = await fetch(imagePath);
    if (!response.ok) {
      throw new Error(`Failed to load image: ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Error converting image to data URL: ${imagePath}`, error);
    return imagePath; // Return original path on error
  }
}

/**
 * Processes HTML content to convert relative image paths to base64 data URLs
 * This bypasses CORS/unknown address space issues by embedding images directly in HTML
 * NOTE: Images are now hosted on Cloudinary, so this function only processes local images
 * if any remain. Cloudinary URLs are left as-is.
 * @param html - The HTML content to process
 * @param templatePath - The base path for the template (e.g., "/email-templates/sports-newsletter")
 * @returns Processed HTML with base64 data URL image paths (or original if all images are external)
 */
export async function processImagePaths(html: string, templatePath: string): Promise<string> {
  let processedHtml = html;
  
  // Find all image references in the HTML (only local images starting with "images/")
  // Skip URLs that are already full URLs (http/https) - these are Cloudinary URLs
  const imageSrcRegex = /src=(["'])(images\/[^"']+)\1/g;
  const imageUrlRegex = /url\((['"]?)(images\/[^"')]+)\1\)/g;
  
  const imagePaths = new Set<string>();
  let match;
  
  // Collect all unique local image paths (skip if already a full URL)
  while ((match = imageSrcRegex.exec(processedHtml)) !== null) {
    const imagePath = match[2];
    // Only process if it's a relative path, not a full URL
    if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://')) {
      imagePaths.add(imagePath);
    }
  }
  imageSrcRegex.lastIndex = 0; // Reset regex
  
  while ((match = imageUrlRegex.exec(processedHtml)) !== null) {
    const imagePath = match[2];
    // Only process if it's a relative path, not a full URL
    if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://')) {
      imagePaths.add(imagePath);
    }
  }
  
  // If no local images found, return HTML as-is (all images are already external/Cloudinary)
  if (imagePaths.size === 0) {
    return processedHtml;
  }
  
  // Convert each local image to base64 data URL
  const imageDataUrls: Record<string, string> = {};
  await Promise.all(
    Array.from(imagePaths).map(async (imagePath) => {
      // imagePath already includes "images/", so just append it to templatePath
      const fullPath = `${templatePath}/${imagePath}`;
      const dataUrl = await imageToDataUrl(fullPath);
      imageDataUrls[imagePath] = dataUrl;
    })
  );
  
  // Replace all local image paths with data URLs
  processedHtml = processedHtml.replace(
    /src=(["'])(images\/[^"']+)\1/g,
    (match, quote, imagePath) => {
      // Skip if already a full URL (Cloudinary)
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return match;
      }
      return `src=${quote}${imageDataUrls[imagePath] || imagePath}${quote}`;
    }
  );
  
  processedHtml = processedHtml.replace(
    /url\((['"]?)(images\/[^"')]+)\1\)/g,
    (match, quote, imagePath) => {
      // Skip if already a full URL (Cloudinary)
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return match;
      }
      return `url(${quote}${imageDataUrls[imagePath] || imagePath}${quote})`;
    }
  );
  
  return processedHtml;
}

/**
 * Loads a sample template HTML and processes image paths
 * @param template - The sample template to load
 * @returns Processed HTML ready for Unlayer editor
 */
export async function loadSampleTemplate(template: SampleTemplate): Promise<string> {
  try {
    const response = await fetch(template.htmlPath);
    if (!response.ok) {
      throw new Error(`Failed to load template: ${response.statusText}`);
    }

    const html = await response.text();
    const templatePath = template.htmlPath.replace("/template.html", "");
    const processedHtml = await processImagePaths(html, templatePath);

    return processedHtml;
  } catch (error) {
    console.error("Error loading sample template:", error);
    throw error;
  }
}
