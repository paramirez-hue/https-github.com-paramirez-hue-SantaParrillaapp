
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShoppingBag, ChefHat, Plus, Minus, X,
  Timer, ShoppingBasket, Edit2, Trash2, Lock, LogOut, 
  Settings, LayoutGrid, Image as ImageIcon, Wand2, Save, Check, PlusCircle, Upload, ArrowRight, Tag, ChevronRight, AlertCircle, Play, PackageCheck, BarChart3, TrendingUp, DollarSign, FileSpreadsheet, DatabaseZap, Clock, Bell, UtensilsCrossed, Sparkles, Calendar, History
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { FoodItem, Order, OrderItem, OrderStatus, ViewType, Category } from './types';
import { INITIAL_MENU, INITIAL_CATEGORIES, DEFAULT_BRANDING } from './constants';
import { improveDescription, generateFoodImage } from './geminiService';

const SUPABASE_URL = "https://ejerqcxzvfwnccdadytj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Y3cEubsUUZwHNOKj1uqasQ_lrzXbdS6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const formatPrice = (amount: number) => {
  return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
};

const formatDate = (dateInput: any) => {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

const AnimatedFireBackground = () => {
  const sparks = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: `${3 + Math.random() * 5}s`,
      delay: `${Math.random() * 5}s`,
      drift: `${(Math.random() - 0.5) * 300}px`,
      size: `${1 + Math.random() * 2}px`,
      rot: `${Math.random() * 360}deg`,
      opacity: 0.3 + Math.random() * 0.5
    }));
  }, []);

  return (
    <div className="embers-container pointer-events-none">
      <div 
        className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[150%] h-[50%] bg-orange-950/20 rounded-[100%] mix-blend-screen"
        style={{ animation: 'fireGlow 8s infinite ease-in-out', filter: 'blur(120px)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-orange-950/10 to-transparent" style={{ animation: 'heatHaze 10s infinite ease-in-out' }} />
      {sparks.map(spark => (
        <div
          key={spark.id}
          className="spark"
          style={{
            left: spark.left,
            width: spark.size,
            height: `calc(${spark.size} * 2.5)`,
            opacity: spark.opacity,
            '--drift': spark.drift,
            '--rot': spark.rot,
            animation: `sparkUp ${spark.duration} linear infinite ${spark.delay}`
          } as any}
        />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.95)_100%)]" />
    </div>
  );
};

const OrderTimer: React.FC<{ startTime: any, status?: OrderStatus, light?: boolean }> = ({ startTime, status, light }) => {
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
    if (light) return 'text-orange-500';
    if (status === OrderStatus.READY) return 'bg-emerald-500 shadow-emerald-200';
    if (elapsed > 20) return 'bg-rose-600 shadow-rose-200 animate-pulse';
    if (elapsed > 10) return 'bg-amber-500 shadow-amber-200';
    return 'bg-slate-700 shadow-slate-200';
  };

  return (
    <div className={light ? `flex items-center gap-2 font-black italic ${getColor()}` : `flex items-center gap-2 px-4 py-2 rounded-2xl text-xs md:text-sm font-black text-white shadow-xl transition-all ${getColor()}`}>
      <Timer className="w-4 h-4" /> {elapsed} min
    </div>
  );
};

