
import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, ClipboardList, ChefHat, Plus, Minus, X,
  UtensilsCrossed, Timer, ShoppingBasket, Edit2, Lock, LogOut, 
  Settings, Store, LayoutGrid, Home, Sparkles, TrendingUp, AlertCircle
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { FoodItem, Order, OrderItem, OrderStatus, ViewType, PaymentStatus } from './types';
import { INITIAL_MENU, CATEGORIES, DEFAULT_BRANDING } from './constants';
import { getSmartSuggestions, generateUpsellSuggestion } from './geminiService';

// Reemplaza estas constantes con tus valores de Supabase si no usas variables de entorno
const SUPABASE_URL = (window as any).env?.VITE_SUPABASE_URL || "https://tu-proyecto.supabase.co";
const SUPABASE_ANON_KEY = (window as any).env?.VITE_SUPABASE_ANON_KEY || "tu-key-anonima";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const OrderTimer: React.FC<{ startTime: any }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    // Manejar tanto números como strings ISO de Supabase
    const start = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 60000)), 10000);
    setElapsed(Math.floor((Date.now() - start) / 60000));
    return () => clearInterval(interval);
  }, [startTime]);
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-colors ${elapsed > 20 ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
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
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [upsellHint, setUpsellHint] = useState<string | null>(null);
  const [clickCount, setClickCount] = useState(0);

  const fetchData = async () => {
    const { data: menuData } = await supabase.from('menu').select('*');
    if (menuData) setMenuItems(menuData);
    else if (menuItems.length === 0) setMenuItems(INITIAL_MENU);

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .neq('status', OrderStatus.DELIVERED)
      .order('createdAt', { ascending: false });
    if (ordersData) setOrders(ordersData);

    const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'branding').single();
    if (settingsData) setRestaurantSettings(settingsData);
  };

  useEffect(() => {
    fetchData();

    const menuSub = supabase.channel('menu-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, fetchData).subscribe();
    const orderSub = supabase.channel('orders-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData).subscribe();
    const settingsSub = supabase.channel('settings-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, fetchData).subscribe();

    return () => {
      supabase.removeChannel(menuSub);
      supabase.removeChannel(orderSub);
      supabase.removeChannel(settingsSub);
    };
  }, []);

  // Analizar con IA cuando entramos al panel de administración
  useEffect(() => {
    if (isStaffMode && activeView === 'admin' && orders.length > 0) {
      getSmartSuggestions(menuItems, orders).then(setAiSuggestions);
    }
  }, [isStaffMode, activeView]);

  const handleSecretClick = () => {
    setClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setShowLogin(true);
        return 0;
      }
      return next;
    });
    const timer = setTimeout(() => setClickCount(0), 1500);
    return () => clearTimeout(timer);
  };

  const addToCart = async (item: FoodItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
    
    // IA Sugiere un acompañamiento si el carrito tiene pocos items
    if (cart.length < 2) {
      const suggestion = await generateUpsellSuggestion([item]);
      setUpsellHint(suggestion);
      setTimeout(() => setUpsellHint(null), 8000);
    }
  };

  const handlePayment = async () => {
    if (!customerName) return alert("Nombre requerido");
    setIsPaying(true);
    const newOrder = {
      items: cart,
      total: cartTotal,
      status: OrderStatus.PENDING,
      customerName,
      tableNumber: tableNumber || 'Llevar',
      createdAt: new Date().toISOString()
    };
    const { error } = await supabase.from('orders').insert([newOrder]);
    if (!error) {
      setCart([]);
      setPaymentSuccess(true);
      setTimeout(() => { setPaymentSuccess(false); setIsCartOpen(false); }, 2000);
    }
    setIsPaying(false);
  };

  const updateStatus = async (id: string, current: OrderStatus) => {
    const sequence = [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.DELIVERED];
    const next = sequence[sequence.indexOf(current) + 1] || current;
    await supabase.from('orders').update({ status: next }).eq('id', id);
  };

  // Fix for "Cannot find name 'saveBranding'": Implement the saveBranding function.
  const saveBranding = async (name: string, logoUrl: string) => {
    const newSettings = { name, logoUrl };
    setRestaurantSettings(newSettings);
    await supabase.from('settings').upsert({ id: 'branding', ...newSettings });
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const filteredMenu = activeCategory === 'Todas' ? menuItems : menuItems.filter(i => i.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col bg-slate-950 text-white w-64 h-screen sticky top-0 border-r border-white/5 shrink-0 overflow-y-auto no-scrollbar">
        <div className="p-10 text-center">
          <div onClick={handleSecretClick} className={`w-20 h-20 bg-orange-600 rounded-[2rem] mx-auto flex items-center justify-center mb-4 shadow-2xl shadow-orange-600/20 overflow-hidden cursor-default transition-transform active:scale-90 ${clickCount > 0 ? 'scale-95 border-2 border-white/20' : ''}`}>
            {restaurantSettings.logoUrl ? <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" /> : <UtensilsCrossed className="w-10 h-10" />}
          </div>
          <h1 className="text-xs font-black uppercase tracking-[0.2em] opacity-90 truncate">{restaurantSettings.name}</h1>
          <div className="mt-2 flex items-center justify-center gap-2">
             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
             <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Cloud Sync Active</span>
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-3">
          {isStaffMode ? (
            <>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2 px-4">Operaciones</p>
              <SidebarItem icon={<ChefHat />} label="Cocina" active={activeView === 'kitchen'} onClick={() => setActiveView('kitchen')} badge={orders.length} />
              <SidebarItem icon={<Settings />} label="Menú" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />
              <SidebarItem icon={<TrendingUp />} label="IA Insights" active={activeView === 'stats'} onClick={() => setActiveView('stats')} />
              <button onClick={() => { setIsStaffMode(false); setActiveView('menu'); }} className="w-full mt-10 p-4 text-red-400 hover:bg-red-400/10 rounded-2xl flex items-center gap-3 transition-all font-black text-[10px] uppercase">
                <LogOut className="w-4 h-4" /> Salir
              </button>
            </>
          ) : (
            <>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2 px-4">La Carta</p>
              <SidebarItem icon={<LayoutGrid />} label="Todas" active={activeCategory === 'Todas'} onClick={() => setActiveCategory('Todas')} />
              {CATEGORIES.map(c => <SidebarItem key={c.id} icon={<span>{c.icon}</span>} label={c.id} active={activeCategory === c.id} onClick={() => setActiveCategory(c.id)} />)}
            </>
          )}
        </nav>
      </aside>

      {/* MOBILE DRAWER */}
      <div className={`fixed inset-0 z-[100] md:hidden transition-all duration-500 ${isMobileMenuOpen ? 'visible' : 'invisible'}`}>
          <div className={`absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity duration-500 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsMobileMenuOpen(false)} />
          <div className={`absolute top-0 left-0 h-full w-[80%] max-w-[300px] bg-slate-950 p-8 shadow-2xl transition-transform duration-500 ease-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="flex justify-between items-center mb-10">
                  <span className="text-white font-black text-[10px] uppercase tracking-widest">{restaurantSettings.name}</span>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 p-2"><X /></button>
              </div>
              <div className="space-y-4">
                  <SidebarItem icon={<LayoutGrid />} label="Todas" active={activeCategory === 'Todas'} onClick={() => { setActiveCategory('Todas'); setIsMobileMenuOpen(false); }} />
                  {CATEGORIES.map(c => <SidebarItem key={c.id} icon={<span>{c.icon}</span>} label={c.id} active={activeCategory === c.id} onClick={() => { setActiveCategory(c.id); setIsMobileMenuOpen(false); }} />)}
              </div>
          </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[#FAF9F6]">
        {/* HEADER */}
        <header className="sticky top-0 bg-white/70 backdrop-blur-xl border-b z-40 px-6 py-4 flex justify-between items-center pt-safe">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2.5 bg-slate-100 rounded-xl active:scale-90 transition-transform">
                <LayoutGrid className="w-6 h-6" />
            </button>
            <div onClick={handleSecretClick} className="flex flex-col cursor-default select-none active:opacity-50">
                <h2 className="text-sm md:text-xl font-black uppercase tracking-tight italic">
                    {isStaffMode ? (activeView === 'kitchen' ? 'Cocina' : activeView === 'admin' ? 'Inventario' : 'Reportes IA') : restaurantSettings.name}
                </h2>
                {!isStaffMode && <span className="text-[9px] font-black text-orange-600 uppercase tracking-[0.2em]">{activeCategory}</span>}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {!isStaffMode && (
              <button onClick={() => setIsCartOpen(true)} className="bg-slate-950 text-white px-5 py-3 rounded-2xl flex items-center gap-3 relative shadow-xl active:scale-95 transition-all">
                <ShoppingBag className="w-4 h-4" />
                <span className="font-black text-xs">${cartTotal.toFixed(2)}</span>
                {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce">{cart.length}</span>}
              </button>
            )}
            {isStaffMode && (
              <button onClick={() => { setIsStaffMode(false); setActiveView('menu'); }} className="md:hidden p-3 bg-red-50 text-red-600 rounded-2xl active:scale-90">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 p-4 md:p-10 max-w-6xl mx-auto w-full pb-32">
          {activeView === 'menu' && !isStaffMode && (
            <>
              {upsellHint && (
                <div className="mb-6 bg-orange-600 text-white p-5 rounded-[2rem] shadow-xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                  <div className="bg-white/20 p-3 rounded-2xl"><Sparkles className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Tip del Chef</p>
                    <p className="text-[11px] font-bold leading-tight italic">"{upsellHint}"</p>
                  </div>
                  <button onClick={() => setUpsellHint(null)}><X className="w-4 h-4 opacity-50" /></button>
                </div>
              )}
              
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                {filteredMenu.map(item => (
                  <div key={item.id} className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm flex flex-col group active:scale-[0.97] transition-all duration-300">
                    <div className="h-32 md:h-64 overflow-hidden relative">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-2xl text-[11px] font-black shadow-lg text-slate-900 border border-slate-100">${item.price.toFixed(2)}</div>
                    </div>
                    <div className="p-4 md:p-8 flex flex-col flex-1">
                      <h3 className="text-xs md:text-base font-black text-slate-900 line-clamp-1 mb-2 uppercase italic tracking-tighter">{item.name}</h3>
                      <p className="text-[9px] md:text-[11px] text-slate-400 line-clamp-2 mb-6 font-medium leading-relaxed">{item.description}</p>
                      <button 
                        onClick={() => addToCart(item)} 
                        className="mt-auto w-full py-3.5 bg-slate-50 group-hover:bg-slate-950 group-hover:text-white transition-all rounded-[1.5rem] font-black text-[10px] uppercase border border-slate-100"
                      >
                        Añadir al Plato
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {isStaffMode && activeView === 'kitchen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
              {orders.length === 0 ? (
                <div className="col-span-full py-40 text-center opacity-20">
                  <ShoppingBasket className="w-20 h-20 mx-auto mb-6" />
                  <p className="font-black uppercase text-xs tracking-[0.4em]">Sin comandas pendientes</p>
                </div>
              ) : (
                orders.map(order => (
                  <div key={order.id} className="bg-white border-2 border-slate-100 rounded-[3rem] shadow-xl overflow-hidden flex flex-col animate-slide-in hover:border-orange-200 transition-colors">
                    <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                      <div>
                        <span className="font-black text-[9px] text-slate-400 tracking-widest uppercase">Mesa {order.tableNumber}</span>
                        <p className="text-[11px] font-black text-slate-800 uppercase italic mt-0.5">{order.customerName}</p>
                      </div>
                      <OrderTimer startTime={order.createdAt} />
                    </div>
                    <div className="p-6 flex-1 space-y-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-[11px] font-black">
                          <span className="bg-orange-600 text-white w-7 h-7 flex items-center justify-center rounded-xl text-[10px] shadow-lg shadow-orange-600/30">{item.quantity}</span>
                          <span className="uppercase text-slate-700 truncate">{item.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 pt-0">
                      <button 
                        onClick={() => updateStatus(order.id, order.status)}
                        className={`w-full py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 ${order.status === OrderStatus.READY ? 'bg-emerald-600 text-white shadow-emerald-600/20' : 'bg-slate-950 text-white'}`}
                      >
                        {order.status === OrderStatus.PENDING ? 'Cocinando' : order.status === OrderStatus.PREPARING ? 'Listo para Entrega' : 'Entregado ✓'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {isStaffMode && activeView === 'stats' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
               <div className="flex items-center gap-4 border-b pb-6">
                  <div className="p-4 bg-orange-600 rounded-[2rem] text-white shadow-xl shadow-orange-600/30"><TrendingUp className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">Gemini <span className="text-orange-600 not-italic">Insights</span></h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Análisis estratégico en tiempo real</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {aiSuggestions.length > 0 ? aiSuggestions.map((s, i) => (
                    <div key={i} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all group">
                        <div className={`w-fit px-3 py-1 rounded-full text-[8px] font-black uppercase mb-4 ${s.impact === 'Alta' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>Impacto {s.impact}</div>
                        <h4 className="text-sm font-black uppercase italic mb-3 text-slate-800 tracking-tight leading-tight group-hover:text-orange-600 transition-colors">{s.title}</h4>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{s.description}</p>
                    </div>
                  )) : (
                    <div className="col-span-full py-20 text-center animate-pulse">
                        <Sparkles className="w-12 h-12 text-orange-600 mx-auto mb-4 opacity-50" />
                        <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Generando análisis inteligente...</p>
                    </div>
                  )}
               </div>
            </div>
          )}

          {isStaffMode && activeView === 'admin' && (
            <div className="space-y-10 pb-20 animate-in fade-in">
                {/* CONFIGURACIÓN BRANDING */}
                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl">
                    <div className="flex items-center gap-3 mb-8">
                        <Store className="w-6 h-6 text-orange-600" />
                        <h4 className="text-xl font-black italic uppercase tracking-tighter">Branding del Local</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Comercial</label>
                            <input type="text" value={restaurantSettings.name} onChange={e => saveBranding(e.target.value, restaurantSettings.logoUrl)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-xs outline-none border-2 border-transparent focus:border-slate-200" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">URL del Logotipo</label>
                            <input type="text" value={restaurantSettings.logoUrl} onChange={e => saveBranding(restaurantSettings.name, e.target.value)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-bold text-[10px] outline-none border-2 border-transparent focus:border-slate-200" />
                        </div>
                    </div>
                </div>

                {/* GESTIÓN DE PRODUCTOS */}
                <div className="flex justify-between items-center px-4">
                    <h4 className="text-xl font-black italic uppercase tracking-tighter">Carta de <span className="text-orange-600 not-italic">Platos</span></h4>
                    <button onClick={() => { setEditingItem(null); setIsAdminFormOpen(true); }} className="bg-slate-950 text-white px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">Añadir Nuevo</button>
                </div>

                <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b">
                            <tr><th className="p-8">Plato</th><th className="p-8">Precio</th><th className="p-8 text-right">Editar</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {menuItems.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-8 flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden shadow-md">
                                            <img src={item.image} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <span className="text-sm font-black uppercase italic text-slate-800 tracking-tight">{item.name}</span>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.category}</p>
                                        </div>
                                    </td>
                                    <td className="p-8 text-orange-600 font-black text-base italic">${item.price.toFixed(2)}</td>
                                    <td className="p-8 text-right">
                                        <button onClick={() => { setEditingItem(item); setIsAdminFormOpen(true); }} className="p-4 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all active:scale-90"><Edit2 className="w-4 h-4" /></button>
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

      {/* NAV MÓVIL (SOLO STAFF) */}
      {isStaffMode && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-slate-950 text-white flex items-center justify-around pb-safe z-50 border-t border-white/5 px-4 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
          <MobileNavItem icon={<ChefHat />} label="Cocina" active={activeView === 'kitchen'} onClick={() => setActiveView('kitchen')} />
          <MobileNavItem icon={<TrendingUp />} label="IA" active={activeView === 'stats'} onClick={() => setActiveView('stats')} />
          <MobileNavItem icon={<Settings />} label="Menú" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />
        </nav>
      )}

      {/* MODAL LOGIN */}
      {showLogin && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[150] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-12 text-center shadow-2xl animate-in zoom-in-95 duration-500">
             <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-slate-950 shadow-inner">
                <Lock className="w-10 h-10" />
             </div>
             <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-4">Panel <span className="text-orange-600 not-italic">Staff</span></h2>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Acceso restringido</p>
             <input 
                type="password" 
                placeholder="••••" 
                maxLength={4} 
                className="w-full py-6 bg-slate-50 rounded-[1.5rem] text-center text-4xl font-black tracking-[0.6em] outline-none border-2 border-transparent focus:border-orange-500 shadow-inner transition-all" 
                autoFocus 
                onChange={(e) => { if(e.target.value === '1234') { setIsStaffMode(true); setShowLogin(false); setActiveView('kitchen'); } }} 
             />
             <button onClick={() => setShowLogin(false)} className="mt-10 text-[9px] font-black text-slate-400 hover:text-slate-950 uppercase tracking-widest transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* CARRITO MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-500 ${isCartOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
             <div className="p-8 border-b flex justify-between items-center pt-safe">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Mi <span className="text-orange-600 not-italic">Orden</span></h2>
                <button onClick={() => setIsCartOpen(false)} className="p-3 bg-slate-50 rounded-2xl active:scale-90 transition-transform"><X className="w-6 h-6" /></button>
             </div>
             <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                {cart.length === 0 ? (
                  <div className="py-24 text-center opacity-10">
                    <ShoppingBasket className="w-24 h-24 mx-auto mb-6" />
                    <p className="font-black uppercase text-[10px] tracking-widest">Carrito Vacío</p>
                  </div>
                ) : (
                  <>
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-5 bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100">
                        <img src={item.image} className="w-16 h-16 rounded-2xl object-cover shadow-md" />
                        <div className="flex-1">
                          <p className="text-[11px] font-black uppercase italic tracking-tight text-slate-800 line-clamp-1">{item.name}</p>
                          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl w-fit mt-2 shadow-sm border border-slate-100">
                              <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i).filter(i => i.quantity > 0))}><Minus className="w-3 h-3" /></button>
                              <span className="text-[10px] font-black w-4 text-center">{item.quantity}</span>
                              <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}><Plus className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <span className="text-sm font-black text-orange-600 italic">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-6 space-y-4">
                        <div className="relative">
                            <input type="text" placeholder="¿Cómo te llamas?" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-6 bg-slate-50 rounded-[1.5rem] outline-none font-black text-[11px] uppercase border border-transparent focus:border-slate-200 transition-all shadow-inner" />
                        </div>
                        <div className="relative">
                            <input type="text" placeholder="Número de Mesa" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full p-6 bg-slate-50 rounded-[1.5rem] outline-none font-black text-[11px] uppercase border border-transparent focus:border-slate-200 transition-all shadow-inner" />
                        </div>
                    </div>
                  </>
                )}
             </div>
             <div className="p-10 border-t bg-white pb-safe">
                <div className="flex justify-between items-end mb-8">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest leading-none">Total Final</span>
                  <span className="text-5xl font-black tracking-tighter italic leading-none">${cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={handlePayment} 
                  disabled={cart.length === 0 || isPaying || !customerName}
                  className={`w-full py-6 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(0,0,0,0.15)] transition-all active:scale-95 ${paymentSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-950 text-white disabled:opacity-20'}`}
                >
                  {isPaying ? 'Procesando...' : paymentSuccess ? '¡Pedido Enviado!' : 'Confirmar Pedido'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* FORMULARIO ADMIN */}
      {isAdminFormOpen && (
        <AdminForm 
          item={editingItem} 
          onSave={async (itemData: any) => {
            if (itemData.id) await supabase.from('menu').update(itemData).eq('id', itemData.id);
            else await supabase.from('menu').insert([itemData]);
            setIsAdminFormOpen(false);
          }} 
          onClose={() => setIsAdminFormOpen(false)} 
        />
      )}
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
  <button onClick={onClick} className={`relative w-full p-4 flex items-center gap-4 rounded-[1.5rem] transition-all duration-500 group ${active ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/30' : 'text-slate-500 hover:bg-white/5'}`}>
    <div className={`transition-transform duration-500 ${active ? 'scale-110 rotate-3' : 'group-hover:scale-110'}`}>{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest text-left truncate">{label}</span>
    {badge > 0 && <span className="absolute top-2 right-2 bg-white text-orange-600 text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-lg shadow-lg border border-orange-100">{badge}</span>}
  </button>
);

const MobileNavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${active ? 'text-orange-500 scale-110' : 'text-slate-500 opacity-50'}`}>
    {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
    <span className="text-[8px] font-black uppercase tracking-tighter leading-none">{label}</span>
  </button>
);

const AdminForm = ({ item, onSave, onClose }: any) => {
  const [data, setData] = useState(item || { name: '', price: 0, category: 'Hamburguesas', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&h=300', description: '' });
  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[300] flex items-center justify-center p-6 overflow-y-auto animate-in fade-in duration-500">
      <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-10 md:p-14 shadow-2xl animate-in slide-in-from-bottom-10 duration-700">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-10 text-slate-950">{item ? 'Editar' : 'Nuevo'} <span className="text-orange-600 not-italic">Plato</span></h2>
        <div className="space-y-5">
            <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre del Plato</label>
                <input type="text" placeholder="Ej: Burger Monster" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-xs outline-none border border-slate-100 shadow-inner" />
            </div>
            <div className="flex gap-5">
              <div className="w-1/2 space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Precio ($)</label>
                <input type="number" step="0.01" value={data.price} onChange={e => setData({...data, price: parseFloat(e.target.value)})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-xs outline-none border border-slate-100 shadow-inner" />
              </div>
              <div className="w-1/2 space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Sección</label>
                <select value={data.category} onChange={e => setData({...data, category: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-[10px] outline-none border border-slate-100 uppercase shadow-inner appearance-none">
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Foto (URL)</label>
                <input type="text" placeholder="https://..." value={data.image} onChange={e => setData({...data, image: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-bold text-[10px] outline-none border border-slate-100 shadow-inner" />
            </div>
            <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Descripción Gourmet</label>
                <textarea placeholder="Cuéntanos más del plato..." value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-bold text-[10px] outline-none border border-slate-100 h-28 shadow-inner resize-none" />
            </div>
            <div className="pt-8 space-y-4">
                <button onClick={() => onSave(data)} className="w-full py-6 bg-orange-600 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-orange-600/30 active:scale-95 transition-all">Guardar Cambios</button>
                <button onClick={onClose} className="w-full py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Volver</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
