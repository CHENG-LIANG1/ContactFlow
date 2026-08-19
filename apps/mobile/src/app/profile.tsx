import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Camera } from "lucide-react-native";
import { Alert, StyleSheet } from "react-native";

import { Screen } from "@/components/screen";
import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import {
  fonts,
  iconSize,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";
import { useContactFlow } from "@/store/use-contactflow";

export default function ProfileScreen() {
  const router = useRouter();
  const language = useContactFlow((state) => state.language);
  const profile = useContactFlow((state) => state.profile);
  const updateProfile = useContactFlow((state) => state.updateProfile);
  const copy = profileCopy[language];
  const accent = palette.accent;

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ["images"],
        quality: 0.86,
      });
      if (!result.canceled) {
        updateProfile({ avatarUri: result.assets[0].uri });
      }
    } catch {
      Alert.alert(copy.avatarError, copy.avatarErrorBody);
    }
  };

  return (
    <Screen
      backLabel={copy.back}
      onBack={() => router.back()}
      title={copy.title}
    >
      <View style={styles.identity}>
        <Pressable
          accessibilityLabel={copy.changeAvatar}
          accessibilityRole="button"
          onPress={pickAvatar}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Avatar
            className="h-[88px] w-[88px]"
            style={{ backgroundColor: accent }}
          >
            {profile.avatarUri ? (
              <AvatarImage source={{ uri: profile.avatarUri }} />
            ) : null}
            <AvatarFallbackText style={styles.avatarInitial}>
              {(profile.name || "U").slice(0, 1).toUpperCase()}
            </AvatarFallbackText>
          </Avatar>
          <View style={styles.cameraBadge}>
            <Camera
              color={palette.paper}
              size={iconSize.small}
              strokeWidth={1.7}
            />
          </View>
        </Pressable>
        <Text style={styles.changeAvatar}>{copy.changeAvatar}</Text>
      </View>

      <Card style={styles.form}>
        <ProfileField
          label={copy.name}
          onChangeText={(name) => updateProfile({ name })}
          placeholder={copy.namePlaceholder}
          value={profile.name}
        />
        <ProfileField
          label={copy.bio}
          multiline
          onChangeText={(bio) => updateProfile({ bio })}
          placeholder={copy.bioPlaceholder}
          value={profile.bio}
        />
        <ProfileField
          autoCapitalize="none"
          keyboardType="email-address"
          label={copy.email}
          onChangeText={(email) => updateProfile({ email })}
          placeholder="name@example.com"
          value={profile.email}
        />
      </Card>

      <Text style={styles.note}>{copy.note}</Text>
    </Screen>
  );
}

function ProfileField({
  label,
  multiline,
  ...props
}: React.ComponentProps<typeof InputField> & {
  label: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {multiline ? (
        <Textarea className="h-[70px] border-0 bg-transparent">
          <TextareaInput
            placeholderTextColor={palette.smoke}
            selectionColor={palette.paper}
            style={[styles.input, styles.inputMultiline]}
            {...props}
          />
        </Textarea>
      ) : (
        <Input className="h-10 border-0 bg-transparent px-0">
          <InputField
            placeholderTextColor={palette.smoke}
            selectionColor={palette.paper}
            style={styles.input}
            {...props}
          />
        </Input>
      )}
    </View>
  );
}

const profileCopy = {
  zh: {
    title: "我的",
    subtitle: "这些信息只用于个性化你的 Agent，不会自动写入通讯录。",
    changeAvatar: "更换头像",
    name: "昵称",
    namePlaceholder: "你的昵称",
    bio: "个人简介",
    bioPlaceholder: "简单介绍一下自己",
    email: "邮箱",
    note: "个人信息和头像仅保存在本机。",
    avatarError: "无法选择头像",
    avatarErrorBody: "请检查相册权限后重试。",
    back: "返回对话",
  },
  en: {
    title: "Profile",
    subtitle:
      "Used only to personalize your agent. Nothing is written to Contacts.",
    changeAvatar: "Change photo",
    name: "Display name",
    namePlaceholder: "Your name",
    bio: "Bio",
    bioPlaceholder: "A short introduction",
    email: "Email",
    note: "Your profile and photo stay on this device.",
    avatarError: "Unable to choose a photo",
    avatarErrorBody: "Check Photos permission and try again.",
    back: "Back to chat",
  },
} as const;

const styles = StyleSheet.create({
  identity: { alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: palette.void,
    fontFamily: fonts.display,
    fontSize: 42,
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.graphite,
    borderWidth: 3,
    borderColor: palette.void,
  },
  changeAvatar: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
  },
  form: {
    borderRadius: radius.lg,
    backgroundColor: palette.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    overflow: "hidden",
  },
  field: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.lineSoft,
  },
  label: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 34,
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: typeScale.body,
    paddingHorizontal: 0,
    paddingVertical: 6,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  note: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    textAlign: "center",
  },
  pressed: { opacity: 0.58 },
});
