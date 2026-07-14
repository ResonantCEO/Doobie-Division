import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Route, Plus, CheckCircle2, MapPin, Package, Trash2 } from "lucide-react";
import type { Order } from "@shared/schema";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const ROUTING_STORAGE_KEY = "route_management_routing";
const ROUTED_STORAGE_KEY = "route_management_routed";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function extractCity(shippingAddress: string): string {
  const parts = shippingAddress.split(",").map((p) => p.trim());
  return parts.length >= 2 ? parts[1] : "Unknown";
}

function parseAddress(addr: string) {
  const parts = addr.split(",").map((p) => p.trim());
  return {
    line1: parts[0] ?? "",
    city: parts[1] ?? "",
    state: parts[2] ?? "",
    zip: parts[3] ?? "",
  };
}

function buildCsv(orders: Order[]): string {
  const escape = (val: string | null | undefined) => {
    const s = String(val ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const headers = [
    "Name",
    "Phone",
    "Email",
    "Address Line 1",
    "City",
    "State",
    "Zip",
    "Package Size",
    "Order Number",
    "Order Total",
    "Date",
    "Notes",
  ];

  const rows = orders.map((o) => {
    const addr = parseAddress(o.shippingAddress);
    return [
      escape(o.customerName),
      escape(o.customerPhone),
      escape(o.customerEmail),
      escape(addr.line1),
      escape(addr.city),
      escape(addr.state),
      escape(addr.zip),
      escape(Number(o.total).toFixed(2)),
      escape(o.orderNumber),
      escape(Number(o.total).toFixed(2)),
      escape(o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ""),
      escape(o.notes),
    ];
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

interface RouteManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

interface RoutedExport {
  exportedAt: string;
  orders: Order[];
  filename: string;
}

export default function RouteManagementModal({ isOpen, onClose, orders }: RouteManagementModalProps) {
  const { toast } = useToast();

  const [routingIds, setRoutingIds] = useState<number[]>(() =>
    loadFromStorage<number[]>(ROUTING_STORAGE_KEY, [])
  );
  const [routedExports, setRoutedExports] = useState<RoutedExport[]>(() =>
    loadFromStorage<RoutedExport[]>(ROUTED_STORAGE_KEY, [])
  );

  const routingOrders = useMemo(
    () => orders.filter((o) => routingIds.includes(o.id)),
    [orders, routingIds]
  );

  const routedOrderIds = useMemo(
    () => new Set(routedExports.flatMap((r) => r.orders.map((o) => o.id))),
    [routedExports]
  );

  const addToRoute = (order: Order) => {
    if (routingIds.includes(order.id)) return;
    const updated = [...routingIds, order.id];
    setRoutingIds(updated);
    saveToStorage(ROUTING_STORAGE_KEY, updated);
    toast({ title: "Added to route", description: `Order ${order.orderNumber} added to routing queue.` });
  };

  const removeFromRoute = (orderId: number) => {
    const updated = routingIds.filter((id) => id !== orderId);
    setRoutingIds(updated);
    saveToStorage(ROUTING_STORAGE_KEY, updated);
  };

  const handleExportRoute = () => {
    if (routingOrders.length === 0) {
      toast({ title: "Nothing to export", description: "Add orders to the route first.", variant: "destructive" });
      return;
    }

    const csv = buildCsv(routingOrders);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const filename = `route-export-${new Date().toISOString().slice(0, 10)}.csv`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const newExport: RoutedExport = {
      exportedAt: new Date().toISOString(),
      orders: [...routingOrders],
      filename,
    };

    const updatedExports = [newExport, ...routedExports];
    setRoutedExports(updatedExports);
    saveToStorage(ROUTED_STORAGE_KEY, updatedExports);

    const clearedIds: number[] = [];
    setRoutingIds(clearedIds);
    saveToStorage(ROUTING_STORAGE_KEY, clearedIds);

    toast({ title: "Route exported", description: `${routingOrders.length} order(s) exported and moved to Routed.` });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Route className="h-5 w-5 text-primary" />
            Route Management
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="orders" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-3">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="orders" className="flex-1 sm:flex-initial">
                All Orders
                <Badge variant="secondary" className="ml-2">{orders.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="routing" className="flex-1 sm:flex-initial">
                Routing
                {routingIds.length > 0 && (
                  <Badge className="ml-2 bg-amber-500 text-white">{routingIds.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="routed" className="flex-1 sm:flex-initial">
                Routed
                {routedExports.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{routedExports.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* All Orders Tab */}
          <TabsContent value="orders" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-[calc(90vh-200px)]">
              <div className="px-6 py-4 space-y-2">
                {orders.length === 0 ? (
                  <p className="text-center text-gray-500 py-10">No orders available.</p>
                ) : (
                  orders.map((order) => {
                    const inRouting = routingIds.includes(order.id);
                    const alreadyRouted = routedOrderIds.has(order.id);
                    const addr = parseAddress(order.shippingAddress);

                    return (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{order.orderNumber}</span>
                            <Badge
                              variant="outline"
                              className={
                                order.status === "pending"
                                  ? "text-yellow-600 border-yellow-400"
                                  : order.status === "processing"
                                  ? "text-blue-600 border-blue-400"
                                  : order.status === "shipped"
                                  ? "text-green-600 border-green-400"
                                  : "text-gray-500 border-gray-400"
                              }
                            >
                              {order.status}
                            </Badge>
                            {alreadyRouted && (
                              <Badge variant="secondary" className="text-xs">Routed</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{order.customerName}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{addr.line1}, {addr.city}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-semibold text-sm">${Number(order.total).toFixed(2)}</span>
                          <Button
                            size="sm"
                            variant={inRouting ? "secondary" : "default"}
                            disabled={inRouting}
                            onClick={() => addToRoute(order)}
                            className="whitespace-nowrap"
                          >
                            {inRouting ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add to Route
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Routing Tab */}
          <TabsContent value="routing" className="flex-1 overflow-hidden mt-0">
            <div className="px-6 py-3 border-b flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {routingOrders.length} order(s) queued for export
              </p>
              <Button
                size="sm"
                onClick={handleExportRoute}
                disabled={routingOrders.length === 0}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Export Route
              </Button>
            </div>
            <ScrollArea className="h-[calc(90vh-230px)]">
              <div className="px-6 py-4 space-y-2">
                {routingOrders.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No orders in routing queue</p>
                    <p className="text-sm mt-1">Add orders from the All Orders tab.</p>
                  </div>
                ) : (
                  routingOrders.map((order) => {
                    const addr = parseAddress(order.shippingAddress);
                    return (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{order.orderNumber}</span>
                            <Badge
                              variant="outline"
                              className={
                                order.status === "pending"
                                  ? "text-yellow-600 border-yellow-400"
                                  : order.status === "processing"
                                  ? "text-blue-600 border-blue-400"
                                  : "text-gray-500 border-gray-400"
                              }
                            >
                              {order.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{order.customerName}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{addr.line1}, {addr.city}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-semibold text-sm">${Number(order.total).toFixed(2)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => removeFromRoute(order.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Routed Tab */}
          <TabsContent value="routed" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-[calc(90vh-200px)]">
              <div className="px-6 py-4 space-y-4">
                {routedExports.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No exported routes yet</p>
                    <p className="text-sm mt-1">Export a route from the Routing tab to see it here.</p>
                  </div>
                ) : (
                  routedExports.map((exportEntry, idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                        <div>
                          <p className="font-semibold text-sm">{exportEntry.filename}</p>
                          <p className="text-xs text-gray-500">
                            Exported {format(new Date(exportEntry.exportedAt), "MMM d, yyyy 'at' h:mm a")}
                            {" · "}
                            {exportEntry.orders.length} order(s)
                          </p>
                        </div>
                      </div>
                      <div className="divide-y">
                        {exportEntry.orders.map((order) => {
                          const addr = parseAddress(order.shippingAddress);
                          return (
                            <div key={order.id} className="flex items-center gap-3 px-4 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{order.orderNumber}</span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{order.customerName}</p>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <MapPin className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{addr.line1}, {addr.city}</span>
                                </div>
                              </div>
                              <span className="text-sm font-semibold flex-shrink-0">${Number(order.total).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
