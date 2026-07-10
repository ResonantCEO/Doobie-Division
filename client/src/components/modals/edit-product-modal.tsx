import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
  pricePerEighth: z.string().optional(),
  pricePerQuarter: z.string().optional(),
  pricePerHalf: z.string().optional(),
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
  const [stockLbs, setStockLbs] = useState("");
  const [stockOz, setStockOz] = useState("");
  const [stockG, setStockG] = useState("");
  const [minStockLbs, setMinStockLbs] = useState("");
  const [minStockOz, setMinStockOz] = useState("");
  const [minStockG, setMinStockG] = useState("");
  const [enableQuantityPricing, setEnableQuantityPricing] = useState(false);
  const [quantityTiers, setQuantityTiers] = useState<Array<{minQuantity: string; pricePerItem: string; totalPrice?: string}>>([]);

  const isAdmin = user?.role === "admin";

  const hasSizes = !!(product.sizes && product.sizes.length > 0);

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
        pricePerEighth: (product as any).pricePerEighth || "",
        pricePerQuarter: (product as any).pricePerQuarter || "",
        pricePerHalf: (product as any).pricePerHalf || "",
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

      // Initialize quantity pricing tiers
      const existingTiers = (product as any).quantityPricing as Array<{minQuantity: number; pricePerItem: string}> | undefined;
      if (existingTiers && existingTiers.length > 0) {
        setEnableQuantityPricing(true);
        setQuantityTiers(existingTiers.map(t => ({
          minQuantity: t.minQuantity.toString(),
          pricePerItem: t.pricePerItem,
          totalPrice: (parseFloat(t.pricePerItem) * t.minQuantity).toFixed(2),
        })));
      } else {
        setEnableQuantityPricing(false);
        setQuantityTiers([]);
      }

      // Pre-populate lb/oz/g fields from grams for weight-based products
      if (product.sellingMethod === "weight") {
        const totalG = product.stock;
        const lbs = Math.floor(totalG / 448);
        const remaining = totalG - lbs * 448;
        const oz = Math.floor(remaining / 28);
        const g = remaining - oz * 28;
        setStockLbs(lbs > 0 ? lbs.toString() : "");
        setStockOz(oz > 0 ? oz.toString() : "");
        setStockG(g > 0 ? g.toString() : "");

        const minG = product.minStockThreshold;
        const mLbs = Math.floor(minG / 448);
        const mRemaining = minG - mLbs * 448;
        const mOz = Math.floor(mRemaining / 28);
        const mGrams = mRemaining - mOz * 28;
        setMinStockLbs(mLbs > 0 ? mLbs.toString() : "");
        setMinStockOz(mOz > 0 ? mOz.toString() : "");
        setMinStockG(mGrams > 0 ? mGrams.toString() : "");
      } else {
        setStockLbs(""); setStockOz(""); setStockG("");
        setMinStockLbs(""); setMinStockOz(""); setMinStockG("");
      }
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

      const combineToGrams = (lbs: string, oz: string, g: string) => {
        return (
          Math.round(parseFloat(lbs || "0") * 448) +
          Math.round(parseFloat(oz || "0") * 28) +
          Math.round(parseFloat(g || "0"))
        );
      };

      let totalStock: number;
      if (data.enableSizes && data.sizes && data.sizes.length > 0) {
        totalStock = data.sizes.reduce((sum: number, s: { quantity: string }) => sum + parseInt(s.quantity || "0"), 0);
      } else if (data.sellingMethod === "weight") {
        totalStock = combineToGrams(stockLbs, stockOz, stockG);
      } else {
        totalStock = parseInt(data.stock);
      }

      const minStockValue = data.sellingMethod === "weight"
        ? combineToGrams(minStockLbs, minStockOz, minStockG)
        : parseInt(data.minStockThreshold);

      // Handle discountPercentage - convert empty string, null, or undefined to "0"
      // Also handle the case where user wants to remove discount (set to 0)
      let discountValue = "0";
      if (data.discountPercentage !== undefined && data.discountPercentage !== null) {
        const trimmed = String(data.discountPercentage).trim();
        if (trimmed !== "" && !isNaN(parseFloat(trimmed))) {
          discountValue = trimmed;
        }
      }
      
      // Helper to safely parse and format price values
      const formatPrice = (value: any, decimals: number = 2): string | null => {
        if (value === undefined || value === null || value === "") return null;
        const num = parseFloat(String(value));
        return isNaN(num) ? null : num.toFixed(decimals);
      };

      const productData: any = {
        name: data.name,
        company: data.company || null,
        description: data.description || null,
        sku: data.sku,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        stock: totalStock,
        minStockThreshold: minStockValue,
        sellingMethod: data.sellingMethod,
        weightUnit: data.weightUnit,
        imageUrl,
        imageUrls,
        price: data.sellingMethod === "units" ? formatPrice(data.price, 2) : null,
        pricePerGram: data.sellingMethod === "weight" ? formatPrice(data.pricePerGram, 4) : null,
        pricePerOunce: data.sellingMethod === "weight" ? formatPrice(data.pricePerOunce, 2) : null,
        pricePerEighth: data.sellingMethod === "weight" ? formatPrice(data.pricePerEighth, 2) : null,
        pricePerQuarter: data.sellingMethod === "weight" ? formatPrice(data.pricePerQuarter, 2) : null,
        pricePerHalf: data.sellingMethod === "weight" ? formatPrice(data.pricePerHalf, 2) : null,
        discountPercentage: discountValue,
        purchasePrice: formatPrice(data.purchasePrice, 2),
        purchasePriceMethod: data.purchasePriceMethod || "units",
        purchasePricePerGram: formatPrice(data.purchasePricePerGram, 4),
        purchasePricePerOunce: formatPrice(data.purchasePricePerOunce, 2),
        adminNotes: data.adminNotes || null,
        isActive: data.isActive,
        sizes: data.enableSizes && data.sizes && data.sizes.length > 0
          ? data.sizes.map(s => ({ size: s.size, quantity: parseInt(s.quantity || "0") }))
          : [],
        quantityPricing: enableQuantityPricing
          ? quantityTiers
              .filter(t => t.minQuantity && t.pricePerItem)
              .map(t => ({ minQuantity: parseInt(t.minQuantity), pricePerItem: t.pricePerItem }))
          : [],
      };
      
      // Remove undefined values to avoid sending them
      Object.keys(productData).forEach(key => {
        if (productData[key] === undefined) {
          delete productData[key];
        }
      });

      console.log('[EditProductModal] Sending product data:', JSON.stringify(productData, null, 2));
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
    onError: (error: any) => {
      console.error('[EditProductModal] Update error:', error);
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
      const errorMessage = error?.response?.data?.error || error?.message || "Failed to update product";
      const validationErrors = error?.response?.data?.errors;
      toast({
        title: "Error",
        description: validationErrors 
          ? `Validation error: ${validationErrors.map((e: any) => e.message).join(", ")}`
          : errorMessage,
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
              sellingMethod === "weight" ? (
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
              ) : (
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
              )
            )}

            {sellingMethod === "weight" ? (
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
                      placeholder="5"
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
                      <Input type="number" min="1" placeholder="5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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