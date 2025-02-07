import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";

export function ToastProvider() {
  return <Toaster />;
}

// Utility function to show toast messages
export function useToast() {
  const { toast } = useToast();

  const showToast = (message, type = "default") => {
    toast({
      title: type.charAt(0).toUpperCase() + type.slice(1),
      description: message,
      variant: type === "error" ? "destructive" : "default",
    });
  };

  return showToast;
}
