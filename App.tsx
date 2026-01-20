
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, ClipboardList, ChefHat, Sparkles, Plus, Minus, X,
  UtensilsCrossed, Timer, ShoppingBasket, Edit2, Lock, LogOut, 
  Settings, Store, LayoutGrid, Home, Wifi, Database, Menu as MenuIcon
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { FoodItem, Order, OrderItem, OrderStatus, ViewType, PaymentStatus } from './types';
import { INITIAL_MENU, CATEGORIES, DEFAULT_BRANDING } from './constants';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "TU_API_KEY_AQUI", 
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "tu-proyecto.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "tu-proyecto",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "tu-proyecto.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "0000000000",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:0000:web:0000"
};

let db: any = null;
let isFirebaseEnabled = false;

try {
  if (firebaseConfig.projectId !== "tu-proyecto" && firebaseConfig.apiKey !== "TU_API_KEY_AQUI") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isFirebaseEnabled = true;
  }
} catch (e) {
  console.warn("Modo local activado.");
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
          setRestaurantSettings(snapshot.data() as any);
        }
      });
      return () => { unsubMenu(); unsubOrders(); unsubSettings(); };
    } else {
      const savedMenu = localStorage.getItem('santa_menu');
      setMenuItems(savedMenu ? JSON.parse(savedMenu) : INITIAL_MENU);
      const savedOrders = localStorage.getItem('santa_orders');
      setOrders(savedOrders ? JSON.parse(savedOrders) : []);
      const savedSettings = localStorage.getItem('santa_settings');
      if (savedSettings) setRestaurantSettings(JSON.parse(savedSettings));
    }
  }, []);

  const saveBranding = async (newName: string, newLogo: string) => {
    const newSettings = { name: newName || restaurantSettings.name, logoUrl: newLogo || restaurantSettings.logoUrl };
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
            {restaurantSettings.logoUrl ? <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" /> : <UtensilsCrossed className="w-8 h-8" />}
          </div>
          <h1 className="text-sm font-black uppercase tracking-widest truncate px-2">{restaurantSettings.name}</h1>
          <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">Sincronización Cloud</p>
        </div>
        
        <div className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto no-scrollbar">
          {isStaffMode ? (
            <>
              <SidebarItem icon={<ChefHat />} label="Cocina" active={activeView === 'kitchen'} onClick={() => setActiveView('kitchen')} badge={orders.filter(o => o.status !== OrderStatus.DELIVERED).length} />
              <SidebarItem icon={<Settings />} label="Administrar" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />
              <div className="pt-10">
                <button onClick={() => { setIsStaffMode(false); setActiveView('menu'); }} className="w-full p-4 text-red-400 hover:bg-red-400/10 rounded-2xl flex items-center gap-3 transition-colors">
                  <LogOut className="w-5 h-5" /> <span className="text-[10px] font-black uppercase">Salir Modo Staff</span>
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

      {/* MOBILE DRAWER (BARRA LATERAL MÓVIL) */}
      <div className={`fixed inset-0 z-[100] md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className={`absolute top-0 left-0 h-full w-[280px] bg-slate-950 text-white p-8 transition-transform duration-300 transform shadow-2xl ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center overflow-hidden">
                          {restaurantSettings.logoUrl ? <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" /> : <UtensilsCrossed className="w-5 h-5" />}
                      </div>
                      <span className="font-black text-xs uppercase tracking-widest truncate">{restaurantSettings.name}</span>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-4">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Menú</p>
                  <SidebarItem icon={<LayoutGrid />} label="Todas" active={activeCategory === 'Todas'} onClick={() => { setActiveCategory('Todas'); setIsMobileMenuOpen(false); }} />
                  {CATEGORIES.map(c => (
                    <SidebarItem key={c.id} icon={<span>{c.icon}</span>} label={c.id} active={activeCategory === c.id} onClick={() => { setActiveCategory(c.id); setIsMobileMenuOpen(false); }} />
                  ))}
                  
                  {/* El botón de acceso staff ahora está más oculto al final del menú lateral */}
                  <div className="pt-10 border-t border-white/10 mt-6 opacity-40">
                    <button onClick={() => { setIsMobileMenuOpen(false); setShowLogin(true); }} className="w-full p-4 bg-white/5 rounded-2xl flex items-center gap-4 text-white font-black text-[10px] uppercase">
                        <Lock className="w-4 h-4" /> Configuración
                    </button>
                  </div>
              </div>
          </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b z-40 px-6 py-4 flex justify-between items-center shadow-sm pt-safe">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2.5 bg-slate-100 rounded-xl text-slate-600 active:scale-90 transition-all">
                <MenuIcon className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
                <h2 className="text-sm md:text-lg font-black uppercase tracking-tight leading-none truncate max-w-[140px] md:max-w-none">
                    {isStaffMode ? (activeView === 'kitchen' ? 'Cocina' : 'Admin') : restaurantSettings.name}
                </h2>
                {!isStaffMode && <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest mt-1">{activeCategory}</span>}
            </div>
          </div>
          {!isStaffMode && (
            <button onClick={() => setIsCartOpen(true)} className="bg-slate-950 text-white px-5 py-2.5 rounded-2xl flex items-center gap-3 relative shadow-xl active:scale-95 transition-all">
              <ShoppingBag className="w-4 h-4" />
              <span className="font-black text-xs md:text-sm">${cartTotal.toFixed(2)}</span>
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{cart.length}</span>}
            </button>
          )}
          {isStaffMode && (
            <button onClick={() => { setIsStaffMode(false); setActiveView('menu'); }} className="md:hidden p-2.5 bg-red-50 text-red-600 rounded-xl active:scale-90 transition-all">
              <LogOut className="w-6 h-6" />
            </button>
          )}
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-32 md:pb-8">
          {activeView === 'menu' && !isStaffMode && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredMenu.map(item => (
                <div key={item.id} className="bg-white rounded-3xl border overflow-hidden shadow-sm flex flex-col h-full group active:scale-[0.98] transition-all duration-300">
                  <div className="h-32 md:h-52 overflow-hidden bg-slate-100 relative">
                    <img src={item.image} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-white/95 backdrop-blur px-2.5 py-1 rounded-xl text-[10px] font-black shadow-sm text-slate-900">${item.price.toFixed(2)}</div>
                  </div>
                  <div className="p-3 md:p-5 flex flex-col flex-1">
                    <h3 className="text-[11px] md:text-sm font-black text-slate-800 line-clamp-1 mb-1 uppercase tracking-tight">{item.name}</h3>
                    <p className="text-[8px] md:text-[10px] text-slate-400 line-clamp-2 mb-3 leading-relaxed h-6 md:h-8">{item.description}</p>
                    <button 
                      onClick={() => {
                        setCart(prev => {
                          const ex = prev.find(i => i.id === item.id);
                          if (ex) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
                          return [...prev, { ...item, quantity: 1 }];
                        });
                      }} 
                      className="mt-auto w-full py-2.5 bg-slate-50 hover:bg-slate-950 hover:text-white transition-all rounded-xl font-black text-[9px] uppercase border border-slate-100"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isStaffMode && activeView === 'kitchen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
              {orders.filter(o => o.status !== OrderStatus.DELIVERED).length === 0 ? (
                <div className="col-span-full py-32 text-center text-slate-300">
                  <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-10" />
                  <p className="font-black uppercase text-xs tracking-widest opacity-40">Esperando pedidos...</p>
                </div>
              ) : (
                orders.filter(o => o.status !== OrderStatus.DELIVERED).map(order => (
                  <div key={order.id} className={`bg-white border-t-4 ${order.status === OrderStatus.READY ? 'border-emerald-500' : 'border-orange-500'} rounded-3xl shadow-md overflow-hidden flex flex-col animate-slide-in`}>
                    <div className="p-5 border-b flex justify-between items-center bg-slate-50/50">
                      <div>
                        <span className="font-black text-[10px] text-slate-400">#{order.id.toString().slice(-4).toUpperCase()}</span>
                        <p className="text-[10px] font-bold text-slate-700 uppercase">{order.customerName} • {order.tableNumber}</p>
                      </div>
                      <OrderTimer startTime={order.createdAt} />
                    </div>
                    <div className="p-5 flex-1 space-y-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-[11px] font-black">
                          <span className="bg-slate-950 text-white w-6 h-6 flex items-center justify-center rounded-lg text-[9px]">{item.quantity}</span>
                          <span className="uppercase text-slate-700 truncate">{item.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 bg-slate-50">
                      <button 
                        onClick={() => updateOrderStatus(order.id, order.status)}
                        className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all ${order.status === OrderStatus.READY ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white'}`}
                      >
                        {order.status === OrderStatus.PENDING ? 'Cocinando' : order.status === OrderStatus.PREPARING ? 'Listo' : 'Entregar'}
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
                    <h3 className="text-xl font-black uppercase tracking-tighter italic">Identidad del <span className="text-orange-600 not-italic">Negocio</span></h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre Comercial</label>
                        <input 
                            type="text" 
                            value={restaurantSettings.name} 
                            onChange={(e) => saveBranding(e.target.value, restaurantSettings.logoUrl)}
                            className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-slate-200 shadow-inner" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">URL del Logo</label>
                        <input 
                            type="text" 
                            placeholder="https://..."
                            value={restaurantSettings.logoUrl} 
                            onChange={(e) => saveBranding(restaurantSettings.name, e.target.value)}
                            className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-[10px] outline-none border-2 border-transparent focus:border-slate-200 shadow-inner" 
                        />
                    </div>
                </div>
              </div>

              <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter italic">Carta de <span className="text-orange-600 not-italic">Productos</span></h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Administra tu menú</p>
                </div>
                <button onClick={() => { setEditingItem(null); setIsAdminFormOpen(true); }} className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-orange-600/20 active:scale-95 transition-all">+ Añadir Plato</button>
              </div>

              <div className="bg-white rounded-[40px] border shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                      <tr><th className="p-6">Ítem</th><th className="p-6">Categoría</th><th className="p-6">Precio</th><th className="p-6 text-right">Acción</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {menuItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-6 flex items-center gap-4">
                            <img src={item.image} className="w-12 h-12 rounded-2xl object-cover shadow-sm" />
                            <span className="uppercase text-[11px] tracking-tight">{item.name}</span>
                          </td>
                          <td className="p-6">
                            <span className="text-slate-400 uppercase text-[9px] bg-slate-100 px-2 py-1 rounded-lg">{item.category}</span>
                          </td>
                          <td className="p-6 text-orange-600 font-black text-sm">${item.price.toFixed(2)}</td>
                          <td className="p-6 text-right">
                            <button onClick={() => { setEditingItem(item); setIsAdminFormOpen(true); }} className="p-3 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-2xl transition-all"><Edit2 className="w-4 h-4" /></button>
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

      {/* MOBILE BOTTOM NAV - SOLO SE MUESTRA SI ES STAFF */}
      {isStaffMode && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-slate-950 text-white flex items-center justify-around pb-safe z-50 border-t border-white/5 px-4 shadow-2xl">
          <MobileNavItem icon={<Home />} label="Ver Menú" active={activeView === 'menu'} onClick={() => setActiveView('menu')} />
          <MobileNavItem icon={<ChefHat />} label="Cocina" active={activeView === 'kitchen'} onClick={() => setActiveView('kitchen')} />
          <MobileNavItem icon={<Settings />} label="Admin" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />
        </nav>
      )}

      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[150] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[48px] p-10 text-center shadow-2xl animate-in zoom-in duration-300">
             <div className="w-16 h-16 bg-slate-100 rounded-[24px] flex items-center justify-center mx-auto mb-6 text-slate-900 shadow-inner">
                <Lock className="w-8 h-8" />
             </div>
             <h2 className="text-xl font-black uppercase tracking-tighter mb-2 italic">Acceso <span className="text-orange-600 not-italic">Restringido</span></h2>
             <p className="text-[9px] font-bold text-slate-400 uppercase mb-8">PIN: 1234</p>
             <input 
                type="password" 
                placeholder="••••" 
                maxLength={4} 
                className="w-full py-5 bg-slate-50 rounded-[24px] text-center text-3xl font-black tracking-[0.5em] outline-none border-2 border-transparent focus:border-orange-500 transition-all shadow-inner" 
                autoFocus 
                onChange={(e) => { 
                    if(e.target.value === '1234') { 
                        setIsStaffMode(true); 
                        setShowLogin(false); 
                        setActiveView('kitchen'); 
                    } 
                }} 
             />
             <button onClick={() => setShowLogin(false)} className="mt-8 text-[9px] font-black text-slate-400 hover:text-slate-950 uppercase transition-colors">Volver a la Carta</button>
          </div>
        </div>
      )}

      {/* CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
             <div className="p-8 border-b flex justify-between items-center bg-slate-50/50 pt-safe">
                <h2 className="text-xl font-black uppercase tracking-tighter italic">Tu <span className="text-orange-600 not-italic">Pedido</span></h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100"><X className="w-5 h-5" /></button>
             </div>
             <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {cart.length === 0 ? (
                  <div className="py-24 text-center text-slate-200">
                    <ShoppingBasket className="w-16 h-16 mx-auto mb-4 opacity-10" />
                    <p className="font-black uppercase text-[10px] tracking-widest opacity-40">El carrito está vacío</p>
                  </div>
                ) : (
                  <>
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-4 bg-white border border-slate-100 p-4 rounded-3xl shadow-sm">
                        <img src={item.image} className="w-14 h-14 rounded-xl object-cover" />
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase truncate text-slate-800">{item.name}</p>
                          <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg w-fit mt-2">
                              <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i).filter(i => i.quantity > 0))}><Minus className="w-3 h-3" /></button>
                              <span className="text-[10px] font-black w-4 text-center">{item.quantity}</span>
                              <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}><Plus className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <span className="text-xs font-black text-orange-600">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-6 space-y-4">
                        <input type="text" placeholder="Tu Nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-black text-[11px] uppercase shadow-inner border border-slate-100" />
                        <input type="text" placeholder="Mesa o Dirección" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-black text-[11px] uppercase shadow-inner border border-slate-100" />
                    </div>
                  </>
                )}
             </div>
             <div className="p-8 border-t bg-white pb-safe">
                <div className="flex justify-between items-end mb-8">
                  <span className="text-[11px] font-black uppercase text-slate-400">Total Final</span>
                  <span className="text-4xl font-black tracking-tighter">${cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={handlePayment} 
                  disabled={cart.length === 0 || isPaying || !customerName}
                  className={`w-full py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all duration-300 active:scale-95 ${paymentSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-950 text-white disabled:opacity-30'}`}
                >
                  {isPaying ? 'Procesando...' : paymentSuccess ? '¡Enviado!' : 'Confirmar Pedido'}
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
  <button onClick={onClick} className={`relative w-full p-4 flex items-center gap-4 rounded-2xl transition-all duration-300 group ${active ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-500 hover:bg-white/5'}`}>
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest text-left leading-tight truncate">{label}</span>
    {badge > 0 && <span className="absolute top-3 right-3 bg-white text-orange-600 text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-lg shadow-lg">{badge}</span>}
  </button>
);

const MobileNavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${active ? 'text-orange-500 scale-105' : 'text-slate-500 opacity-60'}`}>
    {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
    <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

const AdminForm = ({ item, onSave, onClose }: any) => {
  const [data, setData] = useState(item || { name: '', price: 0, category: 'Hamburguesas', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&h=300', description: '' });
  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[300] flex items-center justify-center p-6 overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[48px] p-8 md:p-12 shadow-2xl animate-in slide-in-from-bottom duration-500">
        <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 italic">{item ? 'Actualizar' : 'Crear'} <span className="text-orange-600 not-italic">Ítem</span></h2>
        <div className="space-y-4">
            <input type="text" placeholder="Nombre" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[20px] font-black text-xs outline-none border border-slate-100 shadow-inner" />
          <div className="flex gap-4">
              <input type="number" placeholder="Precio" value={data.price} onChange={e => setData({...data, price: parseFloat(e.target.value)})} className="w-full p-5 bg-slate-50 rounded-[20px] font-black text-xs outline-none border border-slate-100 shadow-inner" />
              <select value={data.category} onChange={e => setData({...data, category: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[20px] font-black text-[10px] outline-none border border-slate-100 uppercase shadow-inner">
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
              </select>
          </div>
          <input type="text" placeholder="URL Imagen" value={data.image} onChange={e => setData({...data, image: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[20px] font-bold text-[10px] outline-none border border-slate-100 shadow-inner" />
          <textarea placeholder="Descripción..." value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[20px] font-bold text-[10px] outline-none border border-slate-100 h-24 shadow-inner" />
          <div className="pt-6 space-y-3">
            <button onClick={() => onSave(data)} className="w-full py-5 bg-orange-600 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Guardar</button>
            <button onClick={onClose} className="w-full py-4 text-[9px] font-black text-slate-400 uppercase">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
