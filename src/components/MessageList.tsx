import React from "react";
import { Box, Text } from "ink";
import type { ChatEntry, Message } from "../types.js";

const EMOTION_EMOJI: Record<string, string> = {
  neutral: "•ᴗ•",
  happy: "(˶ˆᗜˆ˵)",
  excited: "◝(ᵔᗜᵔ)◜",
  curious: "(づ •. •)?",
  thinking: "(╭ರ_•́)",
  surprised: "( ˶°ㅁ°) !!",
  sad: "૮(˶ㅠ︿ㅠ)ა",
  frustrated: "(,,>﹏<,,)",
  confused: "(ó﹏ò｡)",
  amused: "(„ᵕᴗᵕ„)",
  proud: "ᕙ( •̀ ᗜ •́)ᕗ ",
  embarrassed: "( ˶>﹏<˶ᵕ)",
  anxious: "(ó﹏ò｡)",
  determined: "(๑•̀ ᴗ•́)૭✧",
  playful: "ヾ( ˃ᴗ˂ )◞ • *✰",
};

function getContent(msg: Message): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.map((c) => ("text" in c ? c.text : "")).join("");
  }
  return "";
}

interface Props {
  entries: ChatEntry[];
}

export default function MessageList({ entries }: Props) {
  const visible = entries.filter(
    (e) => e.message.role === "user" || e.message.role === "assistant",
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((entry, i) => {
        const content = getContent(entry.message);
        if (!content) return null;

        const isAssistant = entry.message.role === "assistant";
        const emoji = entry.emotion ? EMOTION_EMOJI[entry.emotion] : undefined;

        return (
          <Box key={i} marginBottom={0}>
            <Box flexShrink={0}>
              <Text color={isAssistant ? "#ff77ff" : "green"} bold>
                {isAssistant ? "Kana" : process.env.USER_NAME || "You"}{" "}
              </Text>
              {isAssistant && emoji && <Text color="#ff77ff">{emoji} </Text>}
              <Text color={isAssistant ? "#ff77ff" : "green"} bold>
                :{" "}
              </Text>
            </Box>
            <Text wrap="wrap">{content}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
