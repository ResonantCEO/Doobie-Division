
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { MessageCircle, User as UserIcon, Clock, AlertTriangle } from "lucide-react";
import type { InventoryLog, Product, User, SupportTicket } from "@shared/schema";

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

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("inventory");
  const [dateFilter, setDateFilter] = useState("7"); // days
  const [typeFilter, setTypeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("all");

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

  const { data: staffUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users/staff"],
    queryFn: async () => {
      const response = await fetch("/api/users/staff", {
        credentials: "include"
      });
      if (!response.ok) throw new Error('Failed to fetch staff users');
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

  const assignTicketMutation = useMutation({
    mutationFn: async ({ ticketId, assignedTo }: { ticketId: number; assignedTo: string | null }) => {
      const response = await fetch(`/api/support/tickets/${ticketId}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignedTo }),
      });
      if (!response.ok) throw new Error('Failed to assign ticket');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign ticket", variant: "destructive" });
    },
  });

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

  const handleAssignTicket = (ticketId: number, assignedTo: string) => {
    assignTicketMutation.mutate({ 
      ticketId, 
      assignedTo: assignedTo === "unassigned" ? null : assignedTo 
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h2>
        <p className="text-gray-600">Administrative tools and reports</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inventory">Inventory Logs</TabsTrigger>
          <TabsTrigger value="support">Support Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          {/* Inventory Changes Section */}
          <Card>
        <CardHeader>
          <CardTitle>Product Inventory Changes</CardTitle>
          <p className="text-sm text-gray-600">
            Track all stock adjustments, additions, and removals made to products
          </p>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
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

          {/* Inventory Logs Table */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Previous Stock</TableHead>
                    <TableHead>New Stock</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        No inventory changes found for the selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    inventoryLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {format(new Date(log.createdAt!), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-black dark:text-white">
                              {log.product?.name || 'Unknown Product'}
                            </div>
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <Select value={ticketPriorityFilter} onValueChange={setTicketPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Support Tickets Table */}
              {isLoadingTickets ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date Created</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supportTickets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            No support tickets found for the selected filters
                          </TableCell>
                        </TableRow>
                      ) : (
                        supportTickets.map((item) => (
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
                            <TableCell className="max-w-xs">
                              <div className="font-medium text-black dark:text-white truncate">
                                {item.ticket.subject}
                              </div>
                              <div className="text-sm text-gray-500 truncate">
                                {item.ticket.message}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getPriorityColor(item.ticket.priority)}>
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {item.ticket.priority.charAt(0).toUpperCase() + item.ticket.priority.slice(1)}
                              </Badge>
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
                              <Select
                                value={item.ticket.assignedTo || "unassigned"}
                                onValueChange={(assignedTo) => handleAssignTicket(item.ticket.id, assignedTo)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue placeholder="Assign..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                  {staffUsers.map((staff) => (
                                    <SelectItem key={staff.id} value={staff.id}>
                                      {staff.firstName} {staff.lastName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                <Clock className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-500">
                                  {format(new Date(item.ticket.updatedAt!), 'MMM dd')}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
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
