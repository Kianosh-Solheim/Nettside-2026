import React, { useState, useEffect } from 'react';
import { collection, db, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp, handleFirestoreError, OperationType, where, getDocs } from '../firebase';
import { Plus, Trash2, Edit2, Save, X, CreditCard, Calendar, TrendingUp, Download, CheckCircle, AlertCircle, Clock, FileText, Globe, Upload, Image as ImageIcon } from 'lucide-react';
import Button from './ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Membership {
  id: string;
  name: string;
  organization?: string;
  memberNumber?: string;
  category: string;
  cost: number;
  currency: string;
  frequency: 'Monthly' | 'Yearly' | 'Quarterly' | 'One-time';
  startDate: string;
  nextRenewalDate: string;
  status: 'Active' | 'Inactive' | 'Cancelled';
  contactEmail?: string;
  website?: string;
  localBranch?: string;
  logoUrl?: string;
  description?: string;
  createdAt: any;
}

interface Role {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  createdAt: any;
}

interface Payment {
  id: string;
  membershipId: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: any;
}

interface FileMetadata {
  id: string;
  name: string;
  url: string;
  type: string;
}

export default function Memberships() {
  const [lang, setLang] = useState<'en' | 'no'>('no');
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Membership>>({
    name: '',
    organization: '',
    memberNumber: '',
    category: 'Organization',
    cost: 0,
    currency: 'NOK',
    frequency: 'Yearly',
    startDate: new Date().toISOString().split('T')[0],
    nextRenewalDate: '',
    status: 'Active',
    contactEmail: '',
    website: '',
    localBranch: '',
    logoUrl: '',
    description: ''
  });
  const [isLoggingPayment, setIsLoggingPayment] = useState<string | null>(null);
  const [isLoggingRole, setIsLoggingRole] = useState<{membershipId: string, role?: Role} | null>(null);
  const [hasFee, setHasFee] = useState(true);

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [roleData, setRoleData] = useState({
    title: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'memberships'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Membership[];
      setMemberships(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'memberships'));

    const pq = query(collection(db, 'membership_payments'), orderBy('date', 'desc'));
    const unsubscribePayments = onSnapshot(pq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payment[];
      setPayments(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'membership_payments'));

    const qFiles = query(collection(db, 'files'), orderBy('createdAt', 'desc'));
    const unsubscribeFiles = onSnapshot(qFiles, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as FileMetadata[];
      setFiles(data.filter(f => f.type.startsWith('image/')));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'files'));

    return () => {
      unsubscribe();
      unsubscribePayments();
      unsubscribeFiles();
    };
  }, []);

  useEffect(() => {
    if (!selectedMembershipId) {
      setRoles([]);
      return;
    }

    const rq = query(
      collection(db, 'memberships', selectedMembershipId, 'roles'),
      orderBy('startDate', 'desc')
    );
    
    const unsubscribeRoles = onSnapshot(rq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Role[];
      setRoles(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `memberships/${selectedMembershipId}/roles`));

    return () => unsubscribeRoles();
  }, [selectedMembershipId]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for base64 strings to avoid Firestore limits
        alert(lang === 'no' ? 'Bildet er for stort. Maks 1MB.' : 'Image is too large. Max 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateDoc(doc(db, 'memberships', isEditing), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        setIsEditing(null);
      } else {
        await addDoc(collection(db, 'memberships'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        setShowAddForm(false);
      }
      setFormData({
        name: '',
        organization: '',
        memberNumber: '',
        category: 'Organization',
        cost: 0,
        currency: 'NOK',
        frequency: 'Yearly',
        startDate: new Date().toISOString().split('T')[0],
        nextRenewalDate: '',
        status: 'Active',
        contactEmail: '',
        website: '',
        localBranch: '',
        logoUrl: '',
        description: ''
      });
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, 'memberships');
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggingRole) return;
    const { membershipId, role } = isLoggingRole;
    
    try {
      const data = {
        title: roleData.title,
        startDate: roleData.startDate,
        endDate: roleData.endDate || null,
      };

      if (role) {
        await updateDoc(doc(db, 'memberships', membershipId, 'roles', role.id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'memberships', membershipId, 'roles'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      setIsLoggingRole(null);
      setRoleData({ title: '', startDate: new Date().toISOString().split('T')[0], endDate: '' });
    } catch (error) {
      handleFirestoreError(error, role ? OperationType.UPDATE : OperationType.CREATE, `memberships/${membershipId}/roles`);
    }
  };

  const handleDeleteRole = async (membershipId: string, roleId: string) => {
    if (!window.confirm(lang === 'no' ? 'Er du sikker på at du vil slette denne rollen?' : 'Are you sure you want to delete this role?')) return;
    try {
      await deleteDoc(doc(db, 'memberships', membershipId, 'roles', roleId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `memberships/${membershipId}/roles/${roleId}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this membership?')) return;
    try {
      await deleteDoc(doc(db, 'memberships', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `memberships/${id}`);
    }
  };

  const handleLogPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggingPayment) return;
    try {
      await addDoc(collection(db, 'membership_payments'), {
        membershipId: isLoggingPayment,
        ...paymentData,
        createdAt: serverTimestamp()
      });
      setIsLoggingPayment(null);
      setPaymentData({ amount: 0, date: new Date().toISOString().split('T')[0], notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'membership_payments');
    }
  };

  const translations = {
    en: {
      title: 'Member Organizations',
      subtitle: 'Overview of memberships in organizations and clubs.',
      addBtn: 'Add Membership',
      exportCsv: 'Export CSV',
      exportPdf: 'Export PDF',
      formTitleAdd: 'Add New Membership',
      formTitleEdit: 'Edit Membership',
      name: 'Membership Name',
      org: 'Organization',
      memberNum: 'Member Number',
      role: 'Role / Position',
      category: 'Category',
      cost: 'Fee / Cost',
      hasFee: 'Is this a paid membership?',
      free: 'Free',
      currency: 'Currency',
      frequency: 'Frequency',
      startDate: 'Membership Started',
      nextRenewal: 'Next Renewal Date',
      status: 'Status',
      email: 'Contact Email',
      website: 'Website',
      localBranch: 'Local Branch',
      logo: 'Logo',
      logoHint: 'Upload logo or enter URL',
      chooseExisting: 'Choose from files',
      noFiles: 'No images uploaded yet',
      selectImage: 'Select Logo',
      totalAnnualCost: 'Total Annual Cost',
      description: 'Description / Notes',
      save: 'Save Membership',
      update: 'Update Membership',
      lastPayment: 'Last Payment',
      lastPaymentNone: 'No payments recorded yet',
      paid: 'Paid',
      logPayment: 'Log Payment',
      paymentHistory: 'Payment History',
      roles: 'Roles & Positions',
      addRole: 'Add Role',
      editRole: 'Edit Role',
      noRoles: 'No roles recorded',
      current: 'Current',
      roleTitle: 'Role Title',
      noMemberships: 'No organizations yet',
      details: 'Membership Details',
      editShort: 'Edit',
      deleteShort: 'Delete',
      noMembershipsDesc: 'Track your memberships in organizations, clubs, and services.',
      addFirst: 'Add Your First Organization',
      confirmDelete: 'Are you sure you want to delete this membership?',
      reportTitle: 'Membership Report',
      generatedOn: 'Generated on',
      freq: {
        Monthly: 'Monthly',
        Quarterly: 'Quarterly',
        Yearly: 'Yearly',
        'One-time': 'One-time'
      },
      stat: {
        Active: 'Active',
        Inactive: 'Inactive',
        Cancelled: 'Cancelled'
      }
    },
    no: {
      title: 'Medlemsorganisasjoner',
      subtitle: 'Oversikt over medlemskap i organisasjoner og klubber.',
      addBtn: 'Legg til medlemskap',
      exportCsv: 'Eksporter CSV',
      exportPdf: 'Eksporter PDF',
      formTitleAdd: 'Legg til nytt medlemskap',
      formTitleEdit: 'Rediger medlemskap',
      name: 'Medlemskapstype',
      org: 'Organisasjon',
      memberNum: 'Medlemsnummer',
      role: 'Rolle / Posisjon',
      category: 'Kategori',
      cost: 'Avgift / Kostnad',
      hasFee: 'Er dette et betalt medlemskap?',
      free: 'Gratis',
      currency: 'Valuta',
      frequency: 'Frekvens',
      startDate: 'Medlemskapet startet',
      nextRenewal: 'Neste forfall',
      status: 'Status',
      email: 'Kontakt-e-post',
      website: 'Nettside',
      localBranch: 'Lokallag',
      logo: 'Logo',
      logoHint: 'Last opp logo eller skriv inn URL',
      chooseExisting: 'Velg fra filer',
      noFiles: 'Ingen bilder lastet opp ennå',
      selectImage: 'Velg logo',
      totalAnnualCost: 'Total årlig kostnad',
      description: 'Beskrivelse / Notater',
      save: 'Lagre medlemskap',
      update: 'Oppdater medlemskap',
      lastPayment: 'Siste betaling',
      lastPaymentNone: 'Ingen betalinger registrert ennå',
      paid: 'Betalt',
      logPayment: 'Registrer betaling',
      paymentHistory: 'Betalingshistorikk',
      roles: 'Roller og verv',
      addRole: 'Legg til rolle',
      editRole: 'Rediger rolle',
      noRoles: 'Ingen roller registrert',
      current: 'Nåværende',
      roleTitle: 'Rolle',
      noMemberships: 'Ingen organisasjoner ennå',
      details: 'Detaljer om medlemskap',
      editShort: 'Rediger',
      deleteShort: 'Slett',
      noMembershipsDesc: 'Hold oversikt over medlemskapene dine i organisasjoner, klubber og tjenester.',
      addFirst: 'Legg til din første organisasjon',
      confirmDelete: 'Er du sikker på at du vil slette dette medlemskapet?',
      reportTitle: 'Medlemskapsrapport',
      generatedOn: 'Generert den',
      freq: {
        Monthly: 'Månedlig',
        Quarterly: 'Kvartalsvis',
        Yearly: 'Årlig',
        'One-time': 'Engangs'
      },
      stat: {
        Active: 'Aktiv',
        Inactive: 'Inaktiv',
        Cancelled: 'Kansellert'
      }
    }
  };

  const t = translations[lang];

  const calculateTotalAnnual = () => {
    const totals: { [key: string]: number } = {};
    memberships.filter(m => m.status === 'Active').forEach(m => {
      let annualAmount = 0;
      switch (m.frequency) {
        case 'Monthly': annualAmount = m.cost * 12; break;
        case 'Quarterly': annualAmount = m.cost * 4; break;
        case 'Yearly': annualAmount = m.cost; break;
        case 'One-time': annualAmount = m.cost; break; // Treating one-time as current year cost
      }
      totals[m.currency] = (totals[m.currency] || 0) + annualAmount;
    });
    return totals;
  };

  const totalAnnual = calculateTotalAnnual();

  const exportPdf = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text(t.reportTitle, 14, 22);
    
    // Add context
    doc.setFontSize(10);
    doc.text(`${t.generatedOn}: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableHeaders = [
      lang === 'no' ? 'Organisasjon' : 'Organization',
      lang === 'no' ? 'Lokallag' : 'Branch',
      lang === 'no' ? 'Type' : 'Name',
      lang === 'no' ? 'Siste rolle' : 'Last Role',
      lang === 'no' ? 'Kostnad' : 'Cost',
      lang === 'no' ? 'Frekvens' : 'Frequency',
      lang === 'no' ? 'Status' : 'Status'
    ];

    const tableRows = memberships.map(m => [
      m.organization || '',
      m.localBranch || '',
      m.name,
      '', // Role placeholder for PDF export if needed
      `${m.cost} ${m.currency}`,
      t.freq[m.frequency as keyof typeof t.freq],
      t.stat[m.status as keyof typeof t.stat]
    ]);

    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40] }
    });

    doc.save(`memberships_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportReport = () => {
    const headers = lang === 'no' 
      ? ['Navn', 'Organisasjon', 'Lokallag', 'Medlemsnummer', 'Kategori', 'Kostnad', 'Valuta', 'Frekvens', 'Startdato', 'Neste fornyelse', 'Status', 'Kontakt-e-post', 'Nettside', 'Siste betaling', 'Total betalt']
      : ['Name', 'Organization', 'Local Branch', 'Member Number', 'Category', 'Cost', 'Currency', 'Frequency', 'Start Date', 'Next Renewal', 'Status', 'Contact Email', 'Website', 'Last Payment Date', 'Total Paid'];
    
    const rows = memberships.map(m => {
      const mPayments = payments.filter(p => p.membershipId === m.id);
      const lastPayment = mPayments[0]?.date || 'None';
      const totalPaid = mPayments.reduce((sum, p) => sum + p.amount, 0);
      return [
        m.name,
        m.organization || '',
        m.localBranch || '',
        m.memberNumber || '',
        m.category,
        m.cost,
        m.currency,
        t.freq[m.frequency as keyof typeof t.freq],
        m.startDate,
        m.nextRenewalDate || 'N/A',
        t.stat[m.status as keyof typeof t.stat],
        m.contactEmail || '',
        m.website || '',
        lastPayment,
        totalPaid
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `memberships_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'Inactive': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'Cancelled': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 p-6 rounded-3xl border border-white/10">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-white/60">{t.subtitle}</p>
          </div>
          <button 
            onClick={() => setLang(lang === 'en' ? 'no' : 'en')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white"
          >
            <Globe size={12} />
            {lang.toUpperCase()}
          </button>
        </div>

        <div className="flex flex-1 flex-col lg:items-end gap-1 lg:px-6 lg:border-x border-white/10">
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{t.totalAnnualCost}</p>
          <div className="flex flex-col lg:items-end">
            {Object.entries(totalAnnual).length > 0 ? (
              Object.entries(totalAnnual).map(([curr, total]) => (
                <p key={curr} className="text-2xl font-bold text-white leading-none">
                  {total.toLocaleString()} <span className="text-sm text-white/40 font-normal">{curr}</span>
                </p>
              ))
            ) : (
              <p className="text-2xl font-bold text-white/20 leading-none">0 <span className="text-sm text-white/10 font-normal">NOK</span></p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setShowAddForm(true)} icon={Plus}>
            {t.addBtn}
          </Button>
          <Button onClick={exportReport} variant="secondary" icon={Download}>
            {t.exportCsv}
          </Button>
          <Button onClick={exportPdf} variant="secondary" icon={FileText}>
            {t.exportPdf}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {(showAddForm || isEditing) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white/5 p-8 rounded-3xl border border-white/10"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                {isEditing ? <Edit2 className="text-blue-400" /> : <Plus className="text-green-400" />}
                {isEditing ? t.formTitleEdit : t.formTitleAdd}
              </h2>
              <button onClick={() => { setShowAddForm(false); setIsEditing(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="text-white/60" />
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.name}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. Standard Member, Golden Tier"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.org}</label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={e => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. Red Cross, Sport Club"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.memberNum}</label>
                <input
                  type="text"
                  value={formData.memberNumber}
                  onChange={e => setFormData({ ...formData, memberNumber: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. #123456"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.category}</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. Humanitarian, Fitness, Tech"
                />
              </div>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-4">
                  <input
                    type="checkbox"
                    id="hasFee"
                    checked={hasFee}
                    onChange={e => {
                      setHasFee(e.target.checked);
                      if (!e.target.checked) setFormData({ ...formData, cost: 0 });
                    }}
                    className="w-5 h-5 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500"
                  />
                  <label htmlFor="hasFee" className="text-sm font-medium text-white/60 cursor-pointer">{t.hasFee}</label>
                </div>

                {hasFee && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/60">{t.cost}</label>
                      <input
                        type="number"
                        required
                        value={formData.cost}
                        onChange={e => setFormData({ ...formData, cost: Number(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/60">{t.currency}</label>
                      <input
                        type="text"
                        required
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">{t.logo}</label>
                  <div className="flex flex-col gap-3">
                    {formData.logoUrl && (
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-white/10 group">
                        <img src={formData.logoUrl} alt="Logo Preview" className="w-full h-full object-contain bg-white/5" />
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, logoUrl: '' })}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <X size={16} className="text-white" />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-white/60 hover:text-white cursor-pointer transition-all">
                        <Upload size={18} />
                        <span className="text-sm">{lang === 'no' ? 'Last opp' : 'Upload'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowFilePicker(true)}
                        className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-white/60 hover:text-white transition-all"
                      >
                        <ImageIcon size={18} />
                        <span className="text-sm">{t.chooseExisting}</span>
                      </button>
                      <input
                        type="url"
                        value={formData.logoUrl?.startsWith('data:') ? '' : formData.logoUrl}
                        onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                        className="flex-[2] bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder={t.logoHint}
                      />
                    </div>
                  </div>
                </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.frequency}</label>
                <select
                  value={formData.frequency}
                  onChange={e => setFormData({ ...formData, frequency: e.target.value as any })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                >
                  <option value="Monthly">{t.freq.Monthly}</option>
                  <option value="Quarterly">{t.freq.Quarterly}</option>
                  <option value="Yearly">{t.freq.Yearly}</option>
                  <option value="One-time">{t.freq['One-time']}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.startDate}</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.nextRenewal}</label>
                <input
                  type="date"
                  value={formData.nextRenewalDate}
                  onChange={e => setFormData({ ...formData, nextRenewalDate: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.status}</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                >
                  <option value="Active">{t.stat.Active}</option>
                  <option value="Inactive">{t.stat.Inactive}</option>
                  <option value="Cancelled">{t.stat.Cancelled}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.email}</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. contact@org.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.website}</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={e => setFormData({ ...formData, website: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/60">{t.localBranch}</label>
                <input
                  type="text"
                  value={formData.localBranch}
                  onChange={e => setFormData({ ...formData, localBranch: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder={lang === 'no' ? 'f.eks. Oslo Lokallag' : 'e.g. London Branch'}
                />
              </div>
              <div className="lg:col-span-3 space-y-2">
                <label className="text-sm font-medium text-white/60">{t.description}</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors h-24"
                  placeholder="Optional notes about the membership"
                />
              </div>
              <div className="lg:col-span-3 flex justify-end">
                <Button type="submit" icon={Save}>
                  {isEditing ? t.update : t.save}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFilePicker && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#1a1a1a] border border-white/10 p-8 rounded-3xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <ImageIcon className="text-blue-400" />
                  {t.selectImage}
                </h2>
                <button onClick={() => setShowFilePicker(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="text-white/60" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {files.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {files.map(file => (
                      <button
                        key={file.id}
                        onClick={() => {
                          setFormData({ ...formData, logoUrl: file.url });
                          setShowFilePicker(false);
                        }}
                        className="group relative aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-blue-500 transition-all text-left"
                      >
                        <img src={file.url} alt={file.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                          <p className="text-[10px] text-white font-medium truncate">{file.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-white/40">
                    <ImageIcon size={48} className="mb-4 opacity-20" />
                    <p>{t.noFiles}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {memberships.map((m) => {
          const mPayments = payments.filter(p => p.membershipId === m.id);
          const lastPayment = mPayments[0];

          return (
            <motion.div
              key={m.id}
              onClick={() => setSelectedMembershipId(m.id)}
              className="relative aspect-[1.6/1] bg-[#1a1a1a] rounded-[2rem] border border-white/10 overflow-hidden cursor-pointer group transition-all hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98] shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 opacity-50" />
              <div className="relative h-full p-8 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {m.logoUrl ? (
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-white shadow-lg flex items-center justify-center p-2">
                        <img src={m.logoUrl} alt={m.organization} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
                        <ImageIcon className="text-white/20" size={24} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white leading-tight">
                        {m.organization || m.name}
                      </h3>
                      {m.localBranch && (
                        <p className="text-sm text-blue-400/80 font-medium mt-0.5">
                          {m.localBranch}
                        </p>
                      )}
                      <p className="text-xs text-white/40 mt-0.5 font-medium uppercase tracking-wider">
                        {m.name}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] flex-shrink-0 uppercase tracking-widest px-3 py-1 rounded-full border font-bold ${getStatusColor(m.status)}`}>
                    {t.stat[m.status as keyof typeof t.stat]}
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mb-1">
                        {t.cost}
                      </p>
                      {m.cost > 0 ? (
                        <p className="text-2xl font-bold text-white tracking-tight">
                          {m.cost.toLocaleString()} <span className="text-sm text-white/40 font-normal">{m.currency}</span>
                        </p>
                      ) : (
                        <p className="text-2xl font-bold text-green-400 tracking-tight">{t.free}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mb-1">
                        {t.lastPayment}
                      </p>
                      {lastPayment ? (
                        <p className="text-sm font-medium text-white/80">
                          {new Date(lastPayment.date).toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-US')}
                        </p>
                      ) : (
                        <p className="text-sm text-white/20 italic">{lang === 'no' ? 'Ingen' : 'None'}</p>
                      )}
                    </div>
                  </div>
                  {m.memberNumber && (
                    <div className="text-right">
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mb-1">ID</p>
                      <p className="text-sm font-mono text-white/60">{m.memberNumber}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                <div className="bg-white text-black px-6 py-2 rounded-full font-bold shadow-xl">
                  {lang === 'no' ? 'Se detaljer' : 'View Details'}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedMembershipId && (
          <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md overflow-y-auto p-4 md:p-12 custom-scrollbar flex justify-center items-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative my-auto bg-[#1a1a1a] border border-white/10 rounded-[2rem] md:rounded-[3rem] max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col"
            >
              {(() => {
                const m = memberships.find(item => item.id === selectedMembershipId);
                if (!m) return null;
                const mPayments = payments.filter(p => p.membershipId === m.id);
                const lastPayment = mPayments[0];

                return (
                  <>
                    <div className="relative p-6 md:p-10 border-b border-white/5 bg-white/5 flex-shrink-0">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex items-start gap-4 md:gap-8">
                          {m.logoUrl ? (
                            <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl md:rounded-[2rem] overflow-hidden border border-white/10 bg-white shadow-2xl flex items-center justify-center p-3 md:p-4 animate-in fade-in zoom-in duration-500">
                              <img src={m.logoUrl} alt={m.organization} className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl md:rounded-[2rem] border border-white/10 bg-white/5 flex items-center justify-center text-white/20">
                              <ImageIcon size={32} className="md:hidden" />
                              <ImageIcon size={48} className="hidden md:block" />
                            </div>
                          )}
                          <div className="space-y-1 md:space-y-2 pt-1 md:pt-3">
                            <h2 className="text-2xl md:text-4xl font-black text-white leading-tight tracking-tight">{m.organization || m.name}</h2>
                            <p className="text-base md:text-xl text-white/40 font-medium">
                              {m.name}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2 md:mt-3">
                              <span className={`text-[10px] md:text-xs uppercase tracking-widest px-3 py-1 rounded-full border border-white/10 font-bold ${getStatusColor(m.status)}`}>
                                {t.stat[m.status as keyof typeof t.stat]}
                              </span>
                              {m.category && (
                                <span className="text-[10px] md:text-xs uppercase tracking-widest px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/40 font-bold">
                                  {m.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 self-end md:self-start">
                          <button 
                            onClick={() => {
                              setIsEditing(m.id);
                              setFormData(m);
                              setHasFee((m.cost || 0) > 0);
                              setSelectedMembershipId(null);
                            }}
                            className="p-3 md:p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl md:rounded-3xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                            title={t.formTitleEdit}
                          >
                            <Edit2 size={24} />
                          </button>
                          <button 
                            onClick={() => {
                              handleDelete(m.id);
                              setSelectedMembershipId(null);
                            }}
                            className="p-3 md:p-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl md:rounded-3xl transition-all border border-red-500/20 active:scale-95"
                            title={t.deleteShort}
                          >
                            <Trash2 size={24} />
                          </button>
                          <button 
                            onClick={() => setSelectedMembershipId(null)} 
                            className="p-3 md:p-4 hover:bg-white/10 rounded-2xl md:rounded-3xl transition-all active:scale-95"
                          >
                            <X className="text-white/60" size={32} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 p-6 md:p-10 space-y-10">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                        <div className="space-y-2">
                          <p className="text-[10px] md:text-xs text-white/20 uppercase tracking-[0.3em] font-black">{t.cost}</p>
                          {m.cost > 0 ? (
                            <div className="space-y-1">
                              <p className="text-2xl font-bold text-white">{m.cost.toLocaleString()} {m.currency}</p>
                              <p className="text-sm text-white/40">{t.freq[m.frequency as keyof typeof t.freq]}</p>
                            </div>
                          ) : (
                            <p className="text-2xl font-bold text-green-400">{t.free}</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-extrabold">{t.nextRenewal}</p>
                          <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-white/30" />
                            <p className="text-2xl font-bold text-white">
                              {m.nextRenewalDate ? new Date(m.nextRenewalDate).toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-US') : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-extrabold">{t.startDate}</p>
                          <div className="flex items-center gap-2">
                            <Clock size={18} className="text-white/30" />
                            <p className="text-2xl font-bold text-white">
                              {new Date(m.startDate).toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-US')}
                            </p>
                          </div>
                        </div>

                        {m.memberNumber && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-extrabold">{t.memberNum}</p>
                            <p className="text-xl font-mono text-white/80">{m.memberNumber}</p>
                          </div>
                        )}

                        {m.localBranch && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-extrabold">{t.localBranch}</p>
                            <p className="text-xl font-bold text-white/80">{m.localBranch}</p>
                          </div>
                        )}

                        {m.category && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-extrabold">{t.category}</p>
                            <p className="text-xl font-bold text-white/80">{m.category}</p>
                          </div>
                        )}

                        {m.contactEmail && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-extrabold">{t.email}</p>
                            <a href={`mailto:${m.contactEmail}`} className="text-lg font-medium text-blue-400 hover:underline block">
                              {m.contactEmail}
                            </a>
                          </div>
                        )}

                        {m.website && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-extrabold">{t.website}</p>
                            <a href={m.website} target="_blank" rel="noopener noreferrer" className="text-lg font-medium text-blue-400 hover:underline flex items-center gap-1">
                              {m.website} <Globe size={14} />
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                              <Clock size={20} className="text-orange-400" />
                              {t.roles}
                            </h3>
                            <button 
                              onClick={() => {
                                setIsLoggingRole({ membershipId: m.id });
                                setRoleData({ title: '', startDate: new Date().toISOString().split('T')[0], endDate: '' });
                              }}
                              className="text-xs font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                            >
                              <Plus size={14} />
                              {t.addRole}
                            </button>
                          </div>
                          <div className="space-y-3">
                            {roles.length > 0 ? (
                              roles.map(r => (
                                <div key={r.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 group relative">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-white font-bold">{r.title}</p>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => {
                                          setIsLoggingRole({ membershipId: m.id, role: r });
                                          setRoleData({ title: r.title, startDate: r.startDate, endDate: r.endDate || '' });
                                        }}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-blue-400 transition-colors"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteRole(m.id, r.id)}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-xs text-white/40 font-medium">
                                    {new Date(r.startDate).toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-US')} - {r.endDate ? new Date(r.endDate).toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-US') : (lang === 'no' ? 'Nå' : 'Current')}
                                  </p>
                                  {!r.endDate && (
                                    <span className="absolute top-4 right-4 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                  )}
                                </div>
                              ))
                            ) : (
                              <p className="text-white/20 italic p-4">{t.noRoles}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <CreditCard size={20} className="text-green-400" />
                            {t.paymentHistory}
                          </h3>
                          <div className="space-y-3">
                            {mPayments.length > 0 ? (
                              mPayments.map(p => (
                                <div key={p.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                                  <div>
                                    <p className="text-white font-bold">{p.amount} {m.currency}</p>
                                    <p className="text-xs text-white/40">{new Date(p.date).toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-US')}</p>
                                    {p.notes && <p className="text-xs text-white/30 mt-1 italic">{p.notes}</p>}
                                  </div>
                                  <div className="text-green-400">
                                    <CheckCircle size={18} />
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-white/20 italic p-4">{t.lastPaymentNone}</p>
                            )}
                          </div>
                          {m.cost > 0 && (
                            <Button
                              onClick={() => {
                                setIsLoggingPayment(m.id);
                                setPaymentData({ amount: m.cost, date: new Date().toISOString().split('T')[0], notes: '' });
                              }}
                              className="w-full py-4 text-lg rounded-[1.5rem]"
                              icon={CheckCircle}
                            >
                              {t.logPayment}
                            </Button>
                          )}
                        </div>

                        {m.description && (
                          <div className="space-y-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                              <FileText size={20} className="text-blue-400" />
                              {t.description}
                            </h3>
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-white/70 leading-relaxed whitespace-pre-wrap">
                              {m.description}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLoggingRole && (
          <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm overflow-y-auto p-4 custom-scrollbar flex justify-center items-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative my-auto bg-[#1a1a1a] border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Clock className="text-orange-400" />
                  {isLoggingRole.role ? t.editRole : t.addRole}
                </h2>
                <button onClick={() => setIsLoggingRole(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="text-white/60" />
                </button>
              </div>

              <form onSubmit={handleSaveRole} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">{t.roleTitle}</label>
                  <input
                    type="text"
                    required
                    value={roleData.title}
                    onChange={e => setRoleData({ ...roleData, title: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                    placeholder="e.g. Leader, Member, Board"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/60">{lang === 'no' ? 'Startdato' : 'Start Date'}</label>
                    <input
                      type="date"
                      required
                      value={roleData.startDate}
                      onChange={e => setRoleData({ ...roleData, startDate: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/60">{lang === 'no' ? 'Sluttdato' : 'End Date'}</label>
                    <input
                      type="date"
                      value={roleData.endDate}
                      onChange={e => setRoleData({ ...roleData, endDate: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                    />
                    <p className="text-[10px] text-white/30 italic">{lang === 'no' ? 'Tom = Nåværende' : 'Empty = Current'}</p>
                  </div>
                </div>
                <Button type="submit" className="w-full py-4 text-lg" icon={Save}>
                  {lang === 'no' ? 'Lagre rolle' : 'Save Role'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLoggingPayment && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto p-4 custom-scrollbar flex justify-center items-start">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative my-auto bg-[#1a1a1a] border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <CreditCard className="text-green-400" />
                  {t.logPayment}
                </h2>
                <button onClick={() => setIsLoggingPayment(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="text-white/60" />
                </button>
              </div>

              <form onSubmit={handleLogPayment} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">{lang === 'no' ? 'Beløp' : 'Amount'}</label>
                  <input
                    type="number"
                    required
                    value={paymentData.amount}
                    onChange={e => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">{lang === 'no' ? 'Betalingsdato' : 'Payment Date'}</label>
                  <input
                    type="date"
                    required
                    value={paymentData.date}
                    onChange={e => setPaymentData({ ...paymentData, date: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">{lang === 'no' ? 'Notater' : 'Notes'}</label>
                  <input
                    type="text"
                    value={paymentData.notes}
                    onChange={e => setPaymentData({ ...paymentData, notes: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                    placeholder="Optional notes"
                  />
                </div>
                <Button type="submit" className="w-full py-4 text-lg" icon={CheckCircle}>
                  {lang === 'no' ? 'Bekreft betaling' : 'Confirm Payment'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {memberships.length === 0 && !showAddForm && (
        <div className="bg-white/5 p-16 rounded-3xl border border-white/10 text-center space-y-6">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
            <CreditCard size={40} className="text-white/20" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">{t.noMemberships}</h2>
            <p className="text-white/40">{t.noMembershipsDesc}</p>
          </div>
          <Button onClick={() => setShowAddForm(true)} icon={Plus}>
            {t.addFirst}
          </Button>
        </div>
      )}
    </div>
  );
}
