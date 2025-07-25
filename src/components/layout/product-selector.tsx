
"use client";

import React, { useState } from 'react';
import { useProductContext } from '@/hooks/useProductContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';

export function ProductSelector() {
  const { availableProducts, selectedProduct, setSelectedProduct, addProduct } = useProductContext();
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");

  const handleAddNewProduct = () => {
    if (addProduct({ name: newProductName.trim(), description: newProductDescription.trim() })) {
      const newName = newProductName.trim();
      setSelectedProduct(newName);
      setNewProductName("");
      setNewProductDescription("");
      setIsAddProductDialogOpen(false);
    }
  };

  const handleSelectChange = (value: string) => {
    if (value === 'add_new_product') {
      setIsAddProductDialogOpen(true);
    } else {
      setSelectedProduct(value);
    }
  };

  return (
    <>
      <Select value={selectedProduct} onValueChange={handleSelectChange}>
        <SelectTrigger className="h-8 text-xs bg-sidebar-background border-sidebar-border focus:border-primary focus:ring-primary">
          <SelectValue placeholder="Select a Product" />
        </SelectTrigger>
        <SelectContent>
          {availableProducts.map(p => (
            <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
          ))}
          <SelectItem value="add_new_product" className="text-primary hover:text-primary focus:text-primary">
            <div className="flex items-center">
              <PlusCircle className="mr-2 h-4 w-4"/> Add New Product...
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <Dialog open={isAddProductDialogOpen} onOpenChange={setIsAddProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Create a new custom product. It will be available for selection across all features.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-product-name" className="text-right">
                Name
              </Label>
              <Input
                id="new-product-name"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., My New Product"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="new-product-desc" className="text-right">
                Description
              </Label>
              <Input
                id="new-product-desc"
                value={newProductDescription}
                onChange={(e) => setNewProductDescription(e.target.value)}
                className="col-span-3"
                placeholder="(Optional) A short description."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddProductDialogOpen(false)}>Cancel</Button>
            <Button type="submit" onClick={handleAddNewProduct}>Add Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
