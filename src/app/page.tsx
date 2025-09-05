
"use client";

import Header from "@/components/Header";
import InputBar from "@/components/InputBar";
import MessageArea from "@/components/MessageArea";
import React, { useState } from "react";

interface SearchInfo {
  stages: string[];
  query: string;
  urls: string[];
  error?: string;
}

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  type: string;
  isLoading?: boolean;
  searchInfo?: SearchInfo | null;
}

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      content: "Hi there, how can I help you?",
      isUser: false,
      type: "message",
    },
  ]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [checkpointId, setCheckpointId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    // Create IDs
    const newMessageId =
      messages.length > 0
        ? Math.max(...messages.map((msg) => msg.id)) + 1
        : 1;
    const aiResponseId = newMessageId + 1;

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: newMessageId,
        content: currentMessage,
        isUser: true,
        type: "message",
      },
    ]);

    const userInput = currentMessage;
    setCurrentMessage(""); // clear input

    // Add placeholder AI message
    setMessages((prev) => [
      ...prev,
      {
        id: aiResponseId,
        content: "",
        isUser: false,
        type: "message",
        isLoading: true,
        searchInfo: {
          stages: [],
          query: "",
          urls: [],
        },
      },
    ]);

    try {
      // Build backend URL
      let url = `https://perplexity2-0-latest.onrender.com/chat_stream/${encodeURIComponent(
        userInput
      )}`;
      if (checkpointId) {
        url += `?checkpoint_id=${encodeURIComponent(checkpointId)}`;
      }

      const eventSource = new EventSource(url);
      let streamedContent = "";
      let searchData: SearchInfo | null = null;

      // Handle stream events
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "checkpoint") {
            setCheckpointId(data.checkpoint_id);
          } else if (data.type === "content") {
            streamedContent += data.content;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiResponseId
                  ? { ...msg, content: streamedContent, isLoading: false }
                  : msg
              )
            );
          } else if (data.type === "search_start") {
            searchData = {
              stages: ["searching"],
              query: data.query,
              urls: [],
            };
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiResponseId
                  ? { ...msg, searchInfo: searchData }
                  : msg
              )
            );
          } else if (data.type === "search_results") {
            const urls =
              typeof data.urls === "string" ? JSON.parse(data.urls) : data.urls;
            searchData = {
              stages: searchData ? [...searchData.stages, "reading"] : ["reading"],
              query: searchData?.query || "",
              urls,
            };
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiResponseId
                  ? { ...msg, searchInfo: searchData }
                  : msg
              )
            );
          } else if (data.type === "search_error") {
            searchData = {
              stages: searchData ? [...searchData.stages, "error"] : ["error"],
              query: searchData?.query || "",
              error: data.error,
              urls: [],
            };
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiResponseId
                  ? { ...msg, searchInfo: searchData, isLoading: false }
                  : msg
              )
            );
          } else if (data.type === "end") {
            if (searchData) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiResponseId
                    ? {
                        ...msg,
                        searchInfo: {
                          ...searchData!,
                          stages: [...searchData!.stages, "writing"],
                        },
                        isLoading: false,
                      }
                    : msg
                )
              );
            } else {
              // Ensure final AI message is not stuck loading
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiResponseId
                    ? { ...msg, isLoading: false }
                    : msg
                )
              );
            }
            eventSource.close();
          }
        } catch (err) {
          console.error("SSE parse error:", err, event.data);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error:", err);
        eventSource.close();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiResponseId
              ? {
                  ...msg,
                  content: streamedContent || "⚠️ Error: request failed.",
                  isLoading: false,
                }
              : msg
          )
        );
      };
    } catch (error) {
      console.error("Error setting up EventSource:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: aiResponseId,
          content: "Sorry, there was an error connecting to the server.",
          isUser: false,
          type: "message",
          isLoading: false,
        },
      ]);
    }
  };

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen py-8 px-4">
      <div className="w-[70%] bg-white flex flex-col rounded-xl shadow-lg border border-gray-100 overflow-hidden h-[90vh]">
        <Header />
        <MessageArea messages={messages} />
        <InputBar
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};

export default Home;
