import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  Modal, TextInput, ScrollView
} from 'react-native';
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, addDoc, getDoc
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase';

const PLANS = [
  { id:'7d',  label:'7 أيام',  months:0, days:7,  price:5  },
  { id:'1m',  label:'شهر',     months:1, days:0,  price:10 },
  { id:'3m',  label:'3 أشهر',  months:3, days:0,  price:30 },
  { id:'6m',  label:'6 أشهر',  months:6, days:0,  price:60 },
  { id:'12m', label:'12 شهر',  months:12, days:0, price:100 },
];

const COMMISSION_PCT = 10;

function addTime(months, days) {
  const d = new Date();
  if (days) { d.setDate(d.getDate() + days); }
  else { d.setMonth(d.getMonth() + months); }
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

function genAffCode(name) {
  const clean = name.replace(/\s+/g,'').toUpperCase().slice(0,6);
  return `${clean}${Math.floor(Math.random()*90)+10}`;
}

export default function AdminScreen({ navigation }) {
  const [tab, setTab] = useState('subs');
  const [subs, setSubs] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [payments, setPayments] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selAff, setSelAff] = useState(null);
  const [form, setForm] = useState({ code: genCode(), plan: '1m', maxClients: '500', notes: '' });
  const [affForm, setAffForm] = useState({ name:'', handle:'', code:'', commissionPct:10, notes:'' });
  const [payForm, setPayForm] = useState({ amount:'', note:'', date: new Date().toISOString().split('T')[0] });
  const [payModal, setPayModal] = useState(null);

  useEffect(() => {
    const q1 = query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q1, snap => {
      setSubs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const q2 = query(collection(db, 'affiliates'), orderBy('createdAt', 'desc'));
    const u2 = onSnapshot(q2, snap => setAffiliates(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (!affiliates.length) return;
    const unsubs = affiliates.map(a => {
      const q = query(collection(db, `affiliates/${a.id}/payments`), orderBy('createdAt', 'desc'));
      return onSnapshot(q, snap => {
        setPayments(p => ({ ...p, [a.id]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [affiliates]);

  const createSub = async () => {
    if (!form.code.trim()) { Alert.alert('خطأ', 'أدخل الكود'); return; }
    setSaving(true);
    try {
      const plan = PLANS.find(p => p.id === form.plan);
      const expDate = addTime(plan.months, plan.days);
      const codeKey = form.code.trim().toUpperCase();
      await setDoc(doc(db, 'subscriptions', codeKey), {
        code: codeKey, plan: form.plan, planLabel: plan.label,
        maxClients: Math.max(500, parseInt(form.maxClients) || 500),
        expiresAt: expDate, usedBy: null, usedAt: null, usedByEmail: null,
        createdBy: auth.currentUser.uid, createdAt: serverTimestamp(),
        notes: form.notes, devices: {}
      });
      Alert.alert('✅ تم', `تم إنشاء الكود: ${codeKey}`);
      setModal(null);
      setForm({ code: genCode(), plan: '1m', maxClients: '500', notes: '' });
    } catch (e) { Alert.alert('خطأ', e.message); }
    setSaving(false);
  };

  const createAffiliate = async () => {
    if (!affForm.name.trim()) { Alert.alert('خطأ', 'أدخل الاسم'); return; }
    if (!affForm.code.trim()) { Alert.alert('خطأ', 'أدخل الكود'); return; }
    setSaving(true);
    try {
      const code = affForm.code.trim().toUpperCase();
      const existing = await getDoc(doc(db, 'affiliates', code));
      if (existing.exists()) { Alert.alert('خطأ', 'هذا الكود مستخدم مسبقاً'); setSaving(false); return; }
      await setDoc(doc(db, 'affiliates', code), {
        code, name: affForm.name, handle: affForm.handle,
        commissionPct: parseInt(affForm.commissionPct) || COMMISSION_PCT,
        notes: affForm.notes, totalReferrals: 0, totalPaid: 0,
        createdAt: serverTimestamp()
      });
      Alert.alert('✅ تم', `تم إنشاء كود المسوّق: ${code}`);
      setModal(null);
      setAffForm({ name:'', handle:'', code:'', commissionPct:10, notes:'' });
    } catch (e) { Alert.alert('خطأ', e.message); }
    setSaving(false);
  };

  const addPayment = async () => {
    if (!payForm.amount || isNaN(parseFloat(payForm.amount))) { Alert.alert('خطأ', 'أدخل المبلغ'); return; }
    setSaving(true);
    try {
      const aff = payModal;
      const affPays = payments[aff.id] || [];
      const newTotal = affPays.reduce((s, p) => s + (p.amount || 0), 0) + parseFloat(payForm.amount);
      await addDoc(collection(db, `affiliates/${aff.id}/payments`), {
        amount: parseFloat(payForm.amount), note: payForm.note || '',
        date: payForm.date, paidBy: auth.currentUser.email,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'affiliates', aff.id), { totalPaid: newTotal });
      Alert.alert('✅ تم تسجيل الدفعة');
      setPayModal(null);
      setPayForm({ amount:'', note:'', date: new Date().toISOString().split('T')[0] });
    } catch (e) { Alert.alert('خطأ', e.message); }
    setSaving(false);
  };

  const deleteSub = (id) => {
    Alert.alert('حذف', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => await deleteDoc(doc(db, 'subscriptions', id)) }
    ]);
  };

  const deleteAff = (id) => {
    Alert.alert('حذف', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => await deleteDoc(doc(db, 'affiliates', id)) }
    ]);
  };

  const renewSub = (sub) => {
    Alert.alert('تجديد', 'اختر الباقة:', PLANS.map(p => ({
      text: `${p.label} - $${p.price}`,
      onPress: async () => {
        await updateDoc(doc(db, 'subscriptions', sub.id), {
          expiresAt: addTime(p.months, p.days), plan: p.id, planLabel: p.label
        });
        Alert.alert('✅ تم التجديد');
      }
    })).concat([{ text: 'إلغاء', style: 'cancel' }]));
  };

  const copyWelcome = (sub) => {
    Alert.alert('رسالة الترحيب',
      `مرحباً 👋\n\nتم تفعيل اشتراكك في تطبيق إدارة بطاقاتك\n\n🔑 كود التفعيل:\n${sub.code || sub.id}`
    );
  };

  const resetPassword = (email) => {
    if (!email) { Alert.alert('خطأ', 'هذا المشترك لم يسجل بريده بعد'); return; }
    Alert.alert('إعادة تعيين كلمة المرور', `إرسال رابط إلى:\n${email}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إرسال', onPress: async () => {
        try {
          await sendPasswordResetEmail(auth, email);
          Alert.alert('✅ تم الإرسال', `تم إرسال الرابط إلى ${email}`);
        } catch (e) { Alert.alert('خطأ', e.message); }
      }}
    ]);
  };

  const resetDevices = (sub) => {
    Alert.alert('إعادة ضبط الأجهزة', 'مسح جميع الأجهزة المسجلة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إعادة ضبط', onPress: async () => {
        await updateDoc(doc(db, 'subscriptions', sub.id), { devices: {} });
        Alert.alert('✅ تم');
      }}
    ]);
  };

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={s.homeBtn}>👥 العملاء</Text>
        </TouchableOpacity>
        <Text style={s.title}>🛡️ لوحة المدير</Text>
        <TouchableOpacity onPress={() => Alert.alert('خروج', 'هل تريد تسجيل الخروج؟', [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'خروج', onPress: () => { const { signOut } = require('firebase/auth'); signOut(auth); } }
        ])}>
          <Text style={s.logout}>خروج</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab==='subs' && s.tabOn]} onPress={() => setTab('subs')}>
          <Text style={[s.tabT, tab==='subs' && s.tabTOn]}>🔑 الاشتراكات</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab==='affiliates' && s.tabOn]} onPress={() => setTab('affiliates')}>
          <Text style={[s.tabT, tab==='affiliates' && s.tabTOn]}>🤝 المسوّقون</Text>
        </TouchableOpacity>
      </View>

      {/* Top Bar */}
      <View style={s.topBar}>
        {tab === 'subs' && (
          <>
            <Text style={s.count}>الكل: {subs.length} | مفعّلة: {subs.filter(s => s.usedBy && daysLeft(s.expiresAt) > 0).length} | متاحة: {subs.filter(s => !s.usedBy).length}</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => setModal('sub')}>
              <Text style={s.addT}>＋ كود جديد</Text>
            </TouchableOpacity>
          </>
        )}
        {tab === 'affiliates' && (
          <>
            <Text style={s.count}>المسوّقون: {affiliates.length}</Text>
            <TouchableOpacity style={s.add
