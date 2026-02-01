
import { FoodItem, Category } from './types';

export const DEFAULT_BRANDING = {
  name: 'Santa Parrilla',
  logoUrl: 'https://ejerqcxzvfwnccdadytj.supabase.co/storage/v1/object/public/assets/santa-parrilla-logo.png'
};

export const INITIAL_MENU: FoodItem[] = [
  {
    id: 'b1',
    name: 'Burger Suprema',
    price: 12.50,
    category: 'Hamburguesas',
    description: 'Angus 200g, queso brie, cebolla caramelizada y rúcula.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'c1',
    name: 'Baby Back Ribs',
    price: 18.00,
    category: 'Carnes',
    description: 'Costillas de cerdo bañadas en salsa BBQ artesanal con cocción lenta.',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'p1',
    name: 'Papas Trufadas',
    price: 6.50,
    category: 'Papas Fritas',
    description: 'Papas rústicas con aceite de trufa blanca y parmesano.',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&h=300'
  }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat1', name: 'Hamburguesas', icon: '🍔' },
  { id: 'cat2', name: 'Carnes', icon: '🥩' },
  { id: 'cat3', name: 'Papas Fritas', icon: '🍟' },
  { id: 'cat4', name: 'Bebidas', icon: '🥤' },
  { id: 'cat5', name: 'Adiciones', icon: '➕' }
];