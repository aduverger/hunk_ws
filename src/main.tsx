#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { parseCli } from "./core/cli";
import { loadAppBootstrap } from "./core/loaders";
import type { AppBootstrap } from "./core/types";

function SummaryApp({ bootstrap }: { bootstrap: AppBootstrap }) {
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
        <text fg="#eef2ff">{bootstrap.changeset.title}</text>
        <text fg="#93a4c8">{bootstrap.changeset.sourceLabel}</text>
        <text fg="#6f84b1">
          {bootstrap.changeset.files.length} file{bootstrap.changeset.files.length === 1 ? "" : "s"} loaded
        </text>
      </box>

      <box
        title="Files"
        style={{
          border: true,
          borderColor: "#2e3a55",
          padding: 1,
          flexDirection: "column",
          gap: 1,
          backgroundColor: "#111729",
          flexGrow: 1,
        }}
      >
        {bootstrap.changeset.files.slice(0, 10).map((file) => (
          <text key={file.id} fg="#d7e1f7">
            {file.path}  +{file.stats.additions} -{file.stats.deletions}
          </text>
        ))}
        <text fg="#6f84b1">Press q or Esc to quit.</text>
      </box>
    </box>
  );
}

const cliInput = await parseCli(process.argv);
const bootstrap = await loadAppBootstrap(cliInput);

const renderer = await createCliRenderer({
  useMouse: true,
  useAlternateScreen: true,
  exitOnCtrlC: true,
});

createRoot(renderer).render(<SummaryApp bootstrap={bootstrap} />);
