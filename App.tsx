
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, ClipboardList, ChefHat, BarChart3, Sparkles, Plus, Minus, Trash2, X,
  UtensilsCrossed, Timer, ShoppingBasket, Edit2, Search, Lock, LogOut, ChevronLeft,
  ChevronRight, Settings, Store, Camera, LayoutGrid, Home, Upload, DollarSign, Wifi,
  AlertCircle, CheckCircle2, Info
} from 'lucide-react';
import { FoodItem, Order, OrderItem, OrderStatus, ViewType, PaymentStatus } from './types';
import { INITIAL_MENU, CATEGORIES } from './constants';
import { getSmartSuggestions } from './geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- CONFIGURACIÓN DE FIREBASE (Prioriza variables de entorno para Vercel) ---
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "OPCIONAL_KEY", 
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "TU_PROYECTO.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "TU_PROYECTO",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "TU_PROYECTO.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "TU_ID",
  appId: process.env.VITE_FIREBASE_APP_ID || "TU_APP_ID"
};

// --- INICIALIZACIÓN SEGURA ---
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
  console.warn("Modo offline activado (Firebase no configurado)");
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
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isAdminFormOpen, setIsAdminFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
      return () => { unsubMenu(); unsubOrders(); };
    } else {
      const savedMenu = localStorage.getItem('santa_menu');
      setMenuItems(savedMenu ? JSON.parse(savedMenu) : INITIAL_MENU);
      const savedOrders = localStorage.getItem('santa_orders');
      setOrders(savedOrders ? JSON.parse(savedOrders) : []);
    }
  }, []);

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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FAF9F6] text-slate-900 font-sans">
      
      {/* SIDEBAR DESKTOP */}
      <nav className={`hidden md:flex flex-col bg-slate-950 text-white sticky top-0 h-screen transition-all ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-orange-600 rounded-xl mx-auto flex items-center justify-center mb-2">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          {!isSidebarCollapsed && <h1 className="text-sm font-black uppercase tracking-tighter">Santa Parrilla</h1>}
        </div>
        
        <div className="flex-1 px-3 space-y-1 mt-4">
          {isStaffMode ? (
            <>
              <SidebarItem icon={<ChefHat />} label="Cocina" active={activeView === 'kitchen'} onClick={() => setActiveView('kitchen')} collapsed={isSidebarCollapsed} badge={orders.filter(o => o.status !== OrderStatus.DELIVERED).length} />
              <SidebarItem icon={<Settings />} label="Administrar" active={activeView === 'admin'} onClick={() => setActiveView('admin')} collapsed={isSidebarCollapsed} />
              <button onClick={() => { setIsStaffMode(false); setActiveView('menu'); }} className="w-full p-4 text-red-400 hover:bg-red-400/10 rounded-xl flex items-center gap-3 mt-10">
                <LogOut className="w-5 h-5" /> {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase">Salir</span>}
              </button>
            </>
          ) : (
            <>
              <SidebarItem icon={<LayoutGrid />} label="Todas" active={activeCategory === 'Todas'} onClick={() => setActiveCategory('Todas')} collapsed={isSidebarCollapsed} />
              {CATEGORIES.map(c => <SidebarItem key={c.id} icon={<span>{c.icon}</span>} label={c.id} active={activeCategory === c.id} onClick={() => setActiveCategory(c.id)} collapsed={isSidebarCollapsed} />)}
            </>
          )}
        </div>

        <div className="p-4 border-t border-white/5 flex flex-col items-center gap-2">
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isFirebaseEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
              {!isSidebarCollapsed && <span className="text-[8px] font-black text-slate-500 uppercase">{isFirebaseEnabled ? 'Sincronizado' : 'Modo Local'}</span>}
           </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col pb-20 md:pb-0">
        {/* HEADER */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b z-40 px-6 py-4 flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="text-lg font-black uppercase tracking-tight leading-none">{isStaffMode ? (activeView === 'kitchen' ? 'Monitor de Cocina' : 'Panel Admin') : 'Santa Parrilla'}</h2>
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">{isStaffMode ? 'Área de Personal' : activeCategory}</span>
          </div>
          {!isStaffMode && (
            <button onClick={() => setIsCartOpen(true)} className="bg-slate-950 text-white px-5 py-3 rounded-2xl flex items-center gap-3 relative shadow-xl active:scale-95 transition-all">
              <ShoppingBag className="w-4 h-4" />
              <span className="font-black text-sm">${cartTotal.toFixed(2)}</span>
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{cart.length}</span>}
            </button>
          )}
        </header>

        <main className="flex-1 p-4 md:p-8">
          {activeView === 'menu' && !isStaffMode && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMenu.map(item => (
                <div key={item.id} className="bg-white rounded-3xl border overflow-hidden shadow-sm flex flex-col h-full group active:scale-[0.98] transition-all">
                  <div className="h-32 md:h-48 overflow-hidden bg-slate-100 relative">
                    <img src={item.image} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-black">${item.price.toFixed(2)}</div>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-[11px] md:text-sm font-black text-slate-800 line-clamp-1 mb-1 uppercase tracking-tight">{item.name}</h3>
                    <p className="text-[9px] text-slate-400 line-clamp-2 mb-4 leading-tight">{item.description}</p>
                    <button 
                      onClick={() => {
                        setCart(prev => {
                          const ex = prev.find(i => i.id === item.id);
                          if (ex) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
                          return [...prev, { ...item, quantity: 1 }];
                        });
                      }} 
                      className="mt-auto w-full py-2 bg-slate-50 hover:bg-slate-950 hover:text-white transition-all rounded-xl font-black text-[9px] uppercase border"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isStaffMode && activeView === 'kitchen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.filter(o => o.status !== OrderStatus.DELIVERED).length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-300">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-black uppercase text-xs tracking-widest">No hay pedidos pendientes</p>
                </div>
              ) : (
                orders.filter(o => o.status !== OrderStatus.DELIVERED).map(order => (
                  <div key={order.id} className={`bg-white border-t-4 ${order.status === OrderStatus.READY ? 'border-emerald-500' : 'border-orange-500'} rounded-2xl shadow-sm overflow-hidden flex flex-col`}>
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                      <div>
                        <span className="font-black text-xs">#{order.id.toString().slice(-4).toUpperCase()}</span>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">{order.customerName} • {order.tableNumber}</p>
                      </div>
                      <OrderTimer startTime={order.createdAt} />
                    </div>
                    <div className="p-4 flex-1 space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] font-black">
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-950 text-white w-5 h-5 flex items-center justify-center rounded text-[9px]">{item.quantity}</span>
                            <span className="uppercase">{item.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 bg-slate-50">
                      <button 
                        onClick={() => updateOrderStatus(order.id, order.status)}
                        className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all ${order.status === OrderStatus.READY ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white'}`}
                      >
                        {order.status === OrderStatus.PENDING ? 'Cocinando' : order.status === OrderStatus.PREPARING ? '¡Listo!' : 'Entregar'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {isStaffMode && activeView === 'admin' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isFirebaseEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                    <Wifi className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase">Sincronización</h4>
                    <p className="text-[10px] font-bold text-slate-500">{isFirebaseEnabled ? 'En línea' : 'Modo Local'}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${process.env.API_KEY ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase">Asistente IA</h4>
                    <p className="text-[10px] font-bold text-slate-500">{process.env.API_KEY ? 'Activo' : 'Inactivo'}</p>
                  </div>
                </div>
              </div>

              {!isFirebaseEnabled && (
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex gap-4">
                  <Info className="w-6 h-6 text-blue-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-black text-blue-950 uppercase">Consejo Vercel</p>
                    <p className="text-[10px] font-medium text-blue-800 leading-relaxed">
                      Para activar la nube, añade las variables <code>VITE_FIREBASE_API_KEY</code> y <code>VITE_FIREBASE_PROJECT_ID</code> en tu panel de Vercel.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tight">Menú de Santa Parrilla</h3>
                <button onClick={() => { setEditingItem(null); setIsAdminFormOpen(true); }} className="bg-orange-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">+ Nuevo Plato</button>
              </div>

              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase">
                    <tr><th className="p-5">Plato</th><th className="p-5">Categoría</th><th className="p-5">Precio</th><th className="p-5 text-right">Editar</th></tr>
                  </thead>
                  <tbody className="divide-y font-bold">
                    {menuItems.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="p-5 flex items-center gap-3">
                          <img src={item.image} className="w-10 h-10 rounded-xl object-cover" />
                          <span className="uppercase text-[10px] tracking-tight">{item.name}</span>
                        </td>
                        <td className="p-5 text-slate-400 uppercase text-[9px]">{item.category}</td>
                        <td className="p-5 text-orange-600 font-black">${item.price.toFixed(2)}</td>
                        <td className="p-5 text-right">
                          <button onClick={() => { setEditingItem(item); setIsAdminFormOpen(true); }} className="p-2 text-slate-400 hover:text-orange-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-950 text-white flex items-center justify-around pb-safe z-50">
        <MobileNavItem icon={<Home />} label="Menú" active={!isStaffMode && activeView === 'menu'} onClick={() => { setIsStaffMode(false); setActiveView('menu'); }} />
        <MobileNavItem icon={<ChefHat />} label="Cocina" active={isStaffMode && activeView === 'kitchen'} onClick={() => { setIsStaffMode(true); setActiveView('kitchen'); }} />
        <MobileNavItem icon={isStaffMode ? <Settings /> : <Lock />} label={isStaffMode ? "Admin" : "Staff"} active={isStaffMode && activeView === 'admin'} onClick={() => isStaffMode ? setActiveView('admin') : setShowLogin(true)} />
      </nav>

      {showLogin && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 text-center animate-in zoom-in duration-300">
             <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-900"><Lock className="w-8 h-8" /></div>
             <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Acceso Staff</h2>
             <input type="password" placeholder="PIN" maxLength={4} className="w-full py-5 bg-slate-50 rounded-2xl text-center text-4xl font-black tracking-[1em] outline-none" autoFocus onChange={(e) => { if(e.target.value === '1234') { setIsStaffMode(true); setShowLogin(false); setActiveView('kitchen'); } }} />
             <button onClick={() => setShowLogin(false)} className="mt-10 text-[10px] font-black text-slate-400 uppercase">Cerrar</button>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
             <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                <h2 className="text-xl font-black uppercase tracking-tighter italic">Tu <span className="text-orange-600 not-italic">Orden</span></h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 bg-white rounded-full shadow-sm border"><X className="w-5 h-5" /></button>
             </div>
             <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {cart.length === 0 ? (
                  <div className="py-20 text-center text-slate-300">
                    <ShoppingBasket className="w-16 h-16 mx-auto mb-4 opacity-10" />
                    <p className="font-black uppercase text-[10px] tracking-widest">Nada por aquí aún</p>
                  </div>
                ) : (
                  <>
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-4 bg-white border p-4 rounded-3xl">
                        <img src={item.image} className="w-14 h-14 rounded-2xl object-cover" />
                        <div className="flex-1">
                          <p className="text-[10px] font-black uppercase truncate">{item.name}</p>
                          <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-xl w-fit mt-2">
                              <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i).filter(i => i.quantity > 0))}><Minus className="w-3 h-3" /></button>
                              <span className="text-[10px] font-black">{item.quantity}</span>
                              <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}><Plus className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <span className="text-xs font-black text-orange-600">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-6 space-y-4">
                        <input type="text" placeholder="Tu Nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-black text-xs uppercase" />
                        <input type="text" placeholder="Mesa / Dirección" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-black text-xs uppercase" />
                    </div>
                  </>
                )}
             </div>
             <div className="p-8 border-t bg-white">
                <div className="flex justify-between items-end mb-8">
                  <span className="text-[10px] font-black uppercase text-slate-400">Total</span>
                  <span className="text-4xl font-black tracking-tighter">${cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={handlePayment} 
                  disabled={cart.length === 0 || isPaying || !customerName}
                  className={`w-full py-5 rounded-[20px] font-black text-xs uppercase tracking-widest shadow-2xl transition-all ${paymentSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-950 text-white disabled:opacity-20'}`}
                >
                  {isPaying ? 'Enviando...' : paymentSuccess ? '¡Listo!' : 'Pedir Ahora'}
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

const SidebarItem = ({ icon, label, active, onClick, collapsed, badge }: any) => (
  <button onClick={onClick} className={`relative w-full p-4 flex items-center ${collapsed ? 'justify-center' : 'gap-4'} rounded-2xl transition-all ${active ? 'bg-orange-600 text-white shadow-xl' : 'text-slate-500 hover:bg-white/5'}`}>
    {icon}
    {!collapsed && <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>}
    {badge > 0 && <span className="absolute top-3 right-3 bg-red-600 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full">{badge}</span>}
  </button>
);

const MobileNavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'text-orange-500' : 'text-slate-500 opacity-60'}`}>
    {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
    <span className="text-[8px] font-black uppercase">{label}</span>
  </button>
);

const AdminForm = ({ item, onSave, onClose }: any) => {
  const [data, setData] = useState(item || { name: '', price: 0, category: 'Hamburguesas', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&h=300', description: '' });
  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[110] flex items-center justify-center p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-[40px] p-10 shadow-2xl animate-in slide-in-from-bottom">
        <h2 className="text-2xl font-black uppercase tracking-tighter mb-8">{item ? 'Actualizar' : 'Nuevo'} Plato</h2>
        <div className="space-y-5">
            <input type="text" placeholder="Nombre" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs outline-none" />
          <div className="flex gap-4">
              <input type="number" placeholder="Precio" value={data.price} onChange={e => setData({...data, price: parseFloat(e.target.value)})} className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs outline-none" />
              <select value={data.category} onChange={e => setData({...data, category: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl font-black text-[10px] outline-none uppercase">
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
              </select>
          </div>
          <input type="text" placeholder="URL de la Imagen" value={data.image} onChange={e => setData({...data, image: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-[10px] outline-none" />
          <textarea placeholder="Descripción" value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-[10px] outline-none h-24" />
          <div className="pt-4 space-y-3">
            <button onClick={() => onSave(data)} className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs">Guardar</button>
            <button onClick={onClose} className="w-full py-4 text-[10px] font-black text-slate-400 uppercase">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
