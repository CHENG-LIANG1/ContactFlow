import {
  CalendarPlus,
  Check,
  ContactRound,
  RefreshCcw,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, type ColorValue } from "react-native";

import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  palette,
  spacing,
  typeScale,
} from "@/constants/theme";
import type { ActionProposal } from "@/domain/actions";
import type { AgentPermissionMode, AppLanguage } from "@/domain/preferences";

type ActionCardProps = {
  accent: ColorValue;
  action: ActionProposal;
  language: AppLanguage;
  onChange: (patch: Record<string, string>) => void;
  onExecute: () => void;
  permissionMode: AgentPermissionMode;
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
    const time = new Intl.DateTimeFormat(
      language === "zh" ? "zh-CN" : "en-US",
      {
        month: "short",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(new Date(action.payload.startAt));
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
      {
        key: "email",
        label: copy.email,
        value: action.payload.email,
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
    {
      key: "email",
      label: copy.email,
      value: action.payload.email,
      editable: true,
    },
  ];
}

function actionMeta(
  action: ActionProposal,
  language: AppLanguage,
): {
  label: string;
  title: string;
  icon: LucideIcon;
} {
  const copy = actionCopy[language];
  if (action.type === "create_meeting") {
    return {
      label: copy.createMeetingLabel,
      title: copy.scheduleMeeting,
      icon: CalendarPlus,
    };
  }
  if (action.type === "create_contact") {
    return {
      label: copy.createContactLabel,
      title: copy.saveContact,
      icon: ContactRound,
    };
  }
  return {
    label: copy.updateContactLabel,
    title: copy.updateContact,
    icon: RefreshCcw,
  };
}

export function ActionCard({
  accent,
  action,
  language,
  onChange,
  onExecute,
  permissionMode,
}: ActionCardProps) {
  const copy = actionCopy[language];
  const meta = actionMeta(action, language);
  const Icon = meta.icon;
  const [isEditing, setIsEditing] = useState(false);
  const readOnly =
    action.status === "executing" || action.status === "succeeded";

  const updateField = (field: EditableField, value: string) => {
    if (action.type === "create_contact" && field.key === "name") {
      onChange({ familyName: "", givenName: value });
      return;
    }
    onChange({ [field.key]: value });
  };

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
          <Icon
            color={palette.paper}
            size={iconSize.medium}
            strokeWidth={1.5}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>{meta.label}</Text>
          <Text style={styles.title}>{meta.title}</Text>
        </View>
        <View style={styles.confidence}>
          <View style={styles.confidenceDot} />
          <Text style={styles.confidenceText}>
            {action.confidence === "high"
              ? copy.high
              : action.confidence === "medium"
                ? copy.medium
                : copy.low}
          </Text>
        </View>
      </View>

      <View style={styles.fields}>
        {fieldsForAction(action, language).map((field) => (
          <View key={field.key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            {(field.editable || field.key === "name") &&
            isEditing &&
            !readOnly ? (
              <Input className="h-10 flex-1" style={styles.inputShell}>
                <InputField
                  accessibilityLabel={`${meta.title}${field.label}`}
                  maxFontSizeMultiplier={1.35}
                  onChangeText={(value) => updateField(field, value)}
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

      {action.error ? <Text style={styles.error}>{action.error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${isEditing ? copy.doneEditing : copy.edit} ${meta.title}`}
          disabled={readOnly}
          onPress={() => setIsEditing((current) => !current)}
          style={[
            styles.actionButton,
            styles.editButton,
            readOnly && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.editText}>
            {isEditing ? copy.doneEditing : copy.edit}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${meta.title}, ${action.status === "succeeded" ? copy.completed : copy.run}`}
          disabled={readOnly}
          onPress={() => {
            setIsEditing(false);
            if (permissionMode === "full") onExecute();
            else requestConfirmation();
          }}
          style={[
            styles.actionButton,
            styles.execute,
            { backgroundColor: accent },
            action.status === "succeeded" && styles.executeSucceeded,
            readOnly && styles.buttonDisabled,
          ]}
        >
          {action.status === "succeeded" ? (
            <Check color={palette.void} size={iconSize.small} strokeWidth={2} />
          ) : null}
          <Text style={styles.executeText}>
            {action.status === "executing"
              ? copy.executing
              : action.status === "succeeded"
                ? copy.completed
                : action.status === "failed"
                  ? copy.retry
                  : copy.run}
          </Text>
        </Pressable>
      </View>
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
    email: "邮箱",
    target: "目标",
    role: "职位",
    chooseOnExecute: "（执行时选择）",
    scheduleMeeting: "安排一次会面",
    createMeetingLabel: "创建会议",
    saveContact: "保存新联系人",
    createContactLabel: "创建联系人",
    updateContact: "补全联系人资料",
    updateContactLabel: "更新联系人",
    meetingConfirm:
      "确认后将请求日历完整访问权限，用于读取默认日历并创建这场会议；ContactFlow 不会读取你的日程内容。",
    contactConfirm: "确认后将请求通讯录权限，并创建这一位联系人。",
    updateConfirm:
      "确认后将打开系统联系人选择器，只更新你看到的公司、职位和工作邮箱。",
    cancel: "取消",
    confirm: "确认并执行",
    run: "执行",
    high: "高",
    medium: "中",
    low: "低",
    executing: "正在写入系统…",
    completed: "已确认完成",
    retry: "检查后重试",
    edit: "编辑",
    doneEditing: "完成编辑",
  },
  en: {
    meeting: "Meeting",
    time: "Time",
    location: "Location",
    name: "Name",
    phone: "Phone",
    company: "Company",
    email: "Email",
    target: "Target",
    role: "Role",
    chooseOnExecute: " (choose when executing)",
    scheduleMeeting: "Schedule a meeting",
    createMeetingLabel: "Create meeting",
    saveContact: "Save new contact",
    createContactLabel: "Create contact",
    updateContact: "Update contact details",
    updateContactLabel: "Update contact",
    meetingConfirm:
      "This requests full Calendar access to locate your default calendar and create the meeting. ContactFlow does not read your events.",
    contactConfirm: "This requests Contacts access and creates this contact.",
    updateConfirm:
      "This opens the system contact picker and only updates company, role, and work email.",
    cancel: "Cancel",
    confirm: "Confirm and run",
    run: "Run",
    high: "High",
    medium: "Medium",
    low: "Low",
    executing: "Writing to system…",
    completed: "Completed",
    retry: "Review and retry",
    edit: "Edit",
    doneEditing: "Done",
  },
} as const;

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    backgroundColor: palette.ink,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  cardSucceeded: { borderColor: palette.success },
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
    fontSize: typeScale.caption,
    letterSpacing: 0.35,
  },
  title: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.body,
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
    fontSize: typeScale.caption,
  },
  fields: {
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  fieldRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  fieldLabel: {
    width: 56,
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
  },
  fieldValue: {
    flex: 1,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    textAlign: "right",
    lineHeight: 20,
  },
  inputShell: {
    borderColor: palette.line,
    backgroundColor: palette.graphite,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
  },
  fieldInput: {
    flex: 1,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    textAlign: "right",
    paddingVertical: spacing.sm,
  },
  error: {
    color: palette.danger,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  actions: {
    marginTop: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  editButton: {
    backgroundColor: palette.graphite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  editText: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  execute: {},
  executeSucceeded: { backgroundColor: palette.success },
  buttonDisabled: { opacity: 0.52 },
  executeText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
});
