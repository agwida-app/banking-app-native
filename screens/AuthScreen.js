import { useState } from 'react';
import {
 View, Text, TextInput, TouchableOpacity,
 StyleSheet, ActivityIndicator, Alert,
 KeyboardAvoidingView, Platform, Linking, ScrollView
} from 'react-native';
import {
 signInWithEmailAndPassword,
 createUserWithEmailAndPassword,
 sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';

export default function AuthScreen() {
 const [tab, setTab] = useState('login');
 const [email, setEmail] = useState('');
 const [pass, setPass] = useState('');
 const [err, setErr] = useState('');
 const [ok, setOk] = useState('');
 const [load, setLoad] = useState(false);
 const [reset, setReset] = useState(false);

 const handle = async () => {
   setErr(''); setOk(''); setLoad(true);
   if (!email.trim() || !pass.trim()) {
     setErr('يرجى ملء جميع الحقول'); setLoad(false); return;
   }
   try {
     if (tab === 'login') await signInWithEmailAndPassword(auth, email.trim(), pass);
     else await createUserWithEmailAndPassword(auth, email.trim(), pass);
   } catch (e) {
     const m = {
       'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
       'auth/email-already-in-use': 'البريد مسجل مسبقاً',
       'auth/weak-password': 'كلمة المرور قصيرة (6+ أحرف)',
       'auth/invalid-email': 'البريد غير صالح',
       'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً'
     };
     setErr(m[e.code] || 'حدث خطأ');
   }
   setLoad(false);
 };

 const handleReset = async () => {
   setErr(''); setOk(''); setLoad(true);
   if (!email.trim()) { setErr('أدخل بريدك'); setLoad(false); return; }
   try {
     await sendPasswordResetEmail(auth, email.trim());
     setOk('تم الإرسال ✉'); setReset(false);
   } catch { setErr('البريد غير مسجل'); }
   setLoad(false);
 };

 return (
   <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
     <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
       <Text style={s.logo}>💳</Text>
       <Text style={s.title}>إدارة بطاقاتك</Text>
       <Text style={s.sub}>منصة آمنة ومتزامنة عبر جميع الأجهزة</Text>

       {!reset ? (
         <View style={s.card}>
           <View style={s.tabs}>
             <TouchableOpacity style={[s.tab, tab==='login' && s.tabOn]}
               onPress={() => { setTab('login'); setErr(''); }}>
               <Text style={[s.tabT, tab==='login' && s.tabTOn]}>تسجيل الدخول</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[s.tab, tab==='register' && s.tabOn]}
               onPress={() => { setTab('register'); setErr(''); }}>
               <Text style={[s.tabT, tab==='register' && s.tabTOn]}>حساب جديد</Text>
             </TouchableOpacity>
           </View>

           {!!err && <View style={s.errBox}><Text style={s.errT}>{err}</Text></View>}
           {!!ok  && <View style={s.okBox}><Text style={s.okT}>{ok}</Text></View>}

           <Text style={s.label}>البريد الإلكتروني</Text>
           <TextInput style={s.input}
             placeholder="example@mail.com" placeholderTextColor="#8a9ab5"
             value={email} onChangeText={setEmail}
             keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

           <Text style={s.label}>كلمة المرور</Text>
           <TextInput style={s.input}
             placeholder="••••••••" placeholderTextColor="#8a9ab5"
             value={pass} onChangeText={setPass} secureTextEntry />

           <TouchableOpacity style={s.btn} onPress={handle} disabled={load}>
             {load ? <ActivityIndicator color="#0a1628" /> :
               <Text style={s.btnT}>{tab === 'login' ? '🔐 تسجيل الدخول' : '✨ إنشاء حساب'}</Text>}
           </TouchableOpacity>

           {tab === 'login' && (
             <TouchableOpacity onPress={() => { setReset(true); setErr(''); }}>
               <Text style={s.link}>نسيت كلمة المرور؟</Text>
             </TouchableOpacity>
           )}
         </View>
       ) : (
         <View style={s.card}>
           <Text style={s.resetTitle}>إعادة تعيين كلمة المرور</Text>
           <Text style={s.resetSub}>سنرسل رابطاً لبريدك الإلكتروني</Text>

           {!!err && <View style={s.errBox}><Text style={s.errT}>{err}</Text></View>}
           {!!ok  && <View style={s.okBox}><Text style={s.okT}>{ok}</Text></View>}

           <Text style={s.label}>البريد الإلكتروني</Text>
           <TextInput style={s.input}
             placeholder="example@mail.com" placeholderTextColor="#8a9ab5"
             value={email} onChangeText={setEmail}
             keyboardType="email-address" autoCapitalize="none" />

           <TouchableOpacity style={s.btn} onPress={handleReset} disabled={load}>
             {load ? <ActivityIndicator color="#0a1628" /> : <Text style={s.btnT}>📨 إرسال</Text>}
           </TouchableOpacity>

           <TouchableOpacity onPress={() => { setReset(false); setErr(''); }}>
             <Text style={s.link}>← العودة</Text>
           </TouchableOpacity>
         </View>
       )}

       {/* واتساب — خارج التطبيق */}
       <TouchableOpacity style={s.waBtn}
         onPress={() => Linking.openURL('https://wa.me/218945888844')}>
         <Text style={s.waBtnT}>📱 تواصل مع خدمة العملاء عبر واتساب</Text>
       </TouchableOpacity>

     </ScrollView>
   </KeyboardAvoidingView>
 );
}

