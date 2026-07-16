import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { insertProductSchema } from "@shared/schema";
import { z } from "zod";
import { Upload, X, Lock, Plus, Trash2 } from "lucide-react";
import type { Category } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";

const formSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  company: z.string().optional(),
  description: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  categoryId: z.number().min(1, "Category is required"),
  imageUrl: z.string().optional(),
  price: z.string().optional(),
  stock: z.string().optional(),
  minStockThreshold: z.string().min(1, "Minimum threshold is required"),
  sellingMethod: z.enum(["units", "weight"]).default("units"),
  weightUnit: z.enum(["grams", "ounces"]).default("grams"),
  pricePerGram: z.string().optional(),
  pricePerOunce: z.string().optional(),
  pricePerEighth: z.string().optional(),
  pricePerQuarter: z.string().optional(),
  pricePerHalf: z.string().optional(),
  discountPercentage: z.string().nullable().optional(),
  discountAmount: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
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
}).refine((data) => {
  if (data.sellingMethod === "weight") {
    return data.pricePerGram || data.pricePerOunce;
  }
  if (data.enableSizes && data.sizes && data.sizes.length > 0) {
    // If sizes are enabled, we don't need the regular price/stock fields
    return true;
  }
  return data.price;
}, {
  message: "Price is required based on selling method",
  path: ["price"],
}).refine((data) => {
  if (data.enableSizes && (!data.sizes || data.sizes.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "At least one size is required when sizes are enabled",
  path: ["sizes"],
}).refine((data) => {
  // Stock is required if sizes are not enabled and selling method is units
  if (data.sellingMethod === "units" && !data.enableSizes && !data.stock) {
    return false;
  }
  return true;
}, {
  message: "Stock is required when sizes are not enabled",
  path: ["stock"],
});

type FormData = z.infer<typeof formSchema>;
type CategoryWithChildren = Category & { children?: CategoryWithChildren[] };

interface AddProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryWithChildren[];
}

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

export default function AddProductModal({ open, onOpenChange, categories }: AddProductModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDuplicateSku, setIsDuplicateSku] = useState(false);
  const [stockLbs, setStockLbs] = useState("");
  const [stockOz, setStockOz] = useState("");
  const [stockG, setStockG] = useState("");
  const [minStockLbs, setMinStockLbs] = useState("");
  const [minStockOz, setMinStockOz] = useState("");
  const [minStockG, setMinStockG] = useState("5");
  const [enableQuantityPricing, setEnableQuantityPricing] = useState(false);
  const [quantityTiers, setQuantityTiers] = useState<Array<{minQuantity: string; pricePerItem: string; totalPrice?: string}>>([]);

  const isAdmin = user?.role === "admin";

  const { data: priceTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/price-templates"],
  });

  const applyTemplate = (templateId: string) => {
    if (!templateId || templateId === "__none__") return;
    const tmpl = priceTemplates.find((t: any) => t.id === parseInt(templateId));
    if (!tmpl) return;
    if (tmpl.templateType === "units") {
      if (tmpl.price) form.setValue("price", tmpl.price);
    } else if (tmpl.templateType === "weight") {
      form.setValue("sellingMethod", "weight");
      if (tmpl.pricePerGram) form.setValue("pricePerGram", tmpl.pricePerGram);
      if (tmpl.pricePerOunce) form.setValue("pricePerOunce", tmpl.pricePerOunce);
      if (tmpl.pricePerEighth) form.setValue("pricePerEighth", tmpl.pricePerEighth);
      if (tmpl.pricePerQuarter) form.setValue("pricePerQuarter", tmpl.pricePerQuarter);
      if (tmpl.pricePerHalf) form.setValue("pricePerHalf", tmpl.pricePerHalf);
    } else if (tmpl.templateType === "quantity") {
      let tiers: Array<{minQuantity: string; pricePerItem: string}> = [];
      try { tiers = JSON.parse(tmpl.quantityTiers || "[]"); } catch {}
      if (tiers.length > 0) {
        setEnableQuantityPricing(true);
        setQuantityTiers(tiers.map(t => ({
          ...t,
          totalPrice: t.pricePerItem && t.minQuantity ? (parseFloat(t.pricePerItem) * parseFloat(t.minQuantity)).toFixed(2) : "",
        })));
      }
      if (tmpl.price) {
        form.setValue("price", tmpl.price);
      }
      if (tmpl.pricePerGram) {
        form.setValue("sellingMethod", "weight");
        form.setValue("pricePerGram", tmpl.pricePerGram);
      }
    }
    toast({ title: `Applied template: ${tmpl.name}` });
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      company: "",
      description: "",
      price: "",
      sku: "",
      categoryId: undefined,
      imageUrl: "",
      stock: "",
      minStockThreshold: "5",
      sellingMethod: "units",
      weightUnit: "grams",
      pricePerGram: "",
      pricePerOunce: "",
      pricePerEighth: "",
      pricePerQuarter: "",
      pricePerHalf: "",
      isActive: true,
      purchasePrice: "",
      purchasePriceMethod: "units",
      purchasePricePerGram: "",
      purchasePricePerOunce: "",
      adminNotes: "",
      enableSizes: false,
      sizes: [],
    },
  });

  const sellingMethod = form.watch("sellingMethod");
  const enableSizes = form.watch("enableSizes");

  // Clear sizes when selling method changes to weight or when sizes are disabled
  useEffect(() => {
    if (!enableSizes) {
      form.setValue("sizes", []);
    }
  }, [enableSizes, form]);

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

  const removeImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/upload/product-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.imageUrl;
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: FormData) => {
      let imageUrl = "";
      let imageUrls: string[] = [];

      // Upload all images if selected
      if (selectedFiles.length > 0) {
        const uploadedUrls = await Promise.all(
          selectedFiles.map((file) => uploadImage(file))
        );
        imageUrls = uploadedUrls;
        imageUrl = uploadedUrls[0] || ""; // First image as primary
      }

      const combineToGrams = (lbs: string, oz: string, g: string) => {
        return (
          Math.round(parseFloat(lbs || "0") * 448) +
          Math.round(parseFloat(oz || "0") * 28) +
          Math.round(parseFloat(g || "0"))
        );
      };

      // Calculate total stock if sizes are enabled
      let totalStock = 0;
      if (data.enableSizes && data.sizes && data.sizes.length > 0) {
        totalStock = data.sizes.reduce((sum, size) => sum + parseInt(size.quantity || "0"), 0);
      } else if (data.sellingMethod === "weight") {
        totalStock = combineToGrams(stockLbs, stockOz, stockG);
      } else {
        totalStock = parseInt(data.stock || "0");
      }

      const minStockGrams = data.sellingMethod === "weight"
        ? combineToGrams(minStockLbs, minStockOz, minStockG)
        : parseInt(data.minStockThreshold);

      const payload = {
        name: data.name,
        company: data.company || null,
        description: data.description || null,
        sku: data.sku,
        categoryId: data.categoryId ? Number(data.categoryId) : null,
        price: data.sellingMethod === "units" && data.price ? parseFloat(data.price).toFixed(2) : null,
        stock: totalStock,
        minStockThreshold: minStockGrams,
        sellingMethod: data.sellingMethod,
        weightUnit: data.weightUnit,
        pricePerGram: data.pricePerGram ? parseFloat(data.pricePerGram).toFixed(4) : null,
        pricePerOunce: data.pricePerOunce ? parseFloat(data.pricePerOunce).toFixed(2) : null,
        pricePerEighth: data.pricePerEighth ? parseFloat(data.pricePerEighth).toFixed(2) : null,
        pricePerQuarter: data.pricePerQuarter ? parseFloat(data.pricePerQuarter).toFixed(2) : null,
        pricePerHalf: data.pricePerHalf ? parseFloat(data.pricePerHalf).toFixed(2) : null,
        discountPercentage: data.discountPercentage ? parseFloat(data.discountPercentage).toFixed(2) : null,
        discountAmount: data.discountAmount ? parseFloat(data.discountAmount).toFixed(2) : null,
        isActive: data.isActive,
        imageUrl: imageUrl || null,
        imageUrls: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        purchasePrice: data.purchasePrice ? parseFloat(data.purchasePrice).toFixed(2) : null,
        purchasePriceMethod: data.purchasePriceMethod || "units",
        purchasePricePerGram: data.purchasePricePerGram ? parseFloat(data.purchasePricePerGram).toFixed(4) : null,
        purchasePricePerOunce: data.purchasePricePerOunce ? parseFloat(data.purchasePricePerOunce).toFixed(2) : null,
        adminNotes: data.adminNotes || null,
        sizes: data.enableSizes && data.sizes && data.sizes.length > 0 ? data.sizes.map(size => ({
          size: size.size,
          quantity: parseInt(size.quantity || "0"),
        })) : undefined,
        quantityPricing: enableQuantityPricing
          ? quantityTiers
              .filter(t => t.minQuantity && t.pricePerItem)
              .map(t => ({ minQuantity: parseInt(t.minQuantity), pricePerItem: t.pricePerItem }))
          : [],
      };
      
      console.log('[AddProductModal] Sending payload:', JSON.stringify(payload, null, 2));
      const response = await apiRequest("POST", "/api/products", payload);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product created successfully",
      });
      onOpenChange(false);
      form.reset();
      setSelectedFiles([]);
      setImagePreviews([]);
      setIsDuplicateSku(false);
      setEnableQuantityPricing(false);
      setQuantityTiers([]);
    },
    onError: (error: any) => {
      console.error("Product creation error:", error);
      console.error("Error response:", error?.response?.data);
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

      let errorMessage = "Failed to create product. Please check all fields.";
      if (error?.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        const errorDetails = validationErrors.map((e: any) => {
          const path = e.path ? e.path.join('.') : '';
          return `${path ? path + ': ' : ''}${e.message}`;
        }).join(", ");
        errorMessage = `Validation errors: ${errorDetails}`;
        console.error("Validation errors:", validationErrors);
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
        if (errorMessage.includes("duplicate key value violates unique constraint") || errorMessage.includes("SKU already exists")) {
          setIsDuplicateSku(true);
          errorMessage = "SKU already exists. Please enter a unique SKU.";
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {


    // Validate required fields
    if (!data.name) {
      toast({
        title: "Validation Error",
        description: "Product name is required",
        variant: "destructive",
      });
      return;
    }

    if (!data.sku) {
      toast({
        title: "Validation Error",
        description: "SKU is required",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields based on selling method
    if (data.sellingMethod === "weight" && !data.pricePerGram && !data.pricePerOunce) {
      toast({
        title: "Validation Error",
        description: "Please enter either price per gram or price per ounce for weight-based products",
        variant: "destructive",
      });
      return;
    }

    if (data.sellingMethod === "units" && !data.enableSizes && !data.price) {
      toast({
        title: "Validation Error", 
        description: "Please enter a price per unit",
        variant: "destructive",
      });
      return;
    }

    if (data.enableSizes && (!data.sizes || data.sizes.length === 0)) {
      toast({
        title: "Validation Error",
        description: "Please add at least one size when sizes are enabled",
        variant: "destructive",
      });
      return;
    }

    if (!data.categoryId) {
      toast({
        title: "Validation Error",
        description: "Please select a category",
        variant: "destructive",
      });
      return;
    }


    createProductMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Apply Template */}
            {priceTemplates.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/30">
                <span className="text-sm font-medium shrink-0">Apply Template:</span>
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a price template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {priceTemplates.map((t: any) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                  {isDuplicateSku && (
                    <p className="text-red-500 text-sm">SKU already exists</p>
                  )}
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
                  <FormControl>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value ? field.value.toString() : ""}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {renderCategoryOptions(categories)}
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter product description" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sellingMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selling Method</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select selling method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="units">By Units (individual items)</SelectItem>
                        <SelectItem value="weight">By Weight (grams/ounces)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("sellingMethod") === "units" ? (
              <>
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

                {form.watch("enableSizes") ? (
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
                                <Input placeholder="e.g., S, M, L or Vanilla, Chocolate" {...field} />
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
                        Click "Add Option" to add product options for this product.
                      </p>
                    )}

                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price per Unit ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price per Unit ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Quantity (units)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
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

                {form.watch("enableSizes") && (
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
                                <Input placeholder="e.g., S, M, L or Vanilla, Chocolate" {...field} />
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
                        Click "Add Option" to add product options for this product.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Price per Gram ($)</label>
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                      placeholder="0"
                      value={form.watch("pricePerGram") || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, "");
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
                        const val = e.target.value.replace(/[^0-9.]/g, "");
                        form.setValue("pricePerOunce", val);
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Price per 1/8th ($)</label>
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                      placeholder="0"
                      value={form.watch("pricePerEighth") || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, "");
                        form.setValue("pricePerEighth", val);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Price per 1/4 ($)</label>
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                      placeholder="0"
                      value={form.watch("pricePerQuarter") || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, "");
                        form.setValue("pricePerQuarter", val);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Price per 1/2 ($)</label>
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                      placeholder="0"
                      value={form.watch("pricePerHalf") || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, "");
                        form.setValue("pricePerHalf", val);
                      }}
                    />
                  </div>
                </div>

                {!form.watch("enableSizes") && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Stock Quantity</label>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 relative">
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={stockLbs}
                          onChange={(e) => setStockLbs(e.target.value)}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">lb</span>
                      </div>
                      <div className="flex-1 relative">
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={stockOz}
                          onChange={(e) => setStockOz(e.target.value)}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">oz</span>
                      </div>
                      <div className="flex-1 relative">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="0"
                          value={stockG}
                          onChange={(e) => setStockG(e.target.value)}
                          className="pr-6"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">g</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Enter any combination of lbs, oz, and grams. Stored as grams (1 oz = 28 g, 1 lb = 448 g).</p>
                  </div>
                )}
              </>
            )}

            {/* Discount Amount Field */}
            <FormField
              control={form.control}
              name="discountAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-7"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("sellingMethod") === "weight" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Min Stock Threshold</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={minStockLbs}
                      onChange={(e) => setMinStockLbs(e.target.value)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">lb</span>
                  </div>
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={minStockOz}
                      onChange={(e) => setMinStockOz(e.target.value)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">oz</span>
                  </div>
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="0"
                      value={minStockG}
                      onChange={(e) => setMinStockG(e.target.value)}
                      className="pr-6"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">g</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Alert when stock falls below this amount</p>
              </div>
            ) : (
              <FormField
                control={form.control}
                name="minStockThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Stock Threshold</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="5" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {form.watch("enableSizes")
                        ? "This threshold will apply to each option individually"
                        : "Alert when stock falls below this number"}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Quantity Pricing Section */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-base font-medium">Quantity Pricing</div>
                  <div className="text-sm text-muted-foreground">
                    Set lower prices when customers order more of this product
                  </div>
                </div>
                <Button
                  type="button"
                  variant={enableQuantityPricing ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const next = !enableQuantityPricing;
                    setEnableQuantityPricing(next);
                    if (next && quantityTiers.length === 0) {
                      setQuantityTiers([{ minQuantity: "2", pricePerItem: "", totalPrice: "" }]);
                    }
                  }}
                >
                  Quantity Pricing
                </Button>
              </div>

              {enableQuantityPricing && (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    When total quantity of this product in an order reaches a tier's minimum, all units of this product get the lower price.
                  </p>
                  {quantityTiers.map((tier, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Min Qty</label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="e.g. 3"
                          value={tier.minQuantity}
                          onChange={(e) => {
                            const updated = [...quantityTiers];
                            const minQuantity = e.target.value;
                            const qty = parseFloat(minQuantity);
                            const total = parseFloat(updated[index].totalPrice ?? "");
                            const perItem = qty > 0 && !isNaN(total) ? (total / qty).toFixed(4) : updated[index].pricePerItem;
                            updated[index] = { ...updated[index], minQuantity, pricePerItem: perItem };
                            setQuantityTiers(updated);
                          }}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Total Price ($)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={tier.totalPrice ?? ""}
                          onChange={(e) => {
                            const updated = [...quantityTiers];
                            const totalPrice = e.target.value;
                            const qty = parseFloat(updated[index].minQuantity);
                            const total = parseFloat(totalPrice);
                            const perItem = qty > 0 && !isNaN(total) ? (total / qty).toFixed(4) : "";
                            updated[index] = { ...updated[index], totalPrice, pricePerItem: perItem };
                            setQuantityTiers(updated);
                          }}
                        />
                        {tier.pricePerItem && !isNaN(parseFloat(tier.pricePerItem)) && (
                          <p className="text-xs text-muted-foreground">
                            ${parseFloat(tier.pricePerItem).toFixed(2)} per item
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setQuantityTiers(quantityTiers.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantityTiers([...quantityTiers, { minQuantity: "", pricePerItem: "", totalPrice: "" }])}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tier
                  </Button>
                </div>
              )}
            </div>

            {/* Image Upload Section */}
            <div className="space-y-2">
              <FormLabel>Product Images (Optional)</FormLabel>

              {imagePreviews.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Click to upload images
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        PNG, JPG, GIF up to 5MB each (multiple images allowed)
                      </span>
                    </label>
                    <input
                      id="image-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
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
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <label htmlFor="image-upload-add" className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => document.getElementById('image-upload-add')?.click()}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add More Images
                    </Button>
                    <input
                      id="image-upload-add"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
              )}
            </div>

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
                disabled={createProductMutation.isPending}
                onClick={() => {}}
              >
                {createProductMutation.isPending ? "Creating..." : "Create Product"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}