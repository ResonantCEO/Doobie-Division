

import MobileWireframe from "@/components/mobile-wireframe";
import { useState, useEffect } from "react";

const screenDetails = {
  landing: {
    name: "Landing Page",
    color: "blue",
    details: [
      "Welcome hero section with gradient background",
      "Sign up and sign in authentication buttons", 
      "Clean, minimal design for first impressions",
      "Entry point to the application"
    ]
  },
  dashboard: {
    name: "Dashboard",
    color: "green", 
    details: [
      "Quick stats overview (sales, orders, stock alerts)",
      "Recent activity feed with real-time updates",
      "Quick action buttons for common tasks",
      "Main navigation hub for all app features"
    ]
  },
  storefront: {
    name: "Storefront",
    color: "purple",
    details: [
      "Product browsing with search and filtering",
      "Category navigation and featured products",
      "Product cards with pricing",
      "Shopping cart integration and quick add"
    ]
  },
  cart: {
    name: "Shopping Cart",
    color: "cyan",
    details: [
      "Item quantity adjustment and removal",
      "Promo code application system",
      "Order summary with tax and shipping",
      "Shipping address and payment method setup"
    ]
  },
  orderConfirmation: {
    name: "Order Confirmation",
    color: "emerald",
    details: [
      "Success confirmation with order details",
      "Estimated delivery information",
      "Order tracking and next steps guide",
      "Continue shopping and support options"
    ]
  },
  inventory: {
    name: "Inventory Management",
    color: "orange",
    details: [
      "Product listing with stock levels",
      "Low stock alerts and notifications", 
      "Add/edit product functionality",
      "Search, filter, and export capabilities"
    ]
  },
  orders: {
    name: "Order Management",
    color: "red",
    details: [
      "Order status tracking and updates",
      "Customer communication tools",
      "Order filtering and search",
      "Fulfillment workflow management"
    ]
  },
  analytics: {
    name: "Analytics Dashboard",
    color: "indigo",
    details: [
      "Sales metrics and revenue tracking",
      "Top products and customer insights",
      "Interactive charts and trend analysis",
      "Customizable date range filtering"
    ]
  },
  users: {
    name: "User Management",
    color: "yellow",
    details: [
      "User listing with role assignments",
      "Account verification and status management",
      "Search and filter user accounts",
      "Role-based permissions control"
    ]
  },
  profile: {
    name: "User Profile",
    color: "gray",
    details: [
      "Personal information management",
      "ID verification with document upload",
      "Notification and privacy settings",
      "Account security and export options"
    ]
  },
  admin: {
    name: "Admin Panel",
    color: "red",
    details: [
      "System health monitoring and metrics",
      "User role and permission management",
      "Category and system configuration",
      "Database backup and maintenance tools"
    ]
  }
};

