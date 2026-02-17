import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  priceId: string;
  image?: string;
}

interface AddOnsProps {
  basePrice: number;
  basePlanId: string;
  addOns: AddOn[];
  onSubmit: (selectedAddOns: string[]) => void;
  onCancel: () => void;
  attachedAddOns?: string[]; // Add-ons already attached to the subscription
}

export function AddOns({ basePrice, basePlanId, addOns, onSubmit, onCancel, attachedAddOns = [] }: AddOnsProps) {
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  const handleAddOnToggle = (addonId: string) => {
    const addon = addOns.find(a => a.id === addonId);
    if (!addon) return;
    
    // Don't allow toggling already attached add-ons (check by priceId)
    if (attachedAddOns.includes(addon.priceId)) {
      return;
    }
    
    const newSelected = selectedAddOns.includes(addonId)
      ? selectedAddOns.filter(id => id !== addonId)
      : [...selectedAddOns, addonId];
    setSelectedAddOns(newSelected);
    onSubmit(newSelected);
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="space-y-4">
        {addOns.map((addon) => {
          const isAttached = attachedAddOns.includes(addon.priceId);
          const isSelected = selectedAddOns.includes(addon.id);
          
          return (
            <Card key={addon.id} className={`transition-all ${
              isAttached ? 'border-green-500 bg-green-50' : 
              isSelected ? 'border-primary' : ''
            }`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center space-x-3">
                  {addon.image && (
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <img
                        src={addon.image}
                        alt={addon.name}
                        className="w-6 h-6"
                      />
                    </div>
                  )}
                  <CardTitle className="text-sm font-medium">
                    {addon.name}
                    {isAttached && (
                      <span className="ml-2 text-xs text-green-600 font-normal">
                        (Already attached)
                      </span>
                    )}
                  </CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold">
                    +${addon.price}/mo
                  </span>
                  <Checkbox
                    checked={isAttached || isSelected}
                    disabled={isAttached}
                    onCheckedChange={() => handleAddOnToggle(addon.id)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {addon.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
