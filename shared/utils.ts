/**
 * Generates a unique identifier in the format: hayc-{8 random alphanumeric chars}
 * Example: hayc-x7k2p9m4
 */
export function generateUniqueIdentifier(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  
  for (let i = 0; i < 8; i++) {
    randomPart += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return `hayc-${randomPart}`;
}
