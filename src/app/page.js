"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

export default function HomePage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");
  const [credits, setCredits] = useState(0);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState("");

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchChats();
      fetchCredits();
    } else if (authStatus === "unauthenticated") {
      setLoading(false);
    }
  }, [authStatus]);

  const fetchChats = async () => {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
      }
    } catch (err) {
      console.error("Failed to fetch chats", err);
    }
    setLoading(false);
  };

  const fetchCredits = async () => {
    try {
      const res = await fetch("/api/user");
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits || 0);
      }
    } catch (err) {
      console.error("Failed to fetch credits", err);
    }
  };

  const handleStartChat = async () => {
    try {
      const charRes = await fetch("/api/characters");
      if (!charRes.ok) return;
      const charData = await charRes.json();
      const chars = charData.characters || [];
      if (chars.length === 0) return;

      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_id: chars[0].id }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.chat) {
          const encodedName = encodeURIComponent(data.chat.character.name);
          router.push("/" + encodedName + "/" + data.chat.id);
        }
      }
    } catch (err) {
      console.error("Failed to start chat", err);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRedeemMsg("兑换成功！+" + data.creditsAdded + "积分");
        setRedeemCode("");
        fetchCredits();
      } else {
        setRedeemMsg(data.error || "兑换失败");
      }
    } catch (err) {
      setRedeemMsg("兑换失败");
    }
    setTimeout(function() { setRedeemMsg(""); }, 3000);
  };

  if (authStatus === "unauthenticated") {
    return <LoginScreen />;
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
          padding: "0 16px",
          borderBottom: "0.5px solid #d9d9d9",
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, fontSize: 17, fontWeight: 500, color: "#000" }}>
          {activeTab === "chat" ? "羊顺利的专属空间" : "我的"}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        {activeTab === "chat" ? (
          <ChatList chats={chats} loading={loading} onStartChat={handleStartChat} router={router} />
        ) : (
          <MyTab
            username={session?.user?.name || ""}
            credits={credits}
            redeemCode={redeemCode}
            setRedeemCode={setRedeemCode}
            redeemMsg={redeemMsg}
            onRedeem={handleRedeem}
            onLogout={() => signOut()}
          />
        )}
      </div>

      {/* Bottom nav bar */}
      <div
        style={{
          height: 56,
          background: "#f7f7f7",
          borderTop: "0.5px solid #d9d9d9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          flexShrink: 0,
        }}
      >
        <div
          onClick={() => setActiveTab("chat")}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", color: activeTab === "chat" ? "#07C160" : "#999", fontSize: 10 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={activeTab === "chat" ? "#07C160" : "#999"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ marginTop: 2 }}>聊天</span>
        </div>
        <div
          onClick={() => setActiveTab("my")}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", color: activeTab === "my" ? "#07C160" : "#999", fontSize: 10 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={activeTab === "my" ? "#07C160" : "#999"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span style={{ marginTop: 2 }}>我的</span>
        </div>
      </div>
    </div>
  );
}

