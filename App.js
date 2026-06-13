import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { auth, db } from './firebase';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';

import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import ActivationScreen from './screens/ActivationScreen';
import AdminScreen from './screens/AdminScreen';

const Stack = createStackNavigator();
const ADMIN_UID = "yel5HGeqTfXRUmraIzfZK4XVhrS2";

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const exp = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  return Math.ceil((exp - new Date()) / (1000*60*60*24));
}

function getDeviceType() {
  const { Platform } = require('react-native');
  return Platform.OS === 'ios' ? 'iPhone 📱' : 'Android 📱';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [subDays, setSubDays] = useState(null);
  const [subDoc, setSubDoc] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      setReady(true);
      if (!u) { setSubStatus(null); setSubDays(null); setSubDoc(null); }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.uid === ADMIN_UID) { setSubStatus('active'); setSubDays(9999); return; }

    const q = query(collection(db, 'subscriptions'), where('usedBy', '==', user.uid));
    return onSnapshot(q, async snap => {
      if (snap.empty) { setSubStatus('none'); return; }

      const subDocSnap = snap.docs[0];
      const sub = subDocSnap.data();
      const days = daysLeft(sub.expiresAt);
      setSubDays(days);
      setSubDoc(subDocSnap);

      if (days <= 0) { setSubStatus('expired'); return; }

      // تسجيل الجهاز
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        let deviceId = await AsyncStorage.getItem('deviceId');
        if (!deviceId) {
          deviceId = 'dev_' + Math.random().toString(36).substr(2,9) + '_' + Date.now().toString(36);
          await AsyncStorage.setItem('deviceId', deviceId);
        }
        const devices = sub.devices || {};
        const deviceEntry = {
          uid: user.uid, email: user.email,
          lastSeen: new Date().toISOString(),
          type: getDeviceType()
        };

        if (devices[deviceId]) {
          // جهاز معروف — تحديث lastSeen
          await updateDoc(doc(db, 'subscriptions', subDocSnap.id), {
            [`devices.${deviceId}`]: deviceEntry
          });
          setSubStatus('active');
        } else {
          const deviceCount = Object.keys(devices).length;
          if (deviceCount >= 7) {
            setSubStatus('device_limit');
          } else {
            await updateDoc(doc(db, 'subscriptions', subDocSnap.id), {
              [`devices.${deviceId}`]: deviceEntry
            });
            setSubStatus('active');
          }
        }
      } catch (e) {
        setSubStatus('active');
      }
    });
  }, [user]);

  if (!ready || (user && subStatus === null)) return (
    <View style={st.loading}>
      <ActivityIndicator size="large" color="#c9a84c" />
    </View>
  );

  // شاشة تجاوز حد الأجهزة
  if (user && subStatus === 'device_limit') return (
    <View style={st.loading}>
      <StatusBar style="light" />
      <Text style={st.limitIcon}>📱📱📱</Text>
      <Text style={st.limitTitle}>تجاوزت الحد الأقصى للأجهزة</Text>
      <Text style={st.limitSub}>اشتراكك مسجّل على 7 أجهزة وهو الحد الأقصى.{'\n'}تواصل مع المسؤول لإعادة ضبط أجهزتك.</Text>
      <TouchableOpacity style={st.limitBtn} onPress={() => signOut(auth)}>
        <Text style={st.limitBtnT}>تسجيل خروج</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <Stack.Screen name="Auth" component={AuthScreen} />
          ) : subStatus === 'none' || subStatus === 'expired' ? (
            <Stack.Screen name="Activation">
              {props => <ActivationScreen {...props} user={user} subStatus={subStatus} />}
            </Stack.Screen>
          ) : user.uid === ADMIN_UID ? (
            <>
              <Stack.Screen name="Admin" component={AdminScreen} />
              <Stack.Screen name="Home">
                {props => <HomeScreen {...props} subDays={subDays} />}
              </Stack.Screen>
            </>
          ) : (
            <Stack.Screen name="Home">
              {props => <HomeScreen {...props} subDays={subDays} />}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  loading:    { flex:1, backgroundColor:'#0a1628', alignItems:'center', justifyContent:'center', padding:24 },
  limitIcon:  { fontSize:50, marginBottom:16 },
  limitTitle: { fontSize:20, fontWeight:'900', color:'#f8f6f0', marginBottom:10, textAlign:'center' },
  limitSub:   { fontSize:14, color:'#8a9ab5', textAlign:'center', lineHeight:22, marginBottom:24 },
  limitBtn:   { backgroundColor:'#c9a84c', borderRadius:12, paddingHorizontal:32, paddingVertical:14 },
  limitBtnT:  { color:'#0a1628', fontSize:15, fontWeight:'700' },
});
