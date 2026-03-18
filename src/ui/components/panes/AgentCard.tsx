import type { ReactNode } from "react";
import type { AppTheme } from "../../themes";

export function AgentCard({
  children,
  theme,
  title,
}: {
  children: ReactNode;
  theme: AppTheme;
  title: string;
}) {
  return (
    <box
      title={title}
      style={{
        border: true,
        borderColor: theme.accentMuted,
        backgroundColor: theme.panelAlt,
        padding: 1,
        flexDirection: "column",
        gap: 1,
      }}
    >
      {children}
    </box>
  );
}
