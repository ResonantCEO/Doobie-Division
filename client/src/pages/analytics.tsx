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
    queryFn: async () => {
      const response = await fetch("/api/products/low-stock", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch low stock products");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
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

  // Fetch new users registered today
  const { data: dailyNewUsersData, isLoading: dailyNewUsersLoading } = useQuery<{ newUsersToday: number }>({
    queryKey: ["/api/analytics/daily-new-users"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/daily-new-users", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch new users today");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch today's new customers (first-time buyers today)
  const { data: dailyNewCustomersData, isLoading: dailyNewCustomersLoading } = useQuery<{ newCustomersToday: number }>({
    queryKey: ["/api/analytics/daily-new-customers"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/daily-new-customers", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch new customers today");
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for more frequent updates
  });

  // Fetch today's return customers (repeat buyers today)
  const { data: dailyReturnCustomersData, isLoading: dailyReturnCustomersLoading } = useQuery<{ returnCustomersToday: number }>({
    queryKey: ["/api/analytics/daily-return-customers"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/daily-return-customers", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch return customers today");
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for more frequent updates
  });





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

  // Fetch all products for inventory aging report
  const { data: allProducts = [], isLoading: allProductsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/all"],
    queryFn: async () => {
      const response = await fetch("/api/products", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch daily metrics (today only)
  const { data: dailyMetrics, isLoading: dailyMetricsLoading } = useQuery<{
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
  }>({
    queryKey: ["/api/analytics/metrics", 1], // 1 day
    queryFn: async () => {
      const response = await fetch(`/api/analytics/metrics/1`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch daily metrics");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch today's hourly breakdown
  const { data: hourlyData = [], isLoading: hourlyDataLoading } = useQuery<{ hour: string; sales: number; orders: number }[]>({
    queryKey: ["/api/analytics/hourly-breakdown"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/hourly-breakdown", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch hourly breakdown");
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for more frequent updates
  });

  // Fetch today's top products
  const { data: dailyTopProducts, isLoading: dailyTopProductsLoading } = useQuery<{ product: Product; sales: number; revenue: number }[]>({
    queryKey: ["/api/analytics/daily-top-products"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/daily-top-products", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch daily top products");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: inventoryMetrics, isLoading: inventoryMetricsLoading } = useQuery<{
    stockTurnoverRate: number;
    inventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  }>({
    queryKey: ["/api/analytics/inventory-metrics"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/inventory-metrics", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch inventory metrics");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: customerMetrics, isLoading: customerMetricsLoading } = useQuery<{
    retentionRate: number;
    avgPurchaseFrequency: number;
    customerLifetimeValue: number;
    customerGrowth: { month: string; new: number; returning: number }[];
  }>({
    queryKey: ["/api/analytics/customer-metrics", days],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/customer-metrics/${days}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch customer metrics");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: operationsMetrics, isLoading: operationsMetricsLoading } = useQuery<{
    avgFulfillmentTime: number;
    fulfillmentRate: number;
    costOfGoodsSold: number;
  }>({
    queryKey: ["/api/analytics/operations-metrics", days],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/operations-metrics/${days}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch operations metrics");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch city analytics data
  const { data: cityAnalytics = [], isLoading: cityAnalyticsLoading } = useQuery<{
    city: string;
    total_orders: number;
    total_revenue: number;
    outstanding_orders: number;
    completed_orders: number;
    pending_orders: number;
    processing_orders: number;
    shipped_orders: number;
    avg_order_value: number;
    last_order_date: string | null;
  }[]>({
    queryKey: ["/api/analytics/city-analytics", days],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/city-analytics/${days}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch city analytics");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Transform products data for inventory aging report
  const inventoryData = allProducts.map(product => ({
    product: product.name,
    current: product.stock,
    threshold: product.minStockThreshold,
    turnover: 2.5 // Default turnover rate - could be calculated from order history
  }));

  const chartConfig = {
    sales: { label: "Sales", color: "hsl(var(--chart-1))" },
    orders: { label: "Orders", color: "hsl(var(--chart-2))" },
    customers: { label: "Customers", color: "hsl(var(--chart-3))" },
  };

  const handleExportReport = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 0;

    const timeLabel = timeRange === '7' ? 'Last 7 Days' : timeRange === '30' ? 'Last 30 Days' : timeRange === '90' ? 'Last 3 Months' : 'Last Year';
    const generatedAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const ensureSpace = (needed: number) => {
      if (y + needed > 270) { doc.addPage(); y = 20; }
    };

    const sectionHeader = (title: string, color: [number, number, number] = [22, 163, 74]) => {
      ensureSpace(14);
      doc.setFillColor(...color);
      doc.rect(margin, y, pageW - margin * 2, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont(undefined as any, 'bold');
      doc.text(title, margin + 3, y + 5.5);
      doc.setTextColor(30, 30, 30);
      doc.setFont(undefined as any, 'normal');
      y += 12;
    };

    const metricGrid = (items: { label: string; value: string }[], cols = 2) => {
      const colW = (pageW - margin * 2) / cols;
      const rowH = 14;
      const rows = Math.ceil(items.length / cols);
      ensureSpace(rows * rowH + 4);
      items.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = margin + col * colW;
        const ry = y + row * rowH;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x + 1, ry, colW - 2, rowH - 2, 2, 2, 'F');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7);
        doc.setFont(undefined as any, 'normal');
        doc.text(item.label.toUpperCase(), x + 4, ry + 4.5);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.setFont(undefined as any, 'bold');
        doc.text(item.value, x + 4, ry + 10);
      });
      y += rows * rowH + 4;
    };

    // ── COVER ──────────────────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 50, 'F');
    doc.setFillColor(22, 163, 74);
    doc.rect(0, 48, pageW, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont(undefined as any, 'bold');
    doc.text('Doobie Division!', margin, 20);
    doc.setFontSize(13);
    doc.setFont(undefined as any, 'normal');
    doc.text('Analytics & Reports', margin, 30);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Period: ${timeLabel}   ·   Generated: ${generatedAt}`, margin, 42);
    doc.setTextColor(30, 30, 30);
    y = 58;

    // ── OVERVIEW ──────────────────────────────────────────────────────────────
    sectionHeader('OVERVIEW — KEY METRICS', [15, 118, 110]);
    metricGrid([
      { label: 'Total Revenue', value: `$${salesMetrics?.totalSales?.toFixed(2) ?? '0.00'}` },
      { label: 'Total Orders', value: String(salesMetrics?.totalOrders ?? 0) },
      { label: 'Avg. Order Value', value: `$${salesMetrics?.averageOrderValue?.toFixed(2) ?? '0.00'}` },
      { label: 'Total Customers', value: String(customerData?.totalCustomers ?? 0) },
      { label: 'Net Profit', value: `$${advancedMetrics?.netProfit?.toFixed(2) ?? '0.00'}` },
      { label: 'Sales Growth Rate', value: `${advancedMetrics?.salesGrowthRate?.toFixed(1) ?? '0.0'}%` },
      { label: 'Return Rate', value: `${advancedMetrics?.returnRate?.toFixed(1) ?? '0.0'}%` },
      { label: 'New Customers (Month)', value: String(customerData?.newCustomersThisMonth ?? 0) },
    ]);

    // ── SALES TREND ───────────────────────────────────────────────────────────
    if (salesData.length > 0) {
      sectionHeader('SALES TREND', [37, 99, 235]);
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Revenue ($)', 'Orders', 'Customers']],
        body: salesData.map(d => [d.date, `$${Number(d.sales).toFixed(2)}`, d.orders, d.customers]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── TOP PRODUCTS ──────────────────────────────────────────────────────────
    if (topProducts && topProducts.length > 0) {
      sectionHeader('TOP SELLING PRODUCTS', [124, 58, 237]);
      autoTable(doc, {
        startY: y,
        head: [['#', 'Product', 'Units Sold', 'Revenue ($)']],
        body: topProducts.map((item, i) => [i + 1, item.product.name, item.sales, `$${Number(item.revenue).toFixed(2)}`]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 243, 255] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── CATEGORY BREAKDOWN ────────────────────────────────────────────────────
    if (categoryData.length > 0) {
      sectionHeader('CATEGORY BREAKDOWN', [217, 119, 6]);
      autoTable(doc, {
        startY: y,
        head: [['Category', 'Units Sold', 'Revenue ($)', '% of Revenue']],
        body: (() => {
          const totalRev = categoryData.reduce((s, c) => s + Number(c.revenue || 0), 0);
          return categoryData.map(c => [
            c.name,
            c.value,
            `$${Number(c.revenue || 0).toFixed(2)}`,
            totalRev > 0 ? `${((Number(c.revenue || 0) / totalRev) * 100).toFixed(1)}%` : '0%',
          ]);
        })(),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── PEAK PURCHASE TIMES ───────────────────────────────────────────────────
    if (peakTimesData.length > 0) {
      sectionHeader('PEAK PURCHASE TIMES', [15, 118, 110]);
      autoTable(doc, {
        startY: y,
        head: [['Time Window', 'Orders', '% of Total']],
        body: peakTimesData.map(p => [p.time, p.orders, `${p.percentage}%`]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── CUSTOMERS ─────────────────────────────────────────────────────────────
    sectionHeader('CUSTOMER METRICS', [37, 99, 235]);
    metricGrid([
      { label: 'Total Customers', value: String(customerData?.totalCustomers ?? 0) },
      { label: 'New This Month', value: String(customerData?.newCustomersThisMonth ?? 0) },
      { label: 'Retention Rate', value: `${customerMetrics?.retentionRate?.toFixed(1) ?? '0.0'}%` },
      { label: 'Avg Purchase Freq.', value: `${customerMetrics?.avgPurchaseFrequency?.toFixed(1) ?? '0.0'}/period` },
      { label: 'Lifetime Value (CLV)', value: `$${customerMetrics?.customerLifetimeValue?.toFixed(2) ?? '0.00'}` },
      { label: 'New Customers Today', value: String(dailyNewCustomersData?.newCustomersToday ?? 0) },
      { label: 'Return Customers Today', value: String(dailyReturnCustomersData?.returnCustomersToday ?? 0) },
      { label: 'New Users Today', value: String(dailyNewUsersData?.newUsersToday ?? 0) },
    ]);

    // Customer growth table
    if (customerMetrics?.customerGrowth && customerMetrics.customerGrowth.length > 0) {
      ensureSpace(10);
      autoTable(doc, {
        startY: y,
        head: [['Month', 'New Customers', 'Returning Customers']],
        body: customerMetrics.customerGrowth.map(g => [g.month, g.new, g.returning]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── INVENTORY ─────────────────────────────────────────────────────────────
    sectionHeader('INVENTORY METRICS', [220, 38, 38]);
    metricGrid([
      { label: 'Stock Turnover Rate', value: `${inventoryMetrics?.stockTurnoverRate?.toFixed(1) ?? '0.0'}x` },
      { label: 'Total Inventory Value', value: `$${(inventoryMetrics?.inventoryValue ?? 0).toFixed(2)}` },
      { label: 'Low Stock Items', value: String(inventoryMetrics?.lowStockCount ?? 0) },
      { label: 'Out of Stock Items', value: String(inventoryMetrics?.outOfStockCount ?? 0) },
    ], 4);

    if (inventoryData.length > 0) {
      ensureSpace(10);
      autoTable(doc, {
        startY: y,
        head: [['Product', 'Current Stock', 'Min. Threshold', 'Status']],
        body: inventoryData.map(item => [
          item.product,
          item.current,
          item.threshold,
          item.current === 0 ? 'OUT OF STOCK' : item.current < item.threshold ? 'LOW STOCK' : 'Normal',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 241, 242] },
        bodyStyles: { textColor: 30 },
        didParseCell: (data: any) => {
          if (data.column.index === 3 && data.section === 'body') {
            const v = String(data.cell.raw);
            if (v === 'OUT OF STOCK') data.cell.styles.textColor = [185, 28, 28];
            else if (v === 'LOW STOCK') data.cell.styles.textColor = [180, 83, 9];
            else data.cell.styles.textColor = [22, 101, 52];
          }
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── OPERATIONS ────────────────────────────────────────────────────────────
    sectionHeader('OPERATIONS METRICS', [107, 114, 128]);
    metricGrid([
      { label: 'Avg Fulfillment Time', value: `${operationsMetrics?.avgFulfillmentTime?.toFixed(1) ?? '0.0'} days` },
      { label: 'Fulfillment Rate', value: `${operationsMetrics?.fulfillmentRate?.toFixed(1) ?? '0.0'}%` },
      { label: 'Cost of Goods Sold', value: `$${(operationsMetrics?.costOfGoodsSold ?? 0).toFixed(2)}` },
      { label: 'Avg. Order Value', value: `$${salesMetrics?.averageOrderValue?.toFixed(2) ?? '0.00'}` },
    ], 4);

    if (orderBreakdown.length > 0) {
      const total = orderBreakdown.reduce((s, i) => s + i.count, 0);
      autoTable(doc, {
        startY: y,
        head: [['Status', 'Count', '% of Total']],
        body: orderBreakdown.map(item => [
          item.status.charAt(0).toUpperCase() + item.status.slice(1),
          item.count,
          total > 0 ? `${((item.count / total) * 100).toFixed(1)}%` : '0%',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [107, 114, 128], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── CITIES ────────────────────────────────────────────────────────────────
    if (cityAnalytics.length > 0) {
      sectionHeader('CITY ANALYTICS', [79, 70, 229]);
      autoTable(doc, {
        startY: y,
        head: [['City', 'Total Orders', 'Revenue ($)', 'Outstanding', 'Pending', 'Processing', 'Shipped/Done', 'Avg Order ($)', 'Last Order']],
        body: cityAnalytics.map(row => [
          row.city,
          row.total_orders,
          `$${row.total_revenue.toFixed(2)}`,
          row.outstanding_orders,
          row.pending_orders,
          row.processing_orders,
          row.completed_orders,
          `$${row.avg_order_value.toFixed(2)}`,
          row.last_order_date ? new Date(row.last_order_date).toLocaleDateString() : '—',
        ]),
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [238, 242, 255] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── TODAY'S SUMMARY ───────────────────────────────────────────────────────
    sectionHeader("TODAY'S DAILY SUMMARY", [15, 118, 110]);
    metricGrid([
      { label: "Today's Revenue", value: `$${dailyMetrics?.totalSales?.toFixed(2) ?? '0.00'}` },
      { label: "Today's Orders", value: String(dailyMetrics?.totalOrders ?? 0) },
      { label: 'Today AOV', value: `$${dailyMetrics?.averageOrderValue?.toFixed(2) ?? '0.00'}` },
      { label: 'New Customers Today', value: String(dailyNewCustomersData?.newCustomersToday ?? 0) },
    ], 4);

    if (dailyTopProducts && dailyTopProducts.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Today's Top Sellers", 'Units Sold Today', 'Revenue Today ($)']],
        body: dailyTopProducts.map(item => [item.product.name, item.sales, `$${Number(item.revenue).toFixed(2)}`]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── PAGE NUMBERS ──────────────────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Doobie Division! — Confidential   ·   Page ${i} of ${totalPages}   ·   ${generatedAt}`, margin, doc.internal.pageSize.getHeight() - 8);
    }

    const fileName = `doobie-division-analytics-${timeLabel.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
  };

  const totalCustomers = orderBreakdown.reduce((acc, item) => acc + item.count, 0);

  if (salesLoading || productsLoading || lowStockLoading || customersLoading || salesTrendLoading || categoryLoading || advancedLoading || peakTimesLoading || allProductsLoading || dailyMetricsLoading || hourlyDataLoading || dailyTopProductsLoading || dailyNewUsersLoading) {
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
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 gap-1 sm:gap-0 h-auto p-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="daily" className="text-xs sm:text-sm">Daily</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs sm:text-sm">Sales</TabsTrigger>
          <TabsTrigger value="customers" className="text-xs sm:text-sm">Customers</TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs sm:text-sm">Inventory</TabsTrigger>
          <TabsTrigger value="operations" className="text-xs sm:text-sm">Operations</TabsTrigger>
          <TabsTrigger value="cities" className="text-xs sm:text-sm">Cities</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          {/* Today's Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                    <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Today's Revenue</p>
                    {dailyMetricsLoading ? (
                      <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      <>
                        <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          ${dailyMetrics?.totalSales.toFixed(2) || "0.00"}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Since midnight</p>
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
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Today's Orders</p>
                    {dailyMetricsLoading ? (
                      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      <>
                        <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          {dailyMetrics?.totalOrders || 0}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Since midnight</p>
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
                    {dailyMetricsLoading ? (
                      <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      <>
                        <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          ${dailyMetrics?.averageOrderValue.toFixed(2) || "0.00"}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Today</p>
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
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Current Hour</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Live time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hourly Performance and Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Today's Hourly Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {hourlyDataLoading ? (
                  <div className="h-48 sm:h-64 flex items-center justify-center">
                    <div className="animate-pulse">
                      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                ) : hourlyData.length === 0 ? (
                  <div className="h-48 sm:h-64 flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 dark:text-gray-400">No sales data for today yet</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-48 sm:h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" fontSize={12} />
                        <YAxis fontSize={12} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="sales" fill="var(--color-sales)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Today's Top Sellers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyTopProductsLoading ? (
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
                ) : !dailyTopProducts || dailyTopProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No sales today yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dailyTopProducts.slice(0, 5).map((item, index) => (
                      <div key={item.product.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-medium">
                            #{index + 1}
                          </div>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={item.product.imageUrl || undefined} />
                            <AvatarFallback>{item.product.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                              {item.product.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{item.sales} sold today</p>
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

          {/* Daily Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Today's Activity Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Page Views</span>
                    </div>
                    <span className="text-sm font-semibold">--</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">New Customers</span>
                    </div>
                    {dailyNewCustomersLoading ? (
                      <Skeleton className="h-5 w-8" />
                    ) : (
                      <span className="text-sm font-semibold">{dailyNewCustomersData?.newCustomersToday || 0}</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">Return Customers</span>
                    </div>
                    {dailyReturnCustomersLoading ? (
                      <Skeleton className="h-5 w-8" />
                    ) : (
                      <span className="text-sm font-semibold">{dailyReturnCustomersData?.returnCustomersToday || 0}</span>
                    )}
                  </div>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <UserPlus className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium">New Users Today</span>
                      </div>
                      {dailyNewUsersLoading ? (
                        <Skeleton className="h-6 w-16 mt-2" />
                      ) : (
                        <p className="text-lg font-bold mt-1">
                          {dailyNewUsersData?.newUsersToday || 0}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Today's registrations</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Daily Alerts & Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lowStockProducts.length > 0 ? (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800 dark:text-red-300">Low Stock Alert</span>
                      </div>
                      <p className="text-xs text-red-700 dark:text-red-400">
                        {lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} running low
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-300">All Stock Levels Good</span>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-300">System Status</span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-400">All systems operational</p>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-300">Today's Date</span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-400">
                      {new Date().toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                        <XAxis dataKey="date" fontSize={11} tickFormatter={(v) => { const d = new Date(v + 'T00:00:00'); return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`; }} />
                        <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
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
                          data={categoryData.map((item, index) => {
                            const colors = [
                              '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1',
                              '#d084d0', '#87ceeb', '#dda0dd', '#98fb98', '#f0e68c'
                            ];
                            return {
                              ...item,
                              fill: colors[index % colors.length]
                            };
                          })}
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
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {/* Sales Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <MetricCard title="Net Profit" value={`$${advancedMetrics?.netProfit?.toFixed(2) || "0.00"}`} change="Based on actual purchase costs" icon={DollarSign} color="green" />
            <MetricCard title="Sales Growth Rate" value={`${advancedMetrics?.salesGrowthRate?.toFixed(1) || "0.0"}%`} change={`${advancedMetrics?.salesGrowthRate >= 0 ? "+" : ""}${advancedMetrics?.salesGrowthRate?.toFixed(1) || "0.0"}% from previous period`} icon={TrendingUp} color="blue" />
            <MetricCard title="Return Rate" value={`${advancedMetrics?.returnRate?.toFixed(1) || "0.0"}%`} change="Cancelled orders ratio" icon={RefreshCw} color="orange" />
            <MetricCard title="Abandoned Cart Rate" value={`${advancedMetrics?.abandonedCartRate?.toFixed(1) || "0.0"}%`} change="Requires cart tracking" icon={ShoppingCart} color="purple" />
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
                      <XAxis dataKey="date" fontSize={11} tickFormatter={(v) => { const d = new Date(v + 'T00:00:00'); return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`; }} />
                      <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
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
                ) : !topProducts || topProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No sales data available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topProducts?.slice(0, 5).map((item, index) => (
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
            <MetricCard title="Total Customers" value={customerData?.totalCustomers || 0} change={`+${customerData?.newCustomersThisMonth || 0} this month`} icon={Users} color="blue" />
            <MetricCard title="Customer Retention Rate" value={`${customerMetrics?.retentionRate?.toFixed(1) || "0.0"}%`} change="Repeat buyers" icon={Heart} color="green" />
            <MetricCard title="Avg Purchase Frequency" value={`${customerMetrics?.avgPurchaseFrequency?.toFixed(1) || "0.0"}/period`} change={`Last ${days} days`} icon={RefreshCw} color="blue" />
            <MetricCard title="Customer Lifetime Value" value={`$${customerMetrics?.customerLifetimeValue?.toFixed(2) || "0.00"}`} change={`Last ${days} days`} icon={Award} color="purple" />
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
                    <AreaChart data={customerMetrics?.customerGrowth || []} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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

            <Card>
              <CardHeader>
                <CardTitle>Customer Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-sm font-medium">Total Customers</span>
                    <span className="text-sm font-semibold">{customerData?.totalCustomers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-sm font-medium">New This Month</span>
                    <span className="text-sm font-semibold">{customerData?.newCustomersThisMonth || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <span className="text-sm font-medium">Retention Rate</span>
                    <span className="text-sm font-semibold">{customerMetrics?.retentionRate?.toFixed(1) || "0.0"}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <span className="text-sm font-medium">Avg Purchase Frequency</span>
                    <span className="text-sm font-semibold">{customerMetrics?.avgPurchaseFrequency?.toFixed(1) || "0.0"} orders</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Customer Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Customer segmentation data will be available as more orders are placed</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>



        <TabsContent value="inventory" className="space-y-6">
          {/* Inventory Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <MetricCard title="Stock Turnover Rate" value={`${inventoryMetrics?.stockTurnoverRate?.toFixed(1) || "0.0"}x`} change="30 day rate" icon={RefreshCw} color="blue" />
            <MetricCard title="Inventory Value" value={`$${(inventoryMetrics?.inventoryValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} change="Current value" icon={Package} color="green" />
            <MetricCard title="Low Stock Items" value={inventoryMetrics?.lowStockCount || 0} change="Needs attention" icon={AlertTriangle} color="orange" />
            <MetricCard title="Out of Stock" value={inventoryMetrics?.outOfStockCount || 0} change="Urgent" icon={Package} color="red" />
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

            {/* Product Category Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Product Category Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryData && categoryData.length > 0 ? (
                    categoryData.map((category, i) => (
                      <div key={i} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium">{category.name}</h4>
                          <Badge className="bg-blue-100 text-blue-800">
                            ${Number(category.revenue || 0).toFixed(0)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>Items Sold: {category.value || 0}</div>
                          <div>Revenue: ${Number(category.revenue || 0).toFixed(2)}</div>
                        </div>
                        <div className="mt-2">
                          <div className="bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${Math.min(100, (Number(category.revenue || 0) / Math.max(...(categoryData.map(c => Number(c.revenue || 0))))) * 100)}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No category sales data available</p>
                      <p className="text-sm">Sales data will appear here once orders are placed</p>
                    </div>
                  )}
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
            <MetricCard title="Order Fulfillment Time" value={`${operationsMetrics?.avgFulfillmentTime?.toFixed(1) || "0.0"} days`} change={`Last ${days} days`} icon={Clock} color="blue" />
            <MetricCard title="Fulfillment Rate" value={`${operationsMetrics?.fulfillmentRate?.toFixed(1) || "0.0"}%`} change={`Last ${days} days`} icon={Zap} color="green" />
            <MetricCard title="Cost of Goods Sold" value={`$${(operationsMetrics?.costOfGoodsSold || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} change={`Last ${days} days`} icon={DollarSign} color="orange" />
            <MetricCard title="Avg Order Value" value={`$${salesMetrics?.averageOrderValue?.toFixed(2) || "0.00"}`} change={`Last ${days} days`} icon={Target} color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Operations Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-sm font-medium">Avg Fulfillment Time</span>
                    <span className="text-sm font-semibold">{operationsMetrics?.avgFulfillmentTime?.toFixed(1) || "0.0"} days</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-sm font-medium">Fulfillment Rate</span>
                    <span className="text-sm font-semibold">{operationsMetrics?.fulfillmentRate?.toFixed(1) || "0.0"}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <span className="text-sm font-medium">Cost of Goods Sold</span>
                    <span className="text-sm font-semibold">${(operationsMetrics?.costOfGoodsSold || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {categoryData.length === 0 ? (
                  <div className="h-48 sm:h-64 flex items-center justify-center">
                    <div className="text-center">
                      <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 dark:text-gray-400">No category data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-48 sm:h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData.map((item, index) => {
                            const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#87ceeb', '#dda0dd', '#98fb98', '#f0e68c'];
                            return { ...item, fill: colors[index % colors.length] };
                          })}
                          cx="50%"
                          cy="50%"
                          outerRadius="70%"
                          dataKey="revenue"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          fontSize={10}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Order Status Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {orderBreakdown.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No order data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orderBreakdown.map((item, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">{item.status}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{item.count} orders</span>
                        <Badge variant="outline">{totalCustomers > 0 ? ((item.count / totalCustomers) * 100).toFixed(0) : 0}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cities Tab */}
        <TabsContent value="cities" className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                    <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Active Cities</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">{cityAnalytics.length}</p>
                    <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">Last {days} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                    <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Total Orders</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {cityAnalytics.reduce((sum, c) => sum + c.total_orders, 0)}
                    </p>
                    <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">Across all cities</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Outstanding Orders</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {cityAnalytics.reduce((sum, c) => sum + c.outstanding_orders, 0)}
                    </p>
                    <p className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400">Pending + processing</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                    <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Total Revenue</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      ${cityAnalytics.reduce((sum, c) => sum + c.total_revenue, 0).toFixed(2)}
                    </p>
                    <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400">All cities combined</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by City bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Revenue by City
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cityAnalyticsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : cityAnalytics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No city data for this period</p>
                </div>
              ) : (
                <ChartContainer config={{ revenue: { label: "Revenue", color: "hsl(var(--chart-1))" }, orders: { label: "Orders", color: "hsl(var(--chart-2))" } }} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cityAnalytics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                      <XAxis dataKey="city" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]} />} />
                      <Bar dataKey="total_revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Orders by City bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Order Breakdown by City
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cityAnalyticsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : cityAnalytics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No order data for this period</p>
                </div>
              ) : (
                <ChartContainer config={{ completed: { label: "Completed", color: "hsl(var(--chart-2))" }, outstanding: { label: "Outstanding", color: "hsl(var(--chart-4))" } }} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cityAnalytics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                      <XAxis dataKey="city" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="completed_orders" name="Completed" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="outstanding_orders" name="Outstanding" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Detailed city table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                City-by-City Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cityAnalyticsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : cityAnalytics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No city data available for this period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">Total Orders</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">Processing</TableHead>
                        <TableHead className="text-right">Shipped/Done</TableHead>
                        <TableHead className="text-right">Avg Order</TableHead>
                        <TableHead className="text-right">Last Order</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cityAnalytics.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              {row.city}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{row.total_orders}</TableCell>
                          <TableCell className="text-right font-medium text-green-600 dark:text-green-400">${row.total_revenue.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {row.outstanding_orders > 0 ? (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-400 dark:text-yellow-400">
                                {row.outstanding_orders}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-orange-500">{row.pending_orders}</TableCell>
                          <TableCell className="text-right text-blue-500">{row.processing_orders}</TableCell>
                          <TableCell className="text-right text-green-500">{row.shipped_orders + (row.completed_orders - row.shipped_orders > 0 ? row.completed_orders - row.shipped_orders : 0)}</TableCell>
                          <TableCell className="text-right">${row.avg_order_value.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs text-gray-500">
                            {row.last_order_date ? new Date(row.last_order_date).toLocaleDateString() : "—"}
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
      </Tabs>
    </div>
  );
}