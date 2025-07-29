import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { insertCategorySchema } from "@shared/schema";
import { z } from "zod";
import { Plus, Edit2, Trash2, ChevronRight } from "lucide-react";
import type { Category } from "@shared/schema";

const formSchema = insertCategorySchema.extend({
  parentId: z.number().optional(),
  sortOrder: z.number().optional(),
});

type FormData = z.infer<typeof formSchema>;
type CategoryWithChildren = Category & { children?: CategoryWithChildren[] };

interface CategoryManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryWithChildren[];
}

export default function CategoryManagementModal({ open, onOpenChange, categories }: CategoryManagementModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      parentId: undefined,
      isActive: true,
      sortOrder: 0,
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
      resetForm();
    },
    onError: handleError,
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await apiRequest("PUT", `/api/categories/${selectedCategory!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      resetForm();
    },
    onError: handleError,
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      resetForm();
    },
    onError: handleError,
  });

  function handleError(error: any) {
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
      description: error?.message || "Operation failed. Please try again.",
      variant: "destructive",
    });
  }

  const resetForm = () => {
    form.reset();
    setSelectedCategory(null);
    setMode('create');
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setMode('edit');
    form.reset({
      name: category.name,
      description: category.description || "",
      parentId: category.parentId || undefined,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    });
  };

  const handleDelete = (category: Category) => {
    if (confirm(`Are you sure you want to delete "${category.name}"?`)) {
      deleteCategoryMutation.mutate(category.id);
    }
  };

  const onSubmit = (data: FormData) => {
    if (mode === 'create') {
      createCategoryMutation.mutate(data);
    } else {
      updateCategoryMutation.mutate(data);
    }
  };

  const renderCategoryTree = (cats: CategoryWithChildren[], level = 0) => {
    return cats.map((category) => (
      <div key={category.id} className="space-y-2">
        <div className={`flex items-center justify-between p-3 border rounded-lg ${level > 0 ? 'ml-6 border-dashed' : ''}`}>
          <div className="flex items-center space-x-2">
            {level > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
            <div>
              <span className="font-medium">{category.name}</span>
              {category.description && (
                <p className="text-sm text-gray-500">{category.description}</p>
              )}
            </div>
            {level > 0 && <Badge variant="outline" size="sm">Subcategory</Badge>}
          </div>
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEdit(category)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDelete(category)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {category.children && category.children.length > 0 && (
          <div>
            {renderCategoryTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const getAllCategories = (cats: CategoryWithChildren[]): Category[] => {
    const result: Category[] = [];
    for (const cat of cats) {
      result.push(cat);
      if (cat.children) {
        result.push(...getAllCategories(cat.children));
      }
    }
    return result;
  };

  const allCategories = getAllCategories(categories);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
          <DialogDescription>
            Create, edit, and organize your product categories and subcategories.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Form */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {mode === 'create' ? 'Create Category' : 'Edit Category'}
              </h3>
              {mode === 'edit' && (
                <Button variant="outline" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New
                </Button>
              )}
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter category name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Category (Optional)</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value ? field.value.toString() : "0"} 
                          onValueChange={(value) => field.onChange(value && value !== "0" ? parseInt(value) : undefined)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select parent category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">No Parent (Root Category)</SelectItem>
                            {allCategories
                              .filter(cat => mode === 'edit' ? cat.id !== selectedCategory?.id : true)
                              .map((category) => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter category description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                >
                  {mode === 'create' ? 'Create Category' : 'Update Category'}
                </Button>
              </form>
            </Form>
          </div>

          {/* Category List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Category Hierarchy</h3>
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded bg-purple-100"></div>
                  <span>Parent</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded bg-blue-100"></div>
                  <span>Sub</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 rounded bg-green-100"></div>
                  <span>Sub-sub</span>
                </div>
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {categories.length > 0 ? (
                renderCategoryTree(categories)
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No categories created yet.</p>
                  <p className="text-sm">Create your first category to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}