
export interface FoodItem {
  id: string;
  name: string;
  price: number;
  category: 'Hamburguesas' | 'Carnes' | 'Papas Fritas' | 'Bebidas' | 'Postres';
  image: string;
  description: string;
}

export interface OrderItem extends FoodItem {
  quantity: number;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DELIVERED = 'DELIVERED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED'
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  createdAt: string | number; // Soportamos string ISO de Supabase y number timestamp
  tableNumber?: string;
}

export type ViewType = 'menu' | 'orders' | 'kitchen' | 'stats' | 'ai' | 'admin';
