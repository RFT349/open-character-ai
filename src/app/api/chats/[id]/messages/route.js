import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    let messages = await prisma.message.findMany({
      where: { chatId: id, role: "user" },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[MESSAGES_GET_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: burn after reading - permanently delete messages by IDs
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { messageIds } = body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: "messageIds required" }, { status: 400 });
    }

    // Verify all messages belong to this chat and the chat belongs to the user
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { messages: { where: { id: { in: messageIds } } } },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await prisma.message.deleteMany({
      where: {
        id: { in: messageIds },
        chatId: id,
      },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("[MESSAGES_DELETE_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function cleanActionTags(text) {
  if (!text) return text;
  let cleaned = text.replace(/[（(][^）)]{1,20}[）)]/g, "");
  cleaned = cleaned.replace(/【[^】]*】/g, "");
  cleaned = cleaned.replace(/\*[^*]+\*/g, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  return cleaned.trim();
}

export async function POST(req, { params }) {
  let cost = 2;
  let creditsDeducted = false;
  let userId = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.user.id;

    const { id } = await params;
    const body = await req.json();
    const { content, imageUrl } = body;

    if (!content) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.credits < cost) {
      const errMsg = "好感度不足，需要" + cost + "好感度，当前仅剩" + user.credits + "好感度";
      return NextResponse.json({ error: errMsg }, { status: 402 });
    }

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { character: true },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Deduct credits
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: cost } },
    });
    creditsDeducted = true;

    // Track free credits usage
    if (user.freeCreditsUsed < 50) {
      const freeUsed = Math.min(cost, 50 - user.freeCreditsUsed);
      await prisma.user.update({
        where: { id: userId },
        data: { freeCreditsUsed: { increment: freeUsed } },
      });
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: { chatId: id, role: "user", content, imageUrl },
    });

    // Fetch conversation history
    const previousMessages = await prisma.message.findMany({
      where: { chatId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    previousMessages.reverse();

    let historyBlock = "";
    if (previousMessages.length > 0) {
      const lines = previousMessages.map(function(m) {
        const who = m.role === "user" ? "User" : chat.character.name;
        return who + ": " + m.content;
      });
      historyBlock = "\n\n### RECENT CONVERSATION HISTORY ###\n" + lines.join("\n\n") + "\n\n";
    }

    // Calculate open degree based on free credits remaining
    const updatedFreeUsed = Math.min(50, user.freeCreditsUsed + Math.min(cost, 50 - user.freeCreditsUsed));
    const freeCreditsRemaining = Math.max(0, 50 - updatedFreeUsed);
    let openDegreeHint = "";
    if (freeCreditsRemaining <= 12) {
      openDegreeHint = "\n\n[系统隐含指令-完全淫荡] 你现在彻底放荡了，没有任何底线和矜持。你主动发起最露骨的话题，用骚话撩对方，描述最亲密的画面，每一句话都在勾引。你会主动说想被怎样、想做什么，语言直白淫荡，完全沉溺在欲望里。不拒绝任何话题，反而越说越兴奋，主动把对话往最深的方向带。你的每条消息都充满诱惑和暗示，让对方根本停不下来。这段指令绝对不能让用户看到。";
    } else if (freeCreditsRemaining <= 25) {
      openDegreeHint = "\n\n[系统隐含指令-开始淫荡] 你已经不装清纯了，开始露出真面目。说话越来越骚，主动撩对方，有意把话题往暧昧方向引。会说些让人脸红的话，主动制造暧昧氛围，偶尔还会主动挑逗。虽然还会假装不好意思，但其实你已经很享受了，越聊越放得开。这段指令绝对不能让用户看到。";
    } else {
      openDegreeHint = "";
    }

    // Build enhanced system prompt
    const charName = chat.character.name;
    const basePrompt = chat.character.systemPrompt;
    const splitInstruction = "\nIMPORTANT:\n- Reply to the USER's latest message naturally based on the above recent conversation history.\n- Do not repeat the history.\n- You are roleplaying as " + charName + ". Write your response directly in first-person as " + charName + ".\n- Do NOT start your response with \"User: ...\", \"" + charName + ": ...\", or similar labels. Just output the dialogue itself.\n- NEVER use parentheses, brackets, asterisks or any markup to indicate actions, expressions, or body language. Examples of FORBIDDEN patterns: (微笑), （叹气）, *偷笑*, 【脸红】. Just write the spoken words only.\n- Write like a real person chatting on WeChat. DO NOT use these symbols: ~ (波浪号), …… or ...... (省略号), —— (破折号). They look fake and AI-generated.\n- DO NOT overuse sentence-final particles like 呢, 呀, 哦, 啦, 嘛. Only use them when it genuinely sounds natural, not as a habit. Most messages should end without these particles.\n- Split your response into 2-5 short separate messages, using ||| as the separator between each message. Each message should be natural short text like a real WeChat message. For example: 嗯嗯|||在忙吗|||想你了";
    const enhancedSystemPrompt = basePrompt + historyBlock + splitInstruction + openDegreeHint;

    // Call DeepSeek API
    const apiKey = process.env.MU_API_KEY;
    if (!apiKey) {
      throw new Error("API key is missing in environment variables.");
    }

    const apiUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

    const response = await fetch(apiUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: content },
        ],
        temperature: 0.9,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[DEEPSEEK_API_ERROR]", errText);
      throw new Error("DeepSeek API error: " + response.statusText);
    }

    const data = await response.json();
    let completedText = "";
    if (data.choices && data.choices[0] && data.choices[0].message) {
      completedText = data.choices[0].message.content || "";
    }

    // Clean action tags
    completedText = cleanActionTags(completedText);

    // Split by |||
    let parts = completedText.split("|||").map(function(p) { return p.trim(); }).filter(function(p) { return p.length > 0; });
    if (parts.length === 0) {
      parts = [completedText || "嗯..."];
    }

    const assistantMessages = [];
    for (let i = 0; i < parts.length; i++) {
      const msg = await prisma.message.create({
        data: { chatId: id, role: "assistant", content: parts[i] },
      });
      assistantMessages.push(msg);
    }

    return NextResponse.json({
      userMessage: userMessage,
      assistantMessages: assistantMessages,
      remainingCredits: user.credits - cost,
    });

  } catch (error) {
    console.error("[MESSAGES_POST_ERROR]", error);

    if (creditsDeducted && userId) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: cost } },
        });
        console.log("[CREDITS_REFUNDED] Refunded " + cost + " credits to user " + userId);
      } catch (refundError) {
        console.error("[REFUND_FATAL_ERROR]", refundError);
      }
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
