import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users as UsersIcon, 
  UserCheck, 
  UserPlus, 
  Clock, 
  ShieldQuestion,
  Edit,
  History,
  UserX,
  Check,
  X,
  MoreHorizontal,
  Activity,
  Save,
  ShoppingCart,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import type { User } from "@shared/schema";

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPhotoType, setSelectedPhotoType] = useState<'id' | 'verification' | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [editData, setEditData] = useState<any>({});
  const [suspendConfirmOpen, setSuspendConfirmOpen] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState<User | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);


  // Fetch users with stats
  const { data: users = [], isLoading } = useQuery<(User & { orderCount?: number })[]>({
    queryKey: ["/api/users"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Update user status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      await apiRequest("PUT", `/api/users/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("PUT", `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  // Update user details mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: string; userData: any }) => {
      await apiRequest("PUT", `/api/users/${userId}`, userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditModalOpen(false);
      setEditingUser(null);
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      toast({
        title: "Success",
        description: "User has been permanently deleted",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error?.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const getUserStats = () => {
    const stats = {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      pending: users.filter(u => u.status === 'pending').length,
      admins: users.filter(u => u.role === 'admin').length,
    };
    return stats;
  };

  const stats = getUserStats();
  const pendingUsers = users.filter(u => u.status === 'pending');

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return <Badge className="role-admin">Admin</Badge>;
      case "manager":
        return <Badge className="role-manager">Manager</Badge>;
      case "staff":
        return <Badge className="role-manager">Staff</Badge>;
      case "customer":
      case "user":
        return <Badge className="role-customer">Customer</Badge>;
      default:
        return <Badge variant="outline">{role || 'Unknown'}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="status-active">Active</Badge>;
      case "pending":
        return <Badge className="status-pending">Pending</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleApproveUser = (userId: string) => {
    updateStatusMutation.mutate({ userId, status: "active" });
  };

  const handleRejectUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setUserToSuspend(user);
      setSuspendConfirmOpen(true);
    }
  };

  const handleSuspendUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setUserToSuspend(user);
      setSuspendConfirmOpen(true);
    }
  };

  const confirmSuspendUser = () => {
    if (userToSuspend) {
      updateStatusMutation.mutate({ userId: userToSuspend.id, status: "suspended" });
    }
    setSuspendConfirmOpen(false);
    setUserToSuspend(null);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditData({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role === 'user' ? 'customer' : user.role,
      status: user.status,
      address: user.address,
      city: user.city,
      state: user.state,
      postalCode: user.postalCode,
      minPurchaseExempt: user.minPurchaseExempt || false,
      minPurchaseOverride: user.minPurchaseOverride || "",
    });
    setEditModalOpen(true);
  };

  const handleViewActivity = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      try {
        const response = await apiRequest("GET", `/api/users/${userId}/activity?limit=20`);
        // Ensure response is an array
        setUserActivity(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error('Error fetching user activity:', error);
        toast({
          title: "Error",
          description: "Failed to fetch user activity",
          variant: "destructive",
        });
        setUserActivity([]);
      }
      setActivityModalOpen(true);
    }
  };

  const handleInviteUser = () => {
    toast({
      title: "Invite User",
      description: "User invitation functionality would be implemented here",
    });
  };

  const handleReviewPending = () => {
    toast({
      title: "Review Pending Users",
      description: "Pending user review modal would be opened here",
    });
  };

  const handlePhotoClick = (user: User, type: 'id' | 'verification') => {
    setSelectedUser(user);
    setSelectedPhotoType(type);
    setPhotoModalOpen(true);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;

    const userData = {
      firstName: editData.firstName,
      lastName: editData.lastName,
      email: editData.email,
      role: editData.role,
      status: editData.status,
      address: editData.address,
      city: editData.city,
      state: editData.state,
      postalCode: editData.postalCode,
      minPurchaseExempt: editData.minPurchaseExempt,
      minPurchaseOverride: editData.minPurchaseOverride || null,
    };

    updateUserMutation.mutate({ userId: editingUser.id, userData });
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
        <Button onClick={handleInviteUser} className="w-full sm:w-auto">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Pending Approvals Alert */}
      {pendingUsers.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start sm:items-center">
                <Clock className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Pending User Approvals</h3>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                    {pendingUsers.length} new users are waiting for approval to access the system
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleReviewPending}
                className="bg-yellow-600 text-white hover:bg-yellow-700 w-full sm:w-auto"
              >
                Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 md:p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-primary flex-shrink-0">
                <UsersIcon className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div className="ml-3 md:ml-4 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-300 truncate">Total Users</p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 md:p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-secondary flex-shrink-0">
                <UserCheck className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div className="ml-3 md:ml-4 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-300 truncate">Active Users</p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 md:p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex-shrink-0">
                <ShieldQuestion className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div className="ml-3 md:ml-4 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-300 truncate">Admins</p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.admins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center">
              <div className="p-2 md:p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex-shrink-0">
                <Clock className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div className="ml-3 md:ml-4 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-300 truncate">Pending</p>
                <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">All Users</h3>
        </div>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="text-center py-12">
              <UsersIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No users found</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-4">
                {users.map((user) => (
                  <div key={user.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                    {/* User Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={user.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {user.firstName} {user.lastName}
                            </span>
                            {user.role === 'admin' && user.createdAt && new Date(user.createdAt).getTime() === Math.min(...users.map(u => new Date(u.createdAt || 0).getTime())) && (
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                Founder
                              </Badge>
                            )}
                          </div>
                          {user.telegramUsername && (
                            <div className="text-xs text-blue-500 dark:text-blue-400 truncate">@{user.telegramUsername}</div>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(user.status)}
                        {getRoleBadge(user.role === 'user' ? 'customer' : user.role)}
                      </div>
                    </div>

                    {/* Address */}
                    {user.address && (
                      <div className="text-sm pt-2 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-gray-900 dark:text-gray-100">{user.address}</div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {user.city && user.state ? `${user.city}, ${user.state}` : user.city || user.state || ''}
                          {user.postalCode && ` ${user.postalCode}`}
                        </div>
                      </div>
                    )}

                    {/* Photos */}
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Photos:</div>
                      <div className="flex space-x-2">
                        {user.idImageUrl ? (
                          <div className="flex flex-col items-center">
                            <img
                              src={user.idImageUrl}
                              alt={`${user.firstName} ${user.lastName} ID`}
                              className="w-10 h-10 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handlePhotoClick(user, 'id')}
                              title="Click to view full size"
                              onError={(e) => {
                                console.error('ID image failed to load:', user.idImageUrl);
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <span className="text-xs text-gray-500 mt-0.5">ID</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded border flex items-center justify-center">
                              <span className="text-xs text-gray-400">No ID</span>
                            </div>
                            <span className="text-xs text-gray-500 mt-0.5">ID</span>
                          </div>
                        )}
                        {user.verificationPhotoUrl ? (
                          <div className="flex flex-col items-center">
                            <div
                              className="w-10 h-10 bg-gray-800 rounded border cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center"
                              onClick={() => handlePhotoClick(user, 'verification')}
                              title="Click to play verification video"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <span className="text-xs text-gray-500 mt-0.5">Verify</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded border flex items-center justify-center">
                              <span className="text-xs text-gray-400">No Verify</span>
                            </div>
                            <span className="text-xs text-gray-500 mt-0.5">Verify</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Role Selector */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                      <Label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Role</Label>
                      <Select 
                        value={user.role === 'user' ? 'customer' : user.role} 
                        onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                        disabled={updateRoleMutation.isPending}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Joined Date */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                      Joined: {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                      {user.status === 'pending' ? (
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveUser(user.id)}
                            disabled={updateStatusMutation.isPending}
                            className="w-full"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectUser(user.id)}
                            disabled={updateStatusMutation.isPending}
                            className="w-full"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            className="w-full"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit User
                          </Button>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewActivity(user.id)}
                              className="w-full"
                            >
                              <History className="h-4 w-4 mr-1" />
                              Activity
                            </Button>
                            {user.status === 'active' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSuspendUser(user.id)}
                                className="w-full text-red-600 hover:text-red-700"
                              >
                                <UserX className="h-4 w-4 mr-1" />
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                                className="w-full"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Photo</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.profileImageUrl || undefined} />
                              <AvatarFallback>
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.firstName} {user.lastName}</span>
                                {user.role === 'admin' && user.createdAt && new Date(user.createdAt).getTime() === Math.min(...users.map(u => new Date(u.createdAt || 0).getTime())) && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                    Founder
                                  </Badge>
                                )}
                              </div>
                              {user.telegramUsername && (
                                <div className="text-sm text-blue-500 dark:text-blue-400">@{user.telegramUsername}</div>
                              )}
                              <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {user.address ? (
                              <div>
                                <div className="text-gray-900 dark:text-gray-100">{user.address}</div>
                                <div className="text-gray-500 dark:text-gray-400">
                                  {user.city && user.state ? `${user.city}, ${user.state}` : user.city || user.state || ''}
                                  {user.postalCode && ` ${user.postalCode}`}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No address provided</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {user.idImageUrl ? (
                              <div className="flex flex-col items-center">
                                <img
                                  src={user.idImageUrl}
                                  alt={`${user.firstName} ${user.lastName} ID`}
                                  className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => handlePhotoClick(user, 'id')}
                                  title="Click to view full size"
                                  onError={(e) => {
                                    console.error('ID image failed to load:', user.idImageUrl);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                <span className="text-xs text-gray-500 mt-1">ID</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                                  <span className="text-xs text-gray-400">No ID</span>
                                </div>
                                <span className="text-xs text-gray-500 mt-1">ID</span>
                              </div>
                            )}
                            {user.verificationPhotoUrl ? (
                              <div className="flex flex-col items-center">
                                <div
                                  className="w-12 h-12 bg-gray-800 rounded border cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center relative overflow-hidden"
                                  onClick={() => handlePhotoClick(user, 'verification')}
                                  title="Click to play verification video"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <span className="text-xs text-gray-500 mt-1">Verification</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                                  <span className="text-xs text-gray-400">No Verify</span>
                                </div>
                                <span className="text-xs text-gray-500 mt-1">Verification</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={user.role === 'user' ? 'customer' : user.role} 
                            onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="customer">Customer</SelectItem>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                          {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.status === 'pending' ? (
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleApproveUser(user.id)}
                                disabled={updateStatusMutation.isPending}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectUser(user.id)}
                                disabled={updateStatusMutation.isPending}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewActivity(user.id)}>
                                  <History className="h-4 w-4 mr-2" />
                                  View Activity
                                </DropdownMenuItem>
                                {user.status === 'active' && (
                                  <DropdownMenuItem 
                                    onClick={() => handleSuspendUser(user.id)}
                                    className="text-red-600"
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Suspend User
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteUser(user)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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

      {/* Photo/Video Enlargement Modal */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-6">
          <DialogHeader>
            <DialogTitle>
              {selectedUser && selectedPhotoType === 'id' && `${selectedUser.firstName} ${selectedUser.lastName}'s ID Photo`}
              {selectedUser && selectedPhotoType === 'verification' && `${selectedUser.firstName} ${selectedUser.lastName}'s Verification Video`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center">
            {selectedUser && selectedPhotoType === 'id' && selectedUser.idImageUrl && (
              <img
                src={selectedUser.idImageUrl}
                alt={`${selectedUser.firstName} ${selectedUser.lastName} ID`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
              />
            )}
            {selectedUser && selectedPhotoType === 'verification' && selectedUser.verificationPhotoUrl && (
              <video
                src={selectedUser.verificationPhotoUrl}
                controls
                autoPlay
                className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={editData.firstName}
                    onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={editData.lastName}
                    onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={editData.role} onValueChange={(value) => setEditData({ ...editData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={editData.status} onValueChange={(value) => setEditData({ ...editData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={editData.address}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={editData.city}
                    onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    value={editData.state}
                    onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={editData.postalCode}
                    onChange={(e) => setEditData({ ...editData, postalCode: e.target.value })}
                  />
                </div>
              </div>

              {/* Purchase Limit Overrides */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold mb-3">Purchase Limit Overrides</h4>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="minPurchaseExempt"
                    checked={editData.minPurchaseExempt || false}
                    onChange={(e) => setEditData({ ...editData, minPurchaseExempt: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="minPurchaseExempt" className="text-sm">
                    Exempt from minimum purchase requirements
                  </Label>
                </div>
                {!editData.minPurchaseExempt && (
                  <div>
                    <Label htmlFor="minPurchaseOverride">Custom Minimum Order Amount ($)</Label>
                    <Input
                      id="minPurchaseOverride"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Leave empty to use city default"
                      value={editData.minPurchaseOverride || ""}
                      onChange={(e) => setEditData({ ...editData, minPurchaseOverride: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If set, this overrides the city-based minimum for this user.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveUser}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Suspend User Confirmation Dialog */}
      <Dialog open={suspendConfirmOpen} onOpenChange={setSuspendConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to suspend {userToSuspend?.firstName} {userToSuspend?.lastName}? 
              This will prevent them from accessing the system.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setSuspendConfirmOpen(false);
                setUserToSuspend(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmSuspendUser}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Suspending..." : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to permanently delete <strong>{userToDelete?.firstName} {userToDelete?.lastName}</strong> ({userToDelete?.email})?
            </p>
            <p className="text-sm text-red-600 mt-2 font-medium">
              This action cannot be undone. All of this user's data including orders, support tickets, notifications, and activity will be permanently removed. Their email will be freed up for a new account.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteConfirmOpen(false);
                setUserToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteUser}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Activity Modal */}
      <Dialog open={activityModalOpen} onOpenChange={setActivityModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 sm:p-6">
          <DialogHeader className="px-4 sm:px-0 pt-4 sm:pt-0">
            <DialogTitle>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  <span className="text-base sm:text-lg">
                    {selectedUser && `${selectedUser.firstName} ${selectedUser.lastName}'s Profile & Activity`}
                  </span>
                </div>
                <Badge variant="outline">{userActivity.length} activities</Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 h-full px-4 sm:px-0 overflow-y-auto">
            {/* User Information Panel */}
            <div className="lg:col-span-1 space-y-4">
              {selectedUser && (
                <>
                  {/* Profile Overview */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center space-y-3">
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={selectedUser.profileImageUrl || undefined} />
                          <AvatarFallback className="text-lg">
                            {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-lg">{selectedUser.firstName} {selectedUser.lastName}</h3>
                          <p className="text-sm text-gray-500">{selectedUser.email}</p>
                        </div>
                        <div className="flex space-x-2">
                          {getRoleBadge(selectedUser.role)}
                          {getStatusBadge(selectedUser.status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* User Details */}
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h4 className="font-medium text-sm text-gray-700 uppercase tracking-wide">User Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">User ID:</span>
                          <span className="font-mono text-xs">{selectedUser.id.slice(0, 8)}...</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Joined:</span>
                          <span>{selectedUser.createdAt ? format(new Date(selectedUser.createdAt), "MMM d, yyyy") : "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Last Updated:</span>
                          <span>{selectedUser.updatedAt ? format(new Date(selectedUser.updatedAt), "MMM d, yyyy") : "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Orders:</span>
                          <span className="font-medium">{selectedUser.orderCount || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">ID Verification:</span>
                          <Badge variant={selectedUser.idVerificationStatus === 'verified' ? 'default' : 'secondary'} className="text-xs">
                            {selectedUser.idVerificationStatus || 'pending'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Address Information */}
                  {(selectedUser.address || selectedUser.city || selectedUser.state) && (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <h4 className="font-medium text-sm text-gray-700 uppercase tracking-wide">Address</h4>
                        <div className="text-sm space-y-1">
                          {selectedUser.address && <p>{selectedUser.address}</p>}
                          <p>
                            {selectedUser.city && selectedUser.city}
                            {selectedUser.city && selectedUser.state && ', '}
                            {selectedUser.state && selectedUser.state}
                            {selectedUser.postalCode && ` ${selectedUser.postalCode}`}
                          </p>
                          {selectedUser.country && <p>{selectedUser.country}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Quick Stats */}
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wide">Quick Stats</h4>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-center">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">{userActivity.filter(a => a.type === 'order').length}</div>
                          <div className="text-xs text-blue-500">Orders Placed</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="text-lg font-bold text-green-600">{userActivity.filter(a => a.action.includes('Login')).length}</div>
                          <div className="text-xs text-green-500">Login Sessions</div>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg">
                          <div className="text-lg font-bold text-purple-600">{userActivity.filter(a => a.action.includes('Profile') || a.action.includes('Updated')).length}</div>
                          <div className="text-xs text-purple-500">Profile Updates</div>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-lg">
                          <div className="text-lg font-bold text-orange-600">{userActivity.length}</div>
                          <div className="text-xs text-orange-500">Total Activities</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Activity Timeline */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-sm text-gray-700 uppercase tracking-wide">Activity Timeline</h4>
                    <div className="flex space-x-2">
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Last 30 days
                      </Badge>
                    </div>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto pr-2">
                    {!Array.isArray(userActivity) || userActivity.length === 0 ? (
                      <div className="text-center py-12">
                        <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">No activity found</p>
                        <p className="text-xs text-gray-400 mt-2">Activities will appear here as the user interacts with the system</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userActivity.map((activity, index) => {
                          const getActivityIcon = (action: string, type: string) => {
                            if (type === 'order') return <ShoppingCart className="h-4 w-4 text-green-600" />;
                            if (action.includes('Login')) return <UserCheck className="h-4 w-4 text-blue-600" />;
                            if (action.includes('Logout')) return <UserX className="h-4 w-4 text-gray-600" />;
                            if (action.includes('Profile') || action.includes('Updated')) return <Edit className="h-4 w-4 text-orange-600" />;
                            if (action.includes('Created')) return <UserPlus className="h-4 w-4 text-purple-600" />;
                            if (action.includes('Status')) return <ShieldQuestion className="h-4 w-4 text-yellow-600" />;
                            return <Activity className="h-4 w-4 text-gray-600" />;
                          };

                          const getBorderColor = (action: string, type: string) => {
                            if (type === 'order') return 'border-green-200 bg-green-50';
                            if (action.includes('Login')) return 'border-blue-200 bg-blue-50';
                            if (action.includes('Logout')) return 'border-gray-200 bg-gray-50';
                            if (action.includes('Profile') || action.includes('Updated')) return 'border-orange-200 bg-orange-50';
                            if (action.includes('Created')) return 'border-purple-200 bg-purple-50';
                            if (action.includes('Status')) return 'border-yellow-200 bg-yellow-50';
                            return 'border-gray-200 bg-gray-50';
                          };

                          return (
                            <div key={activity.id || index} className={`border-l-4 ${getBorderColor(activity.action, activity.type)} pl-4 pr-3 py-3 rounded-r-lg transition-all hover:shadow-sm`}>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center space-x-3">
                                  <div className="p-1 bg-white rounded-full border">
                                    {getActivityIcon(activity.action, activity.type)}
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-gray-900">{activity.action}</h4>
                                    <p className="text-sm text-gray-600">{activity.details}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {format(new Date(activity.timestamp), "MMM d, yyyy")}
                                  </span>
                                  <br />
                                  <span className="text-xs text-gray-400">
                                    {format(new Date(activity.timestamp), "h:mm a")}
                                  </span>
                                </div>
                              </div>

                              <div className="ml-8 flex space-x-2">
                                {activity.type === 'order' && <Badge variant="secondary" className="text-xs">Order</Badge>}
                                {activity.type === 'user_activity' && <Badge variant="outline" className="text-xs">System</Badge>}
                              </div>

                              {activity.metadata && (
                                <div className="mt-3 ml-8">
                                  <details className="text-xs">
                                    <summary className="text-gray-500 cursor-pointer hover:text-gray-700 font-medium">Additional Details</summary>
                                    <div className="mt-2 p-3 bg-white border rounded text-xs overflow-auto">
                                      <pre className="whitespace-pre-wrap">
                                        {typeof activity.metadata === 'string' ? activity.metadata : JSON.stringify(JSON.parse(activity.metadata || '{}'), null, 2)}
                                      </pre>
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t mt-6 px-4 sm:px-0 pb-4 sm:pb-0">
            <Button variant="outline" onClick={() => setActivityModalOpen(false)} className="w-full sm:w-auto">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}