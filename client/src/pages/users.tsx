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
  Save
} from "lucide-react";
import { format } from "date-fns";
import type { User } from "@shared/schema";

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userActivity, setUserActivity] = useState<any[]>([]);

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
    switch (role) {
      case "admin":
        return <Badge className="role-admin">Admin</Badge>;
      case "manager":
        return <Badge className="role-manager">Manager</Badge>;
      case "customer":
      case "user":
        return <Badge className="role-customer">Customer</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
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
    if (confirm("Are you sure you want to reject this user?")) {
      updateStatusMutation.mutate({ userId, status: "suspended" });
    }
  };

  const handleSuspendUser = (userId: string) => {
    if (confirm("Are you sure you want to suspend this user?")) {
      updateStatusMutation.mutate({ userId, status: "suspended" });
    }
  };

  const handleEditUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setEditingUser(user);
      setEditModalOpen(true);
    }
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

  const handlePhotoClick = (user: User) => {
    setSelectedUser(user);
    setPhotoModalOpen(true);
  };

  const handleSaveUser = (formData: FormData) => {
    if (!editingUser) return;
    
    const userData = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as string,
      status: formData.get('status') as string,
    };
    
    updateUserMutation.mutate({ userId: editingUser.id, userData });
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
        <div className="flex space-x-3">
          <Button onClick={handleInviteUser}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Pending Approvals Alert */}
      {pendingUsers.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-yellow-500 mr-3" />
                <div>
                  <h3 className="font-semibold text-yellow-800">Pending User Approvals</h3>
                  <p className="text-yellow-700">
                    {pendingUsers.length} new users are waiting for approval to access the system
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleReviewPending}
                className="bg-yellow-600 text-white hover:bg-yellow-700"
              >
                Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-primary">
                <UsersIcon className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-secondary">
                <UserCheck className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Users</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <ShieldQuestion className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Admins</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.admins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                <Clock className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Pending</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">All Users</h3>
        </div>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="text-center py-12">
              <UsersIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                        <div className="flex">
                          {user.idImageUrl ? (
                            <div className="flex flex-col items-center mr-2">
                              <img
                                src={user.idImageUrl}
                                alt={`${user.firstName} ${user.lastName} ID`}
                                className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => handlePhotoClick(user)}
                                title="Click to view full size"
                              />
                              <span className="text-xs text-gray-500 mt-1">ID</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center mr-2">
                              <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                                <span className="text-xs text-gray-400">No ID</span>
                              </div>
                              <span className="text-xs text-gray-500 mt-1">ID</span>
                            </div>
                          )}
                          {user.verificationPhotoUrl ? (
                            <div className="flex flex-col items-center">
                              <img
                                src={user.verificationPhotoUrl}
                                alt={`${user.firstName} ${user.lastName} Verification`}
                                className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => handlePhotoClick(user)}
                                title="Click to view full size"
                              />
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
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
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
                              <DropdownMenuItem onClick={() => handleEditUser(user.id)}>
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
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Enlargement Modal */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-6">
          <DialogHeader>
            <DialogTitle>
              {selectedUser && `${selectedUser.firstName} ${selectedUser.lastName}'s ID Photo`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center">
            {selectedUser?.idImageUrl && (
              <img
                src={selectedUser.idImageUrl}
                alt={`${selectedUser.firstName} ${selectedUser.lastName} ID`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form action={handleSaveUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={editingUser.firstName || ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={editingUser.lastName || ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={editingUser.email}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" defaultValue={editingUser.role === 'user' ? 'customer' : editingUser.role}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={editingUser.status}>
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
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* User Activity Modal */}
      <Dialog open={activityModalOpen} onOpenChange={setActivityModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  {selectedUser && `${selectedUser.firstName} ${selectedUser.lastName}'s Profile & Activity`}
                </div>
                <Badge variant="outline">{userActivity.length} activities</Badge>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
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
                      <h4 className="font-medium text-sm text-gray-700 uppercase tracking-wide">Quick Stats</h4>
                      <div className="grid grid-cols-2 gap-3 text-center">
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
          
          <div className="flex justify-end pt-4 border-t mt-6">
            <Button variant="outline" onClick={() => setActivityModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}