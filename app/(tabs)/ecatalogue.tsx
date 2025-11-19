import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ExpandableDashboardCard } from "../../src/components/ExpandableDashboardCard";
import { useRouter } from "expo-router";
import { optimizedApis } from "../../src/api/optimized-apis";
import { http } from "../../src/api/http";

type CatalogueCategory = {
  key: string;
  title: string;
  caption: string;
  icon: string;
  color: string;
  iconBgColor: string;
  metrics: {
    label: string;
    value: number;
    format: "currency" | "number";
  }[];
  links?: {
    key: string;
    title: string;
    description?: string;
    url: string;
  }[];
};

const CATALOGUE_CATEGORIES: CatalogueCategory[] = [
  {
    key: "industrial",
    title: "Industrial",
    caption:
      "High-performance solutions for factories, logistics, and utilities.",
    icon: "construct-outline",
    color: "#667eea",
    iconBgColor: "#eef2ff",
    metrics: [
      { label: "Collections", value: 42, format: "number" },
      { label: "Featured Brands", value: 18, format: "number" },
      { label: "New Launches", value: 6, format: "number" },
    ],
    links: [
      {
        key: "datalogic-skorpio-x5",
        title: "Datalogic Skorpio™ X5",
        description: "Interactive flipbook catalogue",
        url: "https://printechs.com/printechs/ecatelog_datalogic",
      },
    ],
  },
  {
    key: "retail",
    title: "Retail",
    caption:
      "Merchandising, packaging, and promotion catalogues for retail chains.",
    icon: "pricetags-outline",
    color: "#f59e0b",
    iconBgColor: "#fef3c7",
    metrics: [
      { label: "Collections", value: 28, format: "number" },
      { label: "Seasonal Picks", value: 12, format: "number" },
      { label: "Top Sellers", value: 20, format: "number" },
    ],
  },
  {
    key: "software",
    title: "Software",
    caption: "Digital catalogues, mobile workflows, and ERP integrations.",
    icon: "code-slash-outline",
    color: "#38bdf8",
    iconBgColor: "#e0f2fe",
    metrics: [
      { label: "Solutions", value: 14, format: "number" },
      { label: "Integrations", value: 9, format: "number" },
      { label: "Case Studies", value: 11, format: "number" },
    ],
  },
];

type CatalogueVideo = {
  title: string;
  video_type: string; // YouTube, Local, etc.
  youtube_url?: string | null;
  local_video_url?: string | null;
  enabled: boolean;
};

type CatalogueItem = {
  id: string;
  title: string;
  item_group: string; // Backend uses item_group instead of category
  category?: string; // Fallback
  brand?: string;
  thumbnail_url?: string | null;
  description: string;
  video_count?: number;
  youtube_video_url?: string | null; // Single YouTube video URL from main form (deprecated, use videos array)
  videos?: CatalogueVideo[]; // Array of videos from child table
};

