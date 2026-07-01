import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import { 
  MessageCircle, 
  Mail, 
  Phone, 
  Clock, 
  Package, 
  CreditCard, 
  Truck, 
  Shield, 
  Star,
  Send
} from "lucide-react";

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contactForm, setContactForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerTelegram: "",
    message: "",
    contactMethod: "phone" as "phone" | "telegram"
  });

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const ticketData: Record<string, string | null> = {
        subject: "Support Request",
        message: contactForm.message,
        priority: "normal",
        customerName: contactForm.customerName,
        customerEmail: contactForm.customerEmail,
        customerPhone: contactForm.contactMethod === "phone" ? contactForm.customerPhone : null,
        customerTelegram: contactForm.contactMethod === "telegram" ? contactForm.customerTelegram : null,
      };
      if (user?.id) {
        ticketData.userId = user.id;
      }

      const response = await fetch("/api/support/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(ticketData),
      });

      if (response.ok) {
        toast({
          title: "Message sent successfully",
          description: "We'll get back to you within 24 hours.",
        });
        setContactForm({ 
          customerName: "", 
          customerEmail: "", 
          customerPhone: "", 
          customerTelegram: "",
          message: "",
          contactMethod: "phone"
        });
      } else {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    }
  };

  const supportTopics = [
    {
      icon: Package,
      title: "Order Issues",
      description: "Problems with your order, delivery, or tracking"
    },
    {
      icon: CreditCard,
      title: "Payment & Billing",
      description: "Payment problems, billing questions, refunds"
    },
    {
      icon: Truck,
      title: "Shipping & Delivery",
      description: "Delivery questions, shipping options, tracking"
    },
    {
      icon: Shield,
      title: "Account & Security",
      description: "Account access, password reset, security concerns"
    }
  ];

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Navigation user={user} currentTab="support" />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Customer Support</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We're here to help! Get in touch with our support team for any assistance you need.
            </p>
          </div>

          

          <div className="max-w-2xl mx-auto">
            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Contact Support
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitContact} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Full Name *</label>
                    <Input
                      value={contactForm.customerName}
                      onChange={(e) => setContactForm(prev => ({ ...prev, customerName: e.target.value }))}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Contact Method *</label>
                    <div className="flex rounded-lg overflow-hidden border border-input mb-3">
                      <button
                        type="button"
                        onClick={() => setContactForm(prev => ({ ...prev, contactMethod: "phone" }))}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${contactForm.contactMethod === "phone" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        📞 Phone Number
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactForm(prev => ({ ...prev, contactMethod: "telegram" }))}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${contactForm.contactMethod === "telegram" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        ✈️ Telegram
                      </button>
                    </div>
                    {contactForm.contactMethod === "phone" ? (
                      <Input
                        value={contactForm.customerPhone}
                        onChange={(e) => setContactForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                        placeholder="Your phone number"
                        type="tel"
                        required
                      />
                    ) : (
                      <Input
                        value={contactForm.customerTelegram}
                        onChange={(e) => setContactForm(prev => ({ ...prev, customerTelegram: e.target.value }))}
                        placeholder="@yourusername"
                        required
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Email Address *</label>
                    <Input
                      value={contactForm.customerEmail}
                      onChange={(e) => setContactForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                      placeholder="Your email address"
                      type="email"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Support Request Details *</label>
                    <Textarea
                      value={contactForm.message}
                      onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Please provide detailed information about your request or issue. Include any relevant order numbers, product names, or error messages..."
                      rows={5}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    Submit Support Ticket
                  </Button>
                </form>

                
              </CardContent>
            </Card>

            
          </div>
        </div>
      </div>
    </>
  );
}