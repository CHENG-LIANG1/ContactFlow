import {
  type ActionProposal,
  type HistoryRecord,
  type MemoryFact,
} from "@/domain/actions";
import type { ChatSession } from "@/domain/chat";

export type ContactMeeting = {
  id: string;
  title: string;
  executedAt: string;
  scheduledAt?: string;
};

export type RelationshipContact = {
  id: string;
  name: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  facts: MemoryFact[];
  meetings: ContactMeeting[];
  lastActivityAt: string;
};

type RelationshipInput = {
  chatSessions: ChatSession[];
  history: HistoryRecord[];
  memories: MemoryFact[];
};

type ContactDraft = Omit<RelationshipContact, "facts" | "meetings"> & {
  facts: MemoryFact[];
  meetings: ContactMeeting[];
};

function contactKey(name: string) {
  return name.trim().toLocaleLowerCase();
}

function latestDate(...values: string[]) {
  return values.reduce(
    (latest, value) =>
      Date.parse(value) > Date.parse(latest) ? value : latest,
    "1970-01-01T00:00:00.000Z",
  );
}

/** Builds the relationship view only from user-confirmed native receipts. */
export function buildRelationshipContacts({
  chatSessions,
  history,
  memories,
}: RelationshipInput): RelationshipContact[] {
  const confirmedActionIds = new Set(history.map((record) => record.actionId));
  const confirmedActions = new Map<string, ActionProposal>();
  const contacts = new Map<string, ContactDraft>();

  const ensureContact = (name: string, timestamp: string) => {
    const cleanName = name.trim();
    const key = contactKey(cleanName);
    const current = contacts.get(key);
    if (current) {
      current.lastActivityAt = latestDate(current.lastActivityAt, timestamp);
      return current;
    }
    const next: ContactDraft = {
      id: `relationship-${key.replace(/[^\p{L}\p{N}]+/gu, "-")}`,
      name: cleanName,
      facts: [],
      meetings: [],
      lastActivityAt: timestamp,
    };
    contacts.set(key, next);
    return next;
  };

  for (const session of chatSessions) {
    for (const action of session.analysis?.actions ?? []) {
      if (!confirmedActionIds.has(action.id)) continue;
      confirmedActions.set(action.id, action);
    }
  }

  for (const record of [...history].sort(
    (left, right) => Date.parse(left.executedAt) - Date.parse(right.executedAt),
  )) {
    const contact = ensureContact(record.contactName, record.executedAt);
    const action = confirmedActions.get(record.actionId);
    if (action) {
      if (action.type === "create_contact") {
        contact.company = action.payload.company || contact.company;
        contact.phone = action.payload.phone || contact.phone;
        contact.email = action.payload.email || contact.email;
      } else if (action.type === "update_contact") {
        contact.company = action.payload.company;
        contact.jobTitle = action.payload.jobTitle;
        contact.email = action.payload.email || contact.email;
      }
    }
    if (record.type === "create_meeting") {
      contact.meetings.push({
        id: record.id,
        title: record.title,
        executedAt: record.executedAt,
        scheduledAt:
          action?.type === "create_meeting" ? action.payload.startAt : undefined,
      });
    }
  }

  for (const memory of memories) {
    const contact = ensureContact(memory.contactName, memory.createdAt);
    contact.facts.push(memory);
    if (memory.label === "联系方式" && !contact.phone) {
      contact.phone = memory.value;
    }
  }

  return [...contacts.values()]
    .map((contact) => ({
      ...contact,
      facts: [...contact.facts].sort(
        (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
      ),
      meetings: [...contact.meetings].sort(
        (left, right) =>
          Date.parse(right.scheduledAt ?? right.executedAt) -
          Date.parse(left.scheduledAt ?? left.executedAt),
      ),
    }))
    .sort(
      (left, right) =>
        Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt) ||
        left.name.localeCompare(right.name),
    );
}
