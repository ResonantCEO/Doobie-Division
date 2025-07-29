import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { Product, Category } from "@shared/schema";

interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
}

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product & { category: Category | null };
  categories: CategoryWithChildren[];
}

const formSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  categoryId: z.string().optional(),
  stock: z.string().min(0, "Stock must be 0 or greater"),
  minStockThreshold: z.string().min(1, "Minimum stock threshold is required"),
  sellingMethod: z.enum(["units", "weight"]),
  weightUnit: z.enum(["grams", "ounces"]).optional(),
  pricePerGram: z.string().optional(),
  pricePerOunce: z.string().optional(),
  discountPercentage: z.string().optional(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

const renderCategoryOptions = (categories: CategoryWithChildren[], level = 0): JSX.Element[] => {
  const result: JSX.Element[] = [];

  for (const category of categories) {
    const prefix = "  ".repeat(level);
    result.push(
      <SelectItem key={category.id} value={category.id.toString()}>
        {prefix}{level > 0 ? "└ " : ""}{category.name}
      </SelectItem>
    );

    if (category.children && category.children.length > 0) {
      result.push(...renderCategoryOptions(category.children, level + 1));
    }
  }

  return result;
};

export default function EditProductModal({ open, onOpenChange, product, categories }: EditProductModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: product.name,
      description: product.description || "",
      price: product.price || "",
      sku: product.sku,
      categoryId: product.categoryId?.toString() || "",
      stock: product.stock.toString(),
      minStockThreshold: product.minStockThreshold.toString(),
      sellingMethod: product.sellingMethod as "units" | "weight",
      weightUnit: (product.weightUnit as "grams" | "ounces") || "grams",
      pricePerGram: product.pricePerGram || "",
      pricePerOunce: product.pricePerOunce || "",
      discountPercentage: product.discountPercentage || "0",
      isActive: product.isActive,
    },
  });

  const sellingMethod = form.watch("sellingMethod");

  useEffect(() => {
    if (product && open) {
      form.reset({
        name: product.name,
        description: product.description || "",
        price: product.price || "",
        sku: product.sku,
        categoryId: product.categoryId?.toString() || "",
        stock: product.stock.toString(),
        minStockThreshold: product.minStockThreshold.toString(),
        sellingMethod: product.sellingMethod as "units" | "weight",
        weightUnit: (product.weightUnit as "grams" | "ounces") || "grams",
        pricePerGram: product.pricePerGram || "",
        pricePerOunce: product.pricePerOunce || "",
        discountPercentage: product.discountPercentage || "0",
        isActive: product.isActive,
      });
      setImagePreview(product.imageUrl || null);
    }
  }, [product, open, form]);

  const updateProductMutation = useMutation({
    mutationFn: async (data: any) => {
      let imageUrl = product.imageUrl;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('image', selectedFile);

        const uploadResponse = await fetch('/api/upload/product-image', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadResult = await uploadResponse.json();
        imageUrl = uploadResult.imageUrl;
      }

      const productData = {
        ...data,
        imageUrl,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        stock: parseInt(data.stock),
        minStockThreshold: parseInt(data.minStockThreshold),
        price: data.sellingMethod === "units" && data.price ? data.price : null,
        pricePerGram: data.sellingMethod === "weight" && data.pricePerGram ? data.pricePerGram : null,
        pricePerOunce: data.sellingMethod === "weight" && data.pricePerOunce ? data.pricePerOunce : null,
        discountPercentage: data.discountPercentage ? parseFloat(data.discountPercentage) : 0,
      };

      await apiRequest("PUT", `/api/products/${product.id}`, productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      onOpenChange(false);
      form.reset();
      setSelectedFile(null);
      setImagePreview(null);
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
        description: "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    updateProductMutation.mutate(data);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getDiscountedPrice = (originalPrice: number, discountPercentage: number) => {
    if (discountPercentage <= 0) return originalPrice;
    return originalPrice * (1 - discountPercentage / 100);
  };

  const currentDiscountPercentage = parseFloat(form.watch("discountPercentage") || "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter product name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter product SKU" {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter product description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {renderCategoryOptions(categories)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="image">Product Image</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imagePreview && (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-md border"
                  />
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="sellingMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selling Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select selling method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="units">By Units</SelectItem>
                      <SelectItem value="weight">By Weight</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {sellingMethod === "units" && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {sellingMethod === "weight" && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="weightUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight Unit</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select weight unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="grams">Grams</SelectItem>
                          <SelectItem value="ounces">Ounces</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pricePerGram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per Gram</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pricePerOunce"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per Ounce</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Discount Percentage Field */}
            <FormField
              control={form.control}
              name="discountPercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount Percentage</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        max="100" 
                        placeholder="0" 
                        {...field} 
                      />
                      {currentDiscountPercentage > 0 && (
                        <div className="text-sm text-gray-600">
                          {sellingMethod === "units" && form.watch("price") && (
                            <div>
                              Original: ${parseFloat(form.watch("price") || "0").toFixed(2)} → 
                              Discounted: ${getDiscountedPrice(parseFloat(form.watch("price") || "0"), currentDiscountPercentage).toFixed(2)}
                            </div>
                          )}
                          {sellingMethod === "weight" && (
                            <div className="space-y-1">
                              {form.watch("pricePerGram") && (
                                <div>
                                  Original: ${parseFloat(form.watch("pricePerGram") || "0").toFixed(2)}/g → 
                                  Discounted: ${getDiscountedPrice(parseFloat(form.watch("pricePerGram") || "0"), currentDiscountPercentage).toFixed(2)}/g
                                </div>
                              )}
                              {form.watch("pricePerOunce") && (
                                <div>
                                  Original: ${parseFloat(form.watch("pricePerOunce") || "0").toFixed(2)}/oz → 
                                  Discounted: ${getDiscountedPrice(parseFloat(form.watch("pricePerOunce") || "0"), currentDiscountPercentage).toFixed(2)}/oz
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minStockThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Stock Threshold</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active Product</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateProductMutation.isPending}
              >
                {updateProductMutation.isPending ? "Updating..." : "Update Product"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}