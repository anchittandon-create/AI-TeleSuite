
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { PRODUCTS as DEFAULT_PRODUCTS, Product } from '@/types';
import { useToast } from './use-toast';

const AVAILABLE_PRODUCTS_KEY = 'aiTeleSuiteAvailableProducts';

interface ProductContextType {
  availableProducts: string[];
  selectedProduct: string;
  setSelectedProduct: (product: string) => void;
  addProduct: (product: string) => boolean;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  // The initializer function of useLocalStorage will now handle setting the default products correctly on first load.
  const [availableProducts, setAvailableProducts] = useLocalStorage<string[]>(AVAILABLE_PRODUCTS_KEY, () => {
    // This logic now only runs once when the value is first read from localStorage or initialized.
    return Array.from(new Set([...DEFAULT_PRODUCTS]));
  });

  const [selectedProduct, setSelectedProductState] = useLocalStorage<string>('aiTeleSuiteSelectedProduct', availableProducts[0] || DEFAULT_PRODUCTS[0]);
  
  // This effect ensures that if the stored `availableProducts` somehow gets out of sync with defaults (e.g., manual deletion), it recovers.
  useEffect(() => {
    const productSet = new Set(availableProducts);
    let needsUpdate = false;
    for (const defaultProduct of DEFAULT_PRODUCTS) {
      if (!productSet.has(defaultProduct)) {
        productSet.add(defaultProduct);
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      setAvailableProducts(Array.from(productSet));
    }
  }, [availableProducts, setAvailableProducts]);
  
  // Ensure a valid product is always selected
  useEffect(() => {
    if (!availableProducts.includes(selectedProduct)) {
      setSelectedProductState(availableProducts[0] || DEFAULT_PRODUCTS[0]);
    }
  }, [availableProducts, selectedProduct, setSelectedProductState]);


  const addProduct = useCallback((product: string): boolean => {
    if (product && !availableProducts.includes(product)) {
      setAvailableProducts(prev => [...prev, product]);
      setSelectedProductState(product);
      toast({ title: "Product Added", description: `"${product}" has been added and selected.` });
      return true;
    }
    toast({ variant: "destructive", title: "Invalid Name", description: "Product name cannot be empty or a duplicate." });
    return false;
  }, [availableProducts, setAvailableProducts, setSelectedProductState, toast]);

  const value = {
    availableProducts,
    selectedProduct,
    setSelectedProduct: setSelectedProductState,
    addProduct,
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
