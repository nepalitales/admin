"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  getAddons,
  createAddon,
  updateAddon,
  deleteAddon,
  uploadImage,
  type Addon,
  ApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  PlusCircle,
  X,
} from "lucide-react";

export default function AddonsPage() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editAddon, setEditAddon] = useState<Addon | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await getAddons({ forceRefresh: true });
      setAddons(res.addons);
    } catch {
      toast.error("Failed to load add-ons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setName("");
    setPrice("");
    setDisplayOrder("0");
    setIsAvailable(true);
    setImageUrl("");
    setEditAddon(null);
    setUploadingImage(false);
    setShowUrlFallback(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (addon: Addon) => {
    setEditAddon(addon);
    setName(addon.name);
    setPrice(String(addon.price));
    setDisplayOrder(String(addon.displayOrder));
    setIsAvailable(addon.isAvailable);
    setImageUrl(addon.image);
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
      const res = await uploadImage(file, "addons");
      setImageUrl(res.url);
      toast.success("Image uploaded to Cloudinary");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to upload image");
    } finally {
      setUploadingImage(false);
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
    if (file) handleFileUpload(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) {
      toast.error("Please upload an add-on image");
      return;
    }

    setSaving(true);
    try {
      const data = {
        name,
        price: Number(price),
        image: imageUrl,
        isAvailable,
        displayOrder: Number(displayOrder) || 0,
      };

      if (editAddon) {
        await updateAddon(editAddon.id, data);
        toast.success("Add-on updated");
      } else {
        await createAddon(data);
        toast.success("Add-on created");
      }
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save add-on");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAddon(deleteId);
      toast.success("Add-on deleted");
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete add-on");
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggleAvailable = async (addon: Addon) => {
    try {
      await updateAddon(addon.id, { isAvailable: !addon.isAvailable });
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update add-on");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Add-ons</h2>
          <p className="text-muted-foreground">
            {addons.length} extras · images on Cloudinary, data in MongoDB
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Add add-on
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-25">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <PlusCircle className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                    <p className="font-medium text-sm">No add-ons yet</p>
                    <p className="text-xs mt-0.5">
                      Create extras here to seed the catalog for the storefront.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                addons.map((addon) => (
                  <TableRow key={addon.id}>
                    <TableCell>
                      {addon.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={addon.image}
                          alt={addon.name}
                          className="size-12 rounded-md object-cover"
                        />
                      ) : (
                        <div className="size-12 rounded-md bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{addon.name}</TableCell>
                    <TableCell>₹{addon.price}</TableCell>
                    <TableCell>{addon.displayOrder}</TableCell>
                    <TableCell>
                      <button type="button" onClick={() => handleToggleAvailable(addon)}>
                        <Badge variant={addon.isAvailable ? "secondary" : "outline"}>
                          {addon.isAvailable ? "Available" : "Hidden"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(addon)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(addon.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 />
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editAddon ? "Edit add-on" : "Add add-on"}</DialogTitle>
            <DialogDescription>
              {editAddon
                ? "Update name, price, or Cloudinary image."
                : "Upload an image, then set name and price. This seeds the public catalog."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            <div className="flex flex-col gap-2">
              <Label>Image</Label>
              {imageUrl ? (
                <div>
                  <div className="relative h-40 w-full overflow-hidden rounded-xl border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Add-on preview" className="h-full w-full object-cover" />
                    {uploadingImage && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80">
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <span className="text-xs font-medium">Uploading...</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      <UploadCloud data-icon="inline-start" />
                      Change photo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setImageUrl("")}
                      disabled={uploadingImage}
                      className="text-destructive hover:text-destructive"
                    >
                      <X data-icon="inline-start" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => !uploadingImage && fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center ${
                    dragActive ? "border-primary bg-primary/10" : "border-border bg-muted/15"
                  }`}
                >
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
                      <Loader2 className="size-8 animate-spin text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        Uploading to Cloudinary...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <UploadCloud />
                      </div>
                      <p className="text-xs font-medium">Click or drag an add-on photo</p>
                      <p className="text-[11px] text-muted-foreground">PNG, JPG, WebP up to 10MB</p>
                    </>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowUrlFallback(!showUrlFallback)}
                className="text-left text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {showUrlFallback ? "Hide URL input" : "Or enter existing image URL"}
              </button>
              {showUrlFallback && (
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                  className="font-mono text-xs"
                />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="addon-name">Name</Label>
              <Input
                id="addon-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Extra chutney"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="addon-price">Price (₹)</Label>
              <Input
                id="addon-price"
                type="number"
                min="1"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                placeholder="20"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="addon-order">Display order</Label>
              <Input
                id="addon-order"
                type="number"
                min="0"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch id="addon-avail" checked={isAvailable} onCheckedChange={setIsAvailable} />
              <Label htmlFor="addon-avail">Available for customers</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || uploadingImage}>
                {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
                {editAddon ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete add-on?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the catalog and deletes its image from Cloudinary.
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
