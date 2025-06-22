import { Client } from "discord.js";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
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
 * @returns The string with the placeholders replaced.
 */
function replacePlaceholders(template: string, replacements: Record<string, string>): string {
  return template.replace(/\{(\w+)}/g, (match, key) => {
    return key in replacements ? replacements[key] : match;
  });
}

/**
 * Returns a string of missing permissions in a human-readable format.
 * @param client - Client instance
 * @param missing - Array of missing permissions
 * @param language - The language code
 * @returns A string of missing permissions in a human-readable format.
 */
function missingPermissionsAsString(client: Client, missing: string[], language: string) {
  const t = client.i18next.getFixedT(language);
  return missing.map((perm) => t(`permissions:${perm}`)).join(", ");
}
/**
 * Converts a bigint or string to a string.
 * @param id - The bigint or string to convert.
 * @returns The string representation of the bigint or string.
 */
function toStringId(id: bigint | string | null): string | "0" {
  if (!id) return "0";
  return id.toString();
}

dayjs.extend(duration);
/**
 * Formats a duration in milliseconds to a string.
 * @param ms - The duration in milliseconds.
 * @returns A formatted string representing the duration.
 */
function formatDuration(ms: number): string {
  const d = dayjs.duration(ms);
  const hours = d.hours();
  const minutes = d.minutes().toString().padStart(2, "0");
  const seconds = d.seconds().toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${minutes}:${seconds}` // e.g., 1:02:15
    : `${minutes}:${seconds}`; // e.g., 02:15
}
/**
 * Trims a string to a specified maximum length, ensuring it does not cut off words.
 * If the string is longer than the maximum length, it will be trimmed and an ellipsis will be added.
 * @param str - The string to trim.
 * @param maxLength - The maximum length of the string.
 * @returns The trimmed string with an ellipsis if it was trimmed.
 */
function trimString(str: string, maxLength = 100): string {
  if (str.length <= maxLength) return str;
  const trimmed = str.slice(0, maxLength);
  return trimmed.slice(0, trimmed.lastIndexOf(" ")) + "...";
}

export { sleep, missingPermissionsAsString, replacePlaceholders, toStringId, formatDuration, trimString };
