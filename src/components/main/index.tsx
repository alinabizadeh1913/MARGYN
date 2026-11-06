"use client";

import React from "react";
import { TimeProvider } from "@/providers/TimeProvider";
import { SessionProvider } from "@/providers/SessionProvider";
import { ShortcutProvider } from "@/providers/ShortcutProvider";
import { ToolProvider } from "@/providers/ToolProvider";
import { ContextMenuProvider } from "@/providers/ContextMenuProvider";
import { AppContent } from "./AppContent";

export default function MainComponent() {
  return (
    <TimeProvider>
      <SessionProvider>
        <ShortcutProvider>
          <ToolProvider>
            <ContextMenuProvider>
              <AppContent />
            </ContextMenuProvider>
          </ToolProvider>
        </ShortcutProvider>
      </SessionProvider>
    </TimeProvider>
  );
}
