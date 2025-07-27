
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import type { InventoryLog, Product, User } from "@shared/schema";

interface InventoryLogWithDetails extends InventoryLog {
  product: Product | null;
  user: User | null;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState("7"); // days
  const [typeFilter, setTypeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("");

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
      if (dateFilter) params.append('days', dateFilter);
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);
      if (productFilter) params.append('product', productFilter);
      
      const response = await fetch(`/api/admin/inventory-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch inventory logs');
      return response.json();
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
        <p className="text-gray-600">Administrative tools and reports</p>
      </div>

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
                  <SelectItem value="">All time</SelectItem>
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
                            <div className="font-medium text-black">
                              {log.product?.name || 'Unknown Product'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-black">
                          {log.product?.sku || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(log.type)}>
                            {getTypeLabel(log.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-black">
                          <span className={log.type === 'stock_out' ? 'text-red-600' : log.type === 'stock_in' ? 'text-green-600' : ''}>
                            {log.type === 'stock_out' ? '-' : log.type === 'stock_in' ? '+' : '±'}{log.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-black">{log.previousStock}</TableCell>
                        <TableCell className="text-black font-medium">{log.newStock}</TableCell>
                        <TableCell className="text-black">
                          {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                        </TableCell>
                        <TableCell className="text-black max-w-xs truncate">
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
    </div>
  );
}
