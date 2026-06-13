import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
  Modal, ScrollView, Alert, Linking
} from 'react-native';
import { signOut } from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';

const BANKS = ["التجاري الوطني","الجمهورية","الأمان","الوحدة","شمال أفريقيا","التجارة والتنمية","المتوسط","الاتحاد","أخرى"];

const EMPTY = {
  name:"", bankType:"", bankTypeOther:"", phone1:"", phone2:"",
  nationalId:"", passportId:"", accountNumber:"", iban:"",
  amount:"", currency:"د.ل", purchasedBy:"", paymentType:"",
  cardBooked:false, bookingDate:"", pinCode:"",
  soldTo:"", isSold:false, notes:""
};

function fmt(ts) {
  if (!ts) return '—';
  try { return (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleDateString('ar-LY'); }
  catch { return '—'; }
}

export default function HomeScreen() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({...EMPTY});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('clients');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBank, setFilterBank] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
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

  const bankNames = [...new Set(clients.map(c =>
    c.bankType === 'أخرى' ? c.bankTypeOther || 'أخرى' : c.bankType
  ).filter(Boolean))];

  const filtered = clients.filter(c => {
    const q = search.toLowerCase().trim();
    const m = !q ||
      c.name?.toLowerCase().includes(q) ||
      c.phone1?.includes(q) ||
      c.phone2?.includes(q) ||
      c.nationalId?.includes(q) ||
      c.iban?.toLowerCase().includes(q);
    const bank = c.bankType === 'أخرى' ? c.bankTypeOther || 'أخرى' : c.bankType;
    const fb = filterBank === 'all' || bank === filterBank || c.bankType === filterBank;
    const fs = filterStatus === 'all'
      || (filterStatus === 'booked' && c.cardBooked && !c.isSold)
      || (filterStatus === 'pending' && !c.cardBooked && !c.isSold)
      || (filterStatus === 'sold' && c.isSold);
    return m && fb && fs;
  }).sort((a, b) => {
    if (sortBy === 'alpha') return (a.name || '').localeCompare(b.name || '', 'ar');
    if (sortBy === 'booking_asc') {
      const da = a.bookingDate ? new Date(a.bookingDate) : new Date(0);
      const db2 = b.bookingDate ? new Date(b.bookingDate) : new Date(0);
      return da - db2;
    }
    if (sortBy === 'booking_desc') {
      const da = a.bookingDate ? new Date(a.bookingDate) : new Date(0);
      const db2 = b.bookingDate ? new Date(b.bookingDate) : new Date(0);
      return db2 - da;
    }
    return 0;
  });

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

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => signOut(auth)}>
          <Text style={s.logout}>خروج</Text>
        </TouchableOpacity>
        <Text style={s.title}>💳 إدارة بطاقاتك</Text>
        {tab === 'clients'
          ? <TouchableOpacity onPress={openAdd}>
              <Text style={s.addH}>＋</Text>
            </TouchableOpacity>
          : <View style={{width:30}} />
        }
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

          {/* واتساب */}
          <TouchableOpacity style={s.waBtn}
            onPress={() => Linking.openURL('https://wa.me/218945888844')}>
            <Text style={s.waBtnT}>📱 تواصل مع خدمة العملاء</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Clients Tab */}
      {tab === 'clients' && (
        <>
          {/* Search + Filter */}
          <View style={s.searchRow}>
            <TextInput style={[s.search, {flex:1}]}
              placeholder="🔍 بحث بالاسم أو الجوال..."
              placeholderTextColor="#8a9ab5"
              value={search} onChangeText={setSearch} />
            <TouchableOpacity style={s.filterBtn} onPress={() => setShowFilters(!showFilters)}>
              <Text style={s.filterBtnT}>⚙️</Text>
            </TouchableOpacity>
          </View>

          {showFilters && (
            <View style={s.filtersBox}>
              {/* فرز */}
              <Text style={s.filterLabel}>الفرز:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[
                  {v:'newest', l:'الأحدث'},
                  {v:'alpha', l:'أبجدي'},
                  {v:'booking_asc', l:'حجز ↑'},
                  {v:'booking_desc', l:'حجز ↓'},
                ].map(item => (
                  <TouchableOpacity key={item.v}
                    style={[s.fChip, sortBy === item.v && s.fChipOn]}
                    onPress={() => setSortBy(item.v)}>
                    <Text style={[s.fChipT, sortBy === item.v && s.fChipTOn]}>{item.l}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* فلتر الحالة */}
              <Text style={[s.filterLabel, {marginTop:8}]}>الحالة:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[
                  {v:'all', l:`الكل (${total})`},
                  {v:'booked', l:`✅ تم (${booked})`},
                  {v:'pending', l:`⏳ انتظار (${pending})`},
                  {v:'sold', l:`🔴 مباع (${sold})`},
                ].map(item => (
                  <TouchableOpacity key={item.v}
                    style={[s.fChip, filterStatus === item.v && s.fChipOn]}
                    onPress={() => setFilterStatus(item.v)}>
                    <Text style={[s.fChipT, filterStatus === item.v && s.fChipTOn]}>{item.l}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* فلتر المصرف */}
              {bankNames.length > 0 && (
                <>
                  <Text style={[s.filterLabel, {marginTop:8}]}>المصرف:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={[s.fChip, filterBank === 'all' && s.fChipOn]}
                      onPress={() => setFilterBank('all')}>
                      <Text style={[s.fChipT, filterBank === 'all' && s.fChipTOn]}>الكل</Text>
                    </TouchableOpacity>
                    {bankNames.map(b => (
                      <TouchableOpacity key={b}
                        style={[s.fChip, filterBank === b && s.fChipOn]}
                        onPress={() => setFilterBank(b)}>
                        <Text style={[s.fChipT, filterBank === b && s.fChipTOn]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          )}

          <Text style={s.resultCount}>{filtered.length} عميل</Text>

          {loading
            ? <ActivityIndicator color="#c9a84c" style={{marginTop:40}} />
            : <FlatList
                data={filtered}
                keyExtractor={c => c.id}
                contentContainerStyle={{padding:14, paddingTop:4}}
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
                        ? <View style={[s.badge, s.badgeOk]}><Text style={s.badgeT}>✅ تم</Text></View>
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
              ['تم الشراء من طرف', sel.purchasedBy || '—'],
              ['نوع الحجز', sel.paymentType || '—'],
              ['حالة البطاقة', sel.cardBooked ? '✅ تم الحجز' : '⏳ لم يتم'],
              ['تاريخ الحجز', sel.bookingDate || '—'],
              ['الرقم السري', sel.pinCode || '—'],
              ['حالة البيع', sel.isSold ? '🔴 تم البيع' : '🟢 لم يُباع'],
              ['بيعت إلى', sel.soldTo || '—'],
              ['ملاحظات', sel.notes || '—'],
              ['تاريخ الإضافة', fmt(sel.createdAt)],
              ['أضيف بواسطة', sel.createdBy || '—'],
            ].map(([l, v]) => (
              <View key={l} style={s.row}>
                <Text style={s.rowV}>{v}</Text>
                <Text style={s.rowL}>{l}</Text>
              
