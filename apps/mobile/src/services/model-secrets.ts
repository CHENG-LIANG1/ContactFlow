import * as SecureStore from "expo-secure-store";

const secretKey = (configId: string) => `contactflow.model-key.${configId}`;

/** API keys never enter Zustand persistence or AsyncStorage. */
export async function saveModelApiKey(configId: string, apiKey: string) {
  await SecureStore.setItemAsync(secretKey(configId), apiKey.trim());
}

export async function readModelApiKey(configId: string) {
  return SecureStore.getItemAsync(secretKey(configId));
}

export async function deleteModelApiKey(configId: string) {
  await SecureStore.deleteItemAsync(secretKey(configId));
}
