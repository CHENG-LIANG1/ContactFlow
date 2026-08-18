import * as Calendar from "expo-calendar";
import * as Contacts from "expo-contacts";

import type { ActionProposal, NativeReceipt } from "@/domain/actions";

export class ActionCancelledError extends Error {
  constructor() {
    super("操作已取消，没有写入系统数据。");
  }
}

async function requireCalendarPermission(): Promise<void> {
  const permission = await Calendar.requestCalendarPermissions(true);
  if (!permission.granted) {
    throw new Error("需要日历写入权限才能创建会议。");
  }
}

async function requireContactsPermission(): Promise<void> {
  const permission = await Contacts.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error("需要通讯录权限才能保存联系人变更。");
  }
}

/** Executes exactly one user-confirmed native action and returns the system object id. */
export async function executeNativeAction(
  action: ActionProposal,
): Promise<NativeReceipt> {
  if (action.type === "create_meeting") {
    await requireCalendarPermission();
    const calendar = Calendar.getDefaultCalendarSync();
    const event = await calendar.createEvent({
      title: action.payload.title,
      startDate: new Date(action.payload.startAt),
      endDate: new Date(action.payload.endAt),
      location: action.payload.location,
      notes: `由 ContactFlow 确认创建 · ${action.payload.contactName}`,
    });
    return { nativeObjectId: event.id, executedAt: new Date().toISOString() };
  }

  if (action.type === "create_contact") {
    await requireContactsPermission();
    const contact = await Contacts.Contact.create({
      familyName: action.payload.familyName,
      givenName: action.payload.givenName,
      company: action.payload.company,
      phones: [{ label: "mobile", number: action.payload.phone }],
    });
    return { nativeObjectId: contact.id, executedAt: new Date().toISOString() };
  }

  await requireContactsPermission();
  const contact = await Contacts.Contact.presentPicker();
  if (!contact) throw new ActionCancelledError();
  await contact.patch({
    company: action.payload.company,
    jobTitle: action.payload.jobTitle,
  });
  return { nativeObjectId: contact.id, executedAt: new Date().toISOString() };
}
