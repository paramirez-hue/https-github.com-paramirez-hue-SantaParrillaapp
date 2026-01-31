
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShoppingBag, ChefHat, Plus, Minus, X,
  Timer, ShoppingBasket, Edit2, Trash2, Lock, LogOut, 
  Settings, LayoutGrid, Image as ImageIcon, Wand2, Save, Check, PlusCircle, Upload, ArrowRight, Tag, ChevronRight
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { FoodItem, Order, OrderItem, OrderStatus, ViewType, Category } from './types';
import { INITIAL_MENU, INITIAL_CATEGORIES, DEFAULT_BRANDING } from './constants';
import { improveDescription, generateFoodImage } from './geminiService';

const SUPABASE_URL = "https://ejerqcxzvfwnccdadytj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Y3cEubsUUZwHNOKj1uqasQ_lrzXbdS6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AnimatedFireBackground = () => {
  const sparks = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: `${3 + Math.random() * 7}s`,
      delay: `${Math.random() * 10}s`,
      drift: `${(Math.random() - 0.5) * 300}px`,
      size: `${1 + Math.random() * 4}px`,
      rot: `${Math.random() * 360}deg`,
      opacity: 0.3 + Math.random() * 0.7
    }));
  }, []);

  return (
    <div className="embers-container pointer-events-none">
      <div 
        className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[200%] h-[80%] bg-orange-600/20 rounded-[100%] mix-blend-screen"
        style={{ animation: 'fireGlow 8s infinite ease-in-out', filter: 'blur(120px)' }}
      />
      <div 
        className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[120%] h-[40%] bg-red-900/30 rounded-[100%] mix-blend-overlay"
        style={{ animation: 'fireGlow 5s infinite ease-in-out alternate', filter: 'blur(80px)' }}
      />
      <div 
        className="absolute inset-0 bg-gradient-to-t from-orange-950/20 to-transparent"
        style={{ animation: 'heatHaze 10s infinite ease-in-out' }}
      />
      {sparks.map(spark => (
        <div
          key={spark.id}
          className="spark"
          style={{
            left: spark.left,
            width: spark.size,
            height: `calc(${spark.size} * 1.5)`,
            opacity: spark.opacity,
            '--drift': spark.drift,
            '--rot': spark.rot,
            animation: `sparkUp ${spark.duration} linear infinite ${spark.delay}`
          } as any}
        />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.8)_100%)]" />
    </div>
  );
};

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

  const getColor = () => {
    if (elapsed > 20) return 'bg-rose-500 shadow-rose-200 animate-pulse';
    if (elapsed > 10) return 'bg-amber-500 shadow-amber-200';
    return 'bg-emerald-500 shadow-emerald-200';
  };

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-lg transition-colors ${getColor()}`}>
      <Timer className="w-3 h-3" /> {elapsed} min
    </div>
  );
};

const App: React.FC = () => {
  const [hasEntered, setHasEntered] = useState(false);
  const [isStaffMode, setIsStaffMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('menu');
  const [menuItems, setMenuItems] = useState<FoodItem[]>(INITIAL_MENU);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
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
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedFoodForDetail, setSelectedFoodForDetail] = useState<FoodItem | null>(null);
  
  const [restaurantSettings, setRestaurantSettings] = useState(() => {
    const saved = localStorage.getItem('santa_parrilla_settings');
    if (saved) return JSON.parse(saved);
    return { ...DEFAULT_BRANDING, logoUrl: '', name: 'Santa Parrilla' };
  });

  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const { data: menuData } = await supabase.from('menu').select('*');
      if (menuData && menuData.length > 0) setMenuItems(menuData);

      const { data: catData } = await supabase.from('categories').select('*').order('name');
      if (catData && catData.length > 0) {
        setCategories(catData);
      } else {
        setCategories(INITIAL_CATEGORIES);
      }

      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .neq('status', OrderStatus.DELIVERED)
        .order('createdAt', { ascending: false });
      if (ordersData) setOrders(ordersData);

      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'branding').single();
      if (settingsData) {
        const newSettings = { name: settingsData.name, logoUrl: settingsData.logoUrl || DEFAULT_BRANDING.logoUrl };
        setRestaurantSettings(newSettings);
        localStorage.setItem('santa_parrilla_settings', JSON.stringify(newSettings));
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newUrl = reader.result as string;
        setRestaurantSettings(prev => ({ ...prev, logoUrl: newUrl }));
        setLogoLoaded(false); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      await supabase.from('settings').upsert({ id: 'branding', name: restaurantSettings.name, logoUrl: restaurantSettings.logoUrl });
      localStorage.setItem('santa_parrilla_settings', JSON.stringify(restaurantSettings));
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
      fetchData();
    } finally { setIsSavingBranding(false); }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("¿Eliminar este plato?")) return;
    try {
      await supabase.from('menu').delete().eq('id', id);
      fetchData();
    } catch (err) {
      setMenuItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      await supabase.from('categories').delete().eq('id', id);
      fetchData();
    } catch (err) {
      setCategories(prev => prev.filter(c => c.id !== id));
    }
  };

  useEffect(() => {
    fetchData();
    const menuSub = supabase.channel('menu-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, fetchData).subscribe();
    const catSub = supabase.channel('cat-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData).subscribe();
    const ordersSub = supabase.channel('ord-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData).subscribe();
    return () => { supabase.removeChannel(menuSub); supabase.removeChannel(catSub); supabase.removeChannel(ordersSub); };
  }, [isStaffMode]);

  const addToCart = (item: FoodItem, quantity: number = 1, additions: FoodItem[] = []) => {
    const cartItem: OrderItem = { ...item, quantity, additions };
    setCart(prev => [...prev, cartItem]);
    setSelectedFoodForDetail(null);
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
      await supabase.from('orders').insert([newOrder]);
      setCart([]);
      setPaymentSuccess(true);
      setTimeout(() => { setPaymentSuccess(false); setIsCartOpen(false); }, 2000);
    } finally { setIsPaying(false); }
  };

  const updateStatus = async (id: string, current: OrderStatus) => {
    const sequence = [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.DELIVERED];
    const nextIndex = sequence.indexOf(current) + 1;
    if (nextIndex >= sequence.length) return;
    await supabase.from('orders').update({ status: sequence[nextIndex] }).eq('id', id);
    fetchData();
  };

  const cartTotal = cart.reduce((acc, item) => {
    const additionsPrice = (item.additions || []).reduce((sum, add) => sum + add.price, 0);
    return acc + ((item.price + additionsPrice) * item.quantity);
  }, 0);

  const filteredMenu = activeCategory === 'Todas' ? menuItems : menuItems.filter(i => i.category === activeCategory);
  const additionItems = menuItems.filter(i => i.category === 'Adiciones');

  if (!hasEntered) {
    return (
      <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center p-8">
        <AnimatedFireBackground />
        
        <div className="relative z-10 text-center space-y-12 animate-fade-scale">
          <div className="relative inline-block">
             <div className="absolute inset-0 bg-orange-600/30 blur-[100px] rounded-full scale-150 animate-pulse"></div>
             <div className="w-56 h-56 md:w-80 md:h-80 bg-slate-900 rounded-full p-2 border-4 border-orange-500/20 shadow-[0_0_80px_-10px_rgba(234,88,12,0.8)] relative flex items-center justify-center overflow-hidden">
               <div className="w-full h-full rounded-full overflow-hidden border-2 border-orange-500/40 relative z-10">
                {restaurantSettings.logoUrl ? (
                  <img src={restaurantSettings.logoUrl} className={`w-full h-full object-cover transition-opacity duration-1000 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`} alt="Logo" onLoad={() => setLogoLoaded(true)} />
                ) : (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center"><div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>
                )}
               </div>
               <div className="absolute inset-0 bg-gradient-to-t from-orange-600/20 to-transparent z-20 pointer-events-none" />
             </div>
          </div>
          <div className="space-y-4">
            <span className="font-lettering text-white text-3xl md:text-5xl block opacity-90 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Bienvenido a</span>
            <h1 className="text-6xl md:text-[10rem] font-black text-orange-500 uppercase italic tracking-tighter drop-shadow-[0_15px_15px_rgba(0,0,0,0.7)] leading-none">
              {restaurantSettings.name}
            </h1>
          </div>
          <button 
            onClick={() => setHasEntered(true)} 
            className="group relative px-20 py-8 bg-orange-600 hover:bg-orange-500 text-white rounded-full font-black uppercase text-base tracking-[0.5em] shadow-[0_20px_40px_-10px_rgba(234,88,12,0.6)] transition-all hover:scale-110 active:scale-95 flex items-center gap-6 mx-auto btn-press"
          >
            INGRESAR 
            <ArrowRight className="w-7 h-7 group-hover:translate-x-3 transition-transform" />
          </button>
        </div>
        <div className="absolute bottom-10 left-0 right-0 text-center opacity-40">
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.6em]">SANTA PARRILLA • EXPERIENCIA AHUMADA</p>
        </div>
      </div>
    );
  }

  const NavContent = () => (
    <div className="flex flex-col h-full glass-dark">
      <div className="p-10 text-center">
        <div className="w-20 h-20 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl overflow-hidden border border-white/10 group">
          <img src={restaurantSettings.logoUrl || DEFAULT_BRANDING.logoUrl} className="w-full h-full object-cover" alt="Logo" />
        </div>
        <h1 className="text-xs font-black uppercase tracking-widest text-white/90 italic">{restaurantSettings.name}</h1>
      </div>
      <nav className="flex-1 px-6 space-y-3 overflow-y-auto no-scrollbar pb-10">
        {isStaffMode ? (
          <>
            <SidebarItem icon={<ChefHat className="w-5 h-5" />} label="Comandas" active={activeView === 'kitchen'} onClick={() => {setActiveView('kitchen'); setIsMobileMenuOpen(false);}} badge={orders.length} />
            <SidebarItem icon={<Settings className="w-5 h-5" />} label="Gestión" active={activeView === 'admin'} onClick={() => {setActiveView('admin'); setIsMobileMenuOpen(false);}} />
            <button onClick={() => {setIsStaffMode(false); setActiveView('menu'); setIsMobileMenuOpen(false);}} className="w-full mt-10 p-5 text-rose-400 hover:bg-rose-500/10 rounded-2xl flex items-center gap-4 font-black text-[10px] uppercase transition-all"><LogOut className="w-4 h-4" /> Salir</button>
          </>
        ) : (
          <>
            <SidebarItem icon={<LayoutGrid className="w-5 h-5" />} label="Todas" active={activeCategory === 'Todas'} onClick={() => {setActiveCategory('Todas'); setIsMobileMenuOpen(false);}} />
            {categories.map(c => <SidebarItem key={c.id} icon={<span className="text-lg">{c.icon}</span>} label={c.name} active={activeCategory === c.name} onClick={() => {setActiveCategory(c.name); setIsMobileMenuOpen(false);}} />)}
            <div className="pt-10 border-t border-white/5 mt-6">
              <button onClick={() => {setShowLogin(true); setIsMobileMenuOpen(false);}} className="w-full p-5 text-white/40 hover:text-white rounded-3xl flex items-center gap-4 font-black text-[9px] uppercase tracking-widest border border-white/5 transition-all"><Lock className="w-4 h-4" /> Staff</button>
            </div>
          </>
        )}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-[#F8F9FA] text-slate-900">
      <aside className="hidden md:flex flex-col text-white w-72 h-screen sticky top-0 shrink-0"><NavContent /></aside>
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-[#020617]/60 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 h-full bg-[#020617] text-white animate-in slide-in-from-left duration-300"><NavContent /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 glass border-b border-slate-200/50 z-40 px-6 py-4 flex justify-between items-center pt-safe">
          <div className="flex items-center gap-5">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-3 bg-white rounded-2xl shadow-premium active:scale-90 text-slate-900"><LayoutGrid className="w-5 h-5" /></button>
            <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">{isStaffMode ? (activeView === 'kitchen' ? 'Cocina' : 'Panel Admin') : restaurantSettings.name}</h2>
          </div>
          {!isStaffMode && (
            <button onClick={() => setIsCartOpen(true)} className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl flex items-center gap-4 relative shadow-2xl active:scale-95 transition-all btn-press">
              <ShoppingBag className="w-4 h-4 text-orange-400" />
              <span className="font-black text-xs tracking-wider">${cartTotal.toFixed(2)}</span>
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#F8F9FA]">{cart.length}</span>}
            </button>
          )}
        </header>

        <main className="flex-1 p-4 md:p-12 max-w-7xl mx-auto w-full pb-32">
          {activeView === 'menu' && !isStaffMode && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredMenu.map(item => (
                <div key={item.id} onClick={() => setSelectedFoodForDetail(item)} className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-premium flex flex-col group transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer animate-fade-scale">
                  <div className="h-40 md:h-56 overflow-hidden relative">
                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black shadow-lg text-slate-900">${item.price.toFixed(2)}</div>
                  </div>
                  <div className="p-4 md:p-6 flex flex-col flex-1">
                    <h3 className="text-xs md:text-lg font-black text-slate-900 uppercase italic mb-1 md:mb-2 truncate">{item.name}</h3>
                    <p className="text-[9px] md:text-xs text-slate-500 line-clamp-2 mb-4 md:mb-6 font-medium leading-relaxed">{item.description}</p>
                    <button className="mt-auto w-full py-2.5 md:py-3 bg-slate-50 hover:bg-slate-900 hover:text-white transition-all rounded-2xl md:rounded-3xl font-black text-[9px] md:text-[10px] uppercase border border-slate-100 text-slate-900">Personalizar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isStaffMode && activeView === 'kitchen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {orders.map(order => (
                <div key={order.id} className="bg-white border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] shadow-premium overflow-hidden flex flex-col relative animate-fade-scale">
                  <div className="p-6 border-b border-dashed flex justify-between items-center bg-slate-50/50">
                    <div>
                      <span className="font-mono text-[10px] text-slate-400 font-bold uppercase block mb-1">MESA • {order.tableNumber}</span>
                      <p className="text-sm font-black text-slate-900 uppercase italic leading-none">{order.customerName}</p>
                    </div>
                    <OrderTimer startTime={order.createdAt} />
                  </div>
                  <div className="p-8 flex-1 space-y-5">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-4 text-sm font-bold text-slate-700">
                          <span className="bg-slate-900 text-white w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black">{item.quantity}</span>
                          <span className="uppercase truncate flex-1">{item.name}</span>
                        </div>
                        {item.additions && item.additions.length > 0 && (
                          <div className="ml-11 flex flex-wrap gap-1">
                            {item.additions.map((add, ai) => (
                              <span key={ai} className="bg-orange-50 text-orange-600 text-[9px] font-bold px-2 py-0.5 rounded-full border border-orange-100">+{add.name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="p-8 pt-0"><button onClick={() => updateStatus(order.id, order.status)} className={`w-full py-5 rounded-3xl text-[11px] font-black uppercase tracking-widest shadow-xl transition-all btn-press ${order.status === 'READY' ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-slate-900 text-white'}`}>{order.status === 'PENDING' ? 'Recibir' : order.status === 'PREPARING' ? 'Listo' : 'Entregado'}</button></div>
                </div>
              ))}
            </div>
          )}

          {isStaffMode && activeView === 'admin' && (
            <div className="max-w-4xl mx-auto space-y-12 pb-20">
                <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-premium">
                    <div className="flex justify-between items-center mb-10">
                      <div><h4 className="text-lg md:text-xl font-black italic uppercase tracking-tighter text-slate-900">Marca</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logo y Nombre</p></div>
                      <button onClick={handleSaveBranding} className={`px-6 md:px-10 py-3 md:py-4 rounded-full font-black text-[10px] md:text-xs uppercase shadow-xl transition-all ${brandingSaved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>{isSavingBranding ? '...' : brandingSaved ? 'Guardado' : 'Guardar'}</button>
                    </div>
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                       <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden border border-white/10 shrink-0" onClick={() => fileInputRef.current?.click()}>
                         {restaurantSettings.logoUrl ? <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" /> : <Upload className="w-8 h-8 text-orange-500" />}
                       </div>
                       <input type="text" value={restaurantSettings.name} onChange={e => setRestaurantSettings({...restaurantSettings, name: e.target.value})} className="w-full p-4 md:p-5 bg-slate-50 rounded-2xl md:rounded-3xl font-black text-sm outline-none border border-slate-200 focus:border-orange-500 shadow-inner" placeholder="Nombre" />
                       <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                    </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center px-6">
                    <div><h4 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate-900">Categorías</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organización</p></div>
                    <button onClick={() => { setEditingCategory(null); setIsCategoryFormOpen(true); }} className="bg-orange-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-full font-black text-[9px] md:text-[10px] uppercase shadow-orange-glow btn-press flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Nueva</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {categories.map(cat => (
                      <div key={cat.id} className="bg-white p-5 rounded-[2rem] border border-slate-200 flex items-center gap-5 shadow-sm hover:border-orange-200 transition-all">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-slate-100">{cat.icon}</div>
                        <h5 className="flex-1 font-black uppercase text-xs italic text-slate-900">{cat.name}</h5>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingCategory(cat); setIsCategoryFormOpen(true); }} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteCategory(cat.id)} className="p-3 bg-rose-50 text-rose-400 hover:text-white hover:bg-rose-500 rounded-xl transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center px-6">
                    <div><h4 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate-900">Menú</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Productos</p></div>
                    <button onClick={() => { setEditingItem(null); setIsAdminFormOpen(true); }} className="bg-slate-900 text-white px-6 md:px-8 py-3 md:py-4 rounded-full font-black text-[9px] md:text-[10px] uppercase shadow-xl btn-press flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Nuevo</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {menuItems.map(item => (
                      <div key={item.id} className="bg-white p-6 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-premium flex items-center gap-6 group hover:border-orange-200 transition-all">
                        <img src={item.image} className="w-16 h-16 md:w-20 md:h-20 rounded-[1.2rem] md:rounded-[1.5rem] object-cover shadow-lg" />
                        <div className="flex-1 min-w-0"><h5 className="font-black uppercase text-xs italic mb-1 truncate text-slate-900">{item.name}</h5><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.category}</p></div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditingItem(item); setIsAdminFormOpen(true); }} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteItem(item.id)} className="p-3 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </div>
          )}
        </main>
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[150] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-12 text-center shadow-2xl">
             <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center mx-auto mb-8 md:mb-10 text-slate-900 shadow-inner"><Lock className="w-8 h-8 md:w-10 md:h-10" /></div>
             <input type="password" placeholder="••••" maxLength={4} className="w-full py-5 md:py-6 bg-slate-50 rounded-2xl md:rounded-3xl text-center text-4xl md:text-5xl font-black tracking-[0.8em] outline-none border border-slate-200 focus:border-orange-500 shadow-inner" autoFocus onChange={(e) => { if(e.target.value === '1234') { setIsStaffMode(true); setShowLogin(false); setActiveView('kitchen'); } }} />
             <button onClick={() => setShowLogin(false)} className="mt-8 md:mt-10 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button>
          </div>
        </div>
      )}

      {selectedFoodForDetail && <FoodDetailModal item={selectedFoodForDetail} additions={additionItems} onAdd={addToCart} onClose={() => setSelectedFoodForDetail(null)} />}
      {isCartOpen && <CartView cart={cart} setCart={setCart} customerName={customerName} setCustomerName={setCustomerName} tableNumber={tableNumber} setTableNumber={setTableNumber} cartTotal={cartTotal} isPaying={isPaying} paymentSuccess={paymentSuccess} handlePayment={handlePayment} onClose={() => setIsCartOpen(false)} />}
      {isAdminFormOpen && <AdminForm item={editingItem} categories={categories} onSave={async (d: any) => { if(d.id && !String(d.id).startsWith('local_')) await supabase.from('menu').upsert(d); else await supabase.from('menu').insert([{...d, id: undefined}]); setIsAdminFormOpen(false); fetchData(); }} onClose={() => setIsAdminFormOpen(false)} />}
      {isCategoryFormOpen && <CategoryForm category={editingCategory} onSave={async (d: any) => { 
        if(d.id) {
          await supabase.from('categories').upsert(d); 
        } else {
          const { id, ...newCat } = d;
          await supabase.from('categories').insert([newCat]);
        }
        setIsCategoryFormOpen(false); 
        fetchData(); 
      }} onClose={() => setIsCategoryFormOpen(false)} />}
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
  <button onClick={onClick} className={`relative w-full p-4 md:p-5 flex items-center gap-4 md:gap-5 rounded-[1.5rem] md:rounded-[2rem] transition-all duration-300 group ${active ? 'bg-orange-600 text-white shadow-orange-glow' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}>
    <div className={`transition-all duration-300 ${active ? 'scale-110' : 'group-hover:scale-110 opacity-60 group-hover:opacity-100'}`}>{icon}</div>
    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-left truncate">{label}</span>
    {badge > 0 && <span className="absolute top-2 right-2 md:top-3 md:right-3 bg-white text-orange-600 text-[8px] md:text-[9px] font-black w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-lg md:rounded-xl shadow-lg border border-orange-100">{badge}</span>}
  </button>
);

const FoodDetailModal = ({ item, additions, onAdd, onClose }: { item: FoodItem, additions: FoodItem[], onAdd: (item: FoodItem, qty: number, additions: FoodItem[]) => void, onClose: () => void }) => {
  const [qty, setQty] = useState(1);
  const [selectedAdds, setSelectedAdds] = useState<FoodItem[]>([]);

  const toggleAddition = (add: FoodItem) => {
    setSelectedAdds(prev => prev.find(i => i.id === add.id) ? prev.filter(i => i.id !== add.id) : [...prev, add]);
  };

  const totalPrice = (item.price + selectedAdds.reduce((sum, a) => sum + a.price, 0)) * qty;

  return (
    <div className="fixed inset-0 z-[400] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300 backdrop-blur-xl">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-t-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-20 duration-500 max-h-[92vh] flex flex-col">
        <div className="relative h-56 md:h-80 shrink-0">
          <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
          <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-black/20 backdrop-blur-md rounded-2xl text-white hover:bg-black/40 transition-all"><X className="w-6 h-6" /></button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/80 to-transparent p-6 md:p-10 pt-16 md:pt-20">
             <div className="flex justify-between items-end gap-4">
                <div className="min-w-0">
                  <h2 className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-tight mb-1 md:mb-2 truncate">{item.name}</h2>
                  <p className="text-[9px] md:text-xs font-black text-orange-600 uppercase tracking-widest">{item.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Subtotal</span>
                  <span className="text-2xl md:text-4xl font-black text-slate-900 italic tracking-tighter leading-none">${totalPrice.toFixed(2)}</span>
                </div>
             </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-10 no-scrollbar">
          <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed">{item.description}</p>

          <div className="space-y-4 md:space-y-6">
            <div className="flex justify-between items-center">
              <label className="text-[10px] md:text-[11px] font-black text-slate-900 uppercase tracking-widest">¿Algo extra?</label>
              <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Opcional</span>
            </div>
            <div className="grid grid-cols-1 gap-2 md:gap-3">
              {additions.map(add => {
                const isSelected = selectedAdds.find(i => i.id === add.id);
                return (
                  <button 
                    key={add.id} 
                    onClick={() => toggleAddition(add)}
                    className={`p-4 md:p-5 rounded-2xl md:rounded-3xl border transition-all flex items-center justify-between group ${isSelected ? 'bg-orange-600 border-orange-500 text-white shadow-orange-glow' : 'bg-slate-50 border-slate-100 hover:border-slate-200 text-slate-900'}`}
                  >
                    <div className="flex items-center gap-3 md:gap-4 text-left">
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                         <Plus className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`} />
                      </div>
                      <div>
                        <p className="text-[10px] md:text-[11px] font-black uppercase italic leading-none mb-1">{add.name}</p>
                        <p className={`text-[9px] md:text-[10px] font-bold ${isSelected ? 'text-orange-200' : 'text-slate-400'}`}>+${add.price.toFixed(2)}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 md:w-5 md:h-5 animate-in zoom-in" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 md:p-10 border-t bg-slate-50 flex items-center justify-between gap-4 md:gap-8 pb-safe">
          <div className="flex items-center gap-3 md:gap-6 bg-white p-1.5 md:p-2 rounded-full border border-slate-200 shadow-sm shrink-0">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all"><Minus className="w-5 h-5 md:w-6 md:h-6" /></button>
            <span className="text-xl md:text-2xl font-black text-slate-900 w-8 md:w-10 text-center italic">{qty}</span>
            <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-slate-900 text-white shadow-lg shadow-slate-200 hover:scale-110 transition-all"><Plus className="w-5 h-5 md:w-6 md:h-6" /></button>
          </div>
          <button 
            onClick={() => onAdd(item, qty, selectedAdds)}
            className="flex-1 py-5 md:py-7 bg-orange-600 text-white rounded-full font-black uppercase text-[10px] md:text-xs tracking-[0.3em] md:tracking-[0.4em] shadow-orange-glow hover:bg-orange-500 transition-all btn-press flex items-center justify-center gap-2 md:gap-4"
          >
            CONFIRMAR <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

const CartView = ({ cart, setCart, customerName, setCustomerName, tableNumber, setTableNumber, cartTotal, isPaying, paymentSuccess, handlePayment, onClose }: any) => {
  const removeItem = (index: number) => {
    setCart((prev: any[]) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
         <div className="p-6 md:p-8 border-b flex justify-between items-center pt-safe"><h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate-900">Tu <span className="text-orange-600 not-italic">Orden</span></h2><button onClick={onClose} className="p-2 md:p-3 bg-slate-100 rounded-xl md:rounded-2xl text-slate-900 btn-press"><X className="w-5 h-5 md:w-6 md:h-6" /></button></div>
         <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 md:space-y-6 no-scrollbar">
            {cart.length === 0 ? <div className="py-24 md:py-32 text-center opacity-20"><ShoppingBasket className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-6 md:mb-8 text-slate-900" /><p className="font-black uppercase text-[10px] md:text-[11px] tracking-[0.3em]">Carrito Vacío</p></div> : cart.map((item, idx) => {
              const additionsPrice = (item.additions || []).reduce((sum: number, add: any) => sum + add.price, 0);
              return (
                <div key={idx} className="flex flex-col gap-3 md:gap-4 bg-slate-50/80 p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 animate-fade-scale relative">
                  <button onClick={() => removeItem(idx)} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  <div className="flex items-center gap-4 md:gap-5">
                    <img src={item.image} className="w-14 h-14 md:w-16 md:h-16 rounded-xl md:rounded-2xl object-cover shadow-lg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] md:text-xs font-black uppercase italic text-slate-900 truncate mb-1">{item.name}</p>
                      <p className="text-[9px] md:text-[10px] font-black text-orange-600 uppercase tracking-widest">${(item.price + additionsPrice).toFixed(2)} c/u</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-1 md:mt-2 uppercase tracking-tighter">CANTIDAD: {item.quantity}</p>
                    </div>
                  </div>
                  {item.additions && item.additions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/50 mt-1 md:mt-2">
                      {item.additions.map((add: any, ai: number) => (
                        <span key={ai} className="bg-white text-[8px] md:text-[9px] font-bold px-2.5 py-0.5 md:py-1 rounded-full border border-slate-200 text-slate-500">+{add.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {cart.length > 0 && <div className="pt-4 md:pt-8 space-y-3 md:space-y-4"><input type="text" placeholder="Tu Nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl outline-none font-black text-[10px] md:text-xs uppercase border border-slate-100 focus:border-orange-500 shadow-inner" /><input type="text" placeholder="Nro de Mesa o Lugar" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl outline-none font-black text-[10px] md:text-xs uppercase border border-slate-100 focus:border-orange-500 shadow-inner" /></div>}
         </div>
         <div className="p-6 md:p-10 border-t glass pb-safe">
            <div className="flex justify-between items-end mb-6 md:mb-10 text-slate-900"><span className="text-[10px] md:text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] md:tracking-[0.4em] mb-1 md:mb-2 leading-none">Total</span><span className="text-3xl md:text-5xl font-black tracking-tighter italic leading-none">${cartTotal.toFixed(2)}</span></div>
            <button onClick={handlePayment} disabled={cart.length === 0 || isPaying || !customerName} className={`w-full py-5 md:py-6 rounded-full font-black text-[10px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] shadow-2xl transition-all btn-press ${paymentSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white disabled:opacity-20'}`}>{isPaying ? 'Enviando...' : paymentSuccess ? '¡Enviado!' : 'Hacer Pedido'}</button>
         </div>
      </div>
    </div>
  );
};

const CategoryForm = ({ category, onSave, onClose }: any) => {
  const [data, setData] = useState(category || { name: '', icon: '🍴' });
  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl z-[350] flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 md:p-10 shadow-2xl text-slate-900">
        <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter mb-6 md:mb-8 text-center md:text-left">Gestionar <span className="text-orange-600 not-italic">Categoría</span></h2>
        <div className="space-y-4 md:space-y-6">
          <div className="space-y-1.5 md:space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Icono / Emoji</label><input type="text" value={data.icon} onChange={e => setData({...data, icon: e.target.value})} className="w-full p-4 md:p-5 bg-slate-50 rounded-2xl md:rounded-3xl font-black text-xl md:text-2xl text-center outline-none border border-slate-200 focus:border-orange-500" maxLength={2} /></div>
          <div className="space-y-1.5 md:space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Nombre</label><input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl font-black text-xs outline-none border border-slate-200 focus:border-orange-500 uppercase" placeholder="Ej: Hamburguesas" /></div>
          <div className="pt-4 md:pt-6"><button onClick={() => onSave(data)} className="w-full py-5 md:py-6 bg-slate-900 text-white rounded-full font-black uppercase text-[10px] tracking-[0.3em] md:tracking-[0.4em] shadow-xl btn-press">Guardar</button><button onClick={onClose} className="w-full mt-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Cerrar</button></div>
        </div>
      </div>
    </div>
  );
};

const AdminForm = ({ item, categories, onSave, onClose }: any) => {
  const [data, setData] = useState(item || { name: '', price: 0, category: categories[0]?.name || '', image: '', description: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const localFileRef = useRef<HTMLInputElement>(null);

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setData({ ...data, image: reader.result as string }); };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl z-[300] flex items-center justify-center p-4 md:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-14 shadow-2xl text-slate-900 relative my-auto">
        <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter mb-6 md:mb-10 text-center md:text-left">Gestionar <span className="text-orange-600 not-italic">Plato</span></h2>
        <div className="space-y-4 md:space-y-6">
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-4 tracking-widest">Nombre del Producto</label>
              <input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl font-black text-sm outline-none border border-slate-200 focus:border-orange-500 shadow-inner" placeholder="Ej: Bife de Chorizo" />
            </div>

            <div className="grid grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-4 tracking-widest">Precio</label>
                <input type="number" step="0.01" value={data.price} onChange={e => setData({...data, price: parseFloat(e.target.value)})} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl font-black text-sm outline-none border border-slate-200 shadow-inner" placeholder="0.00" />
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-4 tracking-widest">Categoría</label>
                <select value={data.category} onChange={e => setData({...data, category: e.target.value})} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl font-black text-xs outline-none border border-slate-200 shadow-inner uppercase appearance-none">
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between px-4">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imagen Visual</label>
                <div className="flex gap-4">
                  <button onClick={() => localFileRef.current?.click()} className="text-slate-900 text-[9px] font-black uppercase flex items-center gap-1"><Upload className="w-3 h-3" /> CARGAR</button>
                  <button onClick={async () => { if(!data.name) return; setIsGenerating(true); try { const img = await generateFoodImage(data.name); if (img) setData({ ...data, image: img }); } finally { setIsGenerating(false); } }} disabled={isGenerating} className="text-orange-600 text-[9px] font-black uppercase flex items-center gap-1"><ImageIcon className="w-3 h-3" /> IA</button>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-200 shadow-inner">
                {data.image && <img src={data.image} className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl object-cover shadow-lg border border-white shrink-0" />}
                <input type="text" value={data.image} onChange={e => setData({...data, image: e.target.value})} className="flex-1 bg-transparent font-bold text-[9px] md:text-[10px] outline-none truncate" placeholder="URL o carga archivo..." />
                <input type="file" ref={localFileRef} onChange={handleLocalUpload} className="hidden" accept="image/*" />
              </div>
            </div>

            <div className="space-y-1.5 md:space-y-2">
              <div className="flex justify-between px-4"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción</label><button onClick={async () => { if(!data.name) return; setIsGenerating(true); try { const desc = await improveDescription(data.name); setData({ ...data, description: desc }); } finally { setIsGenerating(false); } }} disabled={isGenerating} className="text-orange-600 text-[9px] font-black uppercase flex items-center gap-1"><Wand2 className="w-3 h-3" /> IA</button></div>
              <textarea value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl font-bold text-xs outline-none border border-slate-200 h-24 md:h-28 shadow-inner resize-none" placeholder="Describe los ingredientes..." />
            </div>

            <div className="pt-4 md:pt-6">
              <button onClick={() => onSave(data)} className="w-full py-5 md:py-6 bg-slate-900 text-white rounded-full font-black uppercase text-[10px] md:text-xs tracking-[0.3em] md:tracking-[0.4em] shadow-2xl transition-all active:scale-95">Confirmar Cambios</button>
              <button onClick={onClose} className="w-full mt-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Cerrar</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
