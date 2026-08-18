import type { ActionProposal } from "@/domain/actions";

export const SAMPLE_CONTEXT =
  "下周二上午十点和林澈聊 ContactFlow 的演示，预计 30 分钟；把林澈的电话 138 0013 8000 存到通讯录。";

export const UPDATE_CONTEXT =
  "更新联系人：林澈现在加入 Northstar Studio，职位是 Design Lead。";

function nextWeekday(now: Date, weekday: number, hour: number): Date {
  const result = new Date(now);
  const daysAhead = (weekday - now.getDay() + 7) % 7 || 7;
  result.setDate(now.getDate() + daysAhead);
  result.setHours(hour, 0, 0, 0);
  return result;
}

function compactPhone(input: string): string {
  const match = input.match(/(?:\+?86[ -]?)?1[3-9][\d -]{9,13}/);
  return match?.[0].replace(/[ -]/g, "") ?? "13800138000";
}

function personName(input: string): string {
  const beforeVerb = input.match(
    /(?:和|联系人[:：]?|把)([\u4e00-\u9fa5]{2,4})(?:聊|现在|的|，|,)/,
  );
  return beforeVerb?.[1] ?? "林澈";
}

/**
 * The deterministic demo engine exercises the same action contract as a remote vision model.
 * Keeping it local makes the simulator runnable without transmitting the user's screenshot.
 */
export function analyzeDemoContext(
  input: string,
  now = new Date(),
): ActionProposal[] {
  const text = input.trim() || SAMPLE_CONTEXT;
  const name = personName(text);
  const actions: ActionProposal[] = [];
  const stamp = now.getTime();

  if (/更新|加入|职位|公司/.test(text)) {
    const company =
      text.match(/加入\s*([^，,。]+?)(?:，|,|。|$)/)?.[1] ?? "Northstar Studio";
    const jobTitle =
      text.match(/职位(?:是|为)?\s*([^，,。]+?)(?:，|,|。|$)/)?.[1] ??
      "Design Lead";
    actions.push({
      id: `update-${stamp}`,
      type: "update_contact",
      status: "proposed",
      confidence: "high",
      evidence: [
        { source: "user_note", excerpt: `${name} · ${company} · ${jobTitle}` },
      ],
      payload: { contactName: name, company, jobTitle },
    });
  }

  if (/聊|会议|见面|约|周[一二三四五六日天]|上午|下午/.test(text)) {
    const start = nextWeekday(now, 2, /下午/.test(text) ? 15 : 10);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    actions.push({
      id: `meeting-${stamp}`,
      type: "create_meeting",
      status: "proposed",
      confidence: "high",
      evidence: [
        { source: "user_note", excerpt: `下周二 10:00 · ${name} · 30 分钟` },
      ],
      payload: {
        title: `和${name}聊 ContactFlow`,
        contactName: name,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        location: "FaceTime",
      },
    });
  }

  if (/电话|手机|通讯录|联系人/.test(text) && !/更新/.test(text)) {
    actions.push({
      id: `contact-${stamp}`,
      type: "create_contact",
      status: "proposed",
      confidence: "medium",
      evidence: [
        { source: "user_note", excerpt: `${name} · ${compactPhone(text)}` },
      ],
      payload: {
        familyName: name.slice(0, 1),
        givenName: name.slice(1),
        phone: compactPhone(text),
        company: "Northstar Studio",
      },
    });
  }

  return actions.length > 0 ? actions : analyzeDemoContext(SAMPLE_CONTEXT, now);
}