const s = StyleSheet.create({
 wrap:       { flex:1, backgroundColor:'#0a1628' },
 scroll:     { flexGrow:1, alignItems:'center', justifyContent:'center', padding:24 },
 logo:       { fontSize:50, marginBottom:12 },
 title:      { fontSize:22, fontWeight:'900', color:'#f8f6f0', marginBottom:4 },
 sub:        { fontSize:13, color:'#8a9ab5', marginBottom:20, textAlign:'center' },
 card:       { backgroundColor:'#0f2040', borderRadius:16, padding:24, width:'100%', maxWidth:420, borderWidth:1, borderColor:'rgba(201,168,76,0.2)', marginBottom:16 },
 tabs:       { flexDirection:'row', backgroundColor:'rgba(0,0,0,0.25)', borderRadius:10, padding:3, marginBottom:16 },
 tab:        { flex:1, padding:9, borderRadius:7, alignItems:'center' },
 tabOn:      { backgroundColor:'#c9a84c' },
 tabT:       { color:'#8a9ab5', fontSize:14, fontWeight:'600' },
 tabTOn:     { color:'#0a1628', fontWeight:'700' },
 errBox:     { backgroundColor:'rgba(231,76,60,0.1)', borderWidth:1, borderColor:'rgba(231,76,60,0.3)', borderRadius:8, padding:10, marginBottom:10 },
 errT:       { color:'#ff8a80', fontSize:13, textAlign:'center' },
 okBox:      { backgroundColor:'rgba(46,204,113,0.1)', borderWidth:1, borderColor:'rgba(46,204,113,0.3)', borderRadius:8, padding:10, marginBottom:10 },
 okT:        { color:'#80ffb0', fontSize:13, textAlign:'center' },
 label:      { fontSize:12, color:'#c5cedd', marginBottom:5, fontWeight:'500' },
 input:      { backgroundColor:'rgba(255,255,255,0.06)', borderWidth:1.5, borderColor:'rgba(255,255,255,0.1)', borderRadius:10, padding:12, color:'#f8f6f0', fontSize:15, marginBottom:12, textAlign:'right' },
 btn:        { backgroundColor:'#c9a84c', borderRadius:10, padding:14, alignItems:'center', marginTop:4 },
 btnT:       { color:'#0a1628', fontSize:15, fontWeight:'700' },
 link:       { color:'#c9a84c', fontSize:12, textAlign:'center', marginTop:12, textDecorationLine:'underline' },
 resetTitle: { fontSize:16, fontWeight:'900', color:'#c9a84c', marginBottom:4 },
 resetSub:   { fontSize:12, color:'#8a9ab5', marginBottom:16 },
 waBtn:      { backgroundColor:'rgba(37,211,102,0.1)', borderWidth:1, borderColor:'rgba(37,211,102,0.3)', borderRadius:12, padding:14, width:'100%', maxWidth:420, alignItems:'center' },
 waBtnT:     { color:'#25D366', fontSize:14, fontWeight:'700' },
});
