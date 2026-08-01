import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  Modal, TextInput, ScrollView, Clipboard
} from 'react-native';
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, addDoc, getDoc
} from 'firebase/firestore';
import {
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { useTheme } from '../ThemeContext';

const PLANS = [
  { id:'7d',  label:'7 أيام',  months:0, days:7,  price:5   },
  { id:'1m',  label:'شهر',     months:1, days:0,  price:45  },
  { id:'3m',  label:'3 أشهر',  months:3, days:0,  price:125 },
  { id:'6m',  label:'6 أشهر',  months:6, days:0,  price:250 },
  { id:'12m', label:'12 شهر',  months:12, days:0, price:475 },
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

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('ar-LY') + ' ' + d.toLocaleTimeString('ar-LY', {hour:'2-digit', minute:'2-digit'});
  } catch { return isoStr; }
}

function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:8}, () => c[Math.floor(Math.random()*c.length)]).join('');
}

function genAffCode(name) {
  const clean = name.replace(/\s+/g,'').toUpperCase().slice(0,6);
  return `${clean}${Math.floor(Math.random()*90)+10}`;
}

const copy = (v, l) => {
  if (!v) return;
  Clipboard.setString(v);
  Alert.alert('✅ تم النسخ', `تم نسخ ${l}`);
};

