"use client";

import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import WelcomeBanner from "../components/WelcomeBanner";
import { ChatSession } from "../types/chat";

export default function Home() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Handler: called when user uploads a file from WelcomeBanner (if you ever restore this flow)
  const handleFileUpload = (file: File) => {
    const fileName = file.name;
    const now = new Date().toISOString();

    const newSession: ChatSession = {
      id: (Math.random() * 1e9).toFixed(0),
      policies: [{ fileName, uploadedAt: now }],
      createdAt: now,
    };
    setChatSessions((prev) => [newSession, ...prev]);
    setSelectedChatId(newSession.id);
  };

  // Handler: called when user clicks "Get Started" (empty chat)
  const handleStartNewChat = () => {
    const now = new Date().toISOString();
    const newSession: ChatSession = {
      id: (Math.random() * 1e9).toFixed(0),
      policies: [],
      createdAt: now,
    };
    setChatSessions((prev) => [newSession, ...prev]);
    setSelectedChatId(newSession.id);
  };

  const selectedChat =
    chatSessions.find((c) => c.id === selectedChatId) || null;

  // Show WelcomeBanner when no chat is selected (landing page style)
  if (!selectedChatId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <WelcomeBanner
          onFileUpload={handleFileUpload}
          onStartNewChat={handleStartNewChat}
        />
      </div>
    );
  }

  // Main chat UI after a chat is started/selected
  return (
    <div className="flex h-screen">
      <Sidebar
        chatSessions={chatSessions}
        selectedChatId={selectedChatId}
        setSelectedChatId={setSelectedChatId}
      />
      <ChatWindow />
    </div>
  );
}
