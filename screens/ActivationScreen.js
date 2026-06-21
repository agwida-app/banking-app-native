import { useState } from 'react';
import {
 View, Text, TextInput, TouchableOpacity,
 StyleSheet, ActivityIndicator, Alert, Linking
} from 'react-native';
import { signOut } from 'firebase/auth';
import {
 doc, getDoc, updateDoc, addDoc,
 collection, serverTimestamp, setDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useTheme } from '../ThemeContext';

const COMMISSION_PCT = 10;
const PLANS = [
 { id:'7d', label:'7 أيام', price:5 },
 { id:'1m', label:'شهر', price:10 },
 { id:'3m', label:'3 أشهر', price:30 },
 { id:'6m', label:'6 أشهر', price:60 },
 { id:'12m', label:'12 شهر', price:100 },
];

export default function ActivationScreen({ user, subStatus }) {
 const { colors, isDark, toggleTheme } = useTheme();
 const [code, setCode] = useState('');
 const [refCode, setRefCode] = useState('');
 const [load, setLoad] = useState(false);

 const activate = async () => {
   const trimmed = code.trim().toUpperCase();
   if (!trimmed) { Alert.alert('خطأ', 'أدخل كود التفعيل'); return; }
   setLoad(true);
   try {
     const ref = doc(db, 'subscriptions', trimmed);
     const snap = await getDoc(ref);
     if (!snap.exists()) { Alert.alert('خطأ', 'الكود غير صحيح'); setLoad(false); return; }
     const data = snap.data();
     if (data.usedBy && data.usedBy !== user.uid) { Alert.alert('خطأ', 'هذا الكود مستخدم مسبقاً'); setLoad(false); return; }
     const exp = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
     if (exp < new Date()) { Alert.alert('خطأ', 'هذا الكود منتهي الصلاحية'); setLoad(false); return; }

     // نظام الإحالة
     const refTrimmed = refCode.trim().toUpperCase();
     let bonusMonths = 0;
     if (refTrimmed) {
       const affRef = doc(db, 'affiliates', refTrimmed);
       const affSnap = await getDoc(affRef);
       if (!affSnap.exists()) { Alert.alert('خطأ', 'كود الإحالة غير صحيح'); setLoad(false); return; }
       const affData = affSnap.data();
       const userRef = doc(db, 'users', user.uid);
       const userSnap = await getDoc(userRef);
       if (userSnap.exists() && userSnap.data().usedReferral) {
         Alert.alert('خطأ', 'لقد استخدمت كود إحالة مسبقاً'); setLoad(false); return;
       }
       bonusMonths = 1;
       const plan = PLANS.find(p => p.id === data.plan);
       const commAmount = plan ? Math.round(plan.price * (affData.commissionPct || COMMISSION_PCT) / 100 * 100) / 100 : null;
       await updateDoc(affRef, { totalReferrals: (affData.totalReferrals || 0) + 1 });
       if (commAmount) {
         await addDoc(collection(db, `affiliates/${affSnap.id}/payments`), {
           amount: commAmount,
           note: `عمولة تلقائية — ${user.email}`,
           date: new Date().toISOString().split('T')[0],
           paidBy: 'تلقائي', isAuto: true,
           subscriptionCode: trimmed, createdAt: serverTimestamp()
         });
         await updateDoc(affRef, { totalPaid: (affData.totalPaid || 0) + commAmount });
       }
       await setDoc(doc(db, 'users', user.uid), {
         uid: user.uid, email: user.email,
         usedReferral: true, referralCode: refTrimmed,
         referralUsedAt: serverTimestamp()
       }, { merge: true });
     }

     // تفعيل الكود
     if (bonusMonths > 0) {
       const newExp = new Date(exp);
       newExp.setMonth(newExp.getMonth() + bonusMonths);
       await updateDoc(ref, {
         usedBy: user.uid, usedAt: serverTimestamp(),
         usedByEmail: user.email, expiresAt: newExp,
         planLabel: (data.planLabel || '') + ' + شهر مجاني 🎁'
       });
       Alert.alert('🎉 تم التفعيل', 'مرحباً بك!\nحصلت على شهر مجاني إضافي بفضل كود الإحالة 🎁');
     } else {
       await updateDoc(ref, {
         usedBy: user.uid, usedAt: serverTimestamp(), usedByEmail: user.email
       });
       Alert.alert('✅ تم التفعيل', 'مرحباً بك في إدارة بطاقاتك!');
     }
   } catch (e) { Alert.alert('خطأ', e.message); }
   setLoad(false);
 };

 return (
   <View style={[s.wrap, { backgroundColor: colors.bg }]}>
     <TouchableOpacity style={[s.themeBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={toggleTheme}>
       <Text style={s.themeBtnT}>{isDark ? '☀️' : '🌙'}</Text>
     </TouchableOpacity>

     <Text style={s.logo}>💳</Text>
     <Text style={[s.title, { color: colors.text }]}>تفعيل الاشتراك</Text>
     <Text style={[s.sub, { color: colors.textMuted }]}>{user.email}</Text>

     {subStatus === 'expired' && (
       <View style={s.expBox}>
         <Text style={s.expT}>⚠️ انتهى اشتراكك — تواصل مع المسؤول للتجديد</Text>
       </View>
     )}

     <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
       <Text style={[s.label, { color: colors.textSoft }]}>كود التفعيل *</Text>
       <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
         placeholder="XXXXXXXX"
         placeholderTextColor={colors.textMuted}
         value={code}
         onChangeText={v => setCode(v.toUpperCase())}
         autoCapitalize="characters"
         autoCorrect={false}
         maxLength={12} />

       <Text style={[s.label, { color: colors.textSoft, marginTop:12 }]}>
         كود الإحالة
         <Text style={{color:'#2ecc71', fontWeight:'400'}}> (اختياري — للحصول على شهر مجاني 🎁)</Text>
       </Text>
       <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
         placeholder="مثال: MOHAMAD47"
         placeholderTextColor={colors.textMuted}
         value={refCode}
         onChangeText={v => setRefCode(v.toUpperCase())}
         autoCapitalize="characters"
         autoCorrect={false} />

       {refCode.length > 0 && (
         <View style={s.bonusBox}>
           <Text style={s.bonusT}>🎁 ستحصل على شهر مجاني إضافي!</Text>
         </View>
       )}

       <TouchableOpacity style={[s.btn, { backgroundColor: colors.gold }]} onPress={activate} disabled={load}>
         {load ? <ActivityIndicator color={colors.bg} /> : <Text style={[s.btnT, { color: colors.bg }]}>🔓 تفعيل الاشتراك</Text>}
       </TouchableOpacity>
     </View>

     <TouchableOpacity style={s.waBtn}
       onPress={() => Linking.openURL('https://wa.me/218945888844')}>
       <Text style={s.waBtnT}>📱 تواصل مع خدمة العملاء عبر واتساب</Text>
     </TouchableOpacity>

     <TouchableOpacity onPress={() => signOut(auth)}>
       <Text style={[s.link, { color: colors.textMuted }]}>تسجيل خروج</Text>
     </TouchableOpacity>
   </View>
 );
}

const s = StyleSheet.create({
 wrap:     { flex:1, alignItems:'center', justifyContent:'center', padding:24 },
 themeBtn: { position:'absolute', top:50, left:16, width:40, height:40, borderRadius:20, borderWidth:1, alignItems:'center', justifyContent:'center', zIndex:10 },
 themeBtnT:{ fontSize:18 },
 logo:     { fontSize:50, marginBottom:12 },
 title:    { fontSize:22, fontWeight:'900', marginBottom:4 },
 sub:      { fontSize:13, marginBottom:20 },
 expBox:   { backgroundColor:'rgba(231,76,60,0.1)', borderWidth:1, borderColor:'rgba(231,76,60,0.3)', borderRadius:10, padding:12, marginBottom:16, width:'100%' },
 expT:     { color:'#ff8a80', fontSize:13, textAlign:'center' },
 card:     { borderRadius:16, padding:24, width:'100%', borderWidth:1, marginBottom:16 },
 label:    { fontSize:13, marginBottom:8, fontWeight:'600' },
 input:    { borderWidth:2, borderRadius:12, padding:14, fontSize:18, textAlign:'center', letterSpacing:3, marginBottom:8 },
 bonusBox: { backgroundColor:'rgba(46,204,113,0.1)', borderWidth:1, borderColor:'rgba(46,204,113,0.3)', borderRadius:8, padding:10, marginBottom:8, alignItems:'center' },
 bonusT:   { color:'#2ecc71', fontSize:13, fontWeight:'700' },
 btn:      { borderRadius:10, padding:14, alignItems:'center', marginTop:8 },
 btnT:     { fontSize:15, fontWeight:'700' },
 waBtn:    { backgroundColor:'rgba(37,211,102,0.1)', borderWidth:1, borderColor:'rgba(37,211,102,0.3)', borderRadius:12, padding:14, width:'100%', alignItems:'center', marginBottom:14 },
 waBtnT:   { color:'#25D366', fontSize:14, fontWeight:'700' },
 link:     { fontSize:13, textDecorationLine:'underline' },
});

