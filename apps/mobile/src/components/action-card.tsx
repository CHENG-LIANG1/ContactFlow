import {
  CalendarPlus,
  Check,
  ContactRound,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react-native";
import type { ComponentType } from "react";
import {
  Alert,
  StyleSheet,
} from "react-native";

import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { fonts, palette, spacing } from "@/constants/theme";
import type { ActionProposal } from "@/domain/actions";
import type { AppLanguage } from "@/domain/preferences";

type ActionCardProps = {
  accent: string;
  action: ActionProposal;
  language: AppLanguage;
  onChange: (patch: Record<string, string>) => void;
  onExecute: () => void;
};

type EditableField = {
  key: string;
  label: string;
  value: string;
  editable?: boolean;
};

function fieldsForAction(
  action: ActionProposal,
  language: AppLanguage,
): EditableField[] {
  const copy = actionCopy[language];
  if (action.type === "create_meeting") {
    const time = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(action.payload.startAt));
    return [
      {
        key: "title",
        label: copy.meeting,
        value: action.payload.title,
        editable: true,
      },
      { key: "startAt", label: copy.time, value: time },
      {
        key: "location",
        label: copy.location,
        value: action.payload.location,
        editable: true,
      },
    ];
  }
  if (action.type === "create_contact") {
    return [
      {
        key: "name",
        label: copy.name,
        value: `${action.payload.familyName}${action.payload.givenName}`,
      },
      {
        key: "phone",
        label: copy.phone,
        value: action.payload.phone,
        editable: true,
      },
      {
        key: "company",
        label: copy.company,
        value: action.payload.company,
        editable: true,
      },
    ];
  }
  return [
    {
      key: "contactName",
      label: copy.target,
      value: `${action.payload.contactName}${copy.chooseOnExecute}`,
    },
    {
      key: "company",
      label: copy.company,
      value: action.payload.company,
      editable: true,
    },
    {
      key: "jobTitle",
      label: copy.role,
      value: action.payload.jobTitle,
      editable: true,
    },
  ];
}

function actionMeta(action: ActionProposal, language: AppLanguage): {
  label: string;
  title: string;
  icon: ComponentType<{ color: string; size: number; strokeWidth: number }>;
} {
  const copy = actionCopy[language];
  if (action.type === "create_meeting") {
    return {
      label: "CREATE MEETING",
      title: copy.scheduleMeeting,
      icon: CalendarPlus,
    };
  }
  if (action.type === "create_contact") {
    return {
      label: "CREATE CONTACT",
      title: copy.saveContact,
      icon: ContactRound,
    };
  }
  return { label: "UPDATE CONTACT", title: copy.updateContact, icon: RefreshCcw };
}

