import type { AgentAnnotation, DiffFile } from "../../../core/types";
import type { AppTheme } from "../../themes";
import { AgentCard } from "./AgentCard";

export function AgentRail({
  activeAnnotations,
  changesetSummary,
  file,
  marginLeft,
  summary,
  theme,
  width,
}: {
  activeAnnotations: AgentAnnotation[];
  changesetSummary?: string;
  file: DiffFile | undefined;
  marginLeft: number;
  summary?: string;
  theme: AppTheme;
  width: number;
}) {
  return (
    <box
      style={{
        width,
        border: ["top", "left"],
        borderColor: theme.border,
        backgroundColor: theme.panel,
        padding: 1,
        marginLeft,
      }}
    >
      <scrollbox width="100%" height="100%" scrollY={true} viewportCulling={true} focused={false}>
        <box style={{ width: "100%", flexDirection: "column", gap: 1, paddingRight: 1 }}>
          {summary ? (
            <AgentCard title="Changeset" theme={theme}>
              <text fg={theme.text}>{summary}</text>
            </AgentCard>
          ) : null}

          {file?.agent?.summary ? (
            <AgentCard title="File" theme={theme}>
              <text fg={theme.text}>{file.agent.summary}</text>
            </AgentCard>
          ) : null}

          {activeAnnotations.length > 0 ? (
            activeAnnotations.map((annotation, index) => (
              <AgentCard key={`${file?.id ?? "annotation"}:${index}`} title={`Annotation ${index + 1}`} theme={theme}>
                <text fg={theme.text}>{annotation.summary}</text>
                {annotation.rationale ? <text fg={theme.muted}>{annotation.rationale}</text> : null}
                {annotation.tags && annotation.tags.length > 0 ? (
                  <text fg={theme.badgeNeutral}>tags: {annotation.tags.join(", ")}</text>
                ) : null}
                {annotation.confidence ? <text fg={theme.badgeNeutral}>confidence: {annotation.confidence}</text> : null}
              </AgentCard>
            ))
          ) : (
            <AgentCard title="Selection" theme={theme}>
              <text fg={theme.muted}>
                {file?.agent
                  ? "No annotation is attached to the current hunk."
                  : "No agent metadata is attached to the current file."}
              </text>
            </AgentCard>
          )}

          {changesetSummary ? (
            <AgentCard title="Patch" theme={theme}>
              <text fg={theme.muted}>{changesetSummary}</text>
            </AgentCard>
          ) : null}
        </box>
      </scrollbox>
    </box>
  );
}
