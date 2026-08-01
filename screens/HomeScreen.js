import { useState, useEffect } from 'react';
import {
 View, Text, FlatList, TouchableOpacity,
 StyleSheet, TextInput, ActivityIndicator,
 Modal, ScrollView, Alert, Linking, Clipboard
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { signOut } from 'firebase/auth';
import {
 collection, query, where, orderBy, onSnapshot,
 addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useTheme } from '../ThemeContext';

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

const copy = (v, l) => {
 if (!v || v === '—') return;
 Clipboard.setString(v);
 Alert.alert('✅ تم النسخ', `تم نسخ ${l}`);
};

async function exportPDF(clients, single = null) {
 const list = single ? [single] : clients;
 const date = new Date().toLocaleDateString('ar-LY');
 const title = single ? `بيانات العميل: ${single.name}` : 'تقرير قائمة العملاء';

 const rows = list.map((c, i) => {
   const bank = c.bankType === 'أخرى' ? (c.bankTypeOther || 'أخرى') : c.bankType;
   const status = c.isSold ? 'مباع' : c.cardBooked ? 'تم الحجز' : 'لم يتم';
   const sc = c.isSold ? '#c0392b' : c.cardBooked ? '#166534' : '#92400e';
   const sb = c.isSold ? '#fef2f2' : c.cardBooked ? '#f0fdf4' : '#fffbeb';
   return `<tr>
     <td style="text-align:center;color:#9ca3af;font-size:10px">${i+1}</td>
     <td style="font-weight:700;color:#111827">${c.name||'—'}</td>
     <td>${bank||'—'}</td>
     <td style="font-family:monospace;direction:ltr">${c.phone1||'—'}</td>
     <td style="font-family:monospace;font-size:10px">${c.nationalId||'—'}</td>
     <td style="font-weight:700;color:#92400e">${c.amount?parseFloat(c.amount).toLocaleString('en')+' '+c.currency:'—'}</td>
     <td>${c.paymentType||'—'}</td>
     <td><span style="background:${sb};color:${sc};border:1px solid ${sc}33;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">${status}</span></td>
     <td style="font-family:monospace;font-weight:700;color:#1e40af">${c.pinCode||'—'}</td>
     <td style="font-size:10px;color:#374151">${c.soldTo||'—'}</td>
     <td style="font-size:10px;color:#374151">${c.purchasedBy||'—'}</td>
   </tr>`;
 }).join('');

 const detailSection = single ? `
   <div style="margin-top:20px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
     <div style="background:#1e3a5f;color:#f0c040;padding:10px 16px;font-size:13px;font-weight:700">📋 البيانات التفصيلية</div>
     <table style="width:100%;border-collapse:collapse">
       ${[
         ['الاسم الكامل', single.name],
         ['المصرف', single.bankType==='أخرى'?(single.bankTypeOther||'أخرى'):single.bankType],
         ['الهاتف 1', single.phone1],
         ['الهاتف 2', single.phone2||'—'],
         ['الرقم الوطني', single.nationalId],
         ['جواز السفر', single.passportId||'—'],
         ['رقم الحساب', single.accountNumber||'—'],
         ['رقم IBAN', single.iban||'—'],
         ['المبلغ المدفوع', single.amount?parseFloat(single.amount).toLocaleString('en')+' '+single.currency:'—'],
         ['تم الشراء من طرف', single.purchasedBy||'—'],
         ['نوع الحجز', single.paymentType||'—'],
         ['حالة البطاقة', single.cardBooked?'✅ تم الحجز':'⏳ لم يتم بعد'],
         ['تاريخ الحجز', single.bookingDate||'—'],
         ['الرقم السري', single.pinCode||'—'],
         ['حالة البيع', single.isSold?'🔴 تم البيع':'🟢 لم يُباع'],
         ['بيعت إلى', single.soldTo||'—'],
         ['ملاحظات', single.notes||'—'],
       ].map(([l,v],i)=>`<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
         <td style="padding:8px 14px;font-size:12px;color:#6b7280;font-weight:600;width:140px;border-bottom:1px solid #f3f4f6">${l}</td>
         <td style="padding:8px 14px;font-size:12px;color:#111827;border-bottom:1px solid #f3f4f6">${v}</td>
       </tr>`).join('')}
     </table>
   </div>` : '';

 const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
 *{box-sizing:border-box;margin:0;padding:0}
 body{font-family:Arial,sans-serif;direction:rtl;background:#fff;color:#111827;font-size:12px}
 .wrap{padding:20px}
 .hdr{background:linear-gradient(135deg,#1e3a5f,#0f2040);border-radius:10px;padding:16px 22px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center}
 .hdr h1{font-size:17px;font-weight:900;color:#f0c040;margin-bottom:3px}
 .hdr p{font-size:11px;color:#93a3b8}
 .tw{border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:18px}
 table{width:100%;border-collapse:collapse}
 thead tr{background:linear-gradient(135deg,#1e3a5f,#0f2040)}
 th{padding:10px 9px;text-align:right;font-size:11px;font-weight:700;color:#f0c040;white-space:nowrap}
 td{padding:9px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#374151;vertical-align:middle}
 tr:nth-child(even) td{background:#fafafa}
 .ft{display:flex;justify-content:space-between;border-top:2px solid #f0c040;padding-top:10px;font-size:10px;color:#9ca3af;margin-top:4px}
</style>
</head>
<body>
<div class="wrap">
 <div class="hdr">
   <div>
     <h1>💳 ${title}</h1>
     <p>تاريخ التقرير: ${date} · إجمالي: ${list.length} عميل</p>
   </div>
 </div>
 <div class="tw">
   <table>
     <thead><tr>
       <th>#</th><th>الاسم</th><th>المصرف</th><th>الهاتف</th>
       <th>الرقم الوطني</th><th>المبلغ</th><th>نوع الحجز</th>
       <th>الحالة</th><th>الرقم السري</th><th>بيعت إلى</th><th>اشترى من طرف</th>
     </tr></thead>
     <tbody>${rows}</tbody>
   </table>
 </div>
 ${detailSection}
 <div class="ft"><span>تطبيق إدارة بطاقاتك</span><span>${date}</span></div>
</div>
</body></html>`;

 try {
   const { uri } = await Print.printToFileAsync({ html, base64: false });
   await Sharing.shareAsync(uri, {
     mimeType: 'application/pdf',
     dialogTitle: title,
     UTI: 'com.adobe.pdf'
   });
 } catch (e) {
   Alert.alert('خطأ', 'تعذر إنشاء PDF: ' + e.message);
 }
}

async function exportCSV(clients) {
 const cols = [
   ['الاسم', c => c.name || ''],
   ['المصرف', c => c.bankType === 'أخرى' ? (c.bankTypeOther || 'أخرى') : c.bankType || ''],
   ['الهاتف 1', c => c.phone1 || ''],
   ['الهاتف 2', c => c.phone2 || ''],
   ['الرقم الوطني', c => c.nationalId || ''],
   ['جواز السفر', c => c.passportId || ''],
   ['رقم الحساب', c => c.accountNumber || ''],
   ['IBAN', c => c.iban || ''],
   ['المبلغ', c => c.amount || ''],
   ['العملة', c => c.currency || 'د.ل'],
   ['نوع الحجز', c => c.paymentType || ''],
   ['حالة البطاقة', c => c.cardBooked ? 'تم الحجز' : 'لم يتم'],
   ['تاريخ الحجز', c => c.bookingDate || ''],
   ['الرقم السري', c => c.pinCode || ''],
   ['تم البيع', c => c.isSold ? 'نعم' : 'لا'],
   ['بيعت إلى', c => c.soldTo || ''],
   ['اشترى من طرف', c => c.purchasedBy || ''],
   ['ملاحظات', c => c.notes || ''],
 ];
 const H = cols.map(([h]) => h);
 const R = clients.map(c => cols.map(([, fn]) => fn(c)));
 const esc = v => `"${String(v).replace(/"/g, '""')}"`;
 const csv = '\uFEFF' + [H, ...R].map(r => r.map(esc).join(',')).join('\r\n');
 try {
   const { uri } = await Print.printToFileAsync({
     html: `<pre>${csv}</pre>`,
     base64: false
   });
   await Sharing.shareAsync(uri, {
     mimeType: 'text/csv',
     dialogTitle: 'قائمة العملاء',
   });
 } catch (e) {
   Alert.alert('خطأ', e.message);
 }
}

export default function HomeScreen({ subDays, navigation }) {
 const { colors, isDark, toggleTheme } = useTheme();
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
 const [bankModal, setBankModal] = useState(false);
 const [noteEdits, setNoteEdits] = useState({});
 const [noteSaving, setNoteSaving] = useState({});
 const user = auth.currentUser;
 const ADMIN_UID = "yel5HGeqTfXRUmraIzfZK4XVhrS2";
 const isAdmin = user?.uid === ADMIN_UID;

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
     c.passportId?.toLowerCase().includes(q) ||
     c.iban?.toLowerCase().includes(q) ||
     c.accountNumber?.toLowerCase().includes(q);
   const bank = c.bankType === 'أخرى' ? c.bankTypeOther || 'أخرى' : c.bankType;
   const fb = filterBank === 'all' || bank === filterBank || c.bankType === filterBank;
   const fs = filterStatus === 'all'
     || (filterStatus === 'booked' && c.cardBooked && !c.isSold)
     || (filterStatus === 'pending' && !c.cardBooked && !c.isSold)
     || (filterStatus === 'sold' && c.isSold);
   return m && fb && fs;
 }).sort((a, b) => {
   if (sortBy === 'oldest') {
     const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
     const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
     return da - db2;
   }
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
   Alert.alert('🗑 حذف العميل', `هل تريد حذف "${c.name}"؟\nلا يمكن التراجع عن هذا الإجراء.`, [
     { text: 'إلغاء', style: 'cancel' },
     { text: 'حذف نهائياً', style: 'destructive', onPress: async () => {
       await deleteDoc(doc(db, 'clients', c.id));
       setModal(null);
     }}
   ]);
 };

 const handleCancel = () => {
   Alert.alert('إلغاء', 'هل تريد الخروج؟ سيتم فقدان التغييرات.', [
     { text: 'استمرار', style: 'cancel' },
     { text: 'خروج', style: 'destructive', onPress: () => setModal(null) }
   ]);
 };

 const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

 const getNoteValue = (c) => noteEdits[c.id] !== undefined ? noteEdits[c.id] : (c.notes || '');
 const isNoteChanged = (c) => noteEdits[c.id] !== undefined && noteEdits[c.id] !== (c.notes || '');

 const handleNoteChange = (clientId, text) => {
   setNoteEdits(prev => ({ ...prev, [clientId]: text }));
 };

 const handleSaveNote = async (c) => {
   const newNote = noteEdits[c.id];
   if (newNote === undefined) return;
   setNoteSaving(prev => ({ ...prev, [c.id]: true }));
   try {
     await updateDoc(doc(db, 'clients', c.id), {
       notes: newNote, updatedBy: user.email, updatedAt: serverTimestamp()
     });
     setNoteEdits(prev => {
       const copy = { ...prev };
       delete copy[c.id];
       return copy;
     });
   } catch (e) {
     Alert.alert('خطأ', 'تعذر حفظ الملاحظة: ' + e.message);
   }
   setNoteSaving(prev => ({ ...prev, [c.id]: false }));
 };

 const viewRows = sel ? [
   { l:'الاسم الكامل', v:sel.name, canCopy:false },
   { l:'المصرف', v:sel.bankType==='أخرى'?sel.bankTypeOther:sel.bankType, canCopy:false },
   { l:'الهاتف 1', v:sel.phone1, canCopy:true },
   { l:'الهاتف 2', v:sel.phone2||'—', canCopy:true },
   { l:'الرقم الوطني', v:sel.nationalId, canCopy:true },
   { l:'جواز السفر', v:sel.passportId||'—', canCopy:true },
   { l:'رقم الحساب', v:sel.accountNumber||'—', canCopy:true },
   { l:'IBAN', v:sel.iban||'—', canCopy:true },
   { l:'المبلغ', v:sel.amount?`${parseFloat(sel.amount).toLocaleString('en')} ${sel.currency}`:'—', canCopy:false },
   { l:'تم الشراء من طرف', v:sel.purchasedBy||'—', canCopy:false },
   { l:'نوع الحجز', v:sel.paymentType||'—', canCopy:false },
   { l:'حالة البطاقة', v:sel.cardBooked?'✅ تم الحجز':'⏳ لم يتم', canCopy:false },
   { l:'تاريخ الحجز', v:sel.bookingDate||'—', canCopy:false },
   { l:'الرقم السري', v:sel.pinCode||'—', canCopy:true },
   { l:'حالة البيع', v:sel.isSold?'🔴 تم البيع':'🟢 لم يُباع', canCopy:false },
   { l:'بيعت إلى', v:sel.soldTo||'—', canCopy:false },
   { l:'ملاحظات', v:sel.notes||'—', canCopy:false },
   { l:'تاريخ الإضافة', v:fmt(sel.createdAt), canCopy:false },
   { l:'أضيف بواسطة', v:sel.createdBy||'—', canCopy:false },
 ] : [];

 const sections = [
   { title:'📋 البيانات الأساسية', rows:viewRows.slice(0,4) },
   { title:'🏦 البيانات المصرفية', rows:viewRows.slice(4,8) },
   { title:'💳 بيانات البطاقة', rows:viewRows.slice(8,16) },
   { title:'📝 معلومات إضافية', rows:viewRows.slice(16) },
 ];

 return (
   <View style={[s.wrap, { backgroundColor: colors.bg }]}>
     {/* Header */}
     <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
       <TouchableOpacity onPress={() => signOut(auth)}>
         <Text style={[s.logout, { color: colors.textMuted }]}>خروج</Text>
       </TouchableOpacity>
       <Text style={[s.title, { color: colors.gold }]}>💳 إدارة بطاقاتك</Text>
       <View style={{flexDirection:'row', gap:10, alignItems:'center'}}>
         <TouchableOpacity onPress={toggleTheme}>
           <Text style={s.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
         </TouchableOpacity>
         {isAdmin && (
           <TouchableOpacity onPress={() => navigation.navigate('Admin')}>
             <Text style={s.adminBtn}>🛡️</Text>
           </TouchableOpacity>
         )}
         {tab === 'clients' && (
           <TouchableOpacity onPress={openAdd}>
             <Text style={[s.addH, { color: colors.gold }]}>＋</Text>
           </TouchableOpacity>
         )}
       </View>
     </View>

     {/* تحذير انتهاء الاشتراك */}
     {subDays && subDays <= 7 && subDays > 0 && subDays < 9999 && (
       <View style={s.subWarn}>
         <Text style={s.subWarnT}>⚠️ اشتراكك ينتهي خلال {subDays} أيام — تواصل مع المسؤول للتجديد</Text>
       </View>
     )}

     {/* Tabs */}
     <View style={[s.tabs, { backgroundColor: colors.overlay }]}>
       <TouchableOpacity style={[s.tab, tab==='clients' && { backgroundColor: colors.gold }]} onPress={() => setTab('clients')}>
         <Text style={[s.tabT, { color: colors.textMuted }, tab==='clients' && { color: colors.bg, fontWeight:'700' }]}>👥 العملاء</Text>
       </TouchableOpacity>
       <TouchableOpacity style={[s.tab, tab==='stats' && { backgroundColor: colors.gold }]} onPress={() => setTab('stats')}>
         <Text style={[s.tabT, { color: colors.textMuted }, tab==='stats' && { color: colors.bg, fontWeight:'700' }]}>📊 الإحصائيات</Text>
       </TouchableOpacity>
     </View>

     {/* Stats Tab */}
     {tab === 'stats' && (
       <ScrollView style={{flex:1}} contentContainerStyle={{padding:14}}>
         <View style={s.statsGrid}>
           {[
             { i:'👥', v:total, l:'إجمالي العملاء', c:colors.gold },
             { i:'✅', v:booked, l:'تم حجز البطاقة', c:'#2ecc71' },
             { i:'⏳', v:pending, l:'لم يتم الحجز', c:'#f39c12' },
             { i:'🔴', v:sold, l:'تم البيع', c:'#e74c3c' },
             { i:'💰', v:`${totalAmt.toLocaleString('en')} د.ل`, l:'إجمالي المبالغ', c:colors.gold },
           ].map((item, i) => (
             <View key={i} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
               <Text style={s.statI}>{item.i}</Text>
               <Text style={[s.statV, {color:item.c}]}>{item.v}</Text>
               <Text style={[s.statL, { color: colors.textMuted }]}>{item.l}</Text>
             </View>
           ))}
         </View>
         <TouchableOpacity style={s.waBtn}
           onPress={() => Linking.openURL('https://wa.me/218945888844')}>
           <Text style={s.waBtnT}>📱 تواصل مع خدمة العملاء</Text>
         </TouchableOpacity>
       </ScrollView>
     )}

     {/* Clients Tab */}
     {tab === 'clients' && (
       <>
         <View style={s.exportRow}>
           <TouchableOpacity style={[s.exportBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => exportPDF(filtered)}>
             <Text style={[s.exportT, { color: colors.gold }]}>📄 تصدير PDF</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[s.exportBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => exportCSV(clients)}>
             <Text style={[s.exportT, { color: colors.gold }]}>📊 تصدير CSV</Text>
           </TouchableOpacity>
         </View>

         <View style={s.searchRow}>
           <TextInput style={[s.search, { flex:1, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
             placeholder="🔍 بحث بالاسم، الجوال، الرقم الوطني..."
             placeholderTextColor={colors.textMuted}
             value={search} onChangeText={setSearch} />
           <TouchableOpacity style={[s.filterBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => setShowFilters(!showFilters)}>
             <Text style={s.filterBtnT}>⚙️</Text>
           </TouchableOpacity>
         </View>

         {showFilters && (
           <View style={[s.filtersBox, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
             <Text style={[s.filterLabel, { color: colors.textMuted }]}>الفرز:</Text>
             <ScrollView horizontal showsHorizontalScrollIndicator={false}>
               {[
                 {v:'newest', l:'📅 الأحدث'},
                 {v:'oldest', l:'📅 الأقدم'},
                 {v:'booking_asc', l:'📅 حجز ↑'},
                 {v:'booking_desc', l:'📅 حجز ↓'},
               ].map(item => (
                 <TouchableOpacity key={item.v}
                   style={[s.fChip, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, sortBy===item.v && { borderColor: colors.gold, backgroundColor: colors.goldSoft }]}
                   onPress={() => setSortBy(item.v)}>
                   <Text style={[s.fChipT, { color: colors.textMuted }, sortBy===item.v && { color: colors.gold, fontWeight:'700' }]}>{item.l}</Text>
                 </TouchableOpacity>
               ))}
             </ScrollView>

             <Text style={[s.filterLabel, { color: colors.textMuted, marginTop:8 }]}>الحالة:</Text>
             <ScrollView horizontal showsHorizontalScrollIndicator={false}>
               {[
                 {v:'all', l:`الكل (${total})`},
                 {v:'booked', l:`✅ تم (${booked})`},
                 {v:'pending', l:`⏳ انتظار (${pending})`},
                 {v:'sold', l:`🔴 مباع (${sold})`},
               ].map(item => (
                 <TouchableOpacity key={item.v}
                   style={[s.fChip, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, filterStatus===item.v && { borderColor: colors.gold, backgroundColor: colors.goldSoft }]}
                   onPress={() => setFilterStatus(item.v)}>
                   <Text style={[s.fChipT, { color: colors.textMuted }, filterStatus===item.v && { color: colors.gold, fontWeight:'700' }]}>{item.l}</Text>
                 </TouchableOpacity>
               ))}
             </ScrollView>

             {bankNames.length > 0 && (
               <>
                 <Text style={[s.filterLabel, { color: colors.textMuted, marginTop:8 }]}>المصرف:</Text>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                   <TouchableOpacity
                     style={[s.fChip, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, filterBank==='all' && { borderColor: colors.gold, backgroundColor: colors.goldSoft }]}
                     onPress={() => setFilterBank('all')}>
                     <Text style={[s.fChipT, { color: colors.textMuted }, filterBank==='all' && { color: colors.gold, fontWeight:'700' }]}>الكل</Text>
                   </TouchableOpacity>
                   {bankNames.map(b => (
                     <TouchableOpacity key={b}
                       style={[s.fChip, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, filterBank===b && { borderColor: colors.gold, backgroundColor: colors.goldSoft }]}
                       onPress={() => setFilterBank(b)}>
                       <Text style={[s.fChipT, { color: colors.textMuted }, filterBank===b && { color: colors.gold, fontWeight:'700' }]}>{b}</Text>
                     </TouchableOpacity>
                   ))}
                 </ScrollView>
               </>
             )}
           </View>
         )}

         <Text style={[s.resultCount, { color: colors.textMuted }]}>{filtered.length} عميل</Text>

         {loading
           ? <ActivityIndicator color={colors.gold} style={{marginTop:40}} />
           : <FlatList
               data={filtered}
               keyExtractor={c => c.id}
               contentContainerStyle={{padding:14, paddingTop:4}}
               ListEmptyComponent={
                 <View style={s.empty}>
                   <Text style={s.emptyI}>📋</Text>
                   <Text style={[s.emptyT, { color: colors.textMuted }]}>{!clients.length ? 'اضغط + لإضافة أول عميل' : 'لا توجد نتائج'}</Text>
                 </View>
               }
               renderItem={({ item: c }) => (
                 <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }, c.isSold && s.soldCard]}>
                   <TouchableOpacity onPress={() => openView(c)}>
                     <View style={s.cardTop}>
                       <Text style={[s.name, { color: colors.text }]}>{c.name}</Text>
                       {c.isSold
                         ? <View style={[s.badge, s.badgeSold]}><Text style={s.badgeT}>🔴 مباع</Text></View>
                         : c.cardBooked
                         ? <View style={[s.badge, s.badgeOk]}><Text style={s.badgeT}>✅ تم</Text></View>
                         : <View style={[s.badge, s.badgeWarn]}><Text style={s.badgeT}>⏳ انتظار</Text></View>
                       }
                     </View>
                     <Text style={[s.bank, { color: colors.textMuted }]}>{c.bankType==='أخرى'?c.bankTypeOther:c.bankType}</Text>
                     <Text style={[s.phone, { color: colors.textSoft }]}>{c.phone1}</Text>
                     {c.amount?<Text style={[s.amount, { color: colors.gold }]}>{parseFloat(c.amount).toLocaleString('en')} {c.currency}</Text>:null}
                   </TouchableOpacity>

                   {/* ملاحظات قابلة للتعديل المباشر */}
                   <View style={[s.noteBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                     <Text style={[s.noteLabel, { color: colors.textMuted }]}>📝 ملاحظات</Text>
                     <TextInput
                       style={[s.noteInput, { color: colors.text }]}
                       placeholder="أضف ملاحظة..."
                       placeholderTextColor={colors.textMuted}
                       value={getNoteValue(c)}
                       onChangeText={(t) => handleNoteChange(c.id, t)}
                       multiline
                       textAlignVertical="top"
                     />
                     {isNoteChanged(c) && (
                       <TouchableOpacity
                         style={[s.noteSaveBtn, { backgroundColor: colors.gold }]}
                         onPress={() => handleSaveNote(c)}
                         disabled={!!noteSaving[c.id]}>
                         {noteSaving[c.id]
                           ? <ActivityIndicator color={colors.bg} size="small" />
                           : <Text style={[s.noteSaveBtnT, { color: colors.bg }]}>💾 حفظ الملاحظة</Text>}
                       </TouchableOpacity>
                     )}
                   </View>

                   <View style={s.actions}>
                     <TouchableOpacity style={[s.editBtn, { backgroundColor: colors.goldSoft, borderColor: colors.borderSoft }]} onPress={() => openEdit(c)}>
                       <Text style={[s.editT, { color: colors.gold }]}>✏️ تعديل</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={s.pdfBtn} onPress={() => exportPDF(clients, c)}>
                       <Text style={s.pdfT}>📄 PDF</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(c)}>
                       <Text style={s.delT}>🗑 حذف</Text>
                     </TouchableOpacity>
                   </View>
                 </View>
               )}
             />
         }

         <TouchableOpacity style={[s.fab, { backgroundColor: colors.gold }]} onPress={openAdd}>
           <Text style={[s.fabT, { color: colors.bg }]}>＋</Text>
         </TouchableOpacity>
       </>
     )}

     {/* View Modal */}
     <Modal visible={modal==='view'} animationType="slide">
       <View style={[s.modalWrap, { backgroundColor: colors.bg }]}>
         <View style={[s.modalHead, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
           <TouchableOpacity onPress={() => setModal(null)}>
             <Text style={[s.modalClose, { color: colors.textMuted }]}>✕</Text>
           </TouchableOpacity>
           <Text style={[s.modalTitle, { color: colors.gold }]}>👤 {sel?.name}</Text>
           <TouchableOpacity onPress={() => { setModal(null); setTimeout(() => openEdit(sel), 300); }}>
             <Text style={[s.editH, { color: colors.gold }]}>✏️</Text>
           </TouchableOpacity>
         </View>
         <ScrollView style={{flex:1}}>
           {sections.map(section => (
             <View key={section.title} style={[s.viewSection, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
               <Text style={[s.viewSectionTitle, { backgroundColor: colors.goldSoft, color: colors.gold, borderBottomColor: colors.borderSoft }]}>{section.title}</Text>
               {section.rows.map(({ l, v, canCopy }) => (
                 <View key={l} style={[s.viewRow, { borderBottomColor: colors.inputBg }]}>
                   <Text style={[s.viewLabel, { color: colors.textMuted }]}>{l}</Text>
                   <View style={s.viewValWrap}>
                     <Text style={[s.viewVal, { color: colors.text }]} numberOfLines={2}>{v}</Text>
                     {canCopy && v !== '—' && (
                       <TouchableOpacity onPress={() => copy(v, l)} style={[s.copyBtn, { backgroundColor: colors.goldSoft }]}>
                         <Text style={s.copyBtnT}>📋</Text>
                       </TouchableOpacity>
                     )}
                   </View>
                 </View>
               ))}
             </View>
           ))}
           <View style={{height:20}} />
         </ScrollView>
         <View style={[s.modalFoot, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
           <TouchableOpacity style={[s.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => setModal(null)}>
             <Text style={[s.cancelT, { color: colors.textMuted }]}>إغلاق</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[s.saveBtn, {backgroundColor:'#1e40af', flex:1}]}
             onPress={() => exportPDF(clients, sel)}>
             <Text style={s.saveT}>📄 PDF</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[s.saveBtn, {backgroundColor:'#e74c3c', flex:1}]}
             onPress={() => handleDelete(sel)}>
             <Text style={s.saveT}>🗑 حذف</Text>
           </TouchableOpacity>
         </View>
       </View>
     </Modal>

     {/* Bank Modal */}
     <Modal visible={bankModal} animationType="slide" transparent>
       <View style={s.bankModalOverlay}>
         <View style={[s.bankModalWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
           <View style={[s.bankModalHead, { borderBottomColor: colors.inputBg }]}>
             <Text style={[s.bankModalTitle, { color: colors.gold }]}>🏦 اختر المصرف</Text>
             <TouchableOpacity onPress={() => setBankModal(false)}>
               <Text style={[s.modalClose, { color: colors.textMuted }]}>✕</Text>
             </TouchableOpacity>
           </View>
           <ScrollView>
             {BANKS.map(b => (
               <TouchableOpacity key={b}
                 style={[s.bankOption, { borderBottomColor: colors.inputBg }, form.bankType===b && { backgroundColor: colors.goldSoft }]}
                 onPress={() => { set('bankType', b); setBankModal(false); }}>
                 <Text style={[s.bankOptionT, { color: colors.text }, form.bankType===b && { color: colors.gold, fontWeight:'700' }]}>{b}</Text>
                 {form.bankType===b && <Text style={{color: colors.gold, fontSize:18}}>✓</Text>}
               </TouchableOpacity>
             ))}
           </ScrollView>
         </View>
       </View>
     </Modal>

     {/* Form Modal */}
     <Modal visible={modal==='form'} animationType="slide">
       <View style={[s.modalWrap, { backgroundColor: colors.bg }]}>
         <View style={[s.modalHead, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
           <TouchableOpacity onPress={handleCancel}>
             <Text style={[s.modalClose, { color: colors.textMuted }]}>✕</Text>
           </TouchableOpacity>
           <Text style={[s.modalTitle, { color: colors.gold }]}>{sel ? '✏️ تعديل عميل' : '➕ إضافة عميل'}</Text>
           <View style={{width:30}} />
         </View>
         <ScrollView style={{padding:16}}>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>الاسم الكامل *</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
               placeholder="اسم العميل" placeholderTextColor={colors.textMuted}
               value={form.name} onChangeText={v => set('name', v)} />
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>المصرف *</Text>
             <TouchableOpacity
               style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, justifyContent:'space-between', flexDirection:'row', alignItems:'center', paddingVertical:14}]}
               onPress={() => setBankModal(true)}>
               <Text style={{color:form.bankType?colors.text:colors.textMuted, fontSize:15}}>
                 {form.bankType || 'اختر المصرف ▼'}
               </Text>
               <Text style={{color:colors.textMuted}}>▼</Text>
             </TouchableOpacity>
             {form.bankType === 'أخرى' && (
               <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, marginTop:8}]}
                 placeholder="اكتب اسم المصرف" placeholderTextColor={colors.textMuted}
                 value={form.bankTypeOther||''} onChangeText={v => set('bankTypeOther', v)} />
             )}
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>رقم الهاتف 1 *</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
               placeholder="0912345678" placeholderTextColor={colors.textMuted}
               value={form.phone1} onChangeText={v => set('phone1', v)}
               keyboardType="phone-pad" />
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>رقم الهاتف 2</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
               placeholder="اختياري" placeholderTextColor={colors.textMuted}
               value={form.phone2} onChangeText={v => set('phone2', v)}
               keyboardType="phone-pad" />
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>الرقم الوطني *</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
               placeholder="الرقم الوطني" placeholderTextColor={colors.textMuted}
               value={form.nationalId} onChangeText={v => set('nationalId', v)}
               keyboardType="number-pad" />
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>جواز السفر</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
               placeholder="اختياري" placeholderTextColor={colors.textMuted}
               value={form.passportId||''} onChangeText={v => set('passportId', v)} />
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>رقم الحساب</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
               placeholder="اختياري" placeholderTextColor={colors.textMuted}
               value={form.accountNumber||''} onChangeText={v => set('accountNumber', v)} />
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>رقم IBAN</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
               placeholder="اختياري" placeholderTextColor={colors.textMuted}
               value={form.iban||''} onChangeText={v => set('iban', v.toUpperCase())}
               autoCapitalize="characters" />
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>المبلغ المدفوع</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
               placeholder="0.00" placeholderTextColor={colors.textMuted}
               value={form.amount} onChangeText={v => set('amount', v)}
               keyboardType="decimal-pad" />
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>العملة</Text>
             <View style={{flexDirection:'row', gap:8}}>
               {['د.ل','USD'].map(c => (
                 <TouchableOpacity key={c} style={[s.chip, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, form.currency===c && { borderColor: colors.gold, backgroundColor: colors.goldSoft }]}
                   onPress={() => set('currency', c)}>
                   <Text style={[s.chipT, { color: colors.textMuted }, form.currency===c && { color: colors.gold, fontWeight:'700' }]}>{c}</Text>
                 </TouchableOpacity>
               ))}
             </View>
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>تم الشراء من طرف</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
               placeholder="اسم الموظف" placeholderTextColor={colors.textMuted}
               value={form.purchasedBy} onChangeText={v => set('purchasedBy', v)} />
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>نوع الحجز</Text>
             <View style={{flexDirection:'row', gap:8}}>
               {['كاش','حوالة','بطاقة'].map(t => (
                 <TouchableOpacity key={t} style={[s.chip, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, form.paymentType===t && { borderColor: colors.gold, backgroundColor: colors.goldSoft }]}
                   onPress={() => set('paymentType', t)}>
                   <Text style={[s.chipT, { color: colors.textMuted }, form.paymentType===t && { color: colors.gold, fontWeight:'700' }]}>{t}</Text>
                 </TouchableOpacity>
               ))}
             </View>
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>تاريخ الحجز</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
               placeholder="2026-01-01" placeholderTextColor={colors.textMuted}
               value={form.bookingDate} onChangeText={v => set('bookingDate', v)} />
           </View>

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>الرقم السري</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, letterSpacing:8, textAlign:'center', fontSize:20}]}
               placeholder="1234" placeholderTextColor={colors.textMuted}
               value={form.pinCode} onChangeText={v => set('pinCode', v.replace(/[^0-9]/g,'').slice(0,4))}
               keyboardType="number-pad" maxLength={4} />
           </View>

           <TouchableOpacity style={s.chk} onPress={() => set('cardBooked', !form.cardBooked)}>
             <Text style={s.chkBox}>{form.cardBooked?'✅':'⬜'}</Text>
             <Text style={[s.chkL, { color: colors.textSoft }]}>تم حجز البطاقة</Text>
           </TouchableOpacity>

           <TouchableOpacity style={s.chk} onPress={() => set('isSold', !form.isSold)}>
             <Text style={s.chkBox}>{form.isSold?'✅':'⬜'}</Text>
             <Text style={[s.chkL, { color: colors.textSoft }]}>تم بيع البطاقة</Text>
           </TouchableOpacity>

           {form.isSold && (
             <View style={s.fg}>
               <Text style={[s.label, { color: colors.textSoft }]}>بيعت إلى</Text>
               <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                 placeholder="اسم المشتري" placeholderTextColor={colors.textMuted}
                 value={form.soldTo||''} onChangeText={v => set('soldTo', v)} />
             </View>
           )}

           <View style={s.fg}>
             <Text style={[s.label, { color: colors.textSoft }]}>ملاحظات</Text>
             <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text, height:80}]}
               placeholder="ملاحظات إضافية" placeholderTextColor={colors.textMuted}
               value={form.notes} onChangeText={v => set('notes', v)}
               multiline textAlignVertical="top" />
           </View>

           <View style={{height:40}} />
         </ScrollView>

         <View style={[s.modalFoot, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
           <TouchableOpacity style={[s.cancelBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={handleCancel}>
             <Text style={[s.cancelT, { color: colors.textMuted }]}>إلغاء</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.gold }]} onPress={handleSave} disabled={saving}>
             {saving?<ActivityIndicator color={colors.bg}/>:<Text style={[s.saveT, { color: colors.bg }]}>💾 حفظ</Text>}
           </TouchableOpacity>
         </View>
       </View>
     </Modal>
   </View>
 );
}

const s = StyleSheet.create({
 wrap:             { flex:1 },
 header:           { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingTop:50, borderBottomWidth:1 },
 title:            { fontSize:15, fontWeight:'900' },
 logout:           { fontSize:13 },
 addH:             { fontSize:24, fontWeight:'700' },
 adminBtn:         { fontSize:22 },
 themeIcon:        { fontSize:18 },
 editH:            { fontSize:16 },
 subWarn:          { backgroundColor:'rgba(243,156,18,0.1)', borderWidth:1, borderColor:'rgba(243,156,18,0.3)', borderRadius:10, margin:12, marginBottom:0, padding:10 },
 subWarnT:         { color:'#f39c12', fontSize:12, textAlign:'center' },
 tabs:             { flexDirection:'row', margin:12, borderRadius:10, padding:3 },
 tab:              { flex:1, padding:8, borderRadius:7, alignItems:'center' },
 tabT:             { fontSize:13, fontWeight:'600' },
 statsGrid:        { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:16 },
 statCard:         { width:'47%', borderRadius:12, padding:14, alignItems:'center', borderWidth:1 },
 statI:            { fontSize:24, marginBottom:6 },
 statV:            { fontSize:22, fontWeight:'900' },
 statL:            { fontSize:11, marginTop:3, textAlign:'center' },
 waBtn:            { backgroundColor:'rgba(37,211,102,0.1)', borderWidth:1, borderColor:'rgba(37,211,102,0.3)', borderRadius:12, padding:14, alignItems:'center', marginTop:8 },
 waBtnT:           { color:'#25D366', fontSize:14, fontWeight:'700' },
 exportRow:        { flexDirection:'row', gap:8, marginHorizontal:14, marginBottom:8, marginTop:4 },
 exportBtn:        { borderRadius:10, paddingHorizontal:16, paddingVertical:9, borderWidth:1, flex:1, alignItems:'center' },
 exportT:          { fontSize:13, fontWeight:'700' },
 searchRow:        { flexDirection:'row', alignItems:'center', marginHorizontal:14, marginBottom:4, gap:8 },
 search:           { borderRadius:10, padding:12, borderWidth:1, textAlign:'right' },
 filterBtn:        { borderRadius:10, padding:12, borderWidth:1 },
 filterBtnT:       { fontSize:18 },
 filtersBox:       { marginHorizontal:14, borderRadius:12, padding:12, marginBottom:8, borderWidth:1 },
 filterLabel:      { fontSize:11, marginBottom:6, fontWeight:'600' },
 fChip:            { paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:1, marginLeft:6 },
 fChipT:           { fontSize:12 },
 resultCount:      { fontSize:11, marginHorizontal:14, marginBottom:4 },
 card:             { borderRadius:12, padding:14, marginBottom:10, borderWidth:1 },
 soldCard:         { opacity:0.5 },
 cardTop:          { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6 },
 name:             { fontSize:15, fontWeight:'700', flex:1, marginLeft:8 },
 bank:             { fontSize:12, marginBottom:2 },
 phone:            { fontSize:12, marginBottom:2 },
 amount:           { fontSize:13, fontWeight:'700', marginBottom:8 },
 noteBox:          { marginTop:8, marginBottom:8, borderRadius:10, padding:10, borderWidth:1 },
 noteLabel:        { fontSize:11, marginBottom:6, fontWeight:'600' },
 noteInput:        { fontSize:13, minHeight:36, textAlign:'right', padding:0 },
 noteSaveBtn:      { borderRadius:8, paddingVertical:8, alignItems:'center', marginTop:8 },
 noteSaveBtnT:     { fontSize:12, fontWeight:'700' },
 actions:          { flexDirection:'row', gap:8, marginTop:6 },
 editBtn:          { borderRadius:8, paddingHorizontal:12, paddingVertical:6, borderWidth:1 },
 editT:            { fontSize:12, fontWeight:'600' },
 pdfBtn:           { backgroundColor:'rgba(30,64,175,0.1)', borderRadius:8, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:'rgba(30,64,175,0.3)' },
 pdfT:             { color:'#60a5fa', fontSize:12, fontWeight:'600' },
 delBtn:           { backgroundColor:'rgba(231,76,60,0.1)', borderRadius:8, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:'rgba(231,76,60,0.3)' },
 delT:             { color:'#e74c3c', fontSize:12, fontWeight:'600' },
 badge:            { borderRadius:20, paddingHorizontal:8, paddingVertical:3 },
 badgeOk:          { backgroundColor:'rgba(46,204,113,0.1)', borderWidth:1, borderColor:'rgba(46,204,113,0.3)' },
 badgeWarn:        { backgroundColor:'rgba(243,156,18,0.1)', borderWidth:1, borderColor:'rgba(243,156,18,0.3)' },
 badgeSold:        { backgroundColor:'rgba(231,76,60,0.1)', borderWidth:1, borderColor:'rgba(231,76,60,0.3)' },
 badgeT:           { fontSize:11, fontWeight:'700', color:'#f8f6f0' },
 empty:            { alignItems:'center', paddingTop:60 },
 emptyI:           { fontSize:40, opacity:0.3, marginBottom:10 },
 emptyT:           { fontSize:13 },
 fab:              { position:'absolute', bottom:30, left:20, width:56, height:56, borderRadius:28, alignItems:'center', justifyContent:'center', elevation:5 },
 fabT:             { fontSize:28, fontWeight:'700', marginTop:-2 },
 viewSection:      { borderRadius:12, marginHorizontal:14, marginBottom:8, borderWidth:1, overflow:'hidden' },
 viewSectionTitle: { padding:12, fontSize:13, fontWeight:'700', borderBottomWidth:1 },
 viewRow:          { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:14, paddingVertical:10, borderBottomWidth:1 },
 viewLabel:        { fontSize:12, width:110, flexShrink:0 },
 viewValWrap:      { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'flex-end', gap:6 },
 viewVal:          { fontSize:13, fontWeight:'500', flex:1, textAlign:'right' },
 copyBtn:          { borderRadius:6, padding:4 },
 copyBtnT:         { fontSize:12 },
 bankModalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'flex-end' },
 bankModalWrap:    { borderRadius:20, maxHeight:'70%', borderWidth:1 },
 bankModalHead:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1 },
 bankModalTitle:   { fontSize:16, fontWeight:'700' },
 bankOption:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1 },
 bankOptionT:      { fontSize:15 },
 modalWrap:        { flex:1 },
 modalHead:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, borderBottomWidth:1 },
 modalTitle:       { fontSize:16, fontWeight:'900' },
 modalClose:       { fontSize:18, padding:4 },
 modalFoot:        { flexDirection:'row', gap:8, padding:16, borderTopWidth:1 },
 fg:               { marginBottom:14 },
 label:            { fontSize:12, marginBottom:5, fontWeight:'500' },
 input:            { borderWidth:1.5, borderRadius:10, padding:12, fontSize:15, textAlign:'right' },
 chip:             { paddingHorizontal:14, paddingVertical:8, borderRadius:20, borderWidth:1.5, marginLeft:8 },
 chipT:            { fontSize:13 },
 chk:              { flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 },
 chkBox:           { fontSize:20 },
 chkL:             { fontSize:14 },
 cancelBtn:        { flex:1, borderRadius:10, padding:14, alignItems:'center', borderWidth:1 },
 cancelT:          { fontSize:15 },
 saveBtn:          { flex:2, borderRadius:10, padding:14, alignItems:'center' },
 saveT:            { color:'#f8f6f0', fontSize:15, fontWeight:'700' },
});

