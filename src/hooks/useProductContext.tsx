
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalStorage } from './use-local-storage';
import { ProductObject } from '@/types';
import { useToast } from './use-toast';

const AVAILABLE_PRODUCTS_KEY = 'aiTeleSuiteAvailableProducts_v3';

interface ProductContextType {
  availableProducts: ProductObject[];
  addProduct: (product: Omit<ProductObject, 'name'>) => boolean;
  editProduct: (originalName: string, updatedProduct: Omit<ProductObject, 'name'>) => boolean;
  deleteProduct: (nameToDelete: string) => boolean;
  getProductByName: (name: string) => ProductObject | undefined;
  selectedProduct?: string;
  setSelectedProduct: React.Dispatch<React.SetStateAction<string | undefined>>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

const defaultProducts: ProductObject[] = [
    {
        name: "ET",
        displayName: "ET",
        description: "Economic Times - Premium business news and analysis.",
        brandName: "The Economic Times",
        brandUrl: "https://economictimes.indiatimes.com/",
        customerCohorts: ["Payment Dropoff", "Paywall Dropoff", "Plan Page Dropoff", "Expired Users", "Business Owners", "Financial Analysts", "Active Investors", "Corporate Executives"],
        salesPlans: ["1-Year", "2-Years", "3-Years"],
        specialPlanConfigurations: ["1, 3 and 5 year plans", "1, 3 and 7 year plans", "1, 2 and 3 year plans"],
    },
    {
        name: "TOI",
        displayName: "TOI",
        description: "Times of India - In-depth news and journalism.",
        brandName: "The Times of India",
        brandUrl: "https://timesofindia.indiatimes.com/",
        customerCohorts: ["Payment Dropoff", "Paywall Dropoff", "Expired Users", "New Prospect Outreach", "Young Professionals", "Students"],
        salesPlans: ["Monthly", "Quarterly", "1-Year"],
        specialPlanConfigurations: ["1, 2 and 3 year plans"],
    },
    {
        name: "timeshealth-yoga",
        displayName: "Yoga by TimesHealth+",
        description: "A guided yoga, mindfulness, and wellness journey curated by TimesHealth+ with Times of India experts. Includes live sessions, Mindful Monday classes, and access to the new TimesHealth+ dashboard and plans portal.",
        brandName: "TimesHealth+",
        brandUrl: "https://timeshealthplus.com/TH/dashboard",
        customerCohorts: [
            "Payment Dropoff",
            "Paywall Dropoff",
            "Plan Page Dropoff",
            "Expired Users",
            "Business Owners",
            "Financial Analysts",
            "Active Investors",
            "Corporate Executives",
            "New Prospect Outreach",
            "Young Professionals",
            "Students",
            "Loyalty & Retention"
        ],
        salesPlans: [
            "1 Month",
            "2+1 Months",
            "6+6 Months"
        ],
        specialPlanConfigurations: [
            "1, 3 and 12 month plans",
            "1, 2+1 and 6+6 month bundles",
            "Mindful Monday live cohort with Vinita, Vinay, Sneha",
            "Self-serve plans: https://timeshealthplus.com/TH/plans",
            "Corporate Wellness & family packs",
            "Dashboard journeys: https://timeshealthplus.com/TH/dashboard",
            "Mindful Monday Yoga calendar: http://timeshealthplus.com/TH/mindful-monday-yoga"
        ],
    },
    {
        name: "General",
        displayName: "General",
        description: "For general purpose use across features.",
        brandName: "",
        brandUrl: "",
        customerCohorts: [],
        salesPlans: [],
        specialPlanConfigurations: ["1, 2 and 3 year plans"],
    }
];

const DEFAULT_PRODUCT_NAMES = defaultProducts.map(p => p.name);

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  const [storedProducts, setStoredProducts] = useLocalStorage<ProductObject[]>(AVAILABLE_PRODUCTS_KEY, defaultProducts);
  const [selectedProduct, setSelectedProduct] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    const productMap = new Map(storedProducts.map(p => [p.name, p]));
    let needsUpdate = false;
    for (const defaultProd of defaultProducts) {
        if (!productMap.has(defaultProd.name)) {
            productMap.set(defaultProd.name, defaultProd);
            needsUpdate = true;
        } else {
            const existingProd = productMap.get(defaultProd.name)!;
            if (!existingProd.description) {
                existingProd.description = defaultProd.description;
                needsUpdate = true;
            }
             if (!existingProd.displayName) {
                existingProd.displayName = defaultProd.displayName;
                needsUpdate = true;
            }
            if (!('customerCohorts' in existingProd)) {
              existingProd.customerCohorts = defaultProd.customerCohorts;
              needsUpdate = true;
            }
            if (!('salesPlans' in existingProd)) {
              existingProd.salesPlans = defaultProd.salesPlans;
              needsUpdate = true;
            }
            if (!('specialPlanConfigurations' in existingProd) || !Array.isArray(existingProd.specialPlanConfigurations)) {
                existingProd.specialPlanConfigurations = [...(defaultProd.specialPlanConfigurations || [])];
                needsUpdate = true;
            } else if (defaultProd.specialPlanConfigurations?.length) {
                const missingConfigs = defaultProd.specialPlanConfigurations.filter(cfg => !existingProd.specialPlanConfigurations!.includes(cfg));
                if (missingConfigs.length > 0) {
                    existingProd.specialPlanConfigurations = [...existingProd.specialPlanConfigurations, ...missingConfigs];
                    needsUpdate = true;
                }
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
        name: newNameKey,
    };
    const newProductList = [...storedProducts, newProduct];
    setStoredProducts(newProductList);
    toast({ title: "Product Added", description: `"${product.displayName}" has been added.` });
    return true;
  }, [storedProducts, setStoredProducts, toast]);


  const editProduct = useCallback((originalName: string, updatedProductData: Omit<ProductObject, 'name'>): boolean => {
    if (!updatedProductData.displayName.trim()) {
      toast({ variant: "destructive", title: "Invalid Name", description: "Display name cannot be empty." });
      return false;
    }

    setStoredProducts(prev => 
      prev.map(p => p.name === originalName ? { ...p, ...updatedProductData } : p)
    );
    
    toast({ title: "Product Updated", description: `"${updatedProductData.displayName}" has been updated.` });
    return true;

  }, [setStoredProducts, toast]);
  
  const deleteProduct = useCallback((nameToDelete: string): boolean => {
    if (DEFAULT_PRODUCT_NAMES.includes(nameToDelete)) {
      toast({ variant: "destructive", title: "Action Forbidden", description: "Default products cannot be deleted." });
      return false;
    }
    setStoredProducts(prev => prev.filter(p => p.name !== nameToDelete));
    toast({ title: "Product Deleted", description: `A product has been removed.` });
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

  useEffect(() => {
    if (selectedProduct && !sortedAvailableProducts.some(p => p.name === selectedProduct)) {
      setSelectedProduct(sortedAvailableProducts[0]?.name);
    } else if (!selectedProduct && sortedAvailableProducts.length > 0) {
      setSelectedProduct(sortedAvailableProducts[0].name);
    }
  }, [sortedAvailableProducts, selectedProduct]);

  const value = {
    availableProducts: sortedAvailableProducts,
    addProduct,
    editProduct,
    deleteProduct,
    getProductByName,
    selectedProduct,
    setSelectedProduct
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
