export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'pcs' | 'portion'
export type UnitFamily = 'weight' | 'volume' | 'count' | 'portion'

export type Ingredient = {
  id: string
  name: string
  category: string
  purchasePrice: number
  packSize: number
  packUnit: Exclude<Unit, 'portion'>
  yieldPercent: number
  supplier?: string
  lastUpdated?: string
}

export type RecipeItem = {
  id: string
  kind: 'ingredient' | 'subrecipe'
  refId: string
  quantity: number
  unit: Unit
}

export type SubRecipe = {
  id: string
  name: string
  servings: number
  items: RecipeItem[]
}

export type Recipe = {
  name: string
  servings: number
  items: RecipeItem[]
}

export type Channel = {
  id: 'dine_in' | 'takeaway' | 'zomato' | 'swiggy' | 'own_delivery'
  name: string
  commissionPercent: number
  commissionGstPercent: number
  otherDeductionPercent: number
  otherDeductionFixed: number
  commissionOnGstInclusive: boolean
}

export type ExtraCosts = {
  packagingPerOrder: number
  gasConsumablesPerOrder: number
  laborOverheadPercent: number
  wastageBufferPercent: number
}

export type Pricing = {
  sellingPrice: number
  gstPercent: number
  priceIncludesGst: boolean
  targetFoodCostPercent: number
}

export type IngredientLineCost = {
  itemId: string
  kind: RecipeItem['kind']
  name: string
  quantity: number
  unit: Unit
  ingredientCost: number
  percentOfIngredientCost: number
  yieldPercent?: number
  compatible: boolean
  warning?: string
}

export type RecipeCost = {
  totalIngredientCost: number
  costPerPortion: number
  ingredientLines: IngredientLineCost[]
  warnings: string[]
}

export type ChannelResult = {
  channel: Channel
  exGstSellingPrice: number
  customerPrice: number
  foodCostPercent: number
  grossProfitBeforeExtras: number
  fixedExtraCosts: number
  laborOverheadCost: number
  wastageBufferCost: number
  commissionCost: number
  commissionGstCost: number
  otherDeductionCost: number
  estimatedSettlement: number
  netProfit: number
  netMarginPercent: number
  breakEvenExGstPrice: number
  suggestedPriceExGst: number
  suggestedCustomerPrice: number
  status: 'green' | 'amber' | 'red'
}

export const DEFAULT_CHANNELS: Channel[] = [
  {
    id: 'dine_in',
    name: 'Dine-in',
    commissionPercent: 0,
    commissionGstPercent: 0,
    otherDeductionPercent: 0,
    otherDeductionFixed: 0,
    commissionOnGstInclusive: false,
  },
  {
    id: 'takeaway',
    name: 'Takeaway',
    commissionPercent: 0,
    commissionGstPercent: 0,
    otherDeductionPercent: 0,
    otherDeductionFixed: 0,
    commissionOnGstInclusive: false,
  },
  {
    id: 'zomato',
    name: 'Zomato',
    commissionPercent: 25,
    commissionGstPercent: 18,
    otherDeductionPercent: 0,
    otherDeductionFixed: 0,
    commissionOnGstInclusive: true,
  },
  {
    id: 'swiggy',
    name: 'Swiggy',
    commissionPercent: 25,
    commissionGstPercent: 18,
    otherDeductionPercent: 0,
    otherDeductionFixed: 0,
    commissionOnGstInclusive: true,
  },
  {
    id: 'own_delivery',
    name: 'Own delivery',
    commissionPercent: 0,
    commissionGstPercent: 0,
    otherDeductionPercent: 0,
    otherDeductionFixed: 0,
    commissionOnGstInclusive: false,
  },
]

export const DEFAULT_EXTRA_COSTS: ExtraCosts = {
  packagingPerOrder: 0,
  gasConsumablesPerOrder: 0,
  laborOverheadPercent: 0,
  wastageBufferPercent: 0,
}

export const DEFAULT_PRICING: Pricing = {
  sellingPrice: 0,
  gstPercent: 5,
  priceIncludesGst: true,
  targetFoodCostPercent: 30,
}

export const UNIT_FAMILY: Record<Unit, UnitFamily> = {
  g: 'weight',
  kg: 'weight',
  ml: 'volume',
  L: 'volume',
  pcs: 'count',
  portion: 'portion',
}

