import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { Avatar, AvatarFallbackText } from "@/components/ui/avatar";

type ProfileAvatarProps = {
  className?: string;
  initialStyle?: StyleProp<TextStyle>;
  name: string;
  style?: StyleProp<ViewStyle>;
  uri?: string;
};

/**
 * Avatar that shows the picked photo when it loads and falls back to the
 * name initial when the file is missing or unreadable (e.g. after reinstall).
 * Uses expo-image because gluestack's AvatarImage swallows onError.
 */
export function ProfileAvatar({
  className,
  initialStyle,
  name,
  style,
  uri,
}: ProfileAvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(uri) && failedUri !== uri;

  return (
    <Avatar className={className} style={style}>
      {showImage && uri ? (
        <Image
          contentFit="cover"
          onError={() => setFailedUri(uri)}
          source={{ uri }}
          style={styles.image}
        />
      ) : (
        <AvatarFallbackText style={initialStyle}>
          {(name || "U").slice(0, 1).toUpperCase()}
        </AvatarFallbackText>
      )}
    </Avatar>
  );
}

const styles = StyleSheet.create({
  image: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
});
