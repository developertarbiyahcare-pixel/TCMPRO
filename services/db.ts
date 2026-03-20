
import { UserAccount, SavedPatient, AdminMessage, Promotion } from '../types';
import { supabase } from '../supabase';
import { auth } from '../firebase';

export const DEFAULT_ADMIN: UserAccount = {
  uid: 'haxor-super-saint',
  username: 'haxor',
  password: 'haxor123', 
  role: 'super_saint',
  status: 'active',
  createdAt: Date.now()
};

const handleSupabaseError = (error: any, operation: string) => {
  console.error(`Supabase Error (${operation}):`, error.message || error);
  throw error;
};

export const db = {
  users: {
    getAll: async (): Promise<UserAccount[]> => {
      const { data, error } = await supabase.from('users').select('*');
      if (error) handleSupabaseError(error, 'getAllUsers');
      return data || [];
    },
    get: async (uid: string): Promise<UserAccount | null> => {
      const { data, error } = await supabase.from('users').select('*').eq('uid', uid).single();
      if (error && error.code !== 'PGRST116') handleSupabaseError(error, 'getUser');
      return data || null;
    },
    add: async (user: UserAccount): Promise<boolean> => {
      const { error } = await supabase.from('users').upsert(user);
      if (error) {
        handleSupabaseError(error, 'addUser');
        return false;
      }
      return true;
    },
    update: async (uid: string, data: Partial<UserAccount>): Promise<boolean> => {
      const { error } = await supabase.from('users').update(data).eq('uid', uid);
      if (error) {
        handleSupabaseError(error, 'updateUser');
        return false;
      }
      return true;
    },
    delete: async (uid: string): Promise<boolean> => {
      const { error } = await supabase.from('users').delete().eq('uid', uid);
      if (error) {
        handleSupabaseError(error, 'deleteUser');
        return false;
      }
      return true;
    }
  },
  patients: {
    getAll: async (): Promise<SavedPatient[]> => {
      if (!auth.currentUser) return [];
      const userProfile = await db.users.get(auth.currentUser.uid);
      
      let query = supabase.from('patients').select('*');
      if (userProfile?.role !== 'super_saint') {
        query = query.eq('authorUid', auth.currentUser.uid);
      }
      
      const { data, error } = await query.order('timestamp', { ascending: false });
      if (error) handleSupabaseError(error, 'getAllPatients');
      return data || [];
    },
    add: async (patient: SavedPatient) => {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const patientWithAuth = { ...patient, authorUid: auth.currentUser.uid };
      const { error } = await supabase.from('patients').upsert(patientWithAuth);
      if (error) handleSupabaseError(error, 'addPatient');
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('patients').delete().eq('id', id);
      if (error) handleSupabaseError(error, 'deletePatient');
    }
  },
  messages: {
    send: async (msg: AdminMessage) => {
      const { error } = await supabase.from('messages').upsert(msg);
      if (error) handleSupabaseError(error, 'sendMessage');
    },
    getByUser: (uid: string, callback: (msgs: AdminMessage[]) => void) => {
      // Supabase Realtime for messages
      const subscription = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: '*', filter: `recipientUid=eq.${uid}`, schema: 'public', table: 'messages' }, () => {
          // Fetch all messages on change
          db.messages.fetchAll(uid).then(callback);
        })
        .subscribe();

      // Initial fetch
      db.messages.fetchAll(uid).then(callback);

      return () => {
        supabase.removeChannel(subscription);
      };
    },
    fetchAll: async (uid: string): Promise<AdminMessage[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('recipientUid', uid)
        .order('timestamp', { ascending: false });
      if (error) {
        console.warn("Messages fetch failed:", error.message);
        return [];
      }
      return data || [];
    },
    markAsRead: async (id: string) => {
      const { error } = await supabase.from('messages').update({ isRead: true }).eq('id', id);
      if (error) handleSupabaseError(error, 'markAsRead');
    }
  },
  promotions: {
    getAll: (callback: (promos: Promotion[]) => void) => {
      // Supabase Realtime for promotions
      const subscription = supabase
        .channel('public:promotions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'promotions' }, () => {
          db.promotions.fetchAll().then(callback);
        })
        .subscribe();

      // Initial fetch
      db.promotions.fetchAll().then(callback);

      return () => {
        supabase.removeChannel(subscription);
      };
    },
    fetchAll: async (): Promise<Promotion[]> => {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('createdAt', { ascending: false });
      if (error) {
        console.warn("Promotions fetch failed:", error.message);
        return [];
      }
      return data || [];
    },
    add: async (promo: Promotion) => {
      const { error } = await supabase.from('promotions').upsert(promo);
      if (error) handleSupabaseError(error, 'addPromotion');
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('promotions').delete().eq('id', id);
      if (error) handleSupabaseError(error, 'deletePromotion');
    }
  },
  settings: {
    getAll: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) handleSupabaseError(error, 'getAllSettings');
      const config: Record<string, string> = {};
      data?.forEach(s => { config[s.key] = s.value; });
      return config;
    },
    set: async (key: string, value: string): Promise<boolean> => {
      const { error } = await supabase.from('settings').upsert({ key, value });
      if (error) {
        handleSupabaseError(error, 'setSetting');
        return false;
      }
      return true;
    }
  }
};
