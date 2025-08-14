import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  Download, 
  BarChart3,
  Package,
  Calendar,
  Target,
  Percent,
  Clock,
  Mail,
  Smartphone,
  Globe,
  Star,
  RefreshCw,
  UserPlus,
  Eye,
  MousePointer,
  Truck,
  AlertTriangle,
  MapPin,
  Heart,
  Award,
  Filter,
  Zap,
  Activity
} from "lucide-react";
import type { Product } from "@shared/schema";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30");
  const [activeTab, setActiveTab] = useState("overview");

  const days = parseInt(timeRange);

  // Fetch sales metrics
  const { data: salesMetrics, isLoading: salesLoading } = useQuery<{
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
  }>({
    queryKey: ["/api/analytics/metrics", days],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/metrics/${days}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch sales metrics");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch advanced metrics
  const { data: advancedMetrics, isLoading: advancedLoading } = useQuery<{
    netProfit: number;
    salesGrowthRate: number;
    returnRate: number;
    abandonedCartRate: number;
  }>({
    queryKey: ["/api/analytics/advanced-metrics", days],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/advanced-metrics/${days}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch advanced metrics");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch top products
  const { data: topProducts, isLoading: productsLoading } = useQuery<{ product: Product; sales: number; revenue: number }[]>({
    queryKey: ["/api/analytics/top-products", 5],
    queryFn: async () => {
      const response = await fetch("/api/analytics/top-products/5", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch top products");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch low stock products
  const { data: lowStockProducts = [], isLoading: lowStockLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/low-stock"],
  });

  // Fetch order status breakdown
  const { data: orderBreakdown = [] } = useQuery<{ status: string; count: number }[]>({
    queryKey: ["/api/analytics/order-status-breakdown"],
  });

  // Fetch customer data
  const { data: customerData, isLoading: customersLoading } = useQuery<{
    totalCustomers: number;
    newCustomersThisMonth: number;
    percentageChange: number;
  }>({
    queryKey: ["/api/analytics/customers"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/customers", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch customer data");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch real sales trend data
  const { data: salesData = [], isLoading: salesTrendLoading } = useQuery<{ date: string; sales: number; orders: number; customers: number }[]>({
    queryKey: ["/api/analytics/sales-trend", days],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/sales-trend/${days}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch sales trend");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const customerDataSample = [
    { month: "Jan", new: 45, returning: 123, churn: 12 },
    { month: "Feb", new: 52, returning: 134, churn: 8 },
    { month: "Mar", new: 38, returning: 145, churn: 15 },
    { month: "Apr", new: 63, returning: 156, churn: 9 },
    { month: "May", new: 49, returning: 167, churn: 11 },
    { month: "Jun", new: 71, returning: 178, churn: 7 },
  ];

  const marketingData = [
    { channel: "Organic Search", visitors: 1250, conversions: 89, cost: 0 },
    { channel: "Paid Search", visitors: 890, conversions: 67, cost: 2400 },
    { channel: "Social Media", visitors: 645, conversions: 34, cost: 800 },
    { channel: "Email", visitors: 456, conversions: 78, cost: 200 },
    { channel: "Direct", visitors: 334, conversions: 45, cost: 0 },
  ];

  // Fetch real category breakdown data
  const { data: categoryData = [], isLoading: categoryLoading } = useQuery<{ name: string; value: number; revenue: number; fill: string }[]>({
    queryKey: ["/api/analytics/category-breakdown"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/category-breakdown", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch category breakdown");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch peak purchase times
  const { data: peakTimesData = [], isLoading: peakTimesLoading } = useQuery<{ time: string; orders: number; percentage: number }[]>({
    queryKey: ["/api/analytics/peak-times", days],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/peak-times/${days}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch peak purchase times");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const inventoryData = [
    { product: "Premium Flower", current: 45, threshold: 20, turnover: 2.3 },
    { product: "CBD Gummies", current: 12, threshold: 15, turnover: 4.1 },
    { product: "Vape Cartridge", current: 8, threshold: 10, turnover: 3.7 },
    { product: "Pre-rolls", current: 23, threshold: 25, turnover: 1.8 },
  ];

  const chartConfig = {
    sales: { label: "Sales", color: "hsl(var(--chart-1))" },
    orders: { label: "Orders", color: "hsl(var(--chart-2))" },
    customers: { label: "Customers", color: "hsl(var(--chart-3))" },
  };

  const handleExportReport = () => {
    alert("Analytics report export functionality would be implemented here");
  };

  const totalCustomers = orderBreakdown.reduce((acc, item) => acc + item.count, 0);

  if (salesLoading || productsLoading || lowStockLoading || customersLoading || salesTrendLoading || categoryLoading || advancedLoading || peakTimesLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4 dark:bg-gray-700"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded dark:bg-gray-700"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded dark:bg-gray-700"></div>
            <div className="h-64 bg-gray-200 rounded dark:bg-gray-700"></div>
          </div>
        </div>
      </div>
    );
  }

  const MetricCard = ({ title, value, change, icon: Icon, color = "green" }: {
    title: string;
    value: string | number;
    change: string;
    icon: any;
    color?: string;
  }) => (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center">
          <div className={`p-2 sm:p-3 rounded-full bg-${color}-100 dark:bg-${color}-900/20 text-${color}-600 dark:text-${color}-400`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="ml-3 sm:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
            <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
            <p className={`text-xs sm:text-sm text-${color}-600 dark:text-${color}-400`}>{change}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Analytics & Reports</h2>

        {/* Mobile-first filters and actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-3 sm:items-center">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 3 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleExportReport} className="sm:ml-auto">
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Export Report</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-0 h-auto p-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs sm:text-sm">Sales</TabsTrigger>
          <TabsTrigger value="customers" className="text-xs sm:text-sm">Customers</TabsTrigger>
          <TabsTrigger value="marketing" className="text-xs sm:text-sm">Marketing</TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs sm:text-sm">Inventory</TabsTrigger>
          <TabsTrigger value="operations" className="text-xs sm:text-sm">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                    <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Total Revenue</p>
                    {salesLoading ? (
                      <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      <>
                        <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          ${salesMetrics?.totalSales.toFixed(2) || "0.00"}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Last {days} days</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                    <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Total Orders</p>
                    {salesLoading ? (
                      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      <>
                        <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          {salesMetrics?.totalOrders || 0}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Last {days} days</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Total Customers</p>
                    {customersLoading ? (
                      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      <>
                        <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          {customerData?.totalCustomers || 0}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          +{customerData?.newCustomersThisMonth || 0} this month
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Avg. Order Value</p>
                    {salesLoading ? (
                      <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      <>
                        <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          ${salesMetrics?.averageOrderValue.toFixed(2) || "0.00"}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Last {days} days</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Overview Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Sales Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {salesData.length === 0 ? (
                  <div className="h-48 sm:h-64 flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 dark:text-gray-400">No sales data available for this period</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-48 sm:h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="sales" stroke="var(--color-sales)" fill="var(--color-sales)" fillOpacity={0.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Sales by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {categoryData.length === 0 ? (
                  <div className="h-48 sm:h-64 flex items-center justify-center">
                    <div className="text-center">
                      <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 dark:text-gray-400">No category sales data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-48 sm:h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={categoryData} 
                          cx="50%" 
                          cy="50%" 
                          outerRadius="70%" 
                          dataKey="value" 
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          fontSize={10}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {/* Sales Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {advancedLoading ? (
                    <Skeleton className="h-8 w-20 mb-2" />
                  ) : (
                    <div className="text-2xl font-bold">
                      ${advancedMetrics?.netProfit?.toFixed(2) || "0.00"}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Based on 30% profit margin
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sales Growth Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {advancedLoading ? (
                    <Skeleton className="h-8 w-16 mb-2" />
                  ) : (
                    <div className="text-2xl font-bold">
                      {advancedMetrics?.salesGrowthRate?.toFixed(1) || "0.0"}%
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    <span className={advancedMetrics?.salesGrowthRate >= 0 ? "text-green-600" : "text-red-600"}>
                      {advancedMetrics?.salesGrowthRate >= 0 ? "+" : ""}{advancedMetrics?.salesGrowthRate?.toFixed(1) || "0.0"}%
                    </span> from previous period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Return Rate</CardTitle>
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {advancedLoading ? (
                    <Skeleton className="h-8 w-16 mb-2" />
                  ) : (
                    <div className="text-2xl font-bold">
                      {advancedMetrics?.returnRate?.toFixed(1) || "0.0"}%
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Cancelled orders ratio
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Abandoned Cart Rate</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {advancedLoading ? (
                    <Skeleton className="h-8 w-16 mb-2" />
                  ) : (
                    <div className="text-2xl font-bold">
                      {advancedMetrics?.abandonedCartRate?.toFixed(1) || "0.0"}%
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Requires cart tracking implementation
                  </p>
                </CardContent>
              </Card>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
            {/* Sales Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Trends</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ChartContainer config={chartConfig} className="h-48 sm:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Skeleton className="h-10 w-10 rounded" />
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : topProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No sales data available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topProducts.slice(0, 5).map((item, index) => (
                      <div key={item.product.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={item.product.imageUrl || undefined} />
                            <AvatarFallback>{item.product.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                              {item.product.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{item.sales} sold</p>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          ${Number(item.revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Peak Purchase Times */}
          <Card>
            <CardHeader>
              <CardTitle>Peak Purchase Times</CardTitle>
            </CardHeader>
            <CardContent>
              {peakTimesLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <Skeleton className="h-4 w-32" />
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-6 w-12" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : peakTimesData.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No order data available for peak time analysis</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {peakTimesData.map((item, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{item.time}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{item.orders} orders</span>
                        <Badge variant="outline">{item.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          {/* Customer Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <MetricCard title="Customer Satisfaction Score" value="4.8/5" change="+0.2" icon={Star} color="blue" />
            <MetricCard title="Customer Retention Rate" value="78.5%" change="+5.2%" icon={Heart} color="green" />
            <MetricCard title="Average Purchase Frequency" value="2.3/month" change="+0.4" icon={RefreshCw} color="blue" />
            <MetricCard title="Customer Lifetime Value" value="$1,250" change="+12.1%" icon={Award} color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Customer Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Growth</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ChartContainer config={chartConfig} className="h-48 sm:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={customerDataSample} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis fontSize={12} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="new" stackId="1" stroke="#8884d8" fill="#8884d8" />
                      <Area type="monotone" dataKey="returning" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Demographics */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Demographics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Age 18-25</span>
                      <span className="text-sm">23%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '23%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Age 26-35</span>
                      <span className="text-sm">42%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '42%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Age 36-45</span>
                      <span className="text-sm">25%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div className="bg-purple-600 h-2 rounded-full" style={{ width: '25%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Age 45+</span>
                      <span className="text-sm">10%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                      <div className="bg-orange-600 h-2 rounded-full" style={{ width: '10%' }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Product Performance Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Product Performance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Units Sold</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Profit Margin</TableHead>
                      <TableHead>Performance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>PF</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">Premium Flower</span>
                        </div>
                      </TableCell>
                      <TableCell>156</TableCell>
                      <TableCell>$4,680</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">35%</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">Excellent</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>CG</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">CBD Gummies</span>
                        </div>
                      </TableCell>
                      <TableCell>89</TableCell>
                      <TableCell>$2,670</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">42%</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-100 text-blue-800">Good</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>VC</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">Vape Cartridges</span>
                        </div>
                      </TableCell>
                      <TableCell>67</TableCell>
                      <TableCell>$2,010</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">38%</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-100 text-yellow-800">Average</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>PR</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">Pre-roll Pack</span>
                        </div>
                      </TableCell>
                      <TableCell>45</TableCell>
                      <TableCell>$1,350</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">45%</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-100 text-blue-800">Good</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>CO</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">Concentrates</span>
                        </div>
                      </TableCell>
                      <TableCell>23</TableCell>
                      <TableCell>$920</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">28%</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-orange-600">Needs Attention</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketing" className="space-y-6">
          {/* Marketing Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <MetricCard title="Website Traffic" value="12,456" change="+22.1%" icon={Globe} color="blue" />
            <MetricCard title="Conversion Rate" value="3.2%" change="+0.8%" icon={Target} color="green" />
            <MetricCard title="Email Open Rate" value="24.5%" change="+1.2%" icon={Mail} color="purple" />
            <MetricCard title="Social Media Engagement" value="8.7%" change="+3.4%" icon={Heart} color="pink" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Traffic Sources */}
            <Card>
              <CardHeader>
                <CardTitle>Traffic Sources & Conversions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {marketingData.map((item, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="font-medium text-sm">{item.channel}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>Visitors: {item.visitors}</div>
                        <div>Conversions: {item.conversions}</div>
                        <div>Cost: ${item.cost}</div>
                        <div>
                          <Badge variant={item.cost === 0 ? "secondary" : "default"} className="text-xs">
                            {item.cost === 0 ? "∞" : `${((item.conversions * 89 - item.cost) / item.cost * 100).toFixed(0)}%`}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead>Visitors</TableHead>
                        <TableHead>Conversions</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>ROI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketingData.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.channel}</TableCell>
                          <TableCell>{item.visitors}</TableCell>
                          <TableCell>{item.conversions}</TableCell>
                          <TableCell>${item.cost}</TableCell>
                          <TableCell>
                            <Badge variant={item.cost === 0 ? "secondary" : "default"}>
                              {item.cost === 0 ? "∞" : `${((item.conversions * 89 - item.cost) / item.cost * 100).toFixed(0)}%`}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Campaign Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "Summer Sale 2024", ctr: "4.2%", conversions: "145", roi: "245%" },
                    { name: "New Product Launch", ctr: "3.8%", conversions: "89", roi: "180%" },
                    { name: "Email Newsletter", ctr: "2.1%", conversions: "67", roi: "320%" },
                    { name: "Social Media Ads", ctr: "1.9%", conversions: "34", roi: "125%" }
                  ].map((campaign, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{campaign.name}</h4>
                        <Badge className="bg-green-100 text-green-800">{campaign.roi}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>CTR: {campaign.ctr}</div>
                        <div>Conversions: {campaign.conversions}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seasonal Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Seasonal Sales Trends</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ChartContainer config={chartConfig} className="h-48 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { season: "Spring", sales: 18500, orders: 234 },
                    { season: "Summer", sales: 24600, orders: 312 },
                    { season: "Fall", sales: 21300, orders: 267 },
                    { season: "Winter", sales: 19800, orders: 245 }
                  ]} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="season" fontSize={12} />
                    <YAxis fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="sales" fill="var(--color-sales)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          {/* Inventory Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <MetricCard title="Stock Turnover Rate" value="3.2x" change="+0.4x" icon={RefreshCw} color="blue" />
            <MetricCard title="Inventory Value" value="$45,280" change="+8.2%" icon={Package} color="green" />
            <MetricCard title="Low Stock Items" value="12" change="-3" icon={AlertTriangle} color="orange" />
            <MetricCard title="Out of Stock" value="3" change="-1" icon={Package} color="red" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Inventory Levels */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory Aging Report</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {inventoryData.map((item, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="font-medium text-sm">{item.product}</div>
                        <Badge variant={item.current < item.threshold ? "destructive" : "secondary"} className="text-xs">
                          {item.current < item.threshold ? "Low Stock" : "Normal"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>Stock: {item.current}</div>
                        <div>Threshold: {item.threshold}</div>
                        <div>Turnover: {item.turnover}x</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Current Stock</TableHead>
                        <TableHead>Threshold</TableHead>
                        <TableHead>Turnover</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryData.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.product}</TableCell>
                          <TableCell>{item.current}</TableCell>
                          <TableCell>{item.threshold}</TableCell>
                          <TableCell>{item.turnover}x</TableCell>
                          <TableCell>
                            <Badge variant={item.current < item.threshold ? "destructive" : "secondary"}>
                              {item.current < item.threshold ? "Low Stock" : "Normal"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Supplier Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Supplier Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: "Green Valley Farms", onTime: "98%", quality: "A+", orders: "45" },
                    { name: "Premium Extracts Co.", onTime: "92%", quality: "A", orders: "23" },
                    { name: "Local Grow House", onTime: "87%", quality: "B+", orders: "18" },
                    { name: "Artisan Accessories", onTime: "95%", quality: "A", orders: "12" }
                  ].map((supplier, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{supplier.name}</h4>
                        <Badge className="bg-blue-100 text-blue-800">{supplier.quality}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>On-time: {supplier.onTime}</div>
                        <div>Orders: {supplier.orders}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Low Stock Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockLoading ? (
                <div className="animate-pulse">
                  <div className="h-64 bg-gray-200 rounded dark:bg-gray-700"></div>
                </div>
              ) : lowStockProducts.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">All products are well stocked</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Current Stock</TableHead>
                        <TableHead>Min. Threshold</TableHead>
                        <TableHead>Action Needed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={product.imageUrl || undefined} />
                                <AvatarFallback>{product.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {product.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${
                              product.stock === 0 ? "text-red-600" : "text-orange-600"
                            }`}>
                              {product.stock}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-900 dark:text-white">
                            {product.minStockThreshold}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={product.stock === 0 ? "destructive" : "default"}
                              onClick={() => alert(`Restock functionality for product ${product.id} would be implemented here`)}
                            >
                              {product.stock === 0 ? "Urgent Restock" : "Restock Now"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          {/* Operations Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <MetricCard title="Order Fulfillment Time" value="2.3 days" change="-0.5 days" icon={Clock} color="blue" />
            <MetricCard title="Operational Efficiency" value="94.2%" change="+2.1%" icon={Zap} color="green" />
            <MetricCard title="Cost of Goods Sold" value="$15,680" change="+5.2%" icon={DollarSign} color="orange" />
            <MetricCard title="Cross-Sell Success" value="15.8%" change="+3.2%" icon={Target} color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Order Processing Times */}
            <Card>
              <CardHeader>
                <CardTitle>Order Processing Efficiency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { stage: "Order Received", time: "0 min", status: "Complete" },
                    { stage: "Payment Processing", time: "2 min", status: "Complete" },
                    { stage: "Inventory Check", time: "5 min", status: "Complete" },
                    { stage: "Packaging", time: "45 min", status: "In Progress" },
                    { stage: "Quality Check", time: "15 min", status: "Pending" },
                    { stage: "Shipping", time: "2-3 days", status: "Pending" }
                  ].map((step, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{step.stage}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{step.time}</span>
                        <Badge variant={
                          step.status === "Complete" ? "secondary" :
                          step.status === "In Progress" ? "default" : "outline"
                        }>
                          {step.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sales Attribution */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Attribution Analysis</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ChartContainer config={chartConfig} className="h-48 sm:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Direct Sales", value: 35, fill: "#8884d8" },
                          { name: "Referrals", value: 25, fill: "#82ca9d" },
                          { name: "Social Media", value: 20, fill: "#ffc658" },
                          { name: "Email Marketing", value: 15, fill: "#ff7c7c" },
                          { name: "Paid Ads", value: 5, fill: "#8dd1e1" }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius="70%"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        fontSize={10}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Customer Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Feedback & Satisfaction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Overall Satisfaction</span>
                  <div className="flex items-center space-x-2">
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <span className="text-sm font-medium">4.8/5</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Product Quality</span>
                  <span className="text-sm font-medium">95%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Delivery Speed</span>
                  <span className="text-sm font-medium">92%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Customer Service</span>
                  <span className="text-sm font-medium">96%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Value for Money</span>
                  <span className="text-sm font-medium">88%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}