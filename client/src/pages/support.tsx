import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import {
  MessageCircle,
  Send,
  ImagePlus,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { format } from "date-fns";

interface TicketResponse {
  id: number;
  message: string;
  type: string;
  imageUrls: string | null;
  createdAt: string;
  createdBy: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface Ticket {
  id: number;
  subject: string;
  message: string;
  status: string;
  priority: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
}

interface TicketWithResponses {
  ticket: Ticket;
  responses: TicketResponse[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    open: { label: "Open", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
    close_requested: { label: "Close Requested", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
    resolved: { label: "Resolved", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
    closed: { label: "Closed", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  };
  const entry = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return <Badge className={entry.className}>{entry.label}</Badge>;
}

function TicketConversation({
  item,
  userId,
  onBack,
}: {
  item: TicketWithResponses;
  userId: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [item.responses]);

  const replyMutation = useMutation({
    mutationFn: async ({ message, imageUrls }: { message: string; imageUrls: string[] }) => {
      const res = await fetch(`/api/support/tickets/${item.ticket.id}/customer-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, imageUrls }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/my-tickets"] });
      setReplyText("");
      setPendingImages([]);
      toast({ title: "Message sent" });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const requestCloseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/support/tickets/${item.ticket.id}/request-close`, {
        method: "PUT",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to request closure");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/my-tickets"] });
      toast({ title: "Closure requested. Our team will close this ticket shortly." });
    },
    onError: () => {
      toast({ title: "Failed to request closure", variant: "destructive" });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/support/ticket-images", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { imageUrl } = await res.json();
      setPendingImages((prev) => [...prev, imageUrl]);
    } catch {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isClosed = item.ticket.status === "closed";
  const isPasswordReset = item.ticket.subject?.includes("Password Reset Request");
  const canReply = !isClosed && !isPasswordReset;

  const allMessages = [
    {
      id: 0,
      type: "customer",
      message: item.ticket.message,
      createdAt: item.ticket.createdAt,
      isInitial: true,
      imageUrls: (item.ticket as any).imageUrls as string | null,
    },
    ...item.responses.map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      createdAt: r.createdAt,
      isInitial: false,
      imageUrls: r.imageUrls,
    })),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-1">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-lg truncate">Ticket #{item.ticket.id}</h2>
            <StatusBadge status={item.ticket.status} />
          </div>
          <p className="text-sm text-muted-foreground truncate">{item.ticket.subject}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-[420px] pr-1">
        {allMessages.map((msg, idx) => {
          const isCustomer = msg.type === "customer";
          const images = msg.imageUrls ? (() => { try { return JSON.parse(msg.imageUrls!); } catch { return []; } })() : [];
          return (
            <div key={idx} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-2 ${
                isCustomer
                  ? "bg-green-600 text-white rounded-tr-sm"
                  : msg.type === "system"
                  ? "bg-muted text-muted-foreground italic rounded-tl-sm text-sm"
                  : "bg-card border border-border rounded-tl-sm"
              }`}>
                {!isCustomer && msg.type !== "system" && (
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">Support Team</p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {images.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="attachment" className="max-h-40 rounded-lg border border-white/20 object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
                <p className={`text-xs mt-1 ${isCustomer ? "text-green-100" : "text-muted-foreground"}`}>
                  {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply area */}
      {canReply ? (
        <div className="border-t border-border pt-4 space-y-3">
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingImages.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="pending" className="h-16 w-16 object-cover rounded-lg border" />
                  <button
                    onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Textarea
            placeholder="Add more context or ask a follow-up question..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && replyText.trim()) {
                replyMutation.mutate({ message: replyText, imageUrls: pendingImages });
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline">Photo</span>
              </Button>
              {item.ticket.status !== "close_requested" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => requestCloseMutation.mutate()}
                  disabled={requestCloseMutation.isPending}
                  className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {requestCloseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  <span className="ml-1 hidden sm:inline">Request Close</span>
                </Button>
              )}
            </div>
            <Button
              onClick={() => {
                if (replyText.trim() || pendingImages.length > 0) {
                  replyMutation.mutate({ message: replyText || "(image attached)", imageUrls: pendingImages });
                }
              }}
              disabled={replyMutation.isPending || (!replyText.trim() && pendingImages.length === 0)}
              size="sm"
            >
              {replyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Send
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Ctrl+Enter to send</p>
        </div>
      ) : (
        <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
          <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
          This ticket is closed. Open a new ticket if you need further assistance.
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  useWebSocket();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    customerName: "",
    message: "",
  });
  const [pendingPhotos, setPendingPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const preview = URL.createObjectURL(file);
      setPendingPhotos((prev) => [...prev, { file, preview }]);
    });
    if (photoInputRef.current) photoInputRef.current.value = "";
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPendingPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const { data: myTickets = [], isLoading: ticketsLoading } = useQuery<TicketWithResponses[]>({
    queryKey: ["/api/support/my-tickets"],
    enabled: !!user,
    refetchInterval: 5000,
  });

  const selectedTicket = myTickets.find((t) => t.ticket.id === selectedTicketId) ?? null;

  // Auto-select first active ticket if no form is being shown
  useEffect(() => {
    if (!showNewForm && !selectedTicketId && myTickets.length > 0) {
      const active = myTickets.find((t) => t.ticket.status !== "closed");
      if (active) setSelectedTicketId(active.ticket.id);
    }
  }, [myTickets, showNewForm, selectedTicketId]);

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Upload any pending photos first
      let imageUrls: string[] = [];
      if (pendingPhotos.length > 0) {
        setUploadingPhotos(true);
        try {
          for (const { file } of pendingPhotos) {
            const fd = new FormData();
            fd.append("image", file);
            const res = await fetch("/api/support/ticket-images", {
              method: "POST",
              credentials: "include",
              body: fd,
            });
            if (res.ok) {
              const { imageUrl } = await res.json();
              imageUrls.push(imageUrl);
            }
          }
        } finally {
          setUploadingPhotos(false);
        }
      }

      const ticketData: Record<string, string | null> = {
        subject: "Support Request",
        message: contactForm.message,
        priority: "normal",
        customerName: contactForm.customerName,
        imageUrls: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      };
      if (user?.id) ticketData.userId = user.id;

      const response = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(ticketData),
      });

      if (response.ok) {
        const ticket = await response.json();
        toast({ title: "Support ticket created", description: "You can now continue the conversation below." });
        setContactForm({ customerName: "", message: "" });
        setPendingPhotos([]);
        setShowNewForm(false);
        await queryClient.invalidateQueries({ queryKey: ["/api/support/my-tickets"] });
        setSelectedTicketId(ticket.id);
      } else {
        throw new Error("Failed to send message");
      }
    } catch {
      toast({ title: "Failed to create ticket", variant: "destructive" });
    }
  };

  if (!user) return <div>Loading...</div>;

  const hasTickets = myTickets.length > 0;
  const showForm = showNewForm || (!hasTickets && !ticketsLoading);

  return (
    <>
      <Navigation user={user} currentTab="support" />
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Customer Support</h1>
            <p className="text-muted-foreground">
              {hasTickets ? "View your support conversations below." : "Submit a ticket and our team will get back to you."}
            </p>
          </div>

          {/* Main content */}
          {showForm ? (
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Contact Support
                  </CardTitle>
                  {hasTickets && (
                    <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back to Tickets
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitContact} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Full Name *</label>
                    <Input
                      value={contactForm.customerName}
                      onChange={(e) => setContactForm((p) => ({ ...p, customerName: e.target.value }))}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Support Request Details *</label>
                    <Textarea
                      value={contactForm.message}
                      onChange={(e) => setContactForm((p) => ({ ...p, message: e.target.value }))}
                      placeholder="Describe your issue in detail. Include order numbers, product names, or any error messages..."
                      rows={5}
                      required
                    />
                  </div>
                  {/* Photo upload */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Attach Photos (optional)</label>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    {pendingPhotos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {pendingPhotos.map((p, i) => (
                          <div key={i} className="relative w-16 h-16 rounded overflow-hidden border border-border">
                            <img src={p.preview} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removePhoto(i)}
                              className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 hover:bg-black/80"
                            >
                              <X className="h-3 w-3 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      className="gap-2"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Add Photos
                    </Button>
                  </div>
                  <Button type="submit" disabled={uploadingPhotos} className="w-full">
                    {uploadingPhotos ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading photos...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" />Submit Support Ticket</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-[280px_1fr] gap-4 items-start">
              {/* Ticket list sidebar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Your Tickets</h3>
                  <Button variant="outline" size="sm" onClick={() => { setShowNewForm(true); setSelectedTicketId(null); }}>
                    + New
                  </Button>
                </div>
                {ticketsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  myTickets.map((item) => (
                    <button
                      key={item.ticket.id}
                      onClick={() => { setSelectedTicketId(item.ticket.id); setShowNewForm(false); }}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selectedTicketId === item.ticket.id
                          ? "border-green-600 bg-green-50 dark:bg-green-900/10"
                          : "border-border bg-card hover:border-green-400"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-medium truncate">Ticket #{item.ticket.id}</span>
                        <StatusBadge status={item.ticket.status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(item.ticket.createdAt), "MMM d, yyyy")}
                      </p>
                      {item.responses.length > 0 && (
                        <p className="text-xs text-blue-500 mt-1">{item.responses.length} message{item.responses.length !== 1 ? "s" : ""}</p>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Conversation panel */}
              <Card className="min-h-[560px] flex flex-col">
                <CardContent className="flex-1 p-4 flex flex-col">
                  {selectedTicket ? (
                    <TicketConversation
                      item={selectedTicket}
                      userId={user.id}
                      onBack={() => setSelectedTicketId(null)}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground space-y-3">
                      <MessageCircle className="h-12 w-12 opacity-30" />
                      <p className="text-sm">Select a ticket to view the conversation</p>
                      <Button variant="outline" size="sm" onClick={() => setShowNewForm(true)}>
                        + Open New Ticket
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
