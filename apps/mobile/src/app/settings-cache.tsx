import { useRouter } from "expo-router";
import { Image, MessageCircle, Trash2 } from "lucide-react-native";
import { Alert } from "react-native";

import { Screen } from "@/components/screen";
import {
  SettingsDivider,
  SettingsGroup,
  SettingsRow,
} from "@/components/settings-list";
import { useContactFlow } from "@/store/use-contactflow";

export default function CacheSettingsScreen() {
  const router = useRouter();
  const language = useContactFlow((state) => state.language);
  const sessions = useContactFlow((state) => state.chatSessions);
  const clearChatCache = useContactFlow((state) => state.clearChatCache);
  const copy = cacheCopy[language];
  const imageCount = sessions.reduce(
    (total, session) => total + session.turn.attachments.length,
    0,
  );

  const clearCache = () => {
    Alert.alert(copy.clearTitle, copy.clearBody, [
      { text: copy.cancel, style: "cancel" },
      { text: copy.clear, style: "destructive", onPress: clearChatCache },
    ]);
  };

  return (
    <Screen
      backLabel={copy.back}
      eyebrow="ON-DEVICE DATA"
      onBack={() => router.back()}
      title={copy.title}
    >
      <SettingsGroup label={copy.usage}>
        <SettingsRow
          icon={MessageCircle}
          title={copy.conversations}
          value={String(sessions.length)}
        />
        <SettingsDivider />
        <SettingsRow icon={Image} title={copy.images} value={String(imageCount)} />
      </SettingsGroup>

      <SettingsGroup label={copy.management}>
        <SettingsRow
          destructive
          detail={copy.hint}
          icon={Trash2}
          onPress={clearCache}
          showsDisclosure={false}
          title={copy.clear}
        />
      </SettingsGroup>
    </Screen>
  );
}

const cacheCopy = {
  zh: {
    title: "缓存管理",
    usage: "使用情况",
    management: "管理",
    conversations: "聊天记录",
    images: "图片引用",
    clear: "清理聊天缓存",
    hint: "不会删除系统日历或通讯录内容",
    clearTitle: "清理聊天缓存？",
    clearBody: "这会删除本机聊天记录、图片引用和未执行建议。",
    cancel: "取消",
    back: "返回设置",
  },
  en: {
    title: "Cache",
    usage: "Usage",
    management: "Management",
    conversations: "Chats",
    images: "Image references",
    clear: "Clear chat cache",
    hint: "Calendar and Contacts entries will not be removed",
    clearTitle: "Clear chat cache?",
    clearBody: "This removes local chats, image references, and pending suggestions.",
    cancel: "Cancel",
    back: "Back to settings",
  },
} as const;