export function normalizeToBase(quantity: number, unit: Unit): number {
  switch (unit) {
    case 'kg':
      return quantity * 1000
    case 'g':
    case 'ml':
    case 'pcs':
    case 'portion':
      return quantity
    case 'L':
      return quantity * 1000
    default:
      return quantity
  }
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function clampPercent(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
}

export function effectiveUnitCost(ingredient: Ingredient): number {
  const packBaseQty = normalizeToBase(ingredient.packSize, ingredient.packUnit)
  const yieldFraction = clampPercent(ingredient.yieldPercent, 0.01, 100) / 100
  if (packBaseQty <= 0 || ingredient.purchasePrice < 0) return 0
  return ingredient.purchasePrice / packBaseQty / yieldFraction
}

export function calculateIngredientCost(ingredient: Ingredient, quantity: number, unit: Unit): number {
  if (UNIT_FAMILY[unit] !== UNIT_FAMILY[ingredient.packUnit] || unit === 'portion') return NaN
  return effectiveUnitCost(ingredient) * normalizeToBase(quantity, unit)
}

export function calculateRecipeCost(
  recipe: Recipe,
  ingredientsById: Map<string, Ingredient>,
  subrecipesById: Map<string, SubRecipe>,
): RecipeCost {
  const warnings: string[] = []
  const ingredientLines: IngredientLineCost[] = []

  for (const item of recipe.items) {
    if (!item.quantity || item.quantity < 0) continue

    if (item.kind === 'ingredient') {
      const ingredient = ingredientsById.get(item.refId)
      if (!ingredient) {
        warnings.push(`Ingredient ${item.refId} could not be found.`)
        continue
      }

      const familyMatches = UNIT_FAMILY[item.unit] === UNIT_FAMILY[ingredient.packUnit]
      const cost = calculateIngredientCost(ingredient, item.quantity, item.unit)
      if (!familyMatches || !Number.isFinite(cost)) {
        warnings.push(`${ingredient.name}: ${item.unit} does not match the ingredient's ${ingredient.packUnit} unit family.`)
        ingredientLines.push({
          itemId: item.id,
          kind: item.kind,
          name: ingredient.name,
          quantity: item.quantity,
          unit: item.unit,
          ingredientCost: 0,
          percentOfIngredientCost: 0,
          yieldPercent: ingredient.yieldPercent,
          compatible: false,
          warning: `Use ${ingredient.packUnit} or another ${UNIT_FAMILY[ingredient.packUnit]} unit.`,
        })
        continue
      }

      ingredientLines.push({
        itemId: item.id,
        kind: item.kind,
        name: ingredient.name,
        quantity: item.quantity,
        unit: item.unit,
        ingredientCost: cost,
        percentOfIngredientCost: 0,
        yieldPercent: ingredient.yieldPercent,
        compatible: true,
      })
      continue
    }

    const subrecipe = subrecipesById.get(item.refId)
    if (!subrecipe) {
      warnings.push(`Sub-recipe ${item.refId} could not be found.`)
      continue
    }
    if (subrecipe.servings <= 0) {
      warnings.push(`${subrecipe.name}: batch servings must be greater than zero.`)
      continue
    }

    const subCost = calculateRecipeCost(subrecipe, ingredientsById, subrecipesById)
    warnings.push(...subCost.warnings.map((warning) => `${subrecipe.name}: ${warning}`))
    const perPortion = subCost.totalIngredientCost / subrecipe.servings
    const cost = perPortion * item.quantity

    ingredientLines.push({
      itemId: item.id,
      kind: item.kind,
      name: `${subrecipe.name} (sub-recipe)`,
      quantity: item.quantity,
      unit: 'portion',
      ingredientCost: cost,
      percentOfIngredientCost: 0,
      compatible: true,
    })
  }

  const totalIngredientCost = ingredientLines.reduce((sum, line) => sum + line.ingredientCost, 0)
  for (const line of ingredientLines) {
    line.percentOfIngredientCost = totalIngredientCost > 0 ? (line.ingredientCost / totalIngredientCost) * 100 : 0
  }

  const servings = recipe.servings > 0 ? recipe.servings : 1
  return {
    totalIngredientCost,
    costPerPortion: totalIngredientCost / servings,
    ingredientLines,
    warnings,
  }
}

export function exGstPrice(customerPrice: number, gstPercent: number, includesGst: boolean): number {
  if (!includesGst) return Math.max(0, customerPrice)
  return Math.max(0, customerPrice / (1 + clampPercent(gstPercent) / 100))
}

export function customerPriceFromExGst(exGst: number, gstPercent: number): number {
  return Math.max(0, exGst * (1 + clampPercent(gstPercent) / 100))
}

export function foodCostStatus(foodCostPercent: number, target = 30): 'green' | 'amber' | 'red' {
  const upper = target + 5
  if (foodCostPercent <= target) return 'green'
  if (foodCostPercent <= upper) return 'amber'
  return 'red'
}

export function breakEvenExGstPrice(
  baseCost: number,
  extraCosts: ExtraCosts,
  channel: Channel,
  gstPercent: number,
): number {
  const directExtras = extraCosts.packagingPerOrder + extraCosts.gasConsumablesPerOrder
  const laborRate = clampPercent(extraCosts.laborOverheadPercent) / 100
  const wasteRate = clampPercent(extraCosts.wastageBufferPercent) / 100
  const fixedCost = baseCost + directExtras + baseCost * laborRate + baseCost * wasteRate

  const gstFactor = 1 + clampPercent(gstPercent) / 100
  const commissionRate = clampPercent(channel.commissionPercent) / 100
  const commissionGstFactor = 1 + clampPercent(channel.commissionGstPercent) / 100
  const otherPercent = clampPercent(channel.otherDeductionPercent) / 100

  // Commission can be based on customer-facing (GST-inclusive) price or ex-GST price.
  const commissionFactor = channel.commissionOnGstInclusive
    ? commissionRate * gstFactor * commissionGstFactor
    : commissionRate * commissionGstFactor
  const otherFactor = channel.commissionOnGstInclusive
    ? otherPercent * gstFactor
    : otherPercent

  const denominator = Math.max(0.0001, 1 - commissionFactor - otherFactor)
  return Math.max(0, (fixedCost + channel.otherDeductionFixed) / denominator)
}

export function calculateChannelResult(
  recipeCost: RecipeCost,
  extraCosts: ExtraCosts,
  pricing: Pricing,
  channel: Channel,
): ChannelResult {
  const gst = clampPercent(pricing.gstPercent)
  const exGstSelling = exGstPrice(pricing.sellingPrice, gst, pricing.priceIncludesGst)
  const customerPrice = customerPriceFromExGst(exGstSelling, gst)

  const ingredientCost = recipeCost.costPerPortion
  const fixedExtraCosts = extraCosts.packagingPerOrder + extraCosts.gasConsumablesPerOrder
  const laborOverheadCost = ingredientCost * (clampPercent(extraCosts.laborOverheadPercent) / 100)
  const wastageBufferCost = ingredientCost * (clampPercent(extraCosts.wastageBufferPercent) / 100)
  const grossProfitBeforeExtras = exGstSelling - ingredientCost

  const commissionBase = channel.commissionOnGstInclusive ? customerPrice : exGstSelling
  const commissionCost = commissionBase * (clampPercent(channel.commissionPercent) / 100)
  const commissionGstCost = commissionCost * (clampPercent(channel.commissionGstPercent) / 100)
  const otherDeductionCost = commissionBase * (clampPercent(channel.otherDeductionPercent) / 100) + channel.otherDeductionFixed

  // This is a management estimate. Restaurant GST compliance can depend on the outlet's registration and tax treatment.
  const estimatedSettlement = customerPrice - commissionCost - commissionGstCost - otherDeductionCost
  const netProfit = exGstSelling - ingredientCost - fixedExtraCosts - laborOverheadCost - wastageBufferCost - commissionCost - commissionGstCost - otherDeductionCost
  const netMarginPercent = exGstSelling > 0 ? (netProfit / exGstSelling) * 100 : 0
  const foodCostPercent = exGstSelling > 0 ? (ingredientCost / exGstSelling) * 100 : 0

  const target = Math.max(0.01, clampPercent(pricing.targetFoodCostPercent)) / 100
  const suggestedPriceExGst = target > 0 ? ingredientCost / target : 0
  const suggestedCustomerPrice = customerPriceFromExGst(suggestedPriceExGst, gst)

  return {
    channel,
    exGstSellingPrice: exGstSelling,
    customerPrice,
    foodCostPercent,
    grossProfitBeforeExtras,
    fixedExtraCosts,
    laborOverheadCost,
    wastageBufferCost,
    commissionCost,
    commissionGstCost,
    otherDeductionCost,
    estimatedSettlement,
    netProfit,
    netMarginPercent,
    breakEvenExGstPrice: breakEvenExGstPrice(ingredientCost, extraCosts, channel, gst),
    suggestedPriceExGst,
    suggestedCustomerPrice,
    status: foodCostStatus(foodCostPercent, pricing.targetFoodCostPercent),
  }
}

export function calculateAllChannels(
  recipeCost: RecipeCost,
  extraCosts: ExtraCosts,
  pricing: Pricing,
  channels: Channel[],
): ChannelResult[] {
  return channels.map((channel) => calculateChannelResult(recipeCost, extraCosts, pricing, channel))
}

export function applyIngredientPriceChange(ingredients: Ingredient[], percent: number): Ingredient[] {
  const multiplier = 1 + percent / 100
  return ingredients.map((ingredient) => ({
    ...ingredient,
    purchasePrice: Math.max(0, ingredient.purchasePrice * multiplier),
  }))
}
