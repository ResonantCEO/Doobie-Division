import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Bell, Settings, LogOut, Package, BarChart3, Users, Home, Search, ShoppingCart, User, ChevronDown, Sun, Moon, QrCode } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/theme-context";
import { useCart } from "@/contexts/cart-context";
import CartDrawer from "@/components/cart-drawer";
import type { User as UserType } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import { Camera } from "lucide-react";

interface NavigationProps {
  user: UserType;
  currentTab: string;
}

export default function Navigation({ user, currentTab }: NavigationProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { theme, toggleTheme } = useTheme();
  const { state: cartState } = useCart();
  const { toast } = useToast();

  // Fetch notifications
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      queryClient.clear();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      // Redirect to landing page
      window.location.href = '/';
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "An error occurred while logging out.",
        variant: "destructive",
      });
    }
  };

  const tabs = [
    { id: "storefront", label: "Storefront", path: "/dashboard/storefront" },
    { id: "inventory", label: "Inventory Management", path: "/dashboard/inventory", roles: ["admin", "manager"] },
    { id: "orders", label: "Orders", path: "/dashboard/orders", roles: ["admin", "manager", "staff"] },
    { id: "analytics", label: "Analytics", path: "/dashboard/analytics", roles: ["admin", "manager"] },
    { id: "users", label: "User Management", path: "/dashboard/users", roles: ["admin"] },
    { id: "admin", label: "Admin", path: "/dashboard/admin", roles: ["admin"] },
    { id: "scanner", label: "Scanner", path: "/dashboard/scanner", roles: ["admin", "manager", "staff"] },
  ];

  const visibleTabs = tabs.filter(tab => !tab.roles || tab.roles.includes(user.role));

  return (
    <>
      {/* Main Navigation */}
      <nav className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop Layout */}
          <div className="hidden md:flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link href="/dashboard">
                  <h1 className="text-2xl font-bold text-primary cursor-pointer">Doobie Division!</h1>
                </Link>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative hidden lg:block">
                <Input
                  type="text"
                  placeholder="Search products..."
                  className="w-64 pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              </div>

              {/* Cart */}
              <CartDrawer>
                <Button variant="ghost" size="sm" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cartState.itemCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary">
                      {cartState.itemCount}
                    </Badge>
                  )}
                </Button>
              </CartDrawer>

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="p-2">
                    <h3 className="font-semibold text-sm mb-2">Notifications</h3>
                    {notifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No notifications
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {notifications.map((notification: any) => (
                          <div
                            key={notification.id}
                            className={`p-2 rounded-md text-sm ${
                              notification.isRead
                                ? "bg-background"
                                : "bg-muted"
                            }`}
                          >
                            <div className="font-medium">{notification.title}</div>
                            <div className="text-muted-foreground text-xs">
                              {notification.message}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(notification.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Theme Toggle */}
              <div className="flex items-center space-x-2">
                <Sun className="h-4 w-4" />
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={toggleTheme}
                  className="data-[state=checked]:bg-primary"
                />
                <Moon className="h-4 w-4" />
              </div>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {user.firstName?.[0]}{user.lastName?.[0]} || <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:block">
                      {user.firstName} {user.lastName}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center cursor-pointer">
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="md:hidden">
            {/* First row: Logo */}
            <div className="flex justify-center items-center py-3">
              <Link href="/dashboard">
                <h1 className="text-xl font-bold text-primary cursor-pointer">Doobie Division!</h1>
              </Link>
            </div>

            {/* Second row: Icons */}
            <div className="flex justify-center items-center space-x-4 pb-3">
              {/* Search */}
              <Button variant="ghost" size="sm">
                <Search className="h-5 w-5" />
              </Button>

              {/* Cart */}
              <CartDrawer>
                <Button variant="ghost" size="sm" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cartState.itemCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary">
                      {cartState.itemCount}
                    </Badge>
                  )}
                </Button>
              </CartDrawer>

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="p-2">
                    <h3 className="font-semibold text-sm mb-2">Notifications</h3>
                    {notifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No notifications
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {notifications.map((notification: any) => (
                          <div
                            key={notification.id}
                            className={`p-2 rounded-md text-sm ${
                              notification.isRead
                                ? "bg-background"
                                : "bg-muted"
                            }`}
                          >
                            <div className="font-medium">{notification.title}</div>
                            <div className="text-muted-foreground text-xs">
                              {notification.message}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(notification.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Theme Toggle */}
              <div className="flex items-center space-x-1">
                <Sun className="h-4 w-4" />
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={toggleTheme}
                  className="data-[state=checked]:bg-primary scale-75"
                />
                <Moon className="h-4 w-4" />
              </div>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {user.firstName?.[0]}{user.lastName?.[0]} || <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center cursor-pointer">
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto">
          <nav className="-mb-px overflow-x-auto scrollbar-hide">
            <div className="flex space-x-1 sm:space-x-2 lg:space-x-4 px-2 sm:px-4 lg:px-8 min-w-max">
              {visibleTabs.map((tab) => (
                <Link key={tab.id} href={tab.path}>
                  <button
                    className={`whitespace-nowrap py-3 px-2 sm:px-4 lg:px-6 border-b-2 font-medium text-xs sm:text-sm transition-colors flex-shrink-0 min-w-fit touch-manipulation ${
                      currentTab === tab.id
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/50"
                    }`}
                  >
                    {/* Mobile: Show shortened labels */}
                    <span className="block sm:hidden text-xs">
                      {tab.label === "Inventory Management" ? "Stock" : 
                       tab.label === "User Management" ? "Users" :
                       tab.label === "Analytics" ? "Stats" :
                       tab.label === "Storefront" ? "Shop" :
                       tab.label}
                    </span>
                    {/* Desktop: Show full labels */}
                    <span className="hidden sm:block">{tab.label}</span>
                  </button>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}