import type { Ingredient } from '@/lib/food-cost-calculator'

// Starter rates only. These are editable examples, not market quotes.
export const STARTER_INGREDIENTS: Ingredient[] = [
  { id: 'paneer', name: 'Paneer', category: 'Dairy', purchasePrice: 420, packSize: 1, packUnit: 'kg', yieldPercent: 100 },
  { id: 'chicken-boneless', name: 'Chicken, boneless', category: 'Meat', purchasePrice: 320, packSize: 1, packUnit: 'kg', yieldPercent: 95 },
  { id: 'atta', name: 'Wheat atta', category: 'Grains', purchasePrice: 55, packSize: 1, packUnit: 'kg', yieldPercent: 100 },
  { id: 'rice', name: 'Basmati rice', category: 'Grains', purchasePrice: 110, packSize: 1, packUnit: 'kg', yieldPercent: 100 },
  { id: 'cooking-oil', name: 'Cooking oil', category: 'Oil', purchasePrice: 150, packSize: 1, packUnit: 'L', yieldPercent: 100 },
  { id: 'onion', name: 'Onion', category: 'Vegetables', purchasePrice: 40, packSize: 1, packUnit: 'kg', yieldPercent: 90 },
  { id: 'tomato', name: 'Tomato', category: 'Vegetables', purchasePrice: 50, packSize: 1, packUnit: 'kg', yieldPercent: 94 },
  { id: 'potato', name: 'Potato', category: 'Vegetables', purchasePrice: 35, packSize: 1, packUnit: 'kg', yieldPercent: 90 },
  { id: 'cream', name: 'Fresh cream', category: 'Dairy', purchasePrice: 260, packSize: 1, packUnit: 'L', yieldPercent: 100 },
  { id: 'mozzarella', name: 'Mozzarella cheese', category: 'Dairy', purchasePrice: 420, packSize: 1, packUnit: 'kg', yieldPercent: 100 },
  { id: 'sugar', name: 'Sugar', category: 'Pantry', purchasePrice: 50, packSize: 1, packUnit: 'kg', yieldPercent: 100 },
  { id: 'salt', name: 'Salt', category: 'Pantry', purchasePrice: 25, packSize: 1, packUnit: 'kg', yieldPercent: 100 },
  { id: 'curd', name: 'Curd', category: 'Dairy', purchasePrice: 90, packSize: 1, packUnit: 'kg', yieldPercent: 100 },
  { id: 'butter', name: 'Butter', category: 'Dairy', purchasePrice: 600, packSize: 1, packUnit: 'kg', yieldPercent: 100 },
  { id: 'ginger-garlic-paste', name: 'Ginger-garlic paste', category: 'Pantry', purchasePrice: 140, packSize: 1, packUnit: 'kg', yieldPercent: 100 },
  { id: 'green-chilli', name: 'Green chilli', category: 'Vegetables', purchasePrice: 120, packSize: 1, packUnit: 'kg', yieldPercent: 92 },
]
