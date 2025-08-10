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
import { Bell, Settings, LogOut, ShoppingBag, Package, BarChart3, Users, Home, Search, ShoppingCart, User, ChevronDown, Sun, Moon } from "lucide-react";
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
    { id: "orders", label: "Orders", path: "/dashboard/orders", roles: ["admin", "manager"] },
    { id: "analytics", label: "Analytics", path: "/dashboard/analytics", roles: ["admin", "manager"] },
    { id: "users", label: "User Management", path: "/dashboard/users", roles: ["admin"] },
    { id: "admin", label: "Admin", path: "/dashboard/admin", roles: ["admin"] },
    { id: "scanner", label: "Scanner", path: "/dashboard/scanner", roles: ["admin", "manager"] },
  ];

  const visibleTabs = tabs.filter(tab => !tab.roles || tab.roles.includes(user.role));

  return (
    <>
      {/* Main Navigation */}
      <nav className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center min-w-0">
              <div className="flex-shrink-0">
                <Link href="/dashboard">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-primary cursor-pointer truncate">
                    <span className="hidden sm:inline">Doobie Division!</span>
                    <span className="sm:hidden">DD!</span>
                  </h1>
                </Link>
              </div>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4 flex-shrink-0">
              {/* Search */}
              <div className="relative hidden xl:block">
                <Input
                  type="text"
                  placeholder="Search products..."
                  className="w-40 pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              </div>

              {/* Mobile Search Button */}
              <Button variant="ghost" size="sm" className="xl:hidden p-1">
                <Search className="h-4 w-4" />
              </Button>

              {/* Cart */}
              <CartDrawer>
                <Button variant="ghost" size="sm" className="relative p-1">
                  <ShoppingCart className="h-4 w-4" />
                  {cartState.itemCount > 0 && (
                    <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center p-0 text-xs bg-primary">
                      {cartState.itemCount}
                    </Badge>
                  )}
                </Button>
              </CartDrawer>

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative p-1">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center p-0 text-xs bg-destructive">
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
              <div className="hidden sm:flex items-center space-x-1">
                <Sun className="h-3 w-3" />
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={toggleTheme}
                  className="data-[state=checked]:bg-primary scale-75"
                />
                <Moon className="h-3 w-3" />
              </div>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-1 p-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {user.firstName?.[0]}{user.lastName?.[0]} || <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden xl:block text-sm">
                      {user.firstName} {user.lastName}
                    </span>
                    <ChevronDown className="h-3 w-3" />
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
          <nav className="-mb-px flex overflow-x-auto scrollbar-hide px-2 sm:px-4 lg:px-8">
            <div className="flex space-x-2 sm:space-x-4 lg:space-x-6 min-w-max">
              {visibleTabs.map((tab) => (
                <Link key={tab.id} href={tab.path}>
                  <button
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-xs transition-colors flex-shrink-0 ${
                      currentTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    {tab.label}
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