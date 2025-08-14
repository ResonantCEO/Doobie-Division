import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { 
  Download, 
  Users,
  UserCheck,
  Heart,
  Star,
  MessageSquare,
  Clock,
  Calendar,
  TrendingUp,
  Award,
  Target,
  Activity,
  UserPlus,
  MapPin,
  Phone,
  Mail,
  Filter,
  RefreshCw,
  Eye,
  MousePointer
} from "lucide-react";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30");
  const [activeTab, setActiveTab] = useState("behavior");

  const days = parseInt(timeRange);

  // Fetch customer behavior analytics
  const { data: customerBehavior, isLoading: behaviorLoading } = useQuery<{
    avgSessionDuration: number;
    bounceRate: number;
    pagesPerSession: number;
    repeatVisitRate: number;
  }>({
    queryKey: ["/api/analytics/customer-behavior", days],
    queryFn: async () => {
      // Mock data - would connect to actual analytics
      return {
        avgSessionDuration: 8.5,
        bounceRate: 32.4,
        pagesPerSession: 4.2,
        repeatVisitRate: 68.7
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch customer satisfaction metrics
  const { data: satisfaction, isLoading: satisfactionLoading } = useQuery<{
    overallRating: number;
    totalReviews: number;
    responseRate: number;
    nps: number;
  }>({
    queryKey: ["/api/analytics/customer-satisfaction", days],
    queryFn: async () => {
      return {
        overallRating: 4.6,
        totalReviews: 127,
        responseRate: 23.5,
        nps: 42
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch customer journey analytics
  const { data: journeyData = [], isLoading: journeyLoading } = useQuery<{ stage: string; customers: number; conversionRate: number }[]>({
    queryKey: ["/api/analytics/customer-journey", days],
    queryFn: async () => {
      return [
        { stage: "Awareness", customers: 1250, conversionRate: 100 },
        { stage: "Interest", customers: 890, conversionRate: 71.2 },
        { stage: "Consideration", customers: 645, conversionRate: 51.6 },
        { stage: "Purchase", customers: 234, conversionRate: 18.7 },
        { stage: "Retention", customers: 156, conversionRate: 12.5 },
        { stage: "Advocacy", customers: 89, conversionRate: 7.1 }
      ];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch customer engagement metrics
  const { data: engagementData = [], isLoading: engagementLoading } = useQuery<{ metric: string; current: number; previous: number; change: number }[]>({
    queryKey: ["/api/analytics/customer-engagement", days],
    queryFn: async () => {
      return [
        { metric: "Email Opens", current: 24.5, previous: 22.1, change: 2.4 },
        { metric: "Email Clicks", current: 8.7, previous: 7.9, change: 0.8 },
        { metric: "Social Shares", current: 156, previous: 134, change: 22 },
        { metric: "Profile Updates", current: 89, previous: 76, change: 13 },
        { metric: "Wishlist Adds", current: 267, previous: 245, change: 22 },
        { metric: "Review Submissions", current: 34, previous: 28, change: 6 }
      ];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch geographic distribution
  const { data: geoData = [], isLoading: geoLoading } = useQuery<{ province: string; customers: number; percentage: number }[]>({
    queryKey: ["/api/analytics/customer-geography"],
    queryFn: async () => {
      return [
        { province: "Ontario", customers: 456, percentage: 38.2 },
        { province: "British Columbia", customers: 234, percentage: 19.6 },
        { province: "Quebec", customers: 189, percentage: 15.8 },
        { province: "Alberta", customers: 167, percentage: 14.0 },
        { province: "Manitoba", customers: 89, percentage: 7.4 },
        { province: "Other", customers: 59, percentage: 4.9 }
      ];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch communication preferences
  const { data: commPreferences = [], isLoading: commLoading } = useQuery<{ method: string; preference: number; effectiveness: number }[]>({
    queryKey: ["/api/analytics/communication-preferences"],
    queryFn: async () => {
      return [
        { method: "Email", preference: 67.8, effectiveness: 24.5 },
        { method: "SMS", preference: 45.2, effectiveness: 38.9 },
        { method: "Phone", preference: 23.1, effectiveness: 52.3 },
        { method: "In-App", preference: 56.7, effectiveness: 31.2 },
        { method: "Push Notifications", preference: 34.5, effectiveness: 18.7 }
      ];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Customer lifecycle data
  const lifecycleData = [
    { stage: "New", count: 89, avgValue: 45.20, retention: 45 },
    { stage: "Active", count: 234, avgValue: 89.50, retention: 78 },
    { stage: "At Risk", count: 67, avgValue: 156.30, retention: 23 },
    { stage: "Churned", count: 34, avgValue: 203.40, retention: 0 }
  ];

  // Satisfaction breakdown data
  const satisfactionBreakdown = [
    { rating: "5 Stars", count: 67, percentage: 52.8, color: "#10B981" },
    { rating: "4 Stars", count: 34, percentage: 26.8, color: "#3B82F6" },
    { rating: "3 Stars", count: 18, percentage: 14.2, color: "#F59E0B" },
    { rating: "2 Stars", count: 6, percentage: 4.7, color: "#EF4444" },
    { rating: "1 Star", count: 2, percentage: 1.6, color: "#DC2626" }
  ];

  const chartConfig = {
    customers: { label: "Customers", color: "hsl(var(--chart-1))" },
    conversion: { label: "Conversion Rate", color: "hsl(var(--chart-2))" },
    engagement: { label: "Engagement", color: "hsl(var(--chart-3))" },
  };

  const handleExportReport = () => {
    alert("Customer analytics report export functionality would be implemented here");
  };

  if (behaviorLoading || satisfactionLoading || journeyLoading || engagementLoading || geoLoading || commLoading) {
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

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Customer Analytics & Insights</h2>

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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-1 sm:gap-0 h-auto p-1">
          <TabsTrigger value="behavior" className="text-xs sm:text-sm">Behavior</TabsTrigger>
          <TabsTrigger value="satisfaction" className="text-xs sm:text-sm">Satisfaction</TabsTrigger>
          <TabsTrigger value="journey" className="text-xs sm:text-sm">Journey</TabsTrigger>
          <TabsTrigger value="engagement" className="text-xs sm:text-sm">Engagement</TabsTrigger>
          <TabsTrigger value="demographics" className="text-xs sm:text-sm">Demographics</TabsTrigger>
        </TabsList>

        <TabsContent value="behavior" className="space-y-6">
          {/* Customer Behavior Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Avg Session Duration</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {customerBehavior?.avgSessionDuration?.toFixed(1) || "0.0"}m
                    </p>
                    <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">+1.2m from last period</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                    <Eye className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Bounce Rate</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {customerBehavior?.bounceRate?.toFixed(1) || "0.0"}%
                    </p>
                    <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">-2.1% improvement</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                    <MousePointer className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Pages per Session</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {customerBehavior?.pagesPerSession?.toFixed(1) || "0.0"}
                    </p>
                    <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400">+0.3 from last period</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                    <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Repeat Visit Rate</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {customerBehavior?.repeatVisitRate?.toFixed(1) || "0.0"}%
                    </p>
                    <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400">+4.2% increase</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Lifecycle Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Customer Lifecycle Stages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lifecycleData.map((stage, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{stage.stage} Customers</h4>
                        <Badge variant={stage.stage === 'Churned' ? 'destructive' : stage.stage === 'At Risk' ? 'secondary' : 'default'}>
                          {stage.count}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>Avg Value: ${stage.avgValue}</div>
                        <div>Retention: {stage.retention}%</div>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            stage.stage === 'New' ? 'bg-blue-600' :
                            stage.stage === 'Active' ? 'bg-green-600' :
                            stage.stage === 'At Risk' ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${(stage.count / Math.max(...lifecycleData.map(s => s.count))) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Activity Heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Activity heatmap showing peak interaction times</p>
                  <p className="text-sm text-gray-400 mt-2">Most active: Weekdays 2-4 PM</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="satisfaction" className="space-y-6">
          {/* Satisfaction Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400">
                    <Star className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Overall Rating</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {satisfaction?.overallRating?.toFixed(1) || "0.0"}/5
                    </p>
                    <p className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400">+0.2 improvement</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                    <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Total Reviews</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {satisfaction?.totalReviews || 0}
                    </p>
                    <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">+23 this month</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                    <Target className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Response Rate</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {satisfaction?.responseRate?.toFixed(1) || "0.0"}%
                    </p>
                    <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">+1.8% increase</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center">
                  <div className="p-2 sm:p-3 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                    <Award className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Net Promoter Score</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">
                      {satisfaction?.nps || 0}
                    </p>
                    <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400">Excellent range</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Satisfaction Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Rating Distribution</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ChartContainer config={chartConfig} className="h-48 sm:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={satisfactionBreakdown}
                        cx="50%"
                        cy="50%"
                        outerRadius="70%"
                        dataKey="count"
                        label={({ rating, percentage }) => `${rating}: ${percentage}%`}
                        fontSize={10}
                      >
                        {satisfactionBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Satisfaction Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { period: "This Month", rating: 4.6, reviews: 42, trend: "+0.2" },
                    { period: "Last Month", rating: 4.4, reviews: 38, trend: "+0.1" },
                    { period: "2 Months Ago", rating: 4.3, reviews: 35, trend: "-0.1" },
                    { period: "3 Months Ago", rating: 4.4, reviews: 31, trend: "+0.3" }
                  ].map((period, i) => (
                    <div key={i} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <div className="font-medium">{period.period}</div>
                        <div className="text-sm text-gray-500">{period.reviews} reviews</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{period.rating}/5</div>
                        <div className={`text-sm ${period.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                          {period.trend}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="journey" className="space-y-6">
          {/* Customer Journey Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Journey Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={journeyData} layout="horizontal" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="stage" type="category" width={100} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="customers" fill="var(--color-customers)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Journey Stage Details */}
          <Card>
            <CardHeader>
              <CardTitle>Journey Stage Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Customers</TableHead>
                      <TableHead>Conversion Rate</TableHead>
                      <TableHead>Drop-off</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journeyData.map((stage, index) => {
                      const nextStage = journeyData[index + 1];
                      const dropoff = nextStage ? stage.customers - nextStage.customers : 0;
                      const dropoffRate = nextStage ? ((dropoff / stage.customers) * 100).toFixed(1) : "0";

                      return (
                        <TableRow key={stage.stage}>
                          <TableCell className="font-medium">{stage.stage}</TableCell>
                          <TableCell>{stage.customers.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={stage.conversionRate > 50 ? "default" : stage.conversionRate > 20 ? "secondary" : "destructive"}>
                              {stage.conversionRate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-red-600">
                            {nextStage ? `-${dropoff} (${dropoffRate}%)` : "—"}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">Optimize</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          {/* Engagement Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Engagement Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {engagementData.map((metric, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-sm">{metric.metric}</h4>
                      <Badge variant={metric.change > 0 ? "default" : "destructive"} className="text-xs">
                        {metric.change > 0 ? "+" : ""}{metric.change}
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold mb-1">
                      {metric.metric.includes("Rate") ? `${metric.current}%` : metric.current}
                    </div>
                    <div className="text-sm text-gray-500">
                      Previous: {metric.metric.includes("Rate") ? `${metric.previous}%` : metric.previous}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Communication Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Communication Channel Effectiveness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Customer Preference</TableHead>
                      <TableHead>Engagement Rate</TableHead>
                      <TableHead>Effectiveness Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commPreferences.map((pref, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            {pref.method === 'Email' && <Mail className="h-4 w-4 mr-2" />}
                            {pref.method === 'SMS' && <MessageSquare className="h-4 w-4 mr-2" />}
                            {pref.method === 'Phone' && <Phone className="h-4 w-4 mr-2" />}
                            {pref.method === 'In-App' && <Activity className="h-4 w-4 mr-2" />}
                            {pref.method === 'Push Notifications' && <MessageSquare className="h-4 w-4 mr-2" />}
                            {pref.method}
                          </div>
                        </TableCell>
                        <TableCell>{pref.preference}%</TableCell>
                        <TableCell>{pref.effectiveness}%</TableCell>
                        <TableCell>
                          <Badge variant={
                            pref.effectiveness > 40 ? "default" :
                            pref.effectiveness > 25 ? "secondary" : "destructive"
                          }>
                            {pref.effectiveness > 40 ? "High" : pref.effectiveness > 25 ? "Medium" : "Low"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-6">
          {/* Geographic Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Geographic Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {geoData.map((geo, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="font-medium">{geo.province}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{geo.customers} customers</span>
                        <Badge variant="outline">{geo.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Acquisition Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { channel: "Organic Search", customers: 456, percentage: 38.2 },
                    { channel: "Social Media", customers: 289, percentage: 24.1 },
                    { channel: "Referrals", customers: 234, percentage: 19.5 },
                    { channel: "Direct", customers: 167, percentage: 14.0 },
                    { channel: "Paid Advertising", customers: 52, percentage: 4.3 }
                  ].map((channel, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="font-medium">{channel.channel}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{channel.customers}</span>
                        <Badge variant="outline">{channel.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Profile Completion */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Profile Completeness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { field: "Basic Info", completion: 94.2, required: true },
                  { field: "Address", completion: 78.5, required: true },
                  { field: "Phone Number", completion: 89.3, required: true },
                  { field: "Preferences", completion: 45.7, required: false }
                ].map((field, i) => (
                  <div key={i} className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold mb-1">{field.completion}%</div>
                    <div className="text-sm font-medium mb-2">{field.field}</div>
                    {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    {!field.required && <Badge variant="secondary" className="text-xs">Optional</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}