
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, Users, BarChart3, Package, Star, Shield, Clock, Smartphone, CreditCard, Truck } from "lucide-react";
import { AuthForms } from "@/components/auth-forms";

export default function Landing() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const handleLogin = () => {
    setShowAuthDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation */}
      <nav className="bg-background shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-primary">Doobie Division</h1>
            </div>
            <Button onClick={handleLogin} className="bg-primary hover:bg-primary/90">
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="hero-gradient text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Your Premium Shopping Experience Awaits
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100 dark:text-gray-300 max-w-4xl mx-auto">
              Discover curated products, enjoy seamless ordering, and experience personalized service 
              with our premium marketplace designed for discerning customers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                onClick={handleLogin}
                size="lg"
                className="bg-white dark:bg-gray-800 text-primary dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 text-lg px-8 py-3"
              >
                Start Shopping
              </Button>
              <div className="flex items-center text-blue-100">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400 mr-1" />
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400 mr-1" />
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400 mr-1" />
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400 mr-1" />
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400 mr-3" />
                <span className="text-sm">Trusted by 10,000+ customers</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Experience Journey */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Your Journey with Doobie Division
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From browsing to delivery, we've crafted every step of your experience to be smooth, 
              secure, and satisfying. Here's what makes shopping with us special.
            </p>
          </div>

          {/* Customer Journey Steps */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 relative">
                <ShoppingBag className="h-8 w-8 text-green-600" />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Browse & Discover</h3>
              <p className="text-gray-600 text-sm">
                Explore our curated selection of premium products with detailed descriptions, 
                reviews, and high-quality images to help you make informed choices.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 relative">
                <Shield className="h-8 w-8 text-blue-600" />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure Checkout</h3>
              <p className="text-gray-600 text-sm">
                Complete your purchase with confidence using our encrypted checkout process. 
                Secure processing and data protection ensure a safe transaction experience.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 relative">
                <Package className="h-8 w-8 text-purple-600" />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Order Processing</h3>
              <p className="text-gray-600 text-sm">
                Our team carefully prepares your order with attention to quality and discretion. 
                Real-time updates keep you informed every step of the way.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 relative">
                <Truck className="h-8 w-8 text-orange-600" />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Fast Delivery</h3>
              <p className="text-gray-600 text-sm">
                Enjoy quick, discreet delivery to your door. Track your package in real-time 
                and receive notifications when your order is on its way.
              </p>
            </div>
          </div>

          {/* Customer Benefits */}
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-6 hover:shadow-lg transition-shadow border-2 border-green-200">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-xl text-green-700">Premium Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Rigorously tested products from trusted suppliers. Every item meets our strict quality 
                  standards for authenticity, excellence, and safety.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow border-2 border-blue-200">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Smartphone className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl text-blue-700">Easy Mobile Experience</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Shop anywhere, anytime with our mobile-optimized platform. Intuitive design 
                  makes browsing and ordering effortless on any device.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow border-2 border-purple-200">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl text-purple-700">Fast & Reliable</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Quick processing times and reliable delivery. Most orders ship within 24 hours 
                  with tracking information provided immediately.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* What Customers Love */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              What Our Customers Love Most
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Here's what sets us apart and keeps customers coming back for more.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Star className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Product Variety</h3>
                  <p className="text-gray-600 text-sm">
                    "Amazing selection! From electronics to home goods to specialty items - they have everything 
                    I need with detailed product information."
                  </p>
                  <p className="text-xs text-gray-500 mt-2">- Sarah M., verified customer</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Quick Delivery</h3>
                  <p className="text-gray-600 text-sm">
                    "Ordered Monday, received Wednesday. Package was discreet and products were 
                    exactly as described. Will definitely order again!"
                  </p>
                  <p className="text-xs text-gray-500 mt-2">- Mike R., verified customer</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Customer Service</h3>
                  <p className="text-gray-600 text-sm">
                    "Had a question about specifications and got helpful advice immediately. The team 
                    really knows their products and cares about customers."
                  </p>
                  <p className="text-xs text-gray-500 mt-2">- Jessica L., verified customer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features for Customers */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Features Designed for You
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Every feature we build is focused on making your shopping experience 
              better, safer, and more convenient.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Smart Search</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Find exactly what you're looking for with intelligent filters by category, brand, 
                  features, and price range.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Package className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle className="text-xl">Real-time Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Never worry about out-of-stock surprises. See live inventory levels and get 
                  notifications when favorites are back.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Truck className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl">Order Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Follow your order from confirmation to delivery with detailed tracking and 
                  proactive notifications.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle className="text-xl">Personal Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  View your order history, track spending, save favorites, and manage your 
                  preferences in one place.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Elevate Your Shopping Experience?
          </h2>
          <p className="text-xl text-green-100 mb-8">
            Join thousands of satisfied customers who trust Doobie Division for their premium 
            shopping needs. Start your journey today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="bg-white text-green-600 hover:bg-gray-100 text-lg px-8 py-3"
            >
              Create Your Account
            </Button>
            <div className="flex items-center text-green-100 text-sm">
              <Shield className="h-4 w-4 mr-2" />
              SSL Secured • Secure Processing • Discreet Packaging
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4 text-primary">Doobie Division</h3>
              <p className="text-gray-600 text-sm">
                Your trusted partner for premium products, delivered with care and discretion.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Customer Care</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>Order Support</li>
                <li>Product Questions</li>
                <li>Return Policy</li>
                <li>FAQ</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Products</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>Electronics</li>
                <li>Home & Garden</li>
                <li>Specialty Items</li>
                <li>Accessories</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>About Us</li>
                <li>Quality Promise</li>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-gray-600">
            <p>&copy; 2024 Doobie Division. All rights reserved. | Must be 18+ to purchase.</p>
          </div>
        </div>
      </footer>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Doobie Division</DialogTitle>
          </DialogHeader>
          <AuthForms onSuccess={() => setShowAuthDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
