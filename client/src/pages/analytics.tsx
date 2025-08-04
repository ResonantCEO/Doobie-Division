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

  // Sample data for enhanced analytics (in production, these would come from real APIs)
  const salesData = [
    { date: "Jan 1", sales: 2400, orders: 24, customers: 12 },
    { date: "Jan 8", sales: 1398, orders: 18, customers: 10 },
    { date: "Jan 15", sales: 9800, orders: 42, customers: 28 },
    { date: "Jan 22", sales: 3908, orders: 28, customers: 18 },
    { date: "Jan 29", sales: 4800, orders: 35, customers: 22 },
    { date: "Feb 5", sales: 3800, orders: 31, customers: 19 },
    { date: "Feb 12", sales: 4300, orders: 37, customers: 24 },
  ];

  const customerData = [
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

  const categoryData = [
    { name: "Flower", value: 45, revenue: 15680, fill: "#8884d8" },
    { name: "Edibles", value: 30, revenue: 12450, fill: "#82ca9d" },
    { name: "Concentrates", value: 15, revenue: 8930, fill: "#ffc658" },
    { name: "Accessories", value: 10, revenue: 3420, fill: "#ff7c7c" },
  ];

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
        </div>
      </div>
    );
  }

  const MetricCard = ({ title, value, change, icon: Icon, color = "green" }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center">
          <div className={`p-3 rounded-full bg-${color}-100 text-${color}-600`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
            <p className={`text-sm text-${color}-600`}>{change}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Revenue"
              value={`$${metrics?.totalSales ? Number(metrics.totalSales).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}`}
              change="+12.5% from last period"
              icon={DollarSign}
              color="green"
            />
            <MetricCard
              title="Total Orders"
              value={metrics?.totalOrders || 0}
              change="+8.3% from last period"
              icon={ShoppingCart}
              color="blue"
            />
            <MetricCard
              title="Total Customers"
              value={totalCustomers}
              change="+15.2% from last period"
              icon={Users}
              color="purple"
            />
            <MetricCard
              title="Avg. Order Value"
              value={`$${metrics?.averageOrderValue ? Number(metrics.averageOrderValue).toFixed(2) : '0.00'}`}
              change="+3.8% from last period"
              icon={TrendingUp}
              color="orange"
            />
          </div>

          {/* Quick Overview Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    <Area type="monotone" dataKey="sales" stroke="var(--color-sales)" fill="var(--color-sales)" fillOpacity={0.2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

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
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {/* Sales Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Net Profit" value="$8,250" change="+18.2%" icon={DollarSign} color="green" />
            <MetricCard title="Sales Growth Rate" value="12.5%" change="+2.1%" icon={TrendingUp} color="blue" />
            <MetricCard title="Return Rate" value="2.3%" change="-0.5%" icon={RefreshCw} color="red" />
            <MetricCard title="Abandoned Cart Rate" value="68.2%" change="-3.1%" icon={ShoppingCart} color="orange" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sales Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-64">
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" />
                  </LineChart>
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

          {/* Peak Purchase Times */}
          <Card>
            <CardHeader>
              <CardTitle>Peak Purchase Times</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { time: "12:00 PM - 2:00 PM", orders: "145", percentage: "32%" },
                  { time: "6:00 PM - 8:00 PM", orders: "98", percentage: "22%" },
                  { time: "8:00 PM - 10:00 PM", orders: "87", percentage: "19%" },
                  { time: "10:00 AM - 12:00 PM", orders: "76", percentage: "17%" }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{item.time}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{item.orders} orders</span>
                      <Badge variant="outline">{item.percentage}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          {/* Customer Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Customer Acquisition Cost" value="$45.20" change="-8.3%" icon={UserPlus} color="blue" />
            <MetricCard title="Customer Retention Rate" value="78.5%" change="+5.2%" icon={Heart} color="green" />
            <MetricCard title="Churn Rate" value="21.5%" change="-5.2%" icon={TrendingUp} color="red" />
            <MetricCard title="Customer Lifetime Value" value="$1,250" change="+12.1%" icon={Award} color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Customer Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-64">
                  <AreaChart data={customerData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="new" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    <Area type="monotone" dataKey="returning" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                  </AreaChart>
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
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '23%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Age 26-35</span>
                      <span className="text-sm">42%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '42%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Age 36-45</span>
                      <span className="text-sm">25%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-600 h-2 rounded-full" style={{ width: '25%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Age 45+</span>
                      <span className="text-sm">10%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-orange-600 h-2 rounded-full" style={{ width: '10%' }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Segmentation */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Segmentation Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Segment</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Avg. Order Value</TableHead>
                      <TableHead>Total Revenue</TableHead>
                      <TableHead>Retention Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>VIP Customers</TableCell>
                      <TableCell>45</TableCell>
                      <TableCell>$185.50</TableCell>
                      <TableCell>$8,347</TableCell>
                      <TableCell><Badge className="bg-green-100 text-green-800">95%</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Regular Customers</TableCell>
                      <TableCell>156</TableCell>
                      <TableCell>$89.20</TableCell>
                      <TableCell>$13,915</TableCell>
                      <TableCell><Badge className="bg-blue-100 text-blue-800">78%</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>New Customers</TableCell>
                      <TableCell>89</TableCell>
                      <TableCell>$65.30</TableCell>
                      <TableCell>$5,812</TableCell>
                      <TableCell><Badge className="bg-orange-100 text-orange-800">45%</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>At-Risk Customers</TableCell>
                      <TableCell>23</TableCell>
                      <TableCell>$45.80</TableCell>
                      <TableCell>$1,053</TableCell>
                      <TableCell><Badge className="bg-red-100 text-red-800">12%</Badge></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketing" className="space-y-6">
          {/* Marketing Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <CardContent>
                <div className="overflow-x-auto">
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
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64">
                <BarChart data={[
                  { season: "Spring", sales: 18500, orders: 234 },
                  { season: "Summer", sales: 24600, orders: 312 },
                  { season: "Fall", sales: 21300, orders: 267 },
                  { season: "Winter", sales: 19800, orders: 245 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="season" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="sales" fill="var(--color-sales)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          {/* Inventory Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <CardContent>
                <div className="overflow-x-auto">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <CardContent>
                <ChartContainer config={chartConfig} className="h-64">
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
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}