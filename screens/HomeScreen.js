import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator
} from 'react-native';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function HomeScreen() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
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

  const filtered = clients.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone1?.includes(search) || c.nationalId?.includes(search)
  );

  const total = clients.length;
  const booked = clients.filter(c => c.cardBooked && !c.isSold).length;
  const pending = clients.filter(c => !c.cardBooked && !c.isSold).length;
  const sold = clients.filter(c => c.isSold).length;

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>💳 إدارة بطاقاتك</Text>
        <TouchableOpacity onPress={() => signOut(auth)}>
          <Text style={s.logout}>خروج</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={s.stats}>
        {[
          { l: 'الكل', v: total, c: '#c9a84c' },
          { l: '✅ محجوز', v: booked, c: '#2ecc71' },
          { l: '⏳ انتظار', v: pending, c: '#f39c12' },
          { l: '🔴 مباع', v: sold, c: '#e74c3c' },
        ].map((s, i) => (
          <View key={i} style={st.statCard}>
            <Text style={[st.statV, { color: s.c }]}>{s.v}</Text>
            <Text style={st.statL}>{s.l}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <TextInput style={s.search} placeholder="🔍 بحث بالاسم أو الجوال..."
        placeholderTextColor="#8a9ab5" value={search} onChangeText={setSearch} />

      {/* List */}
      {loading
        ? <ActivityIndicator color="#c9a84c" style={{ marginTop: 40 }} />
        : <FlatList
            data={filtered}
            keyExtractor={c => c.id}
            contentContainerStyle={{ padding: 14 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyI}>📋</Text>
                <Text style={s.emptyT}>{!clients.length ? 'لا يوجد عملاء بعد' : 'لا توجد نتائج'}</Text>
              </View>
            }
            renderItem={({ item: c }) => (
              <View style={[s.card, c.isSold && s.soldCard]}>
                <View style={s.cardTop}>
                  <Text style={s.name}>{c.name}</Text>
                  {c.isSold
                    ? <View style={[s.badge, s.badgeSold]}><Text style={s.badgeT}>🔴 مباع</Text></View>
                    : c.cardBooked
                    ? <View style={[s.badge, s.badgeOk]}><Text style={s.badgeT}>✅ محجوز</Text></View>
                    : <View style={[s.badge, s.badgeWarn]}><Text style={s.badgeT}>⏳ انتظار</Text></View>
                  }
                </View>
                <Text style={s.bank}>{c.bankType === 'أخرى' ? c.bankTypeOther : c.bankType}</Text>
                <Text style={s.phone}>{c.phone1}</Text>
              </View>
            )}
          />
      }
    </View>
  );
}

const s = StyleSheet.create({
  wrap:    { flex:1, backgroundColor:'#0a1628' },
  header:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingTop:50, backgroundColor:'#0f2040', borderBottomWidth:1, borderBottomColor:'rgba(201,168,76,0.2)' },
  title:   { fontSize:18, fontWeight:'900', color:'#c9a84c' },
  logout:  { color:'#8a9ab5', fontSize:13 },
  stats:   { flexDirection:'row', padding:12, gap:8 },
  search:  { margin:14, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:10, padding:12, color:'#f8f6f0', borderWidth:1, borderColor:'rgba(255,255,255,0.1)', textAlign:'right' },
  card:    { backgroundColor:'#0f2040', borderRadius:12, padding:14, marginBottom:10, borderWidth:1, borderColor:'rgba(201,168,76,0.15)' },
  soldCard:{ opacity:0.5 },
  cardTop: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6 },
  name:    { fontSize:15, fontWeight:'700', color:'#f8f6f0' },
  bank:    { fontSize:12, color:'#8a9ab5', marginBottom:2 },
  phone:   { fontSize:12, color:'#c5cedd' },
  badge:   { borderRadius:20, paddingHorizontal:8, paddingVertical:3 },
  badgeOk:  { backgroundColor:'rgba(46,204,113,0.1)', borderWidth:1, borderColor:'rgba(46,204,113,0.3)' },
  badgeWarn:{ backgroundColor:'rgba(243,156,18,0.1)', borderWidth:1, borderColor:'rgba(243,156,18,0.3)' },
  badgeSold:{ backgroundColor:'rgba(231,76,60,0.1)', borderWidth:1, borderColor:'rgba(231,76,60,0.3)' },
  badgeT:  { fontSize:11, fontWeight:'700', color:'#f8f6f0' },
  empty:   { alignItems:'center', paddingTop:60 },
  emptyI:  { fontSize:40, opacity:0.3, marginBottom:10 },
  emptyT:  { color:'#8a9ab5', fontSize:13 },
});

const st = StyleSheet.create({
  statCard: { flex:1, backgroundColor:'#0f2040', borderRadius:10, padding:10, alignItems:'center', borderWidth:1, borderColor:'rgba(201,168,76,0.15)' },
  statV:    { fontSize:20, fontWeight:'900' },
  statL:    { fontSize:10, color:'#8a9ab5', marginTop:2 },
});
