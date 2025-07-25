
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
import { PlusCircle, ShoppingBag, Edit, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateProductDescription } from '@/ai/flows/product-description-generator';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_PRODUCT_NAMES = ["ET", "TOI", "General"];

export default function ProductsPage() {
  const { availableProducts, addProduct, editProduct, deleteProduct } = useProductContext();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductObject | null>(null);
  const [editedProductName, setEditedProductName] = useState('');
  const [editedProductDescription, setEditedProductDescription] = useState('');
  
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleAddProduct = () => {
    if (newProductName.trim()) {
      const success = addProduct({
        name: newProductName.trim(),
        description: newProductDescription.trim(),
      });
      if (success) {
        setNewProductName('');
        setNewProductDescription('');
        setIsAddDialogOpen(false);
      }
    }
  };

  const openEditDialog = (product: ProductObject) => {
    setProductToEdit(product);
    setEditedProductName(product.name);
    setEditedProductDescription(product.description || '');
    setIsEditDialogOpen(true);
  };
  
  const handleEditProduct = () => {
    if (productToEdit && editedProductName.trim()) {
      const success = editProduct(productToEdit.name, {
        name: editedProductName.trim(),
        description: editedProductDescription.trim(),
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
    const nameToGenerate = context === 'add' ? newProductName : editedProductName;
    if (!nameToGenerate.trim()) {
        toast({ variant: 'destructive', title: 'Product Name Required', description: 'Please enter a product name before generating a description.' });
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
        toast({ title: 'Description Generated', description: 'AI has generated a product description.' });
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
              {availableProducts.length} product(s) available. Default products (ET, TOI, General) cannot be edited or deleted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-350px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isClient && availableProducts.map((product) => (
                    <TableRow key={product.name}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.description || <span className="italic">No description</span>}
                      </TableCell>
                       <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(product)}
                          disabled={DEFAULT_PRODUCT_NAMES.includes(product.name)}
                          title={DEFAULT_PRODUCT_NAMES.includes(product.name) ? "Default products cannot be edited" : "Edit product"}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(product)}
                          disabled={DEFAULT_PRODUCT_NAMES.includes(product.name)}
                          className="text-destructive hover:text-destructive/80"
                          title={DEFAULT_PRODUCT_NAMES.includes(product.name) ? "Default products cannot be deleted" : "Delete product"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isClient && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Create a new product. It will be available for selection across all features.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="product-name" className="text-right">
                Name
              </Label>
              <Input
                id="product-name"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., My Awesome Product"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="product-description" className="text-right pt-2">
                Description
              </Label>
              <div className="col-span-3 space-y-2">
                <Textarea
                  id="product-description"
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>
                Update the name and description for '{productToEdit.name}'.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-product-name" className="text-right">Name</Label>
                <Input
                  id="edit-product-name"
                  value={editedProductName}
                  onChange={(e) => setEditedProductName(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., My Awesome Product"
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
                    <span className="font-semibold"> "{productToDelete.name}" </span>.
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
