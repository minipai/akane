import React from "react";
import { Box, Text } from "ink";
import type { ToolActivity } from "../types.js";

const MAX_LINES = 3;

function truncateOutput(text: string): string {
  const lines = text.split("\n");
  if (lines.length <= MAX_LINES) return text;
  return lines.slice(-MAX_LINES).join("\n");
}

export default function ToolPanel({
  activity,
}: {
  activity: ToolActivity | null;
}) {
  if (!activity) return null;

  return (
    <Box flexDirection="column" marginBottom={0}>
      <Box>
        <Text color="yellow" bold>
          {">"} {activity.name}
        </Text>
        <Text color="gray"> {activity.args}</Text>
      </Box>
      {activity.result !== null && (
        <Box>
          <Text dimColor>{truncateOutput(activity.result)}</Text>
        </Box>
      )}
    </Box>
  );
}
