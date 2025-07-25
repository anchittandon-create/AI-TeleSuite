
"use client";

import { useState, useEffect } from 'react';
import { useProductContext } from '@/hooks/useProductContext';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProductObject } from '@/types';
import { PlusCircle, ShoppingBag, Edit, Trash2, Sparkles, Loader2, LinkIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateProductDescription } from '@/ai/flows/product-description-generator';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_PRODUCT_NAMES = ["ET", "TOI", "General"];

export default function ProductsPage() {
  const { availableProducts, addProduct, editProduct, deleteProduct } = useProductContext();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newProductDisplayName, setNewProductDisplayName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newProductBrandName, setNewProductBrandName] = useState('');
  const [newProductBrandUrl, setNewProductBrandUrl] = useState('');


  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductObject | null>(null);
  const [editedProductDisplayName, setEditedProductDisplayName] = useState('');
  const [editedProductDescription, setEditedProductDescription] = useState('');
  const [editedProductBrandName, setEditedProductBrandName] = useState('');
  const [editedProductBrandUrl, setEditedProductBrandUrl] = useState('');
  
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleAddProduct = () => {
    if (newProductDisplayName.trim()) {
      const success = addProduct({
        displayName: newProductDisplayName.trim(),
        description: newProductDescription.trim(),
        brandName: newProductBrandName.trim(),
        brandUrl: newProductBrandUrl.trim()
      });
      if (success) {
        setNewProductDisplayName('');
        setNewProductDescription('');
        setNewProductBrandName('');
        setNewProductBrandUrl('');
        setIsAddDialogOpen(false);
      }
    }
  };

  const openEditDialog = (product: ProductObject) => {
    setProductToEdit(product);
    setEditedProductDisplayName(product.displayName);
    setEditedProductDescription(product.description || '');
    setEditedProductBrandName(product.brandName || '');
    setEditedProductBrandUrl(product.brandUrl || '');
    setIsEditDialogOpen(true);
  };
  
  const handleEditProduct = () => {
    if (productToEdit && editedProductDisplayName.trim()) {
      const success = editProduct(productToEdit.name, {
        name: productToEdit.name, // Keep original system name
        displayName: editedProductDisplayName.trim(),
        description: editedProductDescription.trim(),
        brandName: editedProductBrandName.trim(),
        brandUrl: editedProductBrandUrl.trim()
      });
      if (success) {
        setIsEditDialogOpen(false);
        setProductToEdit(null);
      }
    }
  };
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductObject | null>(null);
  
  const openDeleteDialog = (product: ProductObject) => {
    if (DEFAULT_PRODUCT_NAMES.includes(product.name)) {
        toast({
            variant: "destructive",
            title: "Action Forbidden",
            description: "Default products cannot be deleted as they are integral to the application."
        });
        return;
    }
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteProduct = () => {
    if (productToDelete) {
      const success = deleteProduct(productToDelete.name);
      if (success) {
        setIsDeleteDialogOpen(false);
        setProductToDelete(null);
      }
    }
  };
  
  const handleGenerateDescription = async (context: 'add' | 'edit') => {
    const nameToGenerate = context === 'add' ? newProductDisplayName : editedProductDisplayName;
    if (!nameToGenerate.trim()) {
        toast({ variant: 'destructive', title: 'Product Display Name Required', description: 'Please enter a display name before generating a description.' });
        return;
    }
    setIsGeneratingDesc(true);
    try {
        const result = await generateProductDescription({ productName: nameToGenerate });
        if (context === 'add') {
            setNewProductDescription(result.description);
        } else {
            setEditedProductDescription(result.description);
        }
        toast({ title: 'Description Generated', description: 'AI has generated a product description based on the brand name.' });
    } catch (error) {
        console.error("Error generating product description:", error);
        toast({ variant: 'destructive', title: 'Generation Failed', description: 'Could not generate description from AI.' });
    } finally {
        setIsGeneratingDesc(false);
    }
  };


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Product Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Your Products</h1>
            <p className="text-muted-foreground">
              View, add, edit, or delete products used across the application.
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Product
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
                <ShoppingBag className="mr-2 h-5 w-5 text-primary"/>
                Product List
            </CardTitle>
            <CardDescription>
              {availableProducts.length} product(s) available. You can edit the display name and other details for any product.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-350px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Brand Name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isClient && availableProducts.map((product) => (
                    <TableRow key={product.name}>
                      <TableCell className="font-medium">{product.displayName}</TableCell>
                      <TableCell className="text-muted-foreground max-w-sm truncate" title={product.description}>
                        {product.description || <span className="italic">No description</span>}
                      </TableCell>
                       <TableCell className="text-muted-foreground">
                        {product.brandUrl ? (
                          <a href={product.brandUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center text-primary">
                            <LinkIcon className="h-3 w-3 mr-1"/>{product.brandName || "Visit Link"}
                          </a>
                        ) : product.brandName || <span className="italic">N/A</span>}
                      </TableCell>
                       <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(product)}
                          title="Edit product"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(product)}
                          disabled={DEFAULT_PRODUCT_NAMES.includes(product.name)}
                          className="text-destructive hover:text-destructive/80 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={DEFAULT_PRODUCT_NAMES.includes(product.name) ? "Default products cannot be deleted" : "Delete product"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isClient && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        Loading products...
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Create a new product. It will be available for selection across all features.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-product-display-name" className="text-right">
                Display Name
              </Label>
              <Input
                id="new-product-display-name"
                value={newProductDisplayName}
                onChange={(e) => setNewProductDisplayName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., MagicBricks"
              />
            </div>
             <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="new-product-brand-name" className="text-right pt-2">
                Brand Name
              </Label>
              <Input
                id="new-product-brand-name"
                value={newProductBrandName}
                onChange={(e) => setNewProductBrandName(e.target.value)}
                className="col-span-3"
                placeholder="(Optional) Official brand name"
              />
            </div>
             <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="new-product-brand-url" className="text-right pt-2">
                Brand URL
              </Label>
              <Input
                id="new-product-brand-url"
                value={newProductBrandUrl}
                onChange={(e) => setNewProductBrandUrl(e.target.value)}
                className="col-span-3"
                placeholder="(Optional) https://www.brand.com"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="new-product-description" className="text-right pt-2">
                Description
              </Label>
              <div className="col-span-3 space-y-2">
                <Textarea
                  id="new-product-description"
                  value={newProductDescription}
                  onChange={(e) => setNewProductDescription(e.target.value)}
                  placeholder="(Optional) A short description of the product."
                />
                <Button size="xs" variant="outline" onClick={() => handleGenerateDescription('add')} disabled={isGeneratingDesc}>
                  {isGeneratingDesc ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                  Generate with AI
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button type="submit" onClick={handleAddProduct}>Add Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Product Dialog */}
      {productToEdit && (
         <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>
                Update the details for '{productToEdit.displayName}'.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-product-display-name" className="text-right">Display Name</Label>
                <Input
                  id="edit-product-display-name"
                  value={editedProductDisplayName}
                  onChange={(e) => setEditedProductDisplayName(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., My Awesome Product"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="edit-product-brand-name" className="text-right pt-2">
                  Brand Name
                </Label>
                <Input
                  id="edit-product-brand-name"
                  value={editedProductBrandName}
                  onChange={(e) => setEditedProductBrandName(e.target.value)}
                  className="col-span-3"
                  placeholder="(Optional) Official brand name"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="edit-product-brand-url" className="text-right pt-2">
                  Brand URL
                </Label>
                <Input
                  id="edit-product-brand-url"
                  value={editedProductBrandUrl}
                  onChange={(e) => setEditedProductBrandUrl(e.target.value)}
                  className="col-span-3"
                  placeholder="(Optional) https://www.brand.com"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="edit-product-description" className="text-right pt-2">Description</Label>
                <div className="col-span-3 space-y-2">
                    <Textarea
                      id="edit-product-description"
                      value={editedProductDescription}
                      onChange={(e) => setEditedProductDescription(e.target.value)}
                      placeholder="(Optional) A short description of the product."
                    />
                    <Button size="xs" variant="outline" onClick={() => handleGenerateDescription('edit')} disabled={isGeneratingDesc}>
                        {isGeneratingDesc ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                        Generate with AI
                    </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" onClick={handleEditProduct}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Product Confirmation Dialog */}
       {productToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the product 
                    <span className="font-semibold"> "{productToDelete.displayName}" </span>.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeleteProduct}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                    Yes, delete it
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}
