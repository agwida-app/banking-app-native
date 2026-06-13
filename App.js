import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { auth, db } from './firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';

import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import ActivationScreen from './screens/ActivationScreen';
import AdminScreen from './screens/AdminScreen';

const Stack = createStackNavigator();
const ADMIN_UID = "yel5HGeqTfXRUmraIzfZK4XVhrS2";

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [subStatus, setSubStatus] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      setReady(true);
      if (!u) setSubStatus(null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.uid === ADMIN_UID) { setSubStatus('active'); return; }
    const q = query(collection(db, 'subscriptions'), where('usedBy', '==', user.uid));
    return onSnapshot(q, snap => {
      if (snap.empty) { setSubStatus('none'); return; }
      const sub = snap.docs[0].data();
      const exp = sub.expiresAt?.toDate ? sub.expiresAt.toDate() : new Date(sub.expiresAt);
      setSubStatus(exp > new Date() ? 'active' : 'expired');
    });
  }, [user]);

  if (!ready || (user && subStatus === null)) return (
    <View style={{ flex:1, backgroundColor:'#0a1628', alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator size="large" color="#c9a84c" />
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
              <Stack.Screen name="Home" component={HomeScreen} />
            </>
          ) : (
            <Stack.Screen name="Home" component={HomeScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
