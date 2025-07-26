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
  ChevronRight
} from "lucide-react";

export default function MobileWireframe() {
  const [currentScreen, setCurrentScreen] = useState<string>("storefront");

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
    storefront: {
      title: "Storefront",
      component: <StorefrontWireframe />
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

      {/* Screen Content */}
      <div className="p-4">
        {screens[currentScreen as keyof typeof screens].component}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t shadow-lg">
        <div className="flex justify-around py-2">
          {[
            { id: "storefront", icon: Home, label: "Shop" },
            { id: "inventory", icon: Package, label: "Inventory" },
            { id: "orders", icon: ShoppingCart, label: "Orders" },
            { id: "analytics", icon: BarChart3, label: "Analytics" },
            { id: "users", icon: Users, label: "Users" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentScreen(tab.id)}
              className={`flex flex-col items-center py-2 px-3 ${
                currentScreen === tab.id 
                  ? "text-primary" 
                  : "text-gray-500"
              }`}
            >
              <tab.icon className="h-5 w-5 mb-1" />
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      </div>
  );
}

function StorefrontWireframe() {
  return (
    <div className="space-y-4 pb-20">
      {/* Hero Banner */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-2">Discover Amazing Products</h2>
          <p className="text-sm opacity-90 mb-4">Shop from our curated collection</p>
          <Button size="sm" className="bg-white text-blue-600">Shop Now</Button>
        </CardContent>
      </Card>



      {/* Categories */}
      <div>
        <h3 className="font-semibold mb-3">Categories</h3>
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {["All", "Flower", "Concentrates", "Books", "Home"].map((cat) => (
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
              <div className="bg-gray-200 h-32 flex items-center justify-center">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
              <CardContent className="p-3">
                <h4 className="font-medium text-sm mb-1">Product {i}</h4>
                <p className="text-xs text-gray-500 mb-2">Category Name</p>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-primary">$99.99</span>
                  <Button size="sm">Add</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function InventoryWireframe() {
  return (
    <div className="space-y-4 pb-20">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Inventory</h2>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Low Stock Alert */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center text-orange-800">
            <div className="bg-orange-200 rounded-full p-2 mr-3">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Low Stock Alert</h3>
              <p className="text-xs">5 products need restocking</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4" />
        </Button>
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
                  <h4 className="font-medium text-sm">Product Name {i}</h4>
                  <p className="text-xs text-gray-500">SKU: PRD-00{i}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant={i === 2 ? "destructive" : i === 3 ? "secondary" : "default"} className="text-xs">
                      {i === 2 ? "Low Stock" : i === 3 ? "Out of Stock" : "In Stock"}
                    </Badge>
                    <span className="text-xs">Qty: {i === 3 ? 0 : i * 15}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
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
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Orders</h2>
        <Button variant="outline" size="sm">Export</Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Orders", value: "156", color: "bg-blue-500" },
          { label: "Pending", value: "23", color: "bg-yellow-500" },
          { label: "Shipped", value: "89", color: "bg-green-500" },
          { label: "Delivered", value: "44", color: "bg-purple-500" }
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${stat.color} mr-2`}></div>
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
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
          <option>Shipped</option>
          <option>Delivered</option>
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {[
          { id: "#ORD-001", customer: "John Doe", status: "Pending", amount: "$125.50" },
          { id: "#ORD-002", customer: "Jane Smith", status: "Shipped", amount: "$89.99" },
          { id: "#ORD-003", customer: "Bob Wilson", status: "Delivered", amount: "$234.00" },
          { id: "#ORD-004", customer: "Alice Brown", status: "Processing", amount: "$156.75" }
        ].map((order, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-sm">{order.id}</h4>
                  <p className="text-xs text-gray-500">{order.customer}</p>
                  <Badge 
                    variant={order.status === "Delivered" ? "default" : "secondary"} 
                    className="text-xs mt-1"
                  >
                    {order.status}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{order.amount}</p>
                  <ChevronRight className="h-4 w-4 text-gray-400 mt-1" />
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
    <div className="space-y-4 pb-20">
      <h2 className="text-xl font-bold">Analytics</h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Revenue", value: "$12,345", change: "+12%" },
          { label: "Orders", value: "156", change: "+8%" },
          { label: "Products", value: "89", change: "+3%" },
          { label: "Customers", value: "234", change: "+15%" }
        ].map((metric, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">{metric.label}</p>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">{metric.value}</p>
                <span className="text-xs text-green-600">{metric.change}</span>
              </div>
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
                <div className="bg-gray-200 w-8 h-8 rounded"></div>
                <div>
                  <p className="text-sm font-medium">Product {i}</p>
                  <p className="text-xs text-gray-500">{20 - i * 3} sales</p>
                </div>
              </div>
              <span className="text-sm font-bold">${(100 - i * 10)}.00</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function UsersWireframe() {
  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Users</h2>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add User
        </Button>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: "45" },
          { label: "Active", value: "38" },
          { label: "Admins", value: "3" }
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>



      {/* Users List */}
      <div className="space-y-3">
        {[
          { name: "John Admin", email: "john@example.com", role: "Admin", status: "Active" },
          { name: "Jane Manager", email: "jane@example.com", role: "Manager", status: "Active" },
          { name: "Bob Customer", email: "bob@example.com", role: "Customer", status: "Inactive" },
          { name: "Alice User", email: "alice@example.com", role: "Customer", status: "Active" }
        ].map((user, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-gray-300 w-10 h-10 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-600" />
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
                <Settings className="h-4 w-4 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}