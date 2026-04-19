
import { FoodItem, Category } from './types';

export const DEFAULT_BRANDING = {
  name: 'Santa Parrilla',
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
    id: 'b2',
    name: 'Burger Parrillera',
    price: 14.00,
    category: 'Hamburguesas',
    description: 'Carne madurada, queso mozzarella, chorizo santarrosano y chimichurri.',
    image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'b3',
    name: 'Burger Pollo Crispy',
    price: 11.50,
    category: 'Hamburguesas',
    description: 'Pechuga apanada crocante, salsa especial, lechuga y tomate fresco.',
    image: 'https://images.unsplash.com/photo-1525351326368-efbb5cb6814d?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'b4',
    name: 'Burger Mexicana',
    price: 13.50,
    category: 'Hamburguesas',
    description: 'Carne de res, guacamole artesanal, jalapeños, pico de gallo y nachos crocantes.',
    image: 'https://images.unsplash.com/photo-1582196016295-f8c499b33d1a?auto=format&fit=crop&w=400&h=300'
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
    id: 'c3',
    name: 'Churrasco a la Plancha',
    price: 19.50,
    category: 'Carnes',
    description: 'Corte de res tierno a la plancha, servido con chimichurri y ensalada.',
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'c4',
    name: 'Punta de Anca',
    price: 21.00,
    category: 'Carnes',
    description: '300g de punta de anca madurada, asada al término deseado con sal marina.',
    image: 'https://images.unsplash.com/photo-1546241072-48010ad28c2c?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'ch1',
    name: 'Chuzo de Res',
    price: 9.50,
    category: 'Chuzos',
    description: 'Brocheta de lomo de res premium con papa cocida y arepa.',
    image: 'https://images.unsplash.com/photo-1529193591184-b1d58b34ecdf?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'ch2',
    name: 'Chuzo de Pollo',
    price: 8.50,
    category: 'Chuzos',
    description: 'Brocheta de pechuga de pollo marinada, asada al carbón.',
    image: 'https://images.unsplash.com/photo-1532636875304-0c89119d9b4d?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'ch3',
    name: 'Chuzo de Cerdo',
    price: 8.50,
    category: 'Chuzos',
    description: 'Brocheta de pierna de cerdo adobada con especias de la casa.',
    image: 'https://images.unsplash.com/photo-1516684669134-de6f7c473a2a?auto=format&fit=crop&w=400&h=300'
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
    name: 'Papas con Todo',
    price: 9.00,
    category: 'Papas Fritas',
    description: 'Papas fritas con salchicha, queso fundido, tocineta y salsas.',
    image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'p3',
    name: 'Papas Criollas',
    price: 5.50,
    category: 'Papas Fritas',
    description: 'Papas amarillas pequeñas fritas con sal de mar y romero.',
    image: 'https://images.unsplash.com/photo-1623238913973-21e45cced554?auto=format&fit=crop&w=400&h=300'
  },
  {
    id: 'p4',
    name: 'Papas en Cascos',
    price: 6.00,
    category: 'Papas Fritas',
    description: 'Cascos de papa sazonados con pimentón ahumado y finas hierbas.',
    image: 'https://images.unsplash.com/photo-1518013031637-61c453967b3f?auto=format&fit=crop&w=400&h=300'
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
  { id: 'cat3', name: 'Chuzos', icon: '🍢' },
  { id: 'cat4', name: 'Papas Fritas', icon: '🍟' },
  { id: 'cat5', name: 'Bebidas', icon: '🥤' },
  { id: 'cat6', name: 'Adiciones', icon: '➕' }
];
