import { useCallback } from "react";

// Simple notification sound using Web Audio API
const createNotificationSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  return () => {
    // Create a short, pleasant notification beep
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure sound
    oscillator.frequency.value = 800; // Hz - pleasant notification frequency
    oscillator.type = "sine";
    
    // Volume envelope (fade in/out)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    // Play
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };
};

let playSound: (() => void) | null = null;

export function useNotificationSound() {
  const play = useCallback(() => {
    try {
      if (!playSound) {
        playSound = createNotificationSound();
      }
      playSound();
      console.log("[useNotificationSound] Playing notification sound");
    } catch (error) {
      console.error("[useNotificationSound] Error playing sound:", error);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      try {
        const permission = await Notification.requestPermission();
        console.log("[useNotificationSound] Notification permission:", permission);
        return permission === "granted";
      } catch (error) {
        console.error("[useNotificationSound] Error requesting permission:", error);
        return false;
      }
    }
    return Notification.permission === "granted";
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "conversation-assignment",
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        console.log("[useNotificationSound] Browser notification sent");
      } catch (error) {
        console.error("[useNotificationSound] Error showing notification:", error);
      }
    }
  }, []);

  return {
    play,
    requestPermission,
    showBrowserNotification,
    isSupported: "Notification" in window,
  };
}
