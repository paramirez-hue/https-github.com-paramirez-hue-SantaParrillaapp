import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShoppingBag, ChefHat, Plus, Minus, X, Info,
  Timer, ShoppingBasket, Edit2, Trash2, Lock, LogOut, 
  Settings, LayoutGrid, Image as ImageIcon, Wand2, Save, Check, PlusCircle, Upload, ArrowRight, Tag, ChevronRight, AlertCircle, Play, PackageCheck, BarChart3, TrendingUp, DollarSign, FileSpreadsheet, DatabaseZap, Clock, Bell, UtensilsCrossed, Sparkles, Send, ExternalLink, QrCode, Banknote, CreditCard, ArrowRightLeft, RefreshCcw, ChevronDown, Loader2
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

const App: React.FC = () => {
  const [hasEntered, setHasEntered] = useState(false);
  const [isStaffMode, setIsStaffMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('menu');
  const [menuItems, setMenuItems] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('CASH');
  const [showTransferScreen, setShowTransferScreen] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  
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
    return { ...DEFAULT_BRANDING, sheetsWebhook: '', qrUrl: '', transferUrl: '' };
  });

  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
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

      // Cargar configuraciones globales desde Supabase
      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'branding').maybeSingle();
      if (settingsData && !isSavingBranding) {
        const merged = { ...restaurantSettings, ...settingsData };
        setRestaurantSettings(merged);
        localStorage.setItem('santa_parrilla_settings', JSON.stringify(merged));
      }
    } catch (err) { console.error("Fetch error:", err); }
  };

  useEffect(() => {
    fetchData();
    const menuSub = supabase.channel('menu-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, fetchData).subscribe();
    const ordersSub = supabase.channel('ord-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData).subscribe();
    const settingsSub = supabase.channel('settings-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, fetchData).subscribe();
    return () => { 
      supabase.removeChannel(menuSub); 
      supabase.removeChannel(ordersSub); 
      supabase.removeChannel(settingsSub);
    };
  }, []);

  const uploadToStorage = async (file: File, path: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      // Nombre fijo para el logo para que el link no cambie
      const fileName = path === 'logo' ? `santa-parrilla-logo.png` : `${path}-${Date.now()}.${fileExt}`;
      const filePath = `assets/${fileName}`;

      const { data, error } = await supabase.storage
        .from('assets')
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir. Asegúrate de que el bucket "assets" sea público.');
      return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'qr') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(type);
    const url = await uploadToStorage(file, type);
    
    if (url) {
      const updatedSettings = { ...restaurantSettings, [type === 'logo' ? 'logoUrl' : 'qrUrl']: url };
      setRestaurantSettings(updatedSettings);
      // Persistencia inmediata en Supabase
      await supabase.from('settings').upsert({ id: 'branding', ...updatedSettings });
      localStorage.setItem('santa_parrilla_settings', JSON.stringify(updatedSettings));
    }
    setIsUploading(null);
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      const { error } = await supabase.from('settings').upsert({ id: 'branding', ...restaurantSettings });
      if (error) throw error;
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
      localStorage.setItem('santa_parrilla_settings', JSON.stringify(restaurantSettings));
    } finally { setIsSavingBranding(false); }
  };

  const cartTotal = cart.reduce((acc, item) => {
    const adds = (item.additions || []).reduce((sum, add) => sum + add.price, 0);
    return acc + ((item.price + adds) * item.quantity);
  }, 0);

  if (!hasEntered) {
    return (
      <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center p-8 bg-[#020617]">
        <AnimatedFireBackground />
        <div className="relative z-10 text-center space-y-12 animate-fade-scale">
          <div className="relative group">
             <div className="absolute inset-0 bg-orange-500/20 blur-[100px] animate-pulse rounded-full"></div>
             <div className="w-64 h-64 md:w-80 md:h-80 bg-slate-950 rounded-full p-2 border-4 border-orange-500/20 shadow-2xl overflow-hidden relative z-10">
                <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover rounded-full" />
             </div>
          </div>
          <div className="space-y-4">
            <span className="font-lettering text-orange-200 text-4xl md:text-6xl block opacity-90 tracking-wide">Bienvenido a</span>
            <h1 className="text-6xl md:text-[8rem] font-black text-white uppercase italic tracking-tighter leading-none">
              <span className="text-orange-500">SANTA</span> PARRILLA
            </h1>
          </div>
          <button onClick={() => setHasEntered(true)} className="group px-12 py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-full font-black uppercase text-sm tracking-[0.4em] shadow-xl transition-all hover:scale-110 flex items-center gap-4 mx-auto">
            INGRESAR <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-[#F8F9FA] text-slate-900">
      <aside className="hidden md:flex flex-col text-white w-72 h-screen sticky top-0 shrink-0">
        <div className="flex flex-col h-full glass-dark">
          <div className="p-10 text-center">
            <div className="w-20 h-20 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl overflow-hidden border border-white/10 shrink-0">
              <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xs font-black uppercase tracking-widest text-white/90 italic truncate">{restaurantSettings.name}</h1>
          </div>
          <nav className="flex-1 px-6 space-y-3">
            {isStaffMode ? (
              <>
                <SidebarItem icon={<ChefHat className="w-5 h-5" />} label="Cocina" active={activeView === 'kitchen'} onClick={() => setActiveView('kitchen')} badge={orders.length} />
                <SidebarItem icon={<Settings className="w-5 h-5" />} label="Gestión" active={activeView === 'admin'} onClick={() => setActiveView('admin')} />
                <button onClick={() => {setIsStaffMode(false); setActiveView('menu');}} className="w-full mt-10 p-5 text-rose-400 hover:bg-rose-500/10 rounded-2xl flex items-center gap-4 font-black text-[10px] uppercase transition-all"><LogOut className="w-4 h-4" /> Salir</button>
              </>
            ) : (
              <>
                <SidebarItem icon={<LayoutGrid className="w-5 h-5" />} label="Menú" active={activeCategory === 'Todas'} onClick={() => setActiveCategory('Todas')} />
                {categories.map(c => <SidebarItem key={c.id} icon={<span className="text-lg">{c.icon}</span>} label={c.name} active={activeCategory === c.name} onClick={() => setActiveCategory(c.name)} />)}
                <div className="pt-10 border-t border-white/5 mt-6"><button onClick={() => setShowLogin(true)} className="w-full p-5 text-white/40 hover:text-white rounded-3xl flex items-center gap-4 font-black text-[9px] uppercase tracking-widest border border-white/5 transition-all"><Lock className="w-4 h-4" /> Staff</button></div>
              </>
            )}
          </nav>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 glass border-b border-slate-200/50 z-40 px-6 py-4 flex justify-between items-center pt-safe">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 bg-white rounded-xl shadow-sm"><LayoutGrid className="w-5 h-5" /></button>
             <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-slate-900">{isStaffMode ? 'Staff Panel' : restaurantSettings.name}</h2>
          </div>
          {!isStaffMode && (
            <button onClick={() => setIsCartOpen(true)} className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl flex items-center gap-4 relative shadow-2xl active:scale-95 transition-all">
              <ShoppingBag className="w-4 h-4 text-orange-400" />
              <span className="font-black text-xs tracking-wider">${formatPrice(cartTotal)}</span>
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#F8F9FA]">{cart.length}</span>}
            </button>
          )}
        </header>

        <main className="flex-1 p-4 md:p-12 max-w-7xl mx-auto w-full pb-32">
          {isStaffMode && activeView === 'admin' && (
            <div className="max-w-4xl mx-auto space-y-12">
               <div className="bg-white p-6 md:p-10 rounded-[3rem] border border-slate-200 shadow-premium">
                <div className="flex justify-between items-center mb-10">
                  <h4 className="text-lg font-black uppercase italic text-slate-900">Configuración Visual</h4>
                  <button onClick={handleSaveBranding} className={`px-10 py-4 rounded-full font-black text-xs uppercase transition-all shadow-xl ${brandingSaved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>
                    {isSavingBranding ? 'Guardando...' : brandingSaved ? '¡Icono Actualizado!' : 'Sincronizar Todo'}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Icono de Instalación (PWA)</label>
                    <div className="relative group w-48 h-48 mx-auto">
                      <div className="w-full h-full bg-slate-100 rounded-[3rem] flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 group-hover:border-orange-500 transition-all cursor-pointer shadow-inner" onClick={() => fileInputRef.current?.click()}>
                        {isUploading === 'logo' ? <Loader2 className="w-10 h-10 text-orange-500 animate-spin" /> : <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" />}
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">Cambiar Logo</div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">QR de Pagos</label>
                    <div className="relative group w-48 h-48 mx-auto">
                      <div className="w-full h-full bg-slate-100 rounded-[3rem] flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 group-hover:border-orange-500 transition-all cursor-pointer shadow-inner" onClick={() => qrInputRef.current?.click()}>
                        {isUploading === 'qr' ? <Loader2 className="w-10 h-10 text-orange-500 animate-spin" /> : restaurantSettings.qrUrl ? <img src={restaurantSettings.qrUrl} className="w-full h-full object-contain p-4" /> : <QrCode className="w-10 h-10 text-slate-300" />}
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">Cambiar QR</div>
                      <input type="file" ref={qrInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'qr')} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'menu' && !isStaffMode && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 animate-fade-scale">
               {menuItems.map(item => (
                 <div key={item.id} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-premium flex flex-col group transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer">
                    <div className="h-40 md:h-56 overflow-hidden relative">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-900">${formatPrice(item.price)}</div>
                    </div>
                    <div className="p-4 md:p-6 flex flex-col flex-1">
                      <h3 className="text-xs md:text-lg font-black text-slate-900 uppercase italic mb-1 truncate">{item.name}</h3>
                      <p className="text-[9px] md:text-xs text-slate-500 line-clamp-2 mb-4 font-medium">{item.description}</p>
                      <button className="mt-auto w-full py-2.5 bg-slate-50 hover:bg-slate-900 hover:text-white transition-all rounded-2xl font-black text-[9px] uppercase border border-slate-100 text-slate-900">Añadir al Plato</button>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </main>
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[600] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-12 text-center shadow-2xl animate-in zoom-in duration-300">
             <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 text-slate-900 shadow-inner"><Lock className="w-8 h-8" /></div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ingresa PIN de Staff</p>
             <input type="password" placeholder="••••" maxLength={4} className="w-full py-5 bg-slate-50 rounded-2xl text-center text-4xl font-black tracking-[0.8em] outline-none border border-slate-200 focus:border-orange-500 shadow-inner" autoFocus onChange={(e) => { if(e.target.value === '1234') { setIsStaffMode(true); setShowLogin(false); setActiveView('admin'); } }} />
             <button onClick={() => setShowLogin(false)} className="mt-8 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">Cancelar</button>
          </div>
        </div>
      )}
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