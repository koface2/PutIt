import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Camera, Search, Home, Plus, MapPin, Tag, X, Check, Image as ImageIcon, Sparkles, Heart, Loader2, AlertCircle, Trash2, ChevronLeft, Users, Copy, LogOut } from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// 🔥 PASTE YOUR FIREBASE CONFIG HERE 🔥
const firebaseConfig = {
  apiKey: "AIzaSyAfDUhdxBH7cEtJ70X_Ufrm0f0n_DNAUUo",
  authDomain: "putit-92fd8.firebaseapp.com",
  projectId: "putit-92fd8",
  storageBucket: "putit-92fd8.firebasestorage.app",
  messagingSenderId: "267872873156",
  appId: "1:267872873156:web:4d379f1f228a0765183791"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const compressImage = (file, maxWidth = 800) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [activeHousehold, setActiveHousehold] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [syncInput, setSyncInput] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState(['Closet', 'Vanity', 'Jewelry Box', 'Safe', 'Kitchen']);
  const [searchQuery, setSearchQuery] = useState('');
  
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [newItem, setNewItem] = useState({ name: '', location: '', details: '', tags: '', imagePreview: null, imageFile: null });
  const [locSuggestionsOpen, setLocSuggestionsOpen] = useState(false);
  const [tagSuggestionsOpen, setTagSuggestionsOpen] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editErrorMsg, setEditErrorMsg] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const allTags = useMemo(() => [...new Set(items.flatMap(i => i.tags || []))], [items]);
  const currentTagInput = newItem.tags.split(',').pop().trim().toLowerCase();
  const currentTagSuggestions = useMemo(() => {
    if (!currentTagInput) return [];
    return allTags.filter(t => t.toLowerCase().includes(currentTagInput) && t.toLowerCase() !== currentTagInput);
  }, [currentTagInput, allTags]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
       setUser(currentUser);
       if (currentUser) {
         const savedHousehold = localStorage.getItem(`household_${currentUser.uid}`);
         setActiveHousehold(savedHousehold || currentUser.uid);
       }
       setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !activeHousehold) return;
    const itemsRef = collection(db, 'households', activeHousehold, 'items');
    const unsubscribe = onSnapshot(itemsRef, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedItems.sort((a, b) => b.createdAt - a.createdAt);
      setItems(fetchedItems);
      const uniqueLocations = [...new Set(fetchedItems.map(item => item.location))];
      if (uniqueLocations.length > 0) setLocations(uniqueLocations);
    });
    return () => unsubscribe();
  }, [user, activeHousehold]);

  const handleGoogleLogin = async () => { try { setAuthError(''); await signInWithPopup(auth, new GoogleAuthProvider()); } catch (error) { setAuthError("Could not sign in with Google."); } };
  const handleGuestLogin = async () => { try { setAuthError(''); await signInAnonymously(auth); } catch (error) { setAuthError("Could not sign in as guest."); } };
  const handleLogout = () => { setShowSettings(false); signOut(auth); };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user.uid);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleJoinHousehold = () => {
    if (syncInput.trim().length > 5) {
      const newHousehold = syncInput.trim();
      setActiveHousehold(newHousehold);
      localStorage.setItem(`household_${user.uid}`, newHousehold);
      setSyncInput('');
      setShowSettings(false);
      alert("Successfully linked to new household catalog! 🌸");
    }
  };

  const handleLeaveHousehold = () => {
    setActiveHousehold(user.uid);
    localStorage.removeItem(`household_${user.uid}`);
    setShowSettings(false);
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const lowerQuery = searchQuery.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(lowerQuery) || item.location.toLowerCase().includes(lowerQuery) || (item.tags && item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))));
  }, [items, searchQuery]);

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) { setNewItem({ ...newItem, imagePreview: URL.createObjectURL(file), imageFile: file }); setErrorMsg(''); }
  };

  const handleSaveItem = async () => {
    setErrorMsg('');
    if (!newItem.name || !newItem.location) { setErrorMsg("Please provide a name and location! 🌸"); return; }
    setIsSaving(true);
    try {
      let secureBase64Image = null;
      if (newItem.imageFile) secureBase64Image = await compressImage(newItem.imageFile);
      const tagsArray = newItem.tags.split(',').map(tag => tag.trim()).filter(Boolean);
      const itemId = Date.now().toString();
      const itemToSave = { name: newItem.name, location: newItem.location, details: newItem.details, tags: tagsArray, imageUrl: secureBase64Image, createdAt: Date.now() };
      await setDoc(doc(db, 'households', activeHousehold, 'items', itemId), itemToSave);
      setNewItem({ name: '', location: '', details: '', tags: '', imagePreview: null, imageFile: null });
      setActiveTab('home');
    } catch (error) { setErrorMsg("Couldn't save item. Check connection."); } 
    finally { setIsSaving(false); }
  };

  const openEdit = (item) => { setEditingItem({ ...item, tagsString: item.tags ? item.tags.join(', ') : '' }); setShowDeleteConfirm(false); setEditErrorMsg(''); };

  const handleUpdateItem = async () => {
    setEditErrorMsg('');
    if (!editingItem.name || !editingItem.location) { setEditErrorMsg("Name and location required! 🌸"); return; }
    setIsUpdating(true);
    try {
      const tagsArray = editingItem.tagsString.split(',').map(tag => tag.trim()).filter(Boolean);
      await updateDoc(doc(db, 'households', activeHousehold, 'items', editingItem.id), { name: editingItem.name, location: editingItem.location, details: editingItem.details || '', tags: tagsArray });
      setEditingItem(null);
    } catch (error) { setEditErrorMsg("Couldn't update item."); } 
    finally { setIsUpdating(false); }
  };

  const handleDeleteItem = async () => {
    setIsUpdating(true);
    try {
      await deleteDoc(doc(db, 'households', activeHousehold, 'items', editingItem.id));
      setEditingItem(null);
    } catch (error) { setEditErrorMsg("Couldn't delete item."); } 
    finally { setIsUpdating(false); }
  };

  if (isLoading) return <div className="min-h-screen bg-[#FFFBFB] flex flex-col items-center justify-center text-pink-400"><Loader2 className="w-10 h-10 animate-spin mb-4" /><p className="font-bold tracking-wider uppercase text-xs">Loading...</p></div>;
  if (!user) return (
    <div className="min-h-screen bg-[#FFFBFB] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mb-6 shadow-sm"><Heart className="w-10 h-10 text-pink-400 fill-pink-400" /></div>
      <h1 className="text-3xl font-extrabold tracking-tight text-stone-800 mb-2">Welcome to Catalog</h1>
      <p className="text-sm text-stone-500 font-medium mb-10">Organize your beautiful space.</p>
      {authError && <div className="bg-red-50 text-red-500 p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold mb-6 w-full max-w-sm"><AlertCircle className="w-4 h-4" /> {authError}</div>}
      <button onClick={handleGoogleLogin} className="w-full max-w-sm bg-white border border-pink-100 hover:bg-pink-50 text-stone-700 font-bold py-4 rounded-2xl flex justify-center items-center gap-3 transition-all active:scale-[0.98] mb-4 shadow-sm">
        <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.58c2.1-1.92 3.31-4.74 3.31-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.58-2.77c-.98.66-2.23 1.06-3.7 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg> Continue with Google
      </button>
      <button onClick={handleGuestLogin} className="w-full max-w-sm bg-pink-50 hover:bg-pink-100 text-pink-600 font-bold py-4 rounded-2xl flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-sm">Continue as Guest</button>
    </div>
  );

  const isLinkedToPartner = activeHousehold !== user.uid;

  return (
    <div className="min-h-screen bg-[#FFFBFB] font-sans text-stone-800 pb-32 selection:bg-pink-200">
      <header className="px-6 pt-12 pb-4 sticky top-0 z-10 flex justify-between items-end bg-[#FFFBFB]/80 backdrop-blur-xl">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-800 flex items-center gap-2">
            Catalog <Sparkles className="w-5 h-5 text-pink-400" />
          </h1>
          <p className="text-[10px] text-pink-500 font-bold mt-1 tracking-widest uppercase flex items-center gap-1">
            <Users className="w-3 h-3" /> {isLinkedToPartner ? 'Linked Household' : 'My Household'}
          </p>
        </div>
        <button onClick={() => setShowSettings(true)} className="h-11 w-11 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-sm tracking-wider shadow-sm border border-pink-200/50 overflow-hidden relative hover:scale-105 transition-transform">
           {user?.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <span className="z-10">{user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'G'}</span>}
           {!user?.photoURL && <div className="absolute inset-0 bg-pink-200/50 backdrop-blur-sm flex items-center justify-center"><Heart className="w-4 h-4 fill-pink-400 text-pink-400 opacity-20" /></div>}
        </button>
      </header>

      <main className="max-w-2xl mx-auto w-full px-5 pt-4">
        {activeTab === 'home' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`bg-gradient-to-br ${isLinkedToPartner ? 'from-purple-400 to-indigo-400' : 'from-pink-400 to-rose-400'} rounded-[2rem] p-7 text-white shadow-xl shadow-pink-200/50 relative overflow-hidden transition-colors duration-500`}>
              <div className="absolute -right-4 -top-4 p-8 opacity-10"><Heart className="w-48 h-48 fill-white" /></div>
              <div className="relative z-10">
                <h2 className="text-white/80 font-bold text-[10px] uppercase tracking-[0.2em] mb-1">Total Items</h2>
                <div className="text-6xl font-semibold tracking-tight">{items.length}</div>
                <div className="mt-8 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                  {locations.slice(0, 4).map(loc => <span key={loc} className="bg-white/20 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap tracking-wide">{loc}</span>)}
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-4 px-1">
                <h3 className="text-lg font-bold text-stone-800 tracking-tight">Recent Additions</h3>
                <button onClick={() => setActiveTab('search')} className="text-xs text-pink-500 font-bold hover:text-pink-600 transition-colors uppercase tracking-wider">See All</button>
              </div>
              <div className="grid gap-3.5">
                {items.length === 0 ? (
                  <div className="bg-pink-50/50 rounded-2xl p-6 text-center border border-pink-100 border-dashed">
                    <p className="text-sm text-stone-500 font-medium">This catalog is empty.</p>
                    <button onClick={() => setActiveTab('add')} className="mt-3 text-pink-500 font-bold text-xs uppercase tracking-wider">Add your first item</button>
                  </div>
                ) : items.slice(0, 5).map(item => <ItemCard key={item.id} item={item} onEdit={openEdit} />)}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="relative group shadow-sm rounded-2xl bg-white border border-pink-50">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300 w-5 h-5 transition-colors group-focus-within:text-pink-500" />
               <input type="text" placeholder="Find a dress, tool, or document..." className="w-full bg-transparent pl-12 pr-12 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all text-sm font-medium placeholder:text-stone-400 text-stone-700" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
               {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 bg-pink-50 p-1 rounded-full text-pink-400 hover:text-pink-600 hover:bg-pink-100 transition-all"><X className="w-4 h-4" /></button>}
             </div>
             <div className="grid gap-3.5">
               {filteredItems.length === 0 ? (
                 <div className="text-center py-16 text-stone-400">
                   <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-4"><Search className="w-8 h-8 text-pink-200" /></div>
                   <p className="font-medium text-stone-500">No matching items found.</p>
                 </div>
               ) : filteredItems.map(item => <ItemCard key={item.id} item={item} onEdit={openEdit} />)}
             </div>
           </div>
        )}

        {activeTab === 'add' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-1"><h2 className="text-2xl font-extrabold text-stone-800 tracking-tight">New Treasure</h2></div>
            <div className="space-y-5">
              <div className="bg-white p-2.5 rounded-[2rem] shadow-sm border border-pink-50">
                <div className="relative bg-[#FFFBFB] rounded-[1.5rem] aspect-square sm:aspect-video flex flex-col items-center justify-center border-2 border-dashed border-pink-100 overflow-hidden group">
                  {newItem.imagePreview ? (
                    <div className="relative w-full h-full group/img">
                      <img src={newItem.imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-stone-900/30 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity gap-4 backdrop-blur-sm">
                        <button onClick={() => cameraInputRef.current?.click()} className="bg-white/90 p-3.5 rounded-full text-pink-500"><Camera className="w-5 h-5" /></button>
                        <button onClick={() => galleryInputRef.current?.click()} className="bg-white/90 p-3.5 rounded-full text-pink-500"><ImageIcon className="w-5 h-5" /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 w-full px-6">
                      <button onClick={() => cameraInputRef.current?.click()} className="flex-1 flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-sm shadow-pink-100/50 border border-pink-50 text-stone-500 hover:border-pink-200 hover:text-pink-500 transition-all active:scale-95 group/btn">
                        <div className="bg-pink-50 p-4 rounded-full mb-3"><Camera className="w-6 h-6 text-pink-400 group-hover/btn:text-pink-500" /></div>
                        <span className="text-[11px] font-bold tracking-widest text-stone-600">CAMERA</span>
                      </button>
                      <button onClick={() => galleryInputRef.current?.click()} className="flex-1 flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-sm shadow-pink-100/50 border border-pink-50 text-stone-500 hover:border-pink-200 hover:text-pink-500 transition-all active:scale-95 group/btn">
                        <div className="bg-pink-50 p-4 rounded-full mb-3"><ImageIcon className="w-6 h-6 text-pink-400 group-hover/btn:text-pink-500" /></div>
                        <span className="text-[11px] font-bold tracking-widest text-stone-600">GALLERY</span>
                      </button>
                    </div>
                  )}
                  <input type="file" accept="image/jpeg, image/png, image/jpg" capture="environment" className="hidden" ref={cameraInputRef} onChange={handlePhotoCapture} />
                  <input type="file" accept="image/*" className="hidden" ref={galleryInputRef} onChange={handlePhotoCapture} />
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-50 space-y-5">
                {errorMsg && <div className="bg-red-50 text-red-500 p-3 rounded-xl flex items-center gap-2 text-sm font-semibold animate-in fade-in"><AlertCircle className="w-4 h-4" /> {errorMsg}</div>}
                <div>
                  <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-2 ml-1">What is it?</label>
                  <input type="text" placeholder="e.g. Silk Scarf" className="w-full bg-[#FFFBFB] border border-pink-100 px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white text-sm font-semibold text-stone-700" value={newItem.name} onChange={(e) => { setNewItem({...newItem, name: e.target.value}); setErrorMsg(''); }} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-2 ml-1">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300 w-4 h-4" />
                    <input type="text" placeholder="e.g. Closet" className="w-full bg-[#FFFBFB] border border-pink-100 pl-11 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white text-sm font-semibold text-stone-700" value={newItem.location} onFocus={() => setLocSuggestionsOpen(true)} onBlur={() => setTimeout(() => setLocSuggestionsOpen(false), 200)} onChange={(e) => { setNewItem({...newItem, location: e.target.value}); setErrorMsg(''); setLocSuggestionsOpen(true); }} />
                    {locSuggestionsOpen && locations.filter(l => l.toLowerCase().includes(newItem.location.toLowerCase()) && l !== newItem.location).length > 0 && (
                      <ul className="absolute z-10 w-full bg-white border border-pink-100 rounded-xl mt-1 max-h-40 overflow-y-auto shadow-lg shadow-pink-100/50 py-1">
                        {locations.filter(l => l.toLowerCase().includes(newItem.location.toLowerCase()) && l !== newItem.location).map(loc => (
                          <li key={loc} onMouseDown={(e) => { e.preventDefault(); setNewItem({...newItem, location: loc}); setLocSuggestionsOpen(false); }} className="px-4 py-2 text-sm text-stone-700 hover:bg-pink-50 cursor-pointer font-medium">{loc}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-2 ml-1">Details (Optional)</label>
                  <input type="text" placeholder="e.g. Bottom drawer" className="w-full bg-[#FFFBFB] border border-pink-100 px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white text-sm font-semibold text-stone-700" value={newItem.details} onChange={(e) => setNewItem({...newItem, details: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-2 ml-1">Tags (Optional)</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300 w-4 h-4" />
                    <input type="text" placeholder="winter, accessories" className="w-full bg-[#FFFBFB] border border-pink-100 pl-11 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white text-sm font-semibold text-stone-700" value={newItem.tags} onFocus={() => setTagSuggestionsOpen(true)} onBlur={() => setTimeout(() => setTagSuggestionsOpen(false), 200)} onChange={(e) => { setNewItem({...newItem, tags: e.target.value}); setTagSuggestionsOpen(true); }} />
                    {tagSuggestionsOpen && currentTagSuggestions.length > 0 && (
                      <ul className="absolute bottom-full z-10 w-full bg-white border border-pink-100 rounded-xl mb-1 max-h-40 overflow-y-auto shadow-lg shadow-pink-100/50 py-1">
                        {currentTagSuggestions.map(tag => (
                          <li key={tag} onMouseDown={(e) => { e.preventDefault(); const tagsParts = newItem.tags.split(','); tagsParts.pop(); const cleanedParts = tagsParts.map(p => p.trim()).filter(Boolean); const newTagsStr = [...cleanedParts, tag].join(', ') + (cleanedParts.length > 0 || tag ? ', ' : ''); setNewItem({...newItem, tags: newTagsStr}); setTagSuggestionsOpen(false); }} className="px-4 py-2 text-sm text-stone-700 hover:bg-pink-50 cursor-pointer font-medium">{tag}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <button onClick={handleSaveItem} disabled={isSaving} className="w-full bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all active:scale-[0.98] mt-2 shadow-lg shadow-pink-200/50 disabled:opacity-70">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  {isSaving ? 'Saving...' : 'Save to Catalog'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-sm bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl shadow-pink-100/60 z-50 overflow-hidden border border-pink-50">
        <div className="flex justify-around items-center px-3 py-2.5">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-300 ${activeTab === 'home' ? 'text-white bg-pink-400 shadow-md shadow-pink-200' : 'text-stone-400 hover:text-pink-300 hover:bg-pink-50'}`}><Home className="w-5 h-5" /></button>
          <button onClick={() => setActiveTab('add')} className={`flex items-center justify-center p-3 rounded-2xl transition-all duration-300 ${activeTab === 'add' ? 'text-white bg-pink-400 shadow-md shadow-pink-200' : 'text-stone-400 hover:text-pink-300 hover:bg-pink-50'}`}><Plus className="w-6 h-6" /></button>
          <button onClick={() => setActiveTab('search')} className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-300 ${activeTab === 'search' ? 'text-white bg-pink-400 shadow-md shadow-pink-200' : 'text-stone-400 hover:text-pink-300 hover:bg-pink-50'}`}><Search className="w-5 h-5" /></button>
        </div>
      </nav>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-[#FFFBFB] z-[100] overflow-y-auto flex flex-col animate-in slide-in-from-bottom-8 duration-300 pb-safe">
          <header className="px-5 py-4 sticky top-0 z-10 flex justify-between items-center bg-[#FFFBFB]/90 backdrop-blur-xl border-b border-pink-50">
            <button onClick={() => setShowSettings(false)} className="p-2 -ml-2 rounded-full hover:bg-pink-50 text-stone-500 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
            <h2 className="text-lg font-bold text-stone-800 tracking-tight">Household Settings</h2>
            <div className="w-6" />
          </header>
          <div className="p-5 space-y-6 flex-1 max-w-2xl mx-auto w-full">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-50 space-y-5">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-pink-200 overflow-hidden">
                  {user?.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <Users className="w-8 h-8 text-pink-400" />}
                </div>
                <h3 className="font-bold text-stone-800 text-lg">{user?.displayName || 'Guest User'}</h3>
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mt-1">
                  {isLinkedToPartner ? 'Linked to Partner Account' : 'Main Account'}
                </p>
              </div>

              {!isLinkedToPartner ? (
                <div className="bg-pink-50/50 p-4 rounded-[1.5rem] border border-pink-100">
                  <label className="block text-[11px] font-bold text-pink-500 uppercase tracking-widest mb-2 text-center">Your Secret Sync Code</label>
                  <p className="text-xs text-stone-500 text-center mb-3">Send this to someone to let them add items to your catalog.</p>
                  <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-pink-100">
                    <input type="text" readOnly value={user.uid} className="w-full bg-transparent text-xs text-stone-600 font-mono tracking-wider focus:outline-none px-2" />
                    <button onClick={handleCopyCode} className={`p-2 rounded-lg text-white font-bold text-xs transition-all ${copySuccess ? 'bg-green-400' : 'bg-pink-400 hover:bg-pink-500'}`}>
                      {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-purple-50 p-4 rounded-[1.5rem] border border-purple-100 text-center">
                  <p className="text-sm font-bold text-purple-700 mb-3">You are currently syncing with someone else's catalog.</p>
                  <button onClick={handleLeaveHousehold} className="bg-white border border-purple-200 text-purple-600 font-bold py-2 px-4 rounded-xl text-xs hover:bg-purple-100 transition-colors">
                    Disconnect & Return to My Catalog
                  </button>
                </div>
              )}

              {!isLinkedToPartner && (
                <div className="pt-4 border-t border-pink-50">
                  <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-2">Join a Partner's Catalog</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Paste their Sync Code here" value={syncInput} onChange={(e) => setSyncInput(e.target.value)} className="flex-1 bg-[#FFFBFB] border border-pink-100 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white text-xs font-semibold text-stone-700 font-mono" />
                    <button onClick={handleJoinHousehold} disabled={!syncInput.trim()} className="bg-stone-800 text-white font-bold px-4 rounded-xl text-xs disabled:opacity-50 hover:bg-stone-700 transition-colors">Join</button>
                  </div>
                </div>
              )}
              <button onClick={handleLogout} className="w-full flex justify-center items-center gap-2 border-2 border-red-50 text-red-400 font-bold py-4 rounded-xl mt-4 hover:bg-red-50 transition-colors text-sm">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 bg-[#FFFBFB] z-[100] overflow-y-auto flex flex-col animate-in slide-in-from-bottom-8 duration-300 pb-safe">
          <header className="px-5 py-4 sticky top-0 z-10 flex justify-between items-center bg-[#FFFBFB]/90 backdrop-blur-xl border-b border-pink-50">
            <button onClick={() => setEditingItem(null)} className="p-2 -ml-2 rounded-full hover:bg-pink-50 text-stone-500 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
            <h2 className="text-lg font-bold text-stone-800 tracking-tight">Edit Treasure</h2>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 -mr-2 rounded-full hover:bg-red-50 text-red-400 transition-colors"><Trash2 className="w-5 h-5" /></button>
          </header>
          <div className="p-5 space-y-5 flex-1 max-w-2xl mx-auto w-full">
            {showDeleteConfirm && (
              <div className="bg-red-50 p-5 rounded-[1.5rem] border border-red-100 mb-6 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-sm text-red-600 font-bold mb-4">Are you sure you want to delete this item? This cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={handleDeleteItem} disabled={isUpdating} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-red-200 transition-all active:scale-95 flex justify-center">{isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yes, Delete'}</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-white hover:bg-stone-50 text-stone-600 border border-stone-200 py-3 rounded-xl font-bold text-sm transition-all active:scale-95">Cancel</button>
                </div>
              </div>
            )}
            {editingItem.imageUrl && <div className="w-full aspect-video bg-pink-50 rounded-[1.5rem] overflow-hidden mb-2 border border-pink-100 shadow-sm"><img src={editingItem.imageUrl} alt="Preview" className="w-full h-full object-cover" /></div>}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-50 space-y-5">
              {editErrorMsg && <div className="bg-red-50 text-red-500 p-3 rounded-xl flex items-center gap-2 text-sm font-semibold animate-in fade-in"><AlertCircle className="w-4 h-4" /> {editErrorMsg}</div>}
              <div><label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-2 ml-1">What is it?</label><input type="text" className="w-full bg-[#FFFBFB] border border-pink-100 px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white text-sm font-semibold text-stone-700" value={editingItem.name} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} /></div>
              <div>
                <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-2 ml-1">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300 w-4 h-4" />
                  <input type="text" list="edit-locations-list" className="w-full bg-[#FFFBFB] border border-pink-100 pl-11 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white text-sm font-semibold text-stone-700" value={editingItem.location} onChange={(e) => setEditingItem({...editingItem, location: e.target.value})} />
                  <datalist id="edit-locations-list">{locations.map(loc => <option key={loc} value={loc} />)}</datalist>
                </div>
              </div>
              <div><label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-2 ml-1">Details</label><input type="text" className="w-full bg-[#FFFBFB] border border-pink-100 px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white text-sm font-semibold text-stone-700" value={editingItem.details} onChange={(e) => setEditingItem({...editingItem, details: e.target.value})} /></div>
              <div>
                <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-2 ml-1">Tags (Comma Separated)</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300 w-4 h-4" />
                  <input type="text" className="w-full bg-[#FFFBFB] border border-pink-100 pl-11 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white text-sm font-semibold text-stone-700" value={editingItem.tagsString} onChange={(e) => setEditingItem({...editingItem, tagsString: e.target.value})} />
                </div>
              </div>
              <button onClick={handleUpdateItem} disabled={isUpdating} className="w-full bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all active:scale-[0.98] mt-4 shadow-lg shadow-pink-200/50 disabled:opacity-70">
                {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, onEdit }) {
  return (
    <div onClick={() => onEdit(item)} className="bg-white p-3.5 rounded-[1.25rem] shadow-[0_4px_12px_-4px_rgba(252,165,165,0.15)] border border-pink-50 flex gap-4 items-center group cursor-pointer hover:shadow-md hover:shadow-pink-100 transition-all active:scale-[0.98]">
      <div className="w-20 h-20 rounded-2xl bg-[#FFFBFB] flex-shrink-0 flex items-center justify-center overflow-hidden border border-pink-50">
        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-pink-200" />}
      </div>
      <div className="flex-1 min-w-0 py-1">
        <h4 className="font-bold text-stone-800 truncate text-base tracking-tight">{item.name}</h4>
        <div className="flex items-center text-xs text-stone-500 mt-1 font-medium"><MapPin className="w-3.5 h-3.5 mr-1 text-pink-400 flex-shrink-0" /><span className="truncate">{item.location}</span></div>
        {item.details && <div className="text-[11px] text-stone-400 mt-1.5 ml-5 border-l-2 border-pink-200 pl-2 italic truncate">{item.details}</div>}
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto hide-scrollbar">
            {item.tags.map(tag => <span key={tag} className="text-[10px] uppercase tracking-[0.05em] font-bold bg-pink-50 text-pink-500 px-2.5 py-1 rounded-full whitespace-nowrap">{tag}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
