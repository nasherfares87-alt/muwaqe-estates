'use strict';
const I18N = {
  ar: {
    brand: 'موثوق العقاري', brandSub: 'Muwaqe Estates',
    navVerify: 'التحقق', navFlow: 'المسار', navComponents: 'المكونات', navDashboard: 'لوحة المعلومات', navImpact: 'الأثر',
    heroBadge: 'منصة حوكمة عقارية رقمية',
    heroTitle: 'التحقق والدفع الآمن للتعاملات العقارية',
    heroDesc: 'موثوق العقاري طبقة رقمية موحدة تبدأ من التحقق من العرض العقاري وتنتهي بتوثيق العملية المالية والتحصيل — رقم استفسار موحد، حساب عقاري مستقل، وحساب افتراضي لكل عملية.',
    heroCta1: 'تحقق من عرض الآن', heroCta2: 'استعرض المسار الرقمي',
    artStatus: 'التحقق', artEscrow: 'حساب عقاري مستقل', artLock: 'تثبيت بيانات الوحدة', artPay: 'الدفع عبر حساب افتراضي',
    verifyTitle: 'التحقق من عرض عقاري',
    verifySub: 'أدخل رقم الاستفسار العقاري الموحد للتحقق من العرض وبيانات الوحدة قبل أي تعامل.',
    verifyBtn: 'تحقق',
    flowTitle: 'المسار الرقمي الموحد',
    flowSub: 'من التحقق إلى التتبع والتسوية في مسار واحد آمن وموثق.',
    flow1: 'التحقق', flow1d: 'رقم استفسار موحد مرتبط بالبيانات العقارية والعنوان الوطني.',
    flow2: 'الاستفسار', flow2d: 'التحقق من صحة العرض وبياناته قبل التعامل.',
    flow3: 'الحجز', flow3d: 'تأكيد الحجز وربطه بالوحدة والمستفيد.',
    flow4: 'تثبيت البيانات', flow4d: 'لا تغيير في البيانات الجوهرية إلا بإجراء رسمي موثق.',
    flow5: 'الفوترة', flow5d: 'فواتير إلكترونية مرتبطة بالحساب العقاري.',
    flow6: 'الدفع', flow6d: 'حساب افتراضي لكل عملية: عربون، دفعات، إيجار، رسوم.',
    flow7: 'التتبع والتسوية', flow7d: 'سجل رقمي قابل للتتبع للعمليات المالية والعقارية.',
    compTitle: 'المكونات الرئيسية',
    c1: 'رقم استفسار عقاري موحد', c1d: 'رقم فريد لكل عرض أو وحدة، مرتبط بالبيانات العقارية والعنوان الوطني.',
    c2: 'حساب عقاري مستقل', c2d: 'حساب مخصص للعملية، منفصل عن الحسابات الشخصية، يستقبل المدفوعات وفق الضوابط.',
    c3: 'حساب افتراضي لكل عملية', c3d: 'للعربون والدفعات والإيجار والرسوم، لربط العملية بالعقار والوحدة والمستفيد.',
    c4: 'حماية بيانات الوحدة بعد الحجز', c4d: 'تثبيت البيانات الجوهرية، ولا تعديل إلا عبر إجراء رسمي موثق.',
    c5: 'حماية البيع على الخارطة', c5d: 'ربط بيانات الوحدة والمشروع بالعملية المالية لحماية المشتري.',
    c6: 'فوترة اتحادات الملاك', c6d: 'فواتير دورية لرسوم الصيانة والتشغيل مع متابعة التحصيل والتسويات.',
    dashTitle: 'لوحة المعلومات الحية',
    dashSub: 'بيانات مباشرة من واجهة API — جرّب إنشاء عرض أو حجز أو فاتورة أو دفع.',
    statListings: 'العروض', statBookings: 'الحجوزات', statInvoices: 'الفواتير', statPaid: 'فواتير مدفوعة', statPaidAmt: 'إجمالي المدفوعات (SAR)', statAccounts: 'الحسابات', statAudit: 'حركات موثقة',
    actCreate: 'إنشاء عرض عقاري جديد', actCreateBtn: 'إنشاء + رقم موحد',
    actBook: 'حجز وحدة', actBookBtn: 'تأكيد الحجز',
    actInvoice: 'إصدار فاتورة', actInvoiceBtn: 'إصدار الفاتورة',
    actPay: 'دفع فاتورة', actPayBtn: 'إتمام الدفع',
    actUnion: 'فوترة اتحادات الملاك', actUnionBtn: 'إصدار فاتورة دورية',
    actTrack: 'تتبع عملية', actTrackBtn: 'تتبع',
    optDeposit: 'عربون', optPayment: 'دفعة', optRent: 'إيجار', optFee: 'رسوم', optBank: 'تحويل بنكي', optCard: 'بطاقة', optMonthly: 'شهري', optQuarterly: 'ربع سنوي',
    impactTitle: 'الأثر المتوقع',
    i1: 'الحد من الإعلانات العقارية الوهمية والاحتيال المرتبط بها.',
    i2: 'رفع مستوى التحقق قبل التحويل والدفع.',
    i3: 'حماية بيانات الوحدات العقارية بعد الحجز.',
    i4: 'تعزيز الشفافية في المدفوعات والعمولات والمستحقات.',
    i5: 'تحسين كفاءة تحصيل رسوم اتحادات الملاك.',
    i6: 'سجل رقمي قابل للتتبع للعمليات العقارية والمالية.',
    i7: 'دعم الحوكمة والتحول الرقمي بما يتوافق مع رؤية المملكة 2030.',
    footer: 'موثوق العقاري — طبقة حوكمة رقمية تتكامل مع الأنظمة والمنصات القائمة، لبناء سوق عقاري أكثر أماناً وشفافية وكفاءة.',
    fInquiry: 'رقم الاستفسار الموحد', fUnit: 'بيانات الوحدة', fStatus: 'الحالة', fEscrow: 'الحساب العقاري',
    fBooked: 'محجوزة', fActive: 'نشطة', fLocked: 'مثبتة 🔒', fUnlocked: 'غير مثبتة',
    verifiedOk: 'عرض موثق ✓', notFound: 'لم يتم العثور على العرض', serverErr: 'خطأ في الخدمة، حاول مجدداً',
    tracked: 'نتائج التتبع', noData: 'لا توجد بيانات'
  },
  en: {
    brand: 'Muwaqe Estates', brandSub: 'موثوق العقاري',
    navVerify: 'Verify', navFlow: 'Flow', navComponents: 'Components', navDashboard: 'Dashboard', navImpact: 'Impact',
    heroBadge: 'Digital Real-Estate Governance Platform',
    heroTitle: 'Verification & Secure Payments for Real-Estate Deals',
    heroDesc: 'Muwaqe Estates is a unified digital layer that starts with listing verification and ends with documented financial settlement — a unified inquiry number, an independent real-estate account, and a virtual account for every transaction.',
    heroCta1: 'Verify a listing', heroCta2: 'Explore the digital flow',
    artStatus: 'Verification', artEscrow: 'Independent escrow account', artLock: 'Unit data locked', artPay: 'Virtual-account payment',
    verifyTitle: 'Verify a Real-Estate Listing',
    verifySub: 'Enter the unified real-estate inquiry number to verify the listing and unit data before any transaction.',
    verifyBtn: 'Verify',
    flowTitle: 'The Unified Digital Flow',
    flowSub: 'From verification to tracking and settlement in one secure, documented path.',
    flow1: 'Verify', flow1d: 'A unified inquiry number linked to property data and the national address.',
    flow2: 'Inquire', flow2d: 'Validate the listing and its data before dealing.',
    flow3: 'Book', flow3d: 'Confirm the booking linked to the unit and beneficiary.',
    flow4: 'Lock Data', flow4d: 'No changes to core data except via a formal documented action.',
    flow5: 'Invoice', flow5d: 'E-invoices linked to the real-estate account.',
    flow6: 'Pay', flow6d: 'A virtual account per operation: deposit, payments, rent, fees.',
    flow7: 'Track & Settle', flow7d: 'A traceable digital record of financial and property operations.',
    compTitle: 'Core Components',
    c1: 'Unified Real-Estate Inquiry Number', c1d: 'A unique number per listing/unit linked to property data and the national address.',
    c2: 'Independent Real-Estate Account', c2d: 'A dedicated account per deal, separate from personal accounts, receiving payments per approved controls.',
    c3: 'Virtual Account per Operation', c3d: 'For deposits, payments, rent and fees — linking the operation to the property, unit and beneficiary.',
    c4: 'Post-Booking Unit Protection', c4d: 'Core data is locked; changes only via a formal documented action.',
    c5: 'Off-Plan Protection', c5d: 'Linking unit and project data to the financial operation to protect the buyer.',
    c6: 'Owners-Union Billing', c6d: 'Periodic invoices for maintenance & operations fees with collection and settlement tracking.',
    dashTitle: 'Live Dashboard',
    dashSub: 'Live data from the API — try creating a listing, booking, invoice or payment.',
    statListings: 'Listings', statBookings: 'Bookings', statInvoices: 'Invoices', statPaid: 'Paid invoices', statPaidAmt: 'Payments total (SAR)', statAccounts: 'Accounts', statAudit: 'Audit entries',
    actCreate: 'Create a New Listing', actCreateBtn: 'Create + unified number',
    actBook: 'Book a Unit', actBookBtn: 'Confirm booking',
    actInvoice: 'Issue an Invoice', actInvoiceBtn: 'Issue invoice',
    actPay: 'Pay an Invoice', actPayBtn: 'Complete payment',
    actUnion: 'Owners-Union Billing', actUnionBtn: 'Issue periodic invoice',
    actTrack: 'Track an Operation', actTrackBtn: 'Track',
    optDeposit: 'Deposit', optPayment: 'Payment', optRent: 'Rent', optFee: 'Fee', optBank: 'Bank transfer', optCard: 'Card', optMonthly: 'Monthly', optQuarterly: 'Quarterly',
    impactTitle: 'Expected Impact',
    i1: 'Reduce fake real-estate ads and related fraud.',
    i2: 'Raise verification levels before transfers and payments.',
    i3: 'Protect unit data after booking.',
    i4: 'Enhance transparency of payments, commissions and dues.',
    i5: 'Improve collection efficiency of owners-union fees.',
    i6: 'A traceable digital record of property and financial operations.',
    i7: 'Support governance and digital transformation aligned with Vision 2030.',
    footer: 'Muwaqe Estates — a digital governance layer that integrates with existing systems and platforms to build a safer, more transparent and efficient real-estate market.',
    fInquiry: 'Unified inquiry number', fUnit: 'Unit data', fStatus: 'Status', fEscrow: 'Escrow account',
    fBooked: 'Booked', fActive: 'Active', fLocked: 'Locked 🔒', fUnlocked: 'Not locked',
    verifiedOk: 'Verified listing ✓', notFound: 'Listing not found', serverErr: 'Server error, try again',
    tracked: 'Tracking results', noData: 'No data'
  }
};

function applyLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (I18N[lang][key] != null) el.textContent = I18N[lang][key];
  });
  localStorage.setItem('muwaqe-lang', lang);
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

function t(key) {
  const lang = localStorage.getItem('muwaqe-lang') || 'ar';
  return (I18N[lang] && I18N[lang][key]) || key;
}

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('muwaqe-lang') || 'ar';
  applyLang(saved);
  document.getElementById('langBtn').addEventListener('click', () => {
    applyLang((localStorage.getItem('muwaqe-lang') || 'ar') === 'ar' ? 'en' : 'ar');
  });
});
