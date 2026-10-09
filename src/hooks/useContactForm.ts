import { useState, useOptimistic, useTransition } from "react";
import { useWorld3DStore } from "@/store/useWorld3DStore";

export type FormStatus = {
  type: "idle" | "loading" | "success" | "error";
  message: string;
};

/**
 * Contact form state + submission to /api/contact.
 * Plays the character's "cheering" animation on success.
 */
export function useContactForm() {
  const { playCharacterAnimation } = useWorld3DStore();
  const [isPending, startTransition] = useTransition();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    content: "",
  });
  
  const [status, setStatus] = useState<FormStatus>({
    type: "idle",
    message: "",
  });

  // Optimistic status for immediate UI feedback
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    status,
    (_state, newStatus: FormStatus) => newStatus
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim() || !formData.content.trim()) {
      setStatus({
        type: "error",
        message: "Please fill in all required fields.",
      });
      return;
    }

    startTransition(async () => {
      // Optimistically show loading state (must run inside the transition,
      // otherwise React 19 warns and may drop the optimistic update)
      setOptimisticStatus({ type: "loading", message: "Sending message..." });

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus({
            type: "success",
            message: "Message sent successfully! I'll get back to you soon.",
          });
          setFormData({ name: "", email: "", content: "" });
          
          // Play wave/cheering animation if available
          playCharacterAnimation("cheering", false);
        } else {
          setStatus({
            type: "error",
            message: data.error || "Failed to send message. Please try again.",
          });
        }
      } catch {
        setStatus({
          type: "error",
          message: "An error occurred. Please try again later.",
        });
      }
    });
  };

  return {
    formData,
    handleChange,
    handleSubmit,
    status: optimisticStatus,
    isSending: optimisticStatus.type === "loading" || isPending,
  };
}
