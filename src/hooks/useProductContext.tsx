
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { ProductObject } from '@/types';
import { useToast } from './use-toast';

const AVAILABLE_PRODUCTS_KEY = 'aiTeleSuiteAvailableProducts_v2';

interface ProductContextType {
  availableProducts: ProductObject[];
  addProduct: (product: ProductObject) => boolean;
  getProductByName: (name: string) => ProductObject | undefined;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

const defaultProducts: ProductObject[] = [
    { name: "ET", description: "Economic Times - Premium business news and analysis." },
    { name: "TOI", description: "Times of India - In-depth news and journalism." },
    { name: "General", description: "For general purpose use across features." }
];

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
