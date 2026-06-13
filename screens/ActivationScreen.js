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

const COMMISSION_PCT = 10;
const PLANS = [
  { id:'7d', label:'7 أيام', price:5 },
  { id:'1m', label:'شهر', price:10 },
  { id:'3m', label:'3 أشهر', price:30 },
  { id:'6m', label:'6 أشهر', price:60 },
  { id:'12m', label:'12 شهر', price:100 },
];

export default function ActivationScreen({ user, subStatus }) {
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
      let bonusDays = 0;
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
        bonusDays = 7;
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
      if (bonusDays > 0) {
        const newExp = new Date(exp);
        newExp.setDate(newExp.getDate() + bonusDays);
        await updateDoc(ref, {
          usedBy: user.uid, usedAt: serverTimestamp(),
          usedByEmail: user.email, expiresAt: newExp,
          planLabel: (data.planLabel || '') + ' + أسبوع مجاني 🎁'
        });
        Alert.alert('✅ تم التفعيل', 'حصلت على 7 أيام مجانية إضافية 🎁');
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
    <View style={s.wrap}>
      <Text style={s.logo}>💳</Text>
      <Text style={s.title}>تفعيل الاشتراك</Text>
      <Text style={s.sub}>{user.email}</Text>

      {subStatus === 'expired' && (
        <View style={s.expBox}>
          <Text style={s.expT}>⚠️ انتهى اشتراكك — تواصل مع المسؤول للتجديد</Text>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.label}>كود التفعيل *</Text>
        <TextInput style={s.input}
          placeholder="XXXXXXXX"
          placeholderTextColor="#8a9ab5"
          value={code}
          onChangeText={v => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12} />

        <Text style={[s.label, {marginTop:12}]}>
          كود الإحالة
          <Text style={{color:'#8a9ab5', fontWeight:'400'}}> (اختياري — للحصول على أسبوع مجاني 🎁)</Text>
        </Text>
        <TextInput style={s.input}
          placeholder="مثال: MOHAMAD47"
          placeholderTextColor="#8a9ab5"
          value={refCode}
          onChangeText={v => setRefCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false} />

        <TouchableOpacity style={s.btn} onPress={activate} disabled={load}>
          {load ? <ActivityIndicator color="#0a1628" /> : <Text style={s.btnT}>🔓 تفعيل الاشتراك</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.waBtn}
        onPress={() => Linking.openURL('https://wa.me/218945888844')}>
        <Text style={s.waBtnT}>📱 تواصل مع خدمة العملاء عبر واتساب</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => signOut(auth)}>
        <Text style={s.link}>تسجيل خروج</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:   { flex:1, backgroundColor:'#0a1628', alignItems:'center', justifyContent:'center', padding:24 },
  logo:   { fontSize:50, marginBottom:12 },
  title:  { fontSize:22, fontWeight:'900', color:'#f8f6f0', marginBottom:4 },
  sub:    { fontSize:13, color:'#8a9ab5', marginBottom:20 },
  expBox: { backgroundColor:'rgba(231,76,60,0.1)', borderWidth:1, borderColor:'rgba(231,76,60,0.3)', borderRadius:10, padding:12, marginBottom:16, width:'100%' },
  expT:   { color:'#ff8a80', fontSize:13, textAlign:'center' },
  card:   { backgroundColor:'#0f2040', borderRadius:16, padding:24, width:'100%', borderWidth:1, borderColor:'rgba(201,168,76,0.2)', marginBottom:16 },
  label:  { fontSize:13, color:'#c5cedd', marginBottom:8, fontWeight:'600' },
  input:  { backgroundColor:'rgba(255,255,255,0.08)', borderWidth:2, borderColor:'rgba(201,168,76,0.3)', borderRadius:12, padding:14, color:'#f8f6f0', fontSize:18, textAlign:'center', letterSpacing:3, marginBottom:8 },
  btn:    { backgroundColor:'#c9a84c', borderRadius:10, padding:14, alignItems:'center', marginTop:8 },
  btnT:   { color:'#0a1628', fontSize:15, fontWeight:'700' },
  waBtn:  { backgroundColor:'rgba(37,211,102,0.1)', borderWidth:1, borderColor:'rgba(37,211,102,0.3)', borderRadius:12, padding:14, width:'100%', alignItems:'center', marginBottom:14 },
  waBtnT: { color:'#25D366', fontSize:14, fontWeight:'700' },
  link:   { color:'#8a9ab5', fontSize:13, textDecorationLine:'underline' },
});
