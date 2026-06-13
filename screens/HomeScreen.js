import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
  Modal, ScrollView, Alert
} from 'react-native';
import { signOut } from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';

const BANKS = ["التجاري الوطني","الجمهورية","الأمان","الوحدة","شمال أفريقيا","التجارة والتنمية","المتوسط","الاتحاد","أخرى"];

const EMPTY = {
  name:"", bankType:"", phone1:"", phone2:"", nationalId:"",
  passportId:"", accountNumber:"", iban:"", amount:"", currency:"د.ل",
  purchasedBy:"", paymentType:"", cardBooked:false, bookingDate:"",
  pinCode:"", soldTo:"", isSold:false, notes:""
};

export default function HomeScreen() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({...EMPTY});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('clients');
  const user = auth.currentUser;

  useEffect(() => {
    const q = query(
      collection(db, 'clients'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, snap => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const filtered = clients.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone1?.includes(search) ||
    c.nationalId?.includes(search)
  );

  const total = clients.length;
  const booked = clients.filter(c => c.cardBooked && !c.isSold).length;
  const pending = clients.filter(c => !c.cardBooked && !c.isSold).length;
  const sold = clients.filter(c => c.isSold).length;
  const totalAmt = clients.filter(c => !c.isSold).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  const openAdd = () => { setForm({...EMPTY}); setSel(null); setModal('form'); };
  const openEdit = (c) => { setForm({...c}); setSel(c); setModal('form'); };
  const openView = (c) => { setSel(c); setModal('view'); };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('خطأ', 'الاسم مطلوب'); return; }
    if (!form.bankType) { Alert.alert('خطأ', 'المصرف مطلوب'); return; }
    if (!form.phone1.trim()) { Alert.alert('خطأ', 'الهاتف مطلوب'); return; }
    if (!form.nationalId.trim()) { Alert.alert('خطأ', 'الرقم الوطني مطلوب'); return; }
    setSaving(true);
    try {
      if (sel) {
        await updateDoc(doc(db, 'clients', sel.id), {
          ...form, updatedBy: user.email, updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'clients'), {
          ...form, uid: user.uid, createdBy: user.email, createdAt: serverTimestamp()
        });
      }
      setModal(null);
    } catch (e) { Alert.alert('خطأ', e.message); }
    setSaving(false);
  };

  const handleDelete = (c) => {
    Alert.alert('حذف', `هل تريد حذف ${c.name}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        await deleteDoc(doc(db, 'clients', c.id));
        setModal(null);
      }}
    ]);
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fmt = (ts) => {
    if (!ts) return '—';
    try { return (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleDateString('ar-LY'); }
    catch { return '—'; }
  };

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => signOut(auth)}>
          <Text style={s.logout}>خروج</Text>
        </TouchableOpacity>
        <Text style={s.title}>💳 إدارة بطاقاتك</Text>
        {tab === 'clients' && (
          <TouchableOpacity onPress={openAdd}>
            <Text style={s.addH}>＋</Text>
          </TouchableOpacity>
        )}
        {tab === 'stats' && <View style={{width:40}} />}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab==='clients' && s.tabOn]} onPress={() => setTab('clients')}>
          <Text style={[s.tabT, tab==='clients' && s.tabTOn]}>👥 العملاء</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab==='stats' && s.tabOn]} onPress={() => setTab('stats')}>
          <Text style={[s.tabT, tab==='stats' && s.tabTOn]}>📊 الإحصائيات</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Tab */}
      {tab === 'stats' && (
        <ScrollView style={{flex:1}} contentContainerStyle={{padding:14}}>
          <View style={s.statsGrid}>
            {[
              { i:'👥', v:total, l:'إجمالي العملاء', c:'#c9a84c' },
              { i:'✅', v:booked, l:'تم حجز البطاقة', c:'#2ecc71' },
              { i:'⏳', v:pending, l:'لم يتم الحجز', c:'#f39c12' },
              { i:'🔴', v:sold, l:'تم البيع', c:'#e74c3c' },
              { i:'💰', v:`${totalAmt.toLocaleString()} د.ل`, l:'إجمالي المبالغ', c:'#c9a84c' },
              { i:'📊', v:total ? `${Math.round(booked/total*100)}%` : '0%', l:'نسبة الحجز', c:'#2ecc71' },
            ].map((item, i) => (
              <View key={i} style={s.statCard}>
                <Text style={s.statI}>{item.i}</Text>
                <Text style={[s.statV, {color:item.c}]}>{item.v}</Text>
                <Text style={s.statL}>{item.l}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Clients Tab */}
      {tab === 'clients' && (
        <>
          <TextInput style={s.search}
            placeholder="🔍 بحث بالاسم أو الجوال أو الرقم الوطني..."
            placeholderTextColor="#8a9ab5"
            value={search} onChangeText={setSearch} />

          {loading
            ? <ActivityIndicator color="#c9a84c" style={{marginTop:40}} />
            : <FlatList
                data={filtered}
                keyExtractor={c => c.id}
                contentContainerStyle={{padding:14}}
                ListEmptyComponent={
                  <View style={s.empty}>
                    <Text style={s.emptyI}>📋</Text>
                    <Text style={s.emptyT}>{!clients.length ? 'اضغط + لإضافة أول عميل' : 'لا توجد نتائج'}</Text>
                  </View>
                }
                renderItem={({ item: c }) => (
                  <TouchableOpacity style={[s.card, c.isSold && s.soldCard]} onPress={() => openView(c)}>
                    <View style={s.cardTop}>
                      <Text style={s.name}>{c.name}</Text>
                      {c.isSold
                        ? <View style={[s.badge, s.badgeSold]}><Text style={s.badgeT}>🔴 مباع</Text></View>
                        : c.cardBooked
                        ? <View style={[s.badge, s.badgeOk]}><Text style={s.badgeT}>✅ محجوز</Text></View>
                        : <View style={[s.badge, s.badgeWarn]}><Text style={s.badgeT}>⏳ انتظار</Text></View>
                      }
                    </View>
                    <Text style={s.bank}>{c.bankType === 'أخرى' ? c.bankTypeOther : c.bankType}</Text>
                    <Text style={s.phone}>{c.phone1}</Text>
                    {c.amount ? <Text style={s.amount}>{parseFloat(c.amount).toLocaleString()} {c.currency}</Text> : null}
                    <View style={s.actions}>
                      <TouchableOpacity style={s.editBtn} onPress={() => openEdit(c)}>
                        <Text style={s.editT}>✏️ تعديل</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(c)}>
                        <Text style={s.delT}>🗑 حذف</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
              />
          }

          {/* FAB */}
          <TouchableOpacity style={s.fab} onPress={openAdd}>
            <Text style={s.fabT}>＋</Text>
          </TouchableOpacity>
        </>
      )}

      {/* View Modal */}
      <Modal visible={modal === 'view'} animationType="slide">
        <View style={s.modalWrap}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setModal(null)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>👤 {sel?.name}</Text>
            <TouchableOpacity onPress={() => { setModal(null); setTimeout(() => openEdit(sel), 300); }}>
              <Text style={s.editH}>✏️</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{padding:16}}>
            {sel && [
              ['الاسم', sel.name],
              ['المصرف', sel.bankType === 'أخرى' ? sel.bankTypeOther : sel.bankType],
              ['الهاتف 1', sel.phone1],
              ['الهاتف 2', sel.phone2 || '—'],
              ['الرقم الوطني', sel.nationalId],
              ['جواز السفر', sel.passportId || '—'],
              ['رقم الحساب', sel.accountNumber || '—'],
              ['IBAN', sel.iban || '—'],
              ['المبلغ', sel.amount ? `${parseFloat(sel.amount).toLocaleString()} ${sel.currency}` : '—'],
              ['نوع الحجز', sel.paymentType || '—'],
              ['حالة البطاقة', sel.cardBooked ? '✅ تم الحجز' : '⏳ لم يتم'],
              ['الرقم السري', sel.pinCode || '—'],
              ['حالة البيع', sel.isSold ? '🔴 تم البيع' : '🟢 لم يُباع'],
              ['بيعت إلى', sel.soldTo || '—'],
              ['ملاحظات', sel.notes || '—'],
              ['تاريخ الإضافة', fmt(sel.createdAt)],
            ].map(([l, v]) => (
              <View key={l} style={s.row}>
                <Text style={s.rowV}>{v}</Text>
                <Text style={s.rowL}>{l}</Text>
              </View>
            ))}
            <View style={{height:20}} />
          </ScrollView>
          <View style={s.modalFoot}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(null)}>
              <Text style={s.cancelT}>إغلاق</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, {backgroundColor:'#e74c3c'}]} onPress={() => handleDelete(sel)}>
              <Text style={s.saveT}>🗑 حذف</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Form Modal */}
      <Modal visible={modal === 'form'} animationType="slide">
        <View style={s.modalWrap}>
          <View style={s.modalHead}>
            <TouchableOpacity onPress={() => setModal(null)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{sel ? '✏️ تعديل عميل' : '➕ إضافة عميل'}</Text>
            <View style={{width:30}} />
          </View>
          <ScrollView style={{padding:16}}>
            {[
              { label:'الاسم الكامل *', key:'name', placeholder:'اسم العميل' },
              { label:'رقم الهاتف 1 *', key:'phone1', placeholder:'0912345678', keyboard:'phone-pad' },
              { label:'رقم الهاتف 2', key:'phone2', placeholder:'اختياري', keyboard:'phone-pad' },
              { label:'الرقم الوطني *', key:'nationalId', placeholder:'الرقم الوطني', keyboard:'numeric' },
              { label:'جواز السفر', key:'passportId', placeholder:'اختياري' },
              { label:'رقم الحساب', key:'accountNumber', placeholder:'اختياري' },
              { label:'رقم IBAN', key:'iban', placeholder:'اختياري' },
              { label:'المبلغ المدفوع', key:'amount', placeholder:'0.00', keyboard:'numeric' },
              { label:'تم الشراء من طرف', key:'purchasedBy', placeholder:'اسم الموظف' },
              { label:'الرقم السري', key:'pinCode', placeholder:'1234', keyboard:'numeric' },
              { label:'بيعت إلى', key:'soldTo', placeholder:'اسم المشتري' },
              { label:'ملاحظات', key:'notes', placeholder:'ملاحظات إضافية', multi:true },
            ].map(({ label, key, placeholder, keyboard, multi }) => (
              <View key={key} style={s.fg}>
                <Text style={s.label}>{label}</Text>
                <TextInput style={[s.input, multi && {height:80}]}
                  placeholder={placeholder} placeholderTextColor="#8a9ab5"
                  value={form[key] || ''} onChangeText={v => set(key, v)}
                  keyboardType={keyboard || 'default'}
                  multiline={multi} textAlignVertical={multi ? 'top' : 'center'} />
              </View>
            ))}

            <View style={s.fg}>
              <Text style={s.label}>المصرف *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {BANKS.map(b => (
                  <TouchableOpacity key={b} style={[s.chip, form.bankType === b && s.chipOn]}
                    onPress={() => set('bankType', b)}>
                    <Text style={[s.chipT, form.bankType === b && s.chipTOn]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={s.fg}>
              <Text style={s.label}>نوع الحجز</Text>
              <View style={{flexDirection:'row', gap:8}}>
                {['كاش','حوالة','بطاقة'].map(t => (
                  <TouchableOpacity key={t} style={[s.chip, form.paymentType === t && s.chipOn]}
                    onPress={() => set('paymentType', t)}>
                    <Text style={[s.chipT, form.paymentType === t && s.chipTOn]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={s.chk} onPress={() => set('cardBooked', !form.cardBooked)}>
              <Text style={s.chkBox}>{form.cardBooked ? '✅' : '⬜'}</Text>
              <Text style={s.chkL}>تم حجز البطاقة</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.chk} onPress={() => set('isSold', !form.isSold)}>
              <Text style={s.chkBox}>{form.isSold ? '✅' : '⬜'}</Text>
              <Text style={s.chkL}>تم بيع البطاقة</Text>
            </TouchableOpacity>

            <View style={{height:40}} />
          </ScrollView>

          <View style={s.modalFoot}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(null)}>
              <Text style={s.cancelT}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
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
  title:     { fontSize:16, fontWeight:'900', color:'#c9a84c' },
  logout:    { color:'#8a9ab5', fontSize:13 },
  addH:      { color:'#c9a84c', fontSize:24, fontWeight:'700' },
  editH:     { color:'#c9a84c', fontSize:16 },
  tabs:      { flexDirection:'row', backgroundColor:'rgba(0,0,0,0.2)', margin:12, borderRadius:10, padding:3 },
  tab:       { flex:1, padding:8, borderRadius:7, alignItems:'center' },
  tabOn:     { backgroundColor:'#c9a84c' },
  tabT:      { color:'#8a9ab5', fontSize:13, fontWeight:'600' },
  tabTOn:    { color:'#0a1628', fontWeight:'700' },
  statsGrid: { flexDirection:'row', flexWrap:'wrap', gap:10 },
  statCard:  { width:'47%', backgroundColor:'#0f2040', borderRadius:12, padding:14, alignItems:'center', borderWidth:1, borderColor:'rgba(201,168,76,0.15)' },
  statI:     { fontSize:24, marginBottom:6 },
  statV:     { fontSize:22, fontWeight:'900' },
  statL:     { fontSize:11, color:'#8a9ab5', marginTop:3, textAlign:'center' },
  search:    { marginHorizontal:14, marginBottom:4, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:10, padding:12, color:'#f8f6f0', borderWidth:1, borderColor:'rgba(255,255,255,0.1)', textAlign:'right' },
  card:      { backgroundColor:'#0f2040', borderRadius:12, padding:14, marginBottom:10, borderWidth:1, borderColor:'rgba(201,168,76,0.15)' },
  soldCard:  { opacity:0.5 },
  cardTop:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6 },
  name:      { fontSize:15, fontWeight:'700', color:'#f8f6f0' },
  bank:      { fontSize:12, color:'#8a9ab5', marginBottom:2 },
  phone:     { fontSize:12, color:'#c5cedd', marginBottom:2 },
  amount:    { fontSize:13, color:'#c9a84c', fontWeight:'700', marginBottom:8 },
  actions:   { flexDirection:'row', gap:8, marginTop:6 },
  editBtn:   { backgroundColor:'rgba(201,168,76,0.1)', borderRadius:8, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:'rgba(201,168,76,0.3)' },
  editT:     { color:'#c9a84c', fontSize:12, fontWeight:'600' },
  delBtn:    { backgroundColor:'rgba(231,76,60,0.1)', borderRadius:8, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:'rgba(231,76,60,0.3)' },
  delT:      { color:'#e74c3c', fontSize:12, fontWeight:'600' },
  badge:     { borderRadius:20, paddingHorizontal:8, paddingVertical:3 },
  badgeOk:   { backgroundColor:'rgba(46,204,113,0.1)', borderWidth:1, borderColor:'rgba(46,204,113,0.3)' },
  badgeWarn: { backgroundColor:'rgba(243,156,18,0.1)', borderWidth:1, borderColor:'rgba(243,156,18,0.3)' },
  badgeSold: { backgroundColor:'rgba(231,76,60,0.1)', borderWidth:1, borderColor:'rgba(231,76,60,0.3)' },
  badgeT:    { fontSize:11, fontWeight:'700', color:'#f8f6f0' },
  empty:     { alignItems:'center', paddingTop:60 },
  emptyI:    { fontSize:40, opacity:0.3, marginBottom:10 },
  emptyT:    { color:'#8a9ab5', fontSize:13 },
  fab:       { position:'absolute', bottom:30, left:20, width:56, height:56, borderRadius:28, backgroundColor:'#c9a84c', alignItems:'center', justifyContent:'center', elevation:5 },
  fabT:      { fontSize:28, color:'#0a1628', fontWeight:'700', marginTop:-2 },
  modalWrap: { flex:1, backgroundColor:'#0a1628' },
  modalHead: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, backgroundColor:'#0f2040', borderBottomWidth:1, borderBottomColor:'rgba(201,168,76,0.2)' },
  modalTitle:{ fontSize:16, fontWeight:'900', color:'#c9a84c' },
  modalClose:{ fontSize:18, color:'#8a9ab5', padding:4 },
  modalFoot: { flexDirection:'row', gap:12, padding:16, backgroundColor:'#0f2040', borderTopWidth:1, borderTopColor:'rgba(201,168,76,0.2)' },
  row:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.05)' },
  rowL:      { fontSize:12, color:'#8a9ab5', minWidth:120 },
  rowV:      { fontSize:13, color:'#f8f6f0', fontWeight:'500', flex:1, textAlign:'left' },
  fg:        { marginBottom:14 },
  label:     { fontSize:12, color:'#c5cedd', marginBottom:5, fontWeight:'500' },
  input:     { backgroundColor:'rgba(255,255,255,0.06)', borderWidth:1.5, borderColor:'rgba(255,255,255,0.1)', borderRadius:10, padding:12, color:'#f8f6f0', fontSize:15, textAlign:'right' },
  chip:      { paddingHorizontal:14, paddingVertical:8, borderRadius:20, borderWidth:1.5, borderColor:'rgba(255,255,255,0.15)', backgroundColor:'rgba(255,255,255,0.05)', marginLeft:8 },
  chipOn:    { borderColor:'#c9a84c', backgroundColor:'rgba(201,168,76,0.15)' },
  chipT:     { color:'#8a9ab5', fontSize:13 },
  chipTOn:   { color:'#c9a84c', fontWeight:'700' },
  chk:       { flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 },
  chkBox:    { fontSize:20 },
  chkL:      { fontSize:14, color:'#c5cedd' },
  cancelBtn: { flex:1, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:10, padding:14, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  cancelT:   { color:'#8a9ab5', fontSize:15 },
  saveBtn:   { flex:2, backgroundColor:'#c9a84c', borderRadius:10, padding:14, alignItems:'center' },
  saveT:     { color:'#0a1628', fontSize:15, fontWeight:'700' },
});
