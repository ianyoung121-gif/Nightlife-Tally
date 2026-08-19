import React from 'react';
import { AppIcon, type AppIconName } from '@/components/AppIcon';

type DrinkIconName = Extract<AppIconName, 'beer' | 'bottle-soda' | 'coffee' | 'cup' | 'glass-cocktail' | 'glass-wine' | 'liquor'>;

type DrinkIconProps = {
  name?: string | null;
  category?: string | null;
  color: string;
  size?: number;
};

function iconForDrink(name?: string | null, category?: string | null): DrinkIconName {
  const searchText = `${category ?? ''} ${name ?? ''}`.toLowerCase();

  if (/(wine|merlot|chardonnay|pinot|rosé|rose)/.test(searchText)) return 'glass-wine';
  if (/(beer|lager|ale|ipa|stout|pilsner|cider)/.test(searchText)) return 'beer';
  if (/(cocktail|martini|margarita|mojito|daiquiri|spritz|sangria)/.test(searchText)) return 'glass-cocktail';
  if (/(coffee|espresso|latte|cold brew)/.test(searchText)) return 'coffee';
  if (/(soda|cola|pop|tonic|ginger ale)/.test(searchText)) return 'bottle-soda';
  if (/(shot|liquor|whiskey|whisky|bourbon|vodka|tequila|rum|gin)/.test(searchText)) return 'liquor';
  return 'cup';
}

export function DrinkIcon({ name, category, color, size = 22 }: DrinkIconProps) {
  return <AppIcon name={iconForDrink(name, category)} size={size} color={color} />;
}