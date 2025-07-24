
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { PRODUCTS as DEFAULT_PRODUCTS, Product } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from './use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';

const AVAILABLE_PRODUCTS_KEY = 'aiTeleSuiteAvailableProducts';

interface ProductContextType {
  availableProducts: string[];
  selectedProduct: string;
  setSelectedProduct: (product: string) => void;
  addProduct: (product: string) => void;
  ProductSelector: React.FC;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [availableProducts, setAvailableProducts] = useLocalStorage<string[]>(AVAILABLE_PRODUCTS_KEY, () => [...DEFAULT_PRODUCTS]);
  const [selectedProduct, setSelectedProductState] = useLocalStorage<string>('aiTeleSuiteSelectedProduct', availableProducts[0] || DEFAULT_PRODUCTS[0]);
  
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");

  // Ensure default products are always present
  useEffect(() => {
    setAvailableProducts(prev => {
      const productSet = new Set([...prev, ...DEFAULT_PRODUCTS]);
      return Array.from(productSet);
    });
  }, [setAvailableProducts]);
  
  const addProduct = useCallback((product: string) => {
    if (product && !availableProducts.includes(product)) {
      setAvailableProducts(prev => [...prev, product]);
      setSelectedProductState(product);
      toast({ title: "Product Added", description: `"${product}" has been added and selected.` });
      return true;
    }
    toast({ variant: "destructive", title: "Invalid Name", description: "Product name cannot be empty or a duplicate." });
    return false;
  }, [availableProducts, setAvailableProducts, setSelectedProductState, toast]);

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
      setSelectedProductState(value);
    }
  };

  const ProductSelector = useCallback(() => (
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
  ), [selectedProduct, availableProducts, isAddProductDialogOpen, newProductName, handleSelectChange, handleAddNewProduct]);


  const value = {
    availableProducts,
    selectedProduct,
    setSelectedProduct: setSelectedProductState,
    addProduct,
    ProductSelector
  };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProductContext = (): ProductContextType => {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProductContext must be used within a ProductProvider');
  }
  return context;
};
