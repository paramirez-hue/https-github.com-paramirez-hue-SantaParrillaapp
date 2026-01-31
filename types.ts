
export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface FoodItem {
  id: string;
  name: string;
  price: number;
  category: string; 
  image: string;
  description: string;
}

export interface OrderItem extends FoodItem {
  quantity: number;
  additions?: FoodItem[];
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

export type PaymentMethod = 'CASH' | 'TRANSFER';

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  customerName: string;
  createdAt: string | number;
  tableNumber?: string;
}

export type ViewType = 'menu' | 'orders' | 'kitchen' | 'stats' | 'ai' | 'admin';
