"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  getFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  type Faq,
  ApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  HelpCircle,
  ArrowUpDown,
} from "lucide-react";

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editFaq, setEditFaq] = useState<Faq | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form State
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("General");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const fetchData = useCallback(async () => {
    try {
      const res = await getFaqs();
      setFaqs(res.faqs);
    } catch {
      toast.error("Failed to load FAQs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Unique categories for filtering
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    faqs.forEach((f) => {
      if (f.category) set.add(f.category);
    });
    return Array.from(set);
  }, [faqs]);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesCategory =
        selectedCategory === "ALL" || faq.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        (faq.category && faq.category.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [faqs, selectedCategory, searchQuery]);

  const resetForm = () => {
    setQuestion("");
    setAnswer("");
    setCategory("General");
    setDisplayOrder(String(faqs.length + 1));
    setIsActive(true);
    setEditFaq(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (faq: Faq) => {
    setEditFaq(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setCategory(faq.category || "General");
    setDisplayOrder(String(faq.displayOrder));
    setIsActive(faq.isActive);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      toast.error("Question cannot be empty");
      return;
    }
    if (!answer.trim()) {
      toast.error("Answer cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const data = {
        question: question.trim(),
        answer: answer.trim(),
        category: category.trim() || undefined,
        displayOrder: Number(displayOrder) || 0,
        isActive,
      };

      if (editFaq) {
        await updateFaq(editFaq.id, data);
        toast.success("FAQ updated successfully");
      } else {
        await createFaq(data);
        toast.success("FAQ created successfully");
      }
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save FAQ");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (faq: Faq) => {
    setTogglingId(faq.id);
    try {
      await updateFaq(faq.id, { isActive: !faq.isActive });
      toast.success(
        `FAQ ${!faq.isActive ? "activated" : "hidden"} successfully`,
      );
      setFaqs((prev) =>
        prev.map((item) =>
          item.id === faq.id ? { ...item, isActive: !item.isActive } : item,
        ),
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to update status",
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteFaq(deleteId);
      toast.success("FAQ deleted successfully");
      await fetchData();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete FAQ",
      );
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Frequently Asked Questions
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage FAQs displayed on the customer website. Changes reflect
            immediately on the live site.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add FAQ
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions, answers, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant={selectedCategory === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("ALL")}
          >
            All ({faqs.length})
          </Button>
          {categoriesList.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat} (
              {faqs.filter((f) => f.category === cat).length})
            </Button>
          ))}
        </div>
      </div>

      {/* Table / List */}
      <Card>
        <CardContent className="p-0">
          {filteredFaqs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <HelpCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-base font-medium">No FAQs found</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery || selectedCategory !== "ALL"
                  ? "Try clearing your search or category filters."
                  : "Click 'Add FAQ' above to create your first question."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className="h-3 w-3" />
                      Order
                    </div>
                  </TableHead>
                  <TableHead className="w-[280px]">Question</TableHead>
                  <TableHead>Answer</TableHead>
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead className="w-[100px] text-center">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFaqs.map((faq) => (
                  <TableRow key={faq.id}>
                    <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                      #{faq.displayOrder}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {faq.question}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-md">
                      <div className="line-clamp-2 whitespace-pre-line">
                        {faq.answer}
                      </div>
                    </TableCell>
                    <TableCell>
                      {faq.category ? (
                        <Badge variant="secondary" className="text-xs">
                          {faq.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={faq.isActive}
                          disabled={togglingId === faq.id}
                          onCheckedChange={() => handleToggleActive(faq)}
                        />
                        <span className="text-xs text-muted-foreground w-12 text-left">
                          {faq.isActive ? "Active" : "Hidden"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(faq)}
                          title="Edit FAQ"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(faq.id)}
                          title="Delete FAQ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editFaq ? "Edit FAQ" : "Add New FAQ"}
            </DialogTitle>
            <DialogDescription>
              {editFaq
                ? "Update question, answer or display settings."
                : "Create a new frequently asked question for customer view."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                placeholder="e.g. Do you have dine-in facilities?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="answer">Answer</Label>
              <Textarea
                id="answer"
                placeholder="Write the detailed answer here..."
                rows={5}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g. Menu, Delivery, General"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order (Sort sequence)</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  min="0"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="active-toggle" className="font-medium">
                  Visible on website
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, this FAQ will be visible to all customers on the
                  website.
                </p>
              </div>
              <Switch
                id="active-toggle"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editFaq ? "Save Changes" : "Create FAQ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this FAQ?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the question from both the database
              and the customer website.
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
