import { Image } from "expo-image";
import { UserRound } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { Box as View } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";
import type { RelationshipContact } from "@/domain/relationship-memory";

type RelationshipGraphProps = {
  contacts: RelationshipContact[];
  language: "zh" | "en";
  onSelectRoot: () => void;
  onSelect: (id: string) => void;
  profile: { avatarUri?: string; name: string };
  selectedId?: string;
};

const GRAPH_HEIGHT = 330;
const GRAPH_HEIGHT_COMPACT = 250;
const CHILD_SIZE = 52;
const ROOT_SIZE = 64;
const ROOT_LABEL_WIDTH = 96;

/** A deterministic radial map stays legible as memories change between launches. */
export function RelationshipGraph({
  contacts,
  language,
  onSelectRoot,
  onSelect,
  profile,
  selectedId,
}: RelationshipGraphProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const [failedAvatarUri, setFailedAvatarUri] = useState<string | null>(null);
  const graphHeight =
    contacts.length > 2 ? GRAPH_HEIGHT : GRAPH_HEIGHT_COMPACT;
  const graphWidth = Math.max(
    viewportWidth - spacing.xl * 2,
    contacts.length > 4 ? 620 : 360,
  );
  const center = { x: graphWidth / 2, y: graphHeight / 2 };
  const positions = useMemo(
    () =>
      contacts.map((contact, index) => {
        const startAngle = contacts.length === 2 ? 0 : -Math.PI / 2;
        const angle =
          startAngle + (index * Math.PI * 2) / Math.max(contacts.length, 1);
        const radiusX = Math.min(
          graphWidth / 2 - CHILD_SIZE - spacing.lg,
          232,
        );
        const radiusY = graphHeight / 2 - CHILD_SIZE / 2 - spacing.xl;
        return {
          contact,
          x: center.x + Math.cos(angle) * radiusX,
          y: center.y + Math.sin(angle) * radiusY,
        };
      }),
    [center.x, center.y, contacts, graphHeight, graphWidth],
  );

  return (
    <View style={styles.frame}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View style={{ height: graphHeight, width: graphWidth }}>
          <Svg
            accessibilityElementsHidden
            height={graphHeight}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            width={graphWidth}
          >
            <Circle
              cx={center.x}
              cy={center.y}
              fill="none"
              opacity={0.5}
              r={ROOT_SIZE / 2 + spacing.lg}
              stroke={palette.line}
              strokeDasharray="2 8"
              strokeWidth={1}
            />
            {positions.map(({ contact, x, y }) => {
              const controlX = center.x + (x - center.x) * 0.54;
              const controlY = center.y + (y - center.y) * 0.28;
              return (
                <Path
                  d={`M ${center.x} ${center.y} Q ${controlX} ${controlY} ${x} ${y}`}
                  fill="none"
                  key={contact.id}
                  opacity={selectedId === contact.id ? 0.95 : 0.6}
                  stroke={
                    selectedId === contact.id ? palette.accent : palette.line
                  }
                  strokeLinecap="round"
                  strokeWidth={selectedId === contact.id ? 2 : 1.2}
                />
              );
            })}
          </Svg>

          <View
            style={[
              styles.nodePosition,
              {
                left: center.x - ROOT_LABEL_WIDTH / 2,
                top: center.y - ROOT_SIZE / 2,
              },
            ]}
          >
            <Pressable
              accessibilityHint={
                language === "zh"
                  ? "返回关系总览"
                  : "Return to relationship overview"
              }
              accessibilityLabel={`${language === "zh" ? "我" : "Me"}: ${profile.name}`}
              accessibilityRole="button"
              onPress={onSelectRoot}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={styles.rootNode}>
                {profile.avatarUri && failedAvatarUri !== profile.avatarUri ? (
                  <Image
                    contentFit="cover"
                    onError={() => setFailedAvatarUri(profile.avatarUri ?? null)}
                    source={{ uri: profile.avatarUri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.rootInitial}>
                    {(profile.name || "U").slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text numberOfLines={1} style={styles.nodeLabel}>
                {profile.name}
              </Text>
            </Pressable>
          </View>

          {positions.map(({ contact, x, y }) => {
            const selected = contact.id === selectedId;
            return (
              <View
                key={contact.id}
                style={[
                  styles.nodePosition,
                  { left: x - ROOT_LABEL_WIDTH / 2, top: y - CHILD_SIZE / 2 },
                ]}
              >
                <Pressable
                  accessibilityHint={
                    language === "zh"
                      ? "查看联系人信息和最近活动"
                      : "View contact details and recent activity"
                  }
                  accessibilityLabel={contact.name}
                  accessibilityRole="button"
                  onPress={() => onSelect(contact.id)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <View
                    style={[
                      styles.contactNode,
                      selected && styles.contactNodeSelected,
                    ]}
                  >
                    {contact.name ? (
                      <Text
                        style={[
                          styles.contactInitial,
                          selected && styles.contactInitialSelected,
                        ]}
                      >
                        {contact.name.slice(0, 1)}
                      </Text>
                    ) : (
                      <UserRound
                        color={palette.smoke}
                        size={iconSize.medium}
                      />
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.nodeLabel,
                      selected && styles.nodeLabelSelected,
                    ]}
                  >
                    {contact.name}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {contacts.length === 0 ? (
        <View pointerEvents="none" style={styles.emptyHint}>
          <Text style={styles.emptyText}>
            {language === "zh"
              ? "确认联系人后，关系会从这里生长。"
              : "Confirm a contact to grow your relationship map."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    minHeight: GRAPH_HEIGHT_COMPACT,
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.ink,
  },
  scrollContent: { minWidth: "100%" },
  nodePosition: {
    position: "absolute",
    width: ROOT_LABEL_WIDTH,
    alignItems: "center",
  },
  pressed: { opacity: 0.72 },
  rootNode: {
    width: ROOT_SIZE,
    height: ROOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: ROOT_SIZE / 2,
    backgroundColor: palette.accent,
    borderWidth: 2,
    borderColor: palette.ink,
    shadowColor: palette.accent,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarImage: { width: "100%", height: "100%" },
  rootInitial: {
    color: palette.void,
    fontFamily: fonts.display,
    fontSize: 22,
  },
  contactNode: {
    width: CHILD_SIZE,
    height: CHILD_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CHILD_SIZE / 2,
    backgroundColor: palette.graphite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  contactNodeSelected: {
    backgroundColor: palette.glow,
    borderColor: palette.accent,
    borderWidth: 1.5,
  },
  contactInitial: {
    color: palette.paper,
    fontFamily: fonts.display,
    fontSize: typeScale.subheading,
  },
  contactInitialSelected: { color: palette.accent },
  nodeLabel: {
    maxWidth: 84,
    marginTop: spacing.sm,
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
    lineHeight: 16,
    textAlign: "center",
  },
  nodeLabelSelected: { color: palette.accent },
  emptyHint: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    textAlign: "center",
  },
});
