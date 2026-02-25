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
import { useAuth } from "@/hooks/useAuth";
import { Lock, Plus, Trash2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Product, Category, ProductSize } from "@shared/schema";

interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
}

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product & { category: Category | null; sizes?: ProductSize[] };
  categories: CategoryWithChildren[];
}

const formSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  company: z.string().optional(),
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
  discountPercentage: z.string().nullable().optional(),
  isActive: z.boolean(),
  purchasePrice: z.string().optional(),
  purchasePriceMethod: z.enum(["units", "weight"]).default("units"),
  purchasePricePerGram: z.string().optional(),
  purchasePricePerOunce: z.string().optional(),
  adminNotes: z.string().optional(),
  enableSizes: z.boolean().default(false),
  sizes: z.array(z.object({
    size: z.string().min(1, "Size name is required"),
    quantity: z.string().min(1, "Quantity is required"),
  })).optional(),
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
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  const isAdmin = user?.role === "admin";

  const hasSizes = !!(product.sizes && product.sizes.length > 0);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: product.name,
      company: (product as any).company || "",
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
      purchasePrice: (product as any).purchasePrice || "",
      purchasePriceMethod: ((product as any).purchasePriceMethod as "units" | "weight") || "units",
      purchasePricePerGram: (product as any).purchasePricePerGram || "",
      purchasePricePerOunce: (product as any).purchasePricePerOunce || "",
      adminNotes: (product as any).adminNotes || "",
      enableSizes: hasSizes,
      sizes: hasSizes ? product.sizes!.map(s => ({ size: s.size, quantity: s.quantity.toString() })) : [],
    },
  });

  const sellingMethod = form.watch("sellingMethod");
  const enableSizes = form.watch("enableSizes");

  useEffect(() => {
    if (product && open) {
      const productHasSizes = !!(product.sizes && product.sizes.length > 0);
      form.reset({
        name: product.name,
        company: (product as any).company || "",
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
        purchasePrice: (product as any).purchasePrice || "",
        purchasePriceMethod: ((product as any).purchasePriceMethod as "units" | "weight") || "units",
        purchasePricePerGram: (product as any).purchasePricePerGram || "",
        purchasePricePerOunce: (product as any).purchasePricePerOunce || "",
        adminNotes: (product as any).adminNotes || "",
        enableSizes: productHasSizes,
        sizes: productHasSizes ? product.sizes!.map(s => ({ size: s.size, quantity: s.quantity.toString() })) : [],
      });
      // Load existing images from imageUrls or fall back to imageUrl
      let existing: string[] = [];
      if ((product as any).imageUrls) {
        try {
          existing = JSON.parse((product as any).imageUrls);
        } catch {
          existing = [];
        }
      }
      if (existing.length === 0 && product.imageUrl) {
        existing = [product.imageUrl];
      }
      setExistingImages(existing);
      setImagePreviews([]);
      setSelectedFiles([]);
    }
  }, [product, open, form]);

  const updateProductMutation = useMutation({
    mutationFn: async (data: any) => {
      // Combine existing images (not deleted) with newly uploaded ones
      const allImages = [...existingImages];
      
      // Upload new images if any
      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map(async (file) => {
          const formData = new FormData();
          formData.append('image', file);

          const uploadResponse = await fetch('/api/upload/product-image', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload image');
          }

          const uploadResult = await uploadResponse.json();
          return uploadResult.imageUrl;
        });

        const newImageUrls = await Promise.all(uploadPromises);
        allImages.push(...newImageUrls);
      }

      const imageUrl = allImages[0] || product.imageUrl || "";
      const imageUrls = allImages.length > 0 ? JSON.stringify(allImages) : null;

      console.log('[EditProductModal] Saving images:', {
        totalImages: allImages.length,
        imageUrls: imageUrls,
        imageUrl: imageUrl
      });

      let totalStock = parseInt(data.stock);
      if (data.enableSizes && data.sizes && data.sizes.length > 0) {
        totalStock = data.sizes.reduce((sum: number, s: { quantity: string }) => sum + parseInt(s.quantity || "0"), 0);
      }

      const productData: any = {
        ...data,
        imageUrl,
        imageUrls,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        stock: totalStock,
        minStockThreshold: parseInt(data.minStockThreshold),
        price: data.sellingMethod === "units" && data.price ? data.price : null,
        pricePerGram: data.sellingMethod === "weight" && data.pricePerGram ? data.pricePerGram : null,
        pricePerOunce: data.sellingMethod === "weight" && data.pricePerOunce ? data.pricePerOunce : null,
        discountPercentage: data.discountPercentage || null,
        purchasePrice: data.purchasePrice ? parseFloat(data.purchasePrice).toFixed(2) : null,
        purchasePriceMethod: data.purchasePriceMethod || "units",
        purchasePricePerGram: data.purchasePricePerGram ? parseFloat(data.purchasePricePerGram).toFixed(4) : null,
        purchasePricePerOunce: data.purchasePricePerOunce ? parseFloat(data.purchasePricePerOunce).toFixed(2) : null,
        adminNotes: data.adminNotes || null,
        sizes: data.enableSizes && data.sizes && data.sizes.length > 0
          ? data.sizes.map(s => ({ size: s.size, quantity: parseInt(s.quantity || "0") }))
          : [],
      };
      delete productData.enableSizes;

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
      setSelectedFiles([]);
      setImagePreviews([]);
      setExistingImages([]);
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (too large)`);
        return;
      }

      if (!file.type.startsWith('image/')) {
        invalidFiles.push(`${file.name} (not an image)`);
        return;
      }

      validFiles.push(file);
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "Some files were skipped",
        description: invalidFiles.join(", "),
        variant: "destructive",
      });
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);

      // Create previews for new files
      validFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreviews((prev) => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }

    // Reset input
    event.target.value = '';
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
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
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter company name" {...field} />
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
              <Label>Product Images</Label>
              
              {/* Existing Images */}
              {existingImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Existing Images:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {existingImages.map((url, index) => (
                      <div key={index} className="relative">
                        <img
                          src={url}
                          alt={`Existing ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">New Images:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => removeNewImage(index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <div>
                <label htmlFor="image-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {existingImages.length === 0 && imagePreviews.length === 0 ? "Add Images" : "Add More Images"}
                  </Button>
                  <input
                    id="image-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF up to 5MB each (multiple images allowed)
                </p>
              </div>
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

            <FormField
              control={form.control}
              name="enableSizes"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Product Options</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Track size or flavor options
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {enableSizes && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Options</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentSizes = form.getValues("sizes") || [];
                      form.setValue("sizes", [
                        ...currentSizes,
                        { size: "", quantity: "0" },
                      ]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>

                {form.watch("sizes")?.map((_, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <FormField
                      control={form.control}
                      name={`sizes.${index}.size`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Option Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., S, M, L" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`sizes.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const currentSizes = form.getValues("sizes") || [];
                        form.setValue(
                          "sizes",
                          currentSizes.filter((_, i) => i !== index)
                        );
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                {(!form.watch("sizes") || form.watch("sizes")?.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    Click "Add Option" to add product options.
                  </p>
                )}
              </div>
            )}

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

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Price per Gram ($)</label>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                    placeholder="0"
                    value={form.watch("pricePerGram") || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      form.setValue("pricePerGram", val);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Price per Ounce ($)</label>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                    placeholder="0"
                    value={form.watch("pricePerOunce") || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      form.setValue("pricePerOunce", val);
                    }}
                  />
                </div>
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

            {!enableSizes && (
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

            {isAdmin && (
              <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Lock className="h-4 w-4" />
                  <span className="font-medium text-sm">Admin Notes (Internal Use Only)</span>
                </div>
                
                <FormField
                  control={form.control}
                  name="purchasePriceMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price Method</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select pricing method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="units">Per Unit</SelectItem>
                            <SelectItem value="weight">By Weight</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("purchasePriceMethod") === "units" ? (
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price per Unit ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            {...field} 
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          The cost you paid per unit to acquire this product
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="purchasePricePerGram"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Price per Gram ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.0001" 
                              placeholder="0.0000" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="purchasePricePerOunce"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Price per Ounce ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="adminNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add notes about this product for company use (supplier info, storage instructions, etc.)" 
                          {...field} 
                          value={field.value || ""} 
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

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