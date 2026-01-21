
import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, ChefHat, Plus, Minus, X,
  UtensilsCrossed, Timer, ShoppingBasket, Edit2, Trash2, Lock, LogOut, 
  Settings, Store, LayoutGrid, Sparkles, TrendingUp, Bell, Image as ImageIcon, Wand2, Database, AlertTriangle, CloudOff, ChevronRight, Save, Check, PlusCircle, Info, Upload, Camera, MessageCircle, ArrowRight
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { FoodItem, Order, OrderItem, OrderStatus, ViewType } from './types';
import { INITIAL_MENU, CATEGORIES, DEFAULT_BRANDING } from './constants';
import { improveDescription, generateFoodImage } from './geminiService';

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
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-colors ${elapsed > 20 ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-500 text-white'}`}>
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
  
  // Intentar cargar branding desde localStorage para evitar parpadeo
  const [restaurantSettings, setRestaurantSettings] = useState(() => {
    const saved = localStorage.getItem('santa_parrilla_settings');
    if (saved) return JSON.parse(saved);
    // Si no hay nada guardado, usamos valores vacíos para que no muestre la hamburguesa genérica
    return { ...DEFAULT_BRANDING, logoUrl: '', name: 'Santa Parrilla' };
  });

  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [rlsErrorVisible, setRlsErrorVisible] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevOrdersCount = useRef(0);

  const fetchData = async () => {
    try {
      const { data: menuData, error: menuError } = await supabase.from('menu').select('*');
      if (!menuError && menuData && menuData.length > 0) {
        setMenuItems(menuData);
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .neq('status', OrderStatus.DELIVERED)
        .order('createdAt', { ascending: false });
      
      if (!ordersError && ordersData) {
        prevOrdersCount.current = ordersData.length;
        setOrders(ordersData);
      }

      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'branding').single();
      if (settingsData) {
        const newSettings = { 
          name: settingsData.name, 
          logoUrl: settingsData.logoUrl || DEFAULT_BRANDING.logoUrl,
          whatsappPhone: settingsData.whatsappPhone || DEFAULT_BRANDING.whatsappPhone
        };
        setRestaurantSettings(newSettings);
        // Guardar en cache local para la próxima vez
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
        setLogoLoaded(false); // Reset para nueva animación
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      const { error } = await supabase.from('settings').upsert({ 
        id: 'branding', 
        name: restaurantSettings.name,
        logoUrl: restaurantSettings.logoUrl,
        whatsappPhone: restaurantSettings.whatsappPhone
      });
      if (error) {
        if (error.message.includes('row-level security')) setRlsErrorVisible(true);
        throw error;
      }
      localStorage.setItem('santa_parrilla_settings', JSON.stringify(restaurantSettings));
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
      fetchData();
    } catch (err: any) {
      console.error("Error branding:", err.message);
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este plato? Esta acción no se puede deshacer.")) return;
    
    try {
      const { error } = await supabase.from('menu').delete().eq('id', id);
      if (error) {
        if (error.message.includes('row-level security')) setRlsErrorVisible(true);
        throw error;
      }
      fetchData();
    } catch (err: any) {
      console.warn("Error eliminando en la nube, borrando localmente:", err.message);
      setMenuItems(prev => prev.filter(item => item.id !== id));
    }
  };

  useEffect(() => {
    fetchData();
    const menuSub = supabase.channel('menu-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, fetchData).subscribe();
    const ordersSub = supabase.channel('ord-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData).subscribe();
    const settingsSub = supabase.channel('set-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, fetchData).subscribe();
    return () => { supabase.removeChannel(menuSub); supabase.removeChannel(ordersSub); supabase.removeChannel(settingsSub); };
  }, [isStaffMode]);

  const addToCart = (item: FoodItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const sendWhatsAppNotification = (orderData: any) => {
    const phone = restaurantSettings.whatsappPhone || DEFAULT_BRANDING.whatsappPhone;
    const itemsList = orderData.items.map((i: any) => `- ${i.quantity}x ${i.name} ($${(i.price * i.quantity).toFixed(2)})`).join('%0A');
    const text = `🔥 *NUEVO PEDIDO - ${restaurantSettings.name}* 🔥%0A%0A👤 *Cliente:* ${orderData.customerName}%0A📍 *Ubicación:* ${orderData.tableNumber}%0A%0A*DETALLE:*%0A${itemsList}%0A%0A💰 *TOTAL:* $${orderData.total.toFixed(2)}%0A%0A⏰ _Enviado desde la App Oficial_`;
    
    const whatsappUrl = `https://wa.me/${phone}?text=${text}`;
    window.open(whatsappUrl, '_blank');
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
      
      const { error } = await supabase.from('orders').insert([newOrder]);
      if (error && error.message.includes('row-level security')) setRlsErrorVisible(true);
      
      // Notificar por WhatsApp
      sendWhatsAppNotification(newOrder);

      setCart([]);
      setPaymentSuccess(true);
      setTimeout(() => { setPaymentSuccess(false); setIsCartOpen(false); }, 2000);
    } finally { setIsPaying(false); }
  };

  const updateStatus = async (id: string, current: OrderStatus) => {
    const sequence = [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.DELIVERED];
    const nextIndex = sequence.indexOf(current) + 1;
    if (nextIndex >= sequence.length) return;
    const next = sequence[nextIndex];
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', id);
    if (error && error.message.includes('row-level security')) setRlsErrorVisible(true);
    fetchData();
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const filteredMenu = activeCategory === 'Todas' ? menuItems : menuItems.filter(i => i.category === activeCategory);

  // Pantalla de Bienvenida (Splash Screen)
  if (!hasEntered) {
    return (
      <div className="fixed inset-0 z-[500] bg-[#020617] flex flex-col items-center justify-center p-8 overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-600/5 blur-[120px] rounded-full"></div>
        
        <div className="relative z-10 text-center space-y-12 animate-in fade-in zoom-in duration-1000">
          <div className="relative inline-block">
             <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
             <div className="w-48 h-48 md:w-56 md:h-56 bg-[#0F172A] rounded-full p-4 border-8 border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.2)] overflow-hidden relative flex items-center justify-center">
               {restaurantSettings.logoUrl ? (
                 <img 
                   src={restaurantSettings.logoUrl} 
                   className={`w-full h-full object-cover scale-110 transition-opacity duration-700 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`} 
                   alt="Logo"
                   onLoad={() => setLogoLoaded(true)}
                 />
               ) : (
                 <div className="w-full h-full bg-slate-900/50 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                 </div>
               )}
             </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-tight">
              Bienvenido a <br/>
              <span className="text-orange-500 not-italic">{restaurantSettings.name}</span>
            </h1>
          </div>
          
          <button 
            onClick={() => setHasEntered(true)}
            className="group relative px-12 py-6 bg-orange-600 hover:bg-orange-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-orange-600/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-4 mx-auto"
          >
            Ingresar a la Parrilla
            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
        
        <div className="absolute bottom-10 left-0 right-0 text-center">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">© 2024 {restaurantSettings.name} - Gestión Premium</p>
        </div>
      </div>
    );
  }

  const NavContent = () => (
    <div className="flex flex-col h-full bg-[#020617]">
      <div className="p-10 text-center">
        <div className="w-24 h-24 bg-[#0F172A] rounded-full mx-auto flex items-center justify-center mb-5 shadow-2xl overflow-hidden border-4 border-orange-500/30 relative group">
          <img 
            src={restaurantSettings.logoUrl || DEFAULT_BRANDING.logoUrl} 
            className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-500" 
            alt="Logo"
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_BRANDING.logoUrl;
            }}
          />
          <div className="absolute inset-0 bg-orange-500/5 animate-pulse"></div>
        </div>
        <h1 className="text-[13px] font-black uppercase tracking-[0.4em] text-white italic drop-shadow-md">{restaurantSettings.name}</h1>
      </div>
      <nav className="flex-1 px-6 space-y-2 overflow-y-auto no-scrollbar">
        {isStaffMode ? (
          <>
            <SidebarItem icon={<ChefHat />} label="Pedidos" active={activeView === 'kitchen'} onClick={() => {setActiveView('kitchen'); setIsMobileMenuOpen(false);}} badge={orders.length} />
            <SidebarItem icon={<Settings />} label="Inventario" active={activeView === 'admin'} onClick={() => {setActiveView('admin'); setIsMobileMenuOpen(false);}} />
            <SidebarItem icon={<TrendingUp />} label="Estrategia IA" active={activeView === 'stats'} onClick={() => {setActiveView('stats'); setIsMobileMenuOpen(false);}} />
            <button onClick={() => {setIsStaffMode(false); setActiveView('menu'); setIsMobileMenuOpen(false);}} className="w-full mt-10 p-4 text-red-400 hover:bg-red-400/10 rounded-2xl flex items-center gap-3 font-black text-[10px] uppercase transition-all"><LogOut className="w-4 h-4" /> Salir</button>
          </>
        ) : (
          <>
            <SidebarItem icon={<LayoutGrid />} label="Todas" active={activeCategory === 'Todas'} onClick={() => {setActiveCategory('Todas'); setIsMobileMenuOpen(false);}} />
            {CATEGORIES.map(c => <SidebarItem key={c.id} icon={<span>{c.icon}</span>} label={c.id} active={activeCategory === c.id} onClick={() => {setActiveCategory(c.id); setIsMobileMenuOpen(false);}} />)}
            <div className="pt-10 border-t border-white/10 mt-6">
              <button onClick={() => {setShowLogin(true); setIsMobileMenuOpen(false);}} className="w-full p-5 bg-orange-600/10 text-orange-400 hover:bg-orange-600 hover:text-white rounded-[1.5rem] flex items-center gap-3 font-black text-[9px] uppercase tracking-widest transition-all border border-orange-500/20 shadow-lg shadow-orange-500/5"><Lock className="w-4 h-4" /> Acceso Staff</button>
            </div>
          </>
        )}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-[#FAF9F6] text-slate-900">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col bg-[#020617] text-white w-64 h-screen sticky top-0 border-r border-white/5 shrink-0">
        <NavContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 h-full bg-[#020617] text-white shadow-2xl animate-in slide-in-from-left duration-300">
            <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-6 right-6 p-2 bg-white/5 rounded-xl"><X className="w-5 h-5" /></button>
            <NavContent />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-b z-40 px-6 py-4 flex justify-between items-center pt-safe">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2.5 bg-slate-100 rounded-xl active:scale-90 text-slate-900"><LayoutGrid className="w-6 h-6" /></button>
            <div className="flex items-center gap-3">
              <img src={restaurantSettings.logoUrl || DEFAULT_BRANDING.logoUrl} className="w-10 h-10 rounded-full shadow-lg border border-orange-500/20 md:hidden bg-[#020617]" />
              <div>
                  <h2 className="text-sm md:text-xl font-black uppercase tracking-tight italic text-slate-900">
                      {isStaffMode ? (activeView === 'kitchen' ? 'Comandas' : activeView === 'admin' ? 'Gestión Santa Parrilla' : 'Marketing IA') : restaurantSettings.name}
                  </h2>
                  {!isStaffMode && <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">{activeCategory}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isStaffMode && (
              <button onClick={() => setIsCartOpen(true)} className="bg-[#020617] text-white px-5 py-3 rounded-2xl flex items-center gap-3 relative shadow-xl active:scale-95 transition-all">
                <ShoppingBag className="w-4 h-4 text-orange-500" />
                <span className="font-black text-xs">${cartTotal.toFixed(2)}</span>
                {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{cart.length}</span>}
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-10 max-w-6xl mx-auto w-full pb-32">
          {rlsErrorVisible && (
            <div className="mb-8 bg-red-50 border-2 border-red-200 p-6 rounded-[2.5rem] flex items-start gap-5 animate-in slide-in-from-top-4">
              <div className="p-3 bg-red-600 rounded-2xl text-white shadow-lg"><AlertTriangle className="w-6 h-6" /></div>
              <div className="flex-1">
                <h4 className="font-black uppercase italic text-red-900 text-sm">Error de Permisos (Supabase RLS)</h4>
                <p className="text-[10px] text-red-700 font-bold uppercase mt-1 leading-relaxed">
                  Las políticas de seguridad bloquean el guardado. Habilita el acceso anónimo en Supabase.
                </p>
                <button onClick={() => setRlsErrorVisible(false)} className="mt-4 text-[9px] font-black uppercase underline text-red-900">Ocultar</button>
              </div>
            </div>
          )}

          {activeView === 'menu' && !isStaffMode && (
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
                    <button onClick={() => addToCart(item)} className="mt-auto w-full py-3.5 bg-orange-50 hover:bg-[#020617] hover:text-white transition-all rounded-[1.5rem] font-black text-[10px] uppercase border border-orange-100 text-orange-700">Añadir</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isStaffMode && activeView === 'kitchen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orders.length === 0 ? <div className="col-span-full py-40 text-center opacity-20"><p className="font-black uppercase text-xs tracking-[0.4em]">Sin órdenes pendientes</p></div> : (
                orders.map(order => (
                  <div key={order.id} className="bg-white border-2 border-slate-100 rounded-[3rem] shadow-xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                      <div><span className="font-black text-[9px] text-slate-400 uppercase">Mesa: {order.tableNumber}</span><p className="text-[11px] font-black text-slate-800 uppercase italic">{order.customerName}</p></div>
                      <OrderTimer startTime={order.createdAt} />
                    </div>
                    <div className="p-6 flex-1 space-y-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-[11px] font-black"><span className="bg-orange-600 text-white w-7 h-7 flex items-center justify-center rounded-xl text-[10px]">{item.quantity}</span><span className="uppercase text-slate-700 truncate">{item.name}</span></div>
                      ))}
                    </div>
                    <div className="p-6 pt-0"><button onClick={() => updateStatus(order.id, order.status)} className={`w-full py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-lg ${order.status === 'READY' ? 'bg-emerald-600 text-white' : 'bg-[#020617] text-white'}`}>{order.status === 'PENDING' ? 'Empezar' : order.status === 'PREPARING' ? 'Terminar' : 'Entregado ✓'}</button></div>
                  </div>
                ))
              )}
            </div>
          )}

          {isStaffMode && activeView === 'admin' && (
            <div className="space-y-10 pb-20">
                <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border-2 border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
                        <div className="flex items-center gap-6 text-slate-900">
                          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-24 h-24 bg-[#0F172A] rounded-full flex items-center justify-center text-white shadow-xl border-4 border-orange-500 overflow-hidden group-hover:border-orange-600 transition-colors">
                              {restaurantSettings.logoUrl ? (
                                <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" alt="Logo actual" />
                              ) : (
                                <Upload className="w-8 h-8 text-orange-500" />
                              )}
                            </div>
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Camera className="w-6 h-6 text-white" />
                            </div>
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              onChange={handleLogoUpload} 
                              className="hidden" 
                              accept="image/*"
                            />
                          </div>
                          <div>
                            <h4 className="text-xl font-black italic uppercase tracking-tighter leading-tight">Identidad Visual</h4>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logo y Nombre del Local</p>
                          </div>
                        </div>
                        <button 
                          onClick={handleSaveBranding} 
                          disabled={isSavingBranding}
                          className={`flex items-center justify-center gap-3 px-10 py-5 rounded-[1.5rem] font-black text-[11px] uppercase transition-all shadow-xl active:scale-95 ${brandingSaved ? 'bg-emerald-500 text-white' : 'bg-[#020617] text-white'}`}
                        >
                          {isSavingBranding ? 'Guardando...' : brandingSaved ? <><Check className="w-5 h-5" /> ¡Guardado!</> : <><Save className="w-5 h-5" /> Guardar Cambios</>}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Nombre Comercial</label>
                          <input type="text" value={restaurantSettings.name} onChange={e => setRestaurantSettings({...restaurantSettings, name: e.target.value})} className="w-full p-6 bg-slate-50 rounded-[1.5rem] font-black text-sm outline-none border-2 border-transparent focus:border-orange-500 shadow-inner transition-all" placeholder="Nombre de tu negocio" />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">WhatsApp de Pedidos</label>
                          <div className="relative">
                            <MessageCircle className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                            <input type="text" value={restaurantSettings.whatsappPhone || ''} onChange={e => setRestaurantSettings({...restaurantSettings, whatsappPhone: e.target.value})} className="w-full p-6 pl-14 bg-slate-50 rounded-[1.5rem] font-black text-sm outline-none border-2 border-transparent focus:border-orange-500 shadow-inner transition-all" placeholder="Ej: 573000000000" />
                          </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center px-4 pt-10 border-t border-slate-200">
                  <div>
                    <h4 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Menú <span className="text-orange-600 not-italic">Digital</span></h4>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Gestiona tus platos y precios</p>
                  </div>
                  <button onClick={() => { setEditingItem(null); setIsAdminFormOpen(true); }} className="bg-orange-600 text-white px-8 py-5 rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl shadow-orange-600/20 active:scale-95 transition-all flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" /> Nuevo Plato
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {menuItems.map(item => (
                    <div key={item.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex items-center gap-6 group hover:border-orange-100 transition-all">
                      <div className="relative">
                        <img src={item.image} className="w-24 h-24 rounded-[2rem] object-cover shadow-lg" />
                        <div className="absolute -top-2 -right-2 bg-white text-orange-600 w-8 h-8 rounded-full flex items-center justify-center border shadow-md font-black text-[10px] italic">${item.price}</div>
                      </div>
                      <div className="flex-1 text-slate-900">
                        <h5 className="font-black uppercase text-sm italic mb-1 line-clamp-1">{item.name}</h5>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditingItem(item); setIsAdminFormOpen(true); }} className="p-4 bg-slate-100 text-slate-400 hover:text-slate-950 hover:bg-white hover:shadow-lg rounded-2xl transition-all active:scale-90 border border-transparent hover:border-slate-100">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteItem(item.id)} className="p-4 bg-red-50 text-red-400 hover:text-white hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/20 rounded-2xl transition-all active:scale-90 border border-transparent">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          )}

          {isStaffMode && activeView === 'stats' && (
            <div className="space-y-8">
               <div className="flex items-center gap-4 border-b pb-6"><div className="p-4 bg-orange-600 rounded-[2rem] text-white shadow-xl shadow-orange-600/30"><TrendingUp className="w-6 h-6" /></div><h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Estrategia <span className="text-orange-600 not-italic">IA</span></h3></div>
               <div className="p-12 bg-white rounded-[3rem] border border-slate-100 text-center text-slate-400">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-black uppercase text-[10px] tracking-widest">Generando insights basados en ventas...</p>
               </div>
            </div>
          )}
        </main>
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-2xl z-[150] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-12 text-center shadow-2xl animate-in zoom-in-95 text-slate-900">
             <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-[#020617] shadow-inner"><Lock className="w-10 h-10" /></div>
             <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-4">Acceso <span className="text-orange-600 not-italic">Staff</span></h2>
             <input type="password" placeholder="PIN" maxLength={4} className="w-full py-6 bg-slate-50 rounded-[1.5rem] text-center text-4xl font-black tracking-[0.6em] outline-none border-2 border-transparent focus:border-orange-500 shadow-inner" autoFocus onChange={(e) => { if(e.target.value === '1234') { setIsStaffMode(true); setShowLogin(false); setActiveView('kitchen'); } }} />
             <button onClick={() => setShowLogin(false)} className="mt-10 text-[9px] font-black text-slate-400 hover:text-slate-950 uppercase tracking-widest">Cerrar</button>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-[#020617]/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
             <div className="p-8 border-b flex justify-between items-center pt-safe text-slate-900"><h2 className="text-2xl font-black italic uppercase tracking-tighter">Mi <span className="text-orange-600 not-italic">Orden</span></h2><button onClick={() => setIsCartOpen(false)} className="p-3 bg-slate-100 rounded-2xl"><X className="w-6 h-6" /></button></div>
             <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                {cart.length === 0 ? <div className="py-24 text-center opacity-10"><ShoppingBasket className="w-24 h-24 mx-auto mb-6 text-slate-900" /><p className="font-black uppercase text-[10px] tracking-widest">Carrito vacío</p></div> : cart.map(item => (
                  <div key={item.id} className="flex items-center gap-5 bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100">
                    <img src={item.image} className="w-16 h-16 rounded-2xl object-cover shadow-md" />
                    <div className="flex-1"><p className="text-[11px] font-black uppercase italic text-slate-800 truncate">{item.name}</p><div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl w-fit mt-2 border border-slate-100 text-slate-900 shadow-sm"><button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i).filter(i => i.quantity > 0))}><Minus className="w-3 h-3" /></button><span className="text-[10px] font-black w-4 text-center">{item.quantity}</span><button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}><Plus className="w-3 h-3" /></button></div></div>
                    <span className="text-sm font-black text-orange-600 italic">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                {cart.length > 0 && <div className="pt-6 space-y-4"><input type="text" placeholder="Tu Nombre" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-6 bg-slate-50 rounded-[1.5rem] outline-none font-black text-[11px] uppercase border border-transparent focus:border-orange-500 text-slate-900 shadow-inner" /><input type="text" placeholder="Mesa / Llevar" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full p-6 bg-slate-50 rounded-[1.5rem] outline-none font-black text-[11px] uppercase border border-transparent focus:border-orange-500 text-slate-900 shadow-inner" /></div>}
             </div>
             <div className="p-10 border-t bg-white pb-safe">
                <div className="flex justify-between items-end mb-8 text-slate-900"><span className="text-[11px] font-black uppercase text-slate-400 tracking-widest leading-none">Subtotal</span><span className="text-5xl font-black tracking-tighter italic leading-none">${cartTotal.toFixed(2)}</span></div>
                <button onClick={handlePayment} disabled={cart.length === 0 || isPaying || !customerName} className={`w-full py-6 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-all ${paymentSuccess ? 'bg-emerald-500 text-white' : 'bg-[#020617] text-white disabled:opacity-20'}`}>{isPaying ? 'Procesando...' : paymentSuccess ? '¡Enviado!' : 'Hacer Pedido'}</button>
             </div>
          </div>
        </div>
      )}

      {isAdminFormOpen && (
        <AdminForm 
          item={editingItem} 
          onSave={async (itemData: any) => {
            try {
              let error;
              if (itemData.id && !String(itemData.id).startsWith('local_')) {
                const { error: err } = await supabase.from('menu').upsert(itemData);
                error = err;
              } else {
                const { id, ...newItem } = itemData;
                const { error: err } = await supabase.from('menu').insert([newItem]);
                error = err;
              }

              if (error) {
                if (error.message.includes('row-level security')) setRlsErrorVisible(true);
                throw error;
              }
              
              setIsAdminFormOpen(false);
              fetchData();
            } catch (err: any) {
              console.warn("Respaldo local:", err.message);
              setMenuItems(prev => {
                if (itemData.id) return prev.map(i => i.id === itemData.id ? itemData : i);
                return [...prev, { ...itemData, id: 'local_' + Date.now() }];
              });
              setIsAdminFormOpen(false);
            }
          }} 
          onClose={() => setIsAdminFormOpen(false)} 
        />
      )}
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
  <button onClick={onClick} className={`relative w-full p-4 flex items-center gap-4 rounded-[1.5rem] transition-all duration-300 group ${active ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/30' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>
    <div className={`transition-transform duration-300 ${active ? 'scale-110 rotate-3' : 'group-hover:scale-110'}`}>{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest text-left truncate">{label}</span>
    {badge > 0 && <span className="absolute top-2 right-2 bg-white text-orange-600 text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-lg shadow-lg border border-orange-100">{badge}</span>}
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
    <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-2xl z-[300] flex items-center justify-center p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-10 md:p-14 shadow-2xl animate-in slide-in-from-bottom-10 text-slate-900">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-10">Gestionar <span className="text-orange-600 not-italic">Plato</span></h2>
        <div className="space-y-5">
            <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Nombre</label><input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-xs outline-none border border-slate-100 shadow-inner" placeholder="Ej: Super Burger" /></div>
            <div className="flex gap-5">
              <div className="w-1/2 space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Precio</label><input type="number" step="0.01" value={data.price} onChange={e => setData({...data, price: parseFloat(e.target.value)})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-xs outline-none border border-slate-100 shadow-inner" /></div>
              <div className="w-1/2 space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Categoría</label><select value={data.category} onChange={e => setData({...data, category: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-[10px] outline-none border border-slate-100 uppercase appearance-none"><option value="Hamburguesas">Hamburguesas</option><option value="Carnes">Carnes</option><option value="Papas Fritas">Papas Fritas</option><option value="Bebidas">Bebidas</option><option value="Postres">Postres</option></select></div>
            </div>
            <div className="space-y-2"><div className="flex justify-between items-center px-4"><label className="text-[9px] font-black text-slate-400 uppercase">Imagen</label><button onClick={handleAIImage} disabled={isGenerating} className="text-orange-600 text-[9px] font-black uppercase flex items-center gap-1 hover:opacity-70 transition-opacity"><ImageIcon className="w-3 h-3" /> IA Foto</button></div><input type="text" value={data.image} onChange={e => setData({...data, image: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-bold text-[10px] outline-none border border-slate-100 shadow-inner" placeholder="URL de la imagen" /></div>
            <div className="space-y-2"><div className="flex justify-between items-center px-4"><label className="text-[9px] font-black text-slate-400 uppercase">Descripción</label><button onClick={handleAIDescription} disabled={isGenerating} className="text-orange-600 text-[9px] font-black uppercase flex items-center gap-1 hover:opacity-70 transition-opacity"><Wand2 className="w-3 h-3" /> IA Texto</button></div><textarea value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-bold text-[10px] outline-none border border-slate-100 h-24 shadow-inner resize-none" placeholder="Ingredientes del plato..." /></div>
            <div className="pt-8 space-y-4"><button onClick={() => onSave(data)} className="w-full py-6 bg-orange-600 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-95 transition-all">Guardar Datos</button><button onClick={onClose} className="w-full py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Cancelar</button></div>
        </div>
      </div>
    </div>
  );
};

export default App;
