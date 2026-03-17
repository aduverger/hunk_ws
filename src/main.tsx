#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";

function BootstrapApp() {
  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      process.exit(0);
    }
  });

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        padding: 1,
        flexDirection: "column",
        gap: 1,
        backgroundColor: "#0f1220",
      }}
    >
      <box
        title="opentui-diff"
        style={{
          border: true,
          borderColor: "#3b4867",
          padding: 1,
          flexDirection: "column",
          gap: 1,
          backgroundColor: "#141a2b",
        }}
      >
        <text fg="#eef2ff">Project bootstrap complete.</text>
        <text fg="#93a4c8">Next commit will replace this shell with the real diff viewer.</text>
        <text fg="#6f84b1">Press q or Esc to quit.</text>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({
  useMouse: true,
  useAlternateScreen: true,
  exitOnCtrlC: true,
});

createRoot(renderer).render(<BootstrapApp />);
