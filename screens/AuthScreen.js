import { useState } from 'react';
import {
 View, Text, TextInput, TouchableOpacity,
 StyleSheet, ActivityIndicator, Alert,
 KeyboardAvoidingView, Platform, Linking, ScrollView
} from 'react-native';
import {
 signInWithEmailAndPassword,
 createUserWithEmailAndPassword,
 sendPasswordResetEmail,
 updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';
import { useTheme } from '../ThemeContext';

export default function AuthScreen() {
 const { colors, isDark, toggleTheme } = useTheme();
 const [tab, setTab] = useState('login');
 const [name, setName] = useState('');
 const [email, setEmail] = useState('');
 const [pass, setPass] = useState('');
 const [err, setErr] = useState('');
 const [ok, setOk] = useState('');
 const [load, setLoad] = useState(false);
 const [reset, setReset] = useState(false);

 const handle = async () => {
   setErr(''); setOk(''); setLoad(true);

   if (tab === 'register') {
     if (!name.trim() || !email.trim() || !pass.trim()) {
       setErr('يرجى ملء جميع الحقول'); setLoad(false); return;
     }
   } else {
     if (!email.trim() || !pass.trim()) {
       setErr('يرجى ملء جميع الحقول'); setLoad(false); return;
     }
   }

   try {
     if (tab === 'login') {
       await signInWithEmailAndPassword(auth, email.trim(), pass);
     } else {
       const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
       await updateProfile(cred.user, { displayName: name.trim() });
     }
   } catch (e) {
     const m = {
       'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
       'auth/email-already-in-use': 'البريد مسجل مسبقا',
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
   <KeyboardAvoidingView style={[s.wrap, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
     <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

       <TouchableOpacity style={[s.themeBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={toggleTheme}>
         <Text style={s.themeBtnT}>{isDark ? '☀️' : '🌙'}</Text>
       </TouchableOpacity>

       <Text style={s.logo}>💳</Text>
       <Text style={[s.title, { color: colors.text }]}>إدارة بطاقاتك</Text>
       <Text style={[s.sub, { color: colors.textMuted }]}>منصة آمنة ومتزامنة عبر جميع الأجهزة</Text>

       {!reset ? (
         <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
           <View style={[s.tabs, { backgroundColor: colors.overlay }]}>
             <TouchableOpacity style={[s.tab, tab==='login' && { backgroundColor: colors.gold }]}
               onPress={() => { setTab('login'); setErr(''); }}>
               <Text style={[s.tabT, { color: colors.textMuted }, tab==='login' && { color: colors.bg, fontWeight:'700' }]}>تسجيل الدخول</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[s.tab, tab==='register' && { backgroundColor: colors.gold }]}
               onPress={() => { setTab('register'); setErr(''); }}>
               <Text style={[s.tabT, { color: colors.textMuted }, tab==='register' && { color: colors.bg, fontWeight:'700' }]}>حساب جديد</Text>
             </TouchableOpacity>
           </View>

           {!!err && <View style={s.errBox}><Text style={s.errT}>{err}</Text></View>}
           {!!ok  && <View style={s.okBox}><Text style={s.okT}>{ok}</Text></View>}

           {tab === 'register' && (
             <>
               <Text style={[s.label, { color: colors.textSoft }]}>الاسم الكامل</Text>
               <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                 placeholder="اسمك الكامل" placeholderTextColor={colors.textMuted}
                 value={name} onChangeText={setName} />
             </>
           )}

           <Text style={[s.label, { color: colors.textSoft }]}>البريد الإلكتروني</Text>
           <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
             placeholder="example@mail.com" placeholderTextColor={colors.textMuted}
             value={email} onChangeText={setEmail}
             keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

           <Text style={[s.label, { color: colors.textSoft }]}>كلمة المرور</Text>
           <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
             placeholder="••••••••" placeholderTextColor={colors.textMuted}
             value={pass} onChangeText={setPass} secureTextEntry />

           <TouchableOpacity style={[s.btn, { backgroundColor: colors.gold }]} onPress={handle} disabled={load}>
             {load ? <ActivityIndicator color={colors.bg} /> :
               <Text style={[s.btnT, { color: colors.bg }]}>{tab === 'login' ? '🔐 تسجيل الدخول' : '✨ إنشاء حساب'}</Text>}
           </TouchableOpacity>

           {tab === 'login' && (
             <TouchableOpacity onPress={() => { setReset(true); setErr(''); }}>
               <Text style={[s.link, { color: colors.gold }]}>نسيت كلمة المرور؟</Text>
             </TouchableOpacity>
           )}
         </View>
       ) : (
         <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
           <Text style={[s.resetTitle, { color: colors.gold }]}>إعادة تعيين كلمة المرور</Text>
           <Text style={[s.resetSub, { color: colors.textMuted }]}>سنرسل رابطاً لبريدك الإلكتروني</Text>

           {!!err && <View style={s.errBox}><Text style={s.errT}>{err}</Text></View>}
           {!!ok  && <View style={s.okBox}><Text style={s.okT}>{ok}</Text></View>}

           <Text style={[s.label, { color: colors.textSoft }]}>البريد الإلكتروني</Text>
           <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
             placeholder="example@mail.com" placeholderTextColor={colors.textMuted}
             value={email} onChangeText={setEmail}
             keyboardType="email-address" autoCapitalize="none" />

           <TouchableOpacity style={[s.btn, { backgroundColor: colors.gold }]} onPress={handleReset} disabled={load}>
             {load ? <ActivityIndicator color={colors.bg} /> : <Text style={[s.btnT, { color: colors.bg }]}>📨 إرسال</Text>}
           </TouchableOpacity>

           <TouchableOpacity onPress={() => { setReset(false); setErr(''); }}>
             <Text style={[s.link, { color: colors.gold }]}>← العودة</Text>
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
 wrap:       { flex:1 },
 scroll:     { flexGrow:1, alignItems:'center', justifyContent:'center', padding:24 },
 themeBtn:   { position:'absolute', top:8, left:8, width:40, height:40, borderRadius:20, borderWidth:1, alignItems:'center', justifyContent:'center', zIndex:10 },
 themeBtnT:  { fontSize:18 },
 logo:       { fontSize:50, marginBottom:12 },
 title:      { fontSize:22, fontWeight:'900', marginBottom:4 },
 sub:        { fontSize:13, marginBottom:20, textAlign:'center' },
 card:       { borderRadius:16, padding:24, width:'100%', maxWidth:420, borderWidth:1, marginBottom:16 },
 tabs:       { flexDirection:'row', borderRadius:10, padding:3, marginBottom:16 },
 tab:        { flex:1, padding:9, borderRadius:7, alignItems:'center' },
 tabT:       { fontSize:14, fontWeight:'600' },
 errBox:     { backgroundColor:'rgba(231,76,60,0.1)', borderWidth:1, borderColor:'rgba(231,76,60,0.3)', borderRadius:8, padding:10, marginBottom:10 },
 errT:       { color:'#ff8a80', fontSize:13, textAlign:'center' },
 okBox:      { backgroundColor:'rgba(46,204,113,0.1)', borderWidth:1, borderColor:'rgba(46,204,113,0.3)', borderRadius:8, padding:10, marginBottom:10 },
 okT:        { color:'#1a9850', fontSize:13, textAlign:'center' },
 label:      { fontSize:12, marginBottom:5, fontWeight:'500' },
 input:      { borderWidth:1.5, borderRadius:10, padding:12, fontSize:15, marginBottom:12, textAlign:'right' },
 btn:        { borderRadius:10, padding:14, alignItems:'center', marginTop:4 },
 btnT:       { fontSize:15, fontWeight:'700' },
 link:       { fontSize:12, textAlign:'center', marginTop:12, textDecorationLine:'underline' },
 resetTitle: { fontSize:16, fontWeight:'900', marginBottom:4 },
 resetSub:   { fontSize:12, marginBottom:16 },
 waBtn:      { backgroundColor:'rgba(37,211,102,0.1)', borderWidth:1, borderColor:'rgba(37,211,102,0.3)', borderRadius:12, padding:14, width:'100%', maxWidth:420, alignItems:'center' },
 waBtnT:     { color:'#25D366', fontSize:14, fontWeight:'700' },
});
