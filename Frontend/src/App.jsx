import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { WILAYAS } from './utils/wilayas';
import communesData from './utils/communes.json';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

function App() {
  // --- CUSTOMER-FACING STATE ---
  const [product, setProduct] = useState({
    id: '6a48eca24d4bcefe83f32d23', // Default seeded ID
    name: 'Claré Hydrating Sun Mist',
    price: 4800,
    discountPrice: 3900,
    imageCover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCMPzQqmwbkW2Jm-WSMQykVINs1L2aQNtNyRt2GBv9SJ3L0iIqcgcBa0fQU3YP3xcEQrsz9nXjyZsnwPkCck0uVzIL4U4guKZ0pGWSN_llq67yveprqUMlrojBCr-W7akjQ_gj5G6xHuvAKumvWvOWL4n--5c56OUUV1a1Ndvr-zqgf1QnS8Fs4uOt0PFz6lVz5F_dELtb82KmQ6I7HQusvY7EppViSHph7SX7G8sxNbtHrdyBlay-BVMXT9zlDysP-5Io',
    description: 'The ultimate fusion of clinical protection and sensorial elegance. A single mist provides all-day defense and luminous hydration.'
  });
  
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isFAQOpen, setIsFAQOpen] = useState({});
  const [orderSuccess, setOrderSuccess] = useState(null);

  // --- CHECKOUT FORM STATE ---
  const [formData, setFormData] = useState({
    customerName: '',
    phoneNumber: '',
    wilaya: '', // wilaya name
    baladia: '', // commune name
    homeAddress: '',
    paymentMethod: 'cash',
    shippingMethod: 'home', // home or stopdesk
    promoCode: '',
    middleName: '', // Honeypot field (must stay empty)
    robotVerified: false
  });
  
  const [shippingFee, setShippingFee] = useState(0);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const [isWilayaDropdownOpen, setIsWilayaDropdownOpen] = useState(false);
  const [isCommuneDropdownOpen, setIsCommuneDropdownOpen] = useState(false);

  // --- RESPONSIVE STATE ---
  const [activeSection, setActiveSection] = useState('science');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- ADMIN WORKSPACE STATE ---
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || null);
  const [adminUser, setAdminUser] = useState(JSON.parse(localStorage.getItem('adminUser')) || null);
  const [adminTab, setAdminTab] = useState('orders'); // orders, stats
  
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');

  const [adminOrders, setAdminOrders] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [shippingActionLoading, setShippingActionLoading] = useState(null); // stores order._id being processed

  // --- ROUTER SYSTEM ---
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Scroll section observer for dynamic navbar underlines
  useEffect(() => {
    if (currentPath === '/admin') return;

    const handleScroll = () => {
      const sections = ['science', 'collection', 'ingredients', 'faq'];
      const scrollPosition = window.scrollY + 120; // 120px offset for navbar

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentPath]);

  // --- FETCH PRODUCT ON MOUNT ---
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/products`);
        if (res.data && res.data.data && res.data.data.docs) {
          const found = res.data.data.docs.find(p => p.name.toLowerCase().includes('clar'));
          if (found) {
            setProduct({
              id: found._id,
              name: found.name,
              price: found.price,
              discountPrice: found.discounts && found.discounts[0] ? found.discounts[0].discountPrice : found.price,
              imageCover: found.imageCover || product.imageCover,
              description: found.description || product.description
            });
          }
        }
      } catch (err) {
        console.warn('Could not fetch product dynamically, using seeded fallback values:', err.message);
      }
    };
    fetchProduct();
  }, []);

  // --- ADMIN ACTIONS ---
  useEffect(() => {
    if (currentPath === '/admin' && adminToken) {
      fetchAdminOrders();
      fetchAdminStats();
    }
  }, [currentPath, adminToken]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminLoginError('');
    setAdminLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/users/login`, {
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword
      });
      
      if (res.data && res.data.token) {
        const user = res.data.data.user;
        if (['admin', 'manager'].includes(user.role)) {
          localStorage.setItem('adminToken', res.data.token);
          localStorage.setItem('adminUser', JSON.stringify(user));
          setAdminToken(res.data.token);
          setAdminUser(user);
          setAdminEmail('');
          setAdminPassword('');
        } else {
          setAdminLoginError('Access denied: Unauthorized role.');
        }
      }
    } catch (err) {
      console.error(err);
      setAdminLoginError(err.response?.data?.message || 'Login failed. Please verify credentials.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setAdminToken(null);
    setAdminUser(null);
  };

  const fetchAdminOrders = async () => {
    setLoadingOrders(true);
    setOrdersError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.data && res.data.data && res.data.data.docs) {
        setAdminOrders(res.data.data.docs);
      }
    } catch (err) {
      console.error(err);
      setOrdersError(err.response?.data?.message || 'Failed to retrieve orders.');
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchAdminStats = async () => {
    setLoadingStats(true);
    setStatsError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.data && res.data.status === 'success') {
        setAdminStats(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setStatsError(err.response?.data?.message || 'Failed to retrieve store statistics.');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setStatusUpdatingId(orderId);
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/orders/${orderId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      if (res.data && res.data.status === 'success') {
        setAdminOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleYalidineAction = async (orderId, action) => {
    setShippingActionLoading(orderId);
    try {
      let endpoint = '';
      if (action === 'send') endpoint = 'send-to-yalidine';
      if (action === 'cancel') endpoint = 'cancel-yalidine';
      if (action === 'sync') endpoint = 'sync-shipping';

      const res = await axios.post(
        `${API_BASE_URL}/orders/${orderId}/${endpoint}`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      if (res.data && res.data.status === 'success') {
        alert(res.data.message || 'Action completed successfully!');
        fetchAdminOrders(); // Refresh order details
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Shipping action failed');
    } finally {
      setShippingActionLoading(null);
    }
  };

  // --- CUSTOMER CART SYSTEM ---
  const addToCart = () => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1, type: 'product' }]);
    }
    setIsCartOpen(true);
  };

  const updateCartQty = (id, change) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.discountPrice * item.quantity, 0);
  const orderTotal = cartSubtotal + shippingFee;

  // --- DYNAMIC SHIPPING CALCULATOR ---
  useEffect(() => {
    const fetchShippingFee = async () => {
      if (!formData.wilaya || !formData.baladia) {
        setShippingFee(0);
        return;
      }
      setLoadingShipping(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/orders/shipping-fee`, {
          params: {
            wilaya: formData.wilaya,
            baladia: formData.baladia
          }
        });
        if (res.data && res.data.data) {
          const fees = res.data.data;
          if (formData.shippingMethod === 'home') {
            setShippingFee(fees.home || 0);
          } else {
            setShippingFee(fees.stopdesk || 0);
          }
        }
      } catch (err) {
        console.error('Failed to load shipping fees from API:', err.message);
        const isAlger = formData.wilaya.toLowerCase() === 'alger';
        if (formData.shippingMethod === 'home') {
          setShippingFee(isAlger ? 400 : 700);
        } else {
          setShippingFee(isAlger ? 300 : 450);
        }
      } finally {
        setLoadingShipping(false);
      }
    };

    fetchShippingFee();
  }, [formData.wilaya, formData.baladia, formData.shippingMethod]);

  const toggleFAQ = (index) => {
    setIsFAQOpen(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    setCheckoutError('');

    if (formData.middleName !== '') {
      setCheckoutError('Spam detected.');
      return;
    }

    if (!formData.robotVerified) {
      setCheckoutError('Please confirm that you are not a robot.');
      return;
    }

    const phoneRegex = /^0[5-7]\d{8}$/;
    if (!formData.phoneNumber || !phoneRegex.test(formData.phoneNumber.trim())) {
      setCheckoutError('Please enter a valid Algerian phone number (starting with 05, 06, or 07 followed by 8 digits).');
      return;
    }

    if (cart.length === 0) {
      setCheckoutError('Your cart is empty.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const formattedCart = cart.map(item => ({
        id: item.id,
        quantity: item.quantity,
        type: 'product'
      }));

      const payload = {
        cartData: JSON.stringify(formattedCart),
        customerName: formData.customerName,
        phoneNumber: formData.phoneNumber.trim(),
        wilaya: formData.wilaya,
        baladia: formData.baladia,
        homeAddress: formData.homeAddress,
        paymentMethod: formData.paymentMethod,
        shippingFee: shippingFee,
        shippingMethod: formData.shippingMethod,
        robotVerified: formData.robotVerified,
        middleName: formData.middleName,
        promoCode: formData.promoCode
      };

      const res = await axios.post(`${API_BASE_URL}/orders`, payload);

      if (res.data && res.data.status === 'success') {
        const orderInfo = res.data.data.order;
        
        if (orderInfo.paymentUrl) {
          window.location.href = orderInfo.paymentUrl;
          return;
        }

        setOrderSuccess(orderInfo);
        setCart([]);
        setIsCheckoutOpen(false);
      } else {
        setCheckoutError('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setCheckoutError(err.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const getCommunes = () => {
    if (!formData.wilaya) return [];
    const matching = WILAYAS.find(w => w.name === formData.wilaya);
    if (!matching) return [];
    const key = matching.code;
    return communesData[key] || [];
  };

  // ─── RENDER ADMINISTRATIVE WORKSPACE ───
  if (currentPath === '/admin') {
    if (!adminToken) {
      // ─── ADMIN LOGIN CARD ───
      return (
        <div className="min-h-screen bg-[#fcf9f8] flex items-center justify-center px-4 font-sans antialiased">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-soft border border-white/50 p-10 text-center">
            <img src="/Logo.png" alt="Claré Logo" className="h-10 mx-auto mb-2 cursor-pointer object-contain" onClick={() => navigateTo('/')} />
            <span className="text-xs font-bold text-[#7c5730] tracking-widest block mb-8 uppercase">ADMIN WORKSPACE</span>
            
            <form onSubmit={handleAdminLogin} className="space-y-6 text-left">
              {adminLoginError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-xs font-medium border border-red-100">
                  {adminLoginError}
                </div>
              )}
              
              <div>
                <label className="block text-[10px] font-bold text-[#7c5730] uppercase mb-1 tracking-wider">Email Address</label>
                <input 
                  required
                  type="email" 
                  placeholder="admin@clare.com"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7c5730]/20 focus:border-[#7c5730] text-sm bg-[#fcf9f8]"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7c5730] uppercase mb-1 tracking-wider">Password</label>
                <input 
                  required
                  type="password" 
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7c5730]/20 focus:border-[#7c5730] text-sm bg-[#fcf9f8]"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit"
                disabled={adminLoginLoading}
                className="w-full bg-[#150004] text-white py-4 rounded-full text-xs font-semibold tracking-widest hover:bg-[#3e0b1b] transition-all disabled:opacity-50"
              >
                {adminLoginLoading ? 'LOGGING IN...' : 'SECURE LOG IN'}
              </button>
            </form>
            <button onClick={() => navigateTo('/')} className="text-xs font-semibold text-[#7c5730] hover:text-[#150004] mt-8 underline inline-block">Back to Online Store</button>
          </div>
        </div>
      );
    }

    // ─── ADMIN DASHBOARD SYSTEM ───
    return (
      <div className="min-h-screen bg-[#fcf9f8] flex font-sans antialiased text-[#1c1b1b]">
        
        {/* SIDEBAR PANEL */}
        <aside className="w-64 bg-[#150004] text-white shrink-0 flex flex-col p-6 shadow-xl">
          <div className="border-b border-white/5 pb-6 mb-8">
            <img src="/Logo.png" alt="Claré Logo" className="h-10 object-contain brightness-0 invert mb-1" />
            <span className="text-[10px] font-bold text-[#ffd9df]/55 tracking-widest block uppercase">DASHBOARD WORKSPACE</span>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#ffd9df] text-[#150004] flex items-center justify-center font-bold">
              {adminUser?.name?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-bold block text-white truncate">{adminUser?.name}</span>
              <span className="text-[9px] font-semibold text-white/50 block capitalize">{adminUser?.role}</span>
            </div>
          </div>

          <nav className="grow space-y-2">
            <button 
              onClick={() => setAdminTab('orders')}
              className={`w-full py-3.5 px-4 rounded-xl text-left text-xs font-semibold tracking-wider uppercase flex items-center gap-3 transition-colors ${adminTab === 'orders' ? 'bg-[#ffd9df] text-[#150004]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-lg">local_shipping</span>
              Orders List
            </button>
            <button 
              onClick={() => setAdminTab('stats')}
              className={`w-full py-3.5 px-4 rounded-xl text-left text-xs font-semibold tracking-wider uppercase flex items-center gap-3 transition-colors ${adminTab === 'stats' ? 'bg-[#ffd9df] text-[#150004]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-lg">analytics</span>
              Statistics
            </button>
          </nav>

          <div className="border-t border-white/5 pt-6 space-y-3">
            <button 
              onClick={() => navigateTo('/')}
              className="w-full py-3 px-4 rounded-xl text-left text-xs font-semibold text-white/65 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-lg">storefront</span>
              Online Store
            </button>
            <button 
              onClick={handleAdminLogout}
              className="w-full py-3 px-4 rounded-xl text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-lg font-bold">logout</span>
              Log Out
            </button>
          </div>
        </aside>

        {/* WORKSPACE CONTENT AREA */}
        <main className="grow overflow-y-auto p-10 max-w-7xl font-sans text-sm">
          
          {/* Header info */}
          <header className="flex justify-between items-center mb-10 pb-6 border-b border-gray-200">
            <div>
              <h2 className="font-serif text-3xl font-semibold capitalize text-[#150004]">
                {adminTab === 'orders' ? 'Orders Management' : 'Performance Statistics'}
              </h2>
              <p className="text-xs text-[#524345] mt-1">Admin workspace tracking live database interactions.</p>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={adminTab === 'orders' ? fetchAdminOrders : fetchAdminStats}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-[#524345] p-3 rounded-full flex items-center justify-center transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
              </button>
            </div>
          </header>

          {/* ─── ORDERS TAB PANEL ─── */}
          {adminTab === 'orders' && (
            <div className="space-y-6">
              {ordersError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-xs font-medium border border-red-100">
                  {ordersError}
                </div>
              )}

              {loadingOrders ? (
                <div className="h-96 flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 border-4 border-[#7c5730] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-xs font-semibold text-[#524345]">Loading latest orders...</p>
                </div>
              ) : adminOrders.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-3xl p-16 text-center shadow-sm">
                  <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">inventory</span>
                  <p className="text-sm font-semibold text-[#524345]">No orders found in the database.</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-155 rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-[#7c5730] uppercase tracking-wider">
                          <th className="px-6 py-4.5">Order ID</th>
                          <th className="px-6 py-4.5">Customer</th>
                          <th className="px-6 py-4.5">Phone</th>
                          <th className="px-6 py-4.5">Wilaya</th>
                          <th className="px-6 py-4.5">Total Amount</th>
                          <th className="px-6 py-4.5">Payment</th>
                          <th className="px-6 py-4.5">Status</th>
                          <th className="px-6 py-4.5">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs font-medium text-gray-700">
                        {adminOrders.map(order => {
                          const isExpanded = expandedOrderId === order._id;
                          
                          let statusBadge = 'bg-yellow-50 text-yellow-700 border-yellow-100';
                          if (order.status === 'confirmed') statusBadge = 'bg-blue-50 text-blue-700 border-blue-100';
                          if (order.status === 'shipped') statusBadge = 'bg-purple-50 text-purple-700 border-purple-100';
                          if (order.status === 'delivered') statusBadge = 'bg-green-50 text-green-700 border-green-100';
                          if (order.status === 'cancelled') statusBadge = 'bg-red-50 text-red-700 border-red-100';

                          return (
                            <React.Fragment key={order._id}>
                              <tr className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 font-mono text-[10px] font-semibold text-gray-900">{order._id.substring(0, 10)}...</td>
                                <td className="px-6 py-4 text-gray-900">{order.customerName}</td>
                                <td className="px-6 py-4">{order.phoneNumber}</td>
                                <td className="px-6 py-4">{order.wilaya}</td>
                                <td className="px-6 py-4 font-semibold text-gray-900">{order.totalAmount} DZD</td>
                                <td className="px-6 py-4 uppercase font-semibold text-[9px] text-[#7c5730]">{order.paymentMethod}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider ${statusBadge}`}>
                                    {order.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <button 
                                    onClick={() => setExpandedOrderId(isExpanded ? null : order._id)}
                                    className="text-xs font-semibold text-[#7c5730] hover:text-[#150004] flex items-center gap-1 hover:underline"
                                  >
                                    {isExpanded ? 'Hide' : 'Manage'}
                                    <span className="material-symbols-outlined text-xs">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                                  </button>
                                </td>
                              </tr>
                              
                              {/* EXPANDED PANEL ROW */}
                              {isExpanded && (
                                <tr className="bg-gray-50/40">
                                  <td colSpan="8" className="px-8 py-6 border-t border-b border-gray-100">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                      
                                      {/* Order Summary & Products */}
                                      <div className="space-y-4 col-span-1">
                                        <h4 className="text-[10px] font-bold text-[#7c5730] uppercase tracking-wider border-b pb-2">Purchased Items</h4>
                                        <div className="space-y-3">
                                          {order.products?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                                              <div>
                                                <span className="text-xs font-semibold text-gray-900 block">{item.name}</span>
                                                <span className="text-[10px] text-gray-400">Qty: {item.quantity} • Unit: {item.finalPrice} DZD</span>
                                              </div>
                                              <span className="text-xs font-bold text-gray-800">{item.finalPrice * item.quantity} DZD</span>
                                            </div>
                                          ))}
                                          {order.packs?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                                              <div>
                                                <span className="text-xs font-semibold text-gray-900 block">{item.name}</span>
                                                <span className="text-[10px] text-gray-400">Pack Qty: {item.quantity}</span>
                                              </div>
                                              <span className="text-xs font-bold text-gray-800">{item.finalPrice * item.quantity} DZD</span>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="text-right text-[10px] font-bold text-gray-400 uppercase">
                                          Total Profit: <span className="text-[#8c4a5a] text-xs font-bold ml-1">{order.totalProfit} DZD</span>
                                        </div>
                                      </div>

                                      {/* Shipping & Yalidine Actions */}
                                      <div className="space-y-4 col-span-1 border-l lg:border-r border-gray-200/50 px-0 lg:px-8">
                                        <h4 className="text-[10px] font-bold text-[#7c5730] uppercase tracking-wider border-b pb-2">Yalidine Delivery Panel</h4>
                                        
                                        {order.yalidineTracking || order.shipping?.trackingNumber ? (
                                          <div className="space-y-2 text-xs">
                                            <div className="flex justify-between">
                                              <span className="text-gray-400">Tracking Code:</span>
                                              <span className="font-mono font-bold text-gray-900">{order.yalidineTracking || order.shipping.trackingNumber}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-gray-400">Parcel Status:</span>
                                              <span className="font-semibold text-gray-900">{order.yalidineStatus || order.shipping.status || 'draft'}</span>
                                            </div>
                                            {order.yalidineLabelUrl || order.shipping?.labelUrl ? (
                                              <a 
                                                href={order.yalidineLabelUrl || order.shipping.labelUrl} 
                                                target="_blank" 
                                                className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 underline font-semibold"
                                              >
                                                <span className="material-symbols-outlined text-sm">print</span>
                                                Print Shipping Label
                                              </a>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <p className="text-[11px] text-gray-400">No Yalidine parcel registered for this order yet.</p>
                                        )}

                                        <div className="flex flex-wrap gap-2 pt-4">
                                          <button
                                            type="button"
                                            disabled={shippingActionLoading !== null || order.yalidineTracking}
                                            onClick={() => handleYalidineAction(order._id, 'send')}
                                            className="px-3.5 py-2.5 rounded-lg bg-[#3e0b1b] text-white text-[10px] font-semibold tracking-wider hover:bg-[#150004] transition-colors disabled:opacity-50"
                                          >
                                            {shippingActionLoading === order._id ? 'SENDING...' : 'DISPATCH YALIDINE'}
                                          </button>
                                          
                                          <button
                                            type="button"
                                            disabled={shippingActionLoading !== null || (!order.yalidineTracking && !order.shipping?.trackingNumber)}
                                            onClick={() => handleYalidineAction(order._id, 'sync')}
                                            className="px-3.5 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-[10px] font-semibold tracking-wider transition-colors disabled:opacity-50"
                                          >
                                            SYNC CARRIER
                                          </button>
                                          
                                          <button
                                            type="button"
                                            disabled={shippingActionLoading !== null || (!order.yalidineTracking && !order.shipping?.trackingNumber)}
                                            onClick={() => handleYalidineAction(order._id, 'cancel')}
                                            className="px-3.5 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-semibold tracking-wider transition-colors disabled:opacity-50"
                                          >
                                            CANCEL SHIPMENT
                                          </button>
                                        </div>
                                      </div>

                                      {/* Status Management & Delivery Details */}
                                      <div className="space-y-4 col-span-1">
                                        <h4 className="text-[10px] font-bold text-[#7c5730] uppercase tracking-wider border-b pb-2">Update Order Status</h4>
                                        
                                        <div className="space-y-3">
                                          <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Shipping Details</span>
                                            <span className="text-xs font-semibold text-gray-900 block capitalize">{order.shippingMethod} Delivery ({order.shippingFee} DZD)</span>
                                            <span className="text-xs text-gray-700 block mt-1 leading-relaxed">
                                              {order.homeAddress}, {order.baladia}, {order.wilaya}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-3 pt-4">
                                            <select
                                              disabled={statusUpdatingId !== null}
                                              value={order.status}
                                              onChange={(e) => handleUpdateOrderStatus(order._id, e.target.value)}
                                              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7c5730]/20 bg-white text-xs"
                                            >
                                              <option value="pending">Pending</option>
                                              <option value="confirmed">Confirmed</option>
                                              <option value="shipped">Shipped</option>
                                              <option value="delivered">Delivered</option>
                                              <option value="cancelled">Cancelled</option>
                                            </select>
                                          </div>
                                        </div>
                                      </div>

                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── STATISTICS TAB PANEL ─── */}
          {adminTab === 'stats' && (
            <div className="space-y-8">
              {statsError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-xs font-medium border border-red-100">
                  {statsError}
                </div>
              )}

              {loadingStats ? (
                <div className="h-96 flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 border-4 border-[#7c5730] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-xs font-semibold text-[#524345]">Loading stats dashboard...</p>
                </div>
              ) : !adminStats ? (
                <div className="bg-white border border-gray-100 rounded-3xl p-16 text-center shadow-sm">
                  <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">analytics</span>
                  <p className="text-sm font-semibold text-[#524345]">No stats details retrieved.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Financial & General stats cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="glass p-6 rounded-2xl shadow-sm border border-white/60">
                      <span className="text-[10px] font-bold text-[#7c5730] uppercase tracking-wider block mb-2">Total Sales Revenue</span>
                      <span className="text-2xl font-bold text-gray-900 block">{adminStats.revenue || 0} DZD</span>
                      <span className="text-[10px] text-gray-400 mt-1 block">Accumulated order amounts</span>
                    </div>

                    <div className="glass p-6 rounded-2xl shadow-sm border border-white/60">
                      <span className="text-[10px] font-bold text-[#7c5730] uppercase tracking-wider block mb-2">Net Estimated Profit</span>
                      <span className="text-2xl font-bold text-[#8c4a5a] block">{adminStats.profit || 0} DZD</span>
                      <span className="text-[10px] text-gray-400 mt-1 block">FinalPrice - CostPrice margins</span>
                    </div>

                    <div className="glass p-6 rounded-2xl shadow-sm border border-white/60">
                      <span className="text-[10px] font-bold text-[#7c5730] uppercase tracking-wider block mb-2">Total Placed Orders</span>
                      <span className="text-2xl font-bold text-gray-900 block">{adminStats.totalOrders || 0}</span>
                      <span className="text-[10px] text-gray-400 mt-1 block">All registered db checkout logs</span>
                    </div>

                    <div className="glass p-6 rounded-2xl shadow-sm border border-white/60">
                      <span className="text-[10px] font-bold text-[#7c5730] uppercase tracking-wider block mb-2">Conversion Value</span>
                      <span className="text-2xl font-bold text-green-700 block">{(adminStats.revenue / Math.max(1, adminStats.totalOrders)).toFixed(0)} DZD</span>
                      <span className="text-[10px] text-gray-400 mt-1 block">Average cart checkout ticket</span>
                    </div>
                  </div>

                  {/* Order breakdown widgets */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Status breakdown */}
                    <div className="bg-white border border-gray-150 p-8 rounded-3xl shadow-sm">
                      <h3 className="text-xs font-bold text-[#7c5730] uppercase tracking-wider mb-6 border-b pb-3">Status Breakdown</h3>
                      <div className="space-y-4">
                        {adminStats.statusStats?.map((s, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="text-xs font-semibold capitalize text-gray-600">{s._id}</span>
                            <div className="flex items-center gap-4 grow mx-6">
                              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-[#7c5730] h-full" 
                                  style={{ width: `${(s.count / Math.max(1, adminStats.totalOrders)) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-bold text-gray-900 min-w-8 text-right">{s.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Yalidine shipping provider metrics */}
                    <div className="bg-white border border-gray-150 p-8 rounded-3xl shadow-sm">
                      <h3 className="text-xs font-bold text-[#7c5730] uppercase tracking-wider mb-6 border-b pb-3">Yalidine Delivery Overview</h3>
                      <div className="space-y-4">
                        {adminStats.yalidineStats?.map((y, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-gray-600 uppercase font-mono">{y._id || 'draft / manual'}</span>
                            <div className="flex items-center gap-4 grow mx-6">
                              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-[#8c4a5a] h-full" 
                                  style={{ width: `${(y.count / Math.max(1, adminStats.totalOrders)) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-bold text-gray-900 min-w-8 text-right">{y.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    );
  }

  // ─── RENDER CUSTOMER-FACING SKINCARE WEBSITE ───
  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b] font-sans antialiased">
      
      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex justify-between items-center">
          <img src="/Logo.png" alt="Claré Logo" className="h-10 w-auto cursor-pointer object-contain" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} />
          <div className="hidden md:flex items-center gap-8">
            <a 
              className={`pb-1 transition-all text-xs uppercase tracking-widest ${activeSection === 'science' ? 'text-[#150004] font-bold border-b-2 border-[#150004]' : 'text-[#524345] hover:text-[#150004]'}`} 
              href="#science"
            >
              Science
            </a>
            <a 
              className={`pb-1 transition-all text-xs uppercase tracking-widest ${activeSection === 'collection' ? 'text-[#150004] font-bold border-b-2 border-[#150004]' : 'text-[#524345] hover:text-[#150004]'}`} 
              href="#collection"
            >
              Collection
            </a>
            <a 
              className={`pb-1 transition-all text-xs uppercase tracking-widest ${activeSection === 'ingredients' ? 'text-[#150004] font-bold border-b-2 border-[#150004]' : 'text-[#524345] hover:text-[#150004]'}`} 
              href="#ingredients"
            >
              Ingredients
            </a>
            <a 
              className={`pb-1 transition-all text-xs uppercase tracking-widest ${activeSection === 'faq' ? 'text-[#150004] font-bold border-b-2 border-[#150004]' : 'text-[#524345] hover:text-[#150004]'}`} 
              href="#faq"
            >
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-[#150004] hover:opacity-80 transition-opacity"
            >
              <span className="material-symbols-outlined text-2xl">shopping_bag</span>
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#8c4a5a] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
            <button 
              onClick={() => {
                if (cart.length === 0) addToCart();
                setIsCheckoutOpen(true);
              }}
              className="bg-[#3e0b1b] text-white px-6 py-2.5 rounded-full text-xs font-semibold tracking-widest hover:bg-[#150004] transition-all hidden sm:block"
            >
              SHOP NOW
            </button>
            {/* Hamburger menu button for mobile screens */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-[#150004] md:hidden hover:opacity-80 transition-opacity"
            >
              <span className="material-symbols-outlined text-2xl">
                {isMobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Dropdown Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-[73px] left-0 w-full bg-white/95 backdrop-blur-xl border-b border-gray-150 z-30 shadow-md flex flex-col p-6 space-y-4">
          <a 
            onClick={() => setIsMobileMenuOpen(false)}
            className={`text-xs uppercase tracking-widest font-semibold py-2 border-b border-gray-50 ${activeSection === 'science' ? 'text-[#7c5730] font-bold' : 'text-[#524345]'}`} 
            href="#science"
          >
            Science
          </a>
          <a 
            onClick={() => setIsMobileMenuOpen(false)}
            className={`text-xs uppercase tracking-widest font-semibold py-2 border-b border-gray-50 ${activeSection === 'collection' ? 'text-[#7c5730] font-bold' : 'text-[#524345]'}`} 
            href="#collection"
          >
            Collection
          </a>
          <a 
            onClick={() => setIsMobileMenuOpen(false)}
            className={`text-xs uppercase tracking-widest font-semibold py-2 border-b border-gray-50 ${activeSection === 'ingredients' ? 'text-[#7c5730] font-bold' : 'text-[#524345]'}`} 
            href="#ingredients"
          >
            Ingredients
          </a>
          <a 
            onClick={() => setIsMobileMenuOpen(false)}
            className={`text-xs uppercase tracking-widest font-semibold py-2 ${activeSection === 'faq' ? 'text-[#7c5730] font-bold' : 'text-[#524345]'}`} 
            href="#faq"
          >
            FAQ
          </a>
          <button 
            onClick={() => {
              setIsMobileMenuOpen(false);
              if (cart.length === 0) addToCart();
              setIsCheckoutOpen(true);
            }}
            className="w-full bg-[#3e0b1b] text-white py-3.5 rounded-full text-xs font-semibold tracking-widest hover:bg-[#150004] transition-all text-center"
          >
            SHOP NOW
          </button>
        </div>
      )}

      {/* ─── HERO SECTION ─── */}
      <header className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-[#f6f3f2]">
        <div className="absolute inset-0 z-0">
          <img 
            className="w-full h-full object-cover" 
            alt="Mediterranean glow golden hour editorial skincare look" 
            src="/hero_clean.png"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#fcf9f8]/90 via-[#fcf9f8]/40 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 w-full py-12">
          <div className="max-w-2xl">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#fdcb9b] text-[#79542d] text-xs font-semibold tracking-wider mb-6 uppercase">
              NEW RELEASE
            </span>
            <h1 className="font-serif text-5xl md:text-7xl text-[#150004] leading-tight mb-6">
              Protect. Hydrate.<br/>Glow Naturally.
            </h1>
            <p className="text-lg md:text-xl text-[#524345] mb-10 max-w-lg leading-relaxed">
              Broad Spectrum SPF 50 sunscreen mist enriched with Aloe Vera, Chamomile, and Vitamins B5 & E for weightless, radiant daily protection.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <button 
                onClick={addToCart}
                className="bg-[#150004] text-white px-10 py-5 rounded-full text-xs font-semibold tracking-widest hover:bg-[#3e0b1b] transition-all flex items-center justify-center gap-2 group"
              >
                ADD TO CART 
                <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">arrow_forward</span>
              </button>
              <a 
                href="#science"
                className="border border-[#7c5730] text-[#7c5730] px-10 py-5 rounded-full text-xs font-semibold tracking-widest text-center hover:bg-[#7c5730]/5 transition-all"
              >
                LEARN MORE
              </a>
            </div>
            
            <div className="flex flex-wrap gap-8 items-center border-t border-[#7c5730]/10 pt-10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#7c5730] fill-current">verified</span>
                <span className="text-xs font-semibold text-[#524345] tracking-wider">SPF 50 UVA/UVB</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#7c5730] fill-current">science</span>
                <span className="text-xs font-semibold text-[#524345] tracking-wider">DERMATOLOGICALLY TESTED</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#7c5730] fill-current">spa</span>
                <span className="text-xs font-semibold text-[#524345] tracking-wider">NON-GREASY FORMULA</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── ORDER SUCCESS BANNER ─── */}
      {orderSuccess && (
        <div className="max-w-[1280px] mx-auto px-6 mt-12">
          <div className="bg-[#fdcb9b]/30 border-2 border-[#7c5730]/20 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#7c5730]/10 flex items-center justify-center text-[#7c5730] shrink-0">
              <span className="material-symbols-outlined text-3xl">done_all</span>
            </div>
            <div className="grow">
              <h3 className="font-serif text-2xl text-[#150004] mb-2">Thank you! Your order was placed.</h3>
              <p className="text-sm text-[#524345]">
                Order ID: <span className="font-mono font-bold">{orderSuccess._id}</span> • Customer: <span className="font-semibold">{orderSuccess.customerName}</span>
              </p>
              <p className="text-xs text-[#524345]/80 mt-1">
                Status: <span className="text-[#7c5730] font-semibold">{orderSuccess.status}</span>. You can track this order or wait for verification.
              </p>
            </div>
            <button 
              onClick={() => setOrderSuccess(null)}
              className="text-xs font-semibold text-[#7c5730] underline hover:text-[#150004]"
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

      {/* ─── FEATURE GRID ─── */}
      <section id="science" className="py-24 bg-[#fcf9f8]">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-[#7c5730] uppercase tracking-[0.2em] mb-4 block">EXCELLENCE ENCAPSULATED</span>
            <h2 className="font-serif text-4xl text-[#150004]">Advanced Skin Defense</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-8 rounded-2xl bg-[#f6f3f2] hover:bg-[#f0eded] transition-colors duration-300 shadow-sm border border-white/50">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm">
                <span className="material-symbols-outlined text-[#7c5730]">wb_sunny</span>
              </div>
              <h3 className="font-serif text-xl text-[#150004] mb-3">SPF 50 Protection</h3>
              <p className="text-[#524345] text-sm leading-relaxed">Highest grade UVA/UVB broad-spectrum defense against photo-aging and skin degradation.</p>
            </div>
            <div className="p-8 rounded-2xl bg-[#f6f3f2] hover:bg-[#f0eded] transition-colors duration-300 shadow-sm border border-white/50">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm">
                <span className="material-symbols-outlined text-[#7c5730]">eco</span>
              </div>
              <h3 className="font-serif text-xl text-[#150004] mb-3">Aloe & Chamomile</h3>
              <p className="text-[#524345] text-sm leading-relaxed">Soothing botanical extracts that calm inflammation and reduce sun-induced redness instantly.</p>
            </div>
            <div className="p-8 rounded-2xl bg-[#f6f3f2] hover:bg-[#f0eded] transition-colors duration-300 shadow-sm border border-white/50">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm">
                <span className="material-symbols-outlined text-[#7c5730]">water_drop</span>
              </div>
              <h3 className="font-serif text-xl text-[#150004] mb-3">Light Hydration</h3>
              <p className="text-[#524345] text-sm leading-relaxed">A weightless, refreshing fine mist that absorbs instantly with no white cast or greasy film.</p>
            </div>
            <div className="p-8 rounded-2xl bg-[#f6f3f2] hover:bg-[#f0eded] transition-colors duration-300 shadow-sm border border-white/50">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm">
                <span className="material-symbols-outlined text-[#7c5730]">clinical_notes</span>
              </div>
              <h3 className="font-serif text-xl text-[#150004] mb-3">Clinical Sourcing</h3>
              <p className="text-[#524345] text-sm leading-relaxed">Validated through rigorous laboratory testing for all skin types, including highly sensitive skin.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHY CLARÉ SPLIT LAYOUT ─── */}
      <section id="collection" className="py-24 bg-white">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="w-full lg:w-1/2 relative group">
              <div className="absolute -inset-4 bg-[#7c5730]/5 rounded-3xl transition-all group-hover:scale-105 duration-700"></div>
              <img 
                className="relative rounded-2xl w-full h-[320px] sm:h-[450px] lg:h-[600px] object-cover shadow-xl" 
                alt="Claré SPF Mist application visual close up" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCeISu62jwRHGz4VfcvEH6rlN5LYE2-REblrQx1CjCGY8wPhVC1K38pzWi48kB2-ydA7Dc-KUBOLOb--sA66ElBPl1F6-1f59VslmD94DIeTWKKEK7FZ2GIdUYHG7gO8ikwhmisHi8F1420gm1m_jHWF51hvhAN812_Ep31jyCyQM3LByBgRbkFKIrJsOg8_ZkS3mOEtCTGc_5ldDAYGfGbluPbCcpWer4-zsr-a0HsyTsQalhHftXWpw"
              />
            </div>
            
            <div className="w-full lg:w-1/2">
              <span className="text-xs font-bold text-[#7c5730] uppercase mb-4 block tracking-wider">OUR PHILOSOPHY</span>
              <h2 className="font-serif text-4xl md:text-5xl text-[#150004] mb-8">Why Experts Choose Claré</h2>
              
              <ul className="space-y-8">
                <li className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-[#7c5730] mt-1">check_circle</span>
                  <div>
                    <span className="text-lg font-semibold block text-[#150004]">Ultimate UV Shield</span>
                    <p className="text-[#524345] text-sm mt-1 leading-relaxed">Protects against the full spectrum of UVA/UVB rays to actively prevent long-term sun spot formation.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-[#7c5730] mt-1">check_circle</span>
                  <div>
                    <span className="text-lg font-semibold block text-[#150004]">Zero Residue Finish</span>
                    <p className="text-[#524345] text-sm mt-1 leading-relaxed">Engineered for immediate absorption with absolutely no heavy residue or oily layer.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-[#7c5730] mt-1">check_circle</span>
                  <div>
                    <span className="text-lg font-semibold block text-[#150004]">Makeup Ready</span>
                    <p className="text-[#524345] text-sm mt-1 leading-relaxed">Works perfectly as a setting spray or a base primer, creating a hydrated canvas for cosmetics.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── INGREDIENTS GRID ─── */}
      <section id="ingredients" className="py-24 bg-[#fcf9f8]">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-[#150004] mb-4">Bio-Active Ingredients</h2>
            <p className="text-[#524345] text-sm max-w-xl mx-auto">Sourced with pharmaceutical precision to deliver therapeutic skin health alongside protection.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass p-8 rounded-2xl flex flex-col items-center text-center hover:bg-white/90 transition-all duration-300">
              <div className="mb-6 w-24 h-24 rounded-full bg-white shadow-inner flex items-center justify-center p-2 overflow-hidden border border-gray-100">
                <img 
                  className="w-full h-full object-cover rounded-full" 
                  alt="Aloe Vera macro visual" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmaGuz8sapoPo6-NOeT9z-w5nVmvmTjYRpt0CWktIxuvFcWTCT2yOQxVIzGk3mY4-lw5xigSkmlEFmbOhxaS7zBjFFs5di5GZC1-boFq4qypR540-2-wM8V8DLjv3RVRpkGMFeYv5zOAIqNMmHj0DGLzy72ljTITHz2tj_-7PzyMXcyHbXu5Xdt1zktiWj8zex4Qv_IfGN6cR965NTl7RhZltUEfL3zFk8AMtoz0nvQd6Il88q0AcryQ"
                />
              </div>
              <span className="text-[10px] font-bold text-[#7c5730] mb-2 tracking-widest">ALOE VERA</span>
              <h3 className="font-serif text-lg text-[#150004] mb-3 font-semibold">Hydration Master</h3>
              <p className="text-xs text-[#524345] leading-relaxed">Locks in crucial moisture levels and cools the outer skin barrier after UV exposure.</p>
            </div>
            
            <div className="glass p-8 rounded-2xl flex flex-col items-center text-center hover:bg-white/90 transition-all duration-300">
              <div className="mb-6 w-24 h-24 rounded-full bg-white shadow-inner flex items-center justify-center p-2 overflow-hidden border border-gray-100">
                <img 
                  className="w-full h-full object-cover rounded-full" 
                  alt="Chamomile macro visual" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDICX5fCbPxQzDPcf3UrJ9GPxkgxS4PonHmKzD6EPRfVLNWUACJC0ecCjLlA6gGjmKz24Wpk9Cjad15OaJcRuznF7bBRhAq0Bo758zAZN6as19OHRnhcPvxeT8B4IwdSSqTYjqtO0cQeBDQy2zi5objjEGN55nvKSljAP89B_X-w_bo0v_ksAErEnORDD2TZK3uc5dHkmv9w9qhGxOs5O_V1zjNy2n1QkieymFrB5RH3_zKAgWynUq31w"
                />
              </div>
              <span className="text-[10px] font-bold text-[#7c5730] mb-2 tracking-widest">CHAMOMILE</span>
              <h3 className="font-serif text-lg text-[#150004] mb-3 font-semibold">Soothing Agent</h3>
              <p className="text-xs text-[#524345] leading-relaxed">Rich in anti-inflammatory components that neutralize environmental stress.</p>
            </div>

            <div className="glass p-8 rounded-2xl flex flex-col items-center text-center hover:bg-white/90 transition-all duration-300">
              <div className="mb-6 w-24 h-24 rounded-full bg-white shadow-inner flex items-center justify-center p-2 overflow-hidden border border-gray-100">
                <div className="w-full h-full rounded-full flex items-center justify-center bg-[#fdcb9b]/20 border border-[#fdcb9b]/40">
                  <span className="font-serif text-2xl font-bold text-[#7c5730]">B5</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#7c5730] mb-2 tracking-widest">VITAMIN B5</span>
              <h3 className="font-serif text-lg text-[#150004] mb-3 font-semibold">Skin Recovery</h3>
              <p className="text-xs text-[#524345] leading-relaxed">Enhances natural cellular repair processes and improves overall skin elasticity.</p>
            </div>

            <div className="glass p-8 rounded-2xl flex flex-col items-center text-center hover:bg-white/90 transition-all duration-300">
              <div className="mb-6 w-24 h-24 rounded-full bg-white shadow-inner flex items-center justify-center p-2 overflow-hidden border border-gray-100">
                <div className="w-full h-full rounded-full flex items-center justify-center bg-[#ffd9df]/20 border border-[#ffd9df]/40">
                  <span className="font-serif text-2xl font-bold text-[#8c4a5a]">E</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#7c5730] mb-2 tracking-widest">VITAMIN E</span>
              <h3 className="font-serif text-lg text-[#150004] mb-3 font-semibold">Defense Shield</h3>
              <p className="text-xs text-[#524345] leading-relaxed">Provides powerful antioxidant layers to actively combat oxidation free-radicals.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BEFORE & AFTER SPLIT PHOTO ─── */}
      <section className="py-24 bg-[#f6f3f2] overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-[#150004] mb-4">Visible Protection</h2>
            <p className="text-[#524345] text-sm">Witness the difference of pharmaceutical-grade SPF defense.</p>
          </div>
          
          <div className="relative w-full max-w-4xl mx-auto aspect-[16/9] overflow-hidden rounded-3xl shadow-lg border border-white/40 select-none">
            <img 
              className="w-full h-full object-cover" 
              alt="Side-by-side skin protection comparison of an Algerian woman. Left side is clean and glowing; right side is unprotected with sunspots." 
              src="/skin_split.png"
              draggable="false"
            />
            <div className="absolute bottom-6 left-6 glass px-4 py-2 rounded-xl text-[10px] font-bold text-[#1c1b1b] tracking-widest">PROTECTED BY CLARÉ (LEFT)</div>
            <div className="absolute bottom-6 right-6 glass px-4 py-2 rounded-xl text-[10px] font-bold text-[#1c1b1b] tracking-widest">UNPROTECTED SKIN (RIGHT)</div>
          </div>
        </div>
      </section>

      {/* ─── PRODUCT SHOWCASE CARD ─── */}
      <section className="py-24 bg-[#fcf9f8]">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col items-center">
          <div className="glass p-8 md:p-16 rounded-[40px] shadow-soft max-w-4xl w-full flex flex-col lg:flex-row items-center gap-12 border border-white/60">
            <div className="relative w-full max-w-xs shrink-0">
              <img className="w-full h-auto drop-shadow-2xl hover:scale-105 transition-transform duration-500" src={product.imageCover} alt={product.name}/>
              
              <div className="absolute -top-6 -right-6 animate-bounce" style={{ animationDuration: '3s' }}>
                <div className="glass w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-md border border-[#fdcb9b]">
                  <span className="text-[9px] font-bold text-[#7c5730] uppercase">SPF</span>
                  <span className="font-bold text-lg text-[#150004]">50</span>
                </div>
              </div>
              <div className="absolute top-1/2 -left-8 animate-pulse" style={{ animationDuration: '4s' }}>
                <div className="glass px-4 py-3 rounded-full flex flex-col items-center justify-center shadow-md border border-[#ffd9df]">
                  <span className="text-[9px] font-bold text-[#8c4a5a] uppercase">VITAMINS</span>
                  <span className="font-bold text-xs text-[#150004]">B5 & E</span>
                </div>
              </div>
            </div>
            
            <div className="grow text-left">
              <h2 className="font-serif text-3xl md:text-4xl text-[#150004] mb-4 font-semibold">{product.name}</h2>
              <p className="text-sm text-[#524345] mb-8 leading-relaxed">{product.description}</p>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
                <div className="flex flex-col">
                  <span className="text-xs text-[#7c5730] font-bold uppercase tracking-wider">LIMITED TIME PRICE</span>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-3xl font-bold text-[#150004]">{product.discountPrice} DZD</span>
                    {product.price > product.discountPrice && (
                      <span className="text-sm text-[#524345] line-through">{product.price} DZD</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 px-5 py-3.5 rounded-full border border-[#7c5730]/10 bg-white/50">
                  <div className="flex text-[#7c5730]">
                    <span className="material-symbols-outlined text-sm fill-current">star</span>
                    <span className="material-symbols-outlined text-sm fill-current">star</span>
                    <span className="material-symbols-outlined text-sm fill-current">star</span>
                    <span className="material-symbols-outlined text-sm fill-current">star</span>
                    <span className="material-symbols-outlined text-sm fill-current">star</span>
                  </div>
                  <span className="text-xs font-semibold text-[#1c1b1b]">4.9 (2,300+ reviews)</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={addToCart}
                  className="bg-[#150004] text-white px-10 py-4.5 rounded-full text-xs font-semibold tracking-widest hover:bg-[#3e0b1b] transition-all flex items-center justify-center gap-3 shadow-md"
                >
                  ADD TO CART
                  <span className="material-symbols-outlined text-sm">shopping_bag</span>
                </button>
                <button 
                  onClick={() => {
                    if (cart.length === 0) addToCart();
                    setIsCheckoutOpen(true);
                  }}
                  className="border border-[#150004] text-[#150004] px-10 py-4.5 rounded-full text-xs font-semibold tracking-widest hover:bg-[#150004]/5 transition-all"
                >
                  BUY NOW
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ SECTION ─── */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-serif text-4xl text-[#150004] mb-12 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            
            <div className="border-b border-[#7c5730]/10">
              <button 
                className="w-full py-6 flex justify-between items-center text-left focus:outline-none group" 
                onClick={() => toggleFAQ(0)}
              >
                <span className="text-lg text-[#150004] font-medium">How often should I reapply the SPF mist?</span>
                <span className={`material-symbols-outlined text-[#7c5730] transition-transform duration-300 ${isFAQOpen[0] ? 'rotate-45' : ''}`}>add</span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${isFAQOpen[0] ? 'max-h-40' : 'max-h-0'}`}>
                <p className="pb-6 text-[#524345] text-sm leading-relaxed">
                  For continuous protection, we recommend reapplying every 2 hours, especially if you are outdoors, swimming, or sweating. The ultra-fine mist is lightweight enough to apply right over cosmetics without disturbing your makeup.
                </p>
              </div>
            </div>

            <div className="border-b border-[#7c5730]/10">
              <button 
                className="w-full py-6 flex justify-between items-center text-left focus:outline-none group" 
                onClick={() => toggleFAQ(1)}
              >
                <span className="text-lg text-[#150004] font-medium">Is it suitable for acne-prone skin?</span>
                <span className={`material-symbols-outlined text-[#7c5730] transition-transform duration-300 ${isFAQOpen[1] ? 'rotate-45' : ''}`}>add</span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${isFAQOpen[1] ? 'max-h-40' : 'max-h-0'}`}>
                <p className="pb-6 text-[#524345] text-sm leading-relaxed">
                  Yes, Claré SPF 50 is non-comedogenic, oil-free, and dermatologically tested. The organic extracts like Aloe and Chamomile help soothe reactive skin and reduce underlying redness.
                </p>
              </div>
            </div>

            <div className="border-b border-[#7c5730]/10">
              <button 
                className="w-full py-6 flex justify-between items-center text-left focus:outline-none group" 
                onClick={() => toggleFAQ(2)}
              >
                <span className="text-lg text-[#150004] font-medium">Does it leave a white cast on darker skin tones?</span>
                <span className={`material-symbols-outlined text-[#7c5730] transition-transform duration-300 ${isFAQOpen[2] ? 'rotate-45' : ''}`}>add</span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${isFAQOpen[2] ? 'max-h-40' : 'max-h-0'}`}>
                <p className="pb-6 text-[#524345] text-sm leading-relaxed">
                  Absolutely not. We have engineered the formula to be completely transparent upon contact with all skin tones, leaving only a natural, radiant glow and zero chalky residue.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── FINAL CTA BANNER ─── */}
      <section className="pb-24">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="bg-[#ffdcbd] rounded-[40px] py-20 px-8 text-center relative overflow-hidden shadow-sm">
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(#7c5730 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }}></div>
            </div>
            <div className="relative z-10">
              <h2 className="font-serif text-4xl md:text-5xl text-[#150004] mb-6 font-semibold">Your Skin Deserves<br/>Premium Protection.</h2>
              <p className="text-base md:text-lg text-[#61401b] mb-10 max-w-xl mx-auto leading-relaxed">Join thousands of skincare enthusiasts who have switched to the future of light, botanical sun protection.</p>
              <button 
                onClick={() => {
                  if (cart.length === 0) addToCart();
                  setIsCheckoutOpen(true);
                }}
                className="bg-[#150004] text-white px-12 py-5 rounded-full text-xs font-semibold tracking-widest hover:bg-[#3e0b1b] transition-all shadow-md"
              >
                BUY CLARÉ SPF 50
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#150004] text-white py-20 border-t border-white/5">
        <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img src="/Logo.png" alt="Claré Logo" className="h-8 w-auto object-contain brightness-0 invert" />
              <span className="font-serif text-xl text-[#ffd9df] font-semibold">Laboratoires</span>
            </div>
            <p className="text-white/60 text-sm max-w-sm mb-10 leading-relaxed">Pioneering the intersection of clean clinical research and premium botanical hydration. Paris, France.</p>
            <div className="flex gap-4">
              <a className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors" href="#">
                <span className="material-symbols-outlined text-sm">language</span>
              </a>
              <a className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors" href="#">
                <span className="material-symbols-outlined text-sm">share</span>
              </a>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-white mb-6 tracking-widest">EXPLORE</h4>
            <ul className="space-y-4 text-white/60 text-sm">
              <li><a className="hover:text-[#ffd9df] transition-colors" href="#science">Science</a></li>
              <li><a className="hover:text-[#ffd9df] transition-colors" href="#collection">Collection</a></li>
              <li><a className="hover:text-[#ffd9df] transition-colors" href="#ingredients">Ingredients</a></li>
              <li><a className="hover:text-[#ffd9df] transition-colors" href="#faq">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-white mb-6 tracking-widest">NEWSLETTER</h4>
            <p className="text-xs text-white/60 mb-6 leading-relaxed">Subscribe to receive exclusive clinical studies and seasonal offers.</p>
            <div className="flex border-b border-white/10 pb-2">
              <input 
                className="bg-transparent border-none outline-none text-xs w-full placeholder:text-white/30 focus:ring-0" 
                placeholder="Email Address" 
                type="email"
              />
              <button className="material-symbols-outlined text-[#ffd9df] hover:opacity-85">arrow_forward</button>
            </div>
          </div>
        </div>
        <div className="max-w-[1280px] mx-auto px-6 mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="text-xs text-white/40">© 2026 Claré Laboratoires. All rights reserved.</span>
          <div className="flex gap-8 text-xs text-white/40">
            <span className="hover:text-[#ffd9df] cursor-pointer transition-colors" onClick={() => navigateTo('/admin')}>Admin Panel</span>
            <a className="hover:text-white transition-colors" href="#">Privacy Policy</a>
            <a className="hover:text-white transition-colors" href="#">Terms of Service</a>
            <a className="hover:text-white transition-colors" href="#">Shipping & Returns</a>
          </div>
        </div>
      </footer>

      {/* ─── CART SIDEBAR ─── */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-[#150004]/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCartOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
              
              <div className="px-6 py-6 bg-[#fcf9f8] border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-serif text-2xl font-semibold text-[#150004]">Your Cart</h3>
                <button onClick={() => setIsCartOpen(false)} className="text-[#524345] hover:opacity-80">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <div className="grow overflow-y-auto px-6 py-6 divide-y divide-gray-100">
                {cart.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-3">shopping_bag</span>
                    <p className="text-sm text-[#524345]">Your cart is empty.</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="py-6 flex gap-4">
                      <img className="w-20 h-20 object-contain rounded-lg bg-gray-50 border border-gray-100 p-1 shrink-0" src={item.imageCover} alt={item.name}/>
                      <div className="grow">
                        <h4 className="font-semibold text-[#1c1b1b] text-sm">{item.name}</h4>
                        <span className="text-xs text-[#7c5730] font-semibold block mt-1">{item.discountPrice} DZD</span>
                        
                        <div className="flex items-center gap-3 mt-4">
                          <button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-xs hover:bg-gray-50">-</button>
                          <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-xs hover:bg-gray-50">+</button>
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 self-start">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              {cart.length > 0 && (
                <div className="border-t border-gray-100 px-6 py-6 bg-[#fcf9f8]">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-sm text-[#524345]">Subtotal</span>
                    <span className="text-lg font-bold text-[#150004]">{cartSubtotal} DZD</span>
                  </div>
                  <button 
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full bg-[#150004] text-white py-4 rounded-full text-xs font-semibold tracking-widest hover:bg-[#3e0b1b] transition-all"
                  >
                    PROCEED TO CHECKOUT
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── CHECKOUT MODAL ─── */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
            <div className="fixed inset-0 bg-[#150004]/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCheckoutOpen(false)} />
            
            <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              
              <div className="px-8 py-6 bg-[#fcf9f8] border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-serif text-2xl font-semibold text-[#150004]">Complete Your Order</h3>
                <button onClick={() => setIsCheckoutOpen(false)} className="text-[#524345] hover:opacity-80">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <form onSubmit={handleCheckoutSubmit} className="p-8 space-y-6">
                {checkoutError && (
                  <div className="bg-red-50 text-red-700 p-4 rounded-xl text-xs font-medium border border-red-100">
                    {checkoutError}
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#7c5730] uppercase mb-1 tracking-wider">Full Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Enter your full name"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7c5730]/20 focus:border-[#7c5730] text-sm"
                      value={formData.customerName}
                      onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    />
                  </div>
                  
                  {/* Phone Number */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#7c5730] uppercase mb-1 tracking-wider">Phone Number</label>
                    <input 
                      required
                      type="tel" 
                      placeholder="e.g. 0555123456"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7c5730]/20 focus:border-[#7c5730] text-sm"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Wilaya Selection */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-[#7c5730] uppercase mb-1 tracking-wider">Wilaya</label>
                    <button
                      type="button"
                      id="wilaya-select-btn"
                      onClick={() => {
                        setIsWilayaDropdownOpen(!isWilayaDropdownOpen);
                        setIsCommuneDropdownOpen(false);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7c5730]/20 focus:border-[#7c5730] text-sm bg-white text-left flex justify-between items-center"
                    >
                      <span>{formData.wilaya ? formData.wilaya : "Select your Wilaya"}</span>
                      <span className="material-symbols-outlined text-gray-400">arrow_drop_down</span>
                    </button>
                    {isWilayaDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 divide-y divide-gray-50">
                        {WILAYAS.map(w => (
                          <button
                            key={w.code}
                            type="button"
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-[#7c5730]/5 text-gray-700 block transition-colors"
                            onClick={() => {
                              setFormData({ ...formData, wilaya: w.name, baladia: '' });
                              setIsWilayaDropdownOpen(false);
                            }}
                          >
                            {w.code} - {w.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Commune / Baladia Selection */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-[#7c5730] uppercase mb-1 tracking-wider">Commune</label>
                    <button
                      type="button"
                      id="commune-select-btn"
                      disabled={!formData.wilaya}
                      onClick={() => {
                        setIsCommuneDropdownOpen(!isCommuneDropdownOpen);
                        setIsWilayaDropdownOpen(false);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7c5730]/20 focus:border-[#7c5730] text-sm bg-white text-left flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>{formData.baladia ? formData.baladia : (formData.wilaya ? "Select your Commune" : "Please select a Wilaya first")}</span>
                      <span className="material-symbols-outlined text-gray-400">arrow_drop_down</span>
                    </button>
                    {isCommuneDropdownOpen && formData.wilaya && (
                      <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 divide-y divide-gray-50">
                        {getCommunes().map(c => (
                          <button
                            key={c}
                            type="button"
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-[#7c5730]/5 text-gray-700 block transition-colors"
                            onClick={() => {
                              setFormData({ ...formData, baladia: c });
                              setIsCommuneDropdownOpen(false);
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Home Address */}
                <div>
                  <label className="block text-[11px] font-bold text-[#7c5730] uppercase mb-1 tracking-wider">Delivery Address</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Enter street address, house/apartment number"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7c5730]/20 focus:border-[#7c5730] text-sm"
                    value={formData.homeAddress}
                    onChange={(e) => setFormData({...formData, homeAddress: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Shipping Method */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#7c5730] uppercase mb-1 tracking-wider">Shipping Method</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, shippingMethod: 'home'})}
                        className={`py-3 px-4 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 justify-center transition-all ${formData.shippingMethod === 'home' ? 'border-[#7c5730] bg-[#7c5730]/5 text-[#7c5730]' : 'border-gray-200 text-[#524345]'}`}
                      >
                        <span className="material-symbols-outlined text-lg">home</span>
                        Home Delivery
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, shippingMethod: 'stopdesk'})}
                        className={`py-3 px-4 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 justify-center transition-all ${formData.shippingMethod === 'stopdesk' ? 'border-[#7c5730] bg-[#7c5730]/5 text-[#7c5730]' : 'border-gray-200 text-[#524345]'}`}
                      >
                        <span className="material-symbols-outlined text-lg">storefront</span>
                        Office Stopdesk
                      </button>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#7c5730] uppercase mb-1 tracking-wider">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, paymentMethod: 'cash'})}
                        className={`py-3 px-2 rounded-xl border text-[10px] font-semibold flex flex-col items-center gap-1 justify-center transition-all ${formData.paymentMethod === 'cash' ? 'border-[#7c5730] bg-[#7c5730]/5 text-[#7c5730]' : 'border-gray-200 text-[#524345]'}`}
                      >
                        <span className="material-symbols-outlined text-lg">payments</span>
                        COD (Cash)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, paymentMethod: 'dahabia'})}
                        className={`py-3 px-2 rounded-xl border text-[10px] font-semibold flex flex-col items-center gap-1 justify-center transition-all ${formData.paymentMethod === 'dahabia' ? 'border-[#7c5730] bg-[#7c5730]/5 text-[#7c5730]' : 'border-gray-200 text-[#524345]'}`}
                      >
                        <span className="material-symbols-outlined text-lg">credit_card</span>
                        Dahabia
                      </button>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, paymentMethod: 'cib'})}
                        className={`py-3 px-2 rounded-xl border text-[10px] font-semibold flex flex-col items-center gap-1 justify-center transition-all ${formData.paymentMethod === 'cib' ? 'border-[#7c5730] bg-[#7c5730]/5 text-[#7c5730]' : 'border-gray-200 text-[#524345]'}`}
                      >
                        <span className="material-symbols-outlined text-lg">credit_card</span>
                        CIB Card
                      </button>
                    </div>
                  </div>
                </div>

                {/* Honeypot Spam Prevention (Hidden) */}
                <input 
                  type="text" 
                  name="middleName" 
                  className="hidden" 
                  value={formData.middleName}
                  onChange={(e) => setFormData({...formData, middleName: e.target.value})}
                />

                {/* Promo Code */}
                <div>
                  <label className="block text-[11px] font-bold text-[#7c5730] uppercase mb-1 tracking-wider">Promo Code (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="Enter discount coupon code"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7c5730]/20 focus:border-[#7c5730] text-sm"
                    value={formData.promoCode}
                    onChange={(e) => setFormData({...formData, promoCode: e.target.value})}
                  />
                </div>

                {/* Robot Verification */}
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-150">
                  <input 
                    required
                    type="checkbox" 
                    id="robotVerified"
                    className="rounded text-[#7c5730] focus:ring-[#7c5730]/20 h-4 w-4"
                    checked={formData.robotVerified}
                    onChange={(e) => setFormData({...formData, robotVerified: e.target.checked})}
                  />
                  <label htmlFor="robotVerified" className="text-xs font-semibold text-[#524345] cursor-pointer">
                    I confirm that I am placing a real order and am not a automated robot.
                  </label>
                </div>

                {/* Pricing Summary */}
                <div className="bg-[#fcf9f8] p-6 rounded-2xl border border-gray-100 space-y-3">
                  <div className="flex justify-between text-sm text-[#524345]">
                    <span>Cart Subtotal</span>
                    <span>{cartSubtotal} DZD</span>
                  </div>
                  <div className="flex justify-between text-sm text-[#524345] items-center">
                    <span>Delivery Fee ({formData.shippingMethod === 'home' ? 'Home' : 'Stopdesk'})</span>
                    <span>{loadingShipping ? 'Calculating...' : `${shippingFee} DZD`}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-[#150004] pt-3 border-t border-gray-200">
                    <span>Total Amount</span>
                    <span>{orderTotal} DZD</span>
                  </div>
                </div>

                {/* Submit button */}
                <button 
                  type="submit"
                  disabled={submittingOrder}
                  className="w-full bg-[#150004] text-white py-4 rounded-full text-xs font-semibold tracking-widest hover:bg-[#3e0b1b] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingOrder ? 'SUBMITTING ORDER...' : `CONFIRM ORDER — ${orderTotal} DZD`}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
