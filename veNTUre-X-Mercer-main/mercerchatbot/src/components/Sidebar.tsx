import React from "react";
import { ChatSession } from "../types/chat";

type SidebarProps = {
  chatSessions: ChatSession[];
  selectedChatId: string | null;
  setSelectedChatId: (id: string) => void;
};

export default function Sidebar({
  chatSessions,
  selectedChatId,
  setSelectedChatId,
}: SidebarProps) {
  return (
    <aside className="w-80 bg-white border-r h-full flex flex-col">
      {/* App Logo and Name */}
      <div className="flex items-center p-6 mb-4 border-b">
        <span className="text-2xl font-bold text-blue-700 tracking-tight">
          MercerChat
        </span>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-4">
        <h3 className="text-sm text-gray-500 uppercase mt-4 mb-2">
          Chat History
        </h3>
        <ul className="space-y-3">
          {chatSessions.map((chat) => (
            <li
              key={chat.id}
              onClick={() => setSelectedChatId(chat.id)}
              className={`p-2 rounded cursor-pointer text-gray-800 transition ${
                chat.id === selectedChatId
                  ? "bg-blue-100 border border-blue-300"
                  : "hover:bg-gray-100"
              }`}
            >
              <div className="font-semibold">
                {chat.policies[0]?.fileName || `Chat ${chat.id}`}
              </div>
              <div className="text-xs text-gray-600">
                Started: {new Date(chat.createdAt).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="mt-auto p-4 border-t text-xs text-gray-400 text-center">
        Insurance Doc Q&amp;A &copy; 2025
      </div>
    </aside>
  );
}
