import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Globe, MapPin, Phone, Smartphone, Linkedin, Github, Download, QrCode, Lock, ArrowLeft, X, Nfc, Share2, MoreHorizontal } from 'lucide-react';
import { useProfile } from '../App';
import Button from './ui/Button';
import { auth } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';

export default function VisitingCard() {
  const profile = useProfile();
  const location = useLocation();
  const [showQR, setShowQR] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'writing' | 'success' | 'error'>('idle');
  const [nfcError, setNfcError] = useState<string | null>(null);
  const queryParams = new URLSearchParams(location.search);
  const accessKey = queryParams.get('key')?.trim();

  const currentUrl = `${window.location.origin}${location.pathname}${location.search}`;

  const isAdmin = auth.currentUser && (
    auth.currentUser.email === 'kianoshsolheim@gmail.com' || 
    auth.currentUser.email === 'kianosh@solheim.online'
  );

  const hasAccess = isAdmin || 
    !profile.visitingCardKey || 
    profile.visitingCardKey.trim() === '' || 
    accessKey === profile.visitingCardKey.trim();

  useEffect(() => {
    // Add noindex meta tag
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow, noarchive, nosnippet';
    document.head.appendChild(meta);

    // Add specific AI blocking meta tag
    const aiMeta = document.createElement('meta');
    aiMeta.name = 'googlebot';
    aiMeta.content = 'noindex';
    document.head.appendChild(aiMeta);

    return () => {
      document.head.removeChild(meta);
      document.head.removeChild(aiMeta);
    };
  }, []);

  const handleDownloadVCard = () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${profile.name}
EMAIL:${profile.email}
TEL;TYPE=CELL:${profile.mobile || ''}
TEL;TYPE=WORK,VOICE:${profile.landline || ''}
TEL;TYPE=VOICE:${profile.phone || ''}
ADR:;;${profile.location || ''}
URL:${profile.website || ''}
END:VCARD`;
    
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${profile.name.replace(/\s+/g, '_')}_contact.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNFCWrite = async () => {
    if (!('NDEFReader' in window)) {
      setNfcStatus('error');
      setNfcError('NFC is not supported on this device/browser. Use Chrome on Android.');
      return;
    }

    try {
      setNfcStatus('writing');
      // @ts-ignore - Web NFC is experimental
      const ndef = new window.NDEFReader();
      await ndef.write({
        records: [{ recordType: "url", data: currentUrl }]
      });
      setNfcStatus('success');
      setTimeout(() => setNfcStatus('idle'), 3000);
    } catch (error) {
      console.error("NFC Error:", error);
      setNfcStatus('error');
      setNfcError(error instanceof Error ? error.message : 'Failed to write to NFC tag');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.name}'s Digital Visiting Card`,
          text: `Connect with ${profile.name}`,
          url: currentUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(currentUrl);
      alert('Link copied to clipboard!');
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center text-accent mx-auto">
            <Lock size={40} />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-serif tracking-tight text-ink">Private Access Only</h1>
            <p className="text-ink/60 leading-relaxed">
              This digital visiting card is private. You need a specific access link to view this information.
            </p>
          </div>
          <div className="pt-4">
            <Link to="/">
              <Button variant="outline" icon={ArrowLeft} magnetic={true} className="rounded-2xl">
                Back to Home
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        {/* The Card */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 to-accent/10 rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          
          <div className="relative bg-surface border border-ink/5 rounded-[32px] overflow-hidden shadow-2xl">
            {/* Top Accent Bar */}
            <div className="h-2 bg-accent w-full" />
            
            <div className="p-8 md:p-10 space-y-8">
              {/* Header */}
              <div className="space-y-2">
                <motion.h1 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl font-serif tracking-tight text-ink"
                >
                  {profile.name}
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xs uppercase tracking-[0.2em] text-accent font-bold"
                >
                  {profile.role}
                </motion.p>
              </div>

              {/* Contact Grid */}
              <div className="grid gap-4">
                <ContactItem icon={<Mail size={18} />} label="Email" value={profile.email} href={`mailto:${profile.email}`} delay={0.3} />
                <ContactItem icon={<Globe size={18} />} label="Website" value={profile.website} href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} delay={0.4} />
                <ContactItem icon={<MapPin size={18} />} label="Location" value={profile.location} delay={0.5} />
                {profile.mobile && <ContactItem icon={<Smartphone size={18} />} label="Mobile" value={profile.mobile} href={`tel:${profile.mobile}`} delay={0.6} />}
                {profile.landline && <ContactItem icon={<Phone size={18} />} label="Landline" value={profile.landline} href={`tel:${profile.landline}`} delay={0.7} />}
                {profile.phone && <ContactItem icon={<Phone size={18} />} label="Phone" value={profile.phone} href={`tel:${profile.phone}`} delay={0.8} />}
              </div>

              {/* Actions */}
              <div className="pt-4 flex flex-col gap-3">
                <Button 
                  onClick={handleDownloadVCard}
                  variant="primary" 
                  className="w-full justify-center py-4 rounded-2xl shadow-lg shadow-accent/20"
                  icon={Download}
                  magnetic={true}
                >
                  Save Contact
                </Button>
                
                <div className="flex gap-3">
                  <SocialButton icon={<Linkedin size={20} />} href="https://linkedin.com" />
                  <SocialButton icon={<Github size={20} />} href="https://github.com" />
                  <div className="flex-1" />
                  <div className="relative">
                    <button 
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className={`p-3 rounded-2xl transition-all group/share ${
                        showShareMenu ? 'bg-accent text-paper shadow-lg shadow-accent/20' : 'bg-ink/5 text-ink/20 hover:bg-accent/10 hover:text-accent'
                      }`}
                      title="Share Card"
                    >
                      <Share2 size={24} className={showShareMenu ? 'text-paper' : 'group-hover/share:text-accent transition-colors'} />
                    </button>

                    <AnimatePresence>
                      {showShareMenu && (
                        <>
                          {/* Backdrop to close menu */}
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowShareMenu(false)}
                            className="fixed inset-0 z-40"
                          />
                          
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 10, x: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10, x: 10 }}
                            className="absolute bottom-full right-0 mb-4 bg-surface border border-ink/10 rounded-3xl shadow-2xl p-3 flex flex-col gap-2 z-50 min-w-[200px]"
                          >
                            <button 
                              onClick={() => {
                                handleNFCWrite();
                                setShowShareMenu(false);
                              }}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/10 text-ink/60 hover:text-accent transition-all group/item"
                            >
                              <div className="w-8 h-8 rounded-lg bg-ink/5 flex items-center justify-center group-hover/item:bg-accent/20">
                                <Nfc size={18} />
                              </div>
                              <span className="text-[10px] uppercase tracking-widest font-bold">Write to NFC</span>
                            </button>

                            <button 
                              onClick={() => {
                                setShowQR(true);
                                setShowShareMenu(false);
                              }}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/10 text-ink/60 hover:text-accent transition-all group/item"
                            >
                              <div className="w-8 h-8 rounded-lg bg-ink/5 flex items-center justify-center group-hover/item:bg-accent/20">
                                <QrCode size={18} />
                              </div>
                              <span className="text-[10px] uppercase tracking-widest font-bold">Show QR Code</span>
                            </button>

                            <div className="h-px bg-ink/5 mx-2" />

                            <button 
                              onClick={() => {
                                handleNativeShare();
                                setShowShareMenu(false);
                              }}
                              className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/10 text-ink/60 hover:text-accent transition-all group/item"
                            >
                              <div className="w-8 h-8 rounded-lg bg-ink/5 flex items-center justify-center group-hover/item:bg-accent/20">
                                <MoreHorizontal size={18} />
                              </div>
                              <span className="text-[10px] uppercase tracking-widest font-bold">More Options</span>
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NFC Modal */}
        <AnimatePresence>
          {nfcStatus !== 'idle' && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setNfcStatus('idle')}
                className="absolute inset-0 bg-paper/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-surface border border-ink/10 p-8 rounded-[32px] shadow-2xl max-w-sm w-full text-center space-y-6"
              >
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto ${
                  nfcStatus === 'writing' ? 'bg-accent/10 text-accent animate-pulse' :
                  nfcStatus === 'success' ? 'bg-green-500/10 text-green-500' :
                  'bg-red-500/10 text-red-500'
                }`}>
                  <Nfc size={40} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-serif text-ink">
                    {nfcStatus === 'writing' ? 'Ready to Write' : 
                     nfcStatus === 'success' ? 'Tag Written!' : 'NFC Error'}
                  </h3>
                  <p className="text-xs uppercase tracking-widest text-ink/40 font-bold">
                    {nfcStatus === 'writing' ? 'Hold your phone near the tag' : 
                     nfcStatus === 'success' ? 'Your card is now on the tag' : 'Something went wrong'}
                  </p>
                </div>

                {nfcStatus === 'error' && (
                  <p className="text-xs text-red-500 bg-red-500/5 p-4 rounded-2xl leading-relaxed">
                    {nfcError}
                  </p>
                )}

                <Button 
                  onClick={() => setNfcStatus('idle')}
                  variant="outline" 
                  className="w-full rounded-2xl"
                >
                  {nfcStatus === 'success' ? 'Done' : 'Cancel'}
                </Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* QR Modal */}
        <AnimatePresence>
          {showQR && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowQR(false)}
                className="absolute inset-0 bg-paper/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-surface border border-ink/10 p-8 rounded-[32px] shadow-2xl max-w-sm w-full text-center space-y-6"
              >
                <button 
                  onClick={() => setShowQR(false)}
                  className="absolute top-4 right-4 p-2 text-ink/20 hover:text-accent transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="space-y-2">
                  <h3 className="text-xl font-serif text-ink">Scan to Connect</h3>
                  <p className="text-xs uppercase tracking-widest text-ink/40 font-bold">Direct Access Link</p>
                </div>

                <div className="bg-white p-6 rounded-3xl inline-block shadow-inner border border-ink/5">
                  <QRCodeSVG 
                    value={currentUrl} 
                    size={200}
                    level="H"
                    includeMargin={false}
                    fgColor="currentColor"
                    className="text-ink"
                  />
                </div>

                <p className="text-[10px] text-ink/40 leading-relaxed max-w-[200px] mx-auto">
                  Scan this code to instantly view and save my contact information.
                </p>

                <Button 
                  onClick={() => setShowQR(false)}
                  variant="outline" 
                  className="w-full rounded-2xl"
                >
                  Close
                </Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <p className="text-center mt-8 text-[10px] uppercase tracking-[0.3em] text-ink/20">
          Digital Visiting Card • {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}

function ContactItem({ icon, label, value, href, delay }: { icon: React.ReactNode, label: string, value: string, href?: string, delay: number }) {
  const Content = (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-4 p-3 rounded-2xl hover:bg-ink/5 transition-colors group/item"
    >
      <div className="w-10 h-10 rounded-xl bg-ink/5 flex items-center justify-center text-ink/40 group-hover/item:text-accent group-hover/item:bg-accent/10 transition-all">
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-ink/30 font-bold">{label}</p>
        <p className="text-sm text-ink/80 font-medium">{value}</p>
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {Content}
      </a>
    );
  }

  return Content;
}

function SocialButton({ icon, href }: { icon: React.ReactNode, href: string }) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="w-12 h-12 rounded-2xl bg-ink/5 flex items-center justify-center text-ink/40 hover:text-accent hover:bg-accent/10 transition-all"
    >
      {icon}
    </a>
  );
}
