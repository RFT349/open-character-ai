"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const BURN_DELAY = 60000; // 60 seconds

export default function ChatPage({ params }) {
  const resolvedParams = use(params);
  const chatId = resolvedParams.id;
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [creditModal, setCreditModal] = useState(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const burnTimersRef = useRef({}); // track burn timers by message id

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchMessages();
    } else if (authStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [authStatus, chatId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  // Cleanup burn timers on unmount
  useEffect(() => {
    return () => {
      Object.values(burnTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/chats/" + chatId + "/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  // Burn messages: remove from frontend AND delete from database
  const burnMessages = async (messageIds) => {
    if (!messageIds || messageIds.length === 0) return;

    // Remove from frontend state immediately
    setMessages((prev) => prev.filter((m) => !messageIds.includes(m.id)));

    // Delete from database
    try {
      await fetch("/api/chats/" + chatId + "/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: messageIds }),
      });
    } catch (err) {
      console.error("[BURN_DELETE_ERROR]", err);
    }
  };

  // Schedule burn for assistant messages
  const scheduleBurn = (messageIds) => {
    messageIds.forEach((id) => {
      if (burnTimersRef.current[id]) return; // already scheduled
      burnTimersRef.current[id] = setTimeout(() => {
        burnMessages([id]);
        delete burnTimersRef.current[id];
      }, BURN_DELAY);
    });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isTyping) return;

    setInputMessage("");
    setIsTyping(true);

    const tempUserMsg = { id: "temp-" + Date.now(), role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/chats/" + chatId + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setCreditModal(data.error || "好感度不足");
        } else {
          alert(data.error || "发送失败");
        }
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        setInputMessage(text);
        setIsTyping(false);
        return;
      }

      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      if (data.userMessage) {
        setMessages((prev) => [...prev, data.userMessage]);
      }

      const assistantMsgs = data.assistantMessages || [];
      if (assistantMsgs.length === 0) {
        setIsTyping(false);
        return;
      }

      setPendingCount(assistantMsgs.length);

      // Collect all assistant message IDs for burn scheduling
      const burnQueue = [];

      for (let i = 0; i < assistantMsgs.length; i++) {
        const delay = 600 + Math.floor(Math.random() * 800);
        await new Promise((resolve) => setTimeout(resolve, delay));
        setMessages((prev) => [...prev, assistantMsgs[i]]);
        burnQueue.push(assistantMsgs[i].id);
        setPendingCount((prev) => prev - 1);
      }

      // Schedule burn for all assistant messages
      scheduleBurn(burnQueue);

      setIsTyping(false);
    } catch (err) {
      console.error("Send error", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setInputMessage(text);
      setIsTyping(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
  };

  const parseCreditError = (msg) => {
    const needMatch = msg.match(/需要(\d+)/);
    const remainMatch = msg.match(/仅剩(\d+)/);
    return {
      need: needMatch ? needMatch[1] : "?",
      remain: remainMatch ? remainMatch[1] : "0",
    };
  };

  if (authStatus === "loading") {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#ededed", color: "#999" }}>
        加载中...
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#ededed",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        maxWidth: "100vw",
        maxHeight: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 50,
          background: "#ededed",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          borderBottom: "0.5px solid #d9d9d9",
          flexShrink: 0,
        }}
      >
        <div
          onClick={() => router.push("/")}
          style={{ cursor: "pointer", padding: "4px 8px 4px 0", display: "flex", alignItems: "center" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 500, color: "#000", textAlign: "center" }}>
          羊顺利
        </div>
        <div style={{ width: 28 }} />
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "8px 12px",
        }}
      >
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id || idx} style={{ marginBottom: 12, display: "flex", flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-start" }}>
              {!isUser && (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    background: "#ddd",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  <img src="/avatar-yang.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              <div style={{ maxWidth: "70%", margin: isUser ? "0 8px 0 0" : "0 0 0 8px" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: isUser ? "6px 0 6px 6px" : "0 6px 6px 6px",
                    background: isUser ? "#95EC69" : "#fff",
                    color: "#000",
                    fontSize: 15,
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#b0b0b0",
                    marginTop: 3,
                    textAlign: isUser ? "right" : "left",
                  }}
                >
                  {formatTime(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && pendingCount > 0 && (
          <div style={{ marginBottom: 12, display: "flex", alignItems: "flex-start" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                background: "#ddd",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <img src="/avatar-yang.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div
              style={{
                marginLeft: 8,
                padding: "10px 16px",
                borderRadius: "0 6px 6px 6px",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#999", animation: "dotBlink 1.4s infinite both", animationDelay: "0s" }} />
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#999", animation: "dotBlink 1.4s infinite both", animationDelay: "0.2s" }} />
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#999", animation: "dotBlink 1.4s infinite both", animationDelay: "0.4s" }} />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          background: "#f7f7f7",
          borderTop: "0.5px solid #d9d9d9",
          padding: "8px 12px",
          display: "flex",
          alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          placeholder="输入消息..."
          disabled={isTyping}
          style={{
            flex: 1,
            height: 40,
            background: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "0 12px",
            fontSize: 15,
            color: "#000",
            outline: "none",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!inputMessage.trim() || isTyping}
          style={{
            marginLeft: 8,
            width: 40,
            height: 40,
            background: inputMessage.trim() && !isTyping ? "#07C160" : "#ccc",
            border: "none",
            borderRadius: 6,
            cursor: inputMessage.trim() && !isTyping ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Credit insufficient modal */}
      {creditModal && (() => {
        const { need, remain } = parseCreditError(creditModal);
        return (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setCreditModal(null); }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                width: 270,
                background: "#fff",
                borderRadius: 12,
                border: "2px solid #000",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "24px 20px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#000", marginBottom: 16 }}>
                  羊顺利提醒您
                </div>
                <div style={{ fontSize: 15, color: "#000", lineHeight: 1.7 }}>
                  好感度不足，需要<span style={{ color: "#1890ff", fontWeight: 600 }}>{need}</span>好感度，{"\n"}当前仅剩<span style={{ color: "#1890ff", fontWeight: 600 }}>{remain}</span>好感度。
                </div>
              </div>
              <div style={{ display: "flex", borderTop: "1px solid #000" }}>
                <div
                  onClick={() => setCreditModal(null)}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    textAlign: "center",
                    fontSize: 16,
                    color: "#000",
                    cursor: "pointer",
                    borderRight: "1px solid #000",
                  }}
                >
                  确定
                </div>
                <div
                  onClick={() => { setCreditModal(null); window.open("https://www.fakala.cc/details/469F72E6", "_blank"); }}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    textAlign: "center",
                    fontSize: 16,
                    color: "#000",
                    cursor: "pointer",
                  }}
                >
                  获取好感度
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Animation keyframes */}
      <style>{`
        @keyframes dotBlink {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
