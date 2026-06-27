import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { insertCategorySchema } from "@shared/schema";
import { z } from "zod";
import { Plus, Edit2, Trash2, ChevronRight, GripVertical } from "lucide-react";
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

function flattenCategories(cats: CategoryWithChildren[]): CategoryWithChildren[] {
  const result: CategoryWithChildren[] = [];
  for (const cat of cats) {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenCategories(cat.children));
    }
  }
  return result;
}

export default function CategoryManagementModal({ open, onOpenChange, categories }: CategoryManagementModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [localCategories, setLocalCategories] = useState<CategoryWithChildren[]>(() => flattenCategories(categories));
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
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

  const reorderCategoriesMutation = useMutation({
    mutationFn: async (reorderedCategories: { id: number; sortOrder: number }[]) => {
      await Promise.all(
        reorderedCategories.map(({ id, sortOrder }) =>
          apiRequest("PUT", `/api/categories/${id}`, { sortOrder })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Success",
        description: "Categories reordered successfully",
      });
    },
    onError: handleError,
  });

  // Update local categories when props change
  useEffect(() => {
    setLocalCategories(flattenCategories(categories));
  }, [categories]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index && result.source.droppableId === result.destination.droppableId) return;

    const { droppableId } = result.source;

    if (droppableId === "root-categories") {
      // Reordering root categories
      const rootCategories = localCategories.filter(cat => !cat.parentId);
      const reordered = Array.from(rootCategories);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);

      const updatedRoot = reordered.map((cat, index) => ({ ...cat, sortOrder: index }));
      const nonRoot = localCategories.filter(cat => cat.parentId);
      setLocalCategories([...updatedRoot, ...nonRoot]);

      reorderCategoriesMutation.mutate(updatedRoot.map((cat, index) => ({ id: cat.id, sortOrder: index })));
    } else if (droppableId.startsWith("subcategories-")) {
      // Reordering subcategories within a parent
      const parentId = parseInt(droppableId.replace("subcategories-", ""));
      const siblings = localCategories.filter(cat => cat.parentId === parentId);
      const reordered = Array.from(siblings);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);

      const updatedSiblings = reordered.map((cat, index) => ({ ...cat, sortOrder: index }));
      const others = localCategories.filter(cat => cat.parentId !== parentId);
      setLocalCategories([...others, ...updatedSiblings]);

      reorderCategoriesMutation.mutate(updatedSiblings.map((cat, index) => ({ id: cat.id, sortOrder: index })));
    }
  };

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

  const handleDeleteCategory = (categoryId: number) => {
    setCategoryToDelete(categoryId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete);
      setCategoryToDelete(null);
    }
  };

  const onSubmit = (data: FormData) => {
    if (mode === 'create') {
      createCategoryMutation.mutate(data);
    } else {
      updateCategoryMutation.mutate(data);
    }
  };

  const renderDraggableChildren = (parentId: number, level: number): JSX.Element | null => {
    const children = localCategories
      .filter(cat => cat.parentId === parentId)
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    if (children.length === 0) return null;

    return (
      <Droppable droppableId={`subcategories-${parentId}`}>
        {(subProvided, subSnapshot) => (
          <div
            ref={subProvided.innerRef}
            {...subProvided.droppableProps}
            className={`space-y-1 rounded-lg transition-colors ${subSnapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
          >
            {children.map((child, childIndex) => (
              <Draggable key={child.id} draggableId={`sub-${child.id}`} index={childIndex}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className="space-y-1"
                    style={dragProvided.draggableProps.style}
                  >
                    <div
                      className={`flex items-center justify-between p-3 border border-dashed border-gray-300 rounded-lg transition-colors hover:bg-gray-50 ${dragSnapshot.isDragging ? 'shadow-lg bg-white' : ''}`}
                      style={{ marginLeft: `${level * 1.5}rem` }}
                    >
                      <div className="flex items-center space-x-2">
                        <div {...dragProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="flex items-center text-gray-400">└</div>
                        <ChevronRight className="h-3 w-3 text-gray-400" />
                        <span className="font-medium text-sm">{child.name}</span>
                        <Badge variant="outline" size="sm">Subcategory</Badge>
                      </div>
                      <div className="flex space-x-1">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(child)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteCategory(child.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {renderDraggableChildren(child.id, level + 1)}
                  </div>
                )}
              </Draggable>
            ))}
            {subProvided.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  const renderRootCategory = (category: CategoryWithChildren, index: number) => (
    <Draggable key={category.id} draggableId={`root-${category.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="space-y-1"
          style={provided.draggableProps.style}
        >
          <div className={`flex items-center justify-between p-3 border border-gray-200 rounded-lg transition-colors hover:bg-gray-50 ${snapshot.isDragging ? 'shadow-lg bg-white' : ''}`}>
            <div className="flex items-center space-x-2">
              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                <GripVertical className="h-4 w-4 text-gray-400" />
              </div>
              <span className="font-medium">{category.name}</span>
              {category.description && (
                <p className="text-sm text-gray-500 ml-2">{category.description}</p>
              )}
            </div>
            <div className="flex space-x-1">
              <Button size="sm" variant="outline" onClick={() => handleEdit(category)}>
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDeleteCategory(category.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {renderDraggableChildren(category.id, 1)}
        </div>
      )}
    </Draggable>
  );

  // localCategories is already flat (flattened in useEffect/useState), use directly
  const allCategories = localCategories;

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
                            {(() => {
                              const excludeId = mode === 'edit' ? selectedCategory?.id : undefined;
                              const renderOptions = (parentId: number | null, depth: number): JSX.Element[] => {
                                const items = localCategories
                                  .filter(cat => (parentId === null ? !cat.parentId : cat.parentId === parentId) && cat.id !== excludeId)
                                  .slice()
                                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                                return items.flatMap(cat => [
                                  <SelectItem key={cat.id} value={cat.id.toString()}>
                                    <span className="text-gray-400 select-none">
                                      {depth > 0 ? '\u00a0'.repeat(depth * 4) + '└ ' : ''}
                                    </span>
                                    {cat.name}
                                  </SelectItem>,
                                  ...renderOptions(cat.id, depth + 1),
                                ]);
                              };
                              return renderOptions(null, 0);
                            })()}
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
              <h3 className="text-lg font-semibold">Existing Categories</h3>
              <p className="text-xs text-gray-500">Drag to reorder</p>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {localCategories.length > 0 ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="root-categories">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3"
                      >
                        {localCategories
                          .filter(cat => !cat.parentId)
                          .slice()
                          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                          .map((cat, index) => renderRootCategory(cat, index))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              ) : (
                <p className="text-gray-500 text-center py-8">No categories created yet</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDeleteCategory}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </Dialog>
  );
}