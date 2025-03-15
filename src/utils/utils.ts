import { KhaxyClient } from "../../@types/types";

/**
 * Pauses execution for a specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to sleep.
 * @returns A promise that resolves after the specified time.
 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Replaces placeholders in a string with the values from an object.
 * @param template - The string with placeholders.
 * @param replacements - The object with the values to replace.
 */
function replacePlaceholders(template: string, replacements: Record<string, string>): string {
  return template.replace(/\{(\w+)}/g, (match, key) => {
    return key in replacements ? replacements[key] : match;
  });
}

/**
 * Returns a string of missing permissions in a human-readable format.
 * @param client - KhaxyClient instance
 * @param missing - Array of missing permissions
 * @param language - The language code
 */
function missingPermissionsAsString(client: KhaxyClient, missing: string[], language: string) {
  const t = client.i18next.getFixedT(language);
  return missing.map((perm) => t(`permissions:${perm}`)).join(", ");
}
function toStringId(id: bigint | string | null): string | "0" {
  if (!id) return "0";
  return id.toString();
}
export { sleep, missingPermissionsAsString, replacePlaceholders, toStringId };
