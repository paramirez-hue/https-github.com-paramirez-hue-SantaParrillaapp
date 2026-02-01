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
  const [isUploading, setIsUploading] = useState<string | null>(null); // 'logo' or 'qr'
  
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
    return () => { supabase.removeChannel(menuSub); supabase.removeChannel(ordersSub); };
  }, []);

  // Función principal para cargar archivos a Supabase Storage
  const uploadToStorage = async (file: File, path: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${path}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `branding/${fileName}`;

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
      alert('Error al subir la imagen. Asegúrate que el bucket "assets" existe y es público.');
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
      // Auto-guardar cambios en la base de datos para persistencia inmediata
      await supabase.from('settings').upsert({ id: 'branding', ...updatedSettings });
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

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este plato?")) return;
    try {
      await supabase.from('menu').delete().eq('id', id);
      fetchData();
    } catch (err) { console.error(err); }
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
          <div className="w-60 h-60 md:w-80 md:h-80 bg-slate-950 rounded-full p-2 border-4 border-orange-500/20 shadow-2xl overflow-hidden">
             <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="space-y-4">
            <span className="font-lettering text-orange-200 text-4xl md:text-6xl block opacity-90">Bienvenido a</span>
            <h1 className="text-6xl md:text-[8rem] font-black text-white uppercase italic tracking-tighter leading-none">
              <span className="text-orange-500">{restaurantSettings.name.split(' ')[0]}</span> {restaurantSettings.name.split(' ')[1] || ''}
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
          <nav className="flex-1 px-6 space-y-3 overflow-y-auto no-scrollbar pb-10">
            {isStaffMode ? (
              <>
                <SidebarItem icon={<ChefHat className="w-5 h-5" />} label="Cocina" active={activeView === 'kitchen'} onClick={() => setActiveView('kitchen')} badge={orders.length} />
                <SidebarItem icon={<BarChart3 className="w-5 h-5" />} label="Ventas" active={activeView === 'stats'} onClick={() => setActiveView('stats')} />
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
          <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-slate-900">{isStaffMode ? 'Administración' : restaurantSettings.name}</h2>
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
                  <h4 className="text-lg font-black uppercase italic text-slate-900">Configuración Global (Nube)</h4>
                  <button onClick={handleSaveBranding} className={`px-10 py-4 rounded-full font-black text-xs uppercase transition-all shadow-xl ${brandingSaved ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>
                    {isSavingBranding ? 'Guardando...' : brandingSaved ? '¡Sincronizado!' : 'Guardar Todo'}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Logo del Negocio</label>
                    <div className="relative group w-40 h-40 mx-auto">
                      <div className="w-full h-full bg-slate-100 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 group-hover:border-orange-500 transition-all cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        {isUploading === 'logo' ? <Loader2 className="w-8 h-8 text-orange-500 animate-spin" /> : restaurantSettings.logoUrl ? <img src={restaurantSettings.logoUrl} className="w-full h-full object-cover" /> : <Upload className="w-8 h-8 text-slate-300" />}
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Código QR de Pagos</label>
                    <div className="relative group w-40 h-40 mx-auto">
                      <div className="w-full h-full bg-slate-100 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 group-hover:border-orange-500 transition-all cursor-pointer" onClick={() => qrInputRef.current?.click()}>
                        {isUploading === 'qr' ? <Loader2 className="w-8 h-8 text-orange-500 animate-spin" /> : restaurantSettings.qrUrl ? <img src={restaurantSettings.qrUrl} className="w-full h-full object-contain p-4" /> : <QrCode className="w-8 h-8 text-slate-300" />}
                      </div>
                      <input type="file" ref={qrInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'qr')} />
                    </div>
                  </div>

                  <div className="col-span-full space-y-6 pt-6 border-t border-slate-50">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">URL App Bancaria (Para Transferencias)</label>
                      <input type="text" value={restaurantSettings.transferUrl} onChange={e => setRestaurantSettings({...restaurantSettings, transferUrl: e.target.value})} className="w-full p-5 bg-slate-50 rounded-3xl font-mono text-[10px] outline-none border border-slate-200" placeholder="https://app.banco.com/pay" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Comercial</label>
                      <input type="text" value={restaurantSettings.name} onChange={e => setRestaurantSettings({...restaurantSettings, name: e.target.value})} className="w-full p-5 bg-slate-50 rounded-3xl font-black text-sm outline-none border border-slate-200" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center px-6">
                <h4 className="text-xl font-black italic uppercase text-slate-900">Mis Productos</h4>
                <button onClick={() => {setEditingItem(null); setIsAdminFormOpen(true);}} className="bg-slate-900 text-white px-8 py-4 rounded-full font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all flex items-center gap-2">
                  <PlusCircle className="w-4 h-4" /> Nuevo Plato
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-32">
                {menuItems.map(item => (
                  <div key={item.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 flex items-center gap-6 shadow-sm">
                    <img src={item.image} className="w-20 h-20 rounded-[1.5rem] object-cover" />
                    <div className="flex-1 min-w-0">
                      <h5 className="font-black uppercase text-xs italic mb-1 truncate">{item.name}</h5>
                      <p className="text-[9px] font-black text-orange-600 uppercase tracking-tighter">{item.category} • ${formatPrice(item.price)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingItem(item); setIsAdminFormOpen(true); }} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-slate-900 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteItem(item.id)} className="p-3 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'menu' && !isStaffMode && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 animate-fade-scale">
               {menuItems.filter(i => activeCategory === 'Todas' ? true : i.category === activeCategory).map(item => (
                 <div key={item.id} onClick={() => setSelectedFoodForDetail(item)} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-premium flex flex-col group transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer">
                    <div className="h-40 md:h-56 overflow-hidden relative">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-black shadow-lg text-slate-900">${formatPrice(item.price)}</div>
                    </div>
                    <div className="p-4 md:p-6 flex flex-col flex-1">
                      <h3 className="text-xs md:text-lg font-black text-slate-900 uppercase italic mb-1 truncate">{item.name}</h3>
                      <p className="text-[9px] md:text-xs text-slate-500 line-clamp-2 mb-4 font-medium">{item.description}</p>
                      <button className="mt-auto w-full py-2.5 bg-slate-50 group-hover:bg-slate-900 group-hover:text-white transition-all rounded-2xl font-black text-[9px] uppercase border border-slate-100 text-slate-900">Pedir Ahora</button>
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
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ingresa PIN Staff</p>
             <input type="password" placeholder="••••" maxLength={4} className="w-full py-5 bg-slate-50 rounded-2xl text-center text-4xl font-black tracking-[0.8em] outline-none border border-slate-200 focus:border-orange-500 shadow-inner" autoFocus onChange={(e) => { if(e.target.value === '1234') { setIsStaffMode(true); setShowLogin(false); setActiveView('admin'); } }} />
             <button onClick={() => setShowLogin(false)} className="mt-8 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {isAdminFormOpen && <AdminForm item={editingItem} categories={categories} onSave={async (d: any) => { if (d.id) await supabase.from('menu').upsert(d); else await supabase.from('menu').insert([d]); setIsAdminFormOpen(false); fetchData(); }} onClose={() => setIsAdminFormOpen(false)} />}
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

const AdminForm = ({ item, categories, onSave, onClose }: any) => {
  const [data, setData] = useState(item || { name: '', price: 0, category: categories[0]?.name || '', image: '', description: '' });
  const localFileRef = useRef<HTMLInputElement>(null);
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProduct(true);
    // Usamos el helper de Supabase Storage
    const fileName = `product-${Date.now()}.${file.name.split('.').pop()}`;
    const { data: uploadData, error } = await supabase.storage.from('assets').upload(`products/${fileName}`, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(`products/${fileName}`);
      setData({ ...data, image: publicUrl });
    }
    setIsUploadingProduct(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl z-[300] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-6 md:p-14 shadow-2xl text-slate-900 relative my-auto animate-in zoom-in duration-300">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-8 text-center md:text-left">Gestionar <span className="text-orange-600 not-italic">Plato</span></h2>
        <div className="space-y-4 md:space-y-6">
          <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-4 tracking-widest">Nombre del Plato</label><input type="text" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm outline-none border border-slate-200 focus:border-orange-500" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Precio</label><input type="number" step="0.01" value={data.price} onChange={e => setData({...data, price: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm outline-none border border-slate-200" /></div>
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-4">Categoría</label><select value={data.category} onChange={e => setData({...data, category: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border border-slate-200 uppercase">{categories.map((c: Category) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between px-4"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imagen de Alta Calidad</label><button onClick={() => localFileRef.current?.click()} className="text-orange-600 text-[9px] font-black uppercase flex items-center gap-1 hover:text-orange-700 transition-colors"><Upload className="w-3 h-3" /> {isUploadingProduct ? 'Subiendo...' : 'SUBIR ARCHIVO'}</button></div>
            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-inner">
              {data.image && <img src={data.image} className="w-12 h-12 rounded-xl object-cover shadow-lg border border-white shrink-0" />}
              <input type="text" value={data.image} onChange={e => setData({...data, image: e.target.value})} className="flex-1 bg-transparent font-bold text-[9px] outline-none truncate" placeholder="Pega URL o sube una imagen..." />
              <input type="file" ref={localFileRef} className="hidden" accept="image/*" onChange={handleProductImageUpload} />
            </div>
          </div>
          <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Descripción Gourmet</label><textarea value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none border border-slate-200 h-24 resize-none" /></div>
          <div className="pt-4 md:pt-6 flex flex-col gap-3">
            <button onClick={() => onSave(data)} className="w-full py-5 bg-slate-900 text-white rounded-full font-black uppercase text-[10px] tracking-[0.3em] shadow-2xl hover:bg-slate-800 transition-all">Confirmar Plato</button>
            <button onClick={onClose} className="w-full text-[9px] font-black text-slate-400 uppercase tracking-widest text-center py-2">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;