
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, ClipboardList, ChefHat, BarChart3, Sparkles, Plus, Minus, Trash2, X,
  UtensilsCrossed, Timer, ShoppingBasket, Edit2, Search, Lock, LogOut, ChevronLeft,
  ChevronRight, Settings, Store, Camera, LayoutGrid, Home, Upload, DollarSign, Wifi,
  AlertCircle, CheckCircle2, Info, Image as ImageIcon, Save, Menu as MenuIcon
} from 'lucide-react';
import { FoodItem, Order, OrderItem, OrderStatus, ViewType, PaymentStatus } from './types';
import { INITIAL_MENU, CATEGORIES, DEFAULT_BRANDING } from './constants';
import { getSmartSuggestions } from './geminiService';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "OPCIONAL_KEY", 
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "TU_PROYECTO.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "TU_PROYECTO",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "TU_PROYECTO.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "TU_ID",
  appId: process.env.VITE_FIREBASE_APP_ID || "TU_APP_ID"
};

let db: any = null;
let isFirebaseEnabled = false;

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc, query, orderBy } from 'firebase/firestore';

try {
  if (firebaseConfig.projectId !== "TU_PROYECTO" && firebaseConfig.apiKey !== "OPCIONAL_KEY") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isFirebaseEnabled = true;
  }
} catch (e) {
  console.warn("Modo offline activado");
}

const OrderTimer: React.FC<{ startTime: number }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000 / 60)), 15000);
    setElapsed(Math.floor((Date.now() - startTime) / 1000 / 60));
    return () => clearInterval(interval);
  }, [startTime]);
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${elapsed > 15 ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
      <Timer className="w-3 h-3" /> {elapsed} min
    </div>
  );
};

const App: React.FC = () => {
  const [isStaffMode, setIsStaffMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('menu');
  const [menuItems, setMenuItems] = useState<FoodItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isAdminFormOpen, setIsAdminFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  
  // Estados para personalización del negocio con valores por defecto fijos
  const [restaurantSettings, setRestaurantSettings] = useState(DEFAULT_BRANDING);

  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const unsubMenu = onSnapshot(collection(db, "menu"), (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FoodItem[];
        setMenuItems(items.length > 0 ? items : INITIAL_MENU);
      });
      const unsubOrders = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snapshot) => {
        const o = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Order[];
        setOrders(o);
      });
      const unsubSettings = onSnapshot(doc(db, "settings", "branding"), (snapshot) => {
        if (snapshot.exists()) {
          setRestaurantSettings(prev => ({ ...prev, ...snapshot.data() }));
        }
      });
      return () => { unsubMenu(); unsubOrders(); unsubSettings(); };
    } else {
      const savedMenu = localStorage.getItem('santa_menu');
      setMenuItems(savedMenu ? JSON.parse(savedMenu) : INITIAL_MENU);
      const savedOrders = localStorage.getItem('santa_orders');
      setOrders(savedOrders ? JSON.parse(savedOrders) : []);
      const savedSettings = localStorage.getItem('santa_settings');
      if (savedSettings) setRestaurantSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
    }
  }, []);

  const saveBranding = async (newName: string, newLogo: string) => {
    const newSettings = { name: newName || DEFAULT_BRANDING.name, logoUrl: newLogo || DEFAULT_BRANDING.logoUrl };
    setRestaurantSettings(newSettings);
    if (isFirebaseEnabled && db) {
      await setDoc(doc(db, "settings", "branding"), newSettings);
    } else {
      localStorage.setItem('santa_settings', JSON.stringify(newSettings));
    }
  };

  const handlePayment = async () => {
    if (!customerName) return alert("Por favor, ingresa tu nombre");
    setIsPaying(true);
    
    const newOrder = {
      items: cart,
      total: cart.reduce((acc, item) => acc + (item.price * item.quantity), 0),
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PAID,
      customerName,
      tableNumber: tableNumber || 'Mesa 0',
      createdAt: Date.now()
    };

    try {
      if (isFirebaseEnabled) {
        await addDoc(collection(db, "orders"), newOrder);
      } else {
        const updatedOrders = [{ ...newOrder, id: `L-${Date.now()}` }, ...orders];
        setOrders(updatedOrders as Order[]);
        localStorage.setItem('santa_orders', JSON.stringify(updatedOrders));
      }
      setCart([]);
      setCustomerName('');
      setTableNumber('');
      setPaymentSuccess(true);
      setTimeout(() => { setPaymentSuccess(false); setIsCartOpen(false); }, 2000);
    } catch (e) {
      alert("Error al enviar el pedido");
    } finally {
      setIsPaying(false);
    }
  };

  const updateOrderStatus = async (orderId: string, currentStatus: OrderStatus) => {
    const statusOrder = [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.DELIVERED];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextStatus = statusOrder[Math.min(currentIndex + 1, statusOrder.length - 1)];

    if (isFirebaseEnabled) {
      await updateDoc(doc(db, "orders", orderId), { status: nextStatus });
    } else {
      const updated = orders.map(o => o.id === orderId ? { ...o, status: nextStatus } : o);
      setOrders(updated);
      localStorage.setItem('santa_orders', JSON.stringify(updated));
    }
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const filteredMenu = activeCategory === 'Todas' ? menuItems : menuItems.filter(i => i.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FAF9F6] text-slate-900 font-sans overflow-x-hidden">
      
      {/* SIDEBAR DESKTOP */}
      <nav className="hidden md:flex flex-col bg-slate-950 text-white sticky top-0 h-screen w-64 border-r border-white/10 shrink-0">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg shadow-orange-600/20 overflow-hidden">
            {restaurantSettings.logoUrl ? (
                <img src={restaurantSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
                <UtensilsCrossed className="w-8 h-8" />
            )}
          </div>
          <h1 className="text-sm font-black uppercase tracking-widest truncate px-2">{restaurantSettings.name}</h1>
          <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">Management System</p>
        </div>
        
        <div className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto no-scrollbar">
          {isStaffMode ? (
            <>
              <SidebarItem icon={<ChefHat />} label="Cocina" active={activeView === 'kitchen'} onClick={() => setActiveView('kitchen')} badge={orders.filter(o => o.status !== OrderStatus.DELIVERED).length} />
              <SidebarItem icon={<Settings />} label="Administrar" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />
              <div className="pt-10">
                <button onClick={() => { setIsStaffMode(false); setActiveView('menu'); }} className="w-full p-4 text-red-400 hover:bg-red-400/10 rounded-2xl flex items-center gap-3 transition-colors">
                  <LogOut className="w-5 h-5" /> <span className="text-[10px] font-black uppercase">Cerrar Sesión</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="px-4 py-2 text-[9px] font-black text-slate-600 uppercase">Menú Digital</p>
              <SidebarItem icon={<LayoutGrid />} label="Todas" active={activeCategory === 'Todas'} onClick={() => setActiveCategory('Todas')} />
              {CATEGORIES.map(c => <SidebarItem key={c.id} icon={<span>{c.icon}</span>} label={c.id} active={activeCategory === c.id} onClick={() => setActiveCategory(c.id)} />)}
              
              <div className="mt-auto pt-10 pb-4 border-t border-white/5">
                <button onClick={() => setShowLogin(true)} className="w-full p-4 text-slate-400 hover:bg-white/5 rounded-2xl flex items-center gap-3 transition-colors group">
                  <Lock className="w-5 h-5 group-hover:text-orange-500 transition-colors" /> <span className="text-[10px] font-black uppercase">Acceso Personal</span>
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* MOBILE SIDEBAR (DRAWER) */}
      <div className={`fixed inset-0 z-[100] transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className={`absolute top-0 left-0 h-full w-4/5 max-w-sm bg-slate-950 text-white p-8 transition-transform duration-300 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                          {restaurantSettings.logoUrl ? <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" /> : <UtensilsCrossed className="w-5 h-5 text-white" />}
                      </div>
                      <span className="font-black text-xs uppercase tracking-widest truncate max-w-[120px]">{restaurantSettings.name}</span>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-4">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Navegación</p>
                  <SidebarItem 
                    icon={<LayoutGrid />} 
                    label="Todas las Categorías" 
                    active={activeCategory === 'Todas'} 
                    onClick={() => { setActiveCategory('Todas'); setIsMobileMenuOpen(false); }} 
                  />
                  {CATEGORIES.map(c => (
                    <SidebarItem 
                        key={c.id} 
                        icon={<span>{c.icon}</span>} 
                        label={c.id} 
                        active={activeCategory === c.id} 
                        onClick={() => { setActiveCategory(c.id); setIsMobileMenuOpen(false); }} 
                    />
                  ))}
                  
                  <div className="pt-10 border-t border-white/10 mt-10">
                    <button onClick={() => { setIsMobileMenuOpen(false); setShowLogin(true); }} className="w-full p-4 bg-white/5 rounded-2xl flex items-center gap-4 text-orange-500 font-black text-[10px] uppercase">
                        <Lock className="w-5 h-5" /> Acceso Administrativo
                    </button>
                  </div>
              </div>
          </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b z-40 px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 bg-slate-100 rounded-xl text-slate-600 active:scale-95 transition-all">
                <MenuIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
                <div className="hidden md:block w-8 h-8 rounded-lg overflow-hidden shrink-0">
                    {restaurantSettings.logoUrl && <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" />}
                </div>
                <div className="flex flex-col">
                    <h2 className="text-sm md:text-lg font-black uppercase tracking-tight leading-none truncate max-w-[140px] md:max-w-none">
                        {isStaffMode ? (activeView === 'kitchen' ? 'Monitor de Cocina' : 'Administración') : restaurantSettings.name}
                    </h2>
                    {!isStaffMode && <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest mt-1">{activeCategory}</span>}
                </div>
            </div>
          </div>
          {!isStaffMode && (
            <button onClick={() => setIsCartOpen(true)} className="bg-slate-950 text-white px-4 md:px-6 py-2 md:py-3 rounded-2xl flex items-center gap-2 md:gap-3 relative shadow-xl active:scale-95 transition-all">
              <ShoppingBag className="w-4 h-4" />
              <span className="font-black text-xs md:text-sm">${cartTotal.toFixed(2)}</span>
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{cart.length}</span>}
            </button>
          )}
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-32 md:pb-8">
          {activeView === 'menu' && !isStaffMode && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredMenu.map(item => (
                <div key={item.id} className="bg-white rounded-3xl border overflow-hidden shadow-sm flex flex-col h-full group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="h-32 md:h-52 overflow-hidden bg-slate-100 relative">
                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute top-2 md:top-3 right-2 md:right-3 bg-white/90 backdrop-blur px-2 md:px-3 py-1 md:py-1.5 rounded-xl text-[9px] md:text-[11px] font-black shadow-sm">${item.price.toFixed(2)}</div>
                  </div>
                  <div className="p-3 md:p-5 flex flex-col flex-1">
                    <h3 className="text-[11px] md:text-sm font-black text-slate-800 line-clamp-1 mb-1 uppercase tracking-tight">{item.name}</h3>
                    <p className="text-[8px] md:text-[10px] text-slate-400 line-clamp-2 mb-3 md:mb-4 leading-relaxed h-6 md:h-8">{item.description}</p>
                    <button 
                      onClick={() => {
                        setCart(prev => {
                          const ex = prev.find(i => i.id === item.id);
                          if (ex) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
                          return [...prev, { ...item, quantity: 1 }];
                        });
                      }} 
                      className="mt-auto w-full py-2.5 md:py-3 bg-slate-50 hover:bg-slate-950 hover:text-white transition-all rounded-xl md:rounded-2xl font-black text-[8px] md:text-[10px] uppercase border border-slate-100"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isStaffMode && activeView === 'kitchen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orders.filter(o => o.status !== OrderStatus.DELIVERED).length === 0 ? (
                <div className="col-span-full py-32 text-center text-slate-300">
                  <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-10" />
                  <p className="font-black uppercase text-xs tracking-widest opacity-40">Sin pedidos activos</p>
                </div>
              ) : (
                orders.filter(o => o.status !== OrderStatus.DELIVERED).map(order => (
                  <div key={order.id} className={`bg-white border-t-4 ${order.status === OrderStatus.READY ? 'border-emerald-500' : 'border-orange-500'} rounded-3xl shadow-md overflow-hidden flex flex-col animate-in zoom-in duration-300`}>
                    <div className="p-5 border-b flex justify-between items-center bg-slate-50/50">
                      <div>
                        <span className="font-black text-xs">#{order.id.toString().slice(-4).toUpperCase()}</span>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{order.customerName} • {order.tableNumber}</p>
                      </div>
                      <OrderTimer startTime={order.createdAt} />
                    </div>
                    <div className="p-5 flex-1 space-y-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] font-black">
                          <div className="flex items-center gap-3">
                            <span className="bg-slate-950 text-white w-6 h-6 flex items-center justify-center rounded-lg text-[10px]">{item.quantity}</span>
                            <span className="uppercase text-slate-700">{item.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 bg-slate-50">
                      <button 
                        onClick={() => updateOrderStatus(order.id, order.status)}
                        className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all ${order.status === OrderStatus.READY ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white'}`}
                      >
                        {order.status === OrderStatus.PENDING ? 'Comenzar Cocción' : order.status === OrderStatus.PREPARING ? '¡Marcar como Listo!' : 'Confirmar Entrega'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {isStaffMode && activeView === 'admin' && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
              
              {/* CONFIGURACIÓN DEL NEGOCIO */}
              <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                    <Store className="w-6 h-6 text-orange-600" />
                    <h3 className="text-xl font-black uppercase tracking-tighter italic">Personalizar <span className="text-orange-600 not-italic">Identidad</span></h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre del Restaurante</label>
                        <input 
                            type="text" 
                            placeholder={DEFAULT_BRANDING.name}
                            value={restaurantSettings.name} 
                            onChange={(e) => saveBranding(e.target.value, restaurantSettings.logoUrl)}
                            className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-slate-200 shadow-inner" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">URL del Logo (Opcional)</label>
                        <input 
                            type="text" 
                            placeholder="https://..."
                            value={restaurantSettings.logoUrl} 
                            onChange={(e) => saveBranding(restaurantSettings.name, e.target.value)}
                            className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-[10px] outline-none border-2 border-transparent focus:border-slate-200 shadow-inner" 
                        />
                    </div>
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase italic">* Los cambios se aplican instantáneamente en todos los dispositivos conectados.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[32px] border shadow-sm flex items-center gap-5">
                  <div className={`p-4 rounded-2xl ${isFirebaseEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Wifi className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400">Nube Sync</h4>
                    <p className="text-sm font-black">{isFirebaseEnabled ? 'ACTIVO' : 'LOCAL'}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border shadow-sm flex items-center gap-5">
                  <div className="p-4 rounded-2xl bg-orange-100 text-orange-600">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400">Total Menú</h4>
                    <p className="text-sm font-black">{menuItems.length} PLATOS</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border shadow-sm flex items-center gap-5">
                  <div className="p-4 rounded-2xl bg-slate-950 text-white">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400">IA Inteligente</h4>
                    <p className="text-sm font-black">{process.env.API_KEY ? 'LISTA' : 'OFFLINE'}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter italic">Gestión de <span className="text-orange-600 not-italic">Menú</span></h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Edita precios y disponibilidad</p>
                </div>
                <button onClick={() => { setEditingItem(null); setIsAdminFormOpen(true); }} className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-orange-600/20 hover:scale-105 transition-all">+ Crear Plato</button>
              </div>

              <div className="bg-white rounded-[40px] border shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                      <tr><th className="p-6">Producto</th><th className="p-6">Categoría</th><th className="p-6">Precio</th><th className="p-6 text-right">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {menuItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-6 flex items-center gap-4">
                            <img src={item.image} className="w-12 h-12 rounded-2xl object-cover shadow-sm" />
                            <span className="uppercase text-[11px] tracking-tight">{item.name}</span>
                          </td>
                          <td className="p-6">
                            <span className="text-slate-400 uppercase text-[9px] bg-slate-100 px-2 py-1 rounded-lg">{item.category}</span>
                          </td>
                          <td className="p-6 text-orange-600 font-black text-base">${item.price.toFixed(2)}</td>
                          <td className="p-6 text-right">
                            <button onClick={() => { setEditingItem(item); setIsAdminFormOpen(true); }} className="p-3 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-2xl transition-all"><Edit2 className="w-5 h-5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-slate-950 text-white flex items-center justify-around pb-safe z-50 border-t border-white/5 px-4 shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
        <MobileNavItem icon={<Home />} label="Menú" active={!isStaffMode && activeView === 'menu'} onClick={() => { setIsStaffMode(false); setActiveView('menu'); }} />
        <MobileNavItem icon={<ChefHat />} label="Cocina" active={isStaffMode && activeView === 'kitchen'} onClick={() => { setIsStaffMode(true); setActiveView('kitchen'); }} />
        <MobileNavItem icon={<Settings />} label="Panel" active={isStaffMode && activeView === 'admin'} onClick={() => isStaffMode ? setActiveView('admin') : setShowLogin(true)} />
      </nav>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[150] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[48px] p-12 text-center shadow-2xl animate-in zoom-in duration-500">
             <div className="w-20 h-20 bg-slate-100 rounded-[32px] flex items-center justify-center mx-auto mb-8 text-slate-900 shadow-inner">
                <Lock className="w-10 h-10" />
             </div>
             <h2 className="text-2xl font-black uppercase tracking-tighter mb-2 italic">Acceso <span className="text-orange-600 not-italic">Staff</span></h2>
             <p className="text-[10px] font-bold text-slate-400 uppercase mb-8">PIN: 1234</p>
             <input 
                type="password" 
                placeholder="••••" 
                maxLength={4} 
                className="w-full py-6 bg-slate-50 rounded-[28px] text-center text-4xl font-black tracking-[0.5em] outline-none border-2 border-transparent focus:border-orange-500 transition-all shadow-inner" 
                autoFocus 
                onChange={(e) => { 
                    if(e.target.value === '1234') { 
                        setIsStaffMode(true); 
                        setShowLogin(false); 
                        setActiveView('kitchen'); 
                    } 
                }} 
             />
             <button onClick={() => setShowLogin(false)} className="mt-10 text-[10px] font-black text-slate-400 hover:text-slate-950 uppercase transition-colors">Volver a la Carta</button>
          </div>
        </div>
      )}

      {/* CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
             <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                <h2 className="text-2xl font-black uppercase tracking-tighter italic">Tu <span className="text-orange-600 not-italic">Orden</span></h2>
                <button onClick={() => setIsCartOpen(false)} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"><X className="w-5 h-5" /></button>
             </div>
             <div className="flex-1 overflow-y-auto p-8 space-y-5 no-scrollbar">
                {cart.length === 0 ? (
                  <div className="py-24 text-center text-slate-200">
                    <ShoppingBasket className="w-20 h-20 mx-auto mb-6 opacity-20" />
                    <p className="font-black uppercase text-[11px] tracking-[0.2em]">El carrito está vacío</p>
                  </div>
                ) : (
                  <>
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-5 bg-white border border-slate-100 p-5 rounded-[32px] shadow-sm">
                        <img src={item.image} className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
                        <div className="flex-1">
                          <p className="text-[11px] font-black uppercase truncate text-slate-800">{item.name}</p>
                          <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl w-fit mt-3">
                              <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i).filter(i => i.quantity > 0))} className="hover:text-orange-600 transition-colors"><Minus className="w-3 h-3" /></button>
                              <span className="text-[11px] font-black w-4 text-center">{item.quantity}</span>
                              <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))} className="hover:text-orange-600 transition-colors"><Plus className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <span className="text-sm font-black text-orange-600">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-8 space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Datos de Entrega</p>
                        <input type="text" placeholder="Nombre para el pedido" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-6 bg-slate-50 rounded-[28px] outline-none font-black text-xs uppercase shadow-inner border-2 border-transparent focus:border-slate-200 transition-all" />
                        <input type="text" placeholder="Mesa / Domicilio" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full p-6 bg-slate-50 rounded-[28px] outline-none font-black text-xs uppercase shadow-inner border-2 border-transparent focus:border-slate-200 transition-all" />
                    </div>
                  </>
                )}
             </div>
             <div className="p-10 border-t bg-white pb-safe">
                <div className="flex justify-between items-end mb-10">
                  <div>
                    <span className="text-[11px] font-black uppercase text-slate-400">Total a pagar</span>
                    <span className="block text-[9px] font-bold text-slate-300 uppercase">Impuestos incluidos</span>
                  </div>
                  <span className="text-5xl font-black tracking-tighter">${cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={handlePayment} 
                  disabled={cart.length === 0 || isPaying || !customerName}
                  className={`w-full py-6 rounded-[32px] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl transition-all duration-300 active:scale-95 ${paymentSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-950 text-white disabled:opacity-30'}`}
                >
                  {isPaying ? 'Procesando...' : paymentSuccess ? '¡Pedido Enviado!' : 'Finalizar Pedido'}
                </button>
             </div>
          </div>
        </div>
      )}

      {isAdminFormOpen && (
        <AdminForm 
          item={editingItem} 
          onSave={async (itemData: any) => {
            if (isFirebaseEnabled) {
              if (itemData.id) {
                const { id, ...rest } = itemData;
                await updateDoc(doc(db, "menu", id), rest);
              } else {
                await addDoc(collection(db, "menu"), itemData);
              }
            } else {
              const updated = itemData.id ? menuItems.map(i => i.id === itemData.id ? itemData : i) : [...menuItems, { ...itemData, id: `L-${Date.now()}` }];
              setMenuItems(updated);
              localStorage.setItem('santa_menu', JSON.stringify(updated));
            }
            setIsAdminFormOpen(false);
          }} 
          onClose={() => setIsAdminFormOpen(false)} 
        />
      )}
    </div>
  );
};

// Componentes Auxiliares
const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
  <button onClick={onClick} className={`relative w-full p-5 flex items-center gap-4 rounded-3xl transition-all duration-300 group ${active ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/30' : 'text-slate-500 hover:bg-white/5'}`}>
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
    <span className="text-[11px] font-black uppercase tracking-widest text-left leading-tight truncate">{label}</span>
    {badge > 0 && <span className="absolute top-4 right-4 bg-white text-orange-600 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-xl shadow-lg animate-bounce">{badge}</span>}
  </button>
);

const MobileNavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all duration-300 ${active ? 'text-orange-500 scale-110' : 'text-slate-500 opacity-60'}`}>
    {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
    <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

const AdminForm = ({ item, onSave, onClose }: any) => {
  const [data, setData] = useState(item || { name: '', price: 0, category: 'Hamburguesas', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&h=300', description: '' });
  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[300] flex items-center justify-center p-6 overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[56px] p-8 md:p-12 shadow-2xl animate-in slide-in-from-bottom duration-500">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-8 md:mb-10 italic">{item ? 'Actualizar' : 'Crear'} <span className="text-orange-600 not-italic">Plato</span></h2>
        <div className="space-y-4 md:space-y-6">
            <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre del producto</p>
                <input type="text" placeholder="Ej: Burger Monster" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-[28px] font-black text-xs outline-none border-2 border-transparent focus:border-slate-200 transition-all shadow-inner" />
            </div>
          <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Precio ($)</p>
                  <input type="number" placeholder="0.00" value={data.price} onChange={e => setData({...data, price: parseFloat(e.target.value)})} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-[28px] font-black text-xs outline-none border-2 border-transparent focus:border-slate-200 transition-all shadow-inner" />
              </div>
              <div className="flex-1 space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Categoría</p>
                  <select value={data.category} onChange={e => setData({...data, category: e.target.value})} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-[28px] font-black text-[10px] outline-none border-2 border-transparent focus:border-slate-200 transition-all uppercase shadow-inner">
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                  </select>
              </div>
          </div>
          <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase ml-2">URL de Imagen</p>
              <input type="text" placeholder="https://..." value={data.image} onChange={e => setData({...data, image: e.target.value})} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-[28px] font-bold text-[10px] outline-none border-2 border-transparent focus:border-slate-200 transition-all shadow-inner" />
          </div>
          <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Descripción</p>
              <textarea placeholder="Ingredientes, alérgenos..." value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-[28px] font-bold text-[10px] outline-none border-2 border-transparent focus:border-slate-200 transition-all h-24 md:h-32 shadow-inner" />
          </div>
          <div className="pt-6 space-y-4">
            <button onClick={() => onSave(data)} className="w-full py-5 md:py-6 bg-orange-600 text-white rounded-[28px] font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-orange-600/30 hover:scale-[1.02] active:scale-95 transition-all">Guardar Cambios</button>
            <button onClick={onClose} className="w-full py-4 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase transition-colors">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
