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
            renderItem={({ item: sub }) => {
              const days = daysLeft(sub.expiresAt);
              const isActive = sub.usedBy && days > 0;
              const isExpired = days <= 0;
              const isFree = !sub.usedBy && !isExpired;
              return (
                <View style={s.card}>
                  <View style={s.cardTop}>
                    <Text style={s.code}>{sub.code || sub.id}</Text>
                    <View style={[s.chip,
                      isActive ? s.chipOk : isFree ? s.chipFree : s.chipExp]}>
                      <Text style={s.chipT}>
                        {isActive ? '✅ مفعّل' : isFree ? '🔓 متاح' : '❌ منتهي'}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.meta}>📅 ينتهي: {fmt(sub.expiresAt)} ({days > 0 ? `${days} يوم` : 'منتهي'})</Text>
                  {sub.usedByEmail && <Text style={s.meta}>👤 {sub.usedByEmail}</Text>}
                  {sub.planLabel && <Text style={s.meta}>📦 {sub.planLabel}</Text>}
                  {sub.notes && <Text style={s.meta}>📝 {sub.notes}</Text>}
                  <View style={s.btnRow}>
                    <TouchableOpacity style={s.actionBtn} onPress={() => copyWelcome(sub)}>
                      <Text style={s.actionT}>✉️ رسالة</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => renewSub(sub)}>
                      <Text style={s.actionT}>🔄 تجديد</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, s.delBtn]} onPress={() => deleteSub(sub.id)}>
                      <Text style={[s.actionT, { color: '#e74c3c' }]}>🗑 حذف</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
      }

      {/* Modal إنشاء كود */}
      <Modal visible={modal} animationType="slide">
        <View style={s.modalWrap}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>➕ كود اشتراك جديد</Text>
          </View>
          <ScrollView style={{ padding: 16 }}>
            <Text style={s.label}>كود التفعيل</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TextInput style={[s.input, { flex: 1, letterSpacing: 3, textAlign: 'center' }]}
                value={form.code}
                onChangeText={v => setForm(f => ({ ...f, code: v.toUpperCase() }))}
                autoCapitalize="characters" autoCorrect={false} />
              <TouchableOpacity style={s.genBtn}
                onPress={() => setForm(f => ({ ...f, code: genCode() }))}>
                <Text style={s.genT}>🎲</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>الباقة</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {PLANS.map(p => (
                <TouchableOpacity key={p.id}
                  style={[s.planBtn, form.plan === p.id && s.planBtnOn]}
                  onPress={() => setForm(f => ({ ...f, plan: p.id }))}>
                  <Text style={[s.planT, form.plan === p.id && s.planTOn]}>{p.label}</Text>
                  <Text style={[s.planPrice, form.plan === p.id && { color: '#c9a84c' }]}>${p.price}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>الحد الأقصى للعملاء</Text>
            <TextInput style={[s.input, { marginBottom: 14 }]}
              value={form.maxClients}
              onChangeText={v => setForm(f => ({ ...f, maxClients: v }))}
              keyboardType="numeric" />

            <Text style={s.label}>ملاحظة</Text>
            <TextInput style={[s.input, { marginBottom: 20 }]}
              value={form.notes}
              onChangeText={v => setForm(f => ({ ...f, notes: v }))}
              placeholder="اسم العميل مثلاً"
              placeholderTextColor="#8a9ab5" />
          </ScrollView>

          <View style={s.modalFoot}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(false)}>
              <Text style={s.cancelT}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={createSub} disabled={saving}>
              {saving ? <ActivityIndicator color="#0a1628" /> : <Text style={s.saveT}>💾 حفظ</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { flex:1, backgroundColor:'#0a1628' },
  header:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingTop:50, backgroundColor:'#0f2040', borderBottomWidth:1, borderBottomColor:'rgba(201,168,76,0.2)' },
  title:     { fontSize:17, fontWeight:'900', color:'#c9a84c' },
  logout:    { color:'#8a9ab5', fontSize:13 },
  homeBtn:   { color:'#c9a84c', fontSize:13, fontWeight:'700' },
  topBar:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:14 },
  count:     { fontSize:12, color:'#8a9ab5' },
  addBtn:    { backgroundColor:'#c9a84c', borderRadius:10, paddingHorizontal:14, paddingVertical:8 },
  addT:      { color:'#0a1628', fontWeight:'700', fontSize:13 },
  card:      { backgroundColor:'#0f2040', borderRadius:12, padding:14, marginBottom:10, borderWidth:1, borderColor:'rgba(201,168,76,0.15)' },
  cardTop:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  code:      { fontSize:16, fontWeight:'700', color:'#c9a84c', letterSpacing:2 },
  chip:      { borderRadius:20, paddingHorizontal:10, paddingVertical:4, borderWidth:1 },
  chipOk:    { backgroundColor:'rgba(46,204,113,0.1)', borderColor:'rgba(46,204,113,0.3)' },
  chipFree:  { backgroundColor:'rgba(201,168,76,0.1)', borderColor:'rgba(201,168,76,0.3)' },
  chipExp:   { backgroundColor:'rgba(231,76,60,0.1)', borderColor:'rgba(231,76,60,0.3)' },
  chipT:     { fontSize:11, fontWeight:'700', color:'#f8f6f0' },
  meta:      { fontSize:12, color:'#8a9ab5', marginBottom:3 },
  btnRow:    { flexDirection:'row', gap:8, marginTop:10 },
  actionBtn: { backgroundColor:'rgba(255,255,255,0.05)', borderRadius:8, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  delBtn:    { borderColor:'rgba(231,76,60,0.3)' },
  actionT:   { fontSize:12, color:'#c5cedd' },
  empty:     { textAlign:'center', color:'#8a9ab5', marginTop:40 },
  modalWrap: { flex:1, backgroundColor:'#0a1628' },
  modalHead: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, backgroundColor:'#0f2040', borderBottomWidth:1, borderBottomColor:'rgba(201,168,76,0.2)' },
  modalTitle:{ fontSize:17, fontWeight:'900', color:'#c9a84c' },
  modalClose:{ fontSize:18, color:'#8a9ab5', padding:4 },
  modalFoot: { flexDirection:'row', gap:12, padding:16, backgroundColor:'#0f2040', borderTopWidth:1, borderTopColor:'rgba(201,168,76,0.2)' },
  label:     { fontSize:12, color:'#c5cedd', marginBottom:6, fontWeight:'500' },
  input:     { backgroundColor:'rgba(255,255,255,0.06)', borderWidth:1.5, borderColor:'rgba(255,255,255,0.1)', borderRadius:10, padding:12, color:'#f8f6f0', fontSize:15, textAlign:'right' },
  genBtn:    { backgroundColor:'rgba(255,255,255,0.06)', borderRadius:10, padding:12, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  genT:      { fontSize:18 },
  planBtn:   { flex:1, padding:10, borderRadius:10, borderWidth:1.5, borderColor:'rgba(255,255,255,0.12)', backgroundColor:'rgba(255,255,255,0.05)', alignItems:'center' },
  planBtnOn: { borderColor:'#c9a84c', backgroundColor:'rgba(201,168,76,0.12)' },
  planT:     { color:'#8a9ab5', fontSize:12, fontWeight:'700' },
  planTOn:   { color:'#c9a84c' },
  planPrice: { color:'#8a9ab5', fontSize:11, marginTop:2 },
  cancelBtn: { flex:1, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:10, padding:14, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  cancelT:   { color:'#8a9ab5', fontSize:15 },
  saveBtn:   { flex:2, backgroundColor:'#c9a84c', borderRadius:10, padding:14, alignItems:'center' },
  saveT:     { color:'#0a1628', fontSize:15, fontWeight:'700' },
});
