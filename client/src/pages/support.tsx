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

          {/* Support Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center mb-4">
                  <Clock className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-600">24/7</div>
                <div className="text-sm text-muted-foreground">Support Available</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-600">&lt; 2 hrs</div>
                <div className="text-sm text-muted-foreground">Average Response</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center mb-4">
                  <Star className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="text-2xl font-bold text-yellow-600">4.9/5</div>
                <div className="text-sm text-muted-foreground">Customer Rating</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
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

                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-semibold mb-3">Alternative Contact Methods</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2" />
                      <span>Email: support@doobie-division.com</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2" />
                      <span>Phone: 1-800-DOOBIE-1 (1-800-366-2431)</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>Response Time: Usually within 24 hours</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Support Topics */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Help Topics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4">
                    {supportTopics.map((topic, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <topic.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{topic.title}</h4>
                          <p className="text-sm text-muted-foreground">{topic.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Order Status Guide */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Status Guide</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary">Pending</Badge>
                      <span className="text-sm">Order received, awaiting processing</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className="bg-blue-100 text-blue-800">Processing</Badge>
                      <span className="text-sm">Order is being prepared</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className="bg-yellow-100 text-yellow-800">Shipped</Badge>
                      <span className="text-sm">Order has been dispatched</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className="bg-green-100 text-green-800">Delivered</Badge>
                      <span className="text-sm">Order successfully delivered</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}