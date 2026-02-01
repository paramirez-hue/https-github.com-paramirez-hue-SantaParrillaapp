
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShoppingBag, ChefHat, Plus, Minus, X, Info,
  Timer, ShoppingBasket, Edit2, Trash2, Lock, LogOut, 
  Settings, LayoutGrid, Image as ImageIcon, Wand2, Save, Check, PlusCircle, Upload, ArrowRight, Tag, ChevronRight, AlertCircle, Play, PackageCheck, BarChart3, TrendingUp, DollarSign, FileSpreadsheet, DatabaseZap, Clock, Bell, UtensilsCrossed, Sparkles, Send, ExternalLink, QrCode, Banknote, CreditCard, ArrowRightLeft, RefreshCcw, ChevronDown
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { FoodItem, Order, OrderItem, OrderStatus, PaymentStatus, ViewType, Category, PaymentMethod } from './types';
import { INITIAL_MENU, INITIAL_CATEGORIES, DEFAULT_BRANDING } from './constants';
import { improveDescription, generateFoodImage } from './geminiService';

const SUPABASE_URL = "https://ejerqcxzvfwnccdadytj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Y3cEubsUUZwHNOKj1uqasQ_lrzXbdS6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const formatPrice = (amount: number) => {
  return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
};

const AnimatedFireBackground = () => {
  const sparks = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: `${2 + Math.random() * 6}s`,
      delay: `${Math.random() * 8}s`,
      drift: `${(Math.random() - 0.5) * 400}px`,
      size: `${1 + Math.random() * 3}px`,
      rot: `${Math.random() * 720}deg`,
      opacity: 0.4 + Math.random() * 0.6
    }));
  }, []);

  return (
    <div className="embers-container pointer-events-none">
      <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[150%] h-[50%] bg-orange-900/40 rounded-[100%] mix-blend-screen" style={{ animation: 'fireGlow 6s infinite ease-in-out', filter: 'blur(100px)' }} />
      <div className="absolute bottom-[-5%] left-1/2 -translate-x-1/2 w-[100%] h-[30%] bg-red-600/20 rounded-[100%] mix-blend-overlay" style={{ animation: 'fireGlow 4s infinite ease-in-out alternate', filter: 'blur(70px)' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-orange-950/30 to-transparent" style={{ animation: 'heatHaze 8s infinite ease-in-out' }} />
      {sparks.map(spark => (
        <div key={spark.id} className="spark" style={{ left: spark.left, width: spark.size, height: `calc(${spark.size} * 2)`, opacity: spark.opacity, '--drift': spark.drift, '--rot': spark.rot, animation: `sparkUp ${spark.duration} linear infinite ${spark.delay}` } as any} />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.9)_100%)]" />
    </div>
  );
};

const OrderTimer: React.FC<{ startTime: any, status?: OrderStatus, light?: boolean }> = ({ startTime, status, light }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;
    const interval = setInterval(() => { setElapsed(Math.floor((Date.now() - start) / 60000)); }, 10000);
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
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [selectedFoodForDetail, setSelectedFoodForDetail] = useState<FoodItem | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('CASH');
  const [showTransferScreen, setShowTransferScreen] = useState(false);
  
  const [currentOrderTrackingId, setCurrentOrderTrackingId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('active_order_id');
    return null;
  });
  const [showTrackingView, setShowTrackingView] = useState(false);

  const [restaurantSettings, setRestaurantSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('santa_parrilla_settings');
      if (saved) return JSON.parse(saved);
    }
    return { ...DEFAULT_BRANDING, logoUrl: DEFAULT_BRANDING.logoUrl, name: 'Santa Parrilla', sheetsWebhook: '', qrUrl: '', transferUrl: '' };
  });

  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const { data: menuData } = await supabase.from('menu').select('*');
      setMenuItems(menuData || []);
      const { data: catData } = await supabase.from('categories').select('*').order('name');
      setCategories(catData && catData.length > 0 ? catData : INITIAL_CATEGORIES);
      const { data: ordersData } = await supabase.from('orders').select('*').neq('status', OrderStatus.DELIVERED).order('createdAt', { ascending: false });
      if (ordersData) setOrders(ordersData);

      if (!isSavingBranding) {
        const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'branding').single();
        if (settingsData) {
          setRestaurantSettings(prev => ({ 
            ...prev,
            name: settingsData.name || prev.name, 
            logoUrl: settingsData.logoUrl || prev.logoUrl,
            sheetsWebhook: settingsData.sheetsWebhook || prev.sheetsWebhook,
            qrUrl: settingsData.qrUrl || prev.qrUrl,
            transferUrl: settingsData.transferUrl || prev.transferUrl
          }));
        }
      }
    } catch (err) { console.error("Fetch error:", err); }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase.from('orders').select('*');
      if (error) throw error;
      setAllOrdersHistory(data || []);
    } catch (err) { console.error("History error:", err); }
  };

  useEffect(() => {
    fetchData();
    const menuSub = supabase.channel('menu-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, fetchData).subscribe();
    const ordersSub = supabase.channel('ord-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData).subscribe();
    return () => { supabase.removeChannel(menuSub); supabase.removeChannel(ordersSub); };
  }, [isStaffMode]);

  useEffect(() => { if (activeView === 'stats') fetchHistory(); }, [activeView]);

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
    return { items: Object.values(report).sort((a, b) => b.quantity - a.quantity), grandTotal, orderCount: allOrdersHistory.length };
  }, [allOrdersHistory]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setRestaurantSettings(prev => ({ ...prev, logoUrl: reader.result as string })); setLogoLoaded(false); };
      reader.readAsDataURL(file);
    }
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setRestaurantSettings(prev => ({ ...prev, qrUrl: reader.result as string })); };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      if (typeof window !== 'undefined') localStorage.setItem('santa_parrilla_settings', JSON.stringify(restaurantSettings));
      const payload = { id: 'branding', name: restaurantSettings.name, logoUrl: restaurantSettings.logoUrl, sheetsWebhook: restaurantSettings.sheetsWebhook, qrUrl: restaurantSettings.qrUrl, transferUrl: restaurantSettings.transferUrl };
      await supabase.from('settings').upsert(payload);
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
      fetchData();
    } finally { setIsSavingBranding(false); }
  };

  const addToCart = (item: FoodItem, quantity: number = 1, additions: FoodItem[] = []) => {
    setOrderItems(prev => [...prev, { ...item, quantity, additions }]);
    setSelectedFoodForDetail(null);
  };

  const handlePaymentConfirm = async () => {
    if (!customerName) return alert("Ingresa tu nombre");
    if (selectedPaymentMethod === 'TRANSFER' && !showTransferScreen) { setShowTransferScreen(true); return; }
    setIsPaying(true);
    try {
      const newOrder = { 
        items: cart, 
        total: cartTotal, 
        status: OrderStatus.PENDING, 
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: selectedPaymentMethod,
        customerName, 
        tableNumber: tableNumber || 'Llevar', 
        createdAt: new Date().toISOString() 
      };
      const { data } = await supabase.from('orders').insert([newOrder]).select();
      if (data && data[0]) {
        if (typeof window !== 'undefined') localStorage.setItem('active_order_id', data[0].id);
        setCurrentOrderTrackingId(data[0].id);
      }
      setOrderItems([]); setPaymentSuccess(true); setShowTransferScreen(false);
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

  // Fix: Implemented handleDeleteItem to remove items from Supabase database
  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este plato?")) return;
    try {
      const { error } = await supabase.from('menu').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error al eliminar el producto");
    }
  };

  const cartTotal = cart.reduce((acc, item) => {
    const adds = (item.additions || []).reduce((sum, add) => sum + add.price, 0);
    return acc + ((item.price + adds) * item.quantity);
  }, 0);

  const getStatusStyles = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return { card: 'border-rose-100 bg-rose-50/20', badge: 'bg-rose-500 text-white', label: 'PENDIENTE', btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200', btnLabel: 'Recibir Pedido', icon: <AlertCircle className="w-5 h-5" /> };
      case OrderStatus.PREPARING: return { card: 'border-amber-100 bg-amber-50/20', badge: 'bg-amber-400 text-white', label: 'PREPARANDO', btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200', btnLabel: 'Terminar Plato', icon: <Play className="w-5 h-5" /> };
      case OrderStatus.READY: return { card: 'border-emerald-200 bg-emerald-50/20', badge: 'bg-emerald-500 text-white', label: 'LISTO', btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200', btnLabel: 'ENTREGAR PEDIDO', icon: <PackageCheck className="w-5 h-5" /> };
      default: return { card: 'border-slate-200 bg-white', badge: 'bg-slate-500 text-white', label: 'INFO', btn: 'bg-slate-900 text-white', btnLabel: '...', icon: null };
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-[#F8F9FA] text-slate-900">
      <aside className="hidden md:flex flex-col text-white w-72 h-screen sticky top-0 shrink-0"><div className="flex flex-col h-full glass-dark"><div className="p-10 text-center"><div className="w-20 h-20 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl overflow-hidden border border-white/10 shrink-0"><img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" /></div><h1 className="text-xs font-black uppercase tracking-widest text-white/90 italic truncate">{restaurantSettings.name}</h1></div><nav className="flex-1 px-6 space-y-3 overflow-y-auto no-scrollbar pb-10">{isStaffMode ? (<><SidebarItem icon={<ChefHat className="w-5 h-5" />} label="Cocina" active={activeView === 'kitchen'} onClick={() => setActiveView('kitchen')} badge={orders.length} /><SidebarItem icon={<BarChart3 className="w-5 h-5" />} label="Ventas" active={activeView === 'stats'} onClick={() => setActiveView('stats')} /><SidebarItem icon={<Settings className="w-5 h-5" />} label="Gestión" active={activeView === 'admin'} onClick={() => setActiveView('admin')} /><button onClick={() => {setIsStaffMode(false); setActiveView('menu');}} className="w-full mt-10 p-5 text-rose-400 hover:bg-rose-500/10 rounded-2xl flex items-center gap-4 font-black text-[10px] uppercase transition-all"><LogOut className="w-4 h-4" /> Salir</button></>) : (<><SidebarItem icon={<LayoutGrid className="w-5 h-5" />} label="Menú" active={activeCategory === 'Todas'} onClick={() => setActiveCategory('Todas')} />{categories.map(c => <SidebarItem key={c.id} icon={<span className="text-lg">{c.icon}</span>} label={c.name} active={activeCategory === c.name} onClick={() => setActiveCategory(c.name)} />)}<div className="pt-10 border-t border-white/5 mt-6"><button onClick={() => setShowLogin(true)} className="w-full p-5 text-white/40 hover:text-white rounded-3xl flex items-center gap-4 font-black text-[9px] uppercase tracking-widest border border-white/5 transition-all"><Lock className="w-4 h-4" /> Staff</button></div></>)}</nav></div></aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 glass border-b border-slate-200/50 z-40 px-6 py-4 flex justify-between items-center pt-safe"><div className="flex items-center gap-5"><button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-3 bg-white rounded-2xl shadow-premium text-slate-900"><LayoutGrid className="w-5 h-5" /></button><h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-slate-900">{isStaffMode ? (activeView === 'kitchen' ? 'Cocina' : activeView === 'stats' ? 'Ventas' : 'Gestión') : restaurantSettings.name}</h2></div>{!isStaffMode && (<div className="flex items-center gap-3"><button onClick={() => setIsCartOpen(true)} className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl flex items-center gap-4 relative shadow-2xl active:scale-95 transition-all"><ShoppingBag className="w-4 h-4 text-orange-400" /><span className="font-black text-xs tracking-wider">${formatPrice(cartTotal)}</span>{cart.length > 0 && <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#F8F9FA]">{cart.length}</span>}</button></div>)}</header>
        <main className="flex-1 p-4 md:p-12 max-w-7xl mx-auto w-full pb-32">
          {activeView === 'menu' && !isStaffMode && (<div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">{menuItems.filter(i => activeCategory === 'Todas' ? i.category !== 'Adiciones' : i.category === activeCategory).map(item => (<div key={item.id} onClick={() => setSelectedFoodForDetail(item)} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-premium flex flex-col group transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer animate-fade-scale"><div className="h-40 md:h-56 overflow-hidden relative"><img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /><div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-black shadow-lg text-slate-900">${formatPrice(item.price)}</div></div><div className="p-4 md:p-6 flex flex-col flex-1"><h3 className="text-xs md:text-lg font-black text-slate-900 uppercase italic mb-1 truncate">{item.name}</h3><p className="text-[9px] md:text-xs text-slate-500 line-clamp-2 mb-4 font-medium">{item.description}</p><button className="mt-auto w-full py-2.5 bg-slate-50 hover:bg-slate-900 hover:text-white transition-all rounded-2xl font-black text-[9px] uppercase border border-slate-100 text-slate-900">Pedir</button></div></div>))}</div>)}
          {isStaffMode && activeView === 'admin' && (
            <div className="max-w-4xl mx-auto space-y-12 pb-20">
              <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-premium">
                <div className="flex justify-between items-center mb-10"><h4 className="text-lg font-black uppercase italic text-slate-900">Configuración Marca</h4><button onClick={handleSaveBranding} className={`px-10 py-4 rounded-full font-black text-xs uppercase transition-all shadow-xl ${brandingSaved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>{brandingSaved ? 'Guardado' : 'Guardar'}</button></div>
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center cursor-pointer overflow-hidden border border-white/10 shrink-0 shadow-lg" onClick={() => fileInputRef.current?.click()}>
                      {restaurantSettings.logoUrl ? <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" /> : <Upload className="w-8 h-8 text-orange-500" />}
                    </div>
                    <div className="flex-1 w-full space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre del Local</label><input type="text" value={restaurantSettings.name} onChange={e => setRestaurantSettings({...restaurantSettings, name: e.target.value})} className="w-full p-5 bg-slate-50 rounded-3xl font-black text-sm outline-none border border-slate-200" /></div>
                    <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Código QR para Pagos</label>
                      <div className="w-full aspect-square bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-orange-500 transition-all" onClick={() => qrInputRef.current?.click()}>
                        {restaurantSettings.qrUrl ? <img src={restaurantSettings.qrUrl} className="w-full h-full object-contain p-4" /> : <div className="text-center"><QrCode className="w-12 h-12 text-slate-300 group-hover:text-orange-500 mx-auto mb-2" /><p className="text-[10px] font-black text-slate-400 uppercase">Click para Subir</p></div>}
                      </div>
                      <input type="file" ref={qrInputRef} onChange={handleQrUpload} className="hidden" accept="image/*" />
                    </div>
                    <div className="space-y-6 flex flex-col justify-end">
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Webhook Sheets</label><input type="text" value={restaurantSettings.sheetsWebhook} onChange={e => setRestaurantSettings({...restaurantSettings, sheetsWebhook: e.target.value})} className="w-full p-5 bg-slate-50 rounded-3xl font-mono text-[10px] outline-none border border-slate-200" /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">URL Bancaria (Opcional)</label><input type="text" value={restaurantSettings.transferUrl} onChange={e => setRestaurantSettings({...restaurantSettings, transferUrl: e.target.value})} className="w-full p-5 bg-slate-50 rounded-3xl font-mono text-[10px] outline-none border border-slate-200" /></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center px-6"><h4 className="text-xl font-black italic uppercase text-slate-900">Productos</h4><button onClick={() => setIsAdminFormOpen(true)} className="bg-slate-900 text-white px-8 py-4 rounded-full font-black text-[10px] uppercase shadow-xl"><PlusCircle className="w-4 h-4 inline mr-2" /> Nuevo Plato</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">{menuItems.map(item => (<div key={item.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 flex items-center gap-6"><img src={item.image} className="w-20 h-20 rounded-[1.2rem] object-cover" /><div className="flex-1 min-w-0"><h5 className="font-black uppercase text-xs italic mb-1 truncate">{item.name}</h5><p className="text-[9px] font-black text-slate-400 uppercase">{item.category}</p></div><div className="flex gap-2"><button onClick={() => { setEditingItem(item); setIsAdminFormOpen(true); }} className="p-3 bg-slate-50 text-slate-400 rounded-xl"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDeleteItem(item.id)} className="p-3 bg-rose-50 text-rose-400 rounded-xl"><Trash2 className="w-3.5 h-3.5" /></button></div></div>))}</div>
            </div>
          )}
        </main>
      </div>
      {showLogin && (<div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[600] flex items-center justify-center p-6"><div className="bg-white w-full max-w-sm rounded-[2.5rem] p-12 text-center shadow-2xl animate-in zoom-in duration-300"><div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 text-slate-900 shadow-inner"><Lock className="w-8 h-8" /></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ingresa PIN de Staff</p><input type="password" placeholder="••••" maxLength={4} className="w-full py-5 bg-slate-50 rounded-2xl text-center text-4xl font-black tracking-[0.8em] outline-none border border-slate-200 focus:border-orange-500 shadow-inner" autoFocus onChange={(e) => { if(e.target.value === '1234') { setIsStaffMode(true); setShowLogin(false); setActiveView('kitchen'); } }} /><button onClick={() => setShowLogin(false)} className="mt-8 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">Cancelar</button></div></div>)}
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
  <button onClick={onClick} className={`relative w-full p-4 flex items-center gap-4 rounded-[1.5rem] transition-all group ${active ? 'bg-orange-600 text-white shadow-orange-glow' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}>
    <div className={`transition-all ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest text-left truncate">{label}</span>
    {badge > 0 && <span className="absolute top-2 right-2 bg-white text-orange-600 text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-lg shadow-lg border border-orange-100">{badge}</span>}
  </button>
);

export default App;
