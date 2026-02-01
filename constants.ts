
import { FoodItem, Category } from './types';

export const DEFAULT_BRANDING = {
  name: 'Santa Parrilla',
  // He convertido la imagen proporcionada a un formato accesible para la app
  logoUrl: 'https://ejerqcxzvfwnccdadytj.supabase.co/storage/v1/object/sign/icono/SANTA%20PARRILLA2.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOGViNDg4NC1lZGI1LTQzMzItYmY5My0xNzg2ZTlkNTdhYTkiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uby9TQU5UQSBQQVJSSUxMQTIucG5nIiwiaWF0IjoxNzY5OTIyMTIyLCJleHAiOjg2NDAwMDAwMDAxNzY5ODMwMDAwfQ.-Dlj7OYlNm-j0nFzLera5-_hEakS5cfd-LecbPxAi6E'
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
    id: 'add1',
    name: 'Queso Extra',
    price: 1.50,
    category: 'Adiciones',
    description: 'Doble porción de queso cheddar fundido.',
    image: 'https://images.unsplash.com/photo-1552767059-ce182ead6c1b?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'add2',
    name: 'Tocineta Crunchy',
    price: 2.00,
    category: 'Adiciones',
    description: 'Tiras de tocineta ahumada extra crocantes.',
    image: 'https://images.unsplash.com/photo-1606851682840-0681159bf5ee?auto=format&fit=crop&w=400&h=300'
  }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat1', name: 'Hamburguesas', icon: '🍔' },
  { id: 'cat2', name: 'Carnes', icon: '🥩' },
  { id: 'cat3', name: 'Papas Fritas', icon: '🍟' },
  { id: 'cat4', name: 'Bebidas', icon: '🥤' },
  { id: 'cat5', name: 'Adiciones', icon: '➕' }
];
