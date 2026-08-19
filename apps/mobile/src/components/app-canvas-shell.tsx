import { useRouter } from "expo-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import { ChatHistoryDrawer } from "@/components/chat-history-drawer";
import { motion, palette } from "@/constants/theme";
import type { ChatSession } from "@/domain/chat";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useContactFlow } from "@/store/use-contactflow";

type ChatIntent =
  | { key: number; type: "new" }
  | { key: number; session: ChatSession; type: "session" };
type ChatIntentInput =
  { type: "new" } | { session: ChatSession; type: "session" };

type AppCanvasContextValue = {
  activeSessionId: string | null;
  chatIntent: ChatIntent | null;
  consumeChatIntent: (key: number) => void;
  openDrawer: () => void;
  setActiveSessionId: (id: string | null) => void;
};

const AppCanvasContext = createContext<AppCanvasContextValue | null>(null);

/** Keeps the drawer and routed page on one horizontal motion canvas. */
export function AppCanvasShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.86, 370);
  const [canvasX] = useState(() => new Animated.Value(0));
  const intentKey = useRef(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatIntent, setChatIntent] = useState<ChatIntent | null>(null);
  const sessions = useContactFlow((state) => state.chatSessions);
  const deleteSession = useContactFlow((state) => state.deleteChatSession);
  const pinSession = useContactFlow((state) => state.toggleChatSessionPinned);
  const renameSession = useContactFlow((state) => state.renameChatSession);

  const animateCanvas = useCallback(
    (toValue: number, duration: number, opening: boolean) => {
      Animated.timing(canvasX, {
        duration: reduceMotion ? 0 : duration,
        easing: opening ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
        toValue,
        useNativeDriver: true,
      }).start();
    },
    [canvasX, reduceMotion],
  );

  const openDrawer = useCallback(() => {
    if (drawerOpen) return;
    setDrawerOpen(true);
    requestAnimationFrame(() =>
      animateCanvas(drawerWidth, motion.standard, true),
    );
  }, [animateCanvas, drawerOpen, drawerWidth]);

  const revealChat = useCallback(
    (intent: ChatIntentInput) => {
      intentKey.current += 1;
      setChatIntent({ ...intent, key: intentKey.current });
      router.replace("/");
    },
    [router],
  );

  const contextValue = useMemo<AppCanvasContextValue>(
    () => ({
      activeSessionId,
      chatIntent,
      consumeChatIntent: (key) =>
        setChatIntent((current) => (current?.key === key ? null : current)),
      openDrawer,
      setActiveSessionId,
    }),
    [activeSessionId, chatIntent, openDrawer],
  );

  return (
    <AppCanvasContext.Provider value={contextValue}>
      <Animated.View
        style={[styles.canvas, { transform: [{ translateX: canvasX }] }]}
      >
        {children}
      </Animated.View>
      <ChatHistoryDrawer
        activeSessionId={activeSessionId}
        onClose={() => {
          canvasX.setValue(0);
          setDrawerOpen(false);
        }}
        onCloseStart={() => animateCanvas(0, motion.standard, false)}
        onDelete={(id) => {
          deleteSession(id);
          if (id === activeSessionId) {
            setActiveSessionId(null);
            revealChat({ type: "new" });
          }
        }}
        onNewChat={() => {
          setActiveSessionId(null);
          revealChat({ type: "new" });
        }}
        onPin={pinSession}
        onProfile={() => router.push("/profile")}
        onRename={renameSession}
        onSelect={(session) => {
          setActiveSessionId(session.id);
          revealChat({ type: "session", session });
        }}
        onSettings={() => router.push("/settings")}
        sessions={sessions}
        visible={drawerOpen}
      />
    </AppCanvasContext.Provider>
  );
}

export function useAppCanvas() {
  const context = useContext(AppCanvasContext);
  if (!context) {
    throw new Error("useAppCanvas must be used inside AppCanvasShell");
  }
  return context;
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: palette.void },
});
