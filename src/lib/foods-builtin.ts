// Common whole foods with no label to scan. Values per 100 g, rounded from USDA
// FoodData Central (SR Legacy / Foundation). Added sugar is 0 for unprocessed foods.
import type { NewFood, Nutrients } from "./types";

type Row = [name: string, serving_g: number, serving_label: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number, sugar: number, added: number | null];

const ROWS: Row[] = [
  // Eggs, dairy
  ["Egg, whole (large)", 50, "1 large egg", 143, 12.6, 0.7, 9.5, 0, 0.4, 0],
  ["Egg whites", 33, "1 large white", 52, 10.9, 0.7, 0.2, 0, 0.7, 0],
  ["Cheddar cheese", 28, "1 oz / 1 slice", 403, 24.9, 1.3, 33.1, 0, 0.5, 0],
  ["Mozzarella, part-skim", 28, "1 oz", 254, 24.3, 2.8, 15.9, 0, 1.1, 0],
  ["Cottage cheese, 2%", 113, "½ cup", 84, 11.0, 4.3, 2.3, 0, 4.1, 0],
  ["Greek yogurt, plain nonfat", 170, "1 container (170 g)", 59, 10.2, 3.6, 0.4, 0, 3.2, 0],
  ["Milk, 2%", 244, "1 cup", 50, 3.3, 4.8, 2.0, 0, 5.1, 0],
  ["Butter", 14, "1 tbsp", 717, 0.9, 0.1, 81.1, 0, 0.1, 0],
  // Meat, fish
  ["Ground beef 80/20, cooked", 85, "3 oz cooked", 254, 25.8, 0, 16.1, 0, 0, 0],
  ["Ground beef 90/10, cooked", 85, "3 oz cooked", 217, 26.1, 0, 11.7, 0, 0, 0],
  ["Chicken breast, cooked", 85, "3 oz cooked", 165, 31.0, 0, 3.6, 0, 0, 0],
  ["Chicken thigh, cooked", 85, "3 oz cooked", 209, 26.0, 0, 10.9, 0, 0, 0],
  ["Turkey, ground 93/7, cooked", 85, "3 oz cooked", 213, 27.1, 0, 11.6, 0, 0, 0],
  ["Bacon, cooked", 8, "1 slice", 541, 37.0, 1.4, 41.8, 0, 0, 0],
  ["Salmon, cooked", 85, "3 oz cooked", 206, 22.1, 0, 12.4, 0, 0, 0],
  ["Tuna, canned in water", 85, "3 oz drained", 116, 25.5, 0, 0.8, 0, 0, 0],
  ["Shrimp, cooked", 85, "3 oz", 99, 24.0, 0.2, 0.3, 0, 0, 0],
  // Fruit
  ["Apple", 182, "1 medium", 52, 0.3, 13.8, 0.2, 2.4, 10.4, 0],
  ["Banana", 118, "1 medium", 89, 1.1, 22.8, 0.3, 2.6, 12.2, 0],
  ["Grapes", 151, "1 cup", 69, 0.7, 18.1, 0.2, 0.9, 15.5, 0],
  ["Strawberries", 152, "1 cup sliced", 32, 0.7, 7.7, 0.3, 2.0, 4.9, 0],
  ["Blueberries", 148, "1 cup", 57, 0.7, 14.5, 0.3, 2.4, 10.0, 0],
  ["Orange", 131, "1 medium", 47, 0.9, 11.8, 0.1, 2.4, 9.4, 0],
  ["Pineapple", 165, "1 cup chunks", 50, 0.5, 13.1, 0.1, 1.4, 9.9, 0],
  ["Watermelon", 152, "1 cup diced", 30, 0.6, 7.6, 0.2, 0.4, 6.2, 0],
  ["Cantaloupe", 160, "1 cup cubed", 34, 0.8, 8.2, 0.2, 0.9, 7.9, 0],
  ["Avocado", 68, "½ avocado", 160, 2.0, 8.5, 14.7, 6.7, 0.7, 0],
  // Vegetables, starches
  ["Broccoli, cooked", 156, "1 cup", 35, 2.4, 7.2, 0.4, 3.3, 1.4, 0],
  ["Carrot", 61, "1 medium", 41, 0.9, 9.6, 0.2, 2.8, 4.7, 0],
  ["Spinach, raw", 30, "1 cup", 23, 2.9, 3.6, 0.4, 2.2, 0.4, 0],
  ["Potato, baked with skin", 173, "1 medium", 93, 2.5, 21.2, 0.1, 2.2, 1.2, 0],
  ["Sweet potato, baked", 114, "1 medium", 90, 2.0, 20.7, 0.2, 3.3, 6.5, 0],
  ["White rice, cooked", 158, "1 cup", 130, 2.7, 28.2, 0.3, 0.4, 0.1, 0],
  ["Brown rice, cooked", 195, "1 cup", 123, 2.7, 25.6, 1.0, 1.6, 0.2, 0],
  ["Oats, dry", 40, "½ cup dry", 379, 13.2, 67.7, 6.5, 10.1, 1.0, 0],
  ["Pasta, cooked", 140, "1 cup", 158, 5.8, 30.9, 0.9, 1.8, 0.6, 0],
  ["Whole wheat bread", 32, "1 slice", 247, 13.0, 41.3, 3.4, 6.8, 5.6, 3.5],
  ["Black beans, cooked", 172, "1 cup", 132, 8.9, 23.7, 0.5, 8.7, 0.3, 0],
  // Nuts, spreads, extras
  ["Peanut butter (regular)", 32, "2 tbsp", 588, 25.1, 20.0, 50.4, 6.0, 9.2, 5.0],
  ["Peanut butter (natural, no sugar)", 32, "2 tbsp", 598, 22.5, 22.3, 51.4, 8.0, 5.0, 0],
  ["Almonds", 28, "1 oz (~23)", 579, 21.2, 21.6, 49.9, 12.5, 4.4, 0],
  ["Olive oil", 14, "1 tbsp", 884, 0, 0, 100, 0, 0, 0],
  ["Honey", 21, "1 tbsp", 304, 0.3, 82.4, 0, 0.2, 82.1, 82.1],
  ["Whey protein powder (typical)", 31, "1 scoop", 390, 77.0, 10.0, 5.0, 1.0, 5.0, 3.0],
  ["Cola (regular)", 368, "12 fl oz can", 42, 0, 10.6, 0, 0, 10.6, 10.6],
];

export const BUILTIN_FOODS: NewFood[] = ROWS.map(([name, serving_g, serving_label, kcal, protein, carbs, fat, fiber, sugar, added]) => {
  const per100: Nutrients = { kcal, protein, carbs, fat, sat_fat: null, fiber, sugar, added_sugar: added, sodium_mg: null };
  return {
    name, brand: "", barcode: "", serving_g, serving_label, per100, source: "builtin",
    nutriscore: "", image_url: "", favorite: false, created_at: "",
  };
});
