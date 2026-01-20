
import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, ChefHat, Plus, Minus, X,
  UtensilsCrossed, Timer, ShoppingBasket, Edit2, Lock, LogOut, 
  Settings, Store, LayoutGrid, Sparkles, TrendingUp, Bell, Image as ImageIcon, Wand2, Database, AlertTriangle, CloudOff, ChevronRight
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { FoodItem, Order, OrderItem, OrderStatus, ViewType } from './types';
import { INITIAL_MENU, CATEGORIES, DEFAULT_BRANDING } from './constants';
import { getSmartSuggestions, generateUpsellSuggestion, improveDescription, generateFoodImage } from './geminiService';

// Supabase configuration
const SUPABASE_URL = "https://ejerqcxzvfwnccdadytj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Y3cEubsUUZwHNOKj1uqasQ_lrzXbdS6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const OrderTimer: React.FC<{ startTime: any }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 60000));
    }, 10000);
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
  const [menuItems, setMenuItems] = useState<FoodItem[]>(INITIAL_MENU);
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
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [isUsingCloudData, setIsUsingCloudData] = useState(false);

  const prevOrdersCount = useRef(0);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) { console.debug("Sound blocked"); }
  };

  const fetchData = async () => {
    try {
      const { data: menuData, error: menuError } = await supabase.from('menu').select('*');
      if (!menuError && menuData && menuData.length > 0) {
        setMenuItems(menuData);
        setIsUsingCloudData(true);
      } else {
        setIsUsingCloudData(false);
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .neq('status', OrderStatus.DELIVERED)
        .order('createdAt', { ascending: false });
      
      if (!ordersError && ordersData) {
        if (ordersData.length > prevOrdersCount.current && isStaffMode) {
          playNotificationSound();
        }
        prevOrdersCount.current = ordersData.length;
        setOrders(ordersData);

        const myOrderId = localStorage.getItem('last_order_id');
        if (myOrderId) {
          const myOrder = ordersData.find(o => o.id === myOrderId);
          if (myOrder) setLastOrder(myOrder);
          else setLastOrder(null);
        }
      }

      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'branding').single();
      if (settingsData) setRestaurantSettings(settingsData);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const seedDatabase = async () => {
    if (!confirm("¿Sincronizar menú inicial con la nube?")) return;
    try {
      const { error: menuErr } = await supabase.from('menu').insert(INITIAL_MENU.map(({id, ...rest}) => rest));
      await supabase.from('settings').upsert({ id: 'branding', ...DEFAULT_BRANDING });
      if (menuErr) alert("Error: " + menuErr.message);
      else { alert("¡Éxito!"); fetchData(); }
    } catch (e) { alert("Error de conexión"); }
  };

  useEffect(() => {
    fetchData();
    const menuSub = supabase.channel('menu-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, fetchData).subscribe();
    const ordersSub = supabase.channel('ord-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData).subscribe();
    const settingsSub = supabase.channel('set-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, fetchData).subscribe();
    return () => { supabase.removeChannel(menuSub); supabase.removeChannel(ordersSub); supabase.removeChannel(settingsSub); };
  }, [isStaffMode]);

  useEffect(() => {
    if (isStaffMode && activeView === 'stats' && orders.length > 0) {
      getSmartSuggestions(menuItems, orders).then(setAiSuggestions);
    }
  }, [isStaffMode, activeView]);

  const addToCart = async (item: FoodItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
    if (cart.length < 2) {
      const suggestion = await generateUpsellSuggestion([item]);
      setUpsellHint(suggestion);
      setTimeout(() => setUpsellHint(null), 8000);
    }
  };

  const handlePayment = async () => {
    if (!customerName) return alert("Ingresa tu nombre");
    setIsPaying(true);
    try {
      const newOrder = {
        items: cart,
        total: cartTotal,
        status: OrderStatus.PENDING,
        customerName,
        tableNumber: tableNumber || 'Llevar',
        createdAt: new Date().toISOString()
      };
      const { data, error } = await supabase.from('orders').insert([newOrder]).select().single();
      if (error) {
         localStorage.setItem('last_order_id', 'local_' + Date.now());
         setCart([]);
         setPaymentSuccess(true);
      } else if (data) {
        localStorage.setItem('last_order_id', data.id);
        setCart([]);
        setPaymentSuccess(true);
      }
      setTimeout(() => { setPaymentSuccess(false); setIsCartOpen(false); }, 2000);
    } finally { setIsPaying(false); }
  };

  const updateStatus = async (id: string, current: OrderStatus) => {
    const sequence = [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.DELIVERED];
    const nextIndex = sequence.indexOf(current) + 1;
    if (nextIndex >= sequence.length) return;
    const next = sequence[nextIndex];
    await supabase.from('orders').update({ status: next }).eq('id', id);
    if (next === OrderStatus.DELIVERED && id === localStorage.getItem('last_order_id')) {
      localStorage.removeItem('last_order_id');
      setLastOrder(null);
    }
    fetchData();
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const filteredMenu = activeCategory === 'Todas' ? menuItems : menuItems.filter(i => i.category === activeCategory);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-10 text-center">
        <div className="w-16 h-16 bg-orange-600 rounded-[1.5rem] mx-auto flex items-center justify-center mb-4 shadow-xl overflow-hidden">
          {restaurantSettings.logoUrl ? <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" /> : <UtensilsCrossed className="w-8 h-8 text-white" />}
        </div>
        <h1 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-90 truncate text-white">{restaurantSettings.name}</h1>
      </div>
      <nav className="flex-1 px-6 space-y-2 overflow-y-auto no-scrollbar">
        {isStaffMode ? (
          <>
            <SidebarItem icon={<ChefHat />} label="Pedidos" active={activeView === 'kitchen'} onClick={() => {setActiveView('kitchen'); setIsMobileMenuOpen(false);}} badge={orders.length} />
            <SidebarItem icon={<Settings />} label="Catálogo" active={activeView === 'admin'} onClick={() => {setActiveView('admin'); setIsMobileMenuOpen(false);}} />
            <SidebarItem icon={<TrendingUp />} label="Estrategia IA" active={activeView === 'stats'} onClick={() => {setActiveView('stats'); setIsMobileMenuOpen(false);}} />
            <button onClick={() => {setIsStaffMode(false); setActiveView('menu'); setIsMobileMenuOpen(false);}} className="w-full mt-10 p-4 text-red-400 hover:bg-red-400/10 rounded-2xl flex items-center gap-3 font-black text-[10px] uppercase transition-all"><LogOut className="w-4 h-4" /> Salir</button>
          </>
        ) : (
          <>
            <SidebarItem icon={<LayoutGrid />} label="Todas" active={activeCategory === 'Todas'} onClick={() => {setActiveCategory('Todas'); setIsMobileMenuOpen(false);}} />
            {CATEGORIES.map(c => <SidebarItem key={c.id} icon={<span>{c.icon}</span>} label={c.id} active={activeCategory === c.id} onClick={() => {setActiveCategory(c.id); setIsMobileMenuOpen(false);}} />)}
            <div className="pt-10 border-t border-white/5 mt-6">
              <button onClick={() => {setShowLogin(true); setIsMobileMenuOpen(false);}} className="w-full p-4 text-slate-500 hover:text-white flex items-center gap-3 font-black text-[9px] uppercase tracking-widest"><Lock className="w-4 h-4" /> Acceso Staff</button>
            </div>
          </>
        )}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-[#FAF9F6]">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col bg-slate-950 text-white w-64 h-screen sticky top-0 border-r border-white/5 shrink-0">
        <NavContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 h-full bg-slate-950 text-white shadow-2xl animate-in slide-in-from-left duration-300">
            <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-6 right-6 p-2 bg-white/5 rounded-xl"><X className="w-5 h-5" /></button>
            <NavContent />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 bg-white/70 backdrop-blur-xl border-b z-40 px-6 py-4 flex justify-between items-center pt-safe">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2.5 bg-slate-100 rounded-xl active:scale-90 text-slate-900"><LayoutGrid className="w-6 h-6" /></button>
            <div>
                <h2 className="text-sm md:text-xl font-black uppercase tracking-tight italic text-slate-900">
                    {isStaffMode ? (activeView === 'kitchen' ? 'Cocina' : activeView === 'admin' ? 'Inventario' : 'Insights') : restaurantSettings.name}
                </h2>
                {!isStaffMode && <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">{activeCategory}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isStaffMode && (
              <button onClick={() => setIsCartOpen(true)} className="bg-slate-950 text-white px-5 py-3 rounded-2xl flex items-center gap-3 relative shadow-xl active:scale-95 transition-all">
                <ShoppingBag className="w-4 h-4" />
                <span className="font-black text-xs">${cartTotal.toFixed(2)}</span>
                {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{cart.length}</span>}
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-10 max-w-6xl mx-auto w-full pb-32">
          {activeView === 'menu' && !isStaffMode && (
            <>
              {lastOrder && (
                <div className="mb-6 bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between border-4 border-orange-600">
                  <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-400">Estado Pedido</p><h4 className="text-lg font-black uppercase italic">{lastOrder.status === 'PENDING' ? 'Recibido' : lastOrder.status === 'PREPARING' ? 'En Parrilla 🔥' : '¡Listo! 🥡'}</h4></div>
                  <Bell className="w-8 h-8 text-orange-500 animate-swing" />
                </div>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                {filteredMenu.map(item => (
                  <div key={item.id} className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm flex flex-col group active:scale-[0.97] transition-all">
                    <div className="h-32 md:h-64 overflow-hidden relative">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" loading="lazy" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-2xl text-[11px] font-black shadow-lg border border-slate-100">${item.price.toFixed(2)}</div>
                    </div>
                    <div className="p-4 md:p-8 flex flex-col flex-1">
                      <h3 className="text-xs md:text-base font-black text-slate-900 line-clamp-1 mb-2 uppercase italic">{item.name}</h3>
                      <p className="text-[9px] md:text-[11px] text-slate-400 line-clamp-2 mb-6 leading-relaxed">{item.description}</p>
                      <button onClick={() => addToCart(item)} className="mt-auto w-full py-3.5 bg-slate-50 hover:bg-slate-950 hover:text-white transition-all rounded-[1.5rem] font-black text-[10px] uppercase border border-slate-100">Añadir</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {isStaffMode && !isUsingCloudData && (
             <div className="mb-10 bg-amber-50 border-2 border-amber-200 p-8 rounded-[3rem] flex flex-col md:flex-row items-center gap-6">
                <CloudOff className="w-12 h-12 text-amber-500 shrink-0" />
                <div className="text-center md:text-left"><h3 className="text-xl font-black uppercase italic text-amber-900">Modo Local</h3><p className="text-[10px] font-bold text-amber-700 mt-1 uppercase">Sincroniza para guardar cambios en la nube.</p></div>
                <button onClick={seedDatabase} className="md:ml-auto bg-amber-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[9px] shadow-lg">Sincronizar Supabase</button>
             </div>
          )}

          {isStaffMode && activeView === 'kitchen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orders.length === 0 ? <div className="col-span-full py-40 text-center opacity-20"><p className="font-black uppercase text-xs tracking-[0.4em]">Sin comandas</p></div> : (
                orders.map(order => (
                  <div key={order.id} className="bg-white border-2 border-slate-100 rounded-[3rem] shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95">
                    <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                      <div><span className="font-black text-[9px] text-slate-400 uppercase">Mesa: {order.tableNumber}</span><p className="text-[11px] font-black text-slate-800 uppercase italic">{order.customerName}</p></div>
                      <OrderTimer startTime={order.createdAt} />
                    </div>
                    <div className="p-6 flex-1 space-y-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-[11px] font-black"><span className="bg-orange-600 text-white w-7 h-7 flex items-center justify-center rounded-xl text-[10px]">{item.quantity}</span><span className="uppercase text-slate-700 truncate">{item.name}</span></div>
                      ))}
                    </div>
                    <div className="p-6 pt-0"><button onClick={() => updateStatus(order.id, order.status)} className={`w-full py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-lg ${order.status === 'READY' ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white'}`}>{order.status === 'PENDING' ? 'Cocinar' : order.status === 'PREPARING' ? 'Terminar' : 'Entregado ✓'}</button></div>
                  </div>
                ))
              )}
            </div>
          )}

          {isStaffMode && activeView === 'admin' && (
            <div className="space-y-10 pb-20">
                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl">
                    <div className="flex items-center gap-3 mb-8 text-slate-900"><Store className="w-6 h-6 text-orange-600" /><h4 className="text-xl font-black italic uppercase tracking-tighter">Branding</h4></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase ml-4">Nombre</label><input type="text" value={restaurantSettings.name} onChange={e => setRestaurantSettings({...restaurantSettings, name: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-xs outline-none" /></div>
                        <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase ml-4">Logo URL</label><input type="text" value={restaurantSettings.logoUrl} onChange={e => setRestaurantSettings({...restaurantSettings, logoUrl: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-bold text-[10px] outline-none" /></div>
                    </div>
                </div>
                <div className="flex justify-between items-center px-4"><h4 className="text-xl font-black italic uppercase tracking-tighter text-slate-900">Carta <span className="text-orange-600 not-italic">Digital</span></h4><button onClick={() => { setEditingItem(null); setIsAdminFormOpen(true); }} className="bg-slate-950 text-white px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl">Nuevo Item</button></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {menuItems.map(item => (
                    <div key={item.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
                      <img src={item.image} className="w-20 h-20 rounded-[1.5rem] object-cover shadow-md" />
                      <div className="flex-1 text-slate-900"><h5 className="font-black uppercase text-xs italic">{item.name}</h5><p className="text-orange-600 font-black text-xs italic">${item.price.toFixed(2)}</p></div>
                      <button onClick={() => { setEditingItem(item); setIsAdminFormOpen(true); }} className="p-4 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl"><Edit2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
            </div>
          )}

          {isStaffMode && activeView === 'stats' && (
            <div className="space-y-8">
               <div className="flex items-center gap-4 border-b pb-6"><div className="p-4 bg-orange-600 rounded-[2rem] text-white shadow-xl shadow-orange-600/30"><TrendingUp className="w-6 h-6" /></div><h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Gemini <span className="text-orange-600 not-italic">Strategy</span></h3></div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {aiSuggestions.map((s, i) => (
                    <div key={i} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl"><div className={`w-fit px-3 py-1 rounded-full text-[8px] font-black uppercase mb-4 ${s.impact === 'Alta' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>Impacto {s.impact}</div><h4 className="text-sm font-black uppercase italic mb-3 text-slate-800">{s.title}</h4><p className="text-[11px] text-slate-500 font-medium leading-relaxed">{s.description}</p></div>
                  ))}
               </div>
            </div>
          )}
        </main>
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[150] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-12 text-center shadow-2xl animate-in zoom-in-95 text-slate-900">
             <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-8"><Lock className="w-10 h-10" /></div>
             <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-4">Acceso <span className="text-orange-600 not-italic">Staff</span></h2>
             <input type="password" placeholder="PIN" maxLength={4} className="w-full py-6 bg-slate-50 rounded-[1.5rem] text-center text-4xl font-black tracking-[0.6em] outline-none border-2 border-transparent focus:border-orange-500" autoFocus onChange={(e) => { if(e.target.value === '1234') { setIsStaffMode(true); setShowLogin(false); setActiveView('kitchen'); } }} />
             <button onClick={() => setShowLogin(false)} className="mt-10 text-[9px] font-black text-slate-400 hover:text-slate-950 uppercase tracking-widest">Volver</button>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
             <div className="p-8 border-b flex justify-between items-center pt-safe text-slate-900"><h2 className="text-2xl font-black italic uppercase tracking-tighter">Mi <span className="text-orange-600 not-italic">Orden</span></h2><button onClick={() => setIsCartOpen(false)} className="p-3 bg-slate-100 rounded-2xl"><X className="w-6 h-6" /></button></div>
             <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                {cart.length === 0 ? <div className="py-24 text-center opacity-10"><ShoppingBasket className="w-24 h-24 mx-auto mb-6 text-slate-900" /><p className="font-black uppercase text-[10px] tracking-widest">Carrito vacío</p></div> : cart.map(item => (
                  <div key={item.id} className="flex items-center gap-5 bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100">
                    <img src={item.image} className="w-16 h-16 rounded-2xl object-cover" />
                    <div className="flex-1"><p className="text-[11px] font-black uppercase italic text-slate-800 truncate">{item.name}</p><div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl w-fit mt-2 border border-slate-100 text-slate-900"><button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i).filter(i => i.quantity > 0))}><Minus className="w-3 h-3" /></button><span className="text-[10px] font-black w-4 text-center">{item.quantity}</span><button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}><Plus className="w-3 h-3" /></button></div></div>
                    <span className="text-sm font-black text-orange-600 italic">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                {cart.length > 0 && <div className="pt-6 space-y-4"><input type="text" placeholder="Tu Nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-6 bg-slate-50 rounded-[1.5rem] outline-none font-black text-[11px] uppercase border border-transparent focus:border-orange-500 text-slate-900" /><input type="text" placeholder="Mesa / Llevar" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full p-6 bg-slate-50 rounded-[1.5rem] outline-none font-black text-[11px] uppercase border border-transparent focus:border-orange-500 text-slate-900" /></div>}
             </div>
             <div className="p-10 border-t bg-white pb-safe">
                <div className="flex justify-between items-end mb-8 text-slate-900"><span className="text-[11px] font-black uppercase text-slate-400 tracking-widest leading-none">Subtotal</span><span className="text-5xl font-black tracking-tighter italic leading-none">${cartTotal.toFixed(2)}</span></div>
                <button onClick={handlePayment} disabled={cart.length === 0 || isPaying || !customerName} className={`w-full py-6 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-xl ${paymentSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-950 text-white disabled:opacity-20'}`}>{isPaying ? 'Procesando...' : paymentSuccess ? '¡Enviado!' : 'Hacer Pedido'}</button>
             </div>
          </div>
        </div>
      )}

      {isAdminFormOpen && (
        <AdminForm 
          item={editingItem} 
          onSave={async (itemData: any) => {
            if (itemData.id) await supabase.from('menu').update(itemData).eq('id', itemData.id);
            else await supabase.from('menu').insert([itemData]);
            setIsAdminFormOpen(false);
            fetchData();
          }} 
          onClose={() => setIsAdminFormOpen(false)} 
        />
      )}
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
  <button onClick={onClick} className={`relative w-full p-4 flex items-center gap-4 rounded-[1.5rem] transition-all duration-300 group ${active ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/30' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest text-left truncate">{label}</span>
    {badge > 0 && <span className="absolute top-2 right-2 bg-white text-orange-600 text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-lg shadow-lg">{badge}</span>}
  </button>
);

const AdminForm = ({ item, onSave, onClose }: any) => {
  const [data, setData] = useState(item || { name: '', price: 0, category: 'Hamburguesas', image: '', description: '' });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAIDescription = async () => {
    if (!data.name) return alert("Nombre requerido");
    setIsGenerating(true);
    try { const desc = await improveDescription(data.name); setData({ ...data, description: desc }); } finally { setIsGenerating(false); }
  };

  const handleAIImage = async () => {
    if (!data.name) return alert("Nombre requerido");
    setIsGenerating(true);
    try { const img = await generateFoodImage(data.name); if (img) setData({ ...data, image: img }); } finally { setIsGenerating(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[300] flex items-center justify-center p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-10 md:p-14 shadow-2xl animate-in slide-in-from-bottom-10 text-slate-900">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-10">Gestionar <span className="text-orange-600 not-italic">Plato</span></h2>
        <div className="space-y-5">
            <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Nombre</label><input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-xs outline-none border border-slate-100 shadow-inner" /></div>
            <div className="flex gap-5">
              <div className="w-1/2 space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Precio</label><input type="number" step="0.01" value={data.price} onChange={e => setData({...data, price: parseFloat(e.target.value)})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-xs outline-none border border-slate-100 shadow-inner" /></div>
              <div className="w-1/2 space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Categoría</label><select value={data.category} onChange={e => setData({...data, category: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-[10px] outline-none border border-slate-100 uppercase appearance-none"><option value="Hamburguesas">Hamburguesas</option><option value="Carnes">Carnes</option><option value="Papas Fritas">Papas Fritas</option><option value="Bebidas">Bebidas</option><option value="Postres">Postres</option></select></div>
            </div>
            <div className="space-y-2"><div className="flex justify-between items-center px-4"><label className="text-[9px] font-black text-slate-400 uppercase">Imagen</label><button onClick={handleAIImage} disabled={isGenerating} className="text-orange-600 text-[9px] font-black uppercase flex items-center gap-1"><ImageIcon className="w-3 h-3" /> IA Foto</button></div><input type="text" value={data.image} onChange={e => setData({...data, image: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-bold text-[10px] outline-none border border-slate-100 shadow-inner" /></div>
            <div className="space-y-2"><div className="flex justify-between items-center px-4"><label className="text-[9px] font-black text-slate-400 uppercase">Descripción</label><button onClick={handleAIDescription} disabled={isGenerating} className="text-orange-600 text-[9px] font-black uppercase flex items-center gap-1"><Wand2 className="w-3 h-3" /> IA Texto</button></div><textarea value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-bold text-[10px] outline-none border border-slate-100 h-24 shadow-inner resize-none" /></div>
            <div className="pt-8 space-y-4"><button onClick={() => onSave(data)} className="w-full py-6 bg-orange-600 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-xl">Guardar</button><button onClick={onClose} className="w-full py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button></div>
        </div>
      </div>
    </div>
  );
};

export default App;
