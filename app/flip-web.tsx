import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";

export default function FlipWeb() {
  const params = useLocalSearchParams();
  const title = (params.title as string) || "Catalogue";
  const url = (params.url as string) || "";

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title,
          headerStyle: { backgroundColor: "#667eea" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "bold" },
        }}
      />
      {url ? (
        <WebView
          source={{ uri: url }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#667eea" />
            </View>
          )}
          originWhitelist={["*"]}
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
        />
      ) : (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});


