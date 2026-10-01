'use client'

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { STARTER_INGREDIENTS } from '@/data/restaurant-ingredients'
import {
  DEFAULT_CHANNELS,
  DEFAULT_EXTRA_COSTS,
  DEFAULT_PRICING,
  UNIT_FAMILY,
  type Channel,
  type ExtraCosts,
  type Ingredient,
  type Recipe,
  type RecipeItem,
  type SubRecipe,
  type Unit,
  applyIngredientPriceChange,
  calculateAllChannels,
  calculateRecipeCost,
  formatMoney,
} from '@/lib/food-cost-calculator'

const STORAGE_KEY = 'dinezy_food_cost_calculator_v1'
const UNITS: Unit[] = ['g', 'kg', 'ml', 'L', 'pcs']

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

function emptyRecipe(): Recipe {
  return { name: '', servings: 1, items: [] }
}

function initialSubRecipe(): SubRecipe {
  return { id: makeId('sub'), name: '', servings: 10, items: [] }
}

function numberValue(value: string, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function niceDate() {
  return new Date().toISOString().slice(0, 10)
}

export default function FoodCostCalculator() {
  const [ingredients, setIngredients] = useState<Ingredient[]>(STARTER_INGREDIENTS)
  const [recipe, setRecipe] = useState<Recipe>({ name: 'Paneer Butter Masala', servings: 1, items: [] })
  const [subrecipes, setSubrecipes] = useState<SubRecipe[]>([])
  const [extraCosts, setExtraCosts] = useState<ExtraCosts>(DEFAULT_EXTRA_COSTS)
  const [pricing, setPricing] = useState(DEFAULT_PRICING)
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS)
  const [selectedChannel, setSelectedChannel] = useState<Channel['id']>('dine_in')
  const [whatIfPercent, setWhatIfPercent] = useState(0)
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [subRecipeSearch, setSubRecipeSearch] = useState('')
  const [showIngredientMaster, setShowIngredientMaster] = useState(false)
  const [showSubrecipes, setShowSubrecipes] = useState(false)
  const [showChannelSettings, setShowChannelSettings] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.ingredients?.length) setIngredients(saved.ingredients)
        if (saved.recipe) setRecipe(saved.recipe)
        if (saved.subrecipes) setSubrecipes(saved.subrecipes)
        if (saved.extraCosts) setExtraCosts(saved.extraCosts)
        if (saved.pricing) setPricing(saved.pricing)
        if (saved.channels) setChannels(saved.channels)
        if (saved.selectedChannel) setSelectedChannel(saved.selectedChannel)
      }
    } catch {
      // Ignore malformed local drafts.
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ingredients, recipe, subrecipes, extraCosts, pricing, channels, selectedChannel }),
    )
  }, [ready, ingredients, recipe, subrecipes, extraCosts, pricing, channels, selectedChannel])

  const ingredientsById = useMemo(() => new Map(ingredients.map((item) => [item.id, item])), [ingredients])
  const subrecipesById = useMemo(() => new Map(subrecipes.map((item) => [item.id, item])), [subrecipes])

  const recipeCost = useMemo(
    () => calculateRecipeCost(recipe, ingredientsById, subrecipesById),
    [recipe, ingredientsById, subrecipesById],
  )

  const channelResults = useMemo(
    () => calculateAllChannels(recipeCost, extraCosts, pricing, channels),
    [recipeCost, extraCosts, pricing, channels],
  )

  const selectedResult = channelResults.find((result) => result.channel.id === selectedChannel) ?? channelResults[0]

  const whatIfIngredients = useMemo(
    () => applyIngredientPriceChange(ingredients, whatIfPercent),
    [ingredients, whatIfPercent],
  )
  const whatIfRecipeCost = useMemo(
    () => calculateRecipeCost(recipe, new Map(whatIfIngredients.map((item) => [item.id, item])), subrecipesById),
    [recipe, whatIfIngredients, subrecipesById],
  )
  const whatIfSelectedResult = useMemo(() => {
    if (!selectedResult) return null
    const channel = channels.find((item) => item.id === selectedChannel) ?? DEFAULT_CHANNELS[0]
    return calculateAllChannels(whatIfRecipeCost, extraCosts, pricing, [channel])[0]
  }, [whatIfRecipeCost, extraCosts, pricing, channels, selectedChannel, selectedResult])

  const filteredIngredients = ingredients.filter((item) => {
    const term = ingredientSearch.trim().toLowerCase()
    return !term || `${item.name} ${item.category}`.toLowerCase().includes(term)
  })

  const filteredSubrecipes = subrecipes.filter((item) => item.name.toLowerCase().includes(subRecipeSearch.trim().toLowerCase()))

  function addIngredientToRecipe() {
    const ingredient = ingredients.find((item) => item.name.toLowerCase().includes(ingredientSearch.trim().toLowerCase())) ?? ingredients[0]
    if (!ingredient) return
    setRecipe((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: makeId('line'),
          kind: 'ingredient',
          refId: ingredient.id,
          quantity: 100,
          unit: ingredient.packUnit === 'kg' ? 'g' : ingredient.packUnit,
        },
      ],
    }))
    setIngredientSearch('')
  }

  function addSubrecipeToRecipe() {
    const sub = filteredSubrecipes[0]
    if (!sub) return
    setRecipe((current) => ({
      ...current,
      items: [...current.items, { id: makeId('line'), kind: 'subrecipe', refId: sub.id, quantity: 1, unit: 'portion' }],
    }))
    setSubRecipeSearch('')
  }

  function addMasterIngredient() {
    setIngredients((current) => [
      ...current,
      {
        id: makeId('ing'),
        name: 'New ingredient',
        category: 'Other',
        purchasePrice: 0,
        packSize: 1,
        packUnit: 'kg',
        yieldPercent: 100,
        lastUpdated: niceDate(),
      },
    ])
  }

  function updateIngredient(id: string, patch: Partial<Ingredient>) {
    setIngredients((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function addSubrecipe() {
    setSubrecipes((current) => [...current, initialSubRecipe()])
  }

  function updateSubrecipe(id: string, patch: Partial<SubRecipe>) {
    setSubrecipes((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function addSubrecipeItem(id: string) {
    const firstIngredient = ingredients[0]
    if (!firstIngredient) return
    setSubrecipes((current) =>
      current.map((sub) =>
        sub.id === id
          ? {
              ...sub,
              items: [
                ...sub.items,
                { id: makeId('subline'), kind: 'ingredient', refId: firstIngredient.id, quantity: 100, unit: firstIngredient.packUnit === 'kg' ? 'g' : firstIngredient.packUnit },
              ],
            }
          : sub,
      ),
    )
  }

  function resetCalculator() {
    localStorage.removeItem(STORAGE_KEY)
    setIngredients(STARTER_INGREDIENTS)
    setRecipe(emptyRecipe())
    setSubrecipes([])
    setExtraCosts(DEFAULT_EXTRA_COSTS)
    setPricing(DEFAULT_PRICING)
    setChannels(DEFAULT_CHANNELS)
    setSelectedChannel('dine_in')
    setWhatIfPercent(0)
  }

  function exportJson() {
    const payload = { recipe, recipeCost, ingredients, subrecipes, extraCosts, pricing, channels }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${(recipe.name || 'dinezy-recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const breakdownLines = [...recipeCost.ingredientLines].sort((a, b) => b.ingredientCost - a.ingredientCost)
  const totalExtraBeforeChannel = recipeCost.costPerPortion + extraCosts.packagingPerOrder + extraCosts.gasConsumablesPerOrder

  return (
    <main className="fcr-page">
      <div className="fcr-container">
        <header className="fcr-hero">
          <div>
            <div className="fcr-badge">FREE • NO SIGNUP</div>
            <h1>Restaurant Food Cost Calculator</h1>
            <p>
              Cost every dish using real ingredient prices, yield, actual recipe quantities, packaging, wastage, labour, GST and delivery-channel deductions.
            </p>
          </div>
          <div className="fcr-hero-actions">
            <button type="button" className="fcr-btn fcr-btn-secondary" onClick={exportJson}>Export recipe</button>
            <button type="button" className="fcr-btn fcr-btn-ghost" onClick={resetCalculator}>Reset</button>
          </div>
        </header>

        <section className="fcr-step-card">
          <div className="fcr-section-heading">
            <div>
              <span className="fcr-step">1</span>
              <div>
                <h2>Dish & pricing</h2>
                <p>Start with the dish, portion count and menu price.</p>
              </div>
            </div>
          </div>
          <div className="fcr-grid fcr-grid-4">
            <label className="fcr-field fcr-span-2">
              <span>Dish name</span>
              <input value={recipe.name} onChange={(event) => setRecipe({ ...recipe, name: event.target.value })} placeholder="e.g. Paneer Butter Masala" />
            </label>
            <label className="fcr-field">
              <span>Servings / portions</span>
              <input type="number" min="0.01" step="0.01" value={recipe.servings} onChange={(event) => setRecipe({ ...recipe, servings: numberValue(event.target.value, 1) })} />
            </label>
            <label className="fcr-field">
              <span>Selling price (₹)</span>
              <input type="number" min="0" step="0.01" value={pricing.sellingPrice} onChange={(event) => setPricing({ ...pricing, sellingPrice: numberValue(event.target.value) })} />
            </label>
          </div>
          <div className="fcr-toggle-row">
            <button type="button" className={`fcr-segment ${pricing.priceIncludesGst ? 'active' : ''}`} onClick={() => setPricing({ ...pricing, priceIncludesGst: true })}>Price includes GST</button>
            <button type="button" className={`fcr-segment ${!pricing.priceIncludesGst ? 'active' : ''}`} onClick={() => setPricing({ ...pricing, priceIncludesGst: false })}>Price excludes GST</button>
            <label className="fcr-inline-field">
              <span>GST %</span>
              <input type="number" min="0" step="0.01" value={pricing.gstPercent} onChange={(event) => setPricing({ ...pricing, gstPercent: numberValue(event.target.value) })} />
            </label>
            <label className="fcr-inline-field">
              <span>Target food cost %</span>
              <input type="number" min="1" max="99" step="0.5" value={pricing.targetFoodCostPercent} onChange={(event) => setPricing({ ...pricing, targetFoodCostPercent: numberValue(event.target.value, 30) })} />
            </label>
          </div>
          <p className="fcr-note">Food cost % below uses the ex-GST menu price. Ingredient purchase prices are treated as your actual landed purchase cost, so any GST embedded in those purchases remains in ingredient cost.</p>
        </section>

        <section className="fcr-step-card">
          <div className="fcr-section-heading fcr-heading-with-action">
            <div>
              <span className="fcr-step">2</span>
              <div>
                <h2>Ingredients & actual recipe quantity</h2>
                <p>Use the quantity your kitchen actually consumes — not the theoretical recipe quantity.</p>
              </div>
            </div>
            <button type="button" className="fcr-btn fcr-btn-secondary" onClick={() => setShowIngredientMaster((value) => !value)}>{showIngredientMaster ? 'Hide' : 'Manage'} ingredient master</button>
          </div>

          {showIngredientMaster && (
            <div className="fcr-subpanel">
              <div className="fcr-subpanel-head">
                <div>
                  <strong>Ingredient master</strong>
                  <span>Store per kg / L / piece economics, not pack-level economics.</span>
                </div>
                <button type="button" className="fcr-btn fcr-btn-primary" onClick={addMasterIngredient}>+ Add ingredient</button>
              </div>
              <div className="fcr-table-wrap">
                <table className="fcr-table">
                  <thead><tr><th>Name</th><th>Category</th><th>Purchase price</th><th>Pack</th><th>Unit</th><th>Yield %</th><th>Supplier</th></tr></thead>
                  <tbody>
                    {ingredients.map((item) => (
                      <tr key={item.id}>
                        <td><input value={item.name} onChange={(event) => updateIngredient(item.id, { name: event.target.value })} /></td>
                        <td><input value={item.category} onChange={(event) => updateIngredient(item.id, { category: event.target.value })} /></td>
                        <td><input type="number" min="0" step="0.01" value={item.purchasePrice} onChange={(event) => updateIngredient(item.id, { purchasePrice: numberValue(event.target.value), lastUpdated: niceDate() })} /></td>
                        <td><input type="number" min="0.001" step="0.001" value={item.packSize} onChange={(event) => updateIngredient(item.id, { packSize: numberValue(event.target.value, 1) })} /></td>
                        <td><select value={item.packUnit} onChange={(event) => updateIngredient(item.id, { packUnit: event.target.value as Ingredient['packUnit'] })}>{UNITS.filter((unit) => unit !== 'portion').map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></td>
                        <td><input type="number" min="0.01" max="100" step="0.1" value={item.yieldPercent} onChange={(event) => updateIngredient(item.id, { yieldPercent: numberValue(event.target.value, 100) })} /></td>
                        <td><input value={item.supplier ?? ''} onChange={(event) => updateIngredient(item.id, { supplier: event.target.value })} placeholder="Optional" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="fcr-note">Starter Indian ingredient rates are editable examples only. Replace them with your invoice / purchase rates. Yield adjusts usable cost; a 90% yield means only 900 g of a 1 kg purchase becomes usable.</p>
            </div>
          )}

          <div className="fcr-add-row">
            <div className="fcr-search-wrap">
              <input value={ingredientSearch} onChange={(event) => setIngredientSearch(event.target.value)} placeholder="Search ingredients: paneer, onion, oil..." />
              {ingredientSearch && (
                <div className="fcr-search-results">
                  {filteredIngredients.slice(0, 8).map((ingredient) => (
                    <button key={ingredient.id} type="button" onClick={() => { setIngredientSearch(ingredient.name); }}>
                      <span>{ingredient.name}</span><small>{ingredient.category} • {formatMoney(ingredient.purchasePrice)}/{ingredient.packSize}{ingredient.packUnit}</small>
                    </button>
                  ))}
                  {!filteredIngredients.length && <div className="fcr-empty-search">No ingredient found. Add it in the ingredient master above.</div>}
                </div>
              )}
            </div>
            <button type="button" className="fcr-btn fcr-btn-primary" onClick={addIngredientToRecipe}>+ Add ingredient</button>
          </div>

          {!!recipe.items.length && (
            <div className="fcr-line-list">
              {recipe.items.map((item, index) => {
                const name = item.kind === 'ingredient'
                  ? ingredientsById.get(item.refId)?.name ?? 'Missing ingredient'
                  : `${subrecipesById.get(item.refId)?.name ?? 'Missing sub-recipe'} (sub-recipe)`
                const ingredient = item.kind === 'ingredient' ? ingredientsById.get(item.refId) : undefined
                const allowedFamily = ingredient ? UNIT_FAMILY[ingredient.packUnit] : 'portion'
                const selectableUnits = item.kind === 'subrecipe' ? ['portion' as Unit] : UNITS.filter((unit) => UNIT_FAMILY[unit] === allowedFamily)
                return (
                  <div className="fcr-line" key={item.id}>
                    <div className="fcr-line-index">{index + 1}</div>
                    <div className="fcr-line-name">
                      <strong>{name}</strong>
                      {ingredient && <span>₹{effectivePerBaseLabel(ingredient)}</span>}
                    </div>
                    <input type="number" min="0" step="0.001" value={item.quantity} onChange={(event) => setRecipe((current) => ({ ...current, items: current.items.map((line) => line.id === item.id ? { ...line, quantity: numberValue(event.target.value) } : line) }))} />
                    <select value={item.unit} onChange={(event) => setRecipe((current) => ({ ...current, items: current.items.map((line) => line.id === item.id ? { ...line, unit: event.target.value as Unit } : line) }))}>{selectableUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
                    <button type="button" className="fcr-icon-btn" onClick={() => setRecipe((current) => ({ ...current, items: current.items.filter((line) => line.id !== item.id) }))} aria-label={`Remove ${name}`}>×</button>
                  </div>
                )
              })}
            </div>
          )}

          {!recipe.items.length && (
            <div className="fcr-empty-state">Add your first ingredient above. The calculator will cost it using pack size + yield, then divide the recipe by servings.</div>
          )}

          <div className="fcr-subrecipe-tools">
            <div>
              <button type="button" className="fcr-link-button" onClick={() => setShowSubrecipes((value) => !value)}>↳ {showSubrecipes ? 'Hide sub-recipes' : 'Add / manage sub-recipes'}</button>
              <span>Use this for gravy, dough, sauce, marinade or other prepped components.</span>
            </div>
            {showSubrecipes && <button type="button" className="fcr-btn fcr-btn-secondary" onClick={addSubrecipe}>+ New sub-recipe</button>}
          </div>

          {showSubrecipes && (
            <div className="fcr-subrecipe-list">
              {subrecipes.map((sub) => {
                const subCost = calculateRecipeCost(sub, ingredientsById, subrecipesById)
                return (
                  <div className="fcr-subrecipe" key={sub.id}>
                    <div className="fcr-subrecipe-head">
                      <div>
                        <input className="fcr-large-input" value={sub.name} onChange={(event) => updateSubrecipe(sub.id, { name: event.target.value })} placeholder="e.g. Butter gravy" />
                        <div className="fcr-small-fields">
                          <label>Batch servings <input type="number" min="0.01" step="0.01" value={sub.servings} onChange={(event) => updateSubrecipe(sub.id, { servings: numberValue(event.target.value, 1) })} /></label>
                          <span>Batch cost: <strong>{formatMoney(subCost.totalIngredientCost)}</strong></span>
                          <span>Cost / serving: <strong>{formatMoney(subCost.costPerPortion)}</strong></span>
                        </div>
                      </div>
                      <button type="button" className="fcr-icon-btn" onClick={() => setSubrecipes((current) => current.filter((item) => item.id !== sub.id))}>×</button>
                    </div>
                    {sub.items.map((item) => {
                      const ing = ingredientsById.get(item.refId)
                      if (!ing) return null
                      return (
                        <div className="fcr-line fcr-line-small" key={item.id}>
                          <div className="fcr-line-name"><strong>{ing.name}</strong></div>
                          <input type="number" min="0" step="0.001" value={item.quantity} onChange={(event) => updateSubrecipe(sub.id, { items: sub.items.map((line) => line.id === item.id ? { ...line, quantity: numberValue(event.target.value) } : line) })} />
                          <select value={item.unit} onChange={(event) => updateSubrecipe(sub.id, { items: sub.items.map((line) => line.id === item.id ? { ...line, unit: event.target.value as Unit } : line) })}>{UNITS.filter((unit) => UNIT_FAMILY[unit] === UNIT_FAMILY[ing.packUnit]).map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
                          <button type="button" className="fcr-icon-btn" onClick={() => updateSubrecipe(sub.id, { items: sub.items.filter((line) => line.id !== item.id) })}>×</button>
                        </div>
                      )
                    })}
                    <button type="button" className="fcr-link-button" onClick={() => addSubrecipeItem(sub.id)}>+ ingredient to sub-recipe</button>
                  </div>
                )
              })}
              <div className="fcr-add-row fcr-subrecipe-add-main">
                <div className="fcr-search-wrap">
                  <input value={subRecipeSearch} onChange={(event) => setSubRecipeSearch(event.target.value)} placeholder="Search sub-recipe to add to final dish" />
                  {subRecipeSearch && filteredSubrecipes.length > 0 && <div className="fcr-search-results">{filteredSubrecipes.slice(0, 5).map((sub) => <button key={sub.id} type="button" onClick={() => setSubRecipeSearch(sub.name)}><span>{sub.name}</span><small>{formatMoney(calculateRecipeCost(sub, ingredientsById, subrecipesById).costPerPortion)} / portion</small></button>)}</div>}
                </div>
                <button type="button" className="fcr-btn fcr-btn-primary" onClick={addSubrecipeToRecipe}>+ Add sub-recipe to dish</button>
              </div>
            </div>
          )}
        </section>

        <section className="fcr-step-card">
          <div className="fcr-section-heading">
            <div>
              <span className="fcr-step">3</span>
              <div>
                <h2>Extra costs</h2>
                <p>Keep delivery and kitchen overhead visible instead of hiding them inside “food cost”.</p>
              </div>
            </div>
          </div>
          <div className="fcr-grid fcr-grid-4">
            <label className="fcr-field"><span>Packaging / order (₹)</span><input type="number" min="0" step="0.01" value={extraCosts.packagingPerOrder} onChange={(event) => setExtraCosts({ ...extraCosts, packagingPerOrder: numberValue(event.target.value) })} /></label>
            <label className="fcr-field"><span>Gas & consumables (₹)</span><input type="number" min="0" step="0.01" value={extraCosts.gasConsumablesPerOrder} onChange={(event) => setExtraCosts({ ...extraCosts, gasConsumablesPerOrder: numberValue(event.target.value) })} /></label>
            <label className="fcr-field"><span>Labour / overhead add-on %</span><input type="number" min="0" max="100" step="0.5" value={extraCosts.laborOverheadPercent} onChange={(event) => setExtraCosts({ ...extraCosts, laborOverheadPercent: numberValue(event.target.value) })} /></label>
            <label className="fcr-field"><span>Wastage buffer %</span><input type="number" min="0" max="100" step="0.5" value={extraCosts.wastageBufferPercent} onChange={(event) => setExtraCosts({ ...extraCosts, wastageBufferPercent: numberValue(event.target.value) })} /></label>
          </div>
          <p className="fcr-note">Use ingredient-level yield for known waste such as trimming, peeling, bones and cooking loss. The wastage buffer here is a separate management buffer for unexpected spillage / rejection / order waste.</p>
        </section>

        <section className="fcr-step-card">
          <div className="fcr-section-heading fcr-heading-with-action">
            <div>
              <span className="fcr-step">4</span>
              <div>
                <h2>Channel economics</h2>
                <p>Compare dine-in, takeaway, own delivery and aggregator assumptions side-by-side.</p>
              </div>
            </div>
            <button type="button" className="fcr-btn fcr-btn-secondary" onClick={() => setShowChannelSettings((value) => !value)}>{showChannelSettings ? 'Hide settings' : 'Edit channel assumptions'}</button>
          </div>

          {showChannelSettings && (
            <div className="fcr-subpanel">
              <div className="fcr-table-wrap">
                <table className="fcr-table">
                  <thead><tr><th>Channel</th><th>Commission %</th><th>GST on commission %</th><th>Other deduction %</th><th>Other fixed ₹</th><th>Commission base</th></tr></thead>
                  <tbody>
                    {channels.map((channel) => (
                      <tr key={channel.id}>
                        <td><strong>{channel.name}</strong></td>
                        <td><input type="number" min="0" max="100" step="0.1" value={channel.commissionPercent} onChange={(event) => updateChannel(channels, setChannels, channel.id, { commissionPercent: numberValue(event.target.value) })} /></td>
                        <td><input type="number" min="0" max="100" step="0.1" value={channel.commissionGstPercent} onChange={(event) => updateChannel(channels, setChannels, channel.id, { commissionGstPercent: numberValue(event.target.value) })} /></td>
                        <td><input type="number" min="0" max="100" step="0.1" value={channel.otherDeductionPercent} onChange={(event) => updateChannel(channels, setChannels, channel.id, { otherDeductionPercent: numberValue(event.target.value) })} /></td>
                        <td><input type="number" min="0" step="0.01" value={channel.otherDeductionFixed} onChange={(event) => updateChannel(channels, setChannels, channel.id, { otherDeductionFixed: numberValue(event.target.value) })} /></td>
                        <td><select value={channel.commissionOnGstInclusive ? 'inclusive' : 'exclusive'} onChange={(event) => updateChannel(channels, setChannels, channel.id, { commissionOnGstInclusive: event.target.value === 'inclusive' })}><option value="inclusive">GST-inclusive order value</option><option value="exclusive">Ex-GST price</option></select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="fcr-note">Aggregator commercial terms vary by restaurant, agreement and order type. Keep these rates editable rather than hardcoding one “universal” Zomato / Swiggy rate. Commission GST is modeled as a percentage of commission.</p>
            </div>
          )}

          <div className="fcr-channel-tabs">
            {channelResults.map((result) => (
              <button key={result.channel.id} type="button" className={`fcr-channel-tab ${selectedChannel === result.channel.id ? 'active' : ''}`} onClick={() => setSelectedChannel(result.channel.id)}>
                <span>{result.channel.name}</span>
                <strong>{result.foodCostPercent.toFixed(1)}%</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="fcr-results">
          <div className="fcr-results-head">
            <div>
              <p className="fcr-eyebrow">Your dish economics</p>
              <h2>{recipe.name || 'Untitled dish'}</h2>
            </div>
            <div className={`fcr-status fcr-status-${selectedResult?.status ?? 'red'}`}>{selectedResult ? statusLabel(selectedResult.status, pricing.targetFoodCostPercent, selectedResult.foodCostPercent) : 'Add ingredients'}</div>
          </div>

          <div className="fcr-kpi-grid">
            <div className="fcr-kpi fcr-kpi-primary"><span>Cost per portion</span><strong>{formatMoney(recipeCost.costPerPortion)}</strong><small>Total recipe: {formatMoney(recipeCost.totalIngredientCost)}</small></div>
            <div className={`fcr-kpi fcr-kpi-${selectedResult?.status ?? 'red'}`}><span>Food cost %</span><strong>{selectedResult ? `${selectedResult.foodCostPercent.toFixed(1)}%` : '0.0%'}</strong><small>Target: {pricing.targetFoodCostPercent}%</small></div>
            <div className="fcr-kpi"><span>Gross profit / portion</span><strong>{formatMoney(selectedResult?.grossProfitBeforeExtras ?? 0)}</strong><small>Before extra + channel costs</small></div>
            <div className="fcr-kpi"><span>Net profit / portion</span><strong>{formatMoney(selectedResult?.netProfit ?? 0)}</strong><small>{selectedResult?.channel.name ?? 'Selected channel'}</small></div>
          </div>

          <div className="fcr-results-grid">
            <div className="fcr-panel">
              <div className="fcr-panel-heading"><h3>Ingredient cost breakdown</h3><span>{recipeCost.ingredientLines.length} lines</span></div>
              <div className="fcr-breakdown-list">
                {breakdownLines.length ? breakdownLines.map((line) => (
                  <div className="fcr-cost-row" key={line.itemId}>
                    <div><strong>{line.name}</strong><span>{line.quantity}{line.unit} {line.yieldPercent ? `• ${line.yieldPercent}% yield` : ''}</span></div>
                    <div className="fcr-cost-row-right"><strong>{formatMoney(line.ingredientCost)}</strong><span>{line.percentOfIngredientCost.toFixed(1)}%</span></div>
                  </div>
                )) : <div className="fcr-empty-state">Your ingredient cost breakdown will appear here.</div>}
              </div>
              {!!recipeCost.warnings.length && <div className="fcr-warning-box">{recipeCost.warnings.map((warning) => <div key={warning}>⚠ {warning}</div>)}</div>}
            </div>

            <div className="fcr-panel">
              <div className="fcr-panel-heading"><h3>{selectedResult?.channel.name ?? 'Channel'} economics</h3><span>Per portion / order</span></div>
              <div className="fcr-metric-list">
                <div><span>Menu price, ex-GST</span><strong>{formatMoney(selectedResult?.exGstSellingPrice ?? 0)}</strong></div>
                <div><span>Customer price</span><strong>{formatMoney(selectedResult?.customerPrice ?? 0)}</strong></div>
                <div><span>Packaging + gas</span><strong>{formatMoney(selectedResult?.fixedExtraCosts ?? 0)}</strong></div>
                <div><span>Labour / overhead</span><strong>{formatMoney(selectedResult?.laborOverheadCost ?? 0)}</strong></div>
                <div><span>Wastage buffer</span><strong>{formatMoney(selectedResult?.wastageBufferCost ?? 0)}</strong></div>
                <div><span>Commission</span><strong>{formatMoney(selectedResult?.commissionCost ?? 0)}</strong></div>
                <div><span>GST on commission</span><strong>{formatMoney(selectedResult?.commissionGstCost ?? 0)}</strong></div>
                <div className="fcr-metric-emphasis"><span>Estimated settlement</span><strong>{formatMoney(selectedResult?.estimatedSettlement ?? 0)}</strong></div>
                <div className={selectedResult && selectedResult.netProfit < 0 ? 'negative' : 'positive'}><span>Estimated net profit</span><strong>{formatMoney(selectedResult?.netProfit ?? 0)}</strong></div>
              </div>
              <p className="fcr-note">Settlement is a management estimate: customer value less modeled commission, GST on commission and other deductions. It is not a tax filing or legal settlement statement.</p>
            </div>
          </div>

          <div className="fcr-panel fcr-channel-comparison">
            <div className="fcr-panel-heading"><h3>Channel comparison</h3><span>Change the assumptions above to match your agreements</span></div>
            <div className="fcr-table-wrap">
              <table className="fcr-table fcr-results-table">
                <thead><tr><th>Channel</th><th>Food cost %</th><th>Gross profit</th><th>Commission + GST</th><th>Net profit</th><th>Net margin</th><th>Break-even ex-GST</th><th>Suggested price</th></tr></thead>
                <tbody>
                  {channelResults.map((result) => (
                    <tr key={result.channel.id} className={result.channel.id === selectedChannel ? 'selected' : ''}>
                      <td><strong>{result.channel.name}</strong></td>
                      <td><span className={`fcr-mini-status fcr-mini-${result.status}`}>{result.foodCostPercent.toFixed(1)}%</span></td>
                      <td>{formatMoney(result.grossProfitBeforeExtras)}</td>
                      <td>{formatMoney(result.commissionCost + result.commissionGstCost)}</td>
                      <td className={result.netProfit < 0 ? 'negative' : 'positive'}>{formatMoney(result.netProfit)}</td>
                      <td>{result.netMarginPercent.toFixed(1)}%</td>
                      <td>{formatMoney(result.breakEvenExGstPrice)}</td>
                      <td>{formatMoney(result.suggestedCustomerPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="fcr-panel fcr-whatif">
            <div className="fcr-panel-heading"><div><h3>What if ingredient prices rise?</h3><span>Stress-test the recipe before supplier prices surprise you.</span></div><strong>{whatIfPercent > 0 ? `+${whatIfPercent}%` : `${whatIfPercent}%`}</strong></div>
            <input type="range" min="0" max="30" step="1" value={whatIfPercent} onChange={(event) => setWhatIfPercent(numberValue(event.target.value))} />
            <div className="fcr-whatif-grid">
              <div><span>New ingredient cost / portion</span><strong>{formatMoney(whatIfRecipeCost.costPerPortion)}</strong></div>
              <div><span>Food cost %</span><strong>{whatIfSelectedResult ? `${whatIfSelectedResult.foodCostPercent.toFixed(1)}%` : '0.0%'}</strong></div>
              <div><span>Net profit</span><strong>{formatMoney(whatIfSelectedResult?.netProfit ?? 0)}</strong></div>
              <div><span>Profit change</span><strong>{formatMoney((whatIfSelectedResult?.netProfit ?? 0) - (selectedResult?.netProfit ?? 0))}</strong></div>
            </div>
            <p className="fcr-note">This scenario changes all ingredient purchase prices by the selected percentage. It does not change your selling price or other fixed costs.</p>
          </div>

          <div className="fcr-suggestion-grid">
            <div className="fcr-suggestion-card">
              <span>Suggested menu price at target food cost</span>
              <strong>{formatMoney(selectedResult?.suggestedCustomerPrice ?? 0)}</strong>
              <small>Customer-facing price using your target {pricing.targetFoodCostPercent}% and {pricing.gstPercent}% GST.</small>
            </div>
            <div className="fcr-suggestion-card">
              <span>Break-even price — {selectedResult?.channel.name ?? 'channel'}</span>
              <strong>{formatMoney(selectedResult?.breakEvenExGstPrice ?? 0)}</strong>
              <small>Ex-GST price needed to cover recipe cost + modeled extras + channel deductions.</small>
            </div>
            <div className="fcr-suggestion-card">
              <span>Current recipe cost before channel</span>
              <strong>{formatMoney(totalExtraBeforeChannel)}</strong>
              <small>Ingredient cost + packaging + gas/consumables.</small>
            </div>
          </div>

          <div className="fcr-next-step">
            <div><strong>Ready to manage the whole menu?</strong><span>Use Dinezy to digitize menus, track guest engagement and connect restaurant QR experiences.</span></div>
            <a href="https://dinezy.in" className="fcr-btn fcr-btn-primary">Explore Dinezy</a>
          </div>
        </section>

        <section className="fcr-disclaimer">
          <strong>Important:</strong> This is a management-planning calculator, not tax, accounting or legal advice. GST treatment, input-tax-credit eligibility and platform commercial terms can depend on your restaurant's facts and agreements. Verify your outlet-specific treatment with your CA / tax advisor and your platform statements.
        </section>

      </div>
    </main>
  )
}

function effectivePerBaseLabel(ingredient: Ingredient) {
  const packBase = ingredient.packUnit === 'kg' ? ingredient.packSize * 1000 : ingredient.packUnit === 'L' ? ingredient.packSize * 1000 : ingredient.packSize
  const yieldFraction = Math.max(0.0001, ingredient.yieldPercent / 100)
  const cost = ingredient.purchasePrice / packBase / yieldFraction
  if (ingredient.packUnit === 'kg') return `${cost.toFixed(2)}/g`
  if (ingredient.packUnit === 'L') return `${cost.toFixed(3)}/ml`
  return `${cost.toFixed(2)}/${ingredient.packUnit}`
}

function updateChannel(
  channels: Channel[],
  setter: Dispatch<SetStateAction<Channel[]>>,
  id: Channel['id'],
  patch: Partial<Channel>,
) {
  setter(channels.map((channel) => (channel.id === id ? { ...channel, ...patch } : channel)))
}

function statusLabel(status: 'green' | 'amber' | 'red', target: number, current: number) {
  if (status === 'green') return `Healthy food cost • ≤ ${target}%`
  if (status === 'amber') return `Watch food cost • ${current.toFixed(1)}%`
  return `High food cost • ${current.toFixed(1)}%`
}
