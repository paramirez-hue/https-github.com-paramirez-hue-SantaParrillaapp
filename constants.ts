
import { FoodItem } from './types';

// CONFIGURACIÓN PREDETERMINADA DEL NEGOCIO
export const DEFAULT_BRANDING = {
  name: 'Santa Parrilla',
  logoUrl: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png' // Puedes cambiar esto por tu URL fija
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
    id: 'c2',
    name: 'Bife de Chorizo',
    price: 22.00,
    category: 'Carnes',
    description: '350g de corte premium a la parrilla con mantequilla de hierbas.',
    image: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'p1',
    name: 'Papas Trufadas',
    price: 6.50,
    category: 'Papas Fritas',
    description: 'Papas rústicas con aceite de trufa blanca y parmesano.',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'p2',
    name: 'Papas Criminales',
    price: 8.50,
    category: 'Papas Fritas',
    description: 'Bañadas en cheddar fundido, bacon picado y cebollín.',
    image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'd1',
    name: 'Limonada de Coco',
    price: 4.50,
    category: 'Bebidas',
    description: 'Refrescante mezcla de coco y limón natural.',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&h=300'
  }
];

export const CATEGORIES = [
  { id: 'Hamburguesas', icon: '🍔' },
  { id: 'Carnes', icon: '🥩' },
  { id: 'Papas Fritas', icon: '🍟' },
  { id: 'Bebidas', icon: '🥤' },
  { id: 'Postres', icon: '🍰' }
] as const;
