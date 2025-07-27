import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Home, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Users, 
  Menu, 
  Bell, 
  User,
  Plus,
  Filter,
  Settings,
  ChevronRight,
  Shield,
  LogOut,
  Search,
  Edit,
  Trash2,
  Upload,
  Camera,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Star,
  Heart,
  MessageSquare,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle
} from "lucide-react";

export default function MobileWireframe() {
  const [currentScreen, setCurrentScreen] = useState<string>("landing");

  useEffect(() => {
    const handleScreenChange = (event: CustomEvent) => {
      setCurrentScreen(event.detail);
    };

    window.addEventListener('screenChange', handleScreenChange as EventListener);
    return () => {
      window.removeEventListener('screenChange', handleScreenChange as EventListener);
    };
  }, []);

  const screens = {
    landing: {
      title: "Landing",
      component: <LandingWireframe />
    },
    dashboard: {
      title: "Dashboard",
      component: <DashboardWireframe />
    },
    storefront: {
      title: "Storefront",
      component: <StorefrontWireframe />
    },
    cart: {
      title: "Cart",
      component: <CartWireframe />
    },
    orderConfirmation: {
      title: "Order Confirm",
      component: <OrderConfirmationWireframe />
    },
    inventory: {
      title: "Inventory",
      component: <InventoryWireframe />
    },
    orders: {
      title: "Orders", 
      component: <OrdersWireframe />
    },
    analytics: {
      title: "Analytics",
      component: <AnalyticsWireframe />
    },
    users: {
      title: "Users",
      component: <UsersWireframe />
    },
    profile: {
      title: "Profile",
      component: <ProfileWireframe />
    },
    admin: {
      title: "Admin",
      component: <AdminWireframe />
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gray-100 min-h-screen">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Menu className="h-6 w-6 text-gray-600" />
            <h1 className="text-lg font-bold text-primary">Doobie Division</h1>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Bell className="h-6 w-6 text-gray-600" />
              <Badge className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 text-xs bg-red-500">
                3
              </Badge>
            </div>
            <div className="relative">
              <ShoppingCart className="h-6 w-6 text-gray-600" />
              <Badge className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 text-xs bg-red-500">
                2
              </Badge>
            </div>
            <User className="h-6 w-6 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Screen Selector */}
      <div className="bg-white border-b p-2">
        <div className="flex space-x-1 overflow-x-auto pb-2">
          {Object.keys(screens).map((screenId) => (
            <Button
              key={screenId}
              variant={currentScreen === screenId ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentScreen(screenId)}
              className="whitespace-nowrap text-xs"
            >
              {screens[screenId as keyof typeof screens].title}
            </Button>
          ))}
        </div>
      </div>

      {/* Screen Content */}
      <div className="p-4">
        {screens[currentScreen as keyof typeof screens].component}
      </div>

    </div>
  );
}

function CartWireframe() {
  return (
    <div className="space-y-4 pb-24">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Shopping Cart</h2>
        <Button variant="outline" size="sm">
          <Trash2 className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Cart Items */}
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <div className="flex items-start space-x-3">
                <div className="bg-gray-200 w-12 h-12 rounded flex items-center justify-center flex-shrink-0">
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm leading-tight">Premium Product {i}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Category Name</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-primary">${(99.99 + i * 10).toFixed(2)}</span>
                    <Badge variant="outline" className="text-xs">In Stock</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="flex items-center border rounded overflow-hidden">
                  <Button variant="ghost" size="sm" className="px-3 py-1 h-8 text-xs">-</Button>
                  <span className="px-3 py-1 text-sm border-x bg-gray-50 min-w-[2rem] text-center">{i}</span>
                  <Button variant="ghost" size="sm" className="px-3 py-1 h-8 text-xs">+</Button>
                </div>
                <Button variant="ghost" size="sm" className="p-2">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Promo Code */}
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-2">
            <input 
              type="text" 
              placeholder="Promo code" 
              className="flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Button variant="outline" size="sm" className="px-4">Apply</Button>
          </div>
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal (3 items)</span>
            <span>$219.98</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Shipping</span>
            <span>$9.99</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Tax</span>
            <span>$18.40</span>
          </div>
          <div className="border-t pt-2 mt-3 flex justify-between font-bold">
            <span>Total</span>
            <span>$248.37</span>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Address */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Shipping Address
            <Edit className="h-4 w-4 text-gray-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm space-y-0.5">
            <p className="font-medium">John Doe</p>
            <p className="text-gray-600">123 Main Street</p>
            <p className="text-gray-600">City, ST 12345</p>
            <p className="text-gray-600">United States</p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Payment Method
            <Edit className="h-4 w-4 text-gray-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center space-x-3">
            <div className="bg-gray-200 w-10 h-6 rounded flex items-center justify-center">
              <span className="text-xs font-bold text-gray-600">••••</span>
            </div>
            <div className="text-sm">
              <p className="font-medium">•••• •••• •••• 1234</p>
              <p className="text-gray-500 text-xs">Expires 12/25</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checkout Button */}
      <div className="sticky bottom-4 left-0 right-0 px-4">
        <Button 
          className="w-full shadow-lg" 
          size="lg"
          onClick={() => setCurrentScreen('orderConfirmation')}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Checkout - $248.37
        </Button>
      </div>
    </div>
  );
}

function OrderConfirmationWireframe() {
  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center py-8">
        <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-green-800 mb-2">Order Confirmed!</h2>
        <p className="text-gray-600 text-sm">Thank you for your purchase</p>
      </div>

      {/* Order Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Order Number</span>
            <span className="font-mono">#ORD-12345</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Order Date</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Amount</span>
            <span className="font-bold">$248.37</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Payment Method</span>
            <span>•••• 1234</span>
          </div>
        </CardContent>
      </Card>

      {/* Estimated Delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estimated Delivery</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">3-5 Business Days</p>
              <p className="text-sm text-gray-600">Expected by {new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shipping To</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start space-x-3">
            <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">John Doe</p>
              <p className="text-gray-600">123 Main Street</p>
              <p className="text-gray-600">City, ST 12345</p>
              <p className="text-gray-600">United States</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items Ordered</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="bg-gray-200 w-12 h-12 rounded flex items-center justify-center">
                <Package className="h-5 w-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm">Premium Product {i}</h4>
                <p className="text-xs text-gray-500">Qty: {i} • ${(99.99 + i * 10).toFixed(2)} each</p>
              </div>
              <span className="text-sm font-bold">${((99.99 + i * 10) * i).toFixed(2)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What's Next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-3">
            <Bell className="h-4 w-4 text-primary" />
            <p className="text-sm">You'll receive email updates about your order</p>
          </div>
          <div className="flex items-center space-x-3">
            <Package className="h-4 w-4 text-primary" />
            <p className="text-sm">Track your package in the Orders section</p>
          </div>
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-4 w-4 text-primary" />
            <p className="text-sm">Contact support if you have questions</p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button 
          className="w-full" 
          onClick={() => setCurrentScreen('orders')}
        >
          <Package className="h-4 w-4 mr-2" />
          Track Order
        </Button>
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => setCurrentScreen('storefront')}
        >
          Continue Shopping
        </Button>
      </div>
    </div>
  );
}

function LandingWireframe() {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="bg-gradient-to-r from-green-500 to-blue-600 text-white">
        <CardContent className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome to Doobie Division</h1>
          <p className="text-sm opacity-90 mb-6">Your premier cannabis marketplace</p>
          <div className="space-y-3">
            <Button className="w-full bg-white text-green-600">Sign Up with Replit</Button>
            <Button variant="outline" className="w-full border-white text-white">Learn More</Button>
          </div>
        </CardContent>
      </Card>

      
    </div>
  );
}

function DashboardWireframe() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Today's Sales", value: "$1,234", icon: BarChart3 },
          { label: "New Orders", value: "12", icon: ShoppingCart },
          { label: "Low Stock", value: "5", icon: AlertTriangle },
          { label: "Active Users", value: "45", icon: Users }
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
                <stat.icon className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { icon: Plus, label: "Add Product", action: "inventory" },
            { icon: Users, label: "Manage Users", action: "users" },
            { icon: BarChart3, label: "View Analytics", action: "analytics" },
            { icon: Settings, label: "Settings", action: "profile" }
          ].map((action, i) => (
            <Button
              key={i}
              variant="outline"
              className="w-full justify-start"
              onClick={() => setCurrentScreen(action.action)}
            >
              <action.icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { icon: ShoppingCart, text: "New order #ORD-001", time: "2 min ago" },
            { icon: Package, text: "Product restocked", time: "5 min ago" },
            { icon: Users, text: "New user registered", time: "10 min ago" }
          ].map((activity, i) => (
            <div key={i} className="flex items-center space-x-3">
              <activity.icon className="h-4 w-4 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm">{activity.text}</p>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileWireframe() {
  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-6 text-center">
          <div className="relative inline-block mb-4">
            <div className="bg-gray-300 w-20 h-20 rounded-full flex items-center justify-center">
              <User className="h-10 w-10 text-gray-600" />
            </div>
            <Button size="sm" className="absolute -bottom-2 -right-2 rounded-full p-2">
              <Camera className="h-3 w-3" />
            </Button>
          </div>
          <h3 className="font-semibold">John Doe</h3>
          <p className="text-sm text-gray-500">john.doe@example.com</p>
          <Badge className="mt-2">Manager</Badge>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Personal Information
            <Edit className="h-4 w-4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { icon: User, label: "Full Name", value: "John Doe" },
            { icon: Mail, label: "Email", value: "john.doe@example.com" },
            { icon: Phone, label: "Phone", value: "+1 (555) 123-4567" },
            { icon: MapPin, label: "Address", value: "123 Main St, City, ST" },
            { icon: Calendar, label: "Join Date", value: "Jan 15, 2024" }
          ].map((field, i) => (
            <div key={i} className="flex items-center space-x-3">
              <field.icon className="h-4 w-4 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">{field.label}</p>
                <p className="text-sm">{field.value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ID Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ID Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Verified</p>
                <p className="text-xs text-gray-500">ID document approved</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" />
              Update
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { icon: Bell, label: "Notifications", hasToggle: true },
            { icon: Shield, label: "Privacy Settings" },
            { icon: Download, label: "Export Data" },
            { icon: LogOut, label: "Sign Out", isDestructive: true }
          ].map((setting, i) => (
            <div key={i} className="flex items-center justify-between p-2">
              <div className="flex items-center space-x-3">
                <setting.icon className={`h-4 w-4 ${setting.isDestructive ? 'text-red-500' : 'text-gray-400'}`} />
                <span className={`text-sm ${setting.isDestructive ? 'text-red-500' : ''}`}>
                  {setting.label}
                </span>
              </div>
              {setting.hasToggle ? (
                <div className="w-8 h-4 bg-primary rounded-full relative">
                  <div className="w-3 h-3 bg-white rounded-full absolute top-0.5 right-0.5"></div>
                </div>
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminWireframe() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Admin Panel</h2>
        <Badge variant="destructive">Admin Only</Badge>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Users", value: "245", icon: Users },
          { label: "System Health", value: "Good", icon: CheckCircle },
          { label: "DB Size", value: "2.3GB", icon: Package },
          { label: "Active Sessions", value: "38", icon: Clock }
        ].map((metric, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{metric.label}</p>
                  <p className="text-lg font-bold">{metric.value}</p>
                </div>
                <metric.icon className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Admin Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { icon: Users, label: "User Management", desc: "Manage user roles and permissions" },
            { icon: Package, label: "Category Management", desc: "Add/edit product categories" },
            { icon: Settings, label: "System Settings", desc: "Configure application settings" },
            { icon: Download, label: "Backup Data", desc: "Export system backup" }
          ].map((action, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center space-x-3">
                <action.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-gray-500">{action.desc}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Admin Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Admin Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { action: "User role updated", user: "jane.smith", time: "5 min ago" },
            { action: "Category created", user: "admin", time: "15 min ago" },
            { action: "System backup", user: "system", time: "1 hour ago" }
          ].map((log, i) => (
            <div key={i} className="border-l-2 border-primary pl-3">
              <p className="text-sm font-medium">{log.action}</p>
              <p className="text-xs text-gray-500">by {log.user} • {log.time}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full border-red-200 text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Sessions
          </Button>
          <Button variant="outline" className="w-full border-red-200 text-red-600">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset System
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StorefrontWireframe() {
  return (
    <div className="space-y-4">
      {/* Hero Banner */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-2">Discover Amazing Products</h2>
          <p className="text-sm opacity-90 mb-4">Shop from our curated collection</p>
          <Button size="sm" className="bg-white text-blue-600">Shop Now</Button>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input 
          type="text" 
          placeholder="Search products..." 
          className="w-full pl-10 pr-4 py-2 border rounded-lg"
        />
      </div>

      {/* Categories */}
      <div>
        <h3 className="font-semibold mb-3">Categories</h3>
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {["All", "Flower", "Concentrates", "Edibles", "Accessories"].map((cat) => (
            <Button key={cat} variant="outline" size="sm" className="whitespace-nowrap">
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div>
        <h3 className="font-semibold mb-3">Featured Products</h3>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="bg-gray-200 h-32 flex items-center justify-center relative">
                <Package className="h-8 w-8 text-gray-400" />
                <Heart className="absolute top-2 right-2 h-4 w-4 text-gray-400" />
              </div>
              <CardContent className="p-3">
                <h4 className="font-medium text-sm mb-1">Premium Product {i}</h4>
                <p className="text-xs text-gray-500 mb-2">Category Name</p>
                <div className="flex items-center mb-2">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className={`h-3 w-3 ${j < 4 ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                  ))}
                  <span className="text-xs text-gray-500 ml-1">(4.0)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-primary">${(99.99 + i * 10).toFixed(2)}</span>
                  <Button size="sm">Add</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Cart Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <span className="font-medium">Cart (2 items)</span>
            </div>
            <Button size="sm">View Cart</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryWireframe() {
  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Inventory</h2>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search inventory..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Low Stock Alert */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center text-orange-800">
            <div className="bg-orange-200 rounded-full p-2 mr-3">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Low Stock Alert</h3>
              <p className="text-xs">5 products need restocking</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Overview */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total Products", value: "156" },
          { label: "In Stock", value: "142" },
          { label: "Low Stock", value: "14" }
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Product List */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="bg-gray-200 w-12 h-12 rounded flex items-center justify-center">
                  <Package className="h-6 w-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">Premium Product {i}</h4>
                  <p className="text-xs text-gray-500">SKU: PRD-00{i}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant={i === 2 ? "destructive" : i === 3 ? "secondary" : "default"} className="text-xs">
                      {i === 2 ? "Low Stock" : i === 3 ? "Out of Stock" : "In Stock"}
                    </Badge>
                    <span className="text-xs">Qty: {i === 3 ? 0 : i * 15}</span>
                    <span className="text-xs text-gray-500">${(99.99 + i * 10).toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button variant="outline" size="sm">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OrdersWireframe() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Orders</h2>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Orders", value: "156", color: "bg-blue-500", icon: ShoppingCart },
          { label: "Pending", value: "23", color: "bg-yellow-500", icon: Clock },
          { label: "Shipped", value: "89", color: "bg-green-500", icon: CheckCircle },
          { label: "Delivered", value: "44", color: "bg-purple-500", icon: Package }
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-full ${stat.color}`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex space-x-2">
        <select className="flex-1 px-3 py-2 border rounded-lg text-sm">
          <option>All Orders</option>
          <option>Pending</option>
          <option>Processing</option>
          <option>Shipped</option>
          <option>Delivered</option>
          <option>Cancelled</option>
        </select>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {[
          { id: "#ORD-001", customer: "John Doe", status: "Pending", amount: "$125.50", items: 3 },
          { id: "#ORD-002", customer: "Jane Smith", status: "Shipped", amount: "$89.99", items: 2 },
          { id: "#ORD-003", customer: "Bob Wilson", status: "Delivered", amount: "$234.00", items: 5 },
          { id: "#ORD-004", customer: "Alice Brown", status: "Processing", amount: "$156.75", items: 1 }
        ].map((order, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-sm">{order.id}</h4>
                  <p className="text-xs text-gray-500">{order.customer}</p>
                  <p className="text-xs text-gray-500">{order.items} items</p>
                  <Badge 
                    variant={
                      order.status === "Delivered" ? "default" : 
                      order.status === "Pending" ? "secondary" :
                      order.status === "Shipped" ? "outline" : "secondary"
                    } 
                    className="text-xs mt-1"
                  >
                    {order.status}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{order.amount}</p>
                  <div className="flex items-center space-x-1 mt-2">
                    <Button variant="outline" size="sm">
                      <MessageSquare className="h-3 w-3" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AnalyticsWireframe() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Analytics</h2>
        <select className="px-3 py-1 border rounded text-sm">
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>Last 3 months</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Revenue", value: "$12,345", change: "+12%", icon: BarChart3 },
          { label: "Orders", value: "156", change: "+8%", icon: ShoppingCart },
          { label: "Products", value: "89", change: "+3%", icon: Package },
          { label: "Customers", value: "234", change: "+15%", icon: Users }
        ].map((metric, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <metric.icon className="h-5 w-5 text-primary" />
                <span className="text-xs text-green-600">{metric.change}</span>
              </div>
              <p className="text-xs text-gray-500">{metric.label}</p>
              <p className="text-lg font-bold">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 h-32 rounded flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-gray-400" />
            <span className="ml-2 text-gray-500">Chart View</span>
          </div>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-gray-200 w-8 h-8 rounded flex items-center justify-center">
                  <Package className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Premium Product {i}</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-gray-500">{20 - i * 3} sales</p>
                    <span className="text-xs text-green-600">+{i * 2}%</span>
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold">${(100 - i * 10)}.00</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Customer Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm">New Customers</span>
            <span className="text-sm font-bold">23</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Repeat Customers</span>
            <span className="text-sm font-bold">67%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Avg. Order Value</span>
            <span className="text-sm font-bold">$89.50</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersWireframe() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Users</h2>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add User
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search users..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>
        <select className="px-3 py-2 border rounded-lg text-sm">
          <option>All Roles</option>
          <option>Admin</option>
          <option>Manager</option>
          <option>Customer</option>
        </select>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: "245", color: "bg-blue-500" },
          { label: "Active", value: "198", color: "bg-green-500" },
          { label: "Admins", value: "3", color: "bg-purple-500" }
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-3 text-center">
              <div className={`w-3 h-3 rounded-full ${stat.color} mx-auto mb-1`}></div>
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {[
          { name: "John Admin", email: "john@example.com", role: "Admin", status: "Active", verified: true },
          { name: "Jane Manager", email: "jane@example.com", role: "Manager", status: "Active", verified: true },
          { name: "Bob Customer", email: "bob@example.com", role: "Customer", status: "Inactive", verified: false },
          { name: "Alice User", email: "alice@example.com", role: "Customer", status: "Active", verified: true }
        ].map((user, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="bg-gray-300 w-10 h-10 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-600" />
                    </div>
                    {user.verified && (
                      <CheckCircle className="absolute -bottom-1 -right-1 h-4 w-4 text-green-500 bg-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{user.name}</h4>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    <div className="flex space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">{user.role}</Badge>
                      <Badge 
                        variant={user.status === "Active" ? "default" : "secondary"} 
                        className="text-xs"
                      >
                        {user.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button variant="outline" size="sm">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                  <Settings className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}