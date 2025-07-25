
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { ProductObject } from '@/types';
import { useToast } from './use-toast';

const AVAILABLE_PRODUCTS_KEY = 'aiTeleSuiteAvailableProducts_v2';

interface ProductContextType {
  availableProducts: ProductObject[];
  addProduct: (product: ProductObject) => boolean;
  editProduct: (originalName: string, updatedProduct: ProductObject) => boolean;
  deleteProduct: (nameToDelete: string) => boolean;
  getProductByName: (name: string) => ProductObject | undefined;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

const defaultProducts: ProductObject[] = [
    { name: "ET", description: "Economic Times - Premium business news and analysis." },
    { name: "TOI", description: "Times of India - In-depth news and journalism." },
    { name: "General", description: "For general purpose use across features." }
];

const DEFAULT_PRODUCT_NAMES = defaultProducts.map(p => p.name);

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  const [storedProducts, setStoredProducts] = useLocalStorage<ProductObject[]>(AVAILABLE_PRODUCTS_KEY, () => defaultProducts);
  
  useEffect(() => {
    const productMap = new Map(storedProducts.map(p => [p.name, p]));
    let needsUpdate = false;
    for (const defaultProd of defaultProducts) {
        if (!productMap.has(defaultProd.name)) {
            productMap.set(defaultProd.name, defaultProd);
            needsUpdate = true;
        }
    }
    if (needsUpdate) {
        setStoredProducts(Array.from(productMap.values()));
    }
  }, [storedProducts, setStoredProducts]);

  const addProduct = useCallback((product: ProductObject): boolean => {
    if (product.name && !storedProducts.some(p => p.name.toLowerCase() === product.name.toLowerCase())) {
      const newProductList = [...storedProducts, product];
      setStoredProducts(newProductList);
      toast({ title: "Product Added", description: `"${product.name}" has been added.` });
      return true;
    }
    toast({ variant: "destructive", title: "Invalid Name", description: "Product name cannot be empty or a duplicate." });
    return false;
  }, [storedProducts, setStoredProducts, toast]);

  const editProduct = useCallback((originalName: string, updatedProduct: ProductObject): boolean => {
    if (DEFAULT_PRODUCT_NAMES.includes(originalName)) {
      toast({ variant: "destructive", title: "Action Forbidden", description: "Default products cannot be edited." });
      return false;
    }
    if (!updatedProduct.name.trim()) {
      toast({ variant: "destructive", title: "Invalid Name", description: "Product name cannot be empty." });
      return false;
    }
    
    // Check for name conflict only if the name has changed
    if (originalName.toLowerCase() !== updatedProduct.name.toLowerCase() && storedProducts.some(p => p.name.toLowerCase() === updatedProduct.name.toLowerCase())) {
       toast({ variant: "destructive", title: "Name Exists", description: `A product with the name "${updatedProduct.name}" already exists.` });
       return false;
    }

    setStoredProducts(prev => 
      prev.map(p => p.name === originalName ? { ...p, ...updatedProduct } : p)
    );
    toast({ title: "Product Updated", description: `"${originalName}" has been updated.` });
    return true;

  }, [storedProducts, setStoredProducts, toast]);
  
  const deleteProduct = useCallback((nameToDelete: string): boolean => {
    if (DEFAULT_PRODUCT_NAMES.includes(nameToDelete)) {
      toast({ variant: "destructive", title: "Action Forbidden", description: "Default products cannot be deleted." });
      return false;
    }
    setStoredProducts(prev => prev.filter(p => p.name !== nameToDelete));
    toast({ title: "Product Deleted", description: `"${nameToDelete}" has been removed.` });
    return true;
  }, [setStoredProducts, toast]);


  const getProductByName = useCallback((name: string) => {
    return storedProducts.find(p => p.name === name);
  }, [storedProducts]);

  const sortedAvailableProducts = useCallback(() => {
    const generalProduct = storedProducts.find(p => p.name === "General");
    const otherProducts = storedProducts.filter(p => p.name !== "General").sort((a, b) => a.name.localeCompare(b.name));
    if (generalProduct) {
        return [...otherProducts, generalProduct];
    }
    return otherProducts;
  }, [storedProducts])();


  const value = {
    availableProducts: sortedAvailableProducts,
    addProduct,
    editProduct,
    deleteProduct,
    getProductByName
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
