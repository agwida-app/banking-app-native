const renewSub = (sub) => {
  Alert.alert(
    '🔄 تجديد الاشتراك',
    `العميل: ${sub.usedByEmail || 'غير مفعّل'}\nاختر الباقة المناسبة:`,
    [
      ...PLANS.map(p => ({
        text: `${p.label} — $${p.price}`,
        onPress: () => {
          Alert.alert(
            '✅ تأكيد التجديد',
            `هل تريد تجديد الاشتراك بـ:\n\n📦 ${p.label}\n💵 $${p.price}\n📅 ينتهي: ${addTime(p.months, p.days).toLocaleDateString('ar-LY')}`,
            [
              { text: 'إلغاء', style: 'cancel' },
              { text: 'تأكيد ✅', onPress: async () => {
                await updateDoc(doc(db, 'subscriptions', sub.id), {
                  expiresAt: addTime(p.months, p.days),
                  plan: p.id, planLabel: p.label
                });
                Alert.alert('✅ تم التجديد', `تم تجديد الاشتراك بـ ${p.label}`);
              }}
            ]
          );
        }
      })),
      { text: 'إلغاء', style: 'cancel' }
    ]
  );
};
