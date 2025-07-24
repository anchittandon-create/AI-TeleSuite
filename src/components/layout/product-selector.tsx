
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

  const handleAddNewProduct = () => {
    if (addProduct(newProductName.trim())) {
      setNewProductName("");
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
        <SelectTrigger>
          <SelectValue placeholder="Select a Product" />
        </SelectTrigger>
        <SelectContent>
          {availableProducts.map(p => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
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
              Create a new custom product. This will be available for selection across all features.
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewProduct();
                  }
                }}
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
