import React, { useMemo, useState, useRef, useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text, Dimensions, TouchableOpacity, Alert } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import * as Linking from "expo-linking";

/**
 * Extract YouTube Video ID from various URL formats
 * Supports:
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  let videoId: string | null = null;

  // Check for youtu.be format
  if (url.includes("youtu.be/")) {
    const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (match) videoId = match[1];
  }
  // Check for youtube.com/watch format
  else if (url.includes("youtube.com/watch")) {
    const match = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (match) videoId = match[1];
  }
  // Check if already in embed format
  else if (url.includes("youtube.com/embed/")) {
    const match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    if (match) videoId = match[1];
  }

  return videoId;
}

const { width } = Dimensions.get("window");
const PLAYER_HEIGHT = (width * 9) / 16; // 16:9 aspect ratio

/**
 * Generate YouTube embed URL with proper parameters
 */
function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent("https://www.youtube.com")}&rel=0&modestbranding=1&playsinline=1&controls=1&autoplay=1&mute=0`;
}

/**
 * Generate HTML for YouTube iframe player
 */
function generateYouTubeHTML(embedUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background-color: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    .video-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      padding-bottom: 56.25%; /* 16:9 aspect ratio */
    }
    iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <div class="video-wrapper">
    <iframe
      id="youtube-player"
      src="${embedUrl}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      playsinline
    ></iframe>
  </div>
  <script>
    var checkInterval;
    var iframe = document.getElementById('youtube-player');
    var errorDetected = false;
    
    // Check for YouTube error messages
    function checkForErrors() {
      try {
        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        var bodyText = iframeDoc.body ? iframeDoc.body.innerText : '';
        
        // Check for Error 153 or other embed errors
        if (bodyText.includes('Error 153') || 
            bodyText.includes('Video unavailable') ||
            bodyText.includes('embedding disabled') ||
            bodyText.includes('Playback on other websites has been disabled')) {
          if (!errorDetected) {
            errorDetected = true;
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'embed_error', 
              code: 153,
              message: 'This video cannot be played in embedded player'
            }));
          }
          clearInterval(checkInterval);
        }
      } catch (e) {
        // Cross-origin restrictions - can't access iframe content
        // This is normal for YouTube embeds
      }
    }
    
    // Listen for iframe load
    iframe.addEventListener('load', function() {
      console.log('YouTube iframe loaded');
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
      
      // Start checking for errors after a delay
      setTimeout(function() {
        checkInterval = setInterval(checkForErrors, 1000);
        
        // Stop checking after 10 seconds
        setTimeout(function() {
          clearInterval(checkInterval);
        }, 10000);
      }, 2000);
    });
    
    // Listen for errors
    window.addEventListener('error', function(e) {
      console.error('YouTube error:', e);
      if (e.message && (e.message.includes('153') || e.message.includes('embed'))) {
        errorDetected = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'embed_error', 
          code: 153,
          message: e.message 
        }));
      }
    });
    
    // Listen for YouTube API messages
    window.addEventListener('message', function(event) {
      if (event.data && typeof event.data === 'string') {
        try {
          var data = JSON.parse(event.data);
          if (data.event === 'video-progress' || data.event === 'onStateChange') {
            // Video is playing successfully
            clearInterval(checkInterval);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Check for YouTube error in message
      if (event.data && typeof event.data === 'string' && 
          (event.data.includes('Error 153') || event.data.includes('embed'))) {
        errorDetected = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'embed_error', 
          code: 153,
          message: 'Embedding not allowed'
        }));
        clearInterval(checkInterval);
      }
    });
  </script>
</body>
</html>
  `;
}

export default function YouTubeVideo() {
  const params = useLocalSearchParams();
  const title = (params.title as string) || "Video";
  const youtubeUrl = (params.url as string) || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedError, setEmbedError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Extract video ID from URL
  const videoId = useMemo(() => {
    if (!youtubeUrl) return null;
    return extractYouTubeVideoId(youtubeUrl);
  }, [youtubeUrl]);

  // Generate embed URL
  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    return getYouTubeEmbedUrl(videoId);
  }, [videoId]);

  const checkForEmbedError = useRef(false);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'loaded') {
        setLoading(false);
        setError(null);
        // Reset error check flag when video loads
        checkForEmbedError.current = false;
      } else if (data.type === 'embed_error' || data.code === 153) {
        console.log("❌ YouTube Error 153 detected - Embedding not allowed");
        checkForEmbedError.current = true;
        setEmbedError(true);
        setError("This video cannot be played in the embedded player.");
        setLoading(false);
        // Auto-open in YouTube after detecting embed error
        setTimeout(() => {
          handleOpenInYouTube();
        }, 1500);
      } else if (data.type === 'error') {
        setError(data.message || "Failed to load video");
        setLoading(false);
      }
    } catch (e) {
      // Ignore parse errors
    }
  };

  // Auto-check for embed errors after 6 seconds if still loading
  useEffect(() => {
    if (loading && embedUrl && !checkForEmbedError.current) {
      const timeout = setTimeout(() => {
        // If still loading after 6 seconds, likely Error 153 or network issue
        setLoading((currentLoading) => {
          if (currentLoading && !checkForEmbedError.current) {
            checkForEmbedError.current = true;
            setEmbedError(true);
            setError("Video cannot be embedded. Opening in YouTube app...");
            setTimeout(() => {
              handleOpenInYouTube();
            }, 1000);
          }
          return false;
        });
      }, 6000);
      return () => clearTimeout(timeout);
    }
  }, [loading, embedUrl, videoId]);

  const handleOpenInYouTube = async () => {
    try {
      if (!videoId) {
        Alert.alert("Error", "No video ID available");
        return;
      }

      // Try YouTube app first
      const youtubeAppUrl = `vnd.youtube:${videoId}`;
      
      try {
        const canOpen = await Linking.canOpenURL(youtubeAppUrl);
        if (canOpen) {
          await Linking.openURL(youtubeAppUrl);
          return;
        }
      } catch (e) {
        console.log("Could not open YouTube app URL");
      }

      // Try alternative format
      const altUrl = `youtube://watch?v=${videoId}`;
      try {
        const canOpen = await Linking.canOpenURL(altUrl);
        if (canOpen) {
          await Linking.openURL(altUrl);
          return;
        }
      } catch (e) {
        console.log("Could not open alternative YouTube URL");
      }

      // Fallback to web browser
      await Linking.openURL(youtubeUrl || `https://www.youtube.com/watch?v=${videoId}`);
    } catch (error) {
      console.error("Error opening YouTube:", error);
      Alert.alert("Error", "Could not open YouTube. Please try manually.");
    }
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error("WebView error:", nativeEvent);
    setError("Failed to load video. Please try again.");
    setLoading(false);
  };

  const handleWebViewLoadEnd = () => {
    setLoading(false);
  };

  if (!youtubeUrl) {
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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No video URL provided</Text>
        </View>
      </View>
    );
  }

  if (!videoId) {
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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invalid YouTube URL format</Text>
          <Text style={styles.errorSubtext}>{youtubeUrl}</Text>
        </View>
      </View>
    );
  }

  if (error || embedError) {
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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ Video Cannot Be Embedded</Text>
          <Text style={styles.errorSubtext}>
            {embedError 
              ? "This video cannot be played in the embedded player (Error 153). This usually means the video owner has disabled embedding."
              : error}
          </Text>
          <Text style={styles.errorSubtext}>
            The video will open in the YouTube app or your browser.
          </Text>
          <TouchableOpacity
            style={styles.openButton}
            onPress={handleOpenInYouTube}
          >
            <Text style={styles.openButtonText}>Open in YouTube</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setEmbedError(false);
              setLoading(true);
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
      
      <View style={styles.playerContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading video...</Text>
          </View>
        )}
        
        {embedUrl && !embedError && (
          <WebView
            ref={webViewRef}
            source={{ html: generateYouTubeHTML(embedUrl) }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onMessage={handleWebViewMessage}
            onError={handleWebViewError}
            onLoadEnd={handleWebViewLoadEnd}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error("WebView HTTP error:", nativeEvent);
              if (nativeEvent.statusCode === 403 || nativeEvent.url.includes('embed')) {
                setEmbedError(true);
                setError("Video embedding not allowed (Error 153)");
                setLoading(false);
              }
            }}
            startInLoadingState={true}
            scalesPageToFit={true}
            allowsFullscreenVideo={true}
            allowsProtectedMedia={true}
            androidHardwareAccelerationDisabled={false}
            androidLayerType="hardware"
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={styles.loadingText}>Loading video...</Text>
              </View>
            )}
          />
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.videoTitle}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  playerContainer: {
    position: "relative",
    backgroundColor: "#000",
    width: "100%",
    height: PLAYER_HEIGHT,
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    zIndex: 10,
  },
  loadingText: {
    color: "#ffffff",
    marginTop: 16,
    fontSize: 14,
    fontWeight: "500",
  },
  infoContainer: {
    padding: 16,
    backgroundColor: "#111827",
  },
  videoTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#111827",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  errorSubtext: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  openButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  openButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#667eea",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});

