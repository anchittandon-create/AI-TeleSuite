
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';
import { ProductObject, PRODUCTS as DEFAULT_PRODUCT_NAMES } from '@/types';
import { useToast } from './use-toast';

const AVAILABLE_PRODUCTS_KEY = 'aiTeleSuiteAvailableProducts_v2';
const SELECTED_PRODUCT_KEY = 'aiTeleSuiteSelectedProduct_v2';

interface ProductContextType {
  availableProducts: ProductObject[];
  selectedProduct: string;
  setSelectedProduct: (productName: string) => void;
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
  
  const [availableProducts, setAvailableProducts] = useLocalStorage<ProductObject[]>(AVAILABLE_PRODUCTS_KEY, () => defaultProducts);

  const [selectedProduct, setSelectedProductState] = useLocalStorage<string>(SELECTED_PRODUCT_KEY, defaultProducts[0].name);
  
  useEffect(() => {
    const productMap = new Map(availableProducts.map(p => [p.name, p]));
    let needsUpdate = false;
    for (const defaultProd of defaultProducts) {
        if (!productMap.has(defaultProd.name)) {
            productMap.set(defaultProd.name, defaultProd);
            needsUpdate = true;
        }
    }
    if (needsUpdate) {
        setAvailableProducts(Array.from(productMap.values()));
    }
  }, [availableProducts, setAvailableProducts]);
  
  useEffect(() => {
    if (!availableProducts.some(p => p.name === selectedProduct)) {
      setSelectedProductState(availableProducts[0]?.name || defaultProducts[0].name);
    }
  }, [availableProducts, selectedProduct, setSelectedProductState]);


  const addProduct = useCallback((product: ProductObject): boolean => {
    if (product.name && !availableProducts.some(p => p.name.toLowerCase() === product.name.toLowerCase())) {
      const newProductList = [...availableProducts, product];
      setAvailableProducts(newProductList);
      setSelectedProductState(product.name);
      toast({ title: "Product Added", description: `"${product.name}" has been added and selected.` });
      return true;
    }
    toast({ variant: "destructive", title: "Invalid Name", description: "Product name cannot be empty or a duplicate." });
    return false;
  }, [availableProducts, setAvailableProducts, setSelectedProductState, toast]);

  const getProductByName = useCallback((name: string) => {
    return availableProducts.find(p => p.name === name);
  }, [availableProducts]);

  const value = {
    availableProducts,
    selectedProduct,
    setSelectedProduct: setSelectedProductState,
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
