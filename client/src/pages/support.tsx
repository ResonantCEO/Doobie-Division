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
    subject: "",
    message: "",
    priority: "normal"
  });

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const ticketData = {
        subject: contactForm.subject,
        message: contactForm.message,
        priority: contactForm.priority,
        customerName: contactForm.customerName,
        customerEmail: contactForm.customerEmail,
        customerPhone: contactForm.customerPhone,
        userId: user?.id || null
      };

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
          subject: "", 
          message: "", 
          priority: "normal" 
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
              We're here to help! Find answers to common questions or get in touch with our support team.
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <label className="text-sm font-medium mb-1 block">Phone Number *</label>
                      <Input
                        value={contactForm.customerPhone}
                        onChange={(e) => setContactForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                        placeholder="Your phone number"
                        type="tel"
                        required
                      />
                    </div>
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
                    <label className="text-sm font-medium mb-1 block">Subject *</label>
                    <Input
                      value={contactForm.subject}
                      onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Brief description of your issue"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Priority</label>
                    <div className="flex gap-2">
                      {["low", "normal", "high"].map((priority) => (
                        <Button
                          key={priority}
                          type="button"
                          variant={contactForm.priority === priority ? "default" : "outline"}
                          size="sm"
                          onClick={() => setContactForm(prev => ({ ...prev, priority }))}
                          className="capitalize"
                        >
                          {priority}
                        </Button>
                      ))}
                    </div>
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