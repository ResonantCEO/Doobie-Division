import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { MessageCircle, User as UserIcon, Clock, AlertTriangle, Eye, Send, ArrowUpDown, ArrowUp, ArrowDown, Trash2, MapPin, Plus, DollarSign, Pencil } from "lucide-react";
import type { InventoryLog, Product, User, SupportTicket, CityPurchaseLimit } from "@shared/schema";

interface InventoryLogWithDetails extends InventoryLog {
  product: Product | null;
  user: User | null;
}

interface SupportTicketWithDetails {
  ticket: SupportTicket;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  assignedUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

type SortField = 'createdAt' | 'product' | 'sku' | 'type' | 'quantity' | 'previousStock' | 'newStock' | 'changedBy' | 'reason';
type SortDirection = 'asc' | 'desc';

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("support");
  const [dateFilter, setDateFilter] = useState("7"); // days
  const [typeFilter, setTypeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketResponse, setTicketResponse] = useState("");
  const [responseType, setResponseType] = useState("customer_response");
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteTicketConfirmOpen, setDeleteTicketConfirmOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<SupportTicketWithDetails | null>(null);
  const [showAddLimitModal, setShowAddLimitModal] = useState(false);
  const [editingLimit, setEditingLimit] = useState<CityPurchaseLimit | null>(null);
  const [limitForm, setLimitForm] = useState({ cityName: "", minimumAmount: "" });
  const [deleteLimitConfirmOpen, setDeleteLimitConfirmOpen] = useState(false);
  const [limitToDelete, setLimitToDelete] = useState<CityPurchaseLimit | null>(null);


  // Redirect if not admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  const { data: inventoryLogs = [], isLoading } = useQuery<InventoryLogWithDetails[]>({
    queryKey: ["/api/admin/inventory-logs", { days: dateFilter, type: typeFilter, product: productFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFilter && dateFilter !== 'all') params.append('days', dateFilter);
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);
      if (productFilter) params.append('product', productFilter);

      const response = await fetch(`/api/admin/inventory-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch inventory logs');
      return response.json();
    }
  });

  const { data: cityLimits = [], isLoading: isLoadingLimits } = useQuery<CityPurchaseLimit[]>({
    queryKey: ["/api/city-purchase-limits"],
    queryFn: async () => {
      const response = await fetch("/api/city-purchase-limits", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch city purchase limits");
      return response.json();
    },
  });

  const createLimitMutation = useMutation({
    mutationFn: async (data: { cityName: string; minimumAmount: string }) => {
      const response = await fetch("/api/city-purchase-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(result.message || "Failed to create");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-purchase-limits"] });
      setShowAddLimitModal(false);
      setLimitForm({ cityName: "", minimumAmount: "" });
      toast({ title: "City purchase limit created successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create city purchase limit", variant: "destructive" });
    },
  });

  const updateLimitMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/city-purchase-limits/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(result.message || "Failed to update");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-purchase-limits"] });
      setEditingLimit(null);
      setLimitForm({ cityName: "", minimumAmount: "" });
      toast({ title: "City purchase limit updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update city purchase limit", variant: "destructive" });
    },
  });

  const deleteLimitMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/city-purchase-limits/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(result.message || "Failed to delete");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-purchase-limits"] });
      setDeleteLimitConfirmOpen(false);
      setLimitToDelete(null);
      toast({ title: "City purchase limit deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete city purchase limit", variant: "destructive" });
    },
  });

  const { data: supportTickets = [], isLoading: isLoadingTickets } = useQuery<SupportTicketWithDetails[]>({
    queryKey: ["/api/support/tickets", { status: ticketStatusFilter, priority: ticketPriorityFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ticketStatusFilter && ticketStatusFilter !== 'all') params.append('status', ticketStatusFilter);
      if (ticketPriorityFilter && ticketPriorityFilter !== 'all') params.append('priority', ticketPriorityFilter);

      const response = await fetch(`/api/support/tickets?${params}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error('Failed to fetch support tickets');
      return response.json();
    }
  });



  const updateTicketStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: number; status: string }) => {
      const response = await fetch(`/api/support/tickets/${ticketId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update ticket status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket status updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update ticket status", variant: "destructive" });
    },
  });



  const sendTicketResponseMutation = useMutation({
    mutationFn: async ({ ticketId, response, type }: { ticketId: number; response: string; type: string }) => {
      const res = await fetch(`/api/support/tickets/${ticketId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response, type }),
      });
      if (!res.ok) throw new Error('Failed to send response');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Response sent successfully" });
      setShowTicketModal(false);
      setTicketResponse("");
    },
    onError: () => {
      toast({ title: "Failed to send response", variant: "destructive" });
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error('Failed to delete ticket');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setDeleteTicketConfirmOpen(false);
      setTicketToDelete(null);
      toast({ title: "Support ticket deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete support ticket", variant: "destructive" });
    },
  });

  const handleDeleteTicket = (item: SupportTicketWithDetails) => {
    setTicketToDelete(item);
    setDeleteTicketConfirmOpen(true);
  };

  const confirmDeleteTicket = () => {
    if (ticketToDelete) {
      deleteTicketMutation.mutate(ticketToDelete.ticket.id);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'stock_in': return 'bg-green-100 text-green-800';
      case 'stock_out': return 'bg-red-100 text-red-800';
      case 'adjustment': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'stock_in': return 'Stock In';
      case 'stock_out': return 'Stock Out';
      case 'adjustment': return 'Adjustment';
      default: return type;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-blue-100 text-blue-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleUpdateTicketStatus = (ticketId: number, status: string) => {
    updateTicketStatusMutation.mutate({ ticketId, status });
  };



  const handleTicketView = (ticket: SupportTicketWithDetails) => {
    setSelectedTicket(ticket);
    setShowTicketModal(true);
  };

  const handleCloseTicketModal = () => {
    setShowTicketModal(false);
    setSelectedTicket(null);
    setTicketResponse("");
  };

  const handleSendResponse = () => {
    if (selectedTicket && ticketResponse) {
      sendTicketResponseMutation.mutate({
        ticketId: selectedTicket.ticket.id,
        response: ticketResponse,
        type: responseType,
      });
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const filteredLogs = inventoryLogs.filter(log => {
    const matchesSearch = productFilter === "" || 
      log.product?.name?.toLowerCase().includes(productFilter.toLowerCase()) ||
      log.product?.sku?.toLowerCase().includes(productFilter.toLowerCase()) ||
      log.user?.firstName?.toLowerCase().includes(productFilter.toLowerCase()) ||
      log.user?.lastName?.toLowerCase().includes(productFilter.toLowerCase());

    const matchesType = typeFilter === "all" || log.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'product':
        aValue = a.product?.name?.toLowerCase() || '';
        bValue = b.product?.name?.toLowerCase() || '';
        break;
      case 'sku':
        aValue = a.product?.sku?.toLowerCase() || '';
        bValue = b.product?.sku?.toLowerCase() || '';
        break;
      case 'type':
        aValue = a.type.toLowerCase();
        bValue = b.type.toLowerCase();
        break;
      case 'quantity':
        aValue = Math.abs(a.quantity);
        bValue = Math.abs(b.quantity);
        break;
      case 'previousStock':
        aValue = a.previousStock;
        bValue = b.previousStock;
        break;
      case 'newStock':
        aValue = a.newStock;
        bValue = b.newStock;
        break;
      case 'changedBy':
        const aName = a.user?.firstName && a.user?.lastName 
          ? `${a.user.firstName} ${a.user.lastName}`.toLowerCase()
          : a.user?.email?.toLowerCase() || '';
        const bName = b.user?.firstName && b.user?.lastName 
          ? `${b.user.firstName} ${b.user.lastName}`.toLowerCase()
          : b.user?.email?.toLowerCase() || '';
        aValue = aName;
        bValue = bName;
        break;
      case 'reason':
        aValue = a.reason?.toLowerCase() || '';
        bValue = b.reason?.toLowerCase() || '';
        break;
      default:
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
    }

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h2>
        <p className="text-gray-600">Administrative tools and reports</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="support">Support Tickets</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="purchase-limits">Purchase Limits</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          {/* Inventory Changes Section */}
          <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <p className="text-sm text-gray-600">
            Track all stock adjustments, additions, and removals made to products
          </p>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Time Period</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Change Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="stock_in">Stock In</SelectItem>
                  <SelectItem value="stock_out">Stock Out</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Product Search</label>
              <Input
                placeholder="Search by product name or SKU"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Inventory Logs */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          ) : sortedLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No inventory changes found for the selected filters
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {sortedLogs.map((log) => (
                  <div key={log.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(log.createdAt!), 'MMM dd, yyyy HH:mm')}
                      </span>
                      <Badge className={getTypeColor(log.type)}>
                        {getTypeLabel(log.type)}
                      </Badge>
                    </div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {log.product?.name || 'Unknown Product'}
                    </div>
                    {log.product?.sku && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {log.product.sku}</div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Quantity</span>
                      <span className={`font-medium ${log.type === 'stock_out' ? 'text-red-600 dark:text-red-400' : log.type === 'stock_in' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                        {log.type === 'stock_out' ? '-' : log.type === 'stock_in' ? '+' : '±'}{log.quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Stock</span>
                      <span className="text-gray-900 dark:text-white">{log.previousStock} &rarr; {log.newStock}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Changed By</span>
                      <span className="text-gray-900 dark:text-white">
                        {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                      </span>
                    </div>
                    {log.reason && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
                        {log.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('createdAt')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Date & Time {getSortIcon('createdAt')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('product')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Product {getSortIcon('product')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('sku')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          SKU {getSortIcon('sku')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('type')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Type {getSortIcon('type')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('quantity')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Quantity {getSortIcon('quantity')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('previousStock')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Previous Stock {getSortIcon('previousStock')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('newStock')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          New Stock {getSortIcon('newStock')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('changedBy')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Changed By {getSortIcon('changedBy')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('reason')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Reason {getSortIcon('reason')}
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {format(new Date(log.createdAt!), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-black dark:text-white">
                            {log.product?.name || 'Unknown Product'}
                          </div>
                        </TableCell>
                        <TableCell className="text-black dark:text-white">
                          {log.product?.sku || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(log.type)}>
                            {getTypeLabel(log.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-black dark:text-white">
                          <span className={log.type === 'stock_out' ? 'text-red-600 dark:text-red-400' : log.type === 'stock_in' ? 'text-green-600 dark:text-green-400' : ''}>
                            {log.type === 'stock_out' ? '-' : log.type === 'stock_in' ? '+' : '±'}{log.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-black dark:text-white">{log.previousStock}</TableCell>
                        <TableCell className="text-black dark:text-white font-medium">{log.newStock}</TableCell>
                        <TableCell className="text-black dark:text-white">
                          {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                        </TableCell>
                        <TableCell className="text-black dark:text-white max-w-xs truncate">
                          {log.reason || 'No reason provided'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="support">
          {/* Support Tickets Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="h-5 w-5 mr-2" />
                Support Ticket Management
              </CardTitle>
              <p className="text-sm text-gray-600">
                Manage customer support tickets and assign them to staff members
              </p>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-6">
              </div>

              {/* Support Tickets */}
              {isLoadingTickets ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : supportTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No support tickets found for the selected filters
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {supportTickets.map((item) => (
                      <div key={item.ticket.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {item.ticket.customerName || (item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Anonymous')}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {item.ticket.customerEmail || item.user?.email || 'No email'}
                            </div>
                            {item.ticket.customerPhone && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                📞 {item.ticket.customerPhone}
                              </div>
                            )}
                          </div>
                          <Badge className={getStatusColor(item.ticket.status)}>
                            {item.ticket.status === 'in_progress' ? 'In Progress' : item.ticket.status.charAt(0).toUpperCase() + item.ticket.status.slice(1)}
                          </Badge>
                        </div>
                        {item.ticket.message && (
                          <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{item.ticket.message}</div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(item.ticket.createdAt!), 'MMM dd, yyyy HH:mm')}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <Select
                            value={item.ticket.status}
                            onValueChange={(status) => handleUpdateTicketStatus(item.ticket.id, status)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTicket(item)}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date Created</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supportTickets.map((item) => (
                          <TableRow key={item.ticket.id}>
                            <TableCell className="font-medium">
                              {format(new Date(item.ticket.createdAt!), 'MMM dd, yyyy HH:mm')}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <UserIcon className="h-4 w-4 text-gray-400" />
                                <div>
                                  <div className="font-medium text-black dark:text-white">
                                    {item.ticket.customerName || (item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Anonymous')}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {item.ticket.customerEmail || item.user?.email || 'No email'}
                                  </div>
                                  {item.ticket.customerPhone && (
                                    <div className="text-xs text-gray-400">
                                      📞 {item.ticket.customerPhone}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.ticket.status}
                                onValueChange={(status) => handleUpdateTicketStatus(item.ticket.id, status)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="resolved">Resolved</SelectItem>
                                  <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleTicketView(item)}
                                  className="text-xs"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteTicket(item)}
                                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchase-limits">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  City Purchase Limits
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Set minimum order amounts for specific cities. Users shipping to these cities must meet the minimum purchase amount.
                </p>
              </div>
              <Button onClick={() => {
                setLimitForm({ cityName: "", minimumAmount: "" });
                setEditingLimit(null);
                setShowAddLimitModal(true);
              }}>
                <Plus className="h-4 w-4 mr-2" /> Add City Limit
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingLimits ? (
                <p className="text-center text-gray-500 py-4">Loading...</p>
              ) : cityLimits.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No city purchase limits configured yet. Add one to get started.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">City</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Minimum Amount</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Status</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {cityLimits.map((limit: CityPurchaseLimit) => (
                        <tr key={limit.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3 text-sm font-medium">{limit.cityName}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {parseFloat(limit.minimumAmount).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant={limit.isActive ? "default" : "secondary"}>
                              {limit.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  updateLimitMutation.mutate({
                                    id: limit.id,
                                    data: { isActive: !limit.isActive },
                                  });
                                }}
                              >
                                {limit.isActive ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingLimit(limit);
                                  setLimitForm({
                                    cityName: limit.cityName,
                                    minimumAmount: limit.minimumAmount,
                                  });
                                  setShowAddLimitModal(true);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setLimitToDelete(limit);
                                  setDeleteLimitConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit City Purchase Limit Dialog */}
      <Dialog open={showAddLimitModal} onOpenChange={(open) => {
        setShowAddLimitModal(open);
        if (!open) {
          setEditingLimit(null);
          setLimitForm({ cityName: "", minimumAmount: "" });
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingLimit ? "Edit" : "Add"} City Purchase Limit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>City Name</Label>
              <Input
                placeholder="Enter city name"
                value={limitForm.cityName}
                onChange={(e) => setLimitForm({ ...limitForm, cityName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum Order Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={limitForm.minimumAmount}
                onChange={(e) => setLimitForm({ ...limitForm, minimumAmount: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddLimitModal(false);
              setEditingLimit(null);
              setLimitForm({ cityName: "", minimumAmount: "" });
            }}>
              Cancel
            </Button>
            <Button
              disabled={!limitForm.cityName || !limitForm.minimumAmount || createLimitMutation.isPending || updateLimitMutation.isPending}
              onClick={() => {
                if (editingLimit) {
                  updateLimitMutation.mutate({
                    id: editingLimit.id,
                    data: {
                      cityName: limitForm.cityName,
                      minimumAmount: limitForm.minimumAmount,
                    },
                  });
                } else {
                  createLimitMutation.mutate({
                    cityName: limitForm.cityName,
                    minimumAmount: limitForm.minimumAmount,
                  });
                }
              }}
            >
              {(createLimitMutation.isPending || updateLimitMutation.isPending) ? "Saving..." : editingLimit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Limit Confirmation Dialog */}
      <Dialog open={deleteLimitConfirmOpen} onOpenChange={setDeleteLimitConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete City Purchase Limit</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete the purchase limit for <strong>{limitToDelete?.cityName}</strong>? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLimitConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (limitToDelete) deleteLimitMutation.mutate(limitToDelete.id);
            }} disabled={deleteLimitMutation.isPending}>
              {deleteLimitMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Ticket Confirmation Dialog */}
      <Dialog open={deleteTicketConfirmOpen} onOpenChange={setDeleteTicketConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to permanently delete this support ticket from <strong>{ticketToDelete?.ticket.customerName || 'Unknown'}</strong>?
            </p>
            <p className="text-sm text-red-600 mt-2 font-medium">
              This action cannot be undone. The ticket and all its responses will be permanently removed.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteTicketConfirmOpen(false);
                setTicketToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteTicket}
              disabled={deleteTicketMutation.isPending}
            >
              {deleteTicketMutation.isPending ? "Deleting..." : "Delete Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Review Modal */}
      <Dialog open={showTicketModal} onOpenChange={handleCloseTicketModal}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Ticket #{selectedTicket?.ticket.id} - {selectedTicket?.ticket.subject}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-gray-400" />
              <span className="font-semibold">Customer:</span>
              <span>{selectedTicket?.ticket.customerName || (selectedTicket?.user ? `${selectedTicket.user.firstName} ${selectedTicket.user.lastName}` : 'Anonymous')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              <span className="font-semibold">Created:</span>
              <span>{selectedTicket?.ticket.createdAt ? format(new Date(selectedTicket.ticket.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-gray-400" />
              <span className="font-semibold">Priority:</span>
              <Badge className={getPriorityColor(selectedTicket?.ticket.priority || 'normal')}>
                {selectedTicket?.ticket.priority.charAt(0).toUpperCase() + selectedTicket?.ticket.priority.slice(1)}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-gray-400" />
                <span className="font-semibold">Message:</span>
              </div>
              <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
                {selectedTicket?.ticket.message}
              </p>
            </div>
            <hr />
            <div className="space-y-2">
              <label className="block text-sm font-medium">Your Response</label>
              <Textarea
                placeholder="Write your response to the customer..."
                value={ticketResponse}
                onChange={(e) => setTicketResponse(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseTicketModal}>
              Cancel
            </Button>
            <Button onClick={handleSendResponse} disabled={!ticketResponse || sendTicketResponseMutation.isPending}>
              {sendTicketResponseMutation.isPending ? 'Sending...' : 'Send Response'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}