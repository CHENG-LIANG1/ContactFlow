// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@expo/vector-icons",
              message:
                "Use lucide-react-native for product icons unless the asset is a custom brand mark.",
            },
            {
              name: "expo-symbols",
              message:
                "Use lucide-react-native so icons remain consistent across platforms.",
            },
            {
              name: "react-native-vector-icons",
              message:
                "Use lucide-react-native for product icons unless the asset is a custom brand mark.",
            },
          ],
        },
      ],
    },
  },
]);