export default function ECatalogueScreen() {
  const router = useRouter();
  const [catalogues, setCatalogues] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCatalogues();
  }, []);

  const fetchCatalogues = async () => {
    try {
      setLoading(true);
      console.log("📚 Starting to fetch catalogues...");

      const data = await optimizedApis.getCataloguesList();
      console.log("📚 Catalogues API Response:", JSON.stringify(data, null, 2));

      // The API now returns { catalogues: [], total: N } structure
      const cataloguesList = Array.isArray(data?.catalogues)
        ? data.catalogues
        : Array.isArray(data)
        ? data
        : [];

      console.log("📚 Parsed catalogues list:", cataloguesList.length, "items");

      if (cataloguesList.length > 0) {
        console.log(
          "📚 First catalogue sample:",
          JSON.stringify(cataloguesList[0], null, 2)
        );
        console.log(
          "📚 First catalogue has youtube_video_url:",
          !!cataloguesList[0].youtube_video_url
        );
        console.log(
          "📚 First catalogue youtube_video_url value:",
          cataloguesList[0].youtube_video_url
        );
      } else {
        console.warn(
          "⚠️ No catalogues in the list. API might be returning empty array."
        );
        console.warn("⚠️ Check backend API: get_catalogues_list");
        console.warn(
          "⚠️ Ensure catalogues have 'enabled' = 1 in E Catalogue doctype"
        );
      }

      setCatalogues(cataloguesList);
    } catch (error: any) {
      console.error("❌ Failed to fetch catalogues:", error);
      console.error("❌ Error details:", {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
      });

      // Show alert to user if it's a clear error
      if (error.message && !error.message.includes("token")) {
        // Only show non-auth errors (auth errors are handled elsewhere)
        setTimeout(() => {
          alert(
            `Failed to load catalogues: ${error.message || "Unknown error"}`
          );
        }, 100);
      }

      // Set empty array on error
      setCatalogues([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCatalogues();
  };

  const handleOpenCatalogue = async (catalogue: CatalogueItem) => {
    try {
      // Fetch flip URL for the selected catalogue
      const resp = await http.get<any>(
        "/api/method/printechs_utility.catalogue.get_catalogue_flip_url",
        { catalogue_id: catalogue.id }
      );
      const payload = resp?.message || resp;
      const flipUrl = payload?.flip_url || payload?.message?.flip_url;
      if (!flipUrl) {
        alert("Flip URL not available for this catalogue.");
        return;
      }
      // Navigate to WebView screen
      router.push({
        pathname: "/flip-web",
        params: { title: catalogue.title, url: flipUrl },
      });
    } catch (e: any) {
      console.error("Failed to open flip URL:", e);
      alert("Failed to open catalogue. Please try again.");
    }
  };

  const handlePlayVideo = (videoUrl: string, videoTitle?: string) => {
    if (!videoUrl || videoUrl.trim() === "") {
      alert("Video URL not available.");
      return;
    }
    router.push({
      pathname: "/youtube-video",
      params: {
        title: videoTitle || "Video",
        url: videoUrl,
      },
    });
  };

  // Group catalogues by item_group (or category fallback)
  const cataloguesByCategory = catalogues.reduce((acc, cat) => {
    // Normalize category name - handle various formats
    let category = (cat.item_group || cat.category || "General").trim();
    // Handle case-insensitive matching for common category names
    const categoryLower = category.toLowerCase();
    if (categoryLower === "industrial" || categoryLower === "industry") {
      category = "Industrial";
    } else if (categoryLower === "retail") {
      category = "Retail";
    } else if (categoryLower === "software") {
      category = "Software";
    } else if (!category || category === "") {
      category = "General";
    }

    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(cat);
    return acc;
  }, {} as Record<string, CatalogueItem[]>);

  console.log(
    "📚 Catalogues grouped by category:",
    Object.keys(cataloguesByCategory)
  );
  console.log(
    "📚 Catalogues count per category:",
    Object.entries(cataloguesByCategory).map(([k, v]) => `${k}: ${v.length}`)
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#f9fafb", "#ffffff", "#f3f4f6"]}
        style={styles.backgroundGradient}
      />

      {loading && catalogues.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading catalogues...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>📚 E-Catalogue</Text>
            <Text style={styles.subtitle}>
              Browse curated collections by business segment. Select a catalogue
              to explore featured products, marketing assets, and upcoming
              releases.
            </Text>
            {!loading && (
              <Text style={styles.debugText}>
                {catalogues.length > 0
                  ? `${catalogues.length} catalogue${
                      catalogues.length !== 1 ? "s" : ""
                    } loaded`
                  : "No catalogues found. Check console logs for API response."}
              </Text>
            )}
          </View>

          {/* Show catalogues from API, grouped by category */}
          {Object.entries(cataloguesByCategory).length > 0
            ? Object.entries(cataloguesByCategory).map(
                ([categoryName, items]) => {
                  const categoryConfig =
                    CATALOGUE_CATEGORIES.find(
                      (c) => c.key.toLowerCase() === categoryName.toLowerCase()
                    ) || CATALOGUE_CATEGORIES[0]; // Fallback to first category style

                  return (
                    <View key={categoryName} style={styles.cardWrapper}>
                      <ExpandableDashboardCard
                        icon={categoryConfig.icon as any}
                        title={categoryName}
                        color={categoryConfig.color}
                        iconBgColor={categoryConfig.iconBgColor}
                        metrics={[
                          {
                            label: "Catalogues",
                            value: items.length,
                            format: "number",
                          },
                        ]}
                        expandedContent={
                          <View style={styles.expandedContent}>
                            <Text style={styles.caption}>
                              {categoryConfig.caption ||
                                `${items.length} catalogues available`}
                            </Text>
                            {items.length > 0 && (
                              <View style={styles.linksContainer}>
                                {items.map((item) => {
                                  // Get videos from child table (preferred) or fallback to main youtube_video_url
                                  const videos =
                                    item.videos &&
                                    Array.isArray(item.videos) &&
                                    item.videos.length > 0
                                      ? item.videos.filter(
                                          (v: CatalogueVideo) =>
                                            v.enabled &&
                                            ((v.video_type === "YouTube" &&
                                              v.youtube_url) ||
                                              (v.video_type === "Local" &&
                                                v.local_video_url))
                                        )
                                      : [];

                                  // Fallback: Check main youtube_video_url field (for backward compatibility)
                                  const hasMainVideoUrl =
                                    item.youtube_video_url &&
                                    typeof item.youtube_video_url ===
                                      "string" &&
                                    item.youtube_video_url.trim() !== "";

                                  console.log(
                                    `📹 Catalogue "${item.title}":`,
                                    `${videos.length} videos from child table`,
                                    hasMainVideoUrl ? "+ 1 main video URL" : ""
                                  );

                                  return (
                                    <View
                                      key={item.id}
                                      style={styles.catalogueItemWrapper}
                                    >
                                      <TouchableOpacity
                                        style={styles.linkButton}
                                        onPress={() =>
                                          handleOpenCatalogue(item)
                                        }
                                      >
                                        <View style={styles.linkTextWrapper}>
                                          <Text style={styles.linkTitle}>
                                            {item.title}
                                          </Text>
                                          {item.description ? (
                                            <Text style={styles.linkSubtitle}>
                                              {item.description}
                                            </Text>
                                          ) : null}
                                          {(videos.length > 0 ||
                                            hasMainVideoUrl) && (
                                            <Text style={styles.videoCountText}>
                                              {videos.length +
                                                (hasMainVideoUrl ? 1 : 0)}{" "}
                                              video
                                              {videos.length +
                                                (hasMainVideoUrl ? 1 : 0) !==
                                              1
                                                ? "s"
                                                : ""}{" "}
                                              available
                                            </Text>
                                          )}
                                        </View>
                                        <View style={styles.linkCta}>
                                          <Text style={styles.linkCtaText}>
                                            View
                                          </Text>
                                        </View>
                                      </TouchableOpacity>

                                      {/* Display videos from child table */}
                                      {videos.map(
                                        (
                                          video: CatalogueVideo,
                                          videoIndex: number
                                        ) => {
                                          const videoUrl =
                                            video.video_type === "YouTube"
                                              ? video.youtube_url
                                              : video.local_video_url;

                                          if (!videoUrl) return null;

                                          return (
                                            <TouchableOpacity
                                              key={`video-${videoIndex}`}
                                              style={styles.videoButton}
                                              onPress={() =>
                                                handlePlayVideo(
                                                  videoUrl,
                                                  video.title
                                                )
                                              }
                                            >
                                              <View
                                                style={
                                                  styles.videoButtonContent
                                                }
                                              >
                                                <Text
                                                  style={styles.videoButtonIcon}
                                                >
                                                  ▶️
                                                </Text>
                                                <Text
                                                  style={styles.videoButtonText}
                                                >
                                                  {video.title ||
                                                    `Play Video ${
                                                      videoIndex + 1
                                                    }`}
                                                </Text>
                                              </View>
                                            </TouchableOpacity>
                                          );
                                        }
                                      )}

                                      {/* Fallback: Display main youtube_video_url if no videos from child table */}
                                      {videos.length === 0 &&
                                        hasMainVideoUrl && (
                                          <TouchableOpacity
                                            style={styles.videoButton}
                                            onPress={() =>
                                              handlePlayVideo(
                                                item.youtube_video_url!,
                                                item.title
                                              )
                                            }
                                          >
                                            <View
                                              style={styles.videoButtonContent}
                                            >
                                              <Text
                                                style={styles.videoButtonIcon}
                                              >
                                                ▶️
                                              </Text>
                                              <Text
                                                style={styles.videoButtonText}
                                              >
                                                Play Video
                                              </Text>
                                            </View>
                                          </TouchableOpacity>
                                        )}
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        }
                      />
                    </View>
                  );
                }
              )
            : // Show static categories as fallback if no API data
              CATALOGUE_CATEGORIES.map((category) => (
                <View key={category.key} style={styles.cardWrapper}>
                  <ExpandableDashboardCard
                    icon={category.icon as any}
                    title={category.title}
                    color={category.color}
                    iconBgColor={category.iconBgColor}
                    metrics={category.metrics}
                    expandedContent={
                      <View style={styles.expandedContent}>
                        <Text style={styles.caption}>{category.caption}</Text>
                        <Text style={styles.emptyText}>
                          No catalogues available yet.
                        </Text>
                      </View>
                    }
                  />
                </View>
              ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  backgroundGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1f2937",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  cardWrapper: {
    marginBottom: 16,
  },
  expandedContent: {
    gap: 12,
  },
  caption: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
  viewButton: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: "#667eea",
    borderRadius: 12,
    alignItems: "center",
  },
  viewButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  linksContainer: {
    gap: 8,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  linkTextWrapper: {
    flex: 1,
    marginRight: 12,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  linkSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  videoCountText: {
    fontSize: 11,
    color: "#10b981",
    marginTop: 4,
    fontWeight: "600",
  },
  linkCta: {
    backgroundColor: "#eef2ff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  linkCtaText: {
    color: "#4c51bf",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: "#6b7280",
    fontSize: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    fontStyle: "italic",
    marginTop: 8,
  },
  debugText: {
    fontSize: 12,
    color: "#10b981",
    marginTop: 8,
    fontWeight: "600",
  },
  catalogueItemWrapper: {
    gap: 8,
  },
  videoButton: {
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  videoButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  videoButtonIcon: {
    fontSize: 16,
  },
  videoButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
