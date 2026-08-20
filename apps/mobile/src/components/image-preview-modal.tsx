import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { useState } from "react";
import { Modal, StyleSheet } from "react-native";

import { Box as View } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { iconSize, spacing } from "@/constants/theme";
import type { AppLanguage } from "@/domain/preferences";

type ImagePreviewModalProps = {
  language: AppLanguage;
  onClose: () => void;
  uri: string | null;
};

/** Full-screen preview: the image keeps its aspect ratio, close sits right below it. */
export function ImagePreviewModal({
  language,
  onClose,
  uri,
}: ImagePreviewModalProps) {
  const [loaded, setLoaded] = useState<{
    uri: string;
    height: number;
    width: number;
  } | null>(null);
  const size = loaded && loaded.uri === uri ? loaded : null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={Boolean(uri)}
    >
      <View style={styles.backdrop}>
        {uri ? (
          <Image
            accessibilityLabel={
              language === "zh" ? "查看图片" : "View image"
            }
            contentFit="contain"
            onLoad={(event) =>
              setLoaded({
                height: event.source.height,
                uri,
                width: event.source.width,
              })
            }
            source={uri}
            style={[
              styles.image,
              size ? { aspectRatio: size.width / size.height } : null,
            ]}
          />
        ) : null}
        <Pressable
          accessibilityLabel={language === "zh" ? "关闭图片预览" : "Close image preview"}
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <X color="#FFFFFF" size={iconSize.large} strokeWidth={2} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 11, 9, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.hero,
  },
  image: {
    width: "100%",
    maxHeight: "68%",
  },
  close: {
    marginTop: spacing.xl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.62 },
});