export function ActionCard({
  accent,
  action,
  language,
  onChange,
  onExecute,
}: ActionCardProps) {
  const copy = actionCopy[language];
  const meta = actionMeta(action, language);
  const Icon = meta.icon;
  const readOnly =
    action.status === "executing" || action.status === "succeeded";

  const requestConfirmation = () => {
    Alert.alert(
      meta.title,
      action.type === "create_meeting"
        ? copy.meetingConfirm
        : action.type === "create_contact"
          ? copy.contactConfirm
          : copy.updateConfirm,
      [
        { text: copy.cancel, style: "cancel" },
        { text: copy.confirm, onPress: onExecute },
      ],
    );
  };

  return (
    <Card
      style={[
        styles.card,
        action.status === "succeeded" && styles.cardSucceeded,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Icon color={palette.paper} size={18} strokeWidth={1.5} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>{meta.label}</Text>
          <Text style={styles.title}>{meta.title}</Text>
        </View>
        <View style={styles.confidence}>
          <View style={styles.confidenceDot} />
          <Text style={styles.confidenceText}>
            {action.confidence === "high" ? copy.high : copy.medium}
          </Text>
        </View>
      </View>

      <View style={styles.fields}>
        {fieldsForAction(action, language).map((field) => (
          <View key={field.key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            {field.editable && !readOnly ? (
              <Input className="h-9 flex-1 border-0 bg-transparent px-0">
                <InputField
                  accessibilityLabel={`${meta.title}${field.label}`}
                  onChangeText={(value) => onChange({ [field.key]: value })}
                  selectionColor={palette.paper}
                  style={styles.fieldInput}
                  value={field.value}
                />
              </Input>
            ) : (
              <Text style={styles.fieldValue}>{field.value}</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.evidenceRow}>
        <ShieldCheck color={palette.smoke} size={13} strokeWidth={1.5} />
        <Text numberOfLines={2} style={styles.evidence}>
          {copy.evidence} · {action.evidence[0]?.excerpt}
        </Text>
      </View>

      {action.error ? <Text style={styles.error}>{action.error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${meta.title}, ${action.status === "succeeded" ? copy.completed : copy.confirm}`}
        disabled={
          action.status === "executing" || action.status === "succeeded"
        }
        onPress={requestConfirmation}
        style={({ pressed }) => [
          styles.execute,
          { backgroundColor: accent },
          action.status === "succeeded" && styles.executeSucceeded,
          pressed && styles.executePressed,
        ]}
      >
        {action.status === "succeeded" ? (
          <Check color={palette.void} size={16} strokeWidth={2} />
        ) : null}
        <Text style={styles.executeText}>
          {action.status === "executing"
            ? copy.executing
            : action.status === "succeeded"
              ? copy.completed
              : action.status === "failed"
                ? copy.retry
                : copy.confirm}
        </Text>
      </Pressable>
    </Card>
  );
}

const actionCopy = {
  zh: {
    meeting: "会议",
    time: "时间",
    location: "地点",
    name: "姓名",
    phone: "手机",
    company: "公司",
    target: "目标",
    role: "职位",
    chooseOnExecute: "（执行时选择）",
    scheduleMeeting: "安排一次会面",
    saveContact: "保存新联系人",
    updateContact: "补全联系人资料",
    meetingConfirm: "确认后将请求日历写入权限，并在默认日历创建这场会议。",
    contactConfirm: "确认后将请求通讯录权限，并创建这一位联系人。",
    updateConfirm: "确认后将打开系统联系人选择器，只更新你看到的公司和职位。",
    cancel: "取消",
    confirm: "确认并执行",
    high: "高",
    medium: "中",
    evidence: "依据",
    executing: "正在写入系统…",
    completed: "已确认完成",
    retry: "检查后重试",
  },
  en: {
    meeting: "Meeting",
    time: "Time",
    location: "Location",
    name: "Name",
    phone: "Phone",
    company: "Company",
    target: "Target",
    role: "Role",
    chooseOnExecute: " (choose when executing)",
    scheduleMeeting: "Schedule a meeting",
    saveContact: "Save new contact",
    updateContact: "Update contact details",
    meetingConfirm: "This requests Calendar access and creates the meeting in your default calendar.",
    contactConfirm: "This requests Contacts access and creates this contact.",
    updateConfirm: "This opens the system contact picker and only updates company and role.",
    cancel: "Cancel",
    confirm: "Confirm and run",
    high: "High",
    medium: "Medium",
    evidence: "Evidence",
    executing: "Writing to system…",
    completed: "Completed",
    retry: "Review and retry",
  },
} as const;

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    backgroundColor: "#171816",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  cardSucceeded: { borderColor: "rgba(205,232,212,0.34)" },
  header: { flexDirection: "row", alignItems: "center" },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.graphite,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, marginLeft: spacing.md },
  kicker: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: 8,
    letterSpacing: 0.9,
  },
  title: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    marginTop: 3,
  },
  confidence: { flexDirection: "row", alignItems: "center", gap: 5 },
  confidenceDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.success,
  },
  confidenceText: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  fields: {
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  fieldRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  fieldLabel: {
    width: 48,
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  fieldValue: {
    flex: 1,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    textAlign: "right",
  },
  fieldInput: {
    flex: 1,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    textAlign: "right",
    paddingVertical: 10,
  },
  evidenceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: spacing.md,
  },
  evidence: {
    flex: 1,
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  error: {
    color: palette.danger,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  execute: {
    marginTop: spacing.md,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.paper,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  executeSucceeded: { backgroundColor: palette.success },
  executePressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  executeText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
});
