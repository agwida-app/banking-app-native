import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function ActivationScreen({ user, subStatus }) {
  const [code, setCode] = useState('');
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
      await updateDoc(ref, { usedBy: user.uid, usedAt: serverTimestamp(), usedByEmail: user.email });
      Alert.alert('✅ تم التفعيل', 'مرحباً بك في إدارة بطاقاتك!');
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
        <Text style={s.label}>أدخل كود التفعيل</Text>
        <TextInput style={s.input}
          placeholder="XXXXXXXX"
          placeholderTextColor="#8a9ab5"
          value={code}
          onChangeText={v => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12} />
        <TouchableOpacity style={s.btn} onPress={activate} disabled={load}>
          {load ? <ActivityIndicator color="#0a1628" /> : <Text style={s.btnT}>🔓 تفعيل الاشتراك</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => signOut(db._app ? db : db)}>
        <Text style={s.link} onPress={async () => { const { signOut } = await import('firebase/auth'); const { auth } = await import('../firebase'); signOut(auth); }}>
          تسجيل خروج
        </Text>
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
  card:   { backgroundColor:'#0f2040', borderRadius:16, padding:24, width:'100%', borderWidth:1, borderColor:'rgba(201,168,76,0.2)', marginBottom:20 },
  label:  { fontSize:14, color:'#c5cedd', marginBottom:10, fontWeight:'600' },
  input:  { backgroundColor:'rgba(255,255,255,0.08)', borderWidth:2, borderColor:'rgba(201,168,76,0.3)', borderRadius:12, padding:14, color:'#f8f6f0', fontSize:20, textAlign:'center', letterSpacing:4, marginBottom:14 },
  btn:    { backgroundColor:'#c9a84c', borderRadius:10, padding:14, alignItems:'center' },
  btnT:   { color:'#0a1628', fontSize:15, fontWeight:'700' },
  link:   { color:'#8a9ab5', fontSize:13, textDecorationLine:'underline' },
});
