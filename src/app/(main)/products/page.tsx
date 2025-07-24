
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProductObject } from '@/types';
import { PlusCircle, ShoppingBag } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ProductsPage() {
  const { availableProducts, addProduct } = useProductContext();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [isClient, setIsClient] = useState(false);

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

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Product Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Your Products</h1>
            <p className="text-muted-foreground">
              View and manage the products used across the application.
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
              {availableProducts.length} product(s) available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-350px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isClient && availableProducts.map((product) => (
                    <TableRow key={product.name}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.description || <span className="italic">No description</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isClient && (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center">
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="product-description" className="text-right">
                Description
              </Label>
              <Textarea
                id="product-description"
                value={newProductDescription}
                onChange={(e) => setNewProductDescription(e.target.value)}
                className="col-span-3"
                placeholder="(Optional) A short description of the product."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button type="submit" onClick={handleAddProduct}>Add Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
