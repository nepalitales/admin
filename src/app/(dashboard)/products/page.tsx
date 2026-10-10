"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  getProducts,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImage,
  type Product,
  type Category,
  ApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  UploadCloud,
  ImageIcon,
  CheckCircle2,
  X,
  Utensils,
  LayoutGrid,
  List,
} from "lucide-react";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  useEffect(() => {
    const saved = localStorage.getItem("products-view-mode");
    if (saved === "grid" || saved === "table") {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = (mode: "table" | "grid") => {
    setViewMode(mode);
    localStorage.setItem("products-view-mode", mode);
  };

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<"veg" | "non-veg">("veg");
  const [quantity, setQuantity] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState("");

  // Image Upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        getProducts({ limit: 100 }),
        getCategories(),
      ]);
      setProducts(prodRes.products);
      setCategories(catRes.categories);
    } catch {
      toast.error("Failed to load products data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setCategoryId("");
    setType("veg");
    setQuantity("");
    setIsAvailable(true);
    setImageUrl("");
    setEditProduct(null);
    setUploadingImage(false);
    setShowUrlFallback(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditProduct(product);
    setName(product.name);
    setDescription(product.description);
    setPrice(String(product.price));
    setCategoryId(product.categoryId);
    setType(product.type || "veg");
    setQuantity(product.quantity || "");
    setIsAvailable(product.isAvailable);
    setImageUrl(product.image);
    setUploadingImage(false);
    setShowUrlFallback(false);
    setDialogOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, JPEG, WebP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file must be under 10MB");
      return;
    }

    setUploadingImage(true);
    try {
      const res = await uploadImage(file);
      setImageUrl(res.url);
      toast.success("Image uploaded to Cloudinary successfully");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to upload image to Cloudinary");
    } finally {
      setUploadingImage(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageUrl.trim()) {
      toast.error("Please upload a product image");
      return;
    }

    setSaving(true);
    try {
      const data = {
        name,
        description,
        price: Number(price),
        image: imageUrl,
        categoryId,
        type,
        quantity: quantity.trim() || undefined,
        isAvailable,
      };

      if (editProduct) {
        await updateProduct(editProduct.id, data);
        toast.success("Product updated");
      } else {
        await createProduct(data);
        toast.success("Product created");
      }
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProduct(deleteId);
      toast.success("Product deleted");
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete product");
    } finally {
      setDeleteId(null);
    }
  };

  const getCategoryName = (catId: string) => {
    const found = categories.find((c) => c.id === catId);
    if (found) return found.name;
    return catId ? "Uncategorized" : "Select Category";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header with View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-sm text-muted-foreground">{products.length} items on the menu</p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
            <Button
              type="button"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 gap-1.5 text-xs font-medium"
              onClick={() => handleViewModeChange("table")}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 gap-1.5 text-xs font-medium"
              onClick={() => handleViewModeChange("grid")}
              title="Cards view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </Button>
          </div>

          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        /* ── Cards / Grid View ──────────────────────────────── */
        products.length === 0 ? (
          <Card className="py-12">
            <CardContent className="text-center text-muted-foreground">
              <Utensils className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="font-medium text-sm">No products found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click &ldquo;Add Product&rdquo; to add your first menu item.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <Card
                key={product.id}
                className="p-0 gap-0 overflow-hidden group hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Product Photo & Badges */}
                <div className="relative h-44 w-full bg-muted/30 overflow-hidden rounded-t-xl border-b flex items-center justify-center">
                  {product.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-muted-foreground/30">
                      <Utensils className="h-8 w-8" />
                      <span className="text-[11px] font-medium">No photo</span>
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="backdrop-blur-md bg-background/85 shadow-xs text-xs font-medium"
                    >
                      {getCategoryName(product.categoryId)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`backdrop-blur-md shadow-xs text-[11px] font-semibold gap-1 ${
                        product.type === "non-veg"
                          ? "bg-rose-950/70 border-rose-500/50 text-rose-300"
                          : "bg-emerald-950/70 border-emerald-500/50 text-emerald-300"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          product.type === "non-veg" ? "bg-rose-400" : "bg-emerald-400"
                        }`}
                      />
                      {product.type === "non-veg" ? "Non-Veg" : "Veg"}
                    </Badge>
                  </div>

                  <div className="absolute top-2.5 right-2.5">
                    <Badge
                      variant={product.isAvailable ? "default" : "secondary"}
                      className={`text-xs shadow-xs backdrop-blur-md ${
                        product.isAvailable
                          ? "bg-emerald-600/90 text-white"
                          : "bg-background/85 text-muted-foreground"
                      }`}
                    >
                      {product.isAvailable ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                </div>

                {/* Card Info */}
                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-base leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                        {product.quantity && (
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {product.quantity}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-base text-foreground shrink-0">
                        ₹{product.price}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {product.description || "No description provided."}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t flex items-center justify-end gap-1.5 mt-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(product)}
                      className="h-8 text-xs gap-1.5 flex-1 sm:flex-initial"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(product.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete Product"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* ── List / Table View ──────────────────────────────── */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Portion</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-25 text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      <Utensils className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="font-medium text-sm">No products found</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Click &ldquo;Add Product&rdquo; to add your first menu item.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.image ? (
                            <div className="h-11 w-11 rounded-lg overflow-hidden border bg-muted shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-11 w-11 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                              <Utensils className="h-5 w-5 opacity-40" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium leading-snug">{product.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs mt-0.5">
                              {product.description}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getCategoryName(product.categoryId)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            product.type === "non-veg"
                              ? "border-rose-500/30 text-rose-400 bg-rose-500/10 gap-1 text-[11px]"
                              : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1 text-[11px]"
                          }
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              product.type === "non-veg" ? "bg-rose-500" : "bg-emerald-500"
                            }`}
                          />
                          {product.type === "non-veg" ? "Non-Veg" : "Veg"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">
                        {product.quantity || "—"}
                      </TableCell>
                      <TableCell className="font-mono">₹{product.price}</TableCell>
                      <TableCell>
                        <Badge variant={product.isAvailable ? "default" : "outline"}>
                          {product.isAvailable ? "Available" : "Unavailable"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(product.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>
              {editProduct
                ? "Update the product details and Cloudinary image below."
                : "Fill in the details and upload a photo for the new product."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prod-name">Name</Label>
              <Input
                id="prod-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chicken Jhol Momo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prod-desc">Description</Label>
              <Textarea
                id="prod-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of ingredients, flavor and serving"
                required
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prod-price">Price (₹)</Label>
                <Input
                  id="prod-price"
                  type="number"
                  min="1"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="249"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-cat">Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(val) => setCategoryId(val ?? "")}
                  items={categories.map((c) => ({ value: c.id, label: c.name }))}
                  required
                >
                  <SelectTrigger id="prod-cat" className="w-full">
                    <SelectValue placeholder="Select Category">
                      {(val: string | null) => (val ? getCategoryName(val) : "Select Category")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Food Type & Portion / Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Food Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={type === "veg" ? "default" : "outline"}
                    className={`h-9 text-xs gap-1.5 ${
                      type === "veg"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        : "border-emerald-600/30 text-emerald-500 hover:bg-emerald-500/10"
                    }`}
                    onClick={() => setType("veg")}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Veg
                  </Button>
                  <Button
                    type="button"
                    variant={type === "non-veg" ? "default" : "outline"}
                    className={`h-9 text-xs gap-1.5 ${
                      type === "non-veg"
                        ? "bg-rose-600 hover:bg-rose-700 text-white font-medium"
                        : "border-rose-600/30 text-rose-500 hover:bg-rose-500/10"
                    }`}
                    onClick={() => setType("non-veg")}
                  >
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    Non-Veg
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-qty">Portion / Quantity</Label>
                <Input
                  id="prod-qty"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 6 pcs, 2 pcs"
                />
              </div>
            </div>

            {/* Cloudinary Image Upload Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Product Image</Label>
                {imageUrl && (
                  <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Stored in Cloudinary
                  </span>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={onFileInputChange}
              />

              {imageUrl ? (
                /* Preview card when image is uploaded */
                <div className="relative rounded-xl border bg-muted/20 p-2 overflow-hidden group">
                  <div className="relative h-44 w-full rounded-lg overflow-hidden bg-background border flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Product preview"
                      className="h-full w-full object-cover"
                    />

                    {uploadingImage && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs font-medium">Uploading new image...</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between px-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="h-8 text-xs gap-1.5"
                    >
                      <UploadCloud className="h-3.5 w-3.5" /> Change Photo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setImageUrl("")}
                      disabled={uploadingImage}
                      className="h-8 text-xs text-destructive hover:text-destructive gap-1"
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                /* Upload dropzone area */
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => !uploadingImage && fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all
                    ${dragActive
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 bg-muted/15 hover:bg-muted/30"
                    }
                  `}
                >
                  {uploadingImage ? (
                    <div className="py-4 flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        Uploading to Cloudinary...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <UploadCloud className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground">
                          Click to upload or drag &amp; drop product photo
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          PNG, JPG, WebP up to 10MB (automatically stored in Cloudinary)
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Optional URL Toggle */}
              <div className="pt-1 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowUrlFallback(!showUrlFallback)}
                  className="text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  {showUrlFallback ? "Hide URL input" : "Or enter existing image URL"}
                </button>
              </div>

              {showUrlFallback && (
                <div className="pt-1">
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://res.cloudinary.com/..."
                    className="text-xs font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="prod-avail"
                checked={isAvailable}
                onCheckedChange={setIsAvailable}
              />
              <Label htmlFor="prod-avail">Available for order</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || uploadingImage}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editProduct ? "Update Product" : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the item from the menu and delete its image from Cloudinary.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
