"use client";

import { Toaster } from "sonner";
import { useTaskStore } from "@/store/useTaskStore";

export function AppToaster() {
  const theme = useTaskStore((s) => s.theme);

  return (
    <Toaster
      position="bottom-right"
      theme={theme}
      closeButton={false}
      richColors={false}
      duration={4000}
      className="bat-sonner-toaster"
      toastOptions={{
        classNames: {
          toast: "bat-toast",
          title: "bat-toast__title",
          description: "bat-toast__description",
          success: "bat-toast--success",
          error: "bat-toast--error",
          actionButton: "bat-toast__action",
        },
      }}
    />
  );
}