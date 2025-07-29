import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  Download, 
  BarChart3,
  Package,
  Calendar
} from "lucide-react";
import type { Product } from "@shared/schema";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30");

  // Fetch sales metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<{
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
  }>({
    queryKey: ["/api/analytics/metrics", { days: parseInt(timeRange) }],
  });

  // Fetch top products
  const { data: topProducts = [], isLoading: topProductsLoading } = useQuery<{
    product: Product;
    sales: number;
    revenue: number;
  }[]>({
    queryKey: ["/api/analytics/top-products", { limit: 10 }],
  });

  // Fetch low stock products
  const { data: lowStockProducts = [], isLoading: lowStockLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/low-stock"],
  });

  // Fetch order status breakdown
  const { data: orderBreakdown = [] } = useQuery<{ status: string; count: number }[]>({
    queryKey: ["/api/analytics/order-status-breakdown"],
  });

  // Sample sales data for charts (in a real app, this would come from an API)
  const salesData = [
    { date: "Jan 1", sales: 2400, orders: 24 },
    { date: "Jan 8", sales: 1398, orders: 18 },
    { date: "Jan 15", sales: 9800, orders: 42 },
    { date: "Jan 22", sales: 3908, orders: 28 },
    { date: "Jan 29", sales: 4800, orders: 35 },
    { date: "Feb 5", sales: 3800, orders: 31 },
    { date: "Feb 12", sales: 4300, orders: 37 },
  ];

  const chartConfig = {
    sales: {
      label: "Sales",
      color: "hsl(var(--chart-1))",
    },
    orders: {
      label: "Orders", 
      color: "hsl(var(--chart-2))",
    },
  };

  const categoryData = [
    { name: "Flower", value: 45, fill: "#8884d8" },
    { name: "Edibles", value: 30, fill: "#82ca9d" },
    { name: "Concentrates", value: 15, fill: "#ffc658" },
    { name: "Accessories", value: 10, fill: "#ff7c7c" },
  ];

  const handleExportReport = () => {
    // In a real app, this would generate and download a report
    alert("Analytics report export functionality would be implemented here");
  };

  const handleRestockItem = (productId: number) => {
    alert(`Restock functionality for product ${productId} would be implemented here`);
  };

  const totalCustomers = orderBreakdown.reduce((acc, item) => acc + item.count, 0);

  if (metricsLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-80 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics & Reports</h2>
        <div className="flex space-x-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 3 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-secondary">
                <DollarSign className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Sales</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  ${metrics?.totalSales ? Number(metrics.totalSales).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                </p>
                <p className="text-sm text-secondary">+12.5% from last period</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-primary">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Orders</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {metrics?.totalOrders || 0}
                </p>
                <p className="text-sm text-secondary">+8.3% from last period</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <Users className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Customers</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{totalCustomers}</p>
                <p className="text-sm text-secondary">+15.2% from last period</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Avg. Order Value</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  ${metrics?.averageOrderValue ? Number(metrics.averageOrderValue).toFixed(2) : '0.00'}
                </p>
                <p className="text-sm text-secondary">+3.8% from last period</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Overview Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Sales Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <AreaChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="var(--color-sales)"
                  fill="var(--color-sales)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProductsLoading ? (
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

      {/* Additional Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Orders by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Sales by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Order Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Order Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="orders" fill="var(--color-orders)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Report */}
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
              <div className="h-64 bg-gray-200 rounded"></div>
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
                          onClick={() => handleRestockItem(product.id)}
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
    </div>
  );
}
