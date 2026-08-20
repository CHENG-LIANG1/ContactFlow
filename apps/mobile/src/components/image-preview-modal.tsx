import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { Dimensions, Modal, StyleSheet } from "react-native";

import { Box as View } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { iconSize, spacing } from "@/constants/theme";
import type { AppLanguage } from "@/domain/preferences";

type ImagePreviewModalProps = {
  language: AppLanguage;
  onClose: () => void;
  uri: string | null;
};

/** Full-screen preview: the image letterboxes inside a fixed box, close sits below it. */
export function ImagePreviewModal({
  language,
  onClose,
  uri,
}: ImagePreviewModalProps) {
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
            source={uri}
            style={styles.image}
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
    // A definite pixel box so the image is visible the moment the modal
    // opens, instead of collapsing to zero height until a load event
    // provides an aspect ratio.
    width: Dimensions.get("window").width - spacing.lg * 2,
    height: Dimensions.get("window").height * 0.62,
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
