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
  Linking,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuthStore } from "../../src/store/auth";
import { Ionicons } from "@expo/vector-icons";
import { ServerConfig } from "../../src/components/ServerConfig";
import { OTPInput } from "../../src/components/OTPInput";
import { oauthApi } from "../../src/api/oauth";
import AsyncStorage from "@react-native-async-storage/async-storage";

type LoginStep = "email" | "otp";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [currentStep, setCurrentStep] = useState<LoginStep>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [receivedOTP, setReceivedOTP] = useState<string>("");
  const [displayedOTP, setDisplayedOTP] = useState<string>("");
  const [isMonitoringClipboard, setIsMonitoringClipboard] = useState(false);
  const { serverConfig, loadServerConfig } = useAuthStore();

  // Load server config on component mount
  useEffect(() => {
    loadServerConfig().catch((error) => {
      console.error("Failed to load server config:", error);
    });
  }, []);

  // Prefill last used email (per server) on mount and when server config loads
  useEffect(() => {
    (async () => {
      try {
        const key = `lastUsername:${serverConfig?.serverUrl || "default"}`;
        const saved = await AsyncStorage.getItem(key);
        if (saved) {
          setEmail(saved);
        }
      } catch (e) {
        // non-fatal
        console.warn("Failed to read lastUsername:", e);
      }
    })();
  }, [serverConfig?.serverUrl]);

  // Monitor clipboard for OTP when on OTP step
  useEffect(() => {
    if (currentStep === "otp") {
      setIsMonitoringClipboard(true);
      const interval = setInterval(async () => {
        try {
          const clipboardContent = await Clipboard.getString();
          // Check if clipboard contains a 6-digit number
          const otpMatch = clipboardContent.match(/\b\d{6}\b/);
          if (otpMatch) {
            const detectedOTP = otpMatch[0];
            console.log("📋 OTP detected from clipboard:", detectedOTP);
            // Update received OTP (this will trigger display)
            setReceivedOTP(detectedOTP);
            setIsMonitoringClipboard(false);
            clearInterval(interval);
            Alert.alert(
              "OTP Detected",
              `OTP ${detectedOTP} detected from clipboard and filled automatically.`
            );
          }
        } catch (error) {
          console.log("Clipboard monitoring error:", error);
        }
      }, 1000);

      // Stop monitoring after 60 seconds
      const timeout = setTimeout(() => {
        setIsMonitoringClipboard(false);
        clearInterval(interval);
      }, 60000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        setIsMonitoringClipboard(false);
      };
    }
  }, [currentStep]);

  const handleEmailSubmit = async () => {
    console.log("📧 Email submit called with:", email);
    console.log("🔧 Server config:", serverConfig);

    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    // Check if server is configured
    if (!serverConfig.serverUrl) {
      console.log("❌ No server URL configured");
      Alert.alert(
        "Server Not Configured",
        "Please configure your ERPNext server in Settings before logging in."
      );
      return;
    }

    console.log("✅ Server configured, requesting OTP...");
    setIsLoading(true);
    setError("");

    try {
      const result = await oauthApi.requestOTP(email, "email");

      console.log("📧 OTP request result:", result);

      if (result.success) {
        // Clear any previous OTP - will be set when received from email
        setDisplayedOTP("");
        setReceivedOTP("");
        // Remember this email for next time (per server)
        try {
          const key = `lastUsername:${serverConfig?.serverUrl || "default"}`;
          await AsyncStorage.setItem(key, email.trim().toLowerCase());
        } catch {}
        setCurrentStep("otp");
        Alert.alert(
          "OTP Sent",
          `A 6-digit code has been sent to ${email}. Please check your email and copy the OTP.`
        );
      } else {
        setError(result.error || "Failed to send OTP");
        Alert.alert("Error", result.error || "Failed to send OTP");
      }
    } catch (error) {
      console.error("❌ OTP request error:", error);
      setError("Network error. Please try again.");
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async (enteredOtp: string) => {
    console.log("🔐 OTP Submit called with:", enteredOtp);

    if (enteredOtp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log("🔄 Calling exchangeOTPForToken...");
      const result = await oauthApi.exchangeOTPForToken(email, enteredOtp);

      console.log("📥 OTP exchange result:", result);

      if (result.success && result.data) {
        console.log("✅ OTP exchange successful, calling auth store login...");

        // Store user info in auth store
        const { login } = useAuthStore.getState();
        const loginResult = await login({ usr: email, pwd: "" }); // OAuth doesn't need password

        console.log("🏪 Auth store login result:", loginResult);

        if (loginResult) {
          // Ensure email is remembered
          try {
            const key = `lastUsername:${serverConfig?.serverUrl || "default"}`;
            await AsyncStorage.setItem(key, email.trim().toLowerCase());
          } catch {}
          console.log("🎉 Login successful, navigating to tabs...");
          Alert.alert("Success", "Login successful!");
          router.replace("/(tabs)");
        } else {
          console.log("❌ Auth store login failed");
          setError("Authentication failed");
          Alert.alert("Error", "Authentication failed");
        }
      } else {
        console.log("❌ OTP exchange failed:", result.error);
        setError(result.error || "Invalid OTP");

        // Show specific error message based on the error
        let alertMessage = result.error || "Invalid OTP";
        if (result.error?.includes("expired")) {
          alertMessage = "OTP has expired. Please request a new one.";
        } else if (result.error?.includes("Invalid")) {
          alertMessage = "Invalid OTP. Please check the code and try again.";
        }

        Alert.alert("OTP Error", alertMessage);
      }
    } catch (error) {
      console.error("❌ OTP submit error:", error);
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
      const result = await oauthApi.requestOTP(email, "email");

      if (result.success) {
        // Clear any previous OTP - will be set when received from email
        setDisplayedOTP("");
        setReceivedOTP("");
        Alert.alert(
          "OTP Resent",
          "A new 6-digit code has been sent to your email. Please check your email and copy the OTP."
        );
      } else {
        setError(result.error || "Failed to resend OTP");
        Alert.alert("Error", result.error || "Failed to resend OTP");
      }
    } catch (error) {
      setError("Network error. Please try again.");
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPClick = () => {
    if (displayedOTP) {
      setReceivedOTP(displayedOTP);
      Alert.alert(
        "OTP Filled",
        `OTP ${displayedOTP} has been filled automatically.`
      );
    }
  };

  const handleOpenEmail = async () => {
    try {
      // Try to open default email app
      const emailUrl = `mailto:${email}`;
      const canOpen = await Linking.canOpenURL(emailUrl);

      if (canOpen) {
        await Linking.openURL(emailUrl);
        Alert.alert(
          "Email Opened",
          "Please copy the 6-digit OTP from your email and return to this app. The OTP will be detected automatically.",
          [{ text: "OK", style: "default" }]
        );
      } else {
        Alert.alert(
          "Email App Not Found",
          "Please check your email manually and copy the 6-digit OTP code."
        );
      }
    } catch (error) {
      console.error("Error opening email:", error);
      Alert.alert(
        "Error",
        "Could not open email app. Please check your email manually."
      );
    }
  };

  const handleManualOTPEntry = () => {
    Alert.alert(
      "Manual OTP Entry",
      "Please enter the 6-digit OTP code you received in your email.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          style: "default",
          onPress: () => {
            // Focus on first OTP input
            // This will be handled by the OTPInput component
          },
        },
      ]
    );
  };

  const handleBackToEmail = () => {
    setCurrentStep("email");
    setOtp("");
    setError("");
  };

  const getServerDisplay = () => {
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
            {/* Logo/Title */}
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

          {/* Login Form */}
          <View style={styles.formContainer}>
            <View style={styles.card}>
              {currentStep === "email" ? (
                <>
                  <Text style={styles.welcomeText}>Welcome Back</Text>
                  <Text style={styles.instructionText}>
                    Enter your email to receive OTP
                  </Text>

                  {/* Email Input */}
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color="#9ca3af"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Email Address"
                      placeholderTextColor="#9ca3af"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                    />
                  </View>

                  {/* Login Button */}
                  <TouchableOpacity
                    style={[
                      styles.loginButton,
                      isLoading && styles.loginButtonDisabled,
                    ]}
                    onPress={handleEmailSubmit}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={["#667eea", "#764ba2"]}
                      style={styles.loginGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.loginButtonText}>
                        {isLoading ? "Sending OTP..." : "Send OTP"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.welcomeText}>Enter OTP</Text>
                  <Text style={styles.instructionText}>
                    We've sent a 6-digit code to {email}
                  </Text>

                  {/* Display OTP for easy access - Only show when received from email */}
                  {receivedOTP && (
                    <View style={styles.otpDisplayContainer}>
                      <Text style={styles.otpDisplayLabel}>Your OTP Code:</Text>
                      <TouchableOpacity
                        style={styles.otpDisplayButton}
                        onPress={handleOTPClick}
                        disabled={isLoading}
                      >
                        <Text style={styles.otpDisplayText}>{receivedOTP}</Text>
                        <Ionicons
                          name="copy-outline"
                          size={20}
                          color="#007AFF"
                        />
                      </TouchableOpacity>
                      <Text style={styles.otpDisplayHint}>
                        Tap the code above to auto-fill
                      </Text>
                    </View>
                  )}

                  {/* Simple instructions */}
                  <View style={styles.otpInstructionsContainer}>
                    <Text style={styles.otpInstructionsText}>
                      📧 Check your email for the 6-digit OTP code
                    </Text>
                    <Text style={styles.otpInstructionsSubtext}>
                      The code expires in 5 minutes
                    </Text>
                  </View>

                  {/* OTP Input */}
                  <OTPInput
                    length={6}
                    onComplete={handleOTPSubmit}
                    onResend={handleResendOTP}
                    disabled={isLoading}
                    error={error}
                    receivedOTP={receivedOTP}
                    displayOTP={receivedOTP}
                  />

                  {/* Back to Email Button */}
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

              {/* Server Info - Hidden on OTP screen */}
              {currentStep === "email" && (
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

              {/* Demo Info - Hidden on OTP screen */}
              {currentStep === "email" && (
                <View style={styles.demoContainer}>
                  <Text style={styles.demoText}>
                    Demo: Use your registered email address
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Footer */}
          </View>
          <Text style={styles.footer}>Powered by Printechs</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Server Configuration Modal */}
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
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === "ios" ? 160 : 80,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    marginTop: 24,
  },
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
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
  },
  formContainer: {
    flex: 1,
    justifyContent: "center",
  },
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
  otpHelpContainer: {
    backgroundColor: "#f0f8ff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  otpHelpText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  otpHelpSubtext: {
    fontSize: 12,
    color: "#6b7280",
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
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1f2937",
  },
  loginButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
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
  serverTextContainer: {
    flex: 1,
  },
  serverLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
  },
  serverText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
    marginTop: 2,
  },
  demoContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  demoText: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },
  footer: {
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    marginBottom: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
});
