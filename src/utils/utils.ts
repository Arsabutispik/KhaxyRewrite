import { KhaxyClient } from "../../@types/types";
import _ from "lodash";

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
 * Recursively sanitizes an object to include only read-only properties.
 * Limits the depth of recursion to avoid maximum call stack size exceeded errors.
 *
 * @param obj - The object to sanitize.
 * @param depth - The current depth of recursion.
 * @param maxDepth - The maximum allowed depth of recursion.
 * @param seen - A set to track seen objects and avoid circular references.
 * @returns A sanitized object with only the allowed properties.
 */
function sanitizeObject(
  obj: Record<string, any>,
  depth: number = 0,
  maxDepth: number = 10,
  seen: Set<any> = new Set(),
): Record<string, any> {
  if (depth > maxDepth || seen.has(obj)) {
    return {};
  }
  seen.add(obj);

  const sanitized: Record<string, any> = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        sanitized[key] = sanitizeObject(value, depth + 1, maxDepth, seen);
      } else if (typeof value !== "function") {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
}

/**
 * Replaces placeholders in the given template with corresponding values from the provided contexts.
 * Placeholders are in the format `#{context.property}` and support nested properties.
 *
 * @param template - The template string containing placeholders.
 * @param contexts - An object containing multiple contexts for resolving placeholders.
 * @param defaultValue - (Optional) A default value to use if a placeholder cannot be resolved.
 * @returns The template string with placeholders replaced by their corresponding values.
 */
function replacePlaceholders(
  template: string,
  contexts: Record<string, any>, // Supports multiple contexts as objects
  defaultValue: string = "",
): string {
  // Sanitize all contexts to ensure only read-only properties are accessible
  const sanitizedContexts = _.mapValues(contexts, (context) => sanitizeObject(context));

  return template.replace(/#{([\w.]+)}/g, (match, key) => {
    // Split the placeholder key into context and property path (e.g., "user.profile.name")
    const [, ...propertyPath] = key.split(".");
    // Safely access the nested value using lodash's get method
    const value = _.get(sanitizedContexts, [...propertyPath].join("."), defaultValue);

    // Log the resolved value for debugging
    console.log(`Resolved value for ${key}:`, value);

    // Return the resolved value, or use the default value or original placeholder if unresolved
    return value !== undefined ? String(value) : defaultValue || match;
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

export { sleep, replacePlaceholders, missingPermissionsAsString };
