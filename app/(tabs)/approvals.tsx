import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Animated,
  Linking,
} from "react-native";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { useApprovalsList, optimizedApis } from "../../src/hooks/useOptimizedApis";
import { LoadingScreen } from "../../src/components/LoadingScreen";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

// Configure notification behavior with custom sound
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function ApprovalsScreen() {
  const { data, isLoading, error, refetch } = useApprovalsList();
  const approvals = data || [];
  const [refreshing, setRefreshing] = useState(false);
  const [prevCount, setPrevCount] = useState(0);

  // Auto-refresh approvals when screen comes into focus (user navigates to tab)
  useFocusEffect(
    useCallback(() => {
      console.log("📋 Approvals tab focused - refreshing data...");
      refetch();
    }, [refetch])
  );


  // Track changes in approval count and show notification
  useEffect(() => {
    async function showNotification() {
      if (prevCount > 0 && approvals.length > prevCount) {
        // New documents added
        const newCount = approvals.length - prevCount;

        // Configure Android notification channel for sound
        await Notifications.setNotificationChannelAsync("approvals", {
          name: "Approvals",
          importance: Notifications.AndroidImportance.HIGH,
          sound: "default",
          vibrationPattern: [0, 250, 250, 250],
          showBadge: true,
        });

        // Schedule notification with channel
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "New Approvals",
            body: `${newCount} new document${
              newCount > 1 ? "s" : ""
            } pending approval`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });

        console.log("🔔 Notification sent with sound!");
      }
      setPrevCount(approvals.length);
    }

    showNotification();
  }, [approvals.length, prevCount]);

  // Debug logging
  useEffect(() => {
    console.log("📋 Approvals Screen - Total approvals:", approvals.length);
    const types = approvals.reduce((acc: any, item: any) => {
      acc[item.doctype] = (acc[item.doctype] || 0) + 1;
      return acc;
    }, {});
    console.log("📑 Document types:", types);
    console.log("📄 Full approvals data:", JSON.stringify(approvals, null, 2));
  }, [approvals]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditData, setCreditData] = useState<any>(null);

  // Animation for cards
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleApprove = (item: any) => {
    Alert.alert(
      "Approve Document",
      `Are you sure you want to approve ${item.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          style: "default",
          onPress: async () => {
            try {
              await optimizedApis.approveDocument(item.doctype, item.name);
              Alert.alert("Success", "Document approved successfully");
              await refetch();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "Failed to approve document"
              );
            }
          },
        },
      ]
    );
  };

  const handleReject = (item: any) => {
    setSelectedItem(item);
    setShowRejectModal(true);
  };

  const handleViewCredit = (item: any) => {
    setCreditData(item);
    setShowCreditModal(true);
  };

  const handleSendStatement = async (item: any) => {
    try {
      // Get configured server URL
      const { useAuthStore } = require("../../src/store/auth");
      const serverUrl = useAuthStore.getState().serverConfig.serverUrl;

      // Generate PDF URL dynamically
      const pdfUrl = `${serverUrl}/api/method/get_statement_pdf?customer=${item.customer}&from_date=${item.posting_date}&to_date=${item.due_date}`;

      // Generate WhatsApp message
      const message = `Dear ${
        item.customer_name
      },\n\nPlease find attached your account statement.\n\nOutstanding Amount: ${item.customer_outstanding?.toLocaleString()} SAR\nOverdue Amount: ${item.customer_overdue?.toLocaleString()} SAR\n\nThank you for your prompt attention.\n\nBest regards,\nPrintechs`;

      // Encode URL
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

      // Try to open WhatsApp
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        Alert.alert("Success", "Opening WhatsApp...");
      } else {
        Alert.alert("Error", "WhatsApp is not installed on this device.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to open WhatsApp");
    }
  };

  const handleSendStatementByEmail = async (item: any) => {
    try {
      // Show loading state
      Alert.alert(
        "Sending Email",
        "Sending statement of account via email...",
        [{ text: "OK" }]
      );

      // Call the API to send email
      await optimizedApis.sendStatementByEmail(item.customer);

      // Success message
      Alert.alert(
        "Email Sent",
        `Statement of Account has been sent successfully to ${item.customer_name} via email.`,
        [{ text: "OK" }]
      );
    } catch (error: any) {
      // Show detailed error message from backend
      Alert.alert(
        "Error",
        error.message || "Failed to send email. Please try again."
      );
    }
  };

  const getCustomerStatus = (item: any) => {
    if (item.customer_overdue && item.customer_overdue > 0) {
      return { text: "Overdue", color: "#ef4444" };
    }
    if (item.customer_outstanding && item.customer_outstanding > 0) {
      return { text: "Outstanding", color: "#f59e0b" };
    }
    return { text: "Clear", color: "#10b981" };
  };

  const confirmReject = async () => {
    if (!selectedItem) return;

    try {
      await optimizedApis.rejectDocument(
        selectedItem.doctype,
        selectedItem.name,
        rejectReason
      );
      Alert.alert("Success", "Document rejected successfully");
      setShowRejectModal(false);
      setRejectReason("");
      await refetch();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to reject document");
    }
  };

  const getDocumentIcon = (doctype: string) => {
    switch (doctype) {
      case "Sales Invoice":
        return "receipt";
      case "Delivery Note":
        return "cube";
      case "Material Request":
        return "layers";
      default:
        return "document";
    }
  };

  const getDocumentColor = (doctype: string) => {
    switch (doctype) {
      case "Sales Invoice":
        return { primary: "#3b82f6", gradient: ["#3b82f6", "#2563eb"] };
      case "Delivery Note":
        return { primary: "#10b981", gradient: ["#10b981", "#059669"] };
      case "Material Request":
        return { primary: "#f59e0b", gradient: ["#f59e0b", "#d97706"] };
      default:
        return { primary: "#667eea", gradient: ["#667eea", "#764ba2"] };
    }
  };

  if (isLoading && approvals.length === 0) {
    return <LoadingScreen message="Loading approvals..." />;
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.headerSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={styles.title}>Pending Approvals</Text>
          <View style={styles.headerRight}>
            {approvals.length > 0 && (
              <LinearGradient
                colors={["#667eea", "#764ba2"]}
                style={styles.badge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.badgeText}>{approvals.length}</Text>
              </LinearGradient>
            )}
            {/* Manual Refresh Button */}
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Ionicons
                name="refresh"
                size={24}
                color={refreshing ? "#9ca3af" : "#667eea"}
              />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Review and approve pending documents
        </Text>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#667eea"
            colors={["#667eea", "#764ba2"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {approvals.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#10b981" />
            </View>
            <Text style={styles.emptyTitle}>All caught up! 🎉</Text>
            <Text style={styles.emptyMessage}>
              No pending approvals at the moment
            </Text>
          </View>
        ) : (
          approvals.map((item, index) => {
            const colors = getDocumentColor(item.doctype);
            const delay = index * 100;

            return (
              <Animated.View
                key={`${item.id}-${index}`}
                style={[
                  styles.cardContainer,
                  {
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 30 - delay],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.card}>
                  {/* Top Border Accent */}
                  <View
                    style={[
                      styles.cardTopBorder,
                      { backgroundColor: colors.primary },
                    ]}
                  />

                  {/* Card Header with Gradient */}
                  <View
                    style={[
                      styles.cardHeader,
                      { backgroundColor: `${colors.primary}08` },
                    ]}
                  >
                    <View style={styles.doctypeBadge}>
                      <View
                        style={[
                          styles.iconContainer,
                          { backgroundColor: `${colors.primary}20` },
                        ]}
                      >
                        <Ionicons
                          name={getDocumentIcon(item.doctype)}
                          size={24}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.doctypeInfo}>
                        <Text
                          style={[
                            styles.doctypeText,
                            { color: colors.primary },
                          ]}
                        >
                          {item.doctype}
                        </Text>
                        <Text style={styles.documentNumber}>{item.name}</Text>
                      </View>
                    </View>
                    <View style={styles.statusBadge}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>Pending</Text>
                    </View>
                  </View>

                  {/* Customer Info */}
                  <View style={styles.customerSection}>
                    <View style={styles.customerIconContainer}>
                      <Ionicons name="business" size={20} color="#667eea" />
                    </View>
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>
                        {item.customer_name}
                      </Text>
                      <View style={styles.metaRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={14}
                          color="#6b7280"
                        />
                        <Text style={styles.postingDate}>
                          {new Date(item.posting_date).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </Text>
                        {item.branch && (
                          <>
                            <View style={styles.dot} />
                            <Ionicons
                              name="location-outline"
                              size={14}
                              color="#6b7280"
                            />
                            <Text style={styles.branchText}>{item.branch}</Text>
                          </>
                        )}
                        {item.territory && (
                          <>
                            <View style={styles.dot} />
                            <Ionicons
                              name="globe-outline"
                              size={14}
                              color="#667eea"
                            />
                            <Text style={styles.territoryText}>
                              {item.territory}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    {item.customer_outstanding !== undefined && (
                      <TouchableOpacity
                        style={styles.statusButton}
                        onPress={() => handleViewCredit(item)}
                      >
                        <LinearGradient
                          colors={
                            getCustomerStatus(item).color === "#ef4444"
                              ? ["#fef2f2", "#fee2e2"]
                              : getCustomerStatus(item).color === "#f59e0b"
                              ? ["#fef9c3", "#fef3c7"]
                              : ["#ecfdf5", "#d1fae5"]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.statusButtonGradient}
                        >
                          <Ionicons
                            name={
                              getCustomerStatus(item).color === "#ef4444"
                                ? "alert-circle"
                                : getCustomerStatus(item).color === "#f59e0b"
                                ? "time"
                                : "checkmark-circle"
                            }
                            size={14}
                            color={getCustomerStatus(item).color}
                          />
                          <Text
                            style={[
                              styles.statusButtonText,
                              { color: getCustomerStatus(item).color },
                            ]}
                          >
                            {getCustomerStatus(item).text}
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={14}
                            color={getCustomerStatus(item).color}
                            style={styles.statusButtonChevron}
                          />
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Financial Details Grid */}
                  <View style={styles.financialContainer}>
                    <View style={styles.financialRow}>
                      <View style={styles.financialItem}>
                        <View style={styles.financialIcon}>
                          <Ionicons
                            name="cube-outline"
                            size={18}
                            color="#8b5cf6"
                          />
                        </View>
                        <Text style={styles.financialLabel}>Quantity</Text>
                        <Text style={styles.financialValue}>
                          {item.total_quantity.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.financialDivider} />
                      <View style={styles.financialItem}>
                        <View style={styles.financialIcon}>
                          <Ionicons
                            name="cash-outline"
                            size={18}
                            color="#3b82f6"
                          />
                        </View>
                        <Text style={styles.financialLabel}>Amount</Text>
                        <Text style={styles.financialValue}>
                          {item.total_amount.toLocaleString()}
                        </Text>
                        <Text style={styles.currency}>SAR</Text>
                      </View>
                    </View>

                    <View style={styles.vatRow}>
                      <View style={styles.vatBadge}>
                        <Ionicons
                          name="receipt-outline"
                          size={14}
                          color="#10b981"
                        />
                        <Text style={styles.vatLabel}>VAT</Text>
                      </View>
                      <Text style={styles.vatAmount}>
                        +{item.vat_amount.toLocaleString()} SAR
                      </Text>
                    </View>

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total Amount</Text>
                      <View style={styles.totalContainer}>
                        <Text style={styles.totalAmount}>
                          {item.total_with_vat.toLocaleString()}
                        </Text>
                        <Text style={styles.totalCurrency}>SAR</Text>
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => handleReject(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={22}
                        color="#ef4444"
                      />
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.approveButton}
                      onPress={() => handleApprove(item)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={colors.gradient as any}
                        style={styles.approveGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color="#ffffff"
                        />
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* Credit Status Modal */}
      <Modal
        visible={showCreditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.creditModalCard}>
            {/* Header */}
            <View style={styles.creditModalHeader}>
              <View
                style={[
                  styles.creditModalIconBadge,
                  {
                    backgroundColor:
                      creditData?.customer_overdue &&
                      creditData?.customer_overdue > 0
                        ? "#fef2f2"
                        : creditData?.customer_outstanding &&
                          creditData?.customer_outstanding > 0
                        ? "#fef9c3"
                        : "#ecfdf5",
                  },
                ]}
              >
                <Ionicons
                  name={
                    creditData?.customer_overdue &&
                    creditData?.customer_overdue > 0
                      ? "alert-circle"
                      : creditData?.customer_outstanding &&
                        creditData?.customer_outstanding > 0
                      ? "information-circle"
                      : "checkmark-circle"
                  }
                  size={40}
                  color={
                    creditData?.customer_overdue &&
                    creditData?.customer_overdue > 0
                      ? "#ef4444"
                      : creditData?.customer_outstanding &&
                        creditData?.customer_outstanding > 0
                      ? "#f59e0b"
                      : "#10b981"
                  }
                />
              </View>
              <Text style={styles.creditModalTitle}>
                {creditData?.customer_overdue &&
                creditData?.customer_overdue > 0
                  ? "Payment Overdue"
                  : creditData?.customer_outstanding &&
                    creditData?.customer_outstanding > 0
                  ? "Outstanding Balance"
                  : "Account Status"}
              </Text>
              <Text style={styles.creditModalSubtitle}>
                {creditData?.customer_name}
              </Text>
            </View>

            {/* Scrollable Credit Details */}
            <ScrollView
              style={styles.creditModalScrollView}
              showsVerticalScrollIndicator={true}
            >
              {creditData && (
                <View style={styles.creditDetailsContainer}>
                  <View
                    style={[
                      styles.combinedCreditCard,
                      creditData.customer_overdue &&
                      creditData.customer_overdue > 0
                        ? styles.combinedCreditCardDanger
                        : null,
                    ]}
                  >
                    {/* Left: Outstanding */}
                    <View style={styles.combinedCreditItem}>
                      <View style={styles.combinedCreditHeader}>
                        <Ionicons
                          name="wallet-outline"
                          size={16}
                          color="#6b7280"
                        />
                        <Text style={styles.combinedCreditLabel}>
                          Outstanding
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.combinedCreditValue,
                          creditData.customer_outstanding > 0 &&
                            styles.combinedCreditWarning,
                        ]}
                      >
                        {creditData.customer_outstanding.toLocaleString()} SAR
                      </Text>
                    </View>

                    {/* Vertical Divider */}
                    <View
                      style={[
                        styles.combinedCreditDivider,
                        creditData.customer_overdue &&
                        creditData.customer_overdue > 0
                          ? styles.combinedCreditDividerDanger
                          : null,
                      ]}
                    />

                    {/* Right: Total Overdue */}
                    <View style={styles.combinedCreditItem}>
                      <View style={styles.combinedCreditHeader}>
                        <Ionicons
                          name={
                            creditData.customer_overdue &&
                            creditData.customer_overdue > 0
                              ? "alert-circle"
                              : "time-outline"
                          }
                          size={16}
                          color={
                            creditData.customer_overdue &&
                            creditData.customer_overdue > 0
                              ? "#ef4444"
                              : "#6b7280"
                          }
                        />
                        <Text
                          style={[
                            styles.combinedCreditLabel,
                            creditData.customer_overdue &&
                              creditData.customer_overdue > 0 &&
                              styles.combinedCreditLabelDanger,
                          ]}
                        >
                          Overdue
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.combinedCreditValue,
                          creditData.customer_overdue &&
                          creditData.customer_overdue > 0
                            ? styles.combinedCreditDanger
                            : styles.combinedCreditSafe,
                        ]}
                      >
                        {creditData.customer_overdue?.toLocaleString() || 0} SAR
                      </Text>
                    </View>
                  </View>

                  {/* Aging Analysis Summary - Top Section */}
                  <View style={styles.agingSummarySection}>
                    <View style={styles.agingSummaryHeader}>
                      <Ionicons
                        name="analytics-outline"
                        size={18}
                        color="#667eea"
                      />
                      <Text style={styles.agingSummaryTitle}>
                        Aging Summary
                      </Text>
                    </View>

                    <View style={styles.agingSummaryRow}>
                      <View style={styles.agingSummaryBadge}>
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color="#3b82f6"
                        />
                        <Text style={styles.agingSummaryLabel}>0-30 Days</Text>
                      </View>
                      <Text style={styles.agingSummaryValue}>
                        {creditData.outstanding_0_30?.toLocaleString() || 0} SAR
                      </Text>
                    </View>

                    <View style={styles.agingSummaryRow}>
                      <View style={styles.agingSummaryBadge}>
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color="#f59e0b"
                        />
                        <Text style={styles.agingSummaryLabel}>31-60 Days</Text>
                      </View>
                      <Text style={styles.agingSummaryValue}>
                        {creditData.outstanding_31_60?.toLocaleString() || 0}{" "}
                        SAR
                      </Text>
                    </View>

                    <View style={styles.agingSummaryRow}>
                      <View style={styles.agingSummaryBadge}>
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color="#f97316"
                        />
                        <Text style={styles.agingSummaryLabel}>61-90 Days</Text>
                      </View>
                      <Text style={styles.agingSummaryValue}>
                        {creditData.outstanding_61_90?.toLocaleString() || 0}{" "}
                        SAR
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.agingSummaryRow,
                        styles.agingSummaryRowDanger,
                      ]}
                    >
                      <View style={styles.agingSummaryBadge}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={16}
                          color="#ef4444"
                        />
                        <Text style={styles.agingSummaryLabelDanger}>
                          &gt;90 Days
                        </Text>
                      </View>
                      <Text style={styles.agingSummaryValueDanger}>
                        {creditData.outstanding_over_90?.toLocaleString() || 0}{" "}
                        SAR
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.creditModalActions}>
              {creditData?.customer_overdue &&
                creditData?.customer_overdue > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.whatsappButton}
                      onPress={() => handleSendStatement(creditData)}
                    >
                      <Ionicons
                        name="logo-whatsapp"
                        size={24}
                        color="#ffffff"
                      />
                      <Text style={styles.whatsappButtonText}>
                        Send via WhatsApp
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.emailButton}
                      onPress={() => handleSendStatementByEmail(creditData)}
                    >
                      <Ionicons name="mail" size={24} color="#ffffff" />
                      <Text style={styles.emailButtonText}>Send via Email</Text>
                    </TouchableOpacity>
                  </>
                )}
              <TouchableOpacity
                style={styles.creditModalCloseButton}
                onPress={() => setShowCreditModal(false)}
              >
                <Text style={styles.creditModalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="alert-circle" size={32} color="#ef4444" />
              </View>
              <Text style={styles.modalTitle}>Reject Document</Text>
              <Text style={styles.modalSubtitle}>
                Please provide a reason for rejection
              </Text>
            </View>

            <TextInput
              style={styles.reasonInput}
              placeholder="Enter rejection reason..."
              placeholderTextColor="#9ca3af"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  !rejectReason.trim() && styles.modalConfirmButtonDisabled,
                ]}
                onPress={confirmReject}
                disabled={!rejectReason.trim()}
              >
                <Text style={styles.modalConfirmText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4ff",
  },
  headerSection: {
    backgroundColor: "#ffffff",
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#f0f4ff",
    borderWidth: 2,
    borderColor: "#e0e7ff",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1f2937",
    letterSpacing: -0.5,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 40,
    alignItems: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  cardContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardTopBorder: {
    height: 4,
    width: "100%",
  },
  cardHeader: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  doctypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  doctypeInfo: {
    flex: 1,
  },
  doctypeText: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  documentNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#3b82f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3b82f6",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#3b82f6",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  customerSection: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
    gap: 12,
  },
  customerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postingDate: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#6b7280",
  },
  branchText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  territoryText: {
    fontSize: 12,
    color: "#667eea",
    fontWeight: "600",
  },
  financialContainer: {
    padding: 16,
    gap: 12,
  },
  financialRow: {
    flexDirection: "row",
    gap: 12,
  },
  financialItem: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  financialIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  financialLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  financialValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
  },
  currency: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 2,
  },
  financialDivider: {
    width: 1,
    backgroundColor: "#e5e7eb",
  },
  vatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    padding: 12,
    borderRadius: 12,
  },
  vatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vatLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10b981",
  },
  vatAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10b981",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: "#e5e7eb",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  totalContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: "800",
    color: "#667eea",
  },
  totalCurrency: {
    fontSize: 14,
    fontWeight: "700",
    color: "#667eea",
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#fecaca",
    gap: 8,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ef4444",
  },
  approveButton: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  approveGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  approveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#ecfdf5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    maxWidth: 280,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  reasonInput: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: "top",
    backgroundColor: "#f9fafb",
    marginBottom: 24,
    fontFamily: "System",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6b7280",
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#ef4444",
    alignItems: "center",
  },
  modalConfirmButtonDisabled: {
    opacity: 0.5,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  creditSection: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: "#fef9c3",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  creditHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  creditHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f59e0b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  creditGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  creditItem: {
    flex: 1,
    minWidth: "45%",
  },
  creditLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  creditValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  creditWarning: {
    color: "#f59e0b",
  },
  creditSafe: {
    color: "#10b981",
  },
  creditDanger: {
    color: "#ef4444",
  },
  creditWarningBadge: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  creditWarningText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#d97706",
  },
  statusButton: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderRadius: 20,
  },
  statusButtonText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusButtonChevron: {
    opacity: 0.8,
  },
  creditModalContent: {
    gap: 16,
    marginBottom: 24,
  },
  creditModalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  creditModalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  creditModalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  creditModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 0,
    width: "90%",
    maxWidth: 420,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: "hidden",
  },
  creditModalScrollView: {
    maxHeight: 400,
    paddingBottom: 8,
  },
  creditModalHeader: {
    padding: 24,
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  creditModalIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  creditModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  creditModalSubtitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#667eea",
    textAlign: "center",
  },
  creditDetailsContainer: {
    padding: 16,
    gap: 12,
  },
  creditDetailCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  creditDetailCardDanger: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  creditDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  creditDetailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  creditDetailLabelDanger: {
    color: "#ef4444",
  },
  creditDetailValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2937",
  },
  creditModalActions: {
    padding: 16,
    paddingBottom: 20,
    gap: 12,
    backgroundColor: "#f9fafb",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  whatsappButton: {
    backgroundColor: "#25D366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  whatsappButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  emailButton: {
    backgroundColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  emailButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  creditModalCloseButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  creditModalCloseText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6b7280",
  },
  agingSection: {
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  agingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  agingSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  agingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  agingRowDanger: {
    backgroundColor: "#fef2f2",
    marginTop: 8,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  agingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  agingLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  agingLabelDanger: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ef4444",
  },
  agingValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  agingValueDanger: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ef4444",
  },
  agingSummarySection: {
    backgroundColor: "#eff6ff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: "#667eea",
    marginBottom: 12,
  },
  agingSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  agingSummaryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#667eea",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  agingSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  agingSummaryRowDanger: {
    backgroundColor: "#fef2f2",
    marginTop: 4,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  agingSummaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  agingSummaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  agingSummaryLabelDanger: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ef4444",
  },
  agingSummaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  agingSummaryValueDanger: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ef4444",
  },
  combinedCreditCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  combinedCreditCardDanger: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  combinedCreditItem: {
    flex: 1,
    alignItems: "center",
  },
  combinedCreditHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    justifyContent: "center",
  },
  combinedCreditLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  combinedCreditLabelDanger: {
    color: "#ef4444",
  },
  combinedCreditValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
    textAlign: "center",
  },
  combinedCreditWarning: {
    color: "#f59e0b",
  },
  combinedCreditDanger: {
    color: "#ef4444",
  },
  combinedCreditSafe: {
    color: "#10b981",
  },
  combinedCreditDivider: {
    width: 1,
    backgroundColor: "#e5e7eb",
    height: "100%",
    minHeight: 50,
  },
  combinedCreditDividerDanger: {
    backgroundColor: "#fecaca",
  },
});
