import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuthStore } from "../store/auth";
import { checkErpAnalysisHealth } from "../api/mobileConfig";
import { ERP_ANALYSIS } from "../api/endpoints";
import { http } from "../api/http";
import { normalizeServerUrl } from "../api/serverUrl";

interface ServerConfigProps {
  onSave?: () => void;
}

export const ServerConfig: React.FC<ServerConfigProps> = ({ onSave }) => {
  const { serverConfig, updateServerConfig, saveServerConfig, logout } =
    useAuthStore();
  const [serverUrl, setServerUrl] = useState(serverConfig.serverUrl || "");
  const [clientId, setClientId] = useState(
    serverConfig.clientId || "55d4241f3a"
  );
  const [isFetchingClientId, setIsFetchingClientId] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setServerUrl(serverConfig.serverUrl || "");
    setClientId(serverConfig.clientId || "55d4241f3a");
  }, [serverConfig.serverUrl, serverConfig.clientId]);

  // Auto-fetch client_id when server URL changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (serverUrl && serverUrl !== serverConfig.serverUrl) {
        fetchClientIdFromServer(serverUrl);
      }
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [serverUrl]);

  // Clear client_id when server URL changes significantly
  useEffect(() => {
    if (
      serverUrl &&
      serverConfig.serverUrl &&
      serverUrl !== serverConfig.serverUrl
    ) {
      // If the domain changed (not just a small modification), reset client_id
      const currentDomain = new URL(serverConfig.serverUrl || serverUrl)
        .hostname;
      const newDomain = new URL(serverUrl).hostname;

      if (currentDomain !== newDomain) {
        console.log("🔄 Server domain changed, resetting client_id");
        setClientId("55d4241f3a"); // Reset to default
      }
    }
  }, [serverUrl]);

  // Auto-fetch client_id from server when server URL is set
  const fetchClientIdFromServer = async (baseUrl: string) => {
    if (!baseUrl) return;

    console.log("🔄 Fetching client_id from:", baseUrl);
    setIsFetchingClientId(true);
    try {
      // Try to fetch client_id from the server configuration API
      const axios = (await import("axios")).default;
      const fetchUrl = `${baseUrl}${ERP_ANALYSIS.config.getClientId}`;
      console.log("📡 Calling:", fetchUrl);

      const response = await axios.get(fetchUrl);

      const fetchedClientId = response.data?.message?.client_id;
      if (fetchedClientId) {
        setClientId(fetchedClientId);
        console.log("✅ Auto-fetched client_id from server:", fetchedClientId);
      } else {
        console.log("⚠️ No client_id in response:", response.data);
      }
    } catch (error: any) {
      // API might not exist on all servers (417, 404, etc.)
      // This is expected - just use the default client_id
      if (error.response?.status === 417 || error.response?.status === 404) {
        console.log(
          "ℹ️ Client ID API not available on this server, using default"
        );

        // If this is the demo server, use the known client_id
        if (baseUrl.includes("demo.printechs.com")) {
          console.log(
            "🎯 Detected demo server, using known client_id: 1f2f5e62d1"
          );
          setClientId("1f2f5e62d1");
        }
      } else {
        console.log("⚠️ Could not fetch client_id from server:", error.message);
        console.log("⚠️ Server URL was:", baseUrl);
      }
      // Keep the default client_id
    } finally {
      setIsFetchingClientId(false);
    }
  };

  const handleSave = async () => {
    if (!serverUrl.trim()) {
      Alert.alert("Error", "Please enter a valid server URL");
      return;
    }

    const normalized = normalizeServerUrl(serverUrl);
    const trimmedUrl = normalized.url;
    if (
      !trimmedUrl.startsWith("http://") &&
      !trimmedUrl.startsWith("https://")
    ) {
      Alert.alert(
        "Invalid URL",
        "URL must start with http:// or https://\n\nExamples:\n• https://www.printechs.com\n• https://erp.example.com\n• http://192.168.1.100:8000"
      );
      return;
    }

    if (normalized.remapped) {
      setServerUrl(trimmedUrl);
      console.warn("⚠️ Server URL remapped on save:", normalized.note);
    }

    setIsSaving(true);
    try {
      const health = await checkErpAnalysisHealth(trimmedUrl);
      if (!health.ok) {
        Alert.alert(
          "erp_analysis not available",
          health.message +
            "\n\nYou can still save the URL, but login and BA APIs need the erp_analysis app on that site.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save anyway",
              onPress: () => persistServer(trimmedUrl),
            },
          ]
        );
        return;
      }

      await fetchClientIdFromServer(trimmedUrl);
      await persistServer(trimmedUrl, health.version);
    } finally {
      setIsSaving(false);
    }
  };

  const persistServer = async (trimmedUrl: string, analysisVersion?: string) => {
    const nextClientId = clientId.trim() || "55d4241f3a";
    await updateServerConfig({
      serverUrl: trimmedUrl,
      hostname: "",
      port: 0,
      isHttps: trimmedUrl.startsWith("https://"),
      clientId: nextClientId,
    });
    http.setBaseUrl(trimmedUrl);

    try {
      await useAuthStore.getState().loadMobileConfig();
    } catch {
      // non-fatal — defaults apply
    }

    Alert.alert(
      "Success",
      analysisVersion
        ? `Server saved (${trimmedUrl}). erp_analysis ${analysisVersion} is available.`
        : `Server configuration saved (${trimmedUrl}). Demo mode is now off.`
    );
    onSave?.();
  };

  // Plain content View — parent ScrollView/Modal owns scrolling.
  // Nested flex:1 + ScrollView was clipping "Save Configuration" off-screen.
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="server-outline" size={28} color="#667eea" />
        <Text style={styles.title}>ERPNext Server</Text>
      </View>

      <View style={styles.infoCard}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color="#667eea"
        />
        <Text style={styles.infoText}>
          With no URL saved, the app runs in demo mode (sample data). Enter
          your ERPNext URL here to use your real company server.
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Server URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://www.printechs.com"
          placeholderTextColor="#9ca3af"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.helpText}>
          Live Printechs: https://www.printechs.com{"\n"}
          Do not use support.printechs.com or erp.printechs.com (not the ERP
          site).{"\n"}
          Examples:{"\n"}• https://www.printechs.com{"\n"}•
          https://erp.example.com{"\n"}• http://192.168.1.100:8000
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Client ID (Optional)</Text>
          {isFetchingClientId && (
            <Text style={styles.fetchingText}>
              🔄 Fetching from server...
            </Text>
          )}
        </View>
        <View style={styles.clientIdRow}>
          <TextInput
            style={[styles.input, styles.clientIdInput]}
            value={clientId}
            onChangeText={setClientId}
            placeholder="55d4241f3a"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isFetchingClientId}
          />
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() =>
              fetchClientIdFromServer(serverUrl || serverConfig.serverUrl)
            }
            disabled={isFetchingClientId || !serverUrl}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={
                isFetchingClientId || !serverUrl ? "#9ca3af" : "#667eea"
              }
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          Will auto-fetch from server, or use default: 55d4241f3a
        </Text>
      </View>

      {serverConfig.serverUrl ? (
        <View style={styles.currentServer}>
          <Text style={styles.currentServerLabel}>Current Server:</Text>
          <Text style={styles.currentServerValue}>
            {serverConfig.serverUrl}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving || isFetchingClientId}
      >
        <Ionicons name="save-outline" size={20} color="#ffffff" />
        <Text style={styles.saveButtonText}>
          {isSaving ? "Checking server..." : "Save Configuration"}
        </Text>
      </TouchableOpacity>

      {!!serverConfig.serverUrl?.trim() && (
        <TouchableOpacity
          style={styles.demoResetButton}
          onPress={() => {
            Alert.alert(
              "Switch to demo?",
              "You will be logged out. The app will use sample data until you save a real server URL again.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Use demo",
                  style: "destructive",
                  onPress: async () => {
                    await saveServerConfig({
                      serverUrl: "",
                      hostname: "",
                      port: 8000,
                      isHttps: true,
                      clientId: "",
                    });
                    setServerUrl("");
                    setClientId("55d4241f3a");
                    await logout();
                    router.replace("/(auth)/login");
                    onSave?.();
                  },
                },
              ]
            );
          }}
        >
          <Ionicons name="flask-outline" size={20} color="#667eea" />
          <Text style={styles.demoResetButtonText}>
            Switch to demo (sample data)
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginLeft: 12,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#1e40af",
    marginLeft: 8,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  fetchingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#667eea",
  },
  clientIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#f9fafb",
    color: "#1f2937",
  },
  clientIdInput: {
    flex: 1,
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  helpText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    lineHeight: 18,
  },
  currentServer: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#86efac",
  },
  currentServerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#15803d",
    marginBottom: 4,
  },
  currentServerValue: {
    fontSize: 14,
    color: "#166534",
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },
  demoResetButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
    gap: 8,
  },
  demoResetButtonText: {
    color: "#4f46e5",
    fontSize: 15,
    fontWeight: "700",
  },
});
