import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface TelegramRequirementStatus {
  hasTelegramUsername: boolean;
  deadline: string;
  requiredNow: boolean;
}

interface TelegramUsernamePromptProps {
  user?: User;
}

export default function TelegramUsernamePrompt({ user }: TelegramUsernamePromptProps) {
  const [username, setUsername] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [deadlineReached, setDeadlineReached] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requirement } = useQuery<TelegramRequirementStatus>({
    queryKey: ["/api/auth/telegram-requirement", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/auth/telegram-requirement");
      if (!response.ok) throw new Error("Unable to load Telegram requirement");
      return response.json();
    },
    enabled: Boolean(user),
    retry: false,
  });

  useEffect(() => {
    setUsername("");
    setDismissed(false);
  }, [user?.id]);

  useEffect(() => {
    if (!requirement?.deadline) {
      setDeadlineReached(false);
      return;
    }

    const delay = new Date(requirement.deadline).getTime() - Date.now();
    if (delay <= 0) {
      setDeadlineReached(true);
      return;
    }

    setDeadlineReached(false);
    const timeoutId = window.setTimeout(() => {
      setDeadlineReached(true);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/telegram-requirement"] });
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [requirement?.deadline, queryClient]);

  const saveTelegramUsername = useMutation({
    mutationFn: async (telegramUsername: string) => {
      const response = await fetch("/api/auth/telegram-username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramUsername }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save Telegram username");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/telegram-requirement"] });
      toast({
        title: "Telegram username saved",
        description: "Thanks—our team can now reach you with updates and access codes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save Telegram username",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hasTelegramUsername = /^[A-Za-z0-9_]{5,32}$/.test(
    (user?.telegramUsername || "").trim().replace(/^@+/, ""),
  );

  if (!user || !requirement || hasTelegramUsername) return null;

  const isRequiredNow = requirement.requiredNow || deadlineReached || Date.now() >= new Date(requirement.deadline).getTime();
  const isOpen = isRequiredNow || !dismissed;
  const deadline = new Date(requirement.deadline).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const handleSave = () => {
    const cleanedUsername = username.trim().replace(/^@+/, "");
    if (!cleanedUsername) {
      toast({
        title: "Telegram username required",
        description: "Enter the username from your Telegram profile to continue.",
        variant: "destructive",
      });
      return;
    }
    saveTelegramUsername.mutate(cleanedUsername);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isRequiredNow) setDismissed(true);
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => {
          if (isRequiredNow) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isRequiredNow) event.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/10">
            <MessageCircle className="h-5 w-5 text-sky-600" />
          </div>
          <DialogTitle>Stay connected on Telegram</DialogTitle>
          <DialogDescription className="leading-6">
            Adding your Telegram username gives us an easier way to communicate with you and send access codes when needed.
            <br />
            <br />
            Please message t.me/doobiedivision with code ACCESS for instant access to access codes!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="telegram-prompt-username">Telegram username</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <Input
              id="telegram-prompt-username"
              value={username}
              onChange={(event) => setUsername(event.target.value.replace(/^@+/, ""))}
              placeholder="your_username"
              className="pl-7"
              autoComplete="username"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSave();
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Starting {deadline}, a Telegram username will be required to access the site.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!isRequiredNow && (
            <Button variant="outline" onClick={() => setDismissed(true)}>
              Not now
            </Button>
          )}
          <Button onClick={handleSave} disabled={saveTelegramUsername.isPending}>
            {saveTelegramUsername.isPending ? "Saving..." : "Save Telegram username"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}