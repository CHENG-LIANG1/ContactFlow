import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { presentFormAsync } from "expo-contacts/legacy";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ContactRound,
  RefreshCcw,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  TextInput,
  useColorScheme,
  type ColorValue,
} from "react-native";

import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  palette,
  spacing,
  themeColors,
  typeScale,
} from "@/constants/theme";
import type { ActionProposal } from "@/domain/actions";
import {
  validateActionEdit,
  type EditFieldError,
} from "@/domain/edit-validation";
import { moveMeetingStart } from "@/domain/meeting-edit";
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
  dateTime?: "start" | "end";
  maxLength?: number;
};

function formatDateTime(value: string, language: AppLanguage): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function fieldsForAction(
  action: ActionProposal,
  language: AppLanguage,
): EditableField[] {
  const copy = actionCopy[language];
  if (action.type === "create_meeting") {
    return [
      {
        key: "title",
        label: copy.meeting,
        value: action.payload.title,
        editable: true,
        maxLength: 120,
      },
      {
        key: "startAt",
        label: copy.startTime,
        value: action.payload.startAt,
        dateTime: "start",
      },
      {
        key: "endAt",
        label: copy.endTime,
        value: action.payload.endAt,
        dateTime: "end",
      },
      {
        key: "location",
        label: copy.location,
        value: action.payload.location,
        editable: true,
        maxLength: 200,
      },
    ];
  }
  if (action.type === "create_contact") {
    return [
      {
        key: "name",
        label: copy.name,
        value: `${action.payload.familyName}${action.payload.givenName}`,
        maxLength: 80,
      },
      {
        key: "phone",
        label: copy.phone,
        value: action.payload.phone,
        editable: true,
        maxLength: 40,
      },
      {
        key: "company",
        label: copy.company,
        value: action.payload.company,
        editable: true,
        maxLength: 120,
      },
      {
        key: "email",
        label: copy.email,
        value: action.payload.email,
        editable: true,
        maxLength: 160,
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
      maxLength: 120,
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
  const colorScheme = useColorScheme();
  const meta = actionMeta(action, language);
  const Icon = meta.icon;
  const [isEditing, setIsEditing] = useState(false);
  // Edits stay in a local draft until saved or confirmed, so leaving the chat
  // (which unmounts the card) cancels them instead of persisting half-done
  // values into the session.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, EditFieldError>>({});
  const readOnly =
    action.status === "executing" || action.status === "succeeded";

  const draftValue = (field: EditableField) => draft[field.key] ?? field.value;

  const clearErrors = (...keys: string[]) => {
    setErrors((current) => {
      if (!keys.some((key) => key in current)) return current;
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
  };

  const currentValues = () => {
    const values: Record<string, string> = {};
    for (const field of fieldsForAction(action, language)) {
      values[field.key] = draftValue(field);
    }
    return values;
  };

  const errorTextFor = (code: EditFieldError) =>
    code === "required"
      ? copy.errorRequired
      : code === "email"
        ? copy.errorEmail
        : code === "phone"
          ? copy.errorPhone
          : copy.errorEndAfterStart;

  const updateField = (field: EditableField, value: string) => {
    clearErrors(field.key);
    setDraft((current) => ({ ...current, [field.key]: value }));
  };

  const updateMeetingTime = (
    field: EditableField,
    nextDate: Date,
  ): void => {
    if (action.type !== "create_meeting") return;
    clearErrors("startAt", "endAt");
    const startAt = draft.startAt ?? action.payload.startAt;
    const endAt = draft.endAt ?? action.payload.endAt;
    if (field.dateTime === "start") {
      setDraft((current) => ({
        ...current,
        ...moveMeetingStart(startAt, endAt, nextDate),
      }));
      return;
    }
    setDraft((current) => ({ ...current, endAt: nextDate.toISOString() }));
  };

  const commitDraft = () => {
    if (Object.keys(draft).length === 0) return;
    const { name, ...rest } = draft;
    const patch: Record<string, string> = { ...rest };
    if (action.type === "create_contact" && name !== undefined) {
      patch.familyName = "";
      patch.givenName = name;
    }
    onChange(patch);
    setDraft({});
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

  const openCalendarDay = async () => {
    if (action.type !== "create_meeting") return;
    // calshow: opens Calendar.app at the given absolute time.
    const seconds = Math.floor(
      (Date.parse(action.payload.startAt) - Date.UTC(2001, 0, 1)) / 1000,
    );
    try {
      await Linking.openURL(`calshow:${seconds}`);
    } catch {
      Alert.alert(copy.viewError, copy.viewErrorBody);
    }
  };

  const openContactCard = async () => {
    if (!action.nativeObjectId) return;
    try {
      await presentFormAsync(action.nativeObjectId);
    } catch {
      Alert.alert(copy.viewError, copy.viewErrorBody);
    }
  };

  const viewAction = (() => {
    if (action.type === "create_meeting") {
      return { label: copy.viewInCalendar, open: openCalendarDay };
    }
    if (action.nativeObjectId) {
      return { label: copy.viewContact, open: openContactCard };
    }
    return null;
  })();

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
        {fieldsForAction(action, language).map((field) => {
          const error = errors[field.key];
          return (
            <View key={field.key} style={styles.fieldWrap}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                {field.dateTime && isEditing && !readOnly ? (
                  <View style={styles.datePickerWrap}>
                    <DateTimePicker
                      accentColor={
                        themeColors[colorScheme === "dark" ? "dark" : "light"]
                          .accent
                      }
                      display="compact"
                      locale={language === "zh" ? "zh_CN" : "en_US"}
                      minimumDate={
                        field.dateTime === "end" &&
                        action.type === "create_meeting"
                          ? new Date(
                              Date.parse(
                                draft.startAt ?? action.payload.startAt,
                              ) + 60_000,
                            )
                          : undefined
                      }
                      mode="datetime"
                      onValueChange={(_event, date) =>
                        updateMeetingTime(field, date)
                      }
                      style={styles.datePicker}
                      testID={`meeting-${field.dateTime}-picker`}
                      themeVariant={colorScheme === "dark" ? "dark" : "light"}
                      value={new Date(draftValue(field))}
                    />
                  </View>
                ) : (field.editable || field.key === "name") &&
                  isEditing &&
                  !readOnly ? (
                  <TextInput
                    accessibilityLabel={`${meta.title}${field.label}`}
                    maxLength={field.maxLength}
                    maxFontSizeMultiplier={1.35}
                    onChangeText={(value) => updateField(field, value)}
                    placeholderTextColor={palette.smoke}
                    selectionColor={palette.accent}
                    style={styles.fieldInput}
                    value={draftValue(field)}
                  />
                ) : (
                  <Text style={styles.fieldValue}>
                    {field.dateTime
                      ? formatDateTime(field.value, language)
                      : field.value}
                  </Text>
                )}
              </View>
              {isEditing && error ? (
                <Text style={styles.fieldError}>{errorTextFor(error)}</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {action.error ? <Text style={styles.error}>{action.error}</Text> : null}

      <View style={styles.actions}>
        {action.status === "succeeded" && viewAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={viewAction.label}
            onPress={() => void viewAction.open()}
            style={[styles.actionButton, styles.editButton]}
          >
            <ViewActionIcon
              color={palette.mist}
              size={iconSize.small}
              strokeWidth={1.8}
              type={action.type}
            />
            <Text style={styles.editText}>{viewAction.label}</Text>
          </Pressable>
        ) : isEditing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${copy.cancelEdit} ${meta.title}`}
            onPress={() => {
              setDraft({});
              setErrors({});
              setIsEditing(false);
            }}
            style={[styles.actionButton, styles.editButton]}
          >
            <Text style={styles.editText}>{copy.cancelEdit}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${copy.edit} ${meta.title}`}
            disabled={readOnly}
            onPress={() => {
              setDraft({});
              setErrors({});
              setIsEditing(true);
            }}
            style={[
              styles.actionButton,
              styles.editButton,
              readOnly && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.editText}>{copy.edit}</Text>
          </Pressable>
        )}

        {isEditing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${copy.doneEditing} ${meta.title}`}
            onPress={() => {
              const nextErrors = validateActionEdit(action, currentValues());
              if (Object.keys(nextErrors).length > 0) {
                setErrors(nextErrors);
                return;
              }
              setErrors({});
              commitDraft();
              setIsEditing(false);
            }}
            style={[
              styles.actionButton,
              styles.execute,
              { backgroundColor: accent },
            ]}
          >
            <Text style={styles.executeText}>{copy.doneEditing}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${meta.title}, ${action.status === "succeeded" ? copy.completed : copy.run}`}
            disabled={readOnly}
            onPress={() => {
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
        )}
      </View>
    </Card>
  );
}

function ViewActionIcon({
  color,
  size,
  strokeWidth,
  type,
}: {
  color: ColorValue;
  size: number;
  strokeWidth: number;
  type: ActionProposal["type"];
}) {
  const Icon = type === "create_meeting" ? CalendarDays : ContactRound;
  return <Icon color={color} size={size} strokeWidth={strokeWidth} />;
}

const actionCopy = {
  zh: {
    meeting: "会议",
    startTime: "开始",
    endTime: "结束",
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
    run: "确认执行",
    high: "高",
    medium: "中",
    low: "低",
    executing: "正在写入系统…",
    completed: "已确认完成",
    viewInCalendar: "在日历中查看",
    viewContact: "查看联系人",
    viewError: "无法打开系统应用",
    viewErrorBody: "请确认设备上已安装并配置日历或通讯录。",
    retry: "检查后重试",
    edit: "编辑",
    doneEditing: "完成",
    cancelEdit: "取消",
    errorRequired: "这一项不能为空",
    errorEmail: "邮箱格式不正确",
    errorPhone: "电话号码格式不正确",
    errorEndAfterStart: "结束时间需晚于开始时间",
  },
  en: {
    meeting: "Meeting",
    startTime: "Starts",
    endTime: "Ends",
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
    run: "Confirm & run",
    high: "High",
    medium: "Medium",
    low: "Low",
    executing: "Writing to system…",
    completed: "Completed",
    viewInCalendar: "View in Calendar",
    viewContact: "View contact",
    viewError: "Cannot open the system app",
    viewErrorBody: "Make sure Calendar or Contacts is available on this device.",
    retry: "Review and retry",
    edit: "Edit",
    doneEditing: "Done",
    cancelEdit: "Cancel",
    errorRequired: "This field is required",
    errorEmail: "Enter a valid email address",
    errorPhone: "Enter a valid phone number",
    errorEndAfterStart: "End time must be after the start",
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
    lineHeight: 16,
    letterSpacing: 0.35,
  },
  title: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.body,
    lineHeight: 22,
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
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  fieldWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  fieldRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  fieldError: {
    color: palette.danger,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 16,
    paddingBottom: 6,
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
  datePickerWrap: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  // The SwiftUI host must receive a definite width from the row, otherwise it
  // measures itself at viewport width and the compact pill overflows the card.
  datePicker: {
    flex: 1,
    height: 40,
  },
  fieldInput: {
    flex: 1,
    height: 36,
    backgroundColor: palette.graphite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  error: {
    color: palette.danger,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  actions: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
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
