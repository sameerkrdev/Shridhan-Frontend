import type { ActivityItem } from "@/lib/activityApi";

const ACCOUNT_ENTITY_TYPES = new Set(["FD_ACCOUNT", "MIS_ACCOUNT", "RD_ACCOUNT"]);

const toDisplayValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const getMetadata = (item: ActivityItem): Record<string, unknown> =>
  item.metadata && typeof item.metadata === "object" ? item.metadata : {};

export const formatActivityDetails = (item: ActivityItem): string => {
  const metadata = getMetadata(item);
  const details: string[] = [];

  if (ACCOUNT_ENTITY_TYPES.has(item.entityType)) {
    details.push(`Account: ${item.entityId}`);
  }

  if (item.actionType === "INTEREST_PAID") {
    const months = toDisplayValue(metadata.months);
    const amount = toDisplayValue(metadata.amount);
    if (months) details.push(`Months: ${months}`);
    if (amount) details.push(`Amount: ${amount}`);
  } else if (item.actionType === "UPDATED") {
    const action = toDisplayValue(metadata.action);
    if (action) details.push(`Update: ${action}`);
  } else if (item.actionType === "CREATED") {
    if (!ACCOUNT_ENTITY_TYPES.has(item.entityType)) {
      const name = toDisplayValue(metadata.name);
      if (name) details.push(`Name: ${name}`);
    }
  } else {
    const amount = toDisplayValue(metadata.amount);
    if (amount) details.push(`Amount: ${amount}`);
  }

  if (details.length > 0) {
    return details.join(" | ");
  }

  const fallbackMetadata = Object.entries(metadata)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${toDisplayValue(value)}`)
    .filter(Boolean);
  if (fallbackMetadata.length > 0) {
    return fallbackMetadata.join(" | ");
  }

  return `Entity: ${item.entityId}`;
};
