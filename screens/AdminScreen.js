import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  Modal, TextInput, ScrollView
} from 'react-native';
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, getDoc
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';

const PLANS = [
  { id:'1m', label:'شهر', months:1, price:10 },
  { id:'3m', label:'3 أشهر', months:3, price:30 },
  { id:'6m', label:'6 أشهر', months:6, price:60 },
  { id:'12m', label:'12 شهر', months:12, price:100 },
];

function addMonths(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const exp = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  return Math.ceil((exp - new Date()) / (1000*60*60*24));
}

function fmt(ts) {
  if (!ts) return '—';
  try { return (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleDateString('ar-LY'); }
  catch { return '—'; }
}

function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:8}, () => c[Math.floor(Math.random()*c.length)]).join('');
}

export default function AdminScreen({ navigation }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: genCode(), plan: '3m', maxClients: '500', notes: '' });

  useEffect(() => {
    const q = query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setSubs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const createSub = async () => {
    if (!form.code.trim()) { Alert.alert('خطأ', 'أدخل الكود'); return; }
    setSaving(true);
    try {
      const plan = PLANS.find(p => p.id === form.plan);
      const expDate = addMonths(plan.months);
      const codeKey = form.code.trim().toUpperCase();
      await setDoc(doc(db, 'subscriptions', codeKey), {
        code: codeKey, plan: form.plan, planLabel: plan.label,
        maxClients: Math.max(500, parseInt(form.maxClients) || 500),
        expiresAt: expDate, usedBy: null, usedAt: null, usedByEmail: null,
        createdBy: auth.currentUser.uid, createdAt: serverTimestamp(),
        notes: form.notes, devices: {}
      });
      Alert.alert('✅ تم', `تم إنشاء الكود: ${codeKey}`);
      setModal(false);
      setForm({ code: genCode(), plan: '3m', maxClients: '500', notes: '' });
    } catch (e) { Alert.alert('خطأ', e.message); }
    setSaving(false);
  };

  const deleteSub = (id) => {
    Alert.alert('حذف', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        await deleteDoc(doc(db, 'subscriptions', id));
      }}
    ]);
  };

  const renewSub = async (sub) => {
    Alert.alert('تجديد', 'اختر الباقة:', PLANS.map(p => ({
      text: `${p.label} - $${p.price}`,
      onPress: async () => {
        await updateDoc(doc(db, 'subscriptions', sub.id), {
          expiresAt: addMonths(p.months), plan: p.id, planLabel: p.label
        });
        Alert.alert('✅ تم التجديد');
      }
    })).concat([{ text: 'إلغاء', style: 'cancel' }]));
  };

  const copyWelcome = (sub) => {
    const msg = `مرحباً 👋\n\nتم تفعيل اشتراكك في تطبيق إدارة بطاقاتك\n\n🔑 كود التفعيل:\n${sub.code || sub.id}`;
    Alert.alert('رسالة الترحيب', msg);
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => signOut(auth)}>
          <Text style={s.logout}>خروج</Text>
        </TouchableOpacity>
        <Text style={s.title}>🛡️ لوحة المدير</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={s.homeBtn}>العملاء</Text>
        </TouchableOpacity>
      </View>

      <View style={s.topBar}>
        <Text style={s.count}>الاشتراكات: {subs.length} | مفعّلة: {subs.filter(s => s.usedBy && daysLeft(s.expiresAt) > 0).length}</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setModal(true)}>
          <Text style={s.addT}>＋ كود جديد</Text>
        </TouchableOpacity>
      </View>

      {loading
        ? <ActivityIndicator color="#c9a84c" style={{ marginTop: 40 }} />
        : <FlatList
            data={subs}
            keyExtractor={s => s.id}
            contentContainerStyle={{ padding: 14 }}
            ListEmptyComponent={<Text style={s.empty}>لا يوجد اشتراكات بعد</Text>}
            
