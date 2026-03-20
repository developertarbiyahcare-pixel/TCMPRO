
import React, { useState, useEffect } from 'react';
import { Users, Shield, MessageSquare, Megaphone, Trash2, Ban, CheckCircle, Clock, Activity, Send, Key, Save } from 'lucide-react';
import { UserAccount, AdminMessage, Promotion } from '../types';
import { db } from '../services/db';

const SuperSaintDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [msgContent, setMsgContent] = useState('');
  const [promoTitle, setPromoTitle] = useState('');
  const [promoContent, setPromoContent] = useState('');
  const [promoLink, setPromoLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const allUsers = await db.users.getAll();
      setUsers(allUsers);
      
      // Fetch settings
      try {
        const config = await db.settings.getAll();
        if (config.GEMINI_API_KEY) {
          setGeminiKey(config.GEMINI_API_KEY);
        }
      } catch (e) {
        console.error("Failed to fetch settings", e);
      }
    };
    fetchData();
  }, []);

  const handleUpdateStatus = async (uid: string, status: 'active' | 'suspended' | 'expired') => {
    await db.users.update(uid, { status });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, status } : u));
  };

  const handleUpdateSubscription = async (uid: string, months: number) => {
    const expiry = months === -1 ? null : Date.now() + (months * 30 * 24 * 60 * 60 * 1000);
    await db.users.update(uid, { subscriptionExpiry: expiry || undefined, status: 'active' });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, subscriptionExpiry: expiry || undefined, status: 'active' } : u));
  };

  const handleSendMessage = async () => {
    if (!selectedUser?.uid || !msgContent.trim()) return;
    setIsLoading(true);
    const msg: AdminMessage = {
      id: Date.now().toString(),
      recipientUid: selectedUser.uid,
      senderUid: 'super_saint',
      content: msgContent,
      timestamp: Date.now(),
      isRead: false
    };
    await db.messages.send(msg);
    setMsgContent('');
    setSelectedUser(null);
    setIsLoading(false);
    alert('Pesan terkirim!');
  };

  const handleAddPromotion = async () => {
    if (!promoTitle.trim() || !promoContent.trim()) return;
    setIsLoading(true);
    const promo: Promotion = {
      id: Date.now().toString(),
      title: promoTitle,
      content: promoContent,
      link: promoLink,
      createdAt: Date.now()
    };
    await db.promotions.add(promo);
    setPromoTitle('');
    setPromoContent('');
    setPromoLink('');
    setIsLoading(false);
    alert('Iklan/Promosi ditambahkan!');
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      const success = await db.settings.set('GEMINI_API_KEY', geminiKey);
      if (success) {
        alert('Pengaturan sistem berhasil disimpan!');
      } else {
        alert('Gagal menyimpan pengaturan.');
      }
    } catch (e) {
      alert('Terjadi kesalahan saat menyimpan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-full scrollbar-hide">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-tcm-primary" />
        <div>
          <h2 className="text-2xl font-black text-purple-950">SUPER SAINT DASHBOARD</h2>
          <p className="text-purple-500 text-sm font-bold uppercase tracking-widest">Master Control & User Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-purple-50 bg-purple-50/30 flex justify-between items-center">
              <h3 className="font-black text-purple-950 flex items-center gap-2"><Users className="w-5 h-5" /> DAFTAR PENGGUNA</h3>
              <span className="bg-purple-200 text-purple-700 px-3 py-1 rounded-full text-xs font-black">{users.length} TOTAL</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-purple-50/50 text-[10px] uppercase font-black text-purple-400 tracking-widest">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Subscription</th>
                    <th className="px-6 py-4">Sessions</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {users.map(user => (
                    <tr key={user.uid} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-purple-950">{user.username}</div>
                        <div className="text-[10px] text-purple-400">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                          user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                          user.status === 'suspended' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[10px] font-bold text-purple-600">
                          {user.subscriptionExpiry ? new Date(user.subscriptionExpiry).toLocaleDateString() : 'FOREVER'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-[10px] font-black text-purple-400">
                          <Activity className="w-3 h-3" /> {user.activeSessions || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedUser(user)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><MessageSquare className="w-4 h-4" /></button>
                          <button onClick={() => handleUpdateStatus(user.uid!, user.status === 'suspended' ? 'active' : 'suspended')} className={`p-2 rounded-xl transition-all ${user.status === 'suspended' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600' : 'bg-rose-50 text-rose-600 hover:bg-rose-600'} hover:text-white`}>
                            {user.status === 'suspended' ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>
                          <div className="relative group">
                            <button className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-600 hover:text-white transition-all"><Clock className="w-4 h-4" /></button>
                            <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-white border border-purple-100 shadow-xl rounded-2xl p-2 z-50 w-40">
                              {[1, 3, 6, 12, -1].map(m => (
                                <button 
                                  key={m}
                                  onClick={() => handleUpdateSubscription(user.uid!, m)}
                                  className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-purple-50 rounded-lg"
                                >
                                  {m === -1 ? 'Set Selamanya' : `Set ${m} Bulan`}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* System Settings */}
          <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6">
            <h3 className="font-black text-purple-950 flex items-center gap-2 mb-4"><Key className="w-5 h-5" /> PENGATURAN SISTEM</h3>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Gemini API Key</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    value={geminiKey} 
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="Masukkan API Key Baru..."
                    className="flex-1 bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs outline-none focus:bg-white"
                  />
                  <button 
                    onClick={handleSaveSettings}
                    disabled={isLoading}
                    className="px-6 bg-purple-950 text-white font-black py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs"
                  >
                    <Save className="w-4 h-4" /> SIMPAN
                  </button>
                </div>
                <p className="text-[10px] text-purple-400 italic">API Key ini akan digunakan untuk semua permintaan chat AI. Jika kosong, sistem akan menggunakan environment variable.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messaging & Promotions */}
        <div className="space-y-6">
          {/* Send Message */}
          <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6">
            <h3 className="font-black text-purple-950 flex items-center gap-2 mb-4"><MessageSquare className="w-5 h-5" /> KIRIM PESAN</h3>
            {selectedUser ? (
              <div className="space-y-4">
                <div className="p-3 bg-purple-50 rounded-2xl text-[10px] font-bold text-purple-600">
                  Kepada: <span className="text-purple-950">{selectedUser.username}</span>
                  <button onClick={() => setSelectedUser(null)} className="ml-2 text-rose-500 underline">Batal</button>
                </div>
                <textarea 
                  value={msgContent}
                  onChange={(e) => setMsgContent(e.target.value)}
                  placeholder="Tulis pesan..."
                  className="w-full bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm focus:bg-white outline-none h-32 resize-none"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={isLoading}
                  className="w-full bg-tcm-primary text-white font-black py-3 rounded-2xl shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> KIRIM SEKARANG
                </button>
              </div>
            ) : (
              <p className="text-xs text-purple-400 text-center py-8 italic">Pilih user dari daftar untuk mengirim pesan.</p>
            )}
          </div>

          {/* Add Promotion */}
          <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6">
            <h3 className="font-black text-purple-950 flex items-center gap-2 mb-4"><Megaphone className="w-5 h-5" /> IKLAN BARIS / PROMOSI</h3>
            <div className="space-y-3">
              <input 
                type="text" value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)}
                placeholder="Judul Iklan"
                className="w-full bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs outline-none focus:bg-white"
              />
              <textarea 
                value={promoContent} onChange={(e) => setPromoContent(e.target.value)}
                placeholder="Konten Iklan..."
                className="w-full bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs outline-none focus:bg-white h-24 resize-none"
              />
              <input 
                type="text" value={promoLink} onChange={(e) => setPromoLink(e.target.value)}
                placeholder="Link (Opsional)"
                className="w-full bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs outline-none focus:bg-white"
              />
              <button 
                onClick={handleAddPromotion}
                disabled={isLoading}
                className="w-full bg-purple-950 text-white font-black py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2"
              >
                <Megaphone className="w-4 h-4" /> PASANG IKLAN
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperSaintDashboard;
