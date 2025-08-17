
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProductObject, CUSTOMER_COHORTS, SALES_PLANS, ET_PLAN_CONFIGURATIONS } from '@/types';
import { PlusCircle, ShoppingBag, Edit, Trash2, Sparkles, Loader2, Link as LinkIcon, Users, FileDigit, Briefcase, BadgeInfo } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateProductDescription } from '@/ai/flows/product-description-generator';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const DEFAULT_PRODUCT_NAMES = ["ET", "TOI", "General"];

export default function ProductsPage() {
  const { availableProducts, addProduct, editProduct, deleteProduct } = useProductContext();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Omit<ProductObject, 'name'>>({ displayName: '', description: '', brandName: '', brandUrl: '', customerCohorts: [], salesPlans: [], etPlanConfigurations: [] });
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductObject | null>(null);
  const [editedProduct, setEditedProduct] = useState<Omit<ProductObject, 'name'>>({ displayName: '', description: '', brandName: '', brandUrl: '', customerCohorts: [], salesPlans: [], etPlanConfigurations: [] });

  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleAddProduct = () => {
    if (newProduct.displayName.trim()) {
      const success = addProduct(newProduct);
      if (success) {
        setNewProduct({ displayName: '', description: '', brandName: '', brandUrl: '', customerCohorts: [], salesPlans: [], etPlanConfigurations: [] });
        setIsAddDialogOpen(false);
      }
    }
  };

  const openEditDialog = (product: ProductObject) => {
    setProductToEdit(product);
    setEditedProduct({
        displayName: product.displayName,
        description: product.description || '',
        brandName: product.brandName || '',
        brandUrl: product.brandUrl || '',
        customerCohorts: product.customerCohorts || [],
        salesPlans: product.salesPlans || [],
        etPlanConfigurations: product.etPlanConfigurations || [],
    });
    setIsEditDialogOpen(true);
  };
  
  const handleEditProduct = () => {
    if (productToEdit && editedProduct.displayName.trim()) {
      const success = editProduct(productToEdit.name, editedProduct);
      if (success) {
        setIsEditDialogOpen(false);
        setProductToEdit(null);
      }
    }
  };
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductObject | null>(null);
  
  const openDeleteDialog = (product: ProductObject) => {
    if (DEFAULT_PRODUCT_NAMES.includes(product.name)) {
        toast({
            variant: "destructive",
            title: "Action Forbidden",
            description: "Default products cannot be deleted as they are integral to the application."
        });
        return;
    }
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteProduct = () => {
    if (productToDelete) {
      deleteProduct(productToDelete.name);
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };
  
  const handleGenerateDescription = async (context: 'add' | 'edit') => {
    const productData = context === 'add' ? newProduct : editedProduct;
    if (!productData.displayName.trim() && !productData.brandName.trim()) {
        toast({ variant: 'destructive', title: 'Context Required', description: 'Please enter a Product Display Name or Brand Name before generating a description.' });
        return;
    }
    setIsGeneratingDesc(true);
    try {
        const result = await generateProductDescription({ 
            productName: productData.displayName,
            brandName: productData.brandName,
            brandUrl: productData.brandUrl
        });
        if (context === 'add') {
            setNewProduct(prev => ({...prev, description: result.description}));
        } else {
            setEditedProduct(prev => ({...prev, description: result.description}));
        }
        toast({ title: 'Description Generated', description: 'AI has generated a product description based on the provided context.' });
    } catch (error) {
        console.error("Error generating product description:", error);
        toast({ variant: 'destructive', title: 'Generation Failed', description: 'Could not generate description from AI.' });
    } finally {
        setIsGeneratingDesc(false);
    }
  };

  const handleCheckboxChange = (context: 'add' | 'edit', type: 'customerCohorts' | 'salesPlans' | 'etPlanConfigurations', value: string, checked: boolean) => {
    const updater = context === 'add' ? setNewProduct : setEditedProduct;
    updater(prev => {
        const currentValues = prev[type] || [];
        const newValues = checked ? [...currentValues, value] : currentValues.filter(v => v !== value);
        return { ...prev, [type]: newValues };
    });
  };

  const renderProductDialogFields = (
    context: 'add' | 'edit', 
    productData: Omit<ProductObject, 'name'>, 
    updater: React.Dispatch<React.SetStateAction<Omit<ProductObject, 'name'>>>
  ) => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor={`${context}-product-display-name`} className="text-right">Display Name</Label>
        <Input
          id={`${context}-product-display-name`}
          value={productData.displayName}
          onChange={(e) => updater(p => ({...p, displayName: e.target.value}))}
          className="col-span-3"
          placeholder="e.g., MagicBricks"
        />
      </div>
       <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor={`${context}-product-brand-name`} className="text-right">Brand Name</Label>
        <Input
          id={`${context}-product-brand-name`}
          value={productData.brandName}
          onChange={(e) => updater(p => ({...p, brandName: e.target.value}))}
          className="col-span-3"
          placeholder="(Optional) Official brand name"
        />
      </div>
       <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor={`${context}-product-brand-url`} className="text-right">Brand URL</Label>
        <Input
          id={`${context}-product-brand-url`}
          value={productData.brandUrl}
          onChange={(e) => updater(p => ({...p, brandUrl: e.target.value}))}
          className="col-span-3"
          placeholder="(Optional) https://www.brand.com"
        />
      </div>
      <div className="grid grid-cols-4 items-start gap-4">
        <Label htmlFor={`${context}-product-description`} className="text-right pt-2">Description</Label>
        <div className="col-span-3 space-y-2">
          <Textarea
            id={`${context}-product-description`}
            value={productData.description}
            onChange={(e) => updater(p => ({...p, description: e.target.value}))}
            placeholder="(Optional) A short description of the product."
          />
          <Button size="xs" variant="outline" onClick={() => handleGenerateDescription(context)} disabled={isGeneratingDesc}>
            {isGeneratingDesc ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Generate with AI
          </Button>
        </div>
      </div>
      <Accordion type="multiple" className="w-full col-span-4">
        <AccordionItem value="cohorts">
          <AccordionTrigger><Users className="mr-2 h-4 w-4 text-accent"/>Customer Cohorts</AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-40 border rounded-md p-2">
              <div className="space-y-2">
                {CUSTOMER_COHORTS.map(cohort => (
                  <div key={cohort} className="flex items-center space-x-2">
                    <Checkbox id={`${context}-cohort-${cohort}`} checked={productData.customerCohorts?.includes(cohort)} onCheckedChange={(checked) => handleCheckboxChange(context, 'customerCohorts', cohort, !!checked)} />
                    <Label htmlFor={`${context}-cohort-${cohort}`} className="text-sm font-normal">{cohort}</Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="sales-plans">
          <AccordionTrigger><Briefcase className="mr-2 h-4 w-4 text-accent"/>Sales Plans</AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-40 border rounded-md p-2">
              <div className="space-y-2">
                {SALES_PLANS.map(plan => (
                  <div key={plan} className="flex items-center space-x-2">
                    <Checkbox id={`${context}-plan-${plan}`} checked={productData.salesPlans?.includes(plan)} onCheckedChange={(checked) => handleCheckboxChange(context, 'salesPlans', plan, !!checked)} />
                    <Label htmlFor={`${context}-plan-${plan}`} className="text-sm font-normal">{plan}</Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="et-plans">
          <AccordionTrigger><BadgeInfo className="mr-2 h-4 w-4 text-accent"/>ET Plan Configurations</AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-24 border rounded-md p-2">
              <div className="space-y-2">
                {ET_PLAN_CONFIGURATIONS.map(plan => (
                  <div key={plan} className="flex items-center space-x-2">
                    <Checkbox id={`${context}-et-plan-${plan}`} checked={productData.etPlanConfigurations?.includes(plan)} onCheckedChange={(checked) => handleCheckboxChange(context, 'etPlanConfigurations', plan, !!checked)} />
                    <Label htmlFor={`${context}-et-plan-${plan}`} className="text-sm font-normal">{plan}</Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Product Management" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Your Products</h1>
            {isClient ? (
                <p className="text-muted-foreground">
                {availableProducts.length} product(s) available. You can edit the display name and other details for any product.
                </p>
            ) : <Skeleton className="h-5 w-96"/>}
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
            {isClient ? (
              <CardDescription>
                {availableProducts.length} product(s) available. You can edit details and associated configurations.
              </CardDescription>
            ) : (
                <Skeleton className="h-5 w-80"/>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-350px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Configurations</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isClient && availableProducts.map((product) => (
                    <TableRow key={product.name}>
                      <TableCell className="font-medium">{product.displayName}</TableCell>
                      <TableCell className="text-muted-foreground max-w-sm truncate" title={product.description}>
                        {product.description || <span className="italic">No description</span>}
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-wrap gap-1">
                            {product.customerCohorts?.length ? <Badge variant="outline">{product.customerCohorts.length} Cohort(s)</Badge> : null}
                            {product.salesPlans?.length ? <Badge variant="outline">{product.salesPlans.length} Plan(s)</Badge> : null}
                        </div>
                      </TableCell>
                       <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(product)}
                          title="Edit product"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(product)}
                          disabled={DEFAULT_PRODUCT_NAMES.includes(product.name)}
                          className="text-destructive hover:text-destructive/80 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={DEFAULT_PRODUCT_NAMES.includes(product.name) ? "Default products cannot be deleted" : "Delete product"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isClient && (
                    <>
                      <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                      <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                      <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Create a new product. It will be available for selection across all features.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="pr-4">{renderProductDialogFields('add', newProduct, setNewProduct)}</div>
          </ScrollArea>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button type="submit" onClick={handleAddProduct}>Add Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Product Dialog */}
      {productToEdit && (
         <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>
                Update the details for '{productToEdit.displayName}'.
              </DialogDescription>
            </DialogHeader>
             <ScrollArea className="max-h-[70vh]">
                <div className="pr-4">{renderProductDialogFields('edit', editedProduct, setEditedProduct)}</div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" onClick={handleEditProduct}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Product Confirmation Dialog */}
       {productToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the product 
                    <span className="font-semibold"> "{productToDelete.displayName}" </span>.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeleteProduct}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                    Yes, delete it
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}