const App: React.FC = () => {
  const [hasEntered, setHasEntered] = useState(false);
  const [isStaffMode, setIsStaffMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('menu');
  const [menuItems, setMenuItems] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrdersHistory, setAllOrdersHistory] = useState<Order[]>([]);
  const [cart, setOrderItems] = useState<OrderItem[]>([]);
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
  const [logoLoaded, setLogoLoaded] = useState(false);
  
  const [currentOrderTrackingId, setCurrentOrderTrackingId] = useState<string | null>(() => localStorage.getItem('active_order_id'));
  const [showTrackingView, setShowTrackingView] = useState(false);

  const [restaurantSettings, setRestaurantSettings] = useState(() => {
    const saved = localStorage.getItem('santa_parrilla_settings');
    if (saved) return JSON.parse(saved);
    return { ...DEFAULT_BRANDING, logoUrl: '', name: 'Santa Parrilla', sheetsWebhook: '' };
  });

  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const { data: menuData } = await supabase.from('menu').select('*');
      setMenuItems(menuData && menuData.length > 0 ? menuData : INITIAL_MENU);

      const { data: catData } = await supabase.from('categories').select('*').order('name');
      setCategories(catData && catData.length > 0 ? catData : INITIAL_CATEGORIES);

      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .neq('status', OrderStatus.DELIVERED)
        .order('createdAt', { ascending: false });
      if (ordersData) setOrders(ordersData);

      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'branding').single();
      if (settingsData) {
        setRestaurantSettings({ 
          name: settingsData.name, 
          logoUrl: settingsData.logoUrl || DEFAULT_BRANDING.logoUrl,
          sheetsWebhook: settingsData.sheetsWebhook || ''
        });
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('createdAt', { ascending: false });
      if (error) throw error;
      setAllOrdersHistory(data || []);
    } catch (err) {
      console.error("History error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const menuSub = supabase.channel('menu-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, fetchData).subscribe();
    const catSub = supabase.channel('cat-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData).subscribe();
    const ordersSub = supabase.channel('ord-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData).subscribe();
    return () => { supabase.removeChannel(menuSub); supabase.removeChannel(catSub); supabase.removeChannel(ordersSub); };
  }, [isStaffMode]);

  useEffect(() => {
    if (activeView === 'stats') fetchHistory();
  }, [activeView]);

  const salesReport = useMemo(() => {
    const report: Record<string, { name: string, quantity: number, total: number }> = {};
    let grandTotal = 0;
    allOrdersHistory.forEach(order => {
      grandTotal += order.total;
      order.items.forEach(item => {
        if (!report[item.name]) report[item.name] = { name: item.name, quantity: 0, total: 0 };
        report[item.name].quantity += item.quantity;
        const adds = (item.additions || []).reduce((s, a) => s + a.price, 0);
        report[item.name].total += (item.price + adds) * item.quantity;
      });
    });
    return {
      items: Object.values(report).sort((a, b) => b.quantity - a.quantity),
      grandTotal,
      orderCount: allOrdersHistory.length,
      history: allOrdersHistory
    };
  }, [allOrdersHistory]);

  const trackedOrder = useMemo(() => {
    if (!currentOrderTrackingId) return null;
    return orders.find(o => o.id === currentOrderTrackingId) || null;
  }, [orders, currentOrderTrackingId]);

  const handleExportAndCleanup = async () => {
    if (!restaurantSettings.sheetsWebhook) {
      return alert("Primero configura la URL de Google Sheets en el Panel Admin.");
    }
    if (!confirm("¿Deseas enviar los datos a Google Sheets y LIMPIAR las ventas de la semana?")) return;
    setIsExporting(true);
    try {
      await fetch(restaurantSettings.sheetsWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: restaurantSettings.name,
          date: new Date().toLocaleDateString(),
          totalSales: salesReport.grandTotal,
          orderCount: salesReport.orderCount,
          itemsReport: salesReport.items,
          rawHistory: allOrdersHistory
        })
      });
      await supabase.from('orders').delete().neq('id', '0');
      alert("¡Semana cerrada con éxito!");
      fetchHistory();
      fetchData();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally { setIsExporting(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setRestaurantSettings(prev => ({ ...prev, logoUrl: reader.result as string })); setLogoLoaded(false); };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      await supabase.from('settings').upsert({ 
        id: 'branding', 
        name: restaurantSettings.name, 
        logoUrl: restaurantSettings.logoUrl,
        sheetsWebhook: restaurantSettings.sheetsWebhook
      });
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
      fetchData();
    } finally { setIsSavingBranding(false); }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("¿Eliminar este plato?")) return;
    await supabase.from('menu').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    await supabase.from('categories').delete().eq('id', id);
    fetchData();
  };

  const addToCart = (item: FoodItem, quantity: number = 1, additions: FoodItem[] = []) => {
    setOrderItems(prev => [...prev, { ...item, quantity, additions }]);
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
      const { data, error } = await supabase.from('orders').insert([newOrder]).select();
      if (data && data[0]) {
        localStorage.setItem('active_order_id', data[0].id);
        setCurrentOrderTrackingId(data[0].id);
      }
      setOrderItems([]);
      setPaymentSuccess(true);
      setTimeout(() => { setPaymentSuccess(false); setIsCartOpen(false); setShowTrackingView(true); }, 2000);
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
    const adds = (item.additions || []).reduce((sum, add) => sum + add.price, 0);
    return acc + ((item.price + adds) * item.quantity);
  }, 0);

  const filteredMenu = useMemo(() => {
    if (activeCategory === 'Todas') return menuItems.filter(i => i.category.toLowerCase().trim() !== 'adiciones');
    return menuItems.filter(i => i.category === activeCategory);
  }, [menuItems, activeCategory]);

  const additionItems = useMemo(() => menuItems.filter(i => i.category.toLowerCase().trim() === 'adiciones'), [menuItems]);

  const getStatusStyles = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return { card: 'border-rose-100 bg-rose-50/20', badge: 'bg-rose-500 text-white', label: 'PENDIENTE', btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200', btnLabel: 'Recibir Pedido', icon: <AlertCircle className="w-5 h-5" /> };
      case OrderStatus.PREPARING: return { card: 'border-amber-100 bg-amber-50/20', badge: 'bg-amber-400 text-white', label: 'PREPARANDO', btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200', btnLabel: 'Terminar Plato', icon: <Play className="w-5 h-5" /> };
      case OrderStatus.READY: return { card: 'border-emerald-200 bg-emerald-50/20', badge: 'bg-emerald-500 text-white', label: 'LISTO', btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200', btnLabel: 'ENTREGAR PEDIDO', icon: <PackageCheck className="w-5 h-5" /> };
      default: return { card: 'border-slate-200 bg-white', badge: 'bg-slate-500 text-white', label: 'DESCONOCIDO', btn: 'bg-slate-900 text-white', btnLabel: 'Siguiente', icon: null };
    }
  };

  if (!hasEntered) {
    return (
      <div className="fixed inset-0 z-[500] flex flex-col items-center justify-between py-20 px-8 bg-[#020617] overflow-hidden">
        <AnimatedFireBackground />
        
        <div className="relative z-10 text-center animate-fade-scale">
          <span className="font-lettering text-orange-100/90 text-5xl md:text-7xl block tracking-wide drop-shadow-lg">
            Bienvenido a
          </span>
        </div>

        <div className="relative z-10 animate-fade-scale delay-100 flex items-center justify-center">
           <div className="absolute inset-0 bg-orange-600/10 blur-[100px] rounded-full scale-125"></div>
           <div className="w-64 h-64 md:w-80 md:h-80 rounded-full border-[10px] border-slate-900 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden bg-slate-950 p-2">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-orange-500/20 relative">
                {restaurantSettings.logoUrl ? (
                  <img 
                    src={restaurantSettings.logoUrl} 
                    className={`w-full h-full object-contain transition-opacity duration-1000 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`} 
                    onLoad={() => setLogoLoaded(true)} 
                  />
                ) : (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                    <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
           </div>
        </div>

        <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-12">
          <button 
            onClick={() => setHasEntered(true)} 
            className="w-full py-4.5 bg-[#F97316] hover:bg-orange-500 text-white rounded-full font-black uppercase text-base tracking-[0.2em] shadow-[0_10px_30px_rgba(249,115,22,0.3)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-4 btn-press border-b-4 border-orange-700"
          >
            INGRESAR <ArrowRight className="w-6 h-6" />
          </button>
          
          <p className="text-[10px] text-white/20 font-bold tracking-widest text-center uppercase">
            CREADO POR: PABLO RAMIREZ - PABLORAMIREZ9639@GMAIL.COM
          </p>
        </div>
      </div>
    );
  }

  const NavContent = () => (
    <div className="flex flex-col h-full glass-dark">
      <div className="p-10 text-center">
        <div className="w-20 h-20 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl overflow-hidden border border-white/10"><img src={restaurantSettings.logoUrl || DEFAULT_BRANDING.logoUrl} className="w-full h-full object-cover" /></div>
        <h1 className="text-xs font-black uppercase tracking-widest text-white/90 italic">{restaurantSettings.name}</h1>
      </div>
      <nav className="flex-1 px-6 space-y-3 overflow-y-auto no-scrollbar pb-10">
        {isStaffMode ? (
          <>
            <SidebarItem icon={<ChefHat className="w-5 h-5" />} label="Preparaciones" active={activeView === 'kitchen'} onClick={() => {setActiveView('kitchen'); setIsMobileMenuOpen(false);}} badge={orders.length} />
            <SidebarItem icon={<BarChart3 className="w-5 h-5" />} label="Reportes" active={activeView === 'stats'} onClick={() => {setActiveView('stats'); setIsMobileMenuOpen(false);}} />
            <SidebarItem icon={<Settings className="w-5 h-5" />} label="Gestión" active={activeView === 'admin'} onClick={() => {setActiveView('admin'); setIsMobileMenuOpen(false);}} />
            <button onClick={() => {setIsStaffMode(false); setActiveView('menu'); setIsMobileMenuOpen(false);}} className="w-full mt-10 p-5 text-rose-400 hover:bg-rose-500/10 rounded-2xl flex items-center gap-4 font-black text-[10px] uppercase transition-all"><LogOut className="w-4 h-4" /> Salir</button>
          </>
        ) : (
          <>
            <SidebarItem icon={<LayoutGrid className="w-5 h-5" />} label="Todas" active={activeCategory === 'Todas'} onClick={() => {setActiveCategory('Todas'); setIsMobileMenuOpen(false);}} />
            {categories.map(c => <SidebarItem key={c.id} icon={<span className="text-lg">{c.icon}</span>} label={c.name} active={activeCategory === c.name} onClick={() => {setActiveCategory(c.name); setIsMobileMenuOpen(false);}} />)}
            {trackedOrder && (
              <SidebarItem icon={<Timer className="w-5 h-5" />} label="Mi Pedido" active={showTrackingView} onClick={() => {setShowTrackingView(true); setIsMobileMenuOpen(false);}} />
            )}
            <div className="pt-10 border-t border-white/5 mt-6"><button onClick={() => {setShowLogin(true); setIsMobileMenuOpen(false);}} className="w-full p-5 text-white/40 hover:text-white rounded-3xl flex items-center gap-4 font-black text-[9px] uppercase tracking-widest border border-white/5 transition-all"><Lock className="w-4 h-4" /> Staff</button></div>
          </>
        )}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-[#F8F9FA] text-slate-900">
      <aside className="hidden md:flex flex-col text-white w-72 h-screen sticky top-0 shrink-0"><NavContent /></aside>
      {isMobileMenuOpen && <div className="fixed inset-0 z-[100] md:hidden"><div className="absolute inset-0 bg-[#020617]/60 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)} /><div className="relative w-72 h-full bg-[#020617] text-white animate-in slide-in-from-left duration-300"><NavContent /></div></div>}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 glass border-b border-slate-200/50 z-40 px-6 py-4 flex justify-between items-center pt-safe">
          <div className="flex items-center gap-5"><button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-3 bg-white rounded-2xl shadow-premium active:scale-90 text-slate-900"><LayoutGrid className="w-5 h-5" /></button><h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-slate-900">{isStaffMode ? (activeView === 'kitchen' ? 'Cocina' : activeView === 'stats' ? 'Reportes' : 'Panel Admin') : restaurantSettings.name}</h2></div>
          {!isStaffMode && (
            <div className="flex items-center gap-3">
              {trackedOrder && (
                <button onClick={() => setShowTrackingView(true)} className="hidden sm:flex items-center gap-3 px-5 py-3.5 bg-orange-100 text-orange-600 rounded-2xl font-black text-[10px] uppercase shadow-inner border border-orange-200 animate-pulse">
                  <Clock className="w-4 h-4" /> {trackedOrder.status === OrderStatus.READY ? '¡LISTO!' : 'EN PROGRESO'}
                </button>
              )}
              <button onClick={() => setIsCartOpen(true)} className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl flex items-center gap-4 relative shadow-2xl active:scale-95 transition-all btn-press">
                <ShoppingBag className="w-4 h-4 text-orange-400" />
                <span className="font-black text-xs tracking-wider">${formatPrice(cartTotal)}</span>
                {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#F8F9FA]">{cart.length}</span>}
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 p-4 md:p-12 max-w-7xl mx-auto w-full pb-32">
          {activeView === 'menu' && !isStaffMode && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredMenu.map(item => (
                <div key={item.id} onClick={() => setSelectedFoodForDetail(item)} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-premium flex flex-col group transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer animate-fade-scale">
                  <div className="h-40 md:h-56 overflow-hidden relative"><img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /><div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-black shadow-lg text-slate-900">${formatPrice(item.price)}</div></div>
                  <div className="p-4 md:p-6 flex flex-col flex-1"><h3 className="text-xs md:text-lg font-black text-slate-900 uppercase italic mb-1 truncate">{item.name}</h3><p className="text-[9px] md:text-xs text-slate-500 line-clamp-2 mb-4 font-medium">{item.description}</p><button className="mt-auto w-full py-2.5 bg-slate-50 hover:bg-slate-900 hover:text-white transition-all rounded-2xl font-black text-[9px] uppercase border border-slate-100 text-slate-900">PEDIR</button></div>
                </div>
              ))}
            </div>
          )}

          {isStaffMode && activeView === 'stats' && (
            <div className="space-y-12 animate-fade-scale">
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-premium flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center shadow-inner"><DollarSign className="w-8 h-8" /></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Ventas</p><h4 className="text-3xl font-black text-slate-900 italic">${formatPrice(salesReport.grandTotal)}</h4></div>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-premium flex items-center gap-6">
                    <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-3xl flex items-center justify-center shadow-inner"><PackageCheck className="w-8 h-8" /></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedidos Totales</p><h4 className="text-3xl font-black text-slate-900 italic">{salesReport.orderCount}</h4></div>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-premium flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-inner"><TrendingUp className="w-8 h-8" /></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items Vendidos</p><h4 className="text-3xl font-black text-slate-900 italic">{salesReport.items.reduce((acc, curr) => acc + curr.quantity, 0)}</h4></div>
                  </div>
               </div>

               <div className="bg-white rounded-[3rem] border border-slate-200 overflow-hidden shadow-2xl">
                 <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <div>
                     <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-3">
                       <History className="w-6 h-6 text-orange-600" /> Historial de Ventas
                     </h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Últimos pedidos registrados</p>
                   </div>
                   <button onClick={handleExportAndCleanup} disabled={isExporting} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50">
                     {isExporting ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <FileSpreadsheet className="w-5 h-5" />}
                     <span className="text-[10px] font-black uppercase tracking-widest">Cerrar Semana</span>
                   </button>
                 </div>
                 
                 <div className="overflow-x-auto no-scrollbar">
                   {salesReport.history.length === 0 ? (
                     <div className="py-20 text-center opacity-30">
                       <DatabaseZap className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                       <p className="font-black uppercase text-xs tracking-widest">No hay ventas registradas</p>
                     </div>
                   ) : (
                     <table className="w-full text-left border-collapse">
                       <thead>
                         <tr className="bg-slate-50/80 border-b border-slate-100">
                           <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</th>
                           <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                           <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Items</th>
                           <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Total</th>
                           <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Estado</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                         {salesReport.history.map((order) => (
                           <tr key={order.id} className="hover:bg-slate-50/30 transition-colors">
                             <td className="p-6">
                               <div className="flex flex-col">
                                 <span className="font-black text-slate-900 uppercase italic text-sm">{order.customerName}</span>
                                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">#{order.id.slice(-4)} • Mesa {order.tableNumber}</span>
                               </div>
                             </td>
                             <td className="p-6">
                               <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                                 <Calendar className="w-3.5 h-3.5" /> {formatDate(order.createdAt)}
                               </div>
                             </td>
                             <td className="p-6">
                               <div className="flex flex-wrap gap-1.5 max-w-xs">
                                 {order.items.map((it, idx) => (
                                   <span key={idx} className="bg-slate-100 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded-md uppercase">
                                     {it.quantity}x {it.name}
                                   </span>
                                 ))}
                               </div>
                             </td>
                             <td className="p-6">
                               <span className="font-black text-slate-900 text-lg italic tracking-tight">${formatPrice(order.total)}</span>
                             </td>
                             <td className="p-6">
                               <div className="flex justify-center">
                                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${order.status === OrderStatus.DELIVERED ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                   {order.status === OrderStatus.DELIVERED ? 'Entregado' : order.status}
                                 </span>
                               </div>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   )}
                 </div>
               </div>
            </div>
          )}

          {isStaffMode && activeView === 'kitchen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {orders.map(order => {
                const styles = getStatusStyles(order.status);
                return (
                  <div key={order.id} className={`bg-white border-[3px] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative animate-fade-scale transition-all ${styles.card}`}>
                    <div className="p-8 pb-6 border-b border-dashed flex justify-between items-start">
                      <div className="space-y-3"><div className="flex flex-wrap items-center gap-3"><span className={`px-4 py-1 rounded-2xl text-xs font-black uppercase tracking-widest shadow-md ${styles.badge}`}>{styles.label}</span><span className="font-mono text-sm text-slate-400 font-bold uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-xl">MESA • {order.tableNumber}</span></div><p className="text-3xl font-black text-slate-950 uppercase italic leading-none">{order.customerName}</p></div>
                      <OrderTimer startTime={order.createdAt} status={order.status} />
                    </div>
                    <div className="p-10 flex-1 space-y-6">{order.items.map((item, idx) => (<div key={idx} className="space-y-2"><div className="flex items-center gap-5 text-lg font-black text-slate-800"><span className="bg-slate-950 text-white w-10 h-10 flex items-center justify-center rounded-xl text-xs font-black shadow-lg">{item.quantity}</span><span className="uppercase truncate flex-1 tracking-tight">{item.name}</span></div>{item.additions && item.additions.length > 0 && (<div className="ml-15 flex flex-wrap gap-2">{item.additions.map((add, ai) => (<span key={ai} className="bg-orange-50 text-orange-600 text-[10px] font-black px-3 py-1 rounded-full border border-orange-100 uppercase italic tracking-wider">+{add.name}</span>))}</div>)}</div>))}</div>
                    <div className="p-10 pt-0"><button onClick={() => updateStatus(order.id, order.status)} className={`w-full py-6 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all btn-press flex items-center justify-center gap-4 ${styles.btn}`}>{styles.icon}{styles.btnLabel}</button></div>
                  </div>
                );
              })}
            </div>
          )}

          {isStaffMode && activeView === 'admin' && (
            <div className="max-w-4xl mx-auto space-y-12 pb-20">
                <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-premium">
                    <div className="flex justify-between items-center mb-10"><div><h4 className="text-lg md:text-xl font-black italic uppercase tracking-tighter text-slate-900">Marca</h4><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuraciones</p></div><button onClick={handleSaveBranding} className={`px-10 py-4 rounded-full font-black text-xs uppercase shadow-xl ${brandingSaved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>{brandingSaved ? 'Guardado' : 'Guardar'}</button></div>
                    <div className="space-y-6">
                      <div className="flex flex-col md:flex-row gap-6 items-center"><div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden border border-white/10 shrink-0" onClick={() => fileInputRef.current?.click()}>{restaurantSettings.logoUrl ? <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" /> : <Upload className="w-8 h-8 text-orange-500" />}</div><input type="text" value={restaurantSettings.name} onChange={e => setRestaurantSettings({...restaurantSettings, name: e.target.value})} className="w-full p-5 bg-slate-50 rounded-3xl font-black text-sm outline-none border border-slate-200" placeholder="Nombre" /><input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Webhook Google Sheets</label><input type="text" value={restaurantSettings.sheetsWebhook} onChange={e => setRestaurantSettings({...restaurantSettings, sheetsWebhook: e.target.value})} className="w-full p-5 bg-slate-50 rounded-3xl font-mono text-[10px] outline-none border border-slate-200" placeholder="https://..." /></div>
                    </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center px-6"><div><h4 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate-900">Categorías</h4></div><button onClick={() => { setEditingCategory(null); setIsCategoryFormOpen(true); }} className="bg-orange-600 text-white px-8 py-4 rounded-full font-black text-[10px] uppercase shadow-orange-glow"><PlusCircle className="w-4 h-4 inline mr-2" /> Nueva</button></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{categories.map(cat => (<div key={cat.id} className="bg-white p-5 rounded-[2rem] border border-slate-200 flex items-center gap-5"><div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xl shadow-inner">{cat.icon}</div><h5 className="flex-1 font-black uppercase text-xs italic text-slate-900">{cat.name}</h5><div className="flex gap-2"><button onClick={() => { setEditingCategory(cat); setIsCategoryFormOpen(true); }} className="p-3 bg-slate-50 text-slate-400 rounded-xl"><Edit2 className="w-3.5 h-3.5" /></button><button onClick={() => handleDeleteCategory(cat.id)} className="p-3 bg-rose-50 text-rose-400 rounded-xl"><Trash2 className="w-3.5 h-3.5" /></button></div></div>))}</div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center px-6"><div><h4 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate-900">Menú</h4></div><button onClick={() => { setEditingItem(null); setIsAdminFormOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-full font-black text-[10px] uppercase shadow-xl"><PlusCircle className="w-4 h-4 inline mr-2" /> Nuevo</button></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">{menuItems.map(item => (<div key={item.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 flex items-center gap-6"><img src={item.image} className="w-20 h-20 rounded-[1.2rem] object-cover shadow-lg" /><div className="flex-1 min-w-0"><h5 className="font-black uppercase text-xs italic mb-1 truncate text-slate-900">{item.name}</h5><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.category}</p></div><div className="flex items-center gap-3"><button onClick={() => { setEditingItem(item); setIsAdminFormOpen(true); }} className="p-3 bg-slate-50 text-slate-400 rounded-xl"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDeleteItem(item.id)} className="p-3 bg-rose-50 text-rose-400 rounded-xl"><Trash2 className="w-4 h-4" /></button></div></div>))}</div>
                </div>
            </div>
          )}
        </main>F
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[150] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-12 text-center shadow-2xl">
             <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 text-slate-900 shadow-inner"><Lock className="w-8 h-8" /></div>
             <input type="password" placeholder="••••" maxLength={4} className="w-full py-5 bg-slate-50 rounded-2xl text-center text-4xl font-black tracking-[0.8em] outline-none border border-slate-200 focus:border-orange-500 shadow-inner" autoFocus onChange={(e) => { if(e.target.value === '9999') { setIsStaffMode(true); setShowLogin(false); setActiveView('kitchen'); } }} />
             <button onClick={() => setShowLogin(false)} className="mt-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button>
          </div>
        </div>
      )}

      {selectedFoodForDetail && <FoodDetailModal item={selectedFoodForDetail} additions={additionItems} onAdd={addToCart} onClose={() => setSelectedFoodForDetail(null)} />}
      {isCartOpen && <CartView cart={cart} setCart={setOrderItems} customerName={customerName} setCustomerName={setCustomerName} tableNumber={tableNumber} setTableNumber={setTableNumber} cartTotal={cartTotal} isPaying={isPaying} paymentSuccess={paymentSuccess} handlePayment={handlePayment} onClose={() => setIsCartOpen(false)} />}
      {showTrackingView && trackedOrder && <OrderTrackingView order={trackedOrder} onClose={() => setShowTrackingView(false)} />}

      {isAdminFormOpen && (
        <AdminForm item={editingItem} categories={categories} onSave={async (d: any) => { 
          const isInitial = d.id && (d.id.startsWith('b') || d.id.startsWith('c') || d.id.startsWith('p') || d.id.startsWith('add'));
          if (d.id && !isInitial) await supabase.from('menu').upsert(d);
          else { const { id, ...newItem } = d; await supabase.from('menu').insert([newItem]); }
          setIsAdminFormOpen(false); fetchData();
        }} onClose={() => setIsAdminFormOpen(false)} />
      )}

      {isCategoryFormOpen && (
        <CategoryForm category={editingCategory} onSave={async (d: any) => { 
          const isInitial = d.id && d.id.startsWith('cat');
          if (d.id && !isInitial) await supabase.from('categories').upsert(d); 
          else { const { id, ...newCat } = d; await supabase.from('categories').insert([newCat]); }
          setIsCategoryFormOpen(false); fetchData(); 
        }} onClose={() => setIsCategoryFormOpen(false)} />
      )}
    </div>
  );
};

const OrderTrackingView = ({ order, onClose }: { order: Order, onClose: () => void }) => {
  const steps = [
    { status: OrderStatus.PENDING, label: 'Recibido', icon: <Bell className="w-6 h-6" /> },
    { status: OrderStatus.PREPARING, label: 'En Cocina', icon: <UtensilsCrossed className="w-6 h-6" /> },
    { status: OrderStatus.READY, label: '¡LISTO!', icon: <Sparkles className="w-6 h-6" /> }
  ];

  const currentIdx = steps.findIndex(s => s.status === order.status);

  return (
    <div className="fixed inset-0 z-[450] bg-slate-950 flex flex-col p-6 animate-in fade-in">
      <AnimatedFireBackground />
      <div className="relative z-10 flex-1 flex flex-col max-w-xl mx-auto w-full">
        <header className="flex justify-between items-center py-8">
           <button onClick={onClose} className="p-4 bg-white/5 rounded-2xl text-white hover:bg-white/10 transition-all"><X className="w-6 h-6" /></button>
           <div className="text-right">
             <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Orden #{order.id.slice(-4).toUpperCase()}</p>
             <h3 className="text-white font-black text-xl italic uppercase truncate max-w-[150px]">{order.customerName}</h3>
           </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
          <div className="relative">
             <div className={`w-48 h-48 md:w-64 md:h-64 rounded-full border-[6px] border-orange-500/20 flex items-center justify-center relative ${order.status === OrderStatus.READY ? 'shadow-[0_0_80px_rgba(249,115,22,0.4)] animate-pulse' : ''}`}>
                <div className="absolute inset-4 rounded-full border-2 border-dashed border-orange-500/30 animate-spin-slow" />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 md:w-28 md:h-28 bg-orange-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl animate-bounce">
                    {steps[currentIdx]?.icon}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">ESTADO</p>
                    <h2 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter">{steps[currentIdx]?.label}</h2>
                  </div>
                </div>
             </div>
          </div>

          <div className="w-full space-y-8">
             <div className="flex justify-between relative px-2">
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/5 -translate-y-1/2 rounded-full" />
                <div className="absolute top-1/2 left-0 h-1 bg-orange-600 -translate-y-1/2 rounded-full transition-all duration-1000" style={{ width: `${(currentIdx / (steps.length - 1)) * 100}%` }} />
                {steps.map((s, i) => (
                  <div key={i} className="relative z-10 flex flex-col items-center gap-3">
                    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${i <= currentIdx ? 'bg-orange-600 border-orange-400 text-white scale-110' : 'bg-slate-900 border-slate-800 text-white/20'}`}>
                      {i <= currentIdx ? <Check className="w-4 h-4 md:w-6 md:h-6" /> : <span className="text-xs font-black">{i + 1}</span>}
                    </div>
                    <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${i <= currentIdx ? 'text-white' : 'text-white/20'}`}>{s.label}</span>
                  </div>
                ))}
             </div>
             
             <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
                <div className="flex justify-between items-center">
                  <div className="text-left">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Tiempo Transcurrido</p>
                    <OrderTimer startTime={order.createdAt} light />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Ubicación</p>
                    <p className="text-xl font-black text-white italic uppercase tracking-tighter">MESA • {order.tableNumber}</p>
                  </div>
                </div>
             </div>
          </div>
        </main>

        <footer className="py-10">
          <button onClick={onClose} className="w-full py-5 bg-white text-slate-950 rounded-full font-black uppercase text-[10px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all">Regresar al Menú</button>
        </footer>
      </div>
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
  <button onClick={onClick} className={`relative w-full p-4 flex items-center gap-4 rounded-[1.5rem] transition-all duration-300 group ${active ? 'bg-orange-600 text-white shadow-orange-glow' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}>
    <div className={`transition-all duration-300 ${active ? 'scale-110' : 'group-hover:scale-110 opacity-60 group-hover:opacity-100'}`}>{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-left truncate">{label}</span>
    {badge > 0 && <span className="absolute top-2 right-2 bg-white text-orange-600 text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-lg shadow-lg border border-orange-100">{badge}</span>}
  </button>
);

const FoodDetailModal = ({ item, additions, onAdd, onClose }: { item: FoodItem, additions: FoodItem[], onAdd: (item: FoodItem, qty: number, additions: FoodItem[]) => void, onClose: () => void }) => {
  const [qty, setQty] = useState(1);
  const [selectedAdds, setSelectedAdds] = useState<FoodItem[]>([]);
  const toggleAddition = (add: FoodItem) => setSelectedAdds(prev => prev.find(i => i.id === add.id) ? prev.filter(i => i.id !== add.id) : [...prev, add]);
  const totalPrice = (item.price + selectedAdds.reduce((sum, a) => sum + a.price, 0)) * qty;

  return (
    <div className="fixed inset-0 z-[400] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-xl">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-t-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="relative h-56 md:h-80 shrink-0">
          <img src={item.image} className="w-full h-full object-cover" />
          <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-black/20 backdrop-blur-md rounded-2xl text-white"><X className="w-6 h-6" /></button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/80 to-transparent p-6 md:p-10 pt-16">
             <div className="flex justify-between items-end gap-4"><div className="min-w-0"><h2 className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-tight mb-1 truncate">{item.name}</h2><p className="text-[9px] md:text-xs font-black text-orange-600 uppercase tracking-widest">{item.category}</p></div><div className="text-right shrink-0"><span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Subtotal</span><span className="text-2xl md:text-4xl font-black text-slate-900 italic tracking-tighter leading-none">${formatPrice(totalPrice)}</span></div></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 no-scrollbar">
          <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed">{item.description}</p>
          <div className="space-y-4 md:space-y-6">
            <div className="flex justify-between items-center"><label className="text-[10px] md:text-[11px] font-black text-slate-900 uppercase tracking-widest">¿Algo extra?</label></div>
            <div className="grid grid-cols-1 gap-2 md:gap-3">{additions.map(add => { const isSelected = selectedAdds.find(i => i.id === add.id); return (<button key={add.id} onClick={() => toggleAddition(add)} className={`p-4 md:p-5 rounded-2xl md:rounded-3xl border transition-all flex items-center justify-between group ${isSelected ? 'bg-orange-600 border-orange-500 text-white shadow-orange-glow' : 'bg-slate-50 border-slate-100 hover:border-slate-200 text-slate-900'}`}><div className="flex items-center gap-3 md:gap-4 text-left"><div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-white/20' : 'bg-white shadow-sm'}`}><Plus className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`} /></div><div><p className="text-[10px] md:text-[11px] font-black uppercase italic leading-none mb-1">{add.name}</p><p className={`text-[9px] md:text-[10px] font-bold ${isSelected ? 'text-orange-200' : 'text-slate-400'}`}>+${formatPrice(add.price)}</p></div></div>{isSelected && <Check className="w-4 h-4" />}</button>); })}</div>
          </div>
        </div>
        <div className="p-6 md:p-10 border-t bg-slate-50 flex items-center justify-between gap-4 pb-safe">
          <div className="flex items-center gap-3 bg-white p-1.5 rounded-full border border-slate-200 shrink-0"><button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-slate-400"><Minus className="w-5 h-5" /></button><span className="text-xl md:text-2xl font-black text-slate-900 w-8 md:w-10 text-center italic">{qty}</span><button onClick={() => setQty(q => q + 1)} className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-slate-900 text-white shadow-lg"><Plus className="w-5 h-5" /></button></div>
          <button onClick={() => onAdd(item, qty, selectedAdds)} className="flex-1 py-5 bg-orange-600 text-white rounded-full font-black uppercase text-[10px] tracking-[0.3em] shadow-orange-glow hover:bg-orange-500 transition-all btn-press flex items-center justify-center gap-2">CONFIRMAR <ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
};

const CartView = ({ cart, setCart, customerName, setCustomerName, tableNumber, setTableNumber, cartTotal, isPaying, paymentSuccess, handlePayment, onClose }: any) => {
  const removeItem = (idx: number) => setCart((prev: any[]) => prev.filter((_, i) => i !== idx));
  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
         <div className="p-6 md:p-8 border-b flex justify-between items-center pt-safe"><h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate-900">Tu <span className="text-orange-600 not-italic">Orden</span></h2><button onClick={onClose} className="p-2 bg-slate-100 rounded-xl text-slate-900"><X className="w-5 h-5" /></button></div>
         <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 no-scrollbar">
            {cart.length === 0 ? <div className="py-24 text-center opacity-20"><ShoppingBasket className="w-16 h-16 mx-auto mb-6 text-slate-900" /><p className="font-black uppercase text-[10px] tracking-[0.3em]">Carrito Vacío</p></div> : cart.map((item: any, idx: number) => {
              const addsPrice = (item.additions || []).reduce((sum: number, add: any) => sum + add.price, 0);
              return (
                <div key={idx} className="flex flex-col gap-3 bg-slate-50/80 p-5 rounded-[2rem] border border-slate-100 relative">
                  <button onClick={() => removeItem(idx)} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                  <div className="flex items-center gap-4"><img src={item.image} className="w-14 h-14 rounded-xl object-cover shadow-lg shrink-0" /><div className="flex-1 min-w-0"><p className="text-[11px] font-black uppercase italic text-slate-900 truncate mb-1">{item.name}</p><p className="text-[9px] font-black text-orange-600 uppercase tracking-widest">${formatPrice(item.price + addsPrice)} c/u</p><p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">CANTIDAD: {item.quantity}</p></div></div>
                </div>
              );
            })}
            {cart.length > 0 && <div className="pt-4 space-y-3"><input type="text" placeholder="Tu Nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-[10px] uppercase border border-slate-100 focus:border-orange-500 shadow-inner" /><input type="text" placeholder="Mesa o Dirección" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-[10px] uppercase border border-slate-100 focus:border-orange-500 shadow-inner" /></div>}
         </div>
         <div className="p-6 md:p-10 border-t glass pb-safe">
            <div className="flex justify-between items-end mb-6 text-slate-900"><span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-1 leading-none">Total</span><span className="text-3xl font-black tracking-tighter italic leading-none">${formatPrice(cartTotal)}</span></div>
            <button onClick={handlePayment} disabled={cart.length === 0 || isPaying || !customerName} className={`w-full py-5 rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl transition-all btn-press ${paymentSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white disabled:opacity-20'}`}>{isPaying ? 'Enviando...' : paymentSuccess ? '¡Enviado!' : 'Confirmar Pedido'}</button>
         </div>
      </div>
    </div>
  );
};

const CategoryForm = ({ category, onSave, onClose }: any) => {
  const [data, setData] = useState(category || { name: '', icon: '🍴' });
  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl z-[350] flex items-center justify-center p-6"><div className="bg-white w-full max-sm rounded-[2.5rem] p-8 shadow-2xl text-slate-900"><h2 className="text-xl font-black uppercase italic tracking-tighter mb-6 text-center">Gestionar <span className="text-orange-600 not-italic">Categoría</span></h2><div className="space-y-4"><div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Icono / Emoji</label><input type="text" value={data.icon} onChange={e => setData({...data, icon: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xl text-center outline-none border border-slate-200 focus:border-orange-500" maxLength={2} /></div><div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Nombre</label><input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border border-slate-200 focus:border-orange-500 uppercase" placeholder="Ej: Hamburguesas" /></div><div className="pt-4"><button onClick={() => onSave(data)} className="w-full py-5 bg-slate-900 text-white rounded-full font-black uppercase text-[10px] tracking-[0.3em] shadow-xl">Guardar</button><button onClick={onClose} className="w-full mt-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Cerrar</button></div></div></div></div>
  );
};

const AdminForm = ({ item, categories, onSave, onClose }: any) => {
  const [data, setData] = useState(item || { name: '', price: 0, category: categories[0]?.name || '', image: '', description: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const localFileRef = useRef<HTMLInputElement>(null);
  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setData({ ...data, image: reader.result as string }); reader.readAsDataURL(file); } };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl z-[300] flex items-center justify-center p-4 overflow-y-auto"><div className="bg-white w-full max-w-xl rounded-[2.5rem] p-6 md:p-14 shadow-2xl text-slate-900 relative my-auto"><h2 className="text-2xl font-black uppercase italic tracking-tighter mb-6 text-center md:text-left">Gestionar <span className="text-orange-600 not-italic">Plato</span></h2><div className="space-y-4 md:space-y-6"><div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-4 tracking-widest">Nombre</label><input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm outline-none border border-slate-200 focus:border-orange-500 shadow-inner" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Precio</label><input type="number" step="0.01" value={data.price} onChange={e => setData({...data, price: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm outline-none border border-slate-200 shadow-inner" /></div><div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Categoría</label><select value={data.category} onChange={e => setData({...data, category: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border border-slate-200 shadow-inner uppercase appearance-none cursor-pointer">{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div></div><div className="space-y-3"><div className="flex justify-between px-4"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imagen</label><div className="flex gap-4"><button onClick={() => localFileRef.current?.click()} className="text-slate-900 text-[9px] font-black uppercase flex items-center gap-1"><Upload className="w-3 h-3" /> CARGAR</button><button onClick={async () => { if(!data.name) return; setIsGenerating(true); try { const img = await generateFoodImage(data.name); if (img) setData({ ...data, image: img }); } finally { setIsGenerating(false); } }} disabled={isGenerating} className="text-orange-600 text-[9px] font-black uppercase flex items-center gap-1"><ImageIcon className="w-3 h-3" /> IA</button></div></div><div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-inner">{data.image && <img src={data.image} className="w-12 h-12 rounded-xl object-cover shadow-lg border border-white shrink-0" />}<input type="text" value={data.image} onChange={e => setData({...data, image: e.target.value})} className="flex-1 bg-transparent font-bold text-[9px] outline-none truncate" placeholder="URL o carga archivo..." /><input type="file" ref={localFileRef} onChange={handleLocalUpload} className="hidden" accept="image/*" /></div></div><div className="space-y-1.5"><div className="flex justify-between px-4"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción</label><button onClick={async () => { if(!data.name) return; setIsGenerating(true); try { const desc = await improveDescription(data.name); setData({ ...data, description: desc }); } finally { setIsGenerating(false); } }} disabled={isGenerating} className="text-orange-600 text-[9px] font-black uppercase flex items-center gap-1"><Wand2 className="w-3 h-3" /> IA</button></div><textarea value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none border border-slate-200 h-24 shadow-inner resize-none" /></div><div className="pt-4 md:pt-6"><button onClick={() => onSave(data)} className="w-full py-5 bg-slate-900 text-white rounded-full font-black uppercase text-[10px] tracking-[0.3em] shadow-2xl">Confirmar</button><button onClick={onClose} className="w-full mt-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Cerrar</button></div></div></div></div>
  );
};

export default App;