export default function AdminScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const [tab, setTab] = useState('subs');
  const [subs, setSubs] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [payments, setPayments] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selAff, setSelAff] = useState(null);
  const [selDevices, setSelDevices] = useState(null);
  const [form, setForm] = useState({ code: genCode(), plan: '1m', maxClients: '500', notes: '' });
  const [affForm, setAffForm] = useState({ name:'', handle:'', code:'', commissionPct:10, notes:'' });
  const [payForm, setPayForm] = useState({ amount:'', note:'', date: new Date().toISOString().split('T')[0] });
  const [payModal, setPayModal] = useState(null);
  const [renewModal, setRenewModal] = useState(null);
  const [pwForm, setPwForm] = useState({ current:'', newPw:'', confirm:'' });

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

  const changePassword = async () => {
    if (!pwForm.current) { Alert.alert('خطأ', 'أدخل كلمة المرور الحالية'); return; }
    if (!pwForm.newPw || pwForm.newPw.length < 6) { Alert.alert('خطأ', 'كلمة المرور الجديدة 6 أحرف على الأقل'); return; }
    if (pwForm.newPw !== pwForm.confirm) { Alert.alert('خطأ', 'كلمتا المرور غير متطابقتان'); return; }
    setSaving(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, pwForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pwForm.newPw);
      Alert.alert('✅ تم', 'تم تغيير كلمة المرور بنجاح');
      setModal(null);
      setPwForm({ current:'', newPw:'', confirm:'' });
    } catch (e) {
      const m = {
        'auth/wrong-password': 'كلمة المرور الحالية غير صحيحة',
        'auth/invalid-credential': 'كلمة المرور الحالية غير صحيحة',
        'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
      };
      Alert.alert('خطأ', m[e.code] || e.message);
    }
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

  const confirmRenew = async (sub, plan) => {
    Alert.alert(
      '✅ تأكيد التجديد',
      `العميل: ${sub.usedByEmail || 'غير مفعّل'}\n\n📦 الباقة: ${plan.label}\n💵 السعر: ${plan.price} د.ل\n📅 ينتهي: ${addTime(plan.months, plan.days).toLocaleDateString('ar-LY')}`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تأكيد ✅', onPress: async () => {
          try {
            await updateDoc(doc(db, 'subscriptions', sub.id), {
              expiresAt: addTime(plan.months, plan.days),
              plan: plan.id, planLabel: plan.label
            });
            setRenewModal(null);
            Alert.alert('✅ تم التجديد', `تم تجديد الاشتراك بـ ${plan.label}`);
          } catch (e) { Alert.alert('خطأ', e.message); }
        }}
      ]
    );
  };

  const copyWelcome = (sub) => {
    const msg = `مرحباً 👋\n\nتم تفعيل اشتراكك في تطبيق إدارة بطاقاتك\n\n🔗 رابط التطبيق:\nhttps://banking-app-pink-six.vercel.app\n\n🔑 كود التفعيل:\n${sub.code || sub.id}\n\n📱 لتثبيت التطبيق:\nافتح الرابط ← زر المشاركة ← "إضافة إلى الشاشة الرئيسية"`;
    Clipboard.setString(msg);
    Alert.alert('✅ تم النسخ', 'تم نسخ رسالة الترحيب');
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

  const handleLogout = () => {
    Alert.alert('خروج', 'هل تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: () => signOut(auth) }
    ]);
  };

  return (
    <View style={[s.wrap, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={[s.homeBtn, { color: colors.gold }]}>👥 العملاء</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.gold }]}>🛡️ لوحة المدير</Text>
        <View style={{flexDirection:'row', gap:12, alignItems:'center'}}>
          <TouchableOpacity onPress={toggleTheme}>
            <Text style={s.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModal('pw')}>
            <Text style={s.pwBtn}>🔑</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={[s.logout, { color: colors.textMuted }]}>خروج</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={[s.tabs, { backgroundColor: colors.overlay }]}>
        <TouchableOpacity style={[s.tab, tab==='subs' && { backgroundColor: colors.gold }]} onPress={() => setTab('subs')}>
          <Text style={[s.tabT, { color: colors.textMuted }, tab==='subs' && { color: colors.bg, fontWeight:'700' }]}>🔑 الاشتراكات</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab==='affiliates' && { backgroundColor: colors.gold }]} onPress={() => setTab('affiliates')}>
          <Text style={[s.tabT, { color: colors.textMuted }, tab==='affiliates' && { color: colors.bg, fontWeight:'700' }]}>🤝 المسوّقون</Text>
        </TouchableOpacity>
      </View>

      {/* Top Bar */}
      <View style={s.topBar}>
        {tab === 'subs' && (
          <>
            <Text style={[s.count, { color: colors.textMuted }]}>
              الكل: {subs.length} | مفعّلة: {subs.filter(s => s.usedBy && daysLeft(s.expiresAt) > 0).length} | متاحة: {subs.filter(s => !s.usedBy).length} | منتهية: {subs.filter(s => daysLeft(s.expiresAt) <= 0).length}
            </Text>
            <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.gold }]} onPress={() => setModal('sub')}>
              <Text style={[s.addT, { color: colors.bg }]}>＋ كود جديد</Text>
            </TouchableOpacity>
          </>
        )}
        {tab === 'affiliates' && (
          <>
            <Text style={[s.count, { color: colors.textMuted }]}>المسوّقون: {affiliates.length} | إجمالي الإحالات: {affiliates.reduce((s,a) => s+(a.totalReferrals||0), 0)}</Text>
            <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.gold }]} onPress={() => setModal('aff')}>
              <Text style={[s.addT, { color: colors.bg }]}>＋ مسوّق جديد</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Subs List */}
      {tab === 'subs' && (
        loading
          ? <ActivityIndicator color={colors.gold} style={{marginTop:40}} />
          : <FlatList
              data={subs}
              keyExtractor={s => s.id}
              contentContainerStyle={{padding:14}}
              ListEmptyComponent={<Text style={[s.empty, { color: colors.textMuted }]}>لا يوجد اشتراكات بعد</Text>}
              renderItem={({ item: sub }) => {
                const days = daysLeft(sub.expiresAt);
                const isActive = sub.usedBy && days > 0;
                const isExpired = days <= 0;
                const isFree = !sub.usedBy && !isExpired;
                const deviceList = Object.entries(sub.devices || {});
                const deviceCount = deviceList.length;
                return (
                  <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
                    <View style={s.cardTop}>
                      <View style={{flexDirection:'row', alignItems:'center', gap:8, flex:1}}>
                        <Text style={[s.code, { color: colors.gold }]}>{sub.code || sub.id}</Text>
                        <TouchableOpacity onPress={() => copy(sub.code || sub.id, 'الكود')}>
                          <Text style={{fontSize:16}}>📋</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={[s.chip, isActive ? s.chipOk : isFree ? s.chipFree : s.chipExp]}>
                        <Text style={s.chipT}>{isActive ? '✅ مفعّل' : isFree ? '🔓 متاح' : '❌ منتهي'}</Text>
                      </View>
                    </View>

                    <Text style={[s.meta, { color: colors.textMuted }]}>📅 ينتهي: {fmt(sub.expiresAt)} ({days > 0 ? `${days} يوم` : 'منتهي'})</Text>
                    {sub.usedByEmail && <Text style={[s.meta, { color: colors.textMuted }]}>👤 {sub.usedByEmail}</Text>}
                    {sub.planLabel && <Text style={[s.meta, { color: colors.textMuted }]}>📦 {sub.planLabel}</Text>}
                    {sub.maxClients && <Text style={[s.meta, { color: colors.textMuted }]}>👥 الحد: {sub.maxClients} عميل</Text>}
                    {sub.notes && <Text style={[s.meta, { color: colors.textMuted }]}>📝 {sub.notes}</Text>}

                    {/* الأجهزة */}
                    <TouchableOpacity
                      style={[s.devicesBadge, { backgroundColor: colors.inputBg, borderColor: colors.borderSoft }]}
                      onPress={() => setSelDevices(selDevices === sub.id ? null : sub.id)}>
                      <Text style={[s.devicesBadgeT, { color: colors.gold }]}>📱 الأجهزة: {deviceCount}/7</Text>
                      <Text style={{color: colors.gold, fontSize:12}}>{selDevices === sub.id ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {selDevices === sub.id && (
                      <View style={[s.devicesBox, { backgroundColor: colors.overlay }]}>
                        {deviceList.length === 0
                          ? <Text style={[s.meta, { color: colors.textMuted }]}>لا يوجد أجهزة مسجلة</Text>
                          : deviceList.map(([id, d], i) => (
                            <View key={id} style={[s.deviceRow, { borderBottomColor: colors.inputBg }]}>
                              <Text style={[s.deviceNum, { color: colors.textMuted }]}>{i+1}</Text>
                              <Text style={s.deviceIcon}>📱</Text>
                              <View style={{flex:1}}>
                                <Text style={[s.deviceType, { color: colors.text }]}>{d.type || 'جهاز غير معروف'}</Text>
                                <Text style={[s.deviceDate, { color: colors.textMuted }]}>آخر ظهور: {fmtDate(d.lastSeen)}</Text>
                              </View>
                            </View>
                          ))
                        }
                      </View>
                    )}

                    <View style={s.btnRow}>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => copyWelcome(sub)}>
                        <Text style={[s.actionT, { color: colors.textSoft }]}>✉️ رسالة</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.inputBg, borderColor: colors.borderSoft }]}
                        onPress={() => setRenewModal(sub)}>
                        <Text style={[s.actionT, {color: colors.gold}]}>🔄 تجديد</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => resetPassword(sub.usedByEmail)}>
                        <Text style={[s.actionT, { color: colors.textSoft }]}>🔑 كلمة مرور</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[s.btnRow, {marginTop:6}]}>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => resetDevices(sub)}>
                        <Text style={[s.actionT, { color: colors.textSoft }]}>📱 إعادة ضبط الأجهزة</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.actionBtn, s.delBtnStyle, { backgroundColor: colors.inputBg }]} onPress={() => deleteSub(sub.id)}>
                        <Text style={[s.actionT, {color:'#e74c3c'}]}>🗑 حذف</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
      )}

      {/* Affiliates List */}
      {tab === 'affiliates' && (
        <FlatList
          data={affiliates}
          keyExtractor={a => a.id}
          contentContainerStyle={{padding:14}}
          ListEmptyComponent={<Text style={[s.empty, { color: colors.textMuted }]}>لا يوجد مسوّقون بعد</Text>}
          renderItem={({ item: aff }) => {
            const affPays = payments[aff.id] || [];
            const totalPaid = affPays.reduce((s, p) => s + (p.amount || 0), 0);
            return (
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
                <View style={s.cardTop}>
                  <Text style={[s.code, { color: colors.gold }]}>{aff.name}</Text>
                  <TouchableOpacity style={[s.chipFree2, { backgroundColor: colors.goldSoft, borderColor: colors.borderSoft }]} onPress={() => copy(aff.code, 'كود الإحالة')}>
                    <Text style={s.chipT}>📋 {aff.code}</Text>
                  </TouchableOpacity>
                </View>
                {aff.handle && <Text style={[s.meta, { color: colors.textMuted }]}>@{aff.handle}</Text>}
                <Text style={[s.meta, { color: colors.textMuted }]}>💹 العمولة: {aff.commissionPct}%</Text>
                <Text style={[s.meta, { color: colors.textMuted }]}>📊 الإحالات: {aff.totalReferrals || 0}</Text>
                <Text style={[s.meta, { color: colors.textMuted }]}>💵 المدفوع: {totalPaid.toLocaleString('en')} د.ل</Text>
                {aff.notes && <Text style={[s.meta, { color: colors.textMuted }]}>📝 {aff.notes}</Text>}

                <View style={s.btnRow}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.inputBg, borderColor:'rgba(46,204,113,0.3)' }]}
                    onPress={() => { setPayModal(aff); setPayForm({ amount:'', note:'', date: new Date().toISOString().split('T')[0] }); }}>
                    <Text style={[s.actionT, {color:'#2ecc71'}]}>💰 دفعة</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                    onPress={() => setSelAff(selAff?.id === aff.id ? null : aff)}>
                    <Text style={[s.actionT, { color: colors.textSoft }]}>📜 السجل ({affPays.length})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, s.delBtnStyle, { backgroundColor: colors.inputBg }]} onPress={() => deleteAff(aff.id)}>
                    <Text style={[s.actionT, {color:'#e74c3c'}]}>🗑 حذف</Text>
                  </TouchableOpacity>
                </View>

                {selAff?.id === aff.id && (
                  <View style={{marginTop:12, borderTopWidth:1, borderTopColor: colors.inputBg, paddingTop:12}}>
                    <Text style={[s.meta, {color: colors.gold, marginBottom:8}]}>📜 سجل الدفعات</Text>
                    {affPays.length === 0
                      ? <Text style={[s.meta, { color: colors.textMuted, textAlign:'center'}]}>لا يوجد دفعات بعد</Text>
                      : affPays.map(p => (
                          <View key={p.id} style={{flexDirection:'row', justifyContent:'space-between', padding:8, backgroundColor: colors.inputBg, borderRadius:8, marginBottom:4}}>
                            <Text style={{color:'#2ecc71', fontSize:13, fontWeight:'700'}}>{(p.amount||0).toLocaleString('en')} د.ل</Text>
                            <Text style={{color: colors.textMuted, fontSize:11}}>{p.date} · {p.note}</Text>
                          </View>
                        ))
                    }
                    <Text style={[s.meta, {color: colors.gold, marginTop:6}]}>المجموع: {totalPaid.toLocaleString('en')} د.ل</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Modal: تجديد */}
      <Modal visible={!!renewModal} animationType="slide">
        <View style={[s.modalWrap, { backgroundColor: colors.bg }]}>
          <View style={[s.modalHead, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setRenewModal(null)}><Text style={[s.modalClose, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
            <Text style={[s.modalTitle, { color: colors.gold }]}>🔄 تجديد الاشتراك</Text>
            <View style={{width:30}} />
          </View>
          <ScrollView style={{padding:16}}>
            {renewModal && (
              <View style={[s.renewInfo, { backgroundColor: colors.goldSoft, borderColor: colors.border }]}>
                <Text style={[s.renewInfoT, { color: colors.textSoft }]}>👤 {renewModal.usedByEmail || 'غير مفعّل'}</Text>
                <Text style={[s.renewInfoT, { color: colors.textSoft }]}>📅 ينتهي حالياً: {fmt(renewModal.expiresAt)}</Text>
              </View>
            )}
            <Text style={[s.label, { color: colors.textSoft, marginBottom:12, fontSize:14 }]}>اختر الباقة الجديدة:</Text>
            {PLANS.map(plan => (
              <TouchableOpacity key={plan.id} style={[s.planCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                onPress={() => renewModal && confirmRenew(renewModal, plan)}>
                <View style={s.planCardLeft}>
                  <Text style={[s.planCardLabel, { color: colors.text }]}>{plan.label}</Text>
                  <Text style={[s.planCardDate, { color: colors.textMuted }]}>📅 ينتهي: {addTime(plan.months, plan.days).toLocaleDateString('ar-LY')}</Text>
                </View>
                <Text style={s.planCardPrice}>{plan.price} د.ل</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={[s.modalFoot, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity style={[s.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => setRenewModal(null)}>
              <Text style={[s.cancelT, { color: colors.textMuted }]}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: تغيير كلمة المرور */}
      <Modal visible={modal === 'pw'} animationType="slide">
        <View style={[s.modalWrap, { backgroundColor: colors.bg }]}>
          <View style={[s.modalHead, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setModal(null); setPwForm({ current:'', newPw:'', confirm:'' }); }}>
              <Text style={[s.modalClose, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: colors.gold }]}>🔑 تغيير كلمة المرور</Text>
            <View style={{width:30}} />
          </View>
          <ScrollView style={{padding:16}}>
            <View style={[s.infoBox, { backgroundColor: colors.goldSoft, borderColor: colors.border }]}>
              <Text style={[s.infoBoxT, { color: colors.gold }]}>📧 {auth.currentUser?.email}</Text>
            </View>

            <Text style={[s.label, { color: colors.textSoft }]}>كلمة المرور الحالية *</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:14}]}
              placeholder="••••••••" placeholderTextColor={colors.textMuted}
              value={pwForm.current}
              onChangeText={v => setPwForm(f => ({...f, current:v}))}
              secureTextEntry />

            <Text style={[s.label, { color: colors.textSoft }]}>كلمة المرور الجديدة *</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:14}]}
              placeholder="6 أحرف على الأقل" placeholderTextColor={colors.textMuted}
              value={pwForm.newPw}
              onChangeText={v => setPwForm(f => ({...f, newPw:v}))}
              secureTextEntry />

            <Text style={[s.label, { color: colors.textSoft }]}>تأكيد كلمة المرور الجديدة *</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:20}]}
              placeholder="••••••••" placeholderTextColor={colors.textMuted}
              value={pwForm.confirm}
              onChangeText={v => setPwForm(f => ({...f, confirm:v}))}
              secureTextEntry />
          </ScrollView>
          <View style={[s.modalFoot, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity style={[s.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => { setModal(null); setPwForm({ current:'', newPw:'', confirm:'' }); }}>
              <Text style={[s.cancelT, { color: colors.textMuted }]}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.gold }]} onPress={changePassword} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={[s.saveT, { color: colors.bg }]}>💾 حفظ</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: كود جديد */}
      <Modal visible={modal === 'sub'} animationType="slide">
        <View style={[s.modalWrap, { backgroundColor: colors.bg }]}>
          <View style={[s.modalHead, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModal(null)}><Text style={[s.modalClose, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
            <Text style={[s.modalTitle, { color: colors.gold }]}>➕ كود اشتراك جديد</Text>
            <View style={{width:30}} />
          </View>
          <ScrollView style={{padding:16}}>
            <Text style={[s.label, { color: colors.textSoft }]}>كود التفعيل</Text>
            <View style={{flexDirection:'row', gap:8, marginBottom:14}}>
              <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, flex:1, letterSpacing:3, textAlign:'center'}]}
                value={form.code}
                onChangeText={v => setForm(f => ({...f, code:v.toUpperCase()}))}
                autoCapitalize="characters" autoCorrect={false} />
              <TouchableOpacity style={[s.genBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => setForm(f => ({...f, code:genCode()}))}>
                <Text style={s.genT}>🎲</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.genBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => copy(form.code, 'الكود')}>
                <Text style={s.genT}>📋</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.label, { color: colors.textSoft }]}>الباقة</Text>
            {PLANS.map(p => (
              <TouchableOpacity key={p.id}
                style={[s.planCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, form.plan === p.id && { borderColor: colors.gold, backgroundColor: colors.goldSoft }]}
                onPress={() => setForm(f => ({...f, plan:p.id}))}>
                <View style={s.planCardLeft}>
                  <Text style={[s.planCardLabel, { color: colors.text }, form.plan === p.id && {color: colors.gold}]}>{p.label}</Text>
                  <Text style={[s.planCardDate, { color: colors.textMuted }]}>📅 ينتهي: {addTime(p.months, p.days).toLocaleDateString('ar-LY')}</Text>
                </View>
                <View style={{alignItems:'flex-end', gap:4}}>
                  <Text style={[s.planCardPrice, form.plan === p.id && {color: colors.gold}]}>{p.price} د.ل</Text>
                  {form.plan === p.id && <Text style={{color: colors.gold}}>✓</Text>}
                </View>
              </TouchableOpacity>
            ))}

            <Text style={[s.label, { color: colors.textSoft, marginTop:14 }]}>الحد الأقصى للعملاء</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:14}]}
              value={form.maxClients}
              onChangeText={v => setForm(f => ({...f, maxClients:v}))}
              keyboardType="number-pad" />

            <Text style={[s.label, { color: colors.textSoft }]}>ملاحظة</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:20}]}
              value={form.notes}
              onChangeText={v => setForm(f => ({...f, notes:v}))}
              placeholder="اسم العميل مثلاً"
              placeholderTextColor={colors.textMuted} />
          </ScrollView>
          <View style={[s.modalFoot, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity style={[s.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => setModal(null)}>
              <Text style={[s.cancelT, { color: colors.textMuted }]}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.gold }]} onPress={createSub} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={[s.saveT, { color: colors.bg }]}>💾 حفظ</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: مسوّق جديد */}
      <Modal visible={modal === 'aff'} animationType="slide">
        <View style={[s.modalWrap, { backgroundColor: colors.bg }]}>
          <View style={[s.modalHead, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModal(null)}><Text style={[s.modalClose, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
            <Text style={[s.modalTitle, { color: colors.gold }]}>🤝 مسوّق جديد</Text>
            <View style={{width:30}} />
          </View>
          <ScrollView style={{padding:16}}>
            <Text style={[s.label, { color: colors.textSoft }]}>اسم المسوّق *</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:14}]}
              placeholder="مثال: محمد الغانم" placeholderTextColor={colors.textMuted}
              value={affForm.name}
              onChangeText={v => setAffForm(f => ({...f, name:v}))} />

            <Text style={[s.label, { color: colors.textSoft }]}>كود الإحالة *</Text>
            <View style={{flexDirection:'row', gap:8, marginBottom:14}}>
              <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, flex:1, letterSpacing:2, textAlign:'center'}]}
                placeholder="MOHAMAD10" placeholderTextColor={colors.textMuted}
                value={affForm.code}
                onChangeText={v => setAffForm(f => ({...f, code:v.toUpperCase().replace(/\s/g,'')}))}
                autoCapitalize="characters" autoCorrect={false} />
              <TouchableOpacity style={[s.genBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                onPress={() => setAffForm(f => ({...f, code:genAffCode(f.name||'AFF')}))}>
                <Text style={s.genT}>🎲</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.label, { color: colors.textSoft }]}>اسم الحساب (يوتيوب/انستغرام)</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:14}]}
              placeholder="mohamad_yt" placeholderTextColor={colors.textMuted}
              value={affForm.handle}
              onChangeText={v => setAffForm(f => ({...f, handle:v}))} />

            <Text style={[s.label, { color: colors.textSoft }]}>نسبة العمولة %</Text>
            <View style={{flexDirection:'row', gap:8, marginBottom:14}}>
              {[10,15,20,25].map(p => (
                <TouchableOpacity key={p}
                  style={[s.planBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, affForm.commissionPct === p && { borderColor: colors.gold, backgroundColor: colors.goldSoft }]}
                  onPress={() => setAffForm(f => ({...f, commissionPct:p}))}>
                  <Text style={[s.planT, { color: colors.textMuted }, affForm.commissionPct === p && {color: colors.gold}]}>{p}%</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, { color: colors.textSoft }]}>ملاحظات</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:20}]}
              placeholder="ملاحظات إضافية" placeholderTextColor={colors.textMuted}
              value={affForm.notes}
              onChangeText={v => setAffForm(f => ({...f, notes:v}))} />
          </ScrollView>
          <View style={[s.modalFoot, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity style={[s.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => setModal(null)}>
              <Text style={[s.cancelT, { color: colors.textMuted }]}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.gold }]} onPress={createAffiliate} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={[s.saveT, { color: colors.bg }]}>💾 حفظ</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: دفعة */}
      <Modal visible={!!payModal} animationType="slide">
        <View style={[s.modalWrap, { backgroundColor: colors.bg }]}>
          <View style={[s.modalHead, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setPayModal(null)}><Text style={[s.modalClose, { color: colors.textMuted }]}>✕</Text></TouchableOpacity>
            <Text style={[s.modalTitle, { color: colors.gold }]}>💰 دفعة — {payModal?.name}</Text>
            <View style={{width:30}} />
          </View>
          <ScrollView style={{padding:16}}>
            <Text style={[s.label, { color: colors.textSoft }]}>المبلغ (د.ل) *</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:14}]}
              placeholder="0.00" placeholderTextColor={colors.textMuted}
              value={payForm.amount}
              onChangeText={v => setPayForm(f => ({...f, amount:v}))}
              keyboardType="decimal-pad" />

            <Text style={[s.label, { color: colors.textSoft }]}>التاريخ</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:14}]}
              value={payForm.date}
              onChangeText={v => setPayForm(f => ({...f, date:v}))} />

            <Text style={[s.label, { color: colors.textSoft }]}>ملاحظة</Text>
            <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginBottom:20}]}
              placeholder="مثال: دفع عبر تحويل بنكي" placeholderTextColor={colors.textMuted}
              value={payForm.note}
              onChangeText={v => setPayForm(f => ({...f, note:v}))} />
          </ScrollView>
          <View style={[s.modalFoot, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity style={[s.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => setPayModal(null)}>
              <Text style={[s.cancelT, { color: colors.textMuted }]}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.gold }]} onPress={addPayment} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={[s.saveT, { color: colors.bg }]}>💾 حفظ</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:          { flex:1 },
  header:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingTop:50, borderBottomWidth:1 },
  title:         { fontSize:15, fontWeight:'900' },
  homeBtn:       { fontSize:13, fontWeight:'700' },
  pwBtn:         { fontSize:20 },
  themeIcon:     { fontSize:18 },
  logout:        { fontSize:13 },
  tabs:          { flexDirection:'row', margin:12, borderRadius:10, padding:3 },
  tab:           { flex:1, padding:8, borderRadius:7, alignItems:'center' },
  tabT:          { fontSize:13, fontWeight:'600' },
  topBar:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:14, marginBottom:4 },
  count:         { fontSize:11, flex:1 },
  addBtn:        { borderRadius:10, paddingHorizontal:14, paddingVertical:8 },
  addT:          { fontWeight:'700', fontSize:13 },
  card:          { borderRadius:12, padding:14, marginBottom:10, borderWidth:1 },
  cardTop:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  code:          { fontSize:15, fontWeight:'700', letterSpacing:1 },
  chip:          { borderRadius:20, paddingHorizontal:10, paddingVertical:4, borderWidth:1 },
  chipOk:        { backgroundColor:'rgba(46,204,113,0.1)', borderColor:'rgba(46,204,113,0.3)' },
  chipFree:      { backgroundColor:'rgba(201,168,76,0.1)', borderColor:'rgba(201,168,76,0.3)' },
  chipFree2:     { borderRadius:20, paddingHorizontal:10, paddingVertical:4, borderWidth:1 },
  chipExp:       { backgroundColor:'rgba(231,76,60,0.1)', borderColor:'rgba(231,76,60,0.3)' },
  chipT:         { fontSize:11, fontWeight:'700', color:'#f8f6f0' },
  meta:          { fontSize:12, marginBottom:3 },
  devicesBadge:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderRadius:8, padding:8, marginTop:8, borderWidth:1 },
  devicesBadgeT: { fontSize:12, fontWeight:'600' },
  devicesBox:    { borderRadius:8, padding:10, marginTop:6 },
  deviceRow:     { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:8, borderBottomWidth:1 },
  deviceNum:     { fontSize:12, width:18, textAlign:'center' },
  deviceIcon:    { fontSize:18 },
  deviceType:    { fontSize:13, fontWeight:'600' },
  deviceDate:    { fontSize:11, marginTop:2 },
  btnRow:        { flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' },
  actionBtn:     { borderRadius:8, paddingHorizontal:10, paddingVertical:6, borderWidth:1 },
  delBtnStyle:   { borderColor:'rgba(231,76,60,0.3)' },
  actionT:       { fontSize:12 },
  empty:         { textAlign:'center', marginTop:40 },
  planCard:      { borderRadius:12, padding:14, marginBottom:10, borderWidth:1.5, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  planCardLeft:  { flex:1 },
  planCardLabel: { fontSize:15, fontWeight:'700', marginBottom:4 },
  planCardDate:  { fontSize:11 },
  planCardPrice: { fontSize:18, fontWeight:'900', color:'#2ecc71' },
  renewInfo:     { borderRadius:10, padding:12, marginBottom:16, borderWidth:1 },
  renewInfoT:    { fontSize:13, marginBottom:4 },
  infoBox:       { borderRadius:10, padding:12, marginBottom:20, borderWidth:1, alignItems:'center' },
  infoBoxT:      { fontSize:14, fontWeight:'600' },
  modalWrap:     { flex:1 },
  modalHead:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, borderBottomWidth:1 },
  modalTitle:    { fontSize:16, fontWeight:'900' },
  modalClose:    { fontSize:18, padding:4 },
  modalFoot:     { flexDirection:'row', gap:12, padding:16, borderTopWidth:1 },
  label:         { fontSize:12, marginBottom:6, fontWeight:'500' },
  input:         { borderWidth:1.5, borderRadius:10, padding:12, fontSize:15, textAlign:'right' },
  genBtn:        { borderRadius:10, padding:12, borderWidth:1 },
  genT:          { fontSize:18 },
  planBtn:       { flex:1, paddingVertical:10, borderRadius:10, borderWidth:1.5, alignItems:'center' },
  planT:         { fontSize:13, fontWeight:'700' },
  cancelBtn:     { flex:1, borderRadius:10, padding:14, alignItems:'center', borderWidth:1 },
  cancelT:       { fontSize:15 },
  saveBtn:       { flex:2, borderRadius:10, padding:14, alignItems:'center' },
  saveT:         { fontSize:15, fontWeight:'700' },
});

