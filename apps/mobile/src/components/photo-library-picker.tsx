import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { X } from "lucide-react-native";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutUp,
  ReduceMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box as View } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  motion,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";
import type { ChatAttachment } from "@/domain/chat";
import type { AppLanguage } from "@/domain/preferences";

export type PhotoLibraryItem = { id: string; uri: string; label: string };

type PhotoLibraryPickerProps = {
  expanded: boolean;
  footer: ReactNode;
  language: AppLanguage;
  onExpandedChange: (expanded: boolean) => void;
  onTogglePhoto: (photo: PhotoLibraryItem) => void;
  open: boolean;
  selected: ChatAttachment[];
};

const PREVIEW_COUNT = 8;

/** The compact tray and full gallery share one photo source and selection order. */
export function PhotoLibraryPicker({
  expanded,
  footer,
  language,
  onExpandedChange,
  onTogglePhoto,
  open,
  selected,
}: PhotoLibraryPickerProps) {
  const [photos, setPhotos] = useState<PhotoLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const copy = photoCopy[language];
  const cellSize = width / 4;

  const loadPhotos = useCallback(async () => {
    if (loading) return;
    try {
      setLoading(true);
      const permission = await MediaLibrary.requestPermissionsAsync(false, [
        "photo",
      ]);
      setCanAskAgain(permission.canAskAgain);
      if (!permission.granted) {
        setPermissionBlocked(true);
        return;
      }
      setPermissionBlocked(false);
      const assets = await new MediaLibrary.Query()
        .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.IMAGE)
        .orderBy({
          key: MediaLibrary.AssetField.CREATION_TIME,
          ascending: false,
        })
        .limit(120)
        .exe();
      const resolved = await Promise.all(
        assets.map(async (asset, index) => ({
          id: asset.id,
          uri: await asset.getUri(),
          label: (await asset.getFilename()) || `${copy.photo} ${index + 1}`,
        })),
      );
      setPhotos(resolved);
    } catch {
      setPermissionBlocked(true);
    } finally {
      setLoading(false);
    }
  }, [copy.photo, loading]);

  const selectedIndex = useCallback(
    (photo: PhotoLibraryItem) =>
      selected.findIndex((attachment) => attachment.uri === photo.uri),
    [selected],
  );

  const expandPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -28) onExpandedChange(true);
        },
      }),
    [onExpandedChange],
  );

  const handlePermissionPress = () => {
    if (canAskAgain) {
      setPermissionBlocked(false);
      void loadPhotos();
    } else {
      void Linking.openSettings();
    }
  };

  const renderPhoto = (photo: PhotoLibraryItem, size?: number) => {
    const index = selectedIndex(photo);
    const isSelected = index >= 0;
    return (
      <Pressable
        accessibilityLabel={photo.label}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        onPress={() => onTogglePhoto(photo)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View
          style={[
            styles.photoCell,
            size ? { height: size, width: size } : undefined,
            isSelected && styles.photoCellSelected,
          ]}
        >
          <Image contentFit="cover" source={photo.uri} style={styles.photo} />
          <View
            style={[
              styles.selectionBadge,
              isSelected && styles.selectionBadgeSelected,
            ]}
          >
            {isSelected ? (
              <Text style={styles.selectionNumber}>{index + 1}</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  if (!open) return null;

  return (
    <>
      <Animated.View
        entering={FadeInDown.duration(motion.emphasized).reduceMotion(
          ReduceMotion.System,
        )}
        exiting={FadeOutUp.duration(motion.standard).reduceMotion(
          ReduceMotion.System,
        )}
        style={styles.previewMotion}
      >
        <View
          onLayout={() => {
            if (photos.length === 0 && !permissionBlocked) void loadPhotos();
          }}
          style={styles.previewPanel}
          {...expandPanResponder.panHandlers}
        >
          <Pressable
            accessibilityLabel={copy.expand}
            accessibilityRole="button"
            onPress={() => onExpandedChange(true)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View style={styles.previewHeader}>
              <View style={styles.handle} />
              <View style={styles.previewTitleRow}>
                <Text style={styles.previewTitle}>{copy.recent}</Text>
                <View style={styles.previewSpacer} />
                <Text style={styles.selectedCount}>
                  {copy.selected(selected.length)}
                </Text>
              </View>
            </View>
          </Pressable>
          {loading ? (
            <View style={styles.stateBox}>
              <Spinner color={palette.mist} size="small" />
              <Text style={styles.stateText}>{copy.loading}</Text>
            </View>
          ) : permissionBlocked ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{copy.permission}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={handlePermissionPress}
              >
                <View style={styles.permissionButton}>
                  <Text style={styles.permissionButtonText}>{copy.allow}</Text>
                </View>
              </Pressable>
            </View>
          ) : photos.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{copy.empty}</Text>
            </View>
          ) : (
            <View style={styles.previewGrid}>
              {photos.slice(0, PREVIEW_COUNT).map((photo, index) => (
                <Animated.View
                  entering={FadeIn.duration(motion.standard)
                    .delay(index * motion.stagger)
                    .reduceMotion(ReduceMotion.System)}
                  key={photo.id}
                  style={styles.previewCellWrap}
                >
                  {renderPhoto(photo)}
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </Animated.View>

      <Modal
        animationType="slide"
        onRequestClose={() => onExpandedChange(false)}
        presentationStyle="fullScreen"
        visible={expanded}
      >
        <View
          style={[
            styles.fullScreen,
            {
              paddingTop: Math.max(insets.top, 54),
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={styles.galleryHeader}>
            <Pressable
              accessibilityLabel={copy.close}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onExpandedChange(false)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={styles.closeButton}>
                <X
                  color={palette.paper}
                  size={iconSize.large}
                  strokeWidth={1.8}
                />
              </View>
            </Pressable>
            <Text style={styles.galleryTitle}>{copy.allPhotos}</Text>
            <Text style={styles.galleryCount}>
              {copy.selected(selected.length)}
            </Text>
          </View>
          <FlatList
            contentContainerStyle={styles.galleryGrid}
            data={photos}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(photo) => photo.id}
            numColumns={4}
            renderItem={({ item }) => renderPhoto(item, cellSize)}
            showsVerticalScrollIndicator={false}
          />
          {footer}
        </View>
      </Modal>
    </>
  );
}

const photoCopy = {
  zh: {
    recent: "最近照片",
    expand: "展开所有照片",
    selected: (count: number) => `已选 ${count}/9`,
    loading: "正在读取照片…",
    permission: "需要允许读取照片，才能在这里选择。",
    allow: "允许访问照片",
    empty: "相册里还没有照片",
    close: "关闭所有照片",
    allPhotos: "所有照片",
    photo: "照片",
  },
  en: {
    recent: "Recent photos",
    expand: "Show all photos",
    selected: (count: number) => `${count}/9 selected`,
    loading: "Loading photos…",
    permission: "Allow Photos access to choose images here.",
    allow: "Allow Photos access",
    empty: "No photos yet",
    close: "Close all photos",
    allPhotos: "All Photos",
    photo: "Photo",
  },
} as const;

const styles = StyleSheet.create({
  previewMotion: { marginTop: -8 },
  previewPanel: {
    overflow: "hidden",
    paddingTop: 8,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    backgroundColor: palette.ink,
  },
  previewHeader: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  handle: {
    width: 34,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 6,
  },
  previewTitleRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  previewTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    lineHeight: 18,
  },
  previewSpacer: { flex: 1 },
  selectedCount: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    lineHeight: 16,
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  previewCellWrap: { width: "25%", aspectRatio: 1, padding: 2 },
  photoCell: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: palette.graphite,
  },
  photoCellSelected: { borderColor: palette.accent },
  photo: { width: "100%", height: "100%" },
  selectionBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.92)",
    backgroundColor: "rgba(17,22,18,0.16)",
  },
  selectionBadgeSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  selectionNumber: {
    color: palette.ink,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    lineHeight: 14,
  },
  stateBox: {
    minHeight: 114,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  stateText: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    textAlign: "center",
  },
  permissionButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: palette.graphite,
  },
  permissionButtonText: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
  },
  fullScreen: { flex: 1, backgroundColor: palette.void },
  galleryHeader: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.lineSoft,
    backgroundColor: palette.ink,
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryTitle: {
    flex: 1,
    color: palette.paper,
    fontFamily: fonts.display,
    fontSize: typeScale.subheading,
    lineHeight: 24,
    textAlign: "center",
  },
  galleryCount: {
    width: 70,
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    lineHeight: 16,
    textAlign: "right",
  },
  galleryGrid: { paddingBottom: 2 },
  pressed: { opacity: 0.68 },
});
