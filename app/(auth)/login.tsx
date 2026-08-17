import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ScrollView,
  Clipboard,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuthStore } from "../../src/store/auth";
import { isDemoMode } from "../../src/api/demoMode";
import { http } from "../../src/api/http";
import { Ionicons } from "@expo/vector-icons";
import { ServerConfig } from "../../src/components/ServerConfig";
import { OTPInput } from "../../src/components/OTPInput";
import { oauthApi } from "../../src/api/oauth";
import AsyncStorage from "@react-native-async-storage/async-storage";

type LoginStep = "credentials" | "otp";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState<LoginStep>("credentials");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [receivedOTP, setReceivedOTP] = useState<string>("");
  const [displayedOTP, setDisplayedOTP] = useState<string>("");
  const { serverConfig, loadServerConfig } = useAuthStore();
  const demoMode = isDemoMode();

  useEffect(() => {
    loadServerConfig().catch((err) => {
      console.error("Failed to load server config:", err);
    });
  }, [loadServerConfig]);

  useEffect(() => {
    (async () => {
      try {
        const key = `lastUsername:${serverConfig?.serverUrl || "default"}`;
        const saved = await AsyncStorage.getItem(key);
        if (saved) setEmail(saved);
      } catch (e) {
        console.warn("Failed to read lastUsername:", e);
      }
    })();
  }, [serverConfig?.serverUrl]);

  useEffect(() => {
    if (!demoMode && currentStep === "otp") {
      setCurrentStep("credentials");
      setError("");
    }
  }, [demoMode, currentStep]);

  useEffect(() => {
    if (currentStep !== "otp" || !demoMode) return;

    const interval = setInterval(async () => {
      try {
        const clipboardContent = await Clipboard.getString();
        const otpMatch = clipboardContent.match(/\b\d{6}\b/);
        if (otpMatch) {
          setReceivedOTP(otpMatch[0]);
          clearInterval(interval);
        }
      } catch {
        // ignore clipboard errors
      }
    }, 1000);

    const timeout = setTimeout(() => clearInterval(interval), 60000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentStep, demoMode]);

  const rememberUsername = async () => {
    try {
      const key = `lastUsername:${serverConfig?.serverUrl || "default"}`;
      await AsyncStorage.setItem(key, email.trim().toLowerCase());
    } catch {
      // non-fatal
    }
  };

  const finishLogin = async (pwd = "") => {
    const { login } = useAuthStore.getState();
    const ok = await login({ usr: email.trim(), pwd });
    if (ok) {
      await rememberUsername();
      router.replace("/(tabs)");
      return true;
    }
    setError("Authentication failed");
    Alert.alert("Error", "Authentication failed");
    return false;
  };

  const handlePasswordLogin = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your username or email");
      return;
    }
    if (!password) {
      Alert.alert("Error", "Please enter your password");
      return;
    }
    if (!serverConfig.serverUrl?.trim()) {
      Alert.alert(
        "Server Not Configured",
        "Tap the server row below (⚙️) to enter your ERPNext URL before logging in."
      );
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      http.setBaseUrl(serverConfig.serverUrl);
      const result = await oauthApi.loginWithPassword(email.trim(), password);
      if (result.success && result.data) {
        await finishLogin(password);
      } else {
        setError(result.error || "Login failed");
        Alert.alert(
          "Login Failed",
          result.error || "Invalid username or password"
        );
      }
    } catch (err) {
      console.error("❌ Password login error:", err);
      setError("Network error. Please try again.");
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoContinue = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await oauthApi.requestOTP(email, "email");
      if (result.success) {
        setDisplayedOTP("");
        setReceivedOTP("");
        await rememberUsername();
        setCurrentStep("otp");
        Alert.alert(
          "Demo mode",
          "No email is sent. Enter any 6 digits (for example 123456) to sign in."
        );
      } else {
        setError(result.error || "Failed to continue");
        Alert.alert("Error", result.error || "Failed to continue");
      }
    } catch (err) {
      console.error("❌ Demo continue error:", err);
      setError("Something went wrong. Please try again.");
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialsSubmit = async () => {
    if (demoMode) {
      await handleDemoContinue();
    } else {
      await handlePasswordLogin();
    }
  };

  const handleOTPSubmit = async (enteredOtp: string) => {
    if (enteredOtp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await oauthApi.exchangeOTPForToken(email, enteredOtp);
      if (result.success && result.data) {
        await finishLogin("");
      } else {
        setError(result.error || "Invalid OTP");
        Alert.alert("OTP Error", result.error || "Invalid OTP");
      }
    } catch (err) {
      console.error("❌ OTP submit error:", err);
      setError("Network error. Please try again.");
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    setError("");
    try {
      if (isDemoMode()) {
        setDisplayedOTP("");
        setReceivedOTP("");
        Alert.alert(
          "Demo mode",
          "No email is sent in demo. Enter any 6 digits (for example 123456) to sign in."
        );
        return;
      }

      const result = await oauthApi.requestOTP(email, "email");
      if (result.success) {
        setDisplayedOTP("");
        setReceivedOTP("");
        Alert.alert(
          "OTP Resent",
          "A new 6-digit code has been sent to your email."
        );
      } else {
        setError(result.error || "Failed to resend OTP");
        Alert.alert("Error", result.error || "Failed to resend OTP");
      }
    } catch {
      setError("Network error. Please try again.");
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPClick = () => {
    if (displayedOTP) {
      setReceivedOTP(displayedOTP);
      Alert.alert("OTP Filled", `OTP ${displayedOTP} has been filled automatically.`);
    }
  };

  const handleBackToEmail = () => {
    setCurrentStep("credentials");
    setError("");
  };

  const getServerDisplay = () => {
    if (isDemoMode()) return "Demo Server (sample data)";
    return serverConfig.serverUrl || "No server configured";
  };

  return (
    <LinearGradient
      colors={["#667eea", "#764ba2"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        style={styles.keyboardView}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContainer}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../../assets/icon.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Printechs ERP Application</Text>
              <Text style={styles.subtitle}>Analytics & Approvals</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.card}>
                {currentStep === "credentials" ? (
                  <>
                    <Text style={styles.welcomeText}>Welcome Back</Text>
                    <Text style={styles.instructionText}>
                      {demoMode
                        ? "Demo mode: enter any email, then any 6-digit code (no real email is sent)."
                        : "Sign in with your ERPNext username and password"}
                    </Text>

                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color="#9ca3af"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder={
                          demoMode ? "Email Address" : "Username or Email"
                        }
                        placeholderTextColor="#9ca3af"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                      />
                    </View>

                    {!demoMode && (
                      <View style={styles.inputContainer}>
                        <Ionicons
                          name="lock-closed-outline"
                          size={20}
                          color="#9ca3af"
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Password"
                          placeholderTextColor="#9ca3af"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="password"
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword((v) => !v)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#9ca3af"
                          />
                        </TouchableOpacity>
                      </View>
                    )}

                    {!!error && !demoMode && (
                      <Text style={styles.inlineError}>{error}</Text>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.loginButton,
                        isLoading && styles.loginButtonDisabled,
                      ]}
                      onPress={handleCredentialsSubmit}
                      disabled={isLoading}
                    >
                      <LinearGradient
                        colors={["#667eea", "#764ba2"]}
                        style={styles.loginGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={styles.loginButtonText}>
                          {isLoading
                            ? demoMode
                              ? "Continuing..."
                              : "Signing in..."
                            : demoMode
                              ? "Continue"
                              : "Login"}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.welcomeText}>Enter OTP</Text>
                    <Text style={styles.instructionText}>
                      {demoMode
                        ? `Demo: no message was sent to ${email}. Type any 6 digits below.`
                        : `We've sent a 6-digit code to ${email}`}
                    </Text>

                    {demoMode && (
                      <View style={styles.demoOtpHint}>
                        <Ionicons
                          name="information-circle"
                          size={22}
                          color="#4f46e5"
                        />
                        <Text style={styles.demoOtpHintText}>
                          Example codes that work:{" "}
                          <Text style={styles.demoOtpMono}>123456</Text> or{" "}
                          <Text style={styles.demoOtpMono}>000000</Text>
                        </Text>
                      </View>
                    )}

                    {receivedOTP ? (
                      <View style={styles.otpDisplayContainer}>
                        <Text style={styles.otpDisplayLabel}>Your OTP Code:</Text>
                        <TouchableOpacity
                          style={styles.otpDisplayButton}
                          onPress={handleOTPClick}
                          disabled={isLoading}
                        >
                          <Text style={styles.otpDisplayText}>{receivedOTP}</Text>
                          <Ionicons name="copy-outline" size={20} color="#007AFF" />
                        </TouchableOpacity>
                        <Text style={styles.otpDisplayHint}>
                          Tap the code above to auto-fill
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.otpInstructionsContainer}>
                      {demoMode ? (
                        <>
                          <Text style={styles.otpInstructionsText}>
                            No inbox check needed — demo uses sample data only.
                          </Text>
                          <Text style={styles.otpInstructionsSubtext}>
                            Connect a real server URL in server settings to use
                            email OTP.
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.otpInstructionsText}>
                            Check your email for the 6-digit OTP code
                          </Text>
                          <Text style={styles.otpInstructionsSubtext}>
                            The code expires in 5 minutes
                          </Text>
                        </>
                      )}
                    </View>

                    <OTPInput
                      length={6}
                      onComplete={handleOTPSubmit}
                      onResend={handleResendOTP}
                      disabled={isLoading}
                      error={error}
                      receivedOTP={receivedOTP}
                      displayOTP={receivedOTP}
                    />

                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={handleBackToEmail}
                      disabled={isLoading}
                    >
                      <Ionicons name="arrow-back" size={20} color="#667eea" />
                      <Text style={styles.backButtonText}>Change Email</Text>
                    </TouchableOpacity>
                  </>
                )}

                {currentStep === "credentials" && (
                  <TouchableOpacity
                    style={styles.serverContainer}
                    onPress={() => setShowServerConfig(true)}
                  >
                    <View style={styles.serverInfo}>
                      <Ionicons name="server-outline" size={16} color="#667eea" />
                      <View style={styles.serverTextContainer}>
                        <Text style={styles.serverLabel}>Server:</Text>
                        <Text style={styles.serverText} numberOfLines={1}>
                          {getServerDisplay()}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="settings-outline" size={20} color="#667eea" />
                  </TouchableOpacity>
                )}

                {currentStep === "credentials" && demoMode && (
                  <View style={styles.demoContainer}>
                    <Text style={styles.demoText}>
                      Demo uses sample data. Tap Server to enter your ERPNext URL
                      for live data.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <Text style={styles.footer}>Powered by Printechs</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showServerConfig}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowServerConfig(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Server Configuration</Text>
            <TouchableOpacity
              onPress={() => setShowServerConfig(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <ServerConfig onSave={() => setShowServerConfig(false)} />
          </ScrollView>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === "ios" ? 160 : 80,
  },
  content: { flex: 1, justifyContent: "space-between" },
  header: { alignItems: "center", marginTop: 24 },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    borderColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: { width: 120, height: 120, borderRadius: 60 },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: { fontSize: 16, color: "rgba(255, 255, 255, 0.9)" },
  formContainer: { flex: 1, justifyContent: "center" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    textAlign: "center",
  },
  inlineError: {
    color: "#dc2626",
    fontSize: 13,
    marginBottom: 8,
    textAlign: "center",
  },
  otpDisplayContainer: {
    backgroundColor: "#f0f8ff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#007AFF",
    alignItems: "center",
  },
  otpDisplayLabel: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
    marginBottom: 8,
  },
  otpDisplayButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#007AFF",
    marginBottom: 8,
  },
  otpDisplayText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#007AFF",
    letterSpacing: 4,
    marginRight: 8,
  },
  otpDisplayHint: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    fontStyle: "italic",
  },
  demoOtpHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#eef2ff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  demoOtpHintText: {
    flex: 1,
    fontSize: 14,
    color: "#3730a3",
    lineHeight: 20,
    fontWeight: "500",
  },
  demoOtpMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "700",
    color: "#1e1b4b",
  },
  otpInstructionsContainer: {
    backgroundColor: "#f0f8ff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  otpInstructionsText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  otpInstructionsSubtext: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: "#1f2937" },
  loginButton: { borderRadius: 12, overflow: "hidden", marginTop: 8 },
  loginButtonDisabled: { opacity: 0.6 },
  loginGradient: { paddingVertical: 16, alignItems: "center" },
  loginButtonText: { color: "#ffffff", fontSize: 18, fontWeight: "bold" },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#667eea",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  serverContainer: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  serverInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  serverTextContainer: { flex: 1 },
  serverLabel: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
  serverText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
    marginTop: 2,
  },
  demoContainer: { marginTop: 16, alignItems: "center" },
  demoText: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  footer: {
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    marginBottom: 20,
  },
  modalContainer: { flex: 1, backgroundColor: "#f9fafb" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1f2937" },
  closeButton: { padding: 4 },
  modalContent: { flex: 1 },
});
