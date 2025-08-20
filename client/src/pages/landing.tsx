import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingBag, Users, BarChart3, Package, Star, Shield, Clock, Smartphone, Truck, ArrowRight, CheckCircle, Zap, Heart, Sparkles, MessageCircle, Send } from "lucide-react";
import { AuthForms } from "@/components/auth-forms";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [supportForm, setSupportForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    message: ""
  });
  const { toast } = useToast();

  const handleLogin = () => {
    setShowAuthDialog(true);
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const ticketData = {
        subject: "Support Request",
        message: supportForm.message,
        priority: "normal",
        customerName: supportForm.customerName,
        customerEmail: supportForm.customerEmail,
        customerPhone: supportForm.customerPhone,
        userId: null
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
          title: "Support ticket submitted successfully",
          description: "We'll get back to you within 24 hours.",
        });
        setSupportForm({ 
          customerName: "", 
          customerEmail: "", 
          customerPhone: "", 
          message: ""
        });
        setShowSupportDialog(false);
      } else {
        throw new Error("Failed to submit support ticket");
      }
    } catch (error) {
      toast({
        title: "Failed to submit support ticket",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="bg-black/10 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Doobie Division
              </h1>
            </div>
            <Button
              onClick={handleLogin}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 border-0 px-6 py-2 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/25"
            >
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative py-32 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-72 h-72 bg-green-500 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-20 right-10 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <div className="mb-6">
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-sm font-medium mb-8">
                <Sparkles className="w-4 h-4 mr-2" />
                Premium Experience
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-white via-green-200 to-emerald-200 bg-clip-text text-transparent">
                Your Premium
              </span>
              <br />
              <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-green-300 bg-clip-text text-transparent">
                Shopping Experience
              </span>
              <br />
              <span className="text-white/90 text-4xl md:text-5xl">
                Awaits
              </span>
            </h1>

            <p className="text-xl md:text-2xl mb-12 text-white/70 max-w-4xl mx-auto leading-relaxed">
              Discover curated products, enjoy seamless ordering, and experience personalized service
              with our premium marketplace designed for discerning customers.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
              <Button
                onClick={handleLogin}
                size="lg"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-lg px-12 py-4 rounded-full shadow-2xl hover:shadow-green-500/25 transition-all duration-300 hover:scale-105 group"
              >
                Start Shopping
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>

              <div className="flex items-center space-x-2 text-white/80">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <span className="text-sm font-medium ml-2">Trusted by 10,000+ customers</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-300">10K+</div>
                <div className="text-sm text-white/60">Happy Customers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-300">24/7</div>
                <div className="text-sm text-white/60">Support</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-teal-300">Fast</div>
                <div className="text-sm text-white/60">Delivery</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Journey - Modern Cards */}
      <div className="py-24 bg-gradient-to-b from-transparent to-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
              Your Journey with Us
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
              Every step designed for excellence, security, and satisfaction
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: ShoppingBag,
                step: "01",
                title: "Browse & Discover",
                description: "Explore curated products with detailed info, reviews, and stunning visuals",
                color: "from-green-400 to-emerald-500"
              },
              {
                icon: Shield,
                step: "02",
                title: "Secure Checkout",
                description: "Complete purchases with confidence using encrypted processing",
                color: "from-blue-400 to-cyan-500"
              },
              {
                icon: Package,
                step: "03",
                title: "Order Processing",
                description: "Professional preparation with real-time updates and quality assurance",
                color: "from-green-400 to-violet-500"
              },
              {
                icon: Truck,
                step: "04",
                title: "Fast Delivery",
                description: "Quick, discreet delivery with real-time tracking and notifications",
                color: "from-emerald-400 to-rose-500"
              }
            ].map((item, index) => (
              <div key={index} className="group">
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 hover:scale-105 hover:bg-white/10">
                  <div className="relative mb-6">
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <item.icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-sm font-bold text-white">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-emerald-200 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-white/70 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section - Modern Bento Grid */}
      <div className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
              Why Choose Us
            </h2>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              Experience the difference with features built for modern shopping
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Optimized performance for seamless browsing and instant loading",
                gradient: "from-yellow-400 to-orange-500"
              },
              {
                icon: Shield,
                title: "Bank-Level Security",
                description: "Advanced encryption and secure processing",
                gradient: "from-blue-400 to-purple-500"
              },
              {
                icon: Heart,
                title: "Customer First",
                description: "Dedicated support team available 24/7",
                gradient: "from-pink-400 to-red-500"
              },
              {
                icon: Smartphone,
                title: "Mobile Optimized",
                description: "Perfect experience across all devices and screen sizes",
                gradient: "from-green-400 to-teal-500"
              },
              {
                icon: Clock,
                title: "Real-Time Updates",
                description: "Live inventory and order tracking",
                gradient: "from-purple-400 to-indigo-500"
              },
              {
                icon: CheckCircle,
                title: "Quality Guaranteed",
                description: "Rigorous testing and authenticity verification",
                gradient: "from-emerald-400 to-cyan-500"
              }
            ].map((feature, index) => (
              <div key={index} className="group">
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 hover:scale-105 hover:bg-white/10 h-full min-h-[280px] flex flex-col">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-emerald-200 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-white/70 leading-relaxed flex-grow">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Social Proof Section */}
      <div className="py-24 bg-gradient-to-b from-black/20 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
              Loved by Thousands
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah M.",
                text: "Amazing selection and lightning-fast delivery. The quality exceeded my expectations!",
                rating: 5,
                verified: true
              },
              {
                name: "Mike R.",
                text: "Seamless experience from start to finish. The customer service is exceptional.",
                rating: 5,
                verified: true
              },
              {
                name: "Jessica L.",
                text: "Love the mobile app and real-time tracking. Makes shopping so convenient!",
                rating: 5,
                verified: true
              }
            ].map((review, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-white/80 mb-6 leading-relaxed">"{review.text}"</p>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center text-white font-semibold mr-3">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-white font-medium">{review.name}</div>
                    <div className="text-white/50 text-sm flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified Customer
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-emerald-600/20 to-green-600/20"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
            Ready to Experience the Future?
          </h2>
          <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
            Join thousands of satisfied customers who trust Doobie Division for their premium shopping needs.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button
              onClick={handleLogin}
              size="lg"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-xl px-12 py-4 rounded-full shadow-2xl hover:shadow-green-500/25 transition-all duration-300 hover:scale-105 group"
            >
              Get Started Now
              <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>

            <div className="flex items-center text-white/60 text-sm">
              <Shield className="h-4 w-4 mr-2" />
              SSL Secured • Secure Processing • Discreet Packaging
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black/40 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <h3 className="font-bold text-2xl mb-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Doobie Division
              </h3>
              <p className="text-white/70 text-sm leading-relaxed max-w-md">
                Your trusted partner for premium products, delivered with care and discretion.
                Experience the future of online shopping.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Support</h4>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="text-white font-medium mb-2">Contact Us</h4>
                  <p className="text-gray-400 mb-3">Get in touch with our support team for any questions or assistance.</p>
                  <Button 
                    size="sm"
                    onClick={() => setShowSupportDialog(true)}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white transition-all duration-300 hover:scale-105"
                    data-testid="button-support-contact"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Submit Support Ticket
                  </Button>
                </div>
                <div className="text-xs text-gray-500">
                  <p>• Name, phone, email & details required</p>
                  <p>• 24/7 support available</p>
                  <p>• Response within 24 hours</p>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 text-center text-white/50 text-sm">
            <p>&copy; 2024 Doobie Division. All rights reserved. | Must be 18+ to purchase.</p>
          </div>
        </div>
      </footer>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="bg-slate-900 border-white/20">
          <DialogHeader>
            <DialogTitle className="text-white">Join Doobie Division</DialogTitle>
          </DialogHeader>
          <AuthForms onSuccess={() => setShowAuthDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* Support Ticket Dialog */}
      <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
        <DialogContent className="bg-slate-900 border-white/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <MessageCircle className="h-5 w-5 mr-2 text-green-400" />
              Submit Support Ticket
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSupportSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Full Name *</label>
              <Input
                value={supportForm.customerName}
                onChange={(e) => setSupportForm(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="Your full name"
                required
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                data-testid="input-support-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Phone Number *</label>
              <Input
                value={supportForm.customerPhone}
                onChange={(e) => setSupportForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                placeholder="Your phone number"
                type="tel"
                required
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                data-testid="input-support-phone"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Email Address *</label>
              <Input
                value={supportForm.customerEmail}
                onChange={(e) => setSupportForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                placeholder="Your email address"
                type="email"
                required
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                data-testid="input-support-email"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Support Request Details *</label>
              <Textarea
                value={supportForm.message}
                onChange={(e) => setSupportForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Please describe your question or issue in detail..."
                rows={4}
                required
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                data-testid="textarea-support-details"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSupportDialog(false)}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                data-testid="button-support-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                data-testid="button-support-submit"
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Ticket
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}