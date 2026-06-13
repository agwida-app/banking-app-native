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
 reauthenticateWithCredential
} from 'firebase/auth';
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
     `العميل: ${sub.usedByEmail || 'غير مفعّل'}\n\n📦 الباقة: ${plan.label}\n💵 السعر: $${plan.price}\n📅 ينتهي: ${addTime(plan.months, plan.days).toLocaleDateString('ar-LY')}`,
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

 return (
   <View style={s.wrap}>
     {/* Header */}
     <View style={s.header}>
       <TouchableOpacity onPress={() => navigation.navigate('Home')}>
         <Text style={s.homeBtn}>👥 العملاء</Text>
       </TouchableOpacity>
       <Text style={s.title}>🛡️ لوحة المدير</Text>
       <TouchableOpacity onPress={() => setModal('pw')}>
         <Text style={s.pwBtn}>🔑</Text>
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
           <Text style={s.count}>
             الكل: {subs.length} | مفعّلة: {subs.filter(s => s.usedBy && daysLeft(s.expiresAt) > 0).length} | متاحة: {subs.filter(s => !s.usedBy).length} | منتهية: {subs.filter(s => daysLeft(s.expiresAt) <= 0).length}
           </Text>
           <TouchableOpacity style={s.addBtn} onPress={() => setModal('sub')}>
             <Text style={s.addT}>＋ كود جديد</Text>
           </TouchableOpacity>
         </>
       )}
       {tab === 'affiliates' && (
         <>
           <Text style={s.count}>المسوّقون: {affiliates.length} | إجمالي الإحالات: {affiliates.reduce((s,a) => s+(a.totalReferrals||0), 0)}</Text>
           <TouchableOpacity style={s.addBtn} onPress={() => setModal('aff')}>
             <Text style={s.addT}>＋ مسوّق جديد</Text>
           </TouchableOpacity>
         </>
       )}
     </View>

     {/* Subs List */}
     {tab === 'subs' && (
       loading
         ? <ActivityIndicator color="#c9a84c" style={{marginTop:40}} />
         : <FlatList
             data={subs}
             keyExtractor={s => s.id}
             contentContainerStyle={{padding:14}}
             ListEmptyComponent={<Text style={s.empty}>لا يوجد اشتراكات بعد</Text>}
             renderItem={({ item: sub }) => {
               const days = daysLeft(sub.expiresAt);
               const isActive = sub.usedBy && days > 0;
               const isExpired = days <= 0;
               const isFree = !sub.usedBy && !isExpired;
               const deviceList = Object.entries(sub.devices || {});
               const deviceCount = deviceList.length;
               return (
                 <View style={s.card}>
                   <View style={s.cardTop}>
                     <View style={{flexDirection:'row', alignItems:'center', gap:8, flex:1}}>
                       <Text style={s.code}>{sub.code || sub.id}</Text>
                       <TouchableOpacity onPress={() => copy(sub.code || sub.id, 'الكود')}>
                         <Text style={{fontSize:16}}>📋</Text>
                       </TouchableOpacity>
                     </View>
                     <View style={[s.chip, isActive ? s.chipOk : isFree ? s.chipFree : s.chipExp]}>
                       <Text style={s.chipT}>{isActive ? '✅ مفعّل' : isFree ? '🔓 متاح' : '❌ منتهي'}</Text>
                     </View>
                   </View>

                   <Text style={s.meta}>📅 ينتهي: {fmt(sub.expiresAt)} ({days > 0 ? `${days} يوم` : 'منتهي'})</Text>
                   {sub.usedByEmail && <Text style={s.meta}>👤 {sub.usedByEmail}</Text>}
                   {sub.planLabel && <Text style={s.meta}>📦 {sub.planLabel}</Text>}
                   {sub.maxClients && <Text style={s.meta}>👥 الحد: {sub.maxClients} عميل</Text>}
                   {sub.notes && <Text style={s.meta}>📝 {sub.notes}</Text>}

                   {/* الأجهزة */}
                   <TouchableOpacity
                     style={s.devicesBadge}
                     onPress={() => setSelDevices(selDevices === sub.id ? null : sub.id)}>
                     <Text style={s.devicesBadgeT}>📱 الأجهزة: {deviceCount}/7</Text>
                     <Text style={{color:'#c9a84c', fontSize:12}}>{selDevices === sub.id ? '▲' : '▼'}</Text>
                   </TouchableOpacity>

                   {selDevices === sub.id && (
                     <View style={s.devicesBox}>
                       {deviceList.length === 0
                         ? <Text style={s.meta}>لا يوجد أجهزة مسجلة</Text>
                         : deviceList.map(([id, d], i) => (
                           <View key={id} style={s.deviceRow}>
                             <Text style={s.deviceIcon}>{d.type?.includes('iPhone') ? '📱' : d.type?.includes('iPad') ? '📱' : '📱'}</Text>
                             <View style={{flex:1}}>
                               <Text style={s.deviceType}>{d.type || 'جهاز غير معروف'}</Text>
                               <Text style={s.deviceDate}>آخر ظهور: {fmtDate(d.lastSeen)}</Text>
                               {d.email && <Text style={s.deviceEmail}>{d.email}</Text>}
                             </View>
                             <Text style={s.deviceNum}>{i+1}</Text>
                           </View>
                         ))
                       }
                     </View>
                   )}

                   <View style={s.btnRow}>
                     <TouchableOpacity style={s.actionBtn} onPress={() => copyWelcome(sub)}>
                       <Text style={s.actionT}>✉️ رسالة</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={[s.actionBtn, {borderColor:'rgba(201,168,76,0.3)'}]}
                       onPress={() => setRenewModal(sub)}>
                       <Text style={[s.actionT, {color:'#c9a84c'}]}>🔄 تجديد</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={s.actionBtn} onPress={() => resetPassword(sub.usedByEmail)}>
                       <Text style={s.actionT}>🔑 كلمة مرور</Text>
                     </TouchableOpacity>
                   </View>
                   <View style={[s.btnRow, {marginTop:6}]}>
                     <TouchableOpacity style={s.actionBtn} onPress={() => resetDevices(sub)}>
                       <Text style={s.actionT}>📱 إعادة ضبط الأجهزة</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={[s.actionBtn, s.delBtnStyle]} onPress={() => deleteSub(sub.id)}>
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
         ListEmptyComponent={<Text style={s.empty}>لا يوجد مسوّقون بعد</Text>}
         renderItem={({ item: aff }) => {
           const affPays = payments[aff.id] || [];
           const totalPaid = affPays.reduce((s, p) => s + (p.amount || 0), 0);
           return (
             <View style={s.card}>
               <View style={s.cardTop}>
                 <Text style={s.code}>{aff.name}</Text>
                 <TouchableOpacity style={s.chipFree2} onPress={() => copy(aff.code, 'كود الإحالة')}>
                   <Text style={s.chipT}>📋 {aff.code}</Text>
                 </TouchableOpacity>
               </View>
               {aff.handle && <Text style={s.meta}>@{aff.handle}</Text>}
               <Text style={s.meta}>💹 العمولة: {aff.commissionPct}%</Text>
               <Text style={s.meta}>📊 الإحالات: {aff.totalReferrals || 0}</Text>
               <Text style={s.meta}>💵 المدفوع: ${totalPaid.toLocaleString('en')}</Text>
               {aff.notes && <Text style={s.meta}>📝 {aff.notes}</Text>}

               <View style={s.btnRow}>
                 <TouchableOpacity style={[s.actionBtn, {borderColor:'rgba(46,204,113,0.3)'}]}
                   onPress={() => { setPayModal(aff); setPayForm({ amount:'', note:'', date: new Date().toISOString().split('T')[0] }); }}>
                   <Text style={[s.actionT, {color:'#2ecc71'}]}>💰 دفعة</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={s.actionBtn}
                   onPress={() => setSelAff(selAff?.id === aff.id ? null : aff)}>
                   <Text style={s.actionT}>📜 السجل ({affPays.length})</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={[s.actionBtn, s.delBtnStyle]} onPress={() => deleteAff(aff.id)}>
                   <Text style={[s.actionT, {color:'#e74c3c'}]}>🗑 حذف</Text>
                 </TouchableOpacity>
               </View>

               {selAff?.id === aff.id && (
                 <View style={{marginTop:12, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.05)', paddingTop:12}}>
                   <Text style={[s.meta, {color:'#c9a84c', marginBottom:8}]}>📜 سجل الدفعات</Text>
                   {affPays.length === 0
                     ? <Text style={[s.meta, {textAlign:'center'}]}>لا يوجد دفعات بعد</Text>
                     : affPays.map(p => (
                         <View key={p.id} style={{flexDirection:'row', justifyContent:'space-between', padding:8, backgroundColor:'rgba(255,255,255,0.03)', borderRadius:8, marginBottom:4}}>
                           <Text style={{color:'#2ecc71', fontSize:13, fontWeight:'700'}}>${(p.amount||0).toLocaleString('en')}</Text>
                           <Text style={{color:'#8a9ab5', fontSize:11}}>{p.date} · {p.note}</Text>
                         </View>
                       ))
                   }
                   <Text style={[s.meta, {color:'#c9a84c', marginTop:6}]}>المجموع: ${totalPaid.toLocaleString('en')}</Text>
                 </View>
               )}
             </View>
           );
         }}
       />
     )}

     {/* Modal: تجديد */}
     <Modal visible={!!renewModal} animationType="slide">
       <View style={s.modalWrap}>
         <View style={s.modalHead}>
           <TouchableOpacity onPress={() => setRenewModal(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
           <Text style={s.modalTitle}>🔄 تجديد الاشتراك</Text>
           <View style={{width:30}} />
         </View>
         <ScrollView style={{padding:16}}>
           {renewModal && (
             <View style={s.renewInfo}>
               <Text style={s.renewInfoT}>👤 {renewModal.usedByEmail || 'غير مفعّل'}</Text>
               <Text style={s.renewInfoT}>📅 ينتهي حاليا: {fmt(renewModal.expiresAt)}</Text>
             </View>
           )}
           <Text style={[s.label, {marginBottom:12, fontSize:14}]}>اختر الباقة الجديدة:</Text>
           {PLANS.map(plan => (
             <TouchableOpacity key={plan.id} style={s.planCard}
               onPress={() => renewModal && confirmRenew(renewModal, plan)}>
               <View style={s.planCardLeft}>
                 <Text style={s.planCardLabel}>{plan.label}</Text>
                 <Text style={s.planCardDate}>📅 ينتهي: {addTime(plan.months, plan.days).toLocaleDateString('ar-LY')}</Text>
               </View>
               <Text style={s.planCardPrice}>${plan.price}</Text>
             </TouchableOpacity>
           ))}
         </ScrollView>
         <View style={s.modalFoot}>
           <TouchableOpacity style={s.cancelBtn} onPress={() => setRenewModal(null)}>
             <Text style={s.cancelT}>إلغاء</Text>
           </TouchableOpacity>
         </View>
       </View>
     </Modal>

     {/* Modal: تغيير كلمة المرور */}
     <Modal visible={modal === 'pw'} animationType="slide">
       <View style={s.modalWrap}>
         <View style={s.modalHead}>
           <TouchableOpacity onPress={() => { setModal(null); setPwForm({ current:'', newPw:'', confirm:'' }); }}>
             <Text style={s.modalClose}>✕</Text>
           </TouchableOpacity>
           <Text style={s.modalTitle}>🔑 تغيير كلمة المرور</Text>
           <View style={{width:30}} />
         </View>
         <ScrollView style={{padding:16}}>
           <Text style={s.meta2}>البريد الإلكتروني: {auth.currentUser?.email}</Text>

           <Text style={s.label}>كلمة المرور الحالية *</Text>
           <TextInput style={[s.input, {marginBottom:14}]}
             placeholder="••••••••" placeholderTextColor="#8a9ab5"
             value={pwForm.current}
             onChangeText={v => setPwForm(f => ({...f, current:v}))}
             secureTextEntry />

           <Text style={s.label}>كلمة المرور الجديدة *</Text>
           <TextInput style={[s.input, {marginBottom:14}]}
             placeholder="6 أحرف على الأقل" placeholderTextColor="#8a9ab5"
             value={pwForm.newPw}
             onChangeText={v => setPwForm(f => ({...f, newPw:v}))}
             secureTextEntry />

           <Text style={s.label}>تأكيد كلمة المرور الجديدة *</Text>
           <TextInput style={[s.input, {marginBottom:20}]}
             placeholder="••••••••" placeholderTextColor="#8a9ab5"
             value={pwForm.confirm}
             onChangeText={v => setPwForm(f => ({...f, confirm:v}))}
             secureTextEntry />
         </ScrollView>
         <View style={s.modalFoot}>
           <TouchableOpacity style={s.cancelBtn} onPress={() => { setModal(null); setPwForm({ current:'', newPw:'', confirm:'' }); }}>
             <Text style={s.cancelT}>إلغاء</Text>
           </TouchableOpacity>
           <TouchableOpacity style={s.saveBtn} onPress={changePassword} disabled={saving}>
             {saving ? <ActivityIndicator color="#0a1628" /> : <Text style={s.saveT}>💾 حفظ</Text>}
           </TouchableOpacity>
         </View>
       </View>
     </Modal>

     {/* Modal: كود جديد */}
     <Modal visible={modal === 'sub'} animationType="slide">
       <View style={s.modalWrap}>
         <View style={s.modalHead}>
           <TouchableOpacity onPress={() => setModal(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
           <Text style={s.modalTitle}>➕ كود اشتراك جديد</Text>
           <View style={{width:30}} />
         </View>
         <ScrollView style={{padding:16}}>
           <Text style={s.label}>كود التفعيل</Text>
           <View style={{flexDirection:'row', gap:8, marginBottom:14}}>
             <TextInput style={[s.input, {flex:1, letterSpacing:3, textAlign:'center'}]}
               value={form.code}
               onChangeText={v => setForm(f => ({...f, code:v.toUpperCase()}))}
               autoCapitalize="characters" autoCorrect={false} />
             <TouchableOpacity style={s.genBtn} onPress={() => setForm(f => ({...f, code:genCode()}))}>
               <Text style={s.genT}>🎲</Text>
             </TouchableOpacity>
             <TouchableOpacity style={s.genBtn} onPress={() => copy(form.code, 'الكود')}>
               <Text style={s.genT}>📋</Text>
             </TouchableOpacity>
           </View>

           <Text style={s.label}>الباقة</Text>
           {PLANS.map(p => (
             <TouchableOpacity key={p.id}
               style={[s.planCard, form.plan === p.id && s.planCardOn]}
               onPress={() => setForm(f => ({...f, plan:p.id}))}>
               <View style={s.planCardLeft}>
                 <Text style={[s.planCardLabel, form.plan === p.id && {color:'#c9a84c'}]}>{p.label}</Text>
                 <Text style={s.planCardDate}>📅 ينتهي: {addTime(p.months, p.days).toLocaleDateString('ar-LY')}</Text>
               </View>
               <View style={{alignItems:'flex-end', gap:4}}>
                 <Text style={[s.planCardPrice, form.plan === p.id && {color:'#c9a84c'}]}>${p.price}</Text>
                 {form.plan === p.id && <Text style={{color:'#c9a84c'}}>✓</Text>}
               </View>
             </TouchableOpacity>
           ))}

           <Text style={[s.label, {marginTop:14}]}>الحد الأقصى للعملاء</Text>
           <TextInput style={[s.input, {marginBottom:14}]}
             value={form.maxClients}
             onChangeText={v => setForm(f => ({...f, maxClients:v}))}
             keyboardType="number-pad" />

           <Text style={s.label}>ملاحظة</Text>
           <TextInput style={[s.input, {marginBottom:20}]}
             value={form.notes}
             onChangeText={v => setForm(f => ({...f, notes:v}))}
             placeholder="اسم العميل مثلاً"
             placeholderTextColor="#8a9ab5" />
         </ScrollView>
         <View style={s.modalFoot}>
           <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(null)}>
             <Text style={s.cancelT}>إلغاء</Text>
           </TouchableOpacity>
           <TouchableOpacity style={s.saveBtn} onPress={createSub} disabled={saving}>
             {saving ? <ActivityIndicator color="#0a1628" /> : <Text style={s.saveT}>💾 حفظ</Text>}
           </TouchableOpacity>
         </View>
       </View>
     </Modal>

     {/* Modal: مسوّق جديد */}
     <Modal visible={modal === 'aff'} animationType="slide">
       <View style={s.modalWrap}>
         <View style={s.modalHead}>
           <TouchableOpacity onPress={() => setModal(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
           <Text style={s.modalTitle}>🤝 مسوّق جديد</Text>
           <View style={{width:30}} />
         </View>
         <ScrollView style={{padding:16}}>
           <Text style={s.label}>اسم المسوّق *</Text>
           <TextInput style={[s.input, {marginBottom:14}]}
             placeholder="مثال: محمد الغانم" placeholderTextColor="#8a9ab5"
             value={affForm.name}
             onChangeText={v => setAffForm(f => ({...f, name:v}))} />

           <Text style={s.label}>كود الإحالة *</Text>
           <View style={{flexDirection:'row', gap:8, marginBottom:14}}>
             <TextInput style={[s.input, {flex:1, letterSpacing:2, textAlign:'center'}]}
               placeholder="MOHAMAD10" placeholderTextColor="#8a9ab5"
               value={affForm.code}
               onChangeText={v => setAffForm(f => ({...f, code:v.toUpperCase().replace(/\s/g,'')}))}
               autoCapitalize="characters" autoCorrect={false} />
             <TouchableOpacity style={s.genBtn}
               onPress={() => setAffForm(f => ({...f, code:genAffCode(f.name||'AFF')}))}>
               <Text style={s.genT}>🎲</Text>
             </TouchableOpacity>
           </View>

           <Text style={s.label}>اسم الحساب (يوتيوب/انستغرام)</Text>
           <TextInput style={[s.input, {marginBottom:14}]}
             placeholder="mohamad_yt" placeholderTextColor="#8a9ab5"
             value={affForm.handle}
             onChangeText={v => setAffForm(f => ({...f, handle:v}))} />

           <Text style={s.label}>نسبة العمولة %</Text>
           <View style={{flexDirection:'row', gap:8, marginBottom:14}}>
             {[10,15,20,25].map(p => (
               <TouchableOpacity key={p}
                 style={[s.planBtn, affForm.commissionPct === p && s.planBtnOn]}
                 onPress={() => setAffForm(f => ({...f, commissionPct:p}))}>
                 <Text style={[s.planT, affForm.commissionPct === p && s.planTOn]}>{p}%</Text>
               </TouchableOpacity>
             ))}
           </View>

           <Text style={s.label}>ملاحظات</Text>
           <TextInput style={[s.input, {marginBottom:20}]}
             placeholder="ملاحظات إضافية" placeholderTextColor="#8a9ab5"
             value={affForm.notes}
             onChangeText={v => setAffForm(f => ({...f, notes:v}))} />
         </ScrollView>
         <View style={s.modalFoot}>
           <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(null)}>
             <Text style={s.cancelT}>إلغاء</Text>
           </TouchableOpacity>
           <TouchableOpacity style={s.saveBtn} onPress={createAffiliate} disabled={saving}>
             {saving ? <ActivityIndicator color="#0a1628" /> : <Text style={s.saveT}>💾 حفظ</Text>}
           </TouchableOpacity>
         </View>
       </View>
     </Modal>

     {/* Modal: دفعة */}
     <Modal visible={!!payModal} animationType="slide">
       <View style={s.modalWrap}>
         <View style={s.modalHead}>
           <TouchableOpacity onPress={() => setPayModal(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
           <Text style={s.modalTitle}>💰 دفعة — {payModal?.name}</Text>
           <View style={{width:30}} />
         </View>
         <ScrollView style={{padding:16}}>
           <Text style={s.label}>المبلغ ($) *</Text>
           <TextInput style={[s.input, {marginBottom:14}]}
             placeholder="0.00" placeholderTextColor="#8a9ab5"
             value={payForm.amount}
             onChangeText={v => setPayForm(f => ({...f, amount:v}))}
             keyboardType="decimal-pad" />

           <Text style={s.label}>التاريخ</Text>
           <TextInput style={[s.input, {marginBottom:14}]}
             value={payForm.date}
             onChangeText={v => setPayForm(f => ({...f, date:v}))} />

           <Text style={s.label}>ملاحظة</Text>
           <TextInput style={[s.input, {marginBottom:20}]}
             placeholder="مثال: دفع عبر تحويل بنكي" placeholderTextColor="#8a9ab5"
             value={payForm.note}
             onChangeText={v => setPayForm(f => ({...f, note:v}))} />
         </ScrollView>
         <View style={s.modalFoot}>
           <TouchableOpacity style={s.cancelBtn} onPress={() => setPayModal(null)}>
             <Text style={s.cancelT}>إلغاء</Text>
           </TouchableOpacity>
           <TouchableOpacity style={s.saveBtn} onPress={addPayment} disabled={saving}>
             {saving ? <ActivityIndicator color="#0a1628" /> : <Text style={s.saveT}>💾 حفظ</Text>}
           </TouchableOpacity>
         </View>
       </View>
     </Modal>
   </View>
 );
}

const s = StyleSheet.create({
 wrap:          { flex:1, backgroundColor:'#0a1628' },
 header:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingTop:50, backgroundColor:'#0f2040', borderBottomWidth:1, borderBottomColor:'rgba(201,168,76,0.2)' },
 title:         { fontSize:16, fontWeight:'900', color:'#c9a84c' },
 homeBtn:       { color:'#c9a84c', fontSize:13, fontWeight:'700' },
 pwBtn:         { fontSize:22 },
 tabs:          { flexDirection:'row', backgroundColor:'rgba(0,0,0,0.2)', margin:12, borderRadius:10, padding:3 },
 tab:           { flex:1, padding:8, borderRadius:7, alignItems:'center' },
 tabOn:         { backgroundColor:'#c9a84c' },
 tabT:          { color:'#8a9ab5', fontSize:13, fontWeight:'600' },
 tabTOn:        { color:'#0a1628', fontWeight:'700' },
 topBar:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:14, marginBottom:4 },
 count:         { fontSize:11, color:'#8a9ab5', flex:1 },
 addBtn:        { backgroundColor:'#c9a84c', borderRadius:10, paddingHorizontal:14, paddingVertical:8 },
 addT:          { color:'#0a1628', fontWeight:'700', fontSize:13 },
 card:          { backgroundColor:'#0f2040', borderRadius:12, padding:14, marginBottom:10, borderWidth:1, borderColor:'rgba(201,168,76,0.15)' },
 cardTop:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
 code:          { fontSize:15, fontWeight:'700', color:'#c9a84c', letterSpacing:1 },
 chip:          { borderRadius:20, paddingHorizontal:10, paddingVertical:4, borderWidth:1 },
 chipOk:        { backgroundColor:'rgba(46,204,113,0.1)', borderColor:'rgba(46,204,113,0.3)' },
 chipFree:      { backgroundColor:'rgba(201,168,76,0.1)', borderColor:'rgba(201,168,76,0.3)' },
 chipFree2:     { backgroundColor:'rgba(201,168,76,0.1)', borderColor:'rgba(201,168,76,0.3)', borderRadius:20, paddingHorizontal:10, paddingVertical:4, borderWidth:1 },
 chipExp:       { backgroundColor:'rgba(231,76,60,0.1)', borderColor:'rgba(231,76,60,0.3)' },
 chipT:         { fontSize:11, fontWeight:'700', color:'#f8f6f0' },
 meta:          { fontSize:12, color:'#8a9ab5', marginBottom:3 },
 meta2:         { fontSize:13, color:'#c5cedd', marginBottom:16, textAlign:'center' },
 devicesBadge:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'rgba(255,255,255,0.04)', borderRadius:8, padding:8, marginTop:8, borderWidth:1, borderColor:'rgba(201,168,76,0.15)' },
 devicesBadgeT: { fontSize:12, color:'#c9a84c', fontWeight:'600' },
 devicesBox:    { backgroundColor:'rgba(0,0,0,0.2)', borderRadius:8, padding:10, marginTop:6 },
 deviceRow:     { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:6, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.05)' },
 deviceIcon:    { fontSize:20 },
 deviceType:    { fontSize:13, color:'#f8f6f0', fontWeight:'600' },
 deviceDate:    { fontSize:11, color:'#8a9ab5', marginTop:2 },
 deviceEmail:   { fontSize:10, color:'#8a9ab5' },
 deviceNum:     { fontSize:11, color:'#8a9ab5', width:20, textAlign:'center' },
 btnRow:        { flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' },
 actionBtn:     { backgroundColor:'rgba(255,255,255,0.05)', borderRadius:8, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
 delBtnStyle:   { borderColor:'rgba(231,76,60,0.3)' },
 actionT:       { fontSize:12, color:'#c5cedd' },
 empty:         { textAlign:'center', color:'#8a9ab5', marginTop:40 },
 planCard:      { backgroundColor:'rgba(255,255,255,0.04)', borderRadius:12, padding:14, marginBottom:10, borderWidth:1.5, borderColor:'rgba(255,255,255,0.1)', flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
 planCardOn:    { borderColor:'#c9a84c', backgroundColor:'rgba(201,168,76,0.08)' },
 planCardLeft:  { flex:1 },
 planCardLabel: { fontSize:15, fontWeight:'700', color:'#f8f6f0', marginBottom:4 },
 planCardDate:  { fontSize:11, color:'#8a9ab5' },
 planCardPrice: { fontSize:18, fontWeight:'900', color:'#2ecc71' },
 renewInfo:     { backgroundColor:'rgba(201,168,76,0.07)', borderRadius:10, padding:12, marginBottom:16, borderWidth:1, borderColor:'rgba(201,168,76,0.2)' },
 renewInfoT:    { fontSize:13, color:'#c5cedd', marginBottom:4 },
 modalWrap:     { flex:1, backgroundColor:'#0a1628' },
 modalHead:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, backgroundColor:'#0f2040', borderBottomWidth:1, borderBottomColor:'rgba(201,168,76,0.2)' },
 modalTitle:    { fontSize:16, fontWeight:'900', color:'#c9a84c' },
 modalClose:    { fontSize:18, color:'#8a9ab5', padding:4 },
 modalFoot:     { flexDirection:'row', gap:12, padding:16, backgroundColor:'#0f2040', borderTopWidth:1, borderTopColor:'rgba(201,168,76,0.2)' },
 label:         { fontSize:12, color:'#c5cedd', marginBottom:6, fontWeight:'500' },
 input:         { backgroundColor:'rgba(255,255,255,0.06)', borderWidth:1.5, borderColor:'rgba(255,255,255,0.1)', borderRadius:10, padding:12, color:'#f8f6f0', fontSize:15, textAlign:'right' },
 genBtn:        { backgroundColor:'rgba(255,255,255,0.06)', borderRadius:10, padding:12, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
 genT:          { fontSize:18 },
 planBtn:       { flex:1, paddingVertical:10, borderRadius:10, borderWidth:1.5, borderColor:'rgba(255,255,255,0.12)', backgroundColor:'rgba(255,255,255,0.05)', alignItems:'center' },
 planBtnOn:     { borderColor:'#c9a84c', backgroundColor:'rgba(201,168,76,0.12)' },
 planT:         { color:'#8a9ab5', fontSize:13, fontWeight:'700' },
 planTOn:       { color:'#c9a84c' },
 cancelBtn:     { flex:1, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:10, padding:14, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
 cancelT:       { color:'#8a9ab5', fontSize:15 },
 saveBtn:       { flex:2, backgroundColor:'#c9a84c', borderRadius:10, padding:14, alignItems:'center' },
 saveT:         { color:'#0a1628', fontSize:15, fontWeight:'700' },
});