function ChatList({ chats, loading, onStartChat, router }) {
  return (
    <>
      {chats.map(function(chat) {
        const lastMsg =
          chat.messages && chat.messages.length > 0
            ? chat.messages[0].content
            : chat.character ? chat.character.greeting || "" : "";
        const truncated = lastMsg.length > 28 ? lastMsg.slice(0, 28) + "..." : lastMsg;

        return (
          <div
            key={chat.id}
            onClick={function() {
              if (chat.character) {
                const encodedName = encodeURIComponent(chat.character.name);
                router.push("/" + encodedName + "/" + chat.id);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "14px 16px",
              background: "#fff",
              borderBottom: "0.5px solid #ececec",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 6,
                background: "#ddd",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <img src="/avatar-yang.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ flex: 1, marginLeft: 12, overflow: "hidden" }}>
              <div style={{ fontSize: 16, color: "#000", fontWeight: 400, marginBottom: 4 }}>
                {chat.character ? chat.character.name : "羊顺利"}
              </div>
              <div style={{ fontSize: 13, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {truncated}
              </div>
            </div>
          </div>
        );
      })}

      {chats.length === 0 && !loading && (
        <div onClick={onStartChat} style={{ padding: "60px 20px", textAlign: "center", cursor: "pointer" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 10,
              background: "#ddd",
              margin: "0 auto 16px",
              overflow: "hidden",
            }}
          >
            <img src="/avatar-yang.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ fontSize: 16, color: "#000", marginBottom: 8 }}>羊顺利</div>
          <div
            style={{ display: "inline-block", background: "#07C160", color: "#fff", padding: "10px 32px", borderRadius: 6, fontSize: 15 }}
          >
            开始聊天
          </div>
        </div>
      )}
    </>
  );
}

function MyTab({ username, credits, redeemCode, setRedeemCode, redeemMsg, onRedeem, onLogout }) {
  return (
    <div style={{ padding: "20px 16px" }}>
      {/* User info card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            color: "#666",
            flexShrink: 0,
          }}
        >
          {username ? username.charAt(0).toUpperCase() : "?"}
        </div>
        <div style={{ marginLeft: 14, flex: 1 }}>
          <div style={{ fontSize: 17, color: "#000", fontWeight: 500, marginBottom: 4 }}>{username}</div>
          <div style={{ fontSize: 14, color: "#07C160" }}>积分：{credits}</div>
        </div>
      </div>

      {/* Redeem section */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 500, color: "#000", marginBottom: 12 }}>兑换积分</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={redeemCode}
            onChange={function(e) { setRedeemCode(e.target.value); }}
            placeholder="输入兑换码"
            style={{ flex: 1, height: 40, border: "1px solid #ddd", borderRadius: 6, padding: "0 12px", fontSize: 14, outline: "none", color: "#000", background: "#fff", boxSizing: "border-box" }}
          />
          <button
            onClick={onRedeem}
            style={{ height: 40, padding: "0 20px", background: "#07C160", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer", flexShrink: 0 }}
          >
            兑换
          </button>
        </div>
        {redeemMsg && <div style={{ fontSize: 13, color: "#07C160", marginTop: 8 }}>{redeemMsg}</div>}
      </div>

      {/* Logout button */}
      <button
        onClick={onLogout}
        style={{
          width: "100%",
          height: 44,
          background: "#fff",
          color: "#e74c3c",
          border: "none",
          borderRadius: 12,
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        退出登录
      </button>
    </div>
  );
}

function LoginScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleSubmit = async function(e) {
    e.preventDefault();
    if (!username || !password) return;

    if (isRegister) {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username, password: password }),
        });
        const data = await res.json();
        if (res.ok) {
          setMsg("注册成功，请登录");
          setIsRegister(false);
          setPassword("");
        } else {
          setMsg(data.error || "注册失败");
        }
      } catch (err) {
        setMsg("注册失败");
      }
    } else {
      try {
        var result = await signIn("credentials", {
          username: username,
          password: password,
          redirect: false,
        });
        if (result && result.error) {
          setMsg("用户名或密码错误");
        }
      } catch (err) {
        setMsg("登录失败");
      }
    }
    setTimeout(function() { setMsg(""); }, 3000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#1a1a2e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div style={{ width: "80%", maxWidth: 320 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 10,
              background: "#ddd",
              margin: "0 auto 16px",
              overflow: "hidden",
            }}
          >
            <img src="/avatar-yang.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 600 }}>羊顺利的专属空间</div>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={function(e) { setUsername(e.target.value); }}
            placeholder="用户名"
            style={{ width: "100%", height: 48, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "0 16px", color: "#fff", fontSize: 15, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
          />
          <input
            type="password"
            value={password}
            onChange={function(e) { setPassword(e.target.value); }}
            placeholder="密码"
            style={{ width: "100%", height: 48, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "0 16px", color: "#fff", fontSize: 15, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
          />
          {msg && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 8 }}>{msg}</div>}
          <button type="submit" style={{ width: "100%", height: 48, background: "#07C160", color: "#fff", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 500, cursor: "pointer" }}>
            {isRegister ? "注册" : "登录"}
          </button>
        </form>

        <div
          onClick={function() { setIsRegister(!isRegister); setMsg(""); }}
          style={{ textAlign: "center", marginTop: 16, color: "rgba(255,255,255,0.6)", fontSize: 14, cursor: "pointer" }}
        >
          {isRegister ? "已有账号？去登录" : "没有账号？去注册"}
        </div>
      </div>
    </div>
  );
}
