import { useRouter } from "expo-router";
import { CalendarDays, Database, Mail, Phone, Shield } from "lucide-react-native";
import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";

import { RelationshipGraph } from "@/components/relationship-graph";
import { RelationshipSummarySection } from "@/components/relationship-summary";
import {
  ProfileEditorModal,
  ProfileSummaryCard,
} from "@/components/profile-editor";
import { Screen, SectionHeading } from "@/components/screen";
import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { fonts, iconSize, palette, radius, spacing, typeScale } from "@/constants/theme";
import { buildRelationshipContacts } from "@/domain/relationship-memory";
import { useContactFlow } from "@/store/use-contactflow";

export default function MemoryScreen() {
  const router = useRouter();
  const memories = useContactFlow((state) => state.memories);
  const history = useContactFlow((state) => state.history);
  const chatSessions = useContactFlow((state) => state.chatSessions);
  const language = useContactFlow((state) => state.language);
  const profile = useContactFlow((state) => state.profile);
  const [selectedId, setSelectedId] = useState<string>();
  const [editingProfile, setEditingProfile] = useState(false);
  const copy = memoryCopy[language];
  const contacts = useMemo(
    () => buildRelationshipContacts({ chatSessions, history, memories }),
    [chatSessions, history, memories],
  );
  const selectedContact = contacts.find((contact) => contact.id === selectedId);
  const totalMeetings = contacts.reduce(
    (total, contact) => total + contact.meetings.length,
    0,
  );

  return (
    <Screen
      backLabel={copy.back}
      onBack={() => router.back()}
      title={copy.title}
    >
      <View style={styles.introRow}>
        <View style={styles.introIcon}>
          <Shield color={palette.paper} size={iconSize.small} strokeWidth={1.7} />
        </View>
        <Text style={styles.introText}>{copy.promise}</Text>
      </View>

      <View style={styles.section}>
        <SectionHeading count={contacts.length} label={copy.mapSection} />
        <RelationshipGraph
          contacts={contacts}
          language={language}
          onSelect={setSelectedId}
          onSelectRoot={() => setSelectedId(undefined)}
          profile={profile}
          selectedId={selectedId}
        />
      </View>

      {!selectedContact ? (
        <View style={styles.section}>
          <SectionHeading label={copy.overviewSection} />
          <Card style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>{copy.overviewTitle}</Text>
            <Text style={styles.overviewBody}>
              {copy.overviewBody(
                contacts.length,
                totalMeetings,
                memories.length,
              )}
            </Text>
            <View style={styles.metricGrid}>
              <Metric label={copy.contactsMetric} value={contacts.length} />
              <Metric label={copy.meetingsMetric} value={totalMeetings} />
              <Metric label={copy.memoriesMetric} value={memories.length} />
            </View>
          </Card>
          {contacts.length > 0 ? (
            <Text style={styles.selectionHint}>{copy.selectionHint}</Text>
          ) : null}
        </View>
      ) : null}

      {selectedContact ? (
        <View style={styles.section}>
          <SectionHeading label={copy.contactSection} />
          <Card style={styles.contactCard}>
            <View style={styles.contactHeader}>
              <View style={styles.contactIdentity}>
                <Text style={styles.contactName}>{selectedContact.name}</Text>
                <Text style={styles.contactRole}>
                  {[selectedContact.jobTitle, selectedContact.company]
                    .filter(Boolean)
                    .join(" · ") || copy.confirmedContact}
                </Text>
              </View>
              <Text style={styles.factCount}>
                {copy.factCount(selectedContact.facts.length)}
              </Text>
            </View>
            {selectedContact.phone ? (
              <ContactField icon={Phone} label={copy.phone} value={selectedContact.phone} />
            ) : null}
            {selectedContact.email ? (
              <ContactField icon={Mail} label={copy.email} value={selectedContact.email} />
            ) : null}
            {!selectedContact.phone && !selectedContact.email ? (
              <Text style={styles.missingContact}>{copy.noContactDetails}</Text>
            ) : null}
          </Card>
        </View>
      ) : null}

      {selectedContact ? (
        <RelationshipSummarySection
          contact={selectedContact}
          key={selectedContact.id}
          language={language}
        />
      ) : null}

      {selectedContact ? (
        <View style={styles.section}>
          <SectionHeading count={selectedContact.meetings.length} label={copy.activitySection} />
          {selectedContact.meetings.length > 0 ? (
            selectedContact.meetings.map((meeting) => (
              <Card key={meeting.id} style={styles.activityCard}>
                <View style={styles.activityIcon}>
                  <CalendarDays color={palette.paper} size={iconSize.small} strokeWidth={1.7} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{meeting.title}</Text>
                  <Text style={styles.activityTime}>
                    {formatDate(meeting.scheduledAt ?? meeting.executedAt, language)}
                  </Text>
                </View>
              </Card>
            ))
          ) : (
            <View style={styles.emptyActivity}>
              <Database color={palette.line} size={iconSize.large} strokeWidth={1.4} />
              <Text style={styles.emptyTitle}>{copy.noMeetings}</Text>
              <Text style={styles.emptyBody}>{copy.noMeetingsBody}</Text>
            </View>
          )}
        </View>
      ) : null}

      {selectedContact && selectedContact.facts.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading count={selectedContact.facts.length} label={copy.timelineSection} />
          <View style={styles.timeline}>
            {selectedContact.facts.map((fact, index) => (
              <View key={fact.id} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={styles.timelineDot} />
                  {index < selectedContact.facts.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>{fact.label}</Text>
                  <Text style={styles.timelineValue}>{fact.value}</Text>
                  <Text style={styles.timelineMeta}>
                    {formatDate(fact.createdAt, language)} · {fact.source}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {!selectedContact ? (
        <View style={styles.section}>
          <SectionHeading label={copy.profileSection} />
          <ProfileSummaryCard
            language={language}
            onPress={() => setEditingProfile(true)}
          />
          <Text style={styles.profileHint}>{copy.profileHint}</Text>
        </View>
      ) : null}

      <ProfileEditorModal
        language={language}
        onClose={() => setEditingProfile(false)}
        visible={editingProfile}
      />
    </Screen>
  );
}

function ContactField({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Icon color={palette.smoke} size={iconSize.small} strokeWidth={1.6} />
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text selectable style={styles.fieldValue}>
        {value}
      </Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{String(value).padStart(2, "0")}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function formatDate(value: string, language: "zh" | "en") {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const memoryCopy = {
  zh: {
    title: "记忆",
    back: "返回对话",
    promise: "只展示你确认并执行成功的联系人事实与活动。",
    mapSection: "关系图",
    contactSection: "联系人信息",
    activitySection: "最近会议",
    timelineSection: "记忆时间线",
    overviewSection: "关系总览",
    overviewTitle: "你的关系网络",
    overviewBody: (contacts: number, meetings: number, memories: number) =>
      `已连接 ${contacts} 位联系人，记录 ${meetings} 次会议和 ${memories} 条有来源的记忆。`,
    contactsMetric: "联系人",
    meetingsMetric: "会议",
    memoriesMetric: "记忆",
    confirmedContact: "已确认联系人",
    phone: "手机",
    email: "邮箱",
    noContactDetails: "还没有已确认的电话或邮箱。",
    noMeetings: "还没有会议活动",
    noMeetingsBody: "为这个联系人确认一次会议后，活动会出现在这里。",
    selectionHint: "点击联系人节点，查看资料和最近活动。",
    profileSection: "我的信息",
    profileHint: "点按卡片即可编辑昵称、简介和头像。",
    factCount: (count: number) => `${count} 条记忆`,
  },
  en: {
    title: "Memory",
    back: "Back to chat",
    promise: "Only contact facts and activities you confirmed and completed appear here.",
    mapSection: "RELATIONSHIP MAP",
    contactSection: "CONTACT DETAILS",
    activitySection: "RECENT MEETINGS",
    timelineSection: "MEMORY TIMELINE",
    overviewSection: "OVERVIEW",
    overviewTitle: "Your relationship network",
    overviewBody: (contacts: number, meetings: number, memories: number) =>
      `${contacts} contacts, ${meetings} confirmed meetings, and ${memories} sourced memories.`,
    contactsMetric: "Contacts",
    meetingsMetric: "Meetings",
    memoriesMetric: "Memories",
    confirmedContact: "Confirmed contact",
    phone: "Phone",
    email: "Email",
    noContactDetails: "No confirmed phone number or email yet.",
    noMeetings: "No meeting activity yet",
    noMeetingsBody: "Confirm a meeting for this contact and it will appear here.",
    selectionHint: "Tap a contact node to view details and recent activity.",
    profileSection: "MY PROFILE",
    profileHint: "Tap the card to edit your name, bio, and photo.",
    factCount: (count: number) => `${count} ${count === 1 ? "memory" : "memories"}`,
  },
} as const;

const styles = StyleSheet.create({
  introRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  introIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: palette.graphite,
  },
  introText: {
    flex: 1,
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  section: { gap: spacing.md },
  selectionHint: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    textAlign: "center",
  },
  profileHint: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    textAlign: "center",
  },
  overviewCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.ink,
  },
  overviewTitle: {
    color: palette.paper,
    fontFamily: fonts.display,
    fontSize: typeScale.subheading,
  },
  overviewBody: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  metricGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: palette.graphite,
  },
  metricValue: {
    color: palette.paper,
    fontFamily: fonts.display,
    fontSize: 22,
  },
  metricLabel: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: 10,
    lineHeight: 14,
    marginTop: spacing.xs,
  },
  contactCard: {
    gap: 0,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.ink,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  contactIdentity: { flex: 1, minWidth: 0 },
  contactName: {
    color: palette.paper,
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
  },
  contactRole: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  factCount: {
    color: palette.accent,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  fieldRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.lineSoft,
  },
  fieldLabel: { color: palette.smoke, fontFamily: fonts.body, fontSize: typeScale.caption },
  fieldValue: {
    flex: 1,
    flexShrink: 1,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    textAlign: "right",
  },
  missingContact: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.lineSoft,
    paddingTop: spacing.lg,
  },
  pressed: { opacity: 0.58 },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  activityIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: palette.graphite,
  },
  activityContent: { flex: 1 },
  activityTitle: { color: palette.paper, fontFamily: fonts.bodyMedium, fontSize: typeScale.label },
  activityTime: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    marginTop: spacing.xs,
  },
  emptyActivity: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: palette.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
  },
  emptyTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    marginTop: spacing.md,
  },
  emptyBody: {
    maxWidth: 250,
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  timeline: { paddingHorizontal: spacing.xs },
  timelineRow: { flexDirection: "row", gap: spacing.md },
  timelineRail: { width: 14, alignItems: "center" },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: palette.accent,
  },
  timelineLine: { flex: 1, width: 1, marginVertical: 3, backgroundColor: palette.line },
  timelineContent: { flex: 1, paddingBottom: spacing.xl },
  timelineLabel: { color: palette.paper, fontFamily: fonts.bodyMedium, fontSize: typeScale.label },
  timelineValue: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  timelineMeta: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: 10,
    marginTop: spacing.sm,
  },
});