export default function WireframePage() {
  const [currentScreen, setCurrentScreen] = useState("landing");

  useEffect(() => {
    const updateScreenDetails = () => {
      const detailsContainer = document.getElementById('screen-details');
      if (detailsContainer && screenDetails[currentScreen as keyof typeof screenDetails]) {
        const screen = screenDetails[currentScreen as keyof typeof screenDetails];
        detailsContainer.innerHTML = `
          <ul class="space-y-3 text-gray-600 text-sm">
            ${screen.details.map(detail => `
              <li class="flex items-center">
                <span class="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                ${detail}
              </li>
            `).join('')}
          </ul>
        `;
      }
    };

    updateScreenDetails();

    const handleScreenChange = (event: CustomEvent) => {
      setCurrentScreen(event.detail);
    };

    window.addEventListener('screenChange', handleScreenChange as EventListener);
    return () => {
      window.removeEventListener('screenChange', handleScreenChange as EventListener);
    };
  }, [currentScreen]);
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Doobie Division Mobile Wireframe</h1>
          <p className="text-gray-600">Interactive mobile view of the complete e-commerce and inventory management system</p>
        </div>
        
        <div className="flex justify-center gap-12 items-start">
          <div className="relative">
            {/* Phone Frame - Normal Size */}
            <div className="bg-black rounded-[2rem] p-2 shadow-2xl">
              <div className="bg-white rounded-[1.5rem] overflow-hidden w-72 h-[640px]">
                <MobileWireframe />
              </div>
            </div>
          </div>
          
          {/* Controls and Info Panel */}
          <div className="space-y-6">
            {/* Available Screens */}
            <div className="bg-white p-6 rounded-lg shadow-lg w-80">
              <h3 className="font-bold text-lg mb-4">Available Screens</h3>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div 
                    className="p-2 bg-blue-50 rounded border cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => {
                      setCurrentScreen('landing');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'landing' }));
                    }}
                  >
                    <div className="font-medium text-blue-800">Landing</div>
                    <div className="text-xs text-blue-600">Welcome & Auth</div>
                  </div>
                  <div 
                    className="p-2 bg-green-50 rounded border cursor-pointer hover:bg-green-100 transition-colors"
                    onClick={() => {
                      setCurrentScreen('dashboard');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'dashboard' }));
                    }}
                  >
                    <div className="font-medium text-green-800">Dashboard</div>
                    <div className="text-xs text-green-600">Main Overview</div>
                  </div>
                  <div 
                    className="p-2 bg-purple-50 rounded border cursor-pointer hover:bg-purple-100 transition-colors"
                    onClick={() => {
                      setCurrentScreen('storefront');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'storefront' }));
                    }}
                  >
                    <div className="font-medium text-purple-800">Storefront</div>
                    <div className="text-xs text-purple-600">Product Browse</div>
                  </div>
                  <div 
                    className="p-2 bg-cyan-50 rounded border cursor-pointer hover:bg-cyan-100 transition-colors"
                    onClick={() => {
                      setCurrentScreen('cart');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'cart' }));
                    }}
                  >
                    <div className="font-medium text-cyan-800">Cart</div>
                    <div className="text-xs text-cyan-600">Shopping Cart</div>
                  </div>
                  <div 
                    className="p-2 bg-emerald-50 rounded border cursor-pointer hover:bg-emerald-100 transition-colors"
                    onClick={() => {
                      setCurrentScreen('orderConfirmation');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'orderConfirmation' }));
                    }}
                  >
                    <div className="font-medium text-emerald-800">Order Confirm</div>
                    <div className="text-xs text-emerald-600">Order Success</div>
                  </div>
                  <div 
                    className="p-2 bg-orange-50 rounded border cursor-pointer hover:bg-orange-100 transition-colors"
                    onClick={() => {
                      setCurrentScreen('inventory');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'inventory' }));
                    }}
                  >
                    <div className="font-medium text-orange-800">Inventory</div>
                    <div className="text-xs text-orange-600">Stock Management</div>
                  </div>
                  <div 
                    className="p-2 bg-red-50 rounded border cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => {
                      setCurrentScreen('orders');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'orders' }));
                    }}
                  >
                    <div className="font-medium text-red-800">Orders</div>
                    <div className="text-xs text-red-600">Order Tracking</div>
                  </div>
                  <div 
                    className="p-2 bg-indigo-50 rounded border cursor-pointer hover:bg-indigo-100 transition-colors"
                    onClick={() => {
                      setCurrentScreen('analytics');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'analytics' }));
                    }}
                  >
                    <div className="font-medium text-indigo-800">Analytics</div>
                    <div className="text-xs text-indigo-600">Business Insights</div>
                  </div>
                  <div 
                    className="p-2 bg-yellow-50 rounded border cursor-pointer hover:bg-yellow-100 transition-colors"
                    onClick={() => {
                      setCurrentScreen('users');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'users' }));
                    }}
                  >
                    <div className="font-medium text-yellow-800">Users</div>
                    <div className="text-xs text-yellow-600">User Management</div>
                  </div>
                  <div 
                    className="p-2 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      setCurrentScreen('profile');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'profile' }));
                    }}
                  >
                    <div className="font-medium text-gray-800">Profile</div>
                    <div className="text-xs text-gray-600">User Settings</div>
                  </div>
                  <div 
                    className="p-2 bg-red-100 rounded border border-red-200 cursor-pointer hover:bg-red-200 transition-colors"
                    onClick={() => {
                      setCurrentScreen('admin');
                      window.dispatchEvent(new CustomEvent('screenChange', { detail: 'admin' }));
                    }}
                  >
                    <div className="font-medium text-red-800">Admin</div>
                    <div className="text-xs text-red-600">System Admin</div>
                  </div>
                </div>
              </div>
            </div>

            {/* App Features */}
            <div className="bg-white p-6 rounded-lg shadow-lg w-80">
              <h3 className="font-bold text-lg mb-4">Core Features</h3>
              <ul className="space-y-3 text-gray-600 text-sm">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  E-commerce storefront with search & categories
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Real-time inventory management
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Order processing & tracking
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Analytics dashboard with metrics
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  User management & roles
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Profile management with ID verification
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Admin panel for system management
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Real-time notifications
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Mobile-first responsive design
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Role-based access control
                </li>
              </ul>
            </div>

            {/* Screen Details */}
            <div className="bg-white p-6 rounded-lg shadow-lg w-80">
              <h3 className="font-bold text-lg mb-4">{screenDetails[currentScreen as keyof typeof screenDetails]?.name || 'Selected Screen Details'}</h3>
              <div id="screen-details">
                <ul className="space-y-3 text-gray-600 text-sm">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    Welcome hero section with gradient background
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    Sign up and sign in authentication buttons
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    Clean, minimal design for first impressions
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    Entry point to the application
                  </li>
                </ul>
              </div>
            </div>

            {/* User Flows */}
            <div className="bg-white p-6 rounded-lg shadow-lg w-80">
              <h3 className="font-bold text-lg mb-4">Key User Flows</h3>
              <div className="space-y-4 text-sm">
                <div className="border-l-4 border-blue-500 pl-3">
                  <div className="font-medium">Customer Journey</div>
                  <div className="text-gray-600">Landing → Storefront → Cart → Order Confirmation</div>
                </div>
                <div className="border-l-4 border-green-500 pl-3">
                  <div className="font-medium">Inventory Management</div>
                  <div className="text-gray-600">Dashboard → Inventory → Add/Edit Products</div>
                </div>
                <div className="border-l-4 border-purple-500 pl-3">
                  <div className="font-medium">Order Processing</div>
                  <div className="text-gray-600">Orders → View Details → Update Status</div>
                </div>
                <div className="border-l-4 border-orange-500 pl-3">
                  <div className="font-medium">User Administration</div>
                  <div className="text-gray-600">Users → Manage Roles → Verify Accounts</div>
                </div>
                <div className="border-l-4 border-red-500 pl-3">
                  <div className="font-medium">System Administration</div>
                  <div className="text-gray-600">Admin → System Settings → User Management</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm">
            Use the screen selector at the top or bottom navigation to explore different views and workflows
          </p>
        </div>
      </div>
    </div>
  );
}

