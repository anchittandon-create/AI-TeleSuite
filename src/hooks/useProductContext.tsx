
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, Dispatch, SetStateAction, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import { ProductObject } from '@/types';
import { useToast } from './use-toast';

const AVAILABLE_PRODUCTS_KEY = 'aiTeleSuiteAvailableProducts_v3';

interface ProductContextType {
  availableProducts: ProductObject[];
  addProduct: (product: Omit<ProductObject, 'name'>) => boolean;
  editProduct: (originalName: string, updatedProduct: ProductObject) => boolean;
  deleteProduct: (nameToDelete: string) => boolean;
  getProductByName: (name: string) => ProductObject | undefined;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

const defaultProducts: ProductObject[] = [
    { name: "ET", displayName: "ET", description: "Economic Times - Premium business news and analysis.", brandName: "The Economic Times", brandUrl: "https://economictimes.indiatimes.com/" },
    { name: "TOI", displayName: "TOI", description: "Times of India - In-depth news and journalism.", brandName: "The Times of India", brandUrl: "https://timesofindia.indiatimes.com/" },
    { name: "General", displayName: "General", description: "For general purpose use across features." }
];

const DEFAULT_PRODUCT_NAMES = defaultProducts.map(p => p.name);

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  const [storedProducts, setStoredProducts] = useLocalStorage<ProductObject[]>(AVAILABLE_PRODUCTS_KEY, defaultProducts);
  
  useEffect(() => {
    const productMap = new Map(storedProducts.map(p => [p.name, p]));
    let needsUpdate = false;
    for (const defaultProd of defaultProducts) {
        if (!productMap.has(defaultProd.name)) {
            productMap.set(defaultProd.name, defaultProd);
            needsUpdate = true;
        } else {
            // Ensure default products have their default descriptions if they are somehow empty
            const existingProd = productMap.get(defaultProd.name)!;
            if (!existingProd.description) {
                existingProd.description = defaultProd.description;
                needsUpdate = true;
            }
             if (!existingProd.displayName) {
                existingProd.displayName = defaultProd.displayName;
                needsUpdate = true;
            }
        }
    }
    if (needsUpdate) {
        setStoredProducts(Array.from(productMap.values()));
    }
  }, [storedProducts, setStoredProducts]);

  const addProduct = useCallback((product: Omit<ProductObject, 'name'>): boolean => {
    if (!product.displayName || !product.displayName.trim()) {
        toast({ variant: "destructive", title: "Invalid Name", description: "Display name cannot be empty." });
        return false;
    }
    const newNameKey = product.displayName.trim().toLowerCase().replace(/\s+/g, '-');
    
    if (storedProducts.some(p => p.name.toLowerCase() === newNameKey)) {
        toast({ variant: "destructive", title: "Product Exists", description: "A product with a similar name already exists, please choose a different name." });
        return false;
    }
    const newProduct: ProductObject = {
        ...product,
        name: newNameKey, // System name is derived from display name
    };
    const newProductList = [...storedProducts, newProduct];
    setStoredProducts(newProductList);
    toast({ title: "Product Added", description: `"${product.displayName}" has been added.` });
    return true;
  }, [storedProducts, setStoredProducts, toast]);


  const editProduct = useCallback((originalName: string, updatedProduct: ProductObject): boolean => {
    if (!updatedProduct.displayName.trim()) {
      toast({ variant: "destructive", title: "Invalid Name", description: "Display name cannot be empty." });
      return false;
    }

    // You can edit display name for all, but system `name` for defaults is protected
    if (DEFAULT_PRODUCT_NAMES.includes(originalName) && originalName !== updatedProduct.name) {
        toast({ variant: "destructive", title: "Action Forbidden", description: "The system identifier for default products cannot be changed." });
        return false;
    }
    
    // Prevent changing a custom product's display name to one that already exists (case-insensitive)
     if (originalName !== updatedProduct.name && storedProducts.some(p => p.name === updatedProduct.name)) {
       toast({ variant: "destructive", title: "Name Exists", description: `A product with the system name "${updatedProduct.name}" already exists.` });
       return false;
    }


    setStoredProducts(prev => 
      prev.map(p => p.name === originalName ? { ...p, ...updatedProduct } : p)
    );
    
    toast({ title: "Product Updated", description: `"${updatedProduct.displayName}" has been updated.` });
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

  const sortedAvailableProducts = useMemo(() => {
    const generalProduct = storedProducts.find(p => p.name === "General");
    const otherProducts = storedProducts.filter(p => p.name !== "General").sort((a, b) => a.displayName.localeCompare(b.displayName));
    if (generalProduct) {
        return [...otherProducts, generalProduct];
    }
    return otherProducts;
  }, [storedProducts]);

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
