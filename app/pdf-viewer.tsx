import React, { useMemo } from "react";
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";

const GOOGLE_VIEWER = "https://docs.google.com/gview?embedded=1&url=";

export default function PdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    url?: string;
    title?: string;
  }>();

  const pdfUrl = useMemo(() => {
    if (!params?.url) {
      return null;
    }
    try {
      return decodeURIComponent(params.url);
    } catch (error) {
      return params.url;
    }
  }, [params?.url]);

  const viewerUrl = useMemo(() => {
    if (!pdfUrl) {
      return null;
    }
    // iOS renders PDFs inline, Android benefits from Google viewer
    if (Platform.OS === "ios") {
      return pdfUrl;
    }
    return `${GOOGLE_VIEWER}${encodeURIComponent(pdfUrl)}`;
  }, [pdfUrl]);

  return (
    <>
      <Stack.Screen
        options={{
          title: params?.title ? params.title.toString() : "PDF Viewer",
        }}
      />
      <View style={styles.container}>
        {viewerUrl ? (
          <WebView
            source={{ uri: viewerUrl }}
            style={styles.webview}
            startInLoadingState
            renderLoading={() => (
              <ActivityIndicator
                size="large"
                color="#667eea"
                style={styles.loading}
              />
            )}
            onError={(event) => {
              console.warn("PDF viewer error:", event.nativeEvent);
            }}
          />
        ) : (
          <ActivityIndicator
            size="large"
            color="#667eea"
            style={styles.loading}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  webview: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

