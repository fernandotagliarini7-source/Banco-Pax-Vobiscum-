/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, ReactNode, useRef, FormEvent, Fragment } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  History, 
  Plus, 
  Search, 
  LayoutDashboard,
  Send,
  Receipt,
  User,
  Bell,
  MoreVertical,
  MinusCircle,
  PlusCircle,
  X,
  CheckCircle2,
  LogIn,
  LogOut,
  Users as UsersIcon,
  UserCircle,
  Settings,
  Mail,
  FileText,
  ShieldAlert,
  Crown,
  Gavel,
  Ban,
  Clock,
  TrendingDown,
  TrendingUp,
  Shield,
  Landmark,
  ShoppingBag,
  Store,
  Package,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  RotateCcw,
  Menu,
  BookOpen,
  PlayCircle,
  Edit,
  Save,
  Award,
  Star,
  Trash2,
  ChevronDown,
  Layout,
  Eye,
  Book,
  FileQuestion,
  Lightbulb,
  Compass,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Transaction, TransactionType, UserAccount, UserRank, Bill, MarketListing, MarketOrder, Loan, Course, PurchasedCourse, Lesson, Module } from './types';
import { auth, db, googleProvider, signInWithPopup, signOut } from './lib/firebase';
import { 
  ECONOMIC_LEVELS, 
  KNOWLEDGE_ACTION_POINTS, 
  KP_PER_LEVEL, 
  calculateEconomicLevel, 
  getKnowledgeProgress 
} from './lib/progression';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  where, 
  addDoc, 
  serverTimestamp,
  updateDoc,
  increment,
  limit,
  Timestamp
} from 'firebase/firestore';

// Mock Initial Data (for new users)
const DEFAULT_ACCOUNT: Omit<UserAccount, 'id' | 'name' | 'email' | 'rank'> = {
  description: "Entusiasta de Banco Pax vobiscum",
  balance: 0,
  accountNumber: "0000 0000 0000 0000",
  economicLevel: 1,
  knowledgePoints: 0,
  knowledgeLevel: 1
};

const INITIAL_TRANSACTIONS: Transaction[] = [];
const MAX_BALANCE = 1000000;

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'payments' | 'transfers' | 'profile' | 'users' | 'bank_mode' | 'market' | 'market_admin' | 'loans' | 'courses' | 'manual'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [banMessage, setBanMessage] = useState<string | null>(null);

  // Auth and Profile sync
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Listener em tempo real para o documento do usuário
        unsubscribeProfile = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser(docSnap.data() as UserAccount);
          } else {
            // Documento não existe, criar novo (primeiro acesso)
            const newAccount: UserAccount = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'Usuário Imperial',
              email: firebaseUser.email || '',
              description: "Entusiasta de Banco Pax vobiscum",
              balance: 0,
              accountNumber: `7777 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
              rank: 'cidadão',
              economicLevel: 1,
              knowledgePoints: 0,
              knowledgeLevel: 1,
              stats: {
                transactionsCount: 0,
                salesCount: 0,
                purchasesCount: 0,
                coursesCreatedCount: 0,
                coursesCompletedCount: 0
              }
            };
            await setDoc(userDocRef, {
              ...newAccount,
              createdAt: serverTimestamp()
            });
            setCurrentUser(newAccount);
          }
          setIsAuthReady(true);
          setLoading(false);
        });
      } else {
        setCurrentUser(null);
        if (unsubscribeProfile) unsubscribeProfile();
        setIsAuthReady(true);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Sync Transactions
  useEffect(() => {
    if (!currentUser) {
      setTransactions([]);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.id),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.timestamp?.toDate().toISOString() || new Date().toISOString()
        } as Transaction;
      });
      setTransactions(txs);
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Sync All Users
  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, 'users'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserAccount);
      setAllUsers(users);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Ban check
  useEffect(() => {
    if (currentUser && currentUser.isBanned && currentUser.bannedUntil) {
      if (new Date() < new Date(currentUser.bannedUntil)) {
        setBanMessage(`Você está banido até ${new Date(currentUser.bannedUntil).toLocaleString()}. Contate um Imperador.`);
      } else {
        // Automatically unban in Firestore
        updateDoc(doc(db, 'users', currentUser.id), {
          isBanned: false,
          bannedUntil: null
        });
        setBanMessage(null);
      }
    } else {
      setBanMessage(null);
    }
  }, [currentUser?.isBanned, currentUser?.bannedUntil]);

  // Automatic Salary Check
  useEffect(() => {
    if (currentUser && currentUser.salary && currentUser.salary > 0) {
      if (currentUser.balance >= MAX_BALANCE) return;

      const now = new Date();
      const lastSalary = currentUser.lastSalaryDate ? new Date(currentUser.lastSalaryDate) : null;
      
      const shouldPay = !lastSalary || 
        (now.getFullYear() > lastSalary.getFullYear()) || 
        (now.getMonth() > lastSalary.getMonth());

      if (shouldPay) {
        const possibleSalary = Math.min(currentUser.salary, MAX_BALANCE - currentUser.balance);
        if (possibleSalary <= 0) return;

        // Perform atomic update in Firestore
        const userRef = doc(db, 'users', currentUser.id);
        const txRef = collection(db, 'transactions');

        addDoc(txRef, {
          userId: currentUser.id,
          type: 'salary',
          amount: possibleSalary,
          description: possibleSalary < currentUser.salary ? 'Salário Mensal (Parcial - Limite Atingido)' : 'Salário Mensal Corporativo',
          timestamp: serverTimestamp(),
          category: 'Renda'
        });

        updateDoc(userRef, {
          balance: increment(possibleSalary),
          lastSalaryDate: now.toISOString()
        });
      }
    }
  }, [currentUser?.salary, currentUser?.balance]);

  const recordAction = async (userId: string, actionType: 'transaction' | 'purchase' | 'sale' | 'course_created' | 'lesson_completed' | 'course_completed') => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;
      
      const userData = userSnap.data() as UserAccount;
      const updates: any = {};
      const currentStats = userData.stats || {
        transactionsCount: 0,
        salesCount: 0,
        purchasesCount: 0,
        coursesCreatedCount: 0,
        coursesCompletedCount: 0
      };

      if (actionType === 'transaction') {
        currentStats.transactionsCount += 1;
      } else if (actionType === 'purchase') {
        currentStats.purchasesCount += 1;
        currentStats.transactionsCount += 1;
      } else if (actionType === 'sale') {
        currentStats.salesCount += 1;
        currentStats.transactionsCount += 1;
      } else if (actionType === 'course_created') {
        currentStats.coursesCreatedCount += 1;
        updates.knowledgePoints = increment(KNOWLEDGE_ACTION_POINTS.CREATE_COURSE);
      } else if (actionType === 'lesson_completed') {
        updates.knowledgePoints = increment(KNOWLEDGE_ACTION_POINTS.COMPLETE_LESSON);
      } else if (actionType === 'course_completed') {
        currentStats.coursesCompletedCount += 1;
        updates.knowledgePoints = increment(KNOWLEDGE_ACTION_POINTS.COMPLETE_COURSE);
      }

      updates.stats = currentStats;
      updates.economicLevel = calculateEconomicLevel(currentStats);

      // We handle knowledgeLevel locally if possible, but let's just push KP
      // and calculate level in UI or periodically sync. 
      // Actually, let's keep it simple and just increment points.
      // knowledgeLevel is basically floor(points/100) + 1.
      
      await updateDoc(userRef, updates);
    } catch (err) {
      console.error("Erro ao registrar ação:", err);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleUpdateProfile = async (updatedProfile: Partial<UserAccount>) => {
    if (currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, updatedProfile);
      } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        alert("Erro: Você não tem permissão para alterar sua Classe Social. Apenas um Imperador pode fazer isso.");
      }
      setIsEditingProfile(false);
    }
  };

  const addTransaction = async (newTx: Omit<Transaction, 'id' | 'date'>) => {
    if (!currentUser) return;

    if (newTx.amount > 0 && currentUser.balance >= MAX_BALANCE) {
      alert("Limite de 1 Milhão de IMs atingido. Esta transação não pôde ser completada integralmente.");
      return;
    }

    let finalAmount = newTx.amount;
    let finalDescription = newTx.description;
    
    if (newTx.amount > 0) {
      if (currentUser.balance + newTx.amount > MAX_BALANCE) {
        finalAmount = MAX_BALANCE - currentUser.balance;
        finalDescription = `${newTx.description} (Limite Atingido)`;
      }
    }

    // Firestore Transaction
    await addDoc(collection(db, 'transactions'), {
      userId: currentUser.id,
      ...newTx,
      amount: finalAmount,
      description: finalDescription,
      timestamp: serverTimestamp()
    });

    await updateDoc(doc(db, 'users', currentUser.id), {
      balance: increment(finalAmount)
    });

    // Progression: Record transaction
    recordAction(currentUser.id, 'transaction');
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => 
      tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transactions, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3B82F6]"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  if (banMessage) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="card-theme p-12 max-w-lg space-y-8 border-[#ef4444]/30"
        >
          <div className="w-24 h-24 bg-[#ef4444]/10 rounded-full flex items-center justify-center mx-auto border-4 border-[#ef4444]/20">
             <Ban className="text-[#ef4444]" size={48} />
          </div>
          <div className="space-y-4">
             <h2 className="text-3xl font-black uppercase text-[#ef4444]">ACESSO NEGADO</h2>
             <p className="text-sm font-bold text-[#F8FAFC] leading-relaxed">{banMessage}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full py-4 bg-[#1E293B] border border-[#334155] rounded-xl text-xs font-black uppercase tracking-widest text-[#94A3B8] hover:bg-[#334155]"
          >
            Sair da Conta
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0F172A] font-sans text-[#F8FAFC] overflow-hidden relative">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50 w-[300px] bg-[#0F172A] border-r border-[#334155] 
        flex flex-col transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="h-20 px-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[#3B82F6] text-2xl font-bold">◈</span>
            <span className="text-2xl font-extrabold tracking-tighter uppercase">Banco Pax vobiscum</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-2 text-[#94A3B8] hover:text-[#F8FAFC]"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-6 py-6 space-y-2 text-[#94A3B8] overflow-y-auto custom-scrollbar">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<History size={20} />} 
            label="Extrato" 
            active={activeTab === 'transactions'} 
            onClick={() => { setActiveTab('transactions'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<UserCircle size={20} />} 
            label="Meu Perfil" 
            active={activeTab === 'profile'} 
            onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<UsersIcon size={20} />} 
            label="Usuários" 
            active={activeTab === 'users'} 
            onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }} 
          />
          {currentUser.rank === 'imperador' && (
            <SidebarItem 
              icon={<Landmark size={20} />} 
              label="Modo Banco" 
              active={activeTab === 'bank_mode'} 
              onClick={() => { setActiveTab('bank_mode'); setIsMobileMenuOpen(false); }} 
            />
          )}
          <div className="pt-6 pb-2 px-5">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#334155]">Operações</p>
          </div>
          <SidebarItem 
            icon={<Send size={20} />} 
            label="Transferir" 
            active={activeTab === 'transfers'} 
            onClick={() => { setShowTransferModal(true); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Receipt size={20} />} 
            label="Pagamentos" 
            active={activeTab === 'payments'} 
            onClick={() => { setShowPaymentModal(true); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<ShoppingBag size={20} />} 
            label="Mercado" 
            active={activeTab === 'market'} 
            onClick={() => { setActiveTab('market'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<CreditCard size={20} />} 
            label="Empréstimos" 
            active={activeTab === 'loans'} 
            onClick={() => { setActiveTab('loans'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<BookOpen size={20} />} 
            label="Cursos" 
            active={activeTab === 'courses'} 
            onClick={() => { setActiveTab('courses'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Book size={20} />} 
            label="Manual" 
            active={activeTab === 'manual'} 
            onClick={() => { setActiveTab('manual'); setIsMobileMenuOpen(false); }} 
          />
          {currentUser.rank === 'imperador' && (
            <SidebarItem 
              icon={<Gavel size={20} />} 
              label="Juizado (Mercado)" 
              active={activeTab === 'market_admin'} 
              onClick={() => { setActiveTab('market_admin'); setIsMobileMenuOpen(false); }} 
            />
          )}
          <div className="pt-6 border-t border-[#334155]/50 mt-6 pt-6">
            <SidebarItem 
              icon={<LogOut size={20} className="text-red-500" />} 
              label="Sair da Conta" 
              onClick={handleLogout} 
            />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-[#0F172A]">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-[#0F172A]/80 backdrop-blur-md border-b border-[#334155] px-6 md:px-10 py-5 flex items-center justify-between h-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              <Menu size={24} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-sm font-bold uppercase tracking-widest text-[#3B82F6]">{activeTab}</h1>
              <p className="text-[10px] text-[#334155] font-black uppercase tracking-tighter">Banco Pax vobiscum</p>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="relative hidden lg:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#334155]" size={16} />
              <input 
                type="text" 
                placeholder="Pesquisar transações..." 
                className="pl-12 pr-6 py-2 bg-[#0F172A] border border-[#334155] rounded-xl text-xs focus:ring-2 focus:ring-[#3B82F6]/20 transition-all w-72 text-[#F8FAFC] placeholder:text-[#334155] font-bold"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-4 border-l border-[#334155] pl-8">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-[#F8FAFC]">{currentUser.name}</p>
                <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-tighter">{currentUser.email}</p>
              </div>
              <div className="w-10 h-10 rounded-full border border-[#334155] bg-[#1E293B] flex items-center justify-center font-black text-[#3B82F6] text-xs">
                {currentUser.name.split(' ').map(n => n[0]).join('')}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'profile' && <ProfileView user={currentUser} onUpdate={handleUpdateProfile} />}
          {activeTab === 'users' && <UsersView users={allUsers} />}
          {activeTab === 'market' && <MarketplaceView currentUser={currentUser} allUsers={allUsers} addTransaction={addTransaction} recordAction={recordAction} />}
          {activeTab === 'market_admin' && currentUser.rank === 'imperador' && <MarketAdminView allUsers={allUsers} />}
          {activeTab === 'loans' && <LoansView currentUser={currentUser} addTransaction={addTransaction} />}
          {activeTab === 'courses' && <CoursesView currentUser={currentUser} addTransaction={addTransaction} recordAction={recordAction} />}
          {activeTab === 'manual' && <ManualView />}
          {activeTab === 'bank_mode' && currentUser.rank === 'imperador' && (
            <BankMode allUsers={allUsers} currentUser={currentUser} />
          )}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-10">
              {/* Left Column: Balance & Actions */}
              <div className="space-y-8">
                <ProgressionStats user={currentUser} />
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card-theme p-8 space-y-4 shadow-2xl shadow-blue-500/5"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Saldo Disponível</p>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-4xl font-extrabold tracking-tighter text-[#F8FAFC]">
                      {currentUser.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h2>
                    <span className="text-xl font-bold text-[#3B82F6]">IM</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#10B981] text-xs font-bold pt-2">
                    <PlusCircle size={14} />
                    <span>+2.4% este mês</span>
                  </div>
                </motion.div>

                <div className="grid grid-cols-2 gap-4">
                  <ActionButton 
                    icon={<Send size={20} />} 
                    label="Transferir" 
                    onClick={() => setShowTransferModal(true)} 
                    color="blue"
                  />
                  <ActionButton 
                    icon={<Receipt size={20} />} 
                    label="Pagar" 
                    onClick={() => setShowPaymentModal(true)} 
                    color="blue"
                  />
                  <ActionButton 
                    icon={<History size={20} />} 
                    label="Extrato" 
                    onClick={() => setActiveTab('transactions')} 
                    color="blue"
                  />
                  <ActionButton 
                    icon={<MoreVertical size={20} />} 
                    label="Mais" 
                    onClick={() => {}} 
                    color="blue"
                  />
                </div>

                <div className="card-theme p-8 border-dashed border-[#334155] opacity-50 flex flex-col items-center justify-center text-center gap-3 min-h-[160px]">
                   <p className="text-xs font-medium text-[#94A3B8]">Espaço para<br/>Novos Investimentos</p>
                   <Plus size={20} className="text-[#334155]" />
                </div>
              </div>

              {/* Right Column: Recent Activity and Stats */}
              <div className="space-y-10">
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-lg font-bold uppercase tracking-tight text-[#F8FAFC]">Atividades Recentes</h3>
                    <button 
                      onClick={() => setActiveTab('transactions')}
                      className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider hover:underline"
                    >
                      Ver Tudo
                    </button>
                  </div>
                  <div className="space-y-3">
                    {transactions.slice(0, 5).map(tx => (
                      <TransactionItem key={tx.id} tx={tx} />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="p-8 bg-[#1E293B] rounded-2xl border border-[#334155] shadow-xl shadow-black/20">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-[#94A3B8] mb-8">Fluxo de Caixa</h3>
                      <div className="flex items-end justify-between h-32 gap-3">
                        {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                          <div key={i} className="flex-1 group relative">
                            <div 
                              className={`w-full rounded-t-lg transition-all duration-500 group-hover:opacity-80 ${i % 2 === 0 ? 'bg-[#3B82F6]' : 'bg-[#334155]'}`}
                              style={{ height: `${h}%` }}
                            ></div>
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-[#334155] font-bold group-hover:text-[#94A3B8] transition-colors uppercase">
                              {['S','T','Q','Q','S','S','D'][i]}
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>

                   <div className="p-8 bg-[#1E293B] rounded-2xl border border-[#334155] shadow-xl shadow-black/20">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-[#94A3B8] mb-6">Objetivos</h3>
                      <div className="space-y-6">
                        <GoalItem label="Nova Casa" current={85000} target={250000} color="blue" />
                        <GoalItem label="Viagem Japão" current={12000} target={15000} color="green" />
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <h2 className="text-3xl font-extrabold tracking-tighter text-[#F8FAFC]">Histórico</h2>
                <div className="flex bg-[#1E293B] p-1 rounded-2xl border border-[#334155]">
                  <FilterChip label="Todas" active />
                  <FilterChip label="Entradas" />
                  <FilterChip label="Saídas" />
                </div>
              </div>
              
              <div className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden shadow-2xl shadow-black/20">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#0F172A]/50 border-b border-[#334155]">
                      <th className="px-6 py-5 text-left text-[10px] font-bold text-[#334155] uppercase tracking-widest">Descrição</th>
                      <th className="px-6 py-5 text-left text-[10px] font-bold text-[#334155] uppercase tracking-widest">Categoria</th>
                      <th className="px-6 py-5 text-left text-[10px] font-bold text-[#334155] uppercase tracking-widest">Data</th>
                      <th className="px-6 py-5 text-right text-[10px] font-bold text-[#334155] uppercase tracking-widest">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]">
                    {filteredTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-[#334155]/20 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${tx.amount > 0 ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F8FAFC]/5 text-[#F8FAFC]'}`}>
                              {tx.amount > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                            </div>
                            <span className="font-semibold text-sm group-hover:text-[#3B82F6] transition-colors">{tx.description}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#0F172A] text-[#94A3B8] border border-[#334155]">
                            {tx.category}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-xs text-[#94A3B8] font-mono">
                          {new Date(tx.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className={`px-6 py-5 text-right font-bold ${tx.amount > 0 ? 'text-[#10B981]' : 'text-[#F8FAFC]'}`}>
                          {tx.amount > 0 ? '+' : ''} IM {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTransactions.length === 0 && (
                  <div className="p-20 text-center space-y-4">
                    <Search className="w-12 h-12 text-[#334155] mx-auto opacity-20" />
                    <p className="text-[#334155] font-bold uppercase tracking-widest text-xs">Nenhuma transação encontrada</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Floating Add Button For Mobile/Quick Access */}
        <button 
          onClick={() => setShowTransferModal(true)}
          className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-500/40 flex items-center justify-center md:hidden z-30"
        >
          <Plus size={28} />
        </button>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showTransferModal && (
          <Modal title="Transferir IM" onClose={() => setShowTransferModal(false)}>
            <TransferForm 
              onSuccess={(data) => {
                addTransaction({
                  type: 'transfer_out',
                  amount: -data.amount,
                  description: `Transferência para ${data.recipient}`,
                  recipient: data.recipient,
                  category: 'Transferencia'
                });
                setShowTransferModal(false);
              }}
              balance={currentUser.balance}
            />
          </Modal>
        )}

        {showPaymentModal && (
          <Modal title="Impostos e Taxas Pendentes" onClose={() => setShowPaymentModal(false)}>
            <PaymentForm 
              userId={currentUser.id}
              balance={currentUser.balance}
              rank={currentUser.rank}
              onSuccess={(bill, finalAmount) => {
                addTransaction({
                  type: bill.type as any,
                  amount: -finalAmount,
                  description: `Liquidação: ${bill.description}`,
                  category: bill.type === 'tax' ? 'Governo' : 'Penalidade'
                });
                setShowPaymentModal(false);
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-300 group ${
        active 
          ? 'bg-[#1E293B] text-[#3B82F6] shadow-xl shadow-black/20 border border-[#334155]' 
          : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]'
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
      <span className="font-bold text-sm tracking-wide">{label}</span>
      {active && <motion.div layoutId="active-indicator" className="ml-auto w-1.5 h-1.5 bg-[#3B82F6] rounded-full" />}
    </button>
  );
}

function BankMode({ allUsers, currentUser }: { allUsers: UserAccount[], currentUser: UserAccount }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = useMemo(() => allUsers.find(u => u.id === selectedUserId), [allUsers, selectedUserId]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [banDays, setBanDays] = useState('');
  const [salary, setSalary] = useState('');
  const [printAmount, setPrintAmount] = useState('');
  const [printDescription, setPrintDescription] = useState('');
  const [treasury, setTreasury] = useState({ balance: 0 });

  useEffect(() => {
    return onSnapshot(doc(db, 'system', 'treasury'), (doc) => {
      if (doc.exists()) {
        setTreasury(doc.data() as { balance: number });
      }
    });
  }, []);

  const handleApplyTaxOrFine = async (type: 'tax' | 'fine') => {
    if (!selectedUser || !amount || parseFloat(amount) > 50000) {
      alert("Valor inválido ou acima de 50.000 IM");
      return;
    }
    const val = parseFloat(amount);
    
    await addDoc(collection(db, 'bills'), {
      userId: selectedUser.id,
      type,
      amount: val,
      description: description || (type === 'tax' ? 'Imposto Imperial' : 'Multa Administrativa'),
      status: 'pending',
      createdAt: serverTimestamp()
    });

    alert(`${type === 'tax' ? 'Imposto' : 'Multa'} enviado para ${selectedUser.name}!`);
    setAmount('');
    setDescription('');
  };

  const handleBan = async () => {
    if (!selectedUser || !banDays) return;
    const days = parseInt(banDays);
    const until = new Date();
    until.setDate(until.getDate() + days);

    await updateDoc(doc(db, 'users', selectedUser.id), {
      isBanned: true,
      bannedUntil: until.toISOString()
    });

    alert(`Usuário banido por ${days} dias!`);
    setBanDays('');
  };

  const handleSetSalary = async () => {
    if (!selectedUser || !salary) return;
    const val = parseFloat(salary);
    
    await updateDoc(doc(db, 'users', selectedUser.id), {
      salary: val
    });

    alert(`Salário de IM ${val} definido para ${selectedUser.name}!`);
    setSalary('');
  };

  const handlePrintMoney = async () => {
    if (!selectedUser || !printAmount) return;
    const val = parseFloat(printAmount);
    
    if (val <= 0 || val > 1000000) {
      alert("O valor de impressão deve estar entre 1 e 1.000.000 IM");
      return;
    }

    const currentBalance = selectedUser.balance || 0;
    const addedAmount = Math.min(val, 1000000 - currentBalance);
    
    if (addedAmount <= 0) {
      alert("Este usuário já atingiu o limite de 1 milhão de IMs.");
      return;
    }

    await addDoc(collection(db, 'transactions'), {
      userId: selectedUser.id,
      type: 'payment',
      amount: addedAmount,
      description: `Emissão de Moeda: ${printDescription || 'Injeção de Capital Imperial'}`,
      timestamp: serverTimestamp(),
      category: 'Governo'
    });

    await updateDoc(doc(db, 'users', selectedUser.id), {
      balance: increment(addedAmount)
    });
    
    alert(`IM ${addedAmount.toLocaleString()} impressos e creditados para ${selectedUser.name}!`);
    setPrintAmount('');
    setPrintDescription('');
  };

  const handlePrintToTreasury = async () => {
    if (!printAmount) return;
    const val = parseFloat(printAmount);
    
    if (val <= 0 || val > 10000000) { // Limit treasury printing to 10M per shot
      alert("O valor de impressão para o tesouro deve estar entre 1 e 10.000.000 IM");
      return;
    }

    try {
      // Use setDoc with merge to create the document if it doesn't exist
      await setDoc(doc(db, 'system', 'treasury'), {
        balance: increment(val)
      }, { merge: true });

      await addDoc(collection(db, 'system_logs'), {
        type: 'treasury_mint',
        amount: val,
        description: printDescription || 'Expansão da Base Monetária Imperial',
        timestamp: serverTimestamp()
      });

      alert(`IM ${val.toLocaleString()} impressos e adicionados ao Tesouro Imperial! O saldo será atualizado em instantes.`);
      setPrintAmount('');
      setPrintDescription('');
    } catch (err) {
      console.error(err);
      alert("Erro ao imprimir para o tesouro. Verifique sua conexão ou permissões.");
    }
  };

  const [treasuryAmount, setTreasuryAmount] = useState('');

  const handleWithdrawTreasury = async () => {
    if (!selectedUser || treasury.balance <= 0 || !treasuryAmount) return;
    const amountToWithdraw = parseFloat(treasuryAmount);

    if (isNaN(amountToWithdraw) || amountToWithdraw <= 0) {
      alert("Insira um valor válido para repasse.");
      return;
    }

    if (amountToWithdraw > treasury.balance) {
      alert("O valor solicitado excede o saldo do Tesouro.");
      return;
    }

    if (!confirm(`Deseja transferir IM ${amountToWithdraw.toLocaleString()} do Tesouro Imperial para ${selectedUser.name}?`)) return;

    try {
      // 1. Deduzir do tesouro
      await updateDoc(doc(db, 'system', 'treasury'), {
        balance: increment(-amountToWithdraw),
        lastWithdraw: serverTimestamp()
      });

      // 2. Dar para o usuário
      await updateDoc(doc(db, 'users', selectedUser.id), {
        balance: increment(amountToWithdraw)
      });

      // 3. Registrar transação
      await addDoc(collection(db, 'transactions'), {
        userId: selectedUser.id,
        type: 'payment',
        amount: amountToWithdraw,
        description: 'Repasse do Tesouro Imperial',
        timestamp: serverTimestamp(),
        category: 'Governo'
      });

      alert("Fundos do tesouro repassados com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao realizar repasse.");
    }
  };

  const promoteUser = async (rank: UserRank) => {
     if (!selectedUser) return;
     await updateDoc(doc(db, 'users', selectedUser.id), { rank });
     alert(`Usuário promovido a ${rank}!`);
  };

  return (
    <div className="space-y-10">
       <div className="flex justify-between items-center">
          <div className="space-y-2">
             <h2 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-4">
                <Landmark className="text-[#3B82F6]" size={40} /> Modo Banco
             </h2>
             <p className="text-[#94A3B8] text-xs font-black uppercase tracking-widest">Painel de Controle Imperial</p>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-6">
             <div className="card-theme p-8 bg-[#3B82F6] text-white border-none space-y-6 relative overflow-hidden">
                <div className="relative z-10 space-y-1">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Tesouro Imperial</p>
                   <h3 className="text-4xl font-black tracking-tighter">IM {treasury.balance.toLocaleString()}</h3>
                </div>
                <div className="relative z-10 flex flex-col gap-4">
                  <p className="text-[8px] font-bold uppercase tracking-widest opacity-80 leading-relaxed">Fundos acumulados através de impostos e penalidades judiciais.</p>
                  {selectedUser ? (
                     <div className="space-y-3">
                       <div className="space-y-1">
                         <label className="text-[8px] font-black uppercase opacity-60 ml-1">Valor p/ Repasse (IM)</label>
                         <input 
                           type="number"
                           value={treasuryAmount}
                           onChange={(e) => setTreasuryAmount(e.target.value)}
                           className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-bold text-white placeholder:text-white/30"
                           placeholder="0.00"
                         />
                       </div>
                       <button 
                         onClick={handleWithdrawTreasury}
                         disabled={treasury.balance <= 0 || !treasuryAmount}
                         className="w-full py-3 bg-white text-[#3B82F6] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                       >
                         Repassar p/ {selectedUser.name}
                       </button>
                     </div>
                  ) : (
                     <div className="py-3 px-4 bg-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-center border border-white/20 italic">
                       Selecione um usuário para repassar fundos
                     </div>
                  )}
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <Shield size={120} />
                </div>
             </div>

             <div className="card-theme p-6 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#334155]">Selecionar Usuário</h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                   {allUsers.map(u => (
                      <button 
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`w-full text-left p-4 rounded-xl border border-[#334155] transition-all flex items-center gap-3 ${selectedUser?.id === u.id ? 'bg-[#3B82F6]/10 border-[#3B82F6]' : 'hover:bg-[#1E293B]'}`}
                      >
                         <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center font-black text-[#3B82F6] text-xs">
                            {u.name[0]}
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-[#F8FAFC] truncate">{u.name}</p>
                            <p className="text-[8px] text-[#3B82F6] font-black uppercase">{u.rank}</p>
                         </div>
                      </button>
                   ))}
                </div>
             </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
             {selectedUser ? (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="card-theme p-10 space-y-10"
                >
                   <div className="flex items-center gap-6 pb-8 border-b border-[#334155]">
                      <div className="w-20 h-20 rounded-3xl bg-[#0F172A] border border-[#334155] flex items-center justify-center text-3xl font-black text-[#3B82F6]">
                         {selectedUser.name[0]}
                      </div>
                      <div className="space-y-1">
                         <h3 className="text-2xl font-black text-[#F8FAFC] uppercase tracking-tighter">{selectedUser.name}</h3>
                         <p className="text-[#3B82F6] text-xs font-bold uppercase tracking-widest">{selectedUser.rank} • ID: {selectedUser.id.substring(0, 8)}</p>
                         <p className="text-[#10B981] font-mono text-lg font-bold">IM {selectedUser.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {/* Impostos e Multas */}
                      <div className="space-y-6">
                         <h4 className="text-[10px] font-black text-[#334155] uppercase tracking-[0.2em] ml-2">Penalidades e Tributos</h4>
                         <div className="space-y-4">
                            <div className="space-y-2">
                               <input 
                                 type="number" 
                                 placeholder="Valor IM" 
                                 className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-5 py-3 text-xs font-bold text-[#F8FAFC]"
                                 value={amount}
                                 onChange={(e) => setAmount(e.target.value)}
                               />
                               <input 
                                 type="text" 
                                 placeholder="Motivo" 
                                 className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-5 py-3 text-xs font-bold text-[#F8FAFC]"
                                 value={description}
                                 onChange={(e) => setDescription(e.target.value)}
                               />
                            </div>
                            <div className="flex gap-3">
                               <button 
                                 onClick={() => handleApplyTaxOrFine('tax')}
                                 className="flex-1 py-3 bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[#3B82F6] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#3B82F6] hover:text-white transition-all"
                               >
                                  Aplicar Imposto
                               </button>
                               <button 
                                 onClick={() => handleApplyTaxOrFine('fine')}
                                 className="flex-1 py-3 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#ef4444] hover:text-white transition-all"
                               >
                                  Aplicar Multa
                               </button>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-6">
                         <div className="flex items-center justify-between ml-2">
                           <h4 className="text-[10px] font-black text-[#334155] uppercase tracking-[0.2em]">Casa da Moeda</h4>
                           <p className="text-[8px] font-black text-[#10B981] uppercase bg-[#10B981]/10 px-2 py-0.5 rounded">Emissão Oficial</p>
                         </div>
                         <div className="p-6 bg-[#10B981]/5 border border-[#10B981]/20 rounded-2xl space-y-4">
                            <div className="space-y-1">
                               <label className="text-[8px] font-black uppercase text-[#334155] ml-1">Valor do Lote</label>
                               <input 
                                 type="number" 
                                 placeholder="Ex: 500000" 
                                 className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-5 py-3 text-xs font-bold text-[#F8FAFC]"
                                 value={printAmount}
                                 onChange={(e) => setPrintAmount(e.target.value)}
                               />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[8px] font-black uppercase text-[#334155] ml-1">Referência (Opcional)</label>
                               <input 
                                 type="text" 
                                 placeholder="Motivo da emissão..." 
                                 className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-5 py-3 text-xs font-bold text-[#F8FAFC]"
                                 value={printDescription}
                                 onChange={(e) => setPrintDescription(e.target.value)}
                               />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                               <button 
                                 onClick={handlePrintToTreasury}
                                 className="py-4 bg-[#1e293b] text-[#10B981] border border-[#10B981]/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#10B981] hover:text-white transition-all flex flex-col items-center justify-center gap-1"
                               >
                                  <span>Tesouro</span>
                                  <span className="text-[7px] opacity-60">Fundo Público</span>
                               </button>
                               <button 
                                 onClick={async () => {
                                   const prevId = selectedUserId;
                                   setSelectedUserId(currentUser.id);
                                   // We need to wait a tick or just call it directly with current user
                                   // To be safe, we'll implement a small helper or just assume it's selected
                                   // But state update is async. Let's just create a quick direct print helper.
                                   const val = parseFloat(printAmount);
                                   if (isNaN(val) || val <= 0) {
                                     alert("Insira um valor válido.");
                                     return;
                                   }
                                   
                                   const addedAmount = Math.min(val, 1000000 - currentUser.balance);
                                   if (addedAmount <= 0) {
                                     alert("Você já atingiu o limite de saldo.");
                                     return;
                                   }

                                   await updateDoc(doc(db, 'users', currentUser.id), {
                                     balance: increment(addedAmount)
                                   });
                                   await addDoc(collection(db, 'transactions'), {
                                     userId: currentUser.id,
                                     type: 'payment',
                                     amount: addedAmount,
                                     description: `Auto-Emissão: ${printDescription || 'Injeção Pessoal'}`,
                                     timestamp: serverTimestamp(),
                                     category: 'Governo'
                                   });
                                   alert(`IM ${addedAmount.toLocaleString()} creditados em sua conta!`);
                                   setPrintAmount('');
                                   setPrintDescription('');
                                 }}
                                 className="py-4 bg-[#3B82F6] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#3B82F6]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1"
                               >
                                  <span>Minha Conta</span>
                                  <span className="text-[7px] opacity-80">Saldo Pessoal</span>
                               </button>
                               <button 
                                 onClick={handlePrintMoney}
                                 disabled={!selectedUser}
                                 className="py-4 bg-[#10B981] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#10B981]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:grayscale"
                               >
                                  <span>Enviar p/ Outro</span>
                                  <span className="text-[7px] opacity-80 uppercase">{selectedUser ? selectedUser.name.split(' ')[0] : 'Selecione'}</span>
                               </button>
                            </div>
                         </div>
                      </div>

                      {/* Gestão de Status */}
                      <div className="space-y-6">
                         <h4 className="text-[10px] font-black text-[#334155] uppercase tracking-[0.2em] ml-2">Justiça e Status</h4>
                         <div className="space-y-4">
                            <div className="flex gap-3">
                               <input 
                                 type="number" 
                                 placeholder="Dias de Ban" 
                                 className="flex-1 bg-[#0F172A] border border-[#334155] rounded-xl px-5 py-3 text-xs font-bold text-[#F8FAFC]"
                                 value={banDays}
                                 onChange={(e) => setBanDays(e.target.value)}
                               />
                               <button 
                                 onClick={handleBan}
                                 className="px-6 py-3 bg-[#1E293B] border border-[#ef4444]/30 text-[#ef4444] rounded-xl text-[10px] font-black uppercase hover:bg-[#ef4444] hover:text-white transition-all"
                               >
                                  Banir
                               </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                               {[ 'cidadão', 'conselheiro', 'nobre', 'imperador'].map(r => (
                                  <button 
                                    key={r}
                                    onClick={() => promoteUser(r as UserRank)}
                                    className="py-3 bg-[#0F172A] border border-[#334155] rounded-xl text-[8px] font-black uppercase text-[#94A3B8] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-all"
                                  >
                                     {r}
                                  </button>
                               ))}
                            </div>
                         </div>
                      </div>

                      {/* Salário Corporativo */}
                      <div className="space-y-6">
                         <h4 className="text-[10px] font-black text-[#334155] uppercase tracking-[0.2em] ml-2">Renda Mensal</h4>
                         <div className="flex gap-3">
                            <input 
                              type="number" 
                              placeholder="Valor Salário" 
                              className="flex-1 bg-[#0F172A] border border-[#334155] rounded-xl px-5 py-3 text-xs font-bold text-[#F8FAFC]"
                              value={salary}
                              onChange={(e) => setSalary(e.target.value)}
                            />
                            <button 
                              onClick={handleSetSalary}
                              className="px-6 py-3 bg-[#3B82F6] text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-[#3B82F6]/20 transition-all"
                            >
                               Definir
                            </button>
                         </div>
                      </div>
                   </div>
                </motion.div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center p-20 text-center border-2 border-dashed border-[#334155] rounded-[40px] opacity-30">
                   <ShieldAlert size={80} className="text-[#334155] mb-6" />
                   <p className="text-sm font-black uppercase tracking-[0.3em] text-[#334155]">Selecione um vassalo para gerenciar</p>
                </div>
             )}
          </div>
       </div>
    </div>
  );
}

function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      alert('Erro ao fazer login com Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#1E293B] rounded-[40px] border border-[#334155] p-10 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#3B82F6] to-[#10B981]"></div>
        
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[#0F172A] border border-[#334155] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
             <span className="text-[#3B82F6] text-4xl font-black">◈</span>
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-[#F8FAFC]">Banco Pax vobiscum</h2>
          <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-widest mt-2">Sua economia em outro nível</p>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-5 bg-[#3B82F6] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#3B82F6]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50"
        >
          {loading ? 'Conectando...' : (
            <>
              Entrar com Google <LogIn size={20} />
            </>
          )}
        </button>

        <p className="text-center text-[10px] text-[#334155] font-black uppercase tracking-widest mt-8">
          Acesso Seguro via Firebase Auth
        </p>
      </motion.div>
    </div>
  );
}

function ProgressionStats({ user }: { user: UserAccount }) {
  const currentEconomic = ECONOMIC_LEVELS.find(l => l.level === (user.economicLevel || 1)) || ECONOMIC_LEVELS[0];
  const { level: kLevel, progressPercentage, currentPoints, maxPoints } = getKnowledgeProgress(user.knowledgePoints || 0);

  return (
    <div className="space-y-6">
      {/* Nível Econômico */}
      <div className="card-theme p-6 space-y-4 border-[#3B82F6]/20 bg-gradient-to-br from-[#1E293B] to-[#0F172A]">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase text-[#3B82F6] tracking-[0.2em]">Engajamento Econômico</p>
            <h4 className="text-xl font-black text-[#F8FAFC] uppercase tracking-tighter">{currentEconomic.name}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center border border-[#3B82F6]/30">
            <TrendingUp size={20} className="text-[#3B82F6]" />
          </div>
        </div>
        
        <p className="text-[10px] text-[#94A3B8] font-medium leading-relaxed italic">
          "{currentEconomic.description}"
        </p>

        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-[9px] font-black text-[#334155] uppercase">Progresso do Nível {user.economicLevel || 1} de 7</span>
          </div>
          <div className="flex gap-1">
             {[1,2,3,4,5,6,7].map(i => (
               <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= (user.economicLevel || 1) ? 'bg-[#3B82F6] shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-[#334155]'}`} />
             ))}
          </div>
        </div>
      </div>

      {/* Barra de Conhecimento */}
      <div className="card-theme p-6 space-y-4 border-[#10B981]/20 bg-gradient-to-br from-[#1E293B] to-[#0F172A]">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase text-[#10B981] tracking-[0.2em]">Acervo de Conhecimento</p>
            <h4 className="text-xl font-black text-[#F8FAFC] uppercase tracking-tighter">Estágio {kLevel}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center border border-[#10B981]/30">
            <BookOpen size={20} className="text-[#10B981]" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black text-[#94A3B8] uppercase">Evolução de Aprendizado</span>
            <span className="text-[10px] font-black text-[#F8FAFC]">{Math.floor(progressPercentage)}%</span>
          </div>
          <div className="h-3 w-full bg-[#334155] rounded-full overflow-hidden p-0.5 border border-[#334155]">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              className="h-full bg-gradient-to-r from-[#10B981] to-[#34D399] rounded-full"
            />
          </div>
          <p className="text-[8px] text-center text-[#334155] font-black uppercase tracking-widest">
            {currentPoints} / {maxPoints} Pontos para o Próximo Estágio
          </p>
        </div>
      </div>
    </div>
  );
}

function ManualView() {
  const sections = [
    {
      title: "Gestão e Comunidade",
      icon: <Layout className="text-[#3B82F6]" />,
      content: [
        {
          label: "Dashboard",
          text: "Sua central de controle. Acompanhe seu saldo em tempo real, veja os gráficos de movimentação e seu progresso de engajamento."
        },
        {
          label: "Perfil",
          text: "Personalize sua identidade imperial. Mude seu nome, descrição e acompanhe suas estatísticas de carreira e aprendizado."
        },
        {
          label: "Lista de Cidadãos",
          text: "Conheça quem faz parte do Império. Útil para verificar números de conta e o status de outros participantes."
        }
      ]
    },
    {
      title: "Finanças e Bancário",
      icon: <Wallet className="text-[#10B981]" />,
      content: [
        {
          label: "Pagamentos de Contas",
          text: "Utilize para quitar débitos com o Tesouro Imperial ou pagar por serviços oficiais do sistema."
        },
        {
          label: "Transferências Rápidas",
          text: "Envie IM para qualquer conta instantaneamente. Basta informar o número da conta e o valor desejado."
        },
        {
          label: "Histórico de Transações",
          text: "Um extrato completo de tudo o que entra e sai da sua conta, com filtros para facilitar sua auditoria pessoal."
        }
      ]
    },
    {
      title: "Economia e Comércio",
      icon: <Store className="text-[#F59E0B]" />,
      content: [
        {
          label: "Mercado Imperial",
          text: "Compre e venda produtos. Como vendedor, você pode anunciar itens e receber por eles. Como comprador, pode adquirir novos recursos."
        },
        {
          label: "Empréstimos",
          text: "Acesse para solicitar crédito extra ou investir seus fundos em propostas de outros usuários, com juros e parcelamento."
        },
        {
          label: "Gestão do Mercado",
          text: "Funcionalidade exclusiva do Imperador para garantir a lisura das trocas comerciais e aprovação de novos itens."
        }
      ]
    },
    {
      title: "Educação e Progressão",
      icon: <Book className="text-[#8B5CF6]" />,
      content: [
        {
          label: "Escola Imperial (Cursos)",
          text: "O caminho para o saber. Conclua lições para ganhar Pontos de Conhecimento (KP). Nobres podem criar e vender seus próprios cursos."
        },
        {
          label: "Nível Econômico (NV)",
          text: "Representa sua atividade no sistema. Sobe conforme você diversifica suas ações comerciais entre compras, vendas e investimentos."
        },
        {
          label: "Estágio de Conhecimento",
          text: "Marca sua evolução intelectual. A cada 100 KP, você avança um estágio, demonstrando sua dedicação ao aprendizado."
        }
      ]
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-12 pb-20"
    >
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-[#3B82F6]/10 rounded-3xl flex items-center justify-center mx-auto border border-[#3B82F6]/20 shadow-xl shadow-blue-500/10">
           <Compass size={40} className="text-[#3B82F6]" />
        </div>
        <h2 className="text-4xl font-black tracking-tighter uppercase text-[#F8FAFC]">Manual do Cidadão Imperial</h2>
        <p className="text-[#94A3B8] font-medium max-w-lg mx-auto">Instruções completas para utilizar todos os recursos da plataforma.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {sections.map((section, idx) => (
          <div key={idx} className="card-theme p-8 space-y-6 bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-[#334155]">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#0F172A] border border-[#334155]">
                {section.icon}
              </div>
              <h3 className="text-xl font-black text-[#F8FAFC] tracking-tight uppercase">{section.title}</h3>
            </div>

            <div className="space-y-6">
              {section.content.map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                    <p className="text-[10px] font-black uppercase text-[#F8FAFC] tracking-widest">{item.label}</p>
                  </div>
                  <p className="text-xs text-[#94A3B8] leading-relaxed font-medium pl-3.5">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card-theme p-10 mt-12 bg-[#3B82F6]/5 border-[#3B82F6]/20 border-dashed flex flex-col items-center text-center space-y-6">
        <HelpCircle size={48} className="text-[#3B82F6]" />
        <div className="space-y-2">
          <h4 className="text-xl font-black text-[#F8FAFC] uppercase">Dúvidas Frequentes</h4>
          <p className="text-sm text-[#94A3B8] font-medium">As ações realizadas no sistema impactam seu Nível Econômico. O progresso é gratificante e constante para quem participa ativamente.</p>
        </div>
      </div>
    </motion.div>
  );
}

function ProfileView({ user, onUpdate }: { user: UserAccount, onUpdate: (data: Partial<UserAccount>) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [description, setDescription] = useState(user.description);
  const [rank, setRank] = useState<UserRank>(user.rank);
  const [editing, setEditing] = useState(false);

  // Synchronize when user prop changes from outside
  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setDescription(user.description);
    setRank(user.rank);
  }, [user]);

  const handleSave = () => {
    onUpdate({ name, email, description, rank });
    setEditing(false);
  };

  const getRankBadgeColor = (rank: string) => {
    switch (rank) {
      case 'imperador': return 'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/10';
      case 'nobre': return 'text-[#10B981] border-[#10B981]/30 bg-[#10B981]/10';
      case 'conselheiro': return 'text-[#3B82F6] border-[#3B82F6]/30 bg-[#3B82F6]/10';
      default: return 'text-[#94A3B8] border-[#334155] bg-[#1E293B]';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <ProgressionStats user={user} />
      
      <div className="flex justify-between items-end">
        <div className="space-y-4">
          <h2 className="text-4xl font-black tracking-tighter uppercase">Meu Perfil</h2>
          <p className="text-[#94A3B8] text-xs font-medium uppercase tracking-[0.2em]">Configurações da conta corporativa</p>
        </div>
        {!editing && (
          <button 
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#1E293B] border border-[#334155] rounded-xl text-xs font-black uppercase tracking-widest text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white transition-all transition-all"
          >
            Editar Perfil <Settings size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="card-theme p-10 flex flex-col items-center text-center space-y-6">
          <div className="relative">
             <div className="w-32 h-32 rounded-[2.5rem] bg-[#0F172A] border border-[#334155] flex items-center justify-center text-5xl font-black text-[#3B82F6] shadow-2xl">
               {user.name.split(' ').map(n => n[0]).join('')}
             </div>
             {user.rank === 'imperador' && <Crown className="absolute -top-4 -right-4 text-[#F59E0B] drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" size={40} />}
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#F8FAFC]">{user.name}</h3>
            <div className={`mt-2 inline-block px-4 py-1 rounded-full border text-[8px] font-black uppercase tracking-[0.2em] ${getRankBadgeColor(user.rank)}`}>
               {user.rank}
            </div>
            <p className="text-[#3B82F6] text-[10px] font-black uppercase tracking-[0.3em] mt-3">{user.accountNumber}</p>
          </div>
          <div className="pt-6 w-full border-t border-[#334155] space-y-4">
             <div className="flex justify-between items-center text-[10px] font-black uppercase">
                <span className="text-[#334155]">Saldo Atual</span>
                <span className="text-[#10B981]">IM {user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
             </div>
             <div className="flex justify-between items-center text-[10px] font-black uppercase">
                <span className="text-[#334155]">Vantagem</span>
                <span className="text-[#3B82F6]">
                   {user.rank === 'imperador' ? 'Isenção Total' : 
                    user.rank === 'nobre' ? '80% Isenção' : 
                    user.rank === 'conselheiro' ? '25% Desconto' : 'Padrão'}
                </span>
             </div>
          </div>
        </div>

        <div className="card-theme p-10 space-y-8">
           <div className="space-y-3">
              <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest flex items-center gap-2">
                 <User size={12} /> Nome Completo
              </label>
              {editing ? (
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-3 bg-[#0F172A] border border-[#334155] rounded-xl text-sm font-bold text-[#F8FAFC] focus:ring-2 focus:ring-[#3B82F6]/20 outline-none"
                />
              ) : (
                <p className="text-sm font-bold text-[#F8FAFC] px-1">{user.name}</p>
              )}
           </div>

           <div className="space-y-3">
              <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest flex items-center gap-2">
                 <Mail size={12} /> E-mail
              </label>
              {editing ? (
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-3 bg-[#0F172A] border border-[#334155] rounded-xl text-sm font-bold text-[#F8FAFC] focus:ring-2 focus:ring-[#3B82F6]/20 outline-none"
                />
              ) : (
                <p className="text-sm font-bold text-[#F8FAFC] px-1">{user.email}</p>
              )}
           </div>

           <div className="space-y-3">
              <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest flex items-center gap-2">
                 <FileText size={12} /> Descrição
              </label>
              {editing ? (
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-5 py-3 bg-[#0F172A] border border-[#334155] rounded-xl text-sm font-bold text-[#F8FAFC] focus:ring-2 focus:ring-[#3B82F6]/20 outline-none resize-none"
                />
              ) : (
                <p className="text-sm font-medium text-[#94A3B8] px-1 leading-relaxed">{user.description}</p>
              )}
           </div>

           <div className="space-y-3">
              <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest flex items-center gap-2">
                 <Crown size={12} /> Classe Social
              </label>
              {editing ? (
                <select 
                  value={rank} 
                  onChange={(e) => setRank(e.target.value as UserRank)}
                  className="w-full px-5 py-3 bg-[#0F172A] border border-[#334155] rounded-xl text-sm font-bold text-[#F8FAFC] focus:ring-2 focus:ring-[#3B82F6]/20 outline-none appearance-none cursor-pointer"
                >
                  <option value="cidadão">Cidadão (Normal)</option>
                  <option value="conselheiro">Conselheiro (25% Desconto)</option>
                  <option value="nobre">Nobre (80% Isenção)</option>
                  <option value="imperador">Imperador (Controle Total)</option>
                </select>
              ) : (
                <p className={`text-xs font-black uppercase tracking-widest px-1 ${getRankBadgeColor(user.rank)}`}>
                  {user.rank}
                </p>
              )}
           </div>

           {editing && (
             <div className="flex gap-4 pt-4">
                <button 
                  onClick={handleSave}
                  className="flex-1 py-4 bg-[#3B82F6] text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#3B82F6]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Salvar Alterações
                </button>
                <button 
                  onClick={() => setEditing(false)}
                  className="px-6 py-4 bg-[#0F172A] border border-[#334155] text-[#334155] rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-[#94A3B8] transition-colors"
                >
                  Cancelar
                </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

function UsersView({ users }: { users: UserAccount[] }) {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h2 className="text-4xl font-black tracking-tighter uppercase">Usuários Logados</h2>
        <p className="text-[#94A3B8] text-xs font-medium uppercase tracking-[0.2em]">Comunidade exclusiva do Banco Pax vobiscum</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {users.map(user => (
          <motion.div 
            key={user.id}
            whileHover={{ y: -5 }}
            className="card-theme p-8 space-y-6 group cursor-default"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-[#0F172A] border border-[#334155] flex items-center justify-center text-xl font-black text-[#3B82F6] group-hover:border-[#3B82F6]/50 transition-colors">
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-black text-[#F8FAFC] truncate">{user.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                   <p className="text-[#3B82F6] text-[8px] font-black uppercase tracking-widest">{user.accountNumber}</p>
                   <span className="text-[6px] px-1.5 py-0.5 rounded border border-[#334155] text-[#94A3B8] font-black uppercase">{user.rank}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                   <div className="flex-1 h-1 bg-[#334155] rounded-full overflow-hidden">
                      <div className="h-full bg-[#3B82F6]" style={{ width: `${((user.economicLevel || 1) / 7) * 100}%` }} />
                   </div>
                   <span className="text-[7px] font-black text-[#F8FAFC]">NV {user.economicLevel || 1}</span>
                </div>
             </div>
           </div>
            
            <div className="p-4 bg-[#1E293B] rounded-xl border border-[#334155] space-y-3">
               <p className="text-[10px] font-bold text-[#F8FAFC] truncate flex items-center gap-2">
                  <Mail size={12} className="text-[#334155]" /> {user.email}
               </p>
               <p className="text-[10px] font-medium text-[#94A3B8] line-clamp-2 italic leading-relaxed">
                  "{user.description}"
               </p>
            </div>
            
            <div className="flex justify-between items-center pt-2">
               <span className="text-[8px] font-black uppercase tracking-widest text-[#334155]">Conta Ativa em IM</span>
               <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div>
                  <span className="text-[10px] font-black uppercase text-[#10B981]">Online</span>
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="p-20 text-center space-y-4">
          <UsersIcon className="w-16 h-16 text-[#334155] mx-auto opacity-20" />
          <p className="text-[#334155] font-black uppercase tracking-widest text-xs font-bold">Nenhum usuário registrado ainda</p>
        </div>
      )}
    </div>
  );
}

function MarketplaceView({ 
  currentUser, 
  allUsers, 
  addTransaction,
  recordAction
}: { 
  currentUser: UserAccount, 
  allUsers: UserAccount[], 
  addTransaction: (tx: any) => Promise<void>,
  recordAction: (userId: string, type: any) => Promise<void>
}) {
  const [view, setView] = useState<'browse' | 'sell' | 'orders'>('browse');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'listings'), where('active', '==', true), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setListings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketListing)));
    });
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'market_orders'),
      where('buyerId', '==', currentUser.id),
      orderBy('createdAt', 'desc')
    );
    const q2 = query(
      collection(db, 'market_orders'),
      where('sellerId', '==', currentUser.id),
      orderBy('createdAt', 'desc')
    );

    const unsub1 = onSnapshot(q, (snap) => {
      const buyerOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketOrder));
      setOrders(prev => {
        const others = prev.filter(o => o.sellerId === currentUser.id && o.buyerId !== currentUser.id);
        return [...buyerOrders, ...others].sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds);
      });
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      const sellerOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketOrder));
      setOrders(prev => {
        const others = prev.filter(o => o.buyerId === currentUser.id && o.sellerId !== currentUser.id);
        return [...sellerOrders, ...others].sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds);
      });
    });

    return () => { unsub1(); unsub2(); };
  }, [currentUser.id]);

  const handlePurchase = async (listing: MarketListing) => {
    if (listing.sellerId === currentUser.id) {
      alert("Você não pode comprar de si mesmo.");
      return;
    }
    if (currentUser.balance < listing.price) {
      alert("Saldo insuficiente em IM.");
      return;
    }

    if (!confirm(`Confirmar compra de "${listing.title}" por IM ${listing.price.toLocaleString()}?`)) return;

    try {
      const taxAmount = Math.floor(listing.price * 0.05);
      const sellerAmount = listing.price - taxAmount;

      // 1. Transferência imediata
      // Débito do comprador
      await addTransaction({
        type: 'payment',
        amount: -listing.price,
        description: `Compra: ${listing.title}`,
        category: 'Mercado'
      });

      // Crédito do vendedor (valor líquido)
      const sellerRef = doc(db, 'users', listing.sellerId);
      await updateDoc(sellerRef, {
        balance: increment(sellerAmount)
      });
      await addDoc(collection(db, 'transactions'), {
        userId: listing.sellerId,
        type: 'payment',
        amount: sellerAmount,
        description: `Venda: ${listing.title} (para ${currentUser.name}) - Taxa 5% aplicada`,
        timestamp: serverTimestamp(),
        category: 'Mercado'
      });

      // Crédito do Tesouro (taxa)
      const treasuryRef = doc(db, 'users', 'treasury');
      await updateDoc(treasuryRef, {
        balance: increment(taxAmount)
      });
      await addDoc(collection(db, 'transactions'), {
        userId: 'treasury',
        type: 'deposit',
        amount: taxAmount,
        description: `Taxa s/ Venda: ${listing.title} (Vendedor: ${listing.sellerName})`,
        timestamp: serverTimestamp(),
        category: 'Governo'
      });

      // 2. Registro do pedido
      await addDoc(collection(db, 'market_orders'), {
        listingId: listing.id,
        buyerId: currentUser.id,
        buyerName: currentUser.name,
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        title: listing.title,
        amount: listing.price,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Progression: Record Purchase & Sale
      recordAction(currentUser.id, 'purchase');
      recordAction(listing.sellerId, 'sale');

      alert(`Compra de IM ${listing.price.toLocaleString()} realizada! IM ${taxAmount.toLocaleString()} de taxa foram para o Tesouro.`);
      setView('orders');
    } catch (error) {
       console.error(error);
       alert("Erro ao processar compra.");
    }
  };

  const handleConfirmReceipt = async (order: MarketOrder) => {
    await updateDoc(doc(db, 'market_orders', order.id), {
      status: 'concluded',
      updatedAt: serverTimestamp()
    });
  };

  const handleOpenDispute = async (order: MarketOrder) => {
    const reason = prompt("Descreva o problema para mediação judicial:");
    if (!reason) return;
    await updateDoc(doc(db, 'market_orders', order.id), {
      status: 'problem',
      disputeNotes: reason,
      updatedAt: serverTimestamp()
    });
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-4">
            <Store className="text-[#3B82F6]" size={40} /> Mercado Imperial
          </h2>
          <p className="text-[#94A3B8] text-xs font-black uppercase tracking-widest">Negoceie bens e serviços no império</p>
        </div>
        <div className="flex h-12 bg-[#1E293B] p-1 rounded-2xl border border-[#334155]">
          <button 
            onClick={() => setView('browse')}
            className={`px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'browse' ? 'bg-[#3B82F6] text-white shadow-lg' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
          >
            Explorar
          </button>
          <button 
            onClick={() => setView('orders')}
            className={`px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'orders' ? 'bg-[#3B82F6] text-white shadow-lg' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
          >
            Meus Pedidos
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="ml-2 px-6 bg-[#10B981] text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#059669] transition-all"
          >
            <Plus size={14} /> Anunciar
          </button>
        </div>
      </div>

      {view === 'browse' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {listings.map(item => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-theme p-8 flex flex-col group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#0F172A] border border-[#334155] flex items-center justify-center text-[#3B82F6]">
                  <Package size={24} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-[#334155] uppercase">Preço</p>
                  <p className="text-xl font-black text-[#10B981]">IM {item.price.toLocaleString()}</p>
                </div>
              </div>
              <h3 className="text-lg font-black text-[#F8FAFC] mb-2 group-hover:text-[#3B82F6] transition-colors">{item.title}</h3>
              <p className="text-xs text-[#94A3B8] mb-6 line-clamp-3 leading-relaxed">{item.description}</p>
              
              <div className="mt-auto space-y-4 pt-6 border-t border-[#334155]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[10px] font-bold text-[#3B82F6]">
                    {item.sellerName[0]}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#334155] uppercase">Vendedor</p>
                    <p className="text-[10px] font-bold text-[#F8FAFC]">{item.sellerName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handlePurchase(item)}
                  className="w-full py-4 bg-[#3B82F6] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  disabled={item.sellerId === currentUser.id}
                >
                  {item.sellerId === currentUser.id ? 'Seu Anúncio' : 'Comprar Agora'}
                </button>
              </div>
            </motion.div>
          ))}
          {listings.length === 0 && (
            <div className="col-span-full p-20 text-center space-y-4 border-2 border-dashed border-[#334155] rounded-[40px] opacity-30">
              <Package size={60} className="mx-auto text-[#334155]" />
              <p className="text-xs font-black uppercase tracking-widest text-[#334155]">Nenhum item à venda no momento</p>
            </div>
          )}
        </div>
      )}

      {view === 'orders' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {orders.map(order => {
              const isBuyer = order.buyerId === currentUser.id;
              const statusColors = {
                pending: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30',
                concluded: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30',
                problem: 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/30'
              };

              return (
                <div key={order.id} className="card-theme p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-[#3B82F6]/30 transition-all">
                  <div className="flex items-center gap-5 flex-1 w-full">
                    <div className="w-12 h-12 rounded-xl bg-[#0F172A] border border-[#334155] flex items-center justify-center text-[#3B82F6] shrink-0">
                      <ShoppingBag size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${statusColors[order.status]}`}>
                          {order.status === 'pending' ? 'Pendente' : order.status === 'concluded' ? 'Concluído' : 'Em Disputa'}
                        </span>
                        <span className="text-[10px] text-[#334155] font-bold">{new Date(order.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-sm font-bold text-[#F8FAFC] truncate">{order.title}</h4>
                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-widest">
                        {isBuyer ? `Vendedor: ${order.sellerName}` : `Comprador: ${order.buyerName}`} • IM {order.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full md:w-auto">
                    {isBuyer && order.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => handleConfirmReceipt(order)}
                          className="flex-1 md:flex-none px-4 py-2 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-[#10B981] hover:text-white transition-all"
                        >
                          Confirmar Recebimento
                        </button>
                        <button 
                          onClick={() => handleOpenDispute(order)}
                          className="flex-1 md:flex-none px-4 py-2 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-[#ef4444] hover:text-white transition-all flex items-center gap-2"
                        >
                          <AlertTriangle size={12} /> Reclamação
                        </button>
                      </>
                    )}
                    {order.status === 'problem' && (
                      <div className="flex items-center gap-2 text-[#ef4444] text-[8px] font-black uppercase bg-[#ef4444]/10 px-4 py-2 rounded-lg border border-[#ef4444]/30">
                        <Gavel size={12} /> Mediação em Curso
                      </div>
                    )}
                    {order.status === 'concluded' && (
                      <div className="flex items-center gap-2 text-[#10B981] text-[8px] font-black uppercase bg-[#10B981]/10 px-4 py-2 rounded-lg border border-[#10B981]/30">
                        <CheckCircle2 size={12} /> Finalizado
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {orders.length === 0 && (
              <div className="p-20 text-center space-y-4 border-2 border-dashed border-[#334155] rounded-[40px] opacity-30">
                <History size={60} className="mx-auto text-[#334155]" />
                <p className="text-xs font-black uppercase tracking-widest text-[#334155]">Nenhuma transação de mercado ainda</p>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCreateModal && (
          <Modal title="Novo Anúncio" onClose={() => setShowCreateModal(false)}>
            <CreateListingForm 
              currentUser={currentUser} 
              onSuccess={() => {
                setShowCreateModal(false);
                setView('browse');
              }} 
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateListingForm({ currentUser, onSuccess }: { currentUser: UserAccount, onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !price) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'listings'), {
        sellerId: currentUser.id,
        sellerName: currentUser.name,
        title,
        description,
        price: parseFloat(price),
        active: true,
        createdAt: serverTimestamp()
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Erro ao criar anúncio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest">Título do Produto/Serviço</label>
        <input 
          type="text" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-5 py-3 text-xs font-bold text-[#F8FAFC]"
          placeholder="Ex: Espada de Diamante"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest">Descrição</label>
        <textarea 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-5 py-3 text-xs font-bold text-[#F8FAFC] min-h-[100px] resize-none"
          placeholder="Detalhes sobre o que você está vendendo..."
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest">Preço em IM</label>
        <input 
          type="number" 
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-5 py-3 text-xs font-bold text-[#F8FAFC]"
          placeholder="0.00"
          required
        />
      </div>
      <button 
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-[#3B82F6] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#3B82F6]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? 'Criando...' : 'Publicar Anúncio'}
      </button>
    </form>
  );
}

function MarketAdminView({ allUsers }: { allUsers: UserAccount[] }) {
  const [orders, setOrders] = useState<MarketOrder[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'market_orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketOrder)));
    });
  }, []);

  const handleResolve = async (order: MarketOrder, decision: 'conclude' | 'refund') => {
    if (!confirm(`Confirmar decisão de ${decision === 'refund' ? 'ESTORNO (devolver dinheiro)' : 'CONCLUIR (validar venda)'}?`)) return;

    try {
      if (decision === 'refund') {
        // Estornar: Vendedor -> Comprador
        const sellerRef = doc(db, 'users', order.sellerId);
        const buyerRef = doc(db, 'users', order.buyerId);
        
        await updateDoc(sellerRef, { balance: increment(-order.amount) });
        await updateDoc(buyerRef, { balance: increment(order.amount) });

        await addDoc(collection(db, 'transactions'), {
          userId: order.sellerId,
          type: 'payment',
          amount: -order.amount,
          description: `ESTORNO JUDICIAL: ${order.title}`,
          timestamp: serverTimestamp(),
          category: 'Justiça'
        });

        await addDoc(collection(db, 'transactions'), {
          userId: order.buyerId,
          type: 'payment',
          amount: order.amount,
          description: `ESTORNO RECEBIDO: ${order.title}`,
          timestamp: serverTimestamp(),
          category: 'Justiça'
        });
      }

      await updateDoc(doc(db, 'market_orders', order.id), {
        status: decision === 'refund' ? 'pending' : 'concluded', // 'pending' serves as canceled/refunded state or we hide it
        updatedAt: serverTimestamp(),
        disputeNotes: `${order.disputeNotes || ''} | DECISÃO JUDICIAL: ${decision === 'refund' ? 'DINHEIRO DEVOLVIDO' : 'VENDA VALIDADA'}`
      });

      alert("Decisão aplicada com sucesso.");
    } catch (err) {
      console.error(err);
      alert("Erro ao aplicar decisão.");
    }
  };

  const problematicOrders = orders.filter(o => o.status === 'problem');

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h2 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-4">
          <Gavel className="text-[#ef4444]" size={40} /> Juizado do Império
        </h2>
        <p className="text-[#94A3B8] text-xs font-black uppercase tracking-widest">Mediação de conflitos no Mercado Imperial</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {problematicOrders.map(order => (
          <div key={order.id} className="card-theme p-8 border-l-4 border-l-[#ef4444]">
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase bg-[#ef4444]/10 text-[#ef4444] px-3 py-1 rounded-full border border-[#ef4444]/30">Disputa Aberta</span>
                  <span className="text-[10px] text-[#334155] font-black">{new Date(order.updatedAt?.seconds * 1000).toLocaleString()}</span>
                </div>
                <h3 className="text-xl font-black text-[#F8FAFC]">{order.title}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[#0F172A] rounded-xl border border-[#334155]">
                    <p className="text-[8px] font-black text-[#334155] uppercase mb-1">Comprador</p>
                    <p className="text-xs font-bold text-[#F8FAFC]">{order.buyerName}</p>
                  </div>
                  <div className="p-3 bg-[#0F172A] rounded-xl border border-[#334155]">
                    <p className="text-[8px] font-black text-[#334155] uppercase mb-1">Vendedor</p>
                    <p className="text-xs font-bold text-[#F8FAFC]">{order.sellerName}</p>
                  </div>
                </div>
                <div className="p-4 bg-[#ef4444]/5 rounded-xl border border-[#ef4444]/10">
                  <p className="text-[8px] font-black text-[#ef4444] uppercase mb-2 flex items-center gap-2">
                    <MessageSquare size={10} /> Relato do Problema
                  </p>
                  <p className="text-xs italic text-[#94A3B8] font-medium leading-relaxed">"{order.disputeNotes}"</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-3 justify-center border-t md:border-t-0 md:border-l border-[#334155] pt-6 md:pt-0 md:pl-8 min-w-[200px]">
                <p className="text-center text-2xl font-black text-[#10B981] mb-2">IM {order.amount.toLocaleString()}</p>
                <button 
                  onClick={() => handleResolve(order, 'refund')}
                  className="w-full py-3 bg-[#ef4444] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#dc2626] transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> Estornar Valor
                </button>
                <button 
                  onClick={() => handleResolve(order, 'conclude')}
                  className="w-full py-3 bg-[#10B981] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#059669] transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={14} /> Validar Venda
                </button>
              </div>
            </div>
          </div>
        ))}

        {problematicOrders.length === 0 && (
          <div className="p-32 text-center space-y-6 bg-[#0F172A]/50 border-2 border-dashed border-[#334155] rounded-[40px]">
            <div className="w-20 h-20 bg-[#1E293B] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#334155]">
              <Shield className="text-[#334155]" size={40} />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-[#F8FAFC] uppercase tracking-tight">Paz no Império</h4>
              <p className="text-xs font-bold text-[#334155] uppercase tracking-widest">Não existem disputas aguardando mediação.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionItem({ tx }: { tx: Transaction, key?: string }) {
  const isNegative = tx.amount < 0;
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl bg-[#1E293B]/50 border border-[#334155] hover:bg-[#1E293B] hover:border-[#3B82F6]/30 transition-all group">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isNegative ? 'bg-[#F8FAFC]/5 text-[#F8FAFC]' : 'bg-[#10B981]/10 text-[#10B981]'}`}>
        {isNegative ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate group-hover:text-[#3B82F6] transition-colors">{tx.description}</p>
        <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mt-0.5">{tx.category} • {new Date(tx.date).toLocaleDateString()}</p>
      </div>
      <div className="text-right">
        <div className={`text-sm font-extrabold ${isNegative ? 'text-[#F8FAFC]' : 'text-[#10B981]'}`}>
          {isNegative ? '' : '+'}{isNegative ? '-' : ''} IM {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        {tx.description.includes('Limite Atingido') && (
           <span className="text-[6px] font-black uppercase tracking-tighter bg-[#F59E0B]/20 text-[#F59E0B] px-1 py-0.5 rounded leading-none mt-1 inline-block">Limite Atingido</span>
        )}
        {(tx.type === 'payment' || tx.type === 'tax' || tx.type === 'fine') && (
          <span className="text-[8px] font-black uppercase tracking-tighter bg-[#10B981]/20 text-[#10B981] px-1.5 py-0.5 rounded leading-none mt-1 inline-block">Liquidado</span>
        )}
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, color }: { icon: ReactNode, label: string, onClick: () => void, color: 'blue' | 'green' }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#1E293B] border border-[#334155] hover:border-[#3B82F6] hover:bg-[#3B82F6]/5 group transition-all duration-300 shadow-lg shadow-black/10"
    >
      <div className="p-3 bg-[#0F172A] rounded-xl text-[#3B82F6] group-hover:scale-110 transition-transform duration-300 mb-3 border border-[#334155]">
        {icon}
      </div>
      <span className="font-bold text-xs uppercase tracking-widest text-[#94A3B8] group-hover:text-[#F8FAFC] transition-colors">{label}</span>
    </button>
  );
}

function GoalItem({ label, current, target, color }: { label: string, current: number, target: number, color: 'blue' | 'green' | 'amber' }) {
  const percentage = Math.min(100, (current / target) * 100);
  const colorMap = {
    blue: 'bg-[#3B82F6]',
    green: 'bg-[#10B981]',
    amber: 'bg-[#F59E0B]'
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{label}</span>
        <span className="text-[10px] font-mono font-bold text-[#F8FAFC] bg-[#0F172A] px-2 py-0.5 rounded border border-[#334155]">{percentage.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full bg-[#0F172A] rounded-full overflow-hidden border border-[#334155]">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.5, ease: "circOut" }}
          className={`h-full ${colorMap[color]} shadow-[0_0_10px_rgba(59,130,246,0.3)]`}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-[#334155] font-bold">
        <span>IM {current.toLocaleString()}</span>
        <span>IM {target.toLocaleString()}</span>
      </div>
    </div>
  );
}

function FilterChip({ label, active }: { label: string, active?: boolean }) {
  return (
    <button className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
      active 
        ? 'bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/20 ring-1 ring-[#3B82F6]' 
        : 'text-[#94A3B8] hover:bg-[#334155] hover:text-[#F8FAFC]'
    }`}>
      {label}
    </button>
  );
}

function Modal({ title, children, onClose, maxWidth = 'max-w-md', fullHeight = false }: { title: string, children: ReactNode, onClose: () => void, maxWidth?: string, fullHeight?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#0F172A]/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 40 }}
        className={`relative w-full ${maxWidth} bg-[#1E293B] rounded-[32px] border border-[#334155] shadow-2xl overflow-hidden flex flex-col ${fullHeight ? 'h-[95vh]' : 'max-h-[95vh]'}`}
      >
        <div className="p-6 md:p-10 pb-4 flex items-center justify-between shrink-0">
          <h3 className="text-xl font-black uppercase tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-2.5 hover:bg-[#334155] rounded-full transition-all text-[#94A3B8] hover:text-[#F8FAFC]">
            <X size={20} />
          </button>
        </div>
        <div className={`p-4 md:p-10 pt-4 flex-1 overflow-hidden ${fullHeight ? 'flex flex-col' : ''}`}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function TransferForm({ onSuccess, balance }: { onSuccess: (data: any) => void, balance: number }) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!recipient || !amount) return;
    
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => onSuccess({ recipient, amount: parseFloat(amount) }), 1000);
    }, 1500);
  };

  if (success) {
    return (
      <div className="text-center py-12 space-y-6">
        <div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-[#10B981]/5">
          <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
        </div>
        <div>
          <h4 className="text-xl font-black uppercase tracking-tight">Sucesso!</h4>
          <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mt-2">Transferência concluída</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-3">
        <label className="text-[10px] font-black text-[#334155] uppercase tracking-[0.2em] ml-1">Destinatário</label>
        <input 
          type="text" 
          placeholder="Nome ou Número da Conta"
          className="w-full px-6 py-4 bg-[#0F172A] border border-[#334155] rounded-2xl focus:ring-2 focus:ring-[#3B82F6]/20 transition-all text-sm font-bold text-[#F8FAFC] placeholder:text-[#334155]"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
        />
      </div>
      <div className="space-y-3">
        <label className="text-[10px] font-black text-[#334155] uppercase tracking-[0.2em] ml-1">Valor (IM)</label>
        <div className="relative">
          <input 
            type="number" 
            placeholder="0.00"
            className="w-full px-6 py-5 bg-[#0F172A] border-2 border-[#334155] rounded-2xl focus:border-[#3B82F6] transition-all text-3xl font-black text-[#F8FAFC] placeholder:text-[#334155]"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            max={balance}
            step="0.01"
            required
          />
        </div>
        <p className="text-[10px] text-[#334155] font-black uppercase tracking-tighter">Saldo atual: IM {balance.toLocaleString()}</p>
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-5 bg-[#3B82F6] text-[#F8FAFC] rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#3B82F6]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? 'Processando...' : 'Confirmar Envio'}
      </button>
    </form>
  );
}

function PaymentForm({ onSuccess, balance, userId, rank }: { onSuccess: (bill: Bill, finalAmount: number) => void, balance: number, userId: string, rank: UserRank }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'bills'), 
      where('userId', '==', userId), 
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      const bList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill));
      setBills(bList);
      setLoadingBills(false);
    });
  }, [userId]);

  const getDiscountedAmount = (amount: number) => {
    if (rank === 'imperador') return 0;
    if (rank === 'nobre') return amount * 0.2; // 80% desconto
    if (rank === 'conselheiro') return amount * 0.75; // 25% desconto
    return amount;
  };

  const handlePay = async (bill: Bill) => {
    const finalAmount = getDiscountedAmount(bill.amount);
    
    if (balance < finalAmount) {
      alert("Saldo insuficiente para pagar este item.");
      return;
    }
    
    setLoading(true);
    try {
      const billRef = doc(db, 'bills', bill.id);
      await updateDoc(billRef, { status: 'paid' });
      
      // Increment Imperial Treasury
      const treasuryRef = doc(db, 'system', 'treasury');
      await setDoc(treasuryRef, { 
        balance: increment(finalAmount),
        lastUpdate: serverTimestamp() 
      }, { merge: true });

      // O addTransaction cuidará de atualizar o saldo do usuário para evitar dupla dedução
      setSuccess(true);
      setTimeout(() => onSuccess(bill, finalAmount), 1000);
    } catch (error) {
      console.error("Erro ao pagar:", error);
      alert("Erro ao processar pagamento.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-12 space-y-6">
        <div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-[#10B981]/5">
          <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
        </div>
        <div>
          <h4 className="text-xl font-black uppercase tracking-tight">Liquidado</h4>
          <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mt-2">Pagamento efetuado com sucesso</p>
        </div>
      </div>
    );
  }

  if (loadingBills) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-8 h-8 border-4 border-[#3B82F6]/20 border-t-[#3B82F6] rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#334155]">Buscando cobranças...</p>
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-16 h-16 bg-[#0F172A] rounded-2xl flex items-center justify-center mx-auto border border-[#334155]">
          <CheckCircle2 className="w-8 h-8 text-[#334155]" />
        </div>
        <div>
          <h4 className="text-sm font-black uppercase tracking-tight text-[#F8FAFC]">Tudo em dia!</h4>
          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mt-1">Você não possui taxas ou impostos pendentes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#0F172A] p-4 rounded-xl border border-[#3B82F6]/20 mb-4">
        <span className="text-[10px] font-black uppercase text-[#3B82F6]">Sua Classe: {rank}</span>
        <span className="text-[10px] font-black uppercase text-[#F8FAFC]">
          Desconto: {rank === 'imperador' ? '100%' : rank === 'nobre' ? '80%' : rank === 'conselheiro' ? '25%' : '0%'}
        </span>
      </div>
      <p className="text-[10px] font-black text-[#334155] uppercase tracking-[0.2em] ml-1 mb-4">Selecione uma cobrança para pagar</p>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {bills.map(bill => {
          const finalAmount = getDiscountedAmount(bill.amount);
          const hasDiscount = finalAmount < bill.amount;

          return (
            <div 
              key={bill.id} 
              className="p-5 rounded-2xl bg-[#0F172A] border border-[#334155] hover:border-[#3B82F6]/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${bill.type === 'tax' ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
                    {bill.type === 'tax' ? 'Imposto' : 'Multa'}
                  </span>
                  <h5 className="text-sm font-bold text-[#F8FAFC] mt-2">{bill.description}</h5>
                </div>
                <div className="text-right">
                  {hasDiscount && (
                    <p className="text-[8px] font-black text-[#334155] line-through uppercase mb-1">IM {bill.amount.toLocaleString()}</p>
                  )}
                  <p className="text-sm font-black text-[#10B981]">IM {finalAmount.toLocaleString()}</p>
                </div>
              </div>
              <button 
                onClick={() => handlePay(bill)}
                disabled={loading || balance < finalAmount}
                className="w-full py-3 bg-[#1E293B] hover:bg-[#3B82F6] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:hover:bg-[#1E293B]"
              >
                {loading ? 'Processando...' : balance < finalAmount ? 'Saldo Insuficiente' : 'Pagar Agora'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoansView({ currentUser, addTransaction }: { currentUser: UserAccount, addTransaction: (tx: any) => Promise<void> }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [treasury, setTreasury] = useState({ balance: 0 });

  useEffect(() => {
    const unsubTreasury = onSnapshot(doc(db, 'system', 'treasury'), (snap) => {
      if (snap.exists()) setTreasury(snap.data() as { balance: number });
    });

    const q = query(collection(db, 'loans'), where('userId', '==', currentUser.id), orderBy('createdAt', 'desc'));
    const unsubLoans = onSnapshot(q, (snap) => {
      setLoans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)));
      setLoading(false);
    });

    return () => { unsubTreasury(); unsubLoans(); };
  }, [currentUser.id]);

  const handlePayLoan = async (loan: Loan) => {
    const payAmountString = prompt(`Quanto você deseja pagar do empréstimo? (Máx: IM ${loan.remainingAmount.toLocaleString()})`);
    if (payAmountString === null) return;
    const payAmount = Number(payAmountString);
    if (isNaN(payAmount) || payAmount <= 0) return;
    
    const actualPayAmount = Math.min(payAmount, loan.remainingAmount);
    
    if (currentUser.balance < actualPayAmount) {
      alert("Saldo insuficiente.");
      return;
    }

    try {
      await addTransaction({
        type: 'transfer',
        amount: -actualPayAmount,
        description: `Pagamento Empréstimo: ${loan.id.substring(0, 8)}`,
        category: 'Empréstimo'
      });

      await updateDoc(doc(db, 'system', 'treasury'), {
        balance: increment(actualPayAmount)
      });

      const newRemaining = loan.remainingAmount - actualPayAmount;
      await updateDoc(doc(db, 'loans', loan.id), {
        remainingAmount: newRemaining,
        status: newRemaining <= 0 ? 'paid' : 'active',
        updatedAt: serverTimestamp()
      });

      alert("Pagamento processado com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao processar pagamento.");
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-4">
            <CreditCard className="text-[#3B82F6]" size={40} /> Empréstimos Imperiais
          </h2>
          <p className="text-[#94A3B8] text-xs font-black uppercase tracking-widest">Crédito financiado pelo Tesouro do Império</p>
        </div>
        <button 
          onClick={() => setShowRequestModal(true)}
          className="px-8 py-4 bg-[#3B82F6] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-[#3B82F6]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3"
        >
          <Plus size={18} /> Novo Empréstimo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="card-theme p-8 bg-[#1E293B] border-none space-y-6">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8]">Tesouro Disponível</p>
              <h3 className="text-3xl font-black text-[#F8FAFC]">IM {treasury.balance.toLocaleString()}</h3>
            </div>
            <div className="p-4 bg-[#0F172A] rounded-xl border border-[#334155] space-y-3">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#334155]">Regras de Crédito</p>
              <ul className="space-y-2">
                <li className="text-[10px] font-bold text-[#94A3B8] flex items-center gap-2">
                   <div className="w-1 h-1 rounded-full bg-[#3B82F6]" /> Limite máx: IM 2.000
                </li>
                <li className="text-[10px] font-bold text-[#94A3B8] flex items-center gap-2">
                   <div className="w-1 h-1 rounded-full bg-[#3B82F6]" /> Até IM 1.000: 0% Juros
                </li>
                <li className="text-[10px] font-bold text-[#94A3B8] flex items-center gap-2">
                   <div className="w-1 h-1 rounded-full bg-[#3B82F6]" /> IM 1.001 - 1.500: 20% Juros
                </li>
                <li className="text-[10px] font-bold text-[#94A3B8] flex items-center gap-2">
                   <div className="w-1 h-1 rounded-full bg-[#3B82F6]" /> Acima de IM 1.500: 50% Juros
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="space-y-4">
            {loans.map(loan => (
              <div key={loan.id} className="card-theme p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5 flex-1">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${loan.status === 'paid' ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]' : 'bg-[#3B82F6]/10 border-[#3B82F6]/30 text-[#3B82F6]'}`}>
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${loan.status === 'paid' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' : 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30'}`}>
                        {loan.status === 'paid' ? 'Liquidado' : 'Ativo'}
                      </span>
                      <span className="text-[10px] text-[#334155] font-black">{new Date(loan.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-sm font-black text-[#F8FAFC]">Empréstimo ID: {loan.id.substring(0, 8).toUpperCase()}</h4>
                    <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mt-1">
                      Tomado: IM {loan.amount.toLocaleString()} • Total c/ Juros: IM {loan.totalToPay.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8 w-full md:w-auto border-t md:border-t-0 md:border-l border-[#334155] pt-6 md:pt-0 md:pl-8">
                  <div className="text-right">
                    <p className="text-[8px] font-black text-[#334155] uppercase">Restante</p>
                    <p className="text-lg font-black text-[#F8FAFC]">IM {loan.remainingAmount.toLocaleString()}</p>
                  </div>
                  {loan.status === 'active' && (
                    <button 
                      onClick={() => handlePayLoan(loan)}
                      className="px-6 py-3 bg-[#10B981] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.05] transition-all shadow-lg shadow-[#10B981]/10"
                    >
                      Pagar
                    </button>
                  )}
                  {loan.status === 'paid' && (
                    <div className="w-8 h-8 rounded-full bg-[#10B981]/20 flex items-center justify-center text-[#10B981]">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loans.length === 0 && !loading && (
              <div className="p-20 text-center space-y-4 border-2 border-dashed border-[#334155] rounded-[40px] opacity-30">
                <CreditCard size={60} className="mx-auto text-[#334155]" />
                <p className="text-xs font-black uppercase tracking-widest text-[#334155]">Você não possui empréstimos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showRequestModal && (
          <Modal title="Solicitar Empréstimo" onClose={() => setShowRequestModal(false)}>
            <LoanRequestForm 
              currentUser={currentUser} 
              treasuryBalance={treasury.balance}
              onSuccess={() => {
                setShowRequestModal(false);
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoanRequestForm({ currentUser, treasuryBalance, onSuccess }: { currentUser: UserAccount, treasuryBalance: number, onSuccess: () => void }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const calculateInterest = (val: number) => {
    if (val <= 1000) return 0;
    if (val <= 1500) return 0.20;
    return 0.50;
  };

  const val = parseFloat(amount) || 0;
  const interestRate = calculateInterest(val);
  const interestAmount = val * interestRate;
  const totalToPay = val + interestAmount;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (val <= 0 || val > 2000) {
      alert("Valor inválido. Máximo de IM 2.000.");
      return;
    }
    if (val > treasuryBalance) {
      alert("O Tesouro Imperial não possui fundos suficientes no momento.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'loans'), {
        userId: currentUser.id,
        userName: currentUser.name,
        amount: val,
        totalToPay: totalToPay,
        remainingAmount: totalToPay,
        interestRate: interestRate,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'system', 'treasury'), {
        balance: increment(-val)
      });

      await updateDoc(doc(db, 'users', currentUser.id), {
        balance: increment(val)
      });

      await addDoc(collection(db, 'transactions'), {
        userId: currentUser.id,
        type: 'transfer',
        amount: val,
        description: `Empréstimo Imperial Tomado (IM ${val.toLocaleString()})`,
        timestamp: serverTimestamp(),
        category: 'Empréstimo'
      });

      alert("Empréstimo concedido com sucesso!");
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Erro ao processar empréstimo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-3">
        <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest ml-1">Valor do Empréstimo (Máx 2.000)</label>
        <div className="relative">
          <input 
            type="number" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-6 py-5 bg-[#0F172A] border-2 border-[#334155] rounded-2xl focus:border-[#3B82F6] transition-all text-3xl font-black text-[#F8FAFC] placeholder:text-[#334155]"
            placeholder="0"
            max="2000"
            required
          />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-[#334155]">IM</div>
        </div>
      </div>

      <div className="p-6 bg-[#0F172A] rounded-2xl border border-[#334155] space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-black text-[#334155] uppercase">Juros Aplicados</p>
          <p className="text-xs font-black text-[#F59E0B]">{(interestRate * 100).toFixed(0)}%</p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-black text-[#334155] uppercase">Valor dos Juros</p>
          <p className="text-xs font-black text-[#F8FAFC]">IM {interestAmount.toLocaleString()}</p>
        </div>
        <div className="pt-4 border-t border-[#334155] flex justify-between items-center">
          <p className="text-[10px] font-black text-[#F8FAFC] uppercase">Total a Pagar</p>
          <p className="text-xl font-black text-[#10B981]">IM {totalToPay.toLocaleString()}</p>
        </div>
      </div>

      <button 
        type="submit"
        disabled={loading || val <= 0 || val > 2000}
        className="w-full py-5 bg-[#3B82F6] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#3B82F6]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? 'Processando...' : 'Solicitar Crédito'}
      </button>
    </form>
  );
}

function CoursesView({ 
  currentUser, 
  addTransaction,
  recordAction
}: { 
  currentUser: UserAccount, 
  addTransaction: (tx: any) => Promise<void>,
  recordAction: (userId: string, type: any) => Promise<void>
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [purchasedCourses, setPurchasedCourses] = useState<PurchasedCourse[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'market' | 'my_courses' | 'instructor'>('market');
  const [loading, setLoading] = useState(true);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [selectedCourseForContent, setSelectedCourseForContent] = useState<Course | null>(null);

  useEffect(() => {
    const qCourses = query(collection(db, 'courses'), where('isActive', '==', true));
    const unsubscribeCourses = onSnapshot(qCourses, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      setLoading(false);
    });

    const qPurchased = query(collection(db, 'purchased_courses'), where('userId', '==', currentUser.id));
    const unsubscribePurchased = onSnapshot(qPurchased, (snapshot) => {
      setPurchasedCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchasedCourse)));
    });

    return () => {
      unsubscribeCourses();
      unsubscribePurchased();
    };
  }, [currentUser.id]);

  const handleBuyCourse = async (course: Course) => {
    if (currentUser.balance < course.price) {
      alert("Saldo insuficiente em IM.");
      return;
    }

    if (purchasedCourses.some(p => p.courseId === course.id)) {
      alert("Você já possui este curso.");
      return;
    }

    if (!confirm(`Confirmar compra do curso "${course.name}" por IM ${course.price.toLocaleString()}?`)) {
      return;
    }

    try {
      const treasuryTax = Math.floor(course.price * 0.05); // 5% tax to treasury
      const professorGain = course.price - treasuryTax;

      // 1. Record Purchase
      await addDoc(collection(db, 'purchased_courses'), {
        courseId: course.id,
        userId: currentUser.id,
        purchaseDate: serverTimestamp(),
        pricePaid: course.price
      });

      // 2. Debit Student
      await updateDoc(doc(db, 'users', currentUser.id), {
        balance: increment(-course.price)
      });

      // 3. Credit Professor
      await updateDoc(doc(db, 'users', course.professorId), {
        balance: increment(professorGain)
      });

      // 4. Credit Treasury
      await updateDoc(doc(db, 'system', 'treasury'), {
        balance: increment(treasuryTax)
      });

      // 5. Record Transaction for Student
      await addTransaction({
        type: 'course_purchase',
        amount: -course.price,
        description: `Compra de Curso: ${course.name}`,
        category: 'Educação'
      });

      // 6. Record Transaction for Professor
      await addDoc(collection(db, 'transactions'), {
        userId: course.professorId,
        type: 'transfer_in',
        amount: professorGain,
        description: `Venda de Curso: ${course.name} (Aluno: ${currentUser.name})`,
        timestamp: serverTimestamp(),
        category: 'Educação'
      });

      // Progression: Record Purchase & Sale
      recordAction(currentUser.id, 'purchase');
      recordAction(course.professorId, 'sale');

      alert("Curso adquirido com sucesso! Bons estudos.");
    } catch (err) {
      console.error(err);
      alert("Erro ao processar compra.");
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-[#F8FAFC]">Academia Imperial</h2>
          <p className="text-xs font-bold text-[#334155] uppercase tracking-widest mt-1">Transforme IM em Conhecimento</p>
        </div>

        <div className="flex p-1 bg-[#1E293B] rounded-xl border border-[#334155]">
          <button 
            onClick={() => setActiveSubTab('market')}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSubTab === 'market' ? 'bg-[#3B82F6] text-white shadow-lg' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
          >
            Mercado
          </button>
          <button 
            onClick={() => setActiveSubTab('my_courses')}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSubTab === 'my_courses' ? 'bg-[#3B82F6] text-white shadow-lg' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
          >
            Meus Cursos
          </button>
          {(currentUser.rank === 'nobre' || currentUser.rank === 'imperador') && (
            <button 
              onClick={() => setActiveSubTab('instructor')}
              className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSubTab === 'instructor' ? 'bg-[#3B82F6] text-white shadow-lg' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
            >
              Área do Professor
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'market' && (
          <motion.div 
            key="market"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {loading ? (
              <div className="col-span-full py-20 text-center">
                <div className="w-10 h-10 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-xs font-bold text-[#334155] uppercase tracking-widest">Carregando Cursos...</p>
              </div>
            ) : courses.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-[#1E293B] rounded-3xl border-2 border-dashed border-[#334155]">
                <BookOpen className="w-12 h-12 text-[#334155] mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold text-[#334155] uppercase tracking-widest">Nenhum curso disponível no momento</p>
              </div>
            ) : courses.map(course => (
              <CourseCard 
                key={course.id} 
                course={course} 
                onBuy={() => handleBuyCourse(course)}
                isOwned={purchasedCourses.some(p => p.courseId === course.id)}
                isProfessor={course.professorId === currentUser.id}
              />
            ))}
          </motion.div>
        )}

        {activeSubTab === 'my_courses' && (
          <motion.div 
            key="my_courses"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {purchasedCourses.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-[#1E293B] rounded-3xl border-2 border-dashed border-[#334155]">
                <Package className="w-12 h-12 text-[#334155] mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold text-[#334155] uppercase tracking-widest">Você ainda não adquiriu nenhum curso</p>
                <button 
                  onClick={() => setActiveSubTab('market')}
                  className="mt-6 px-8 py-3 bg-[#3B82F6] text-white rounded-xl text-xs font-black uppercase tracking-widest"
                >
                  Explorar Mercado
                </button>
              </div>
            ) : (
              courses.filter(c => purchasedCourses.some(p => p.courseId === c.id)).map(course => (
                <CourseCard 
                  key={course.id} 
                  course={course} 
                  isOwned={true} 
                  onAccess={() => setSelectedCourseForContent(course)}
                />
              ))
            )}
          </motion.div>
        )}

        {activeSubTab === 'instructor' && (currentUser.rank === 'nobre' || currentUser.rank === 'imperador') && (
          <motion.div 
            key="instructor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-tight text-[#F8FAFC]">Gerenciar Meus Cursos</h3>
              <button 
                onClick={() => setShowCreateCourse(true)}
                className="px-6 py-3 bg-[#10B981] text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all"
              >
                <Plus size={16} /> Criar Novo Curso
              </button>
            </div>

            <InstructorDashboard 
              currentUser={currentUser} 
              allCourses={courses} 
              allPurchases={purchasedCourses} 
              onManageContent={(course) => setSelectedCourseForContent(course)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showCreateCourse && (
        <Modal title="Lançar Novo Curso" onClose={() => setShowCreateCourse(false)} maxWidth="max-w-2xl">
          <CreateCourseForm 
            currentUser={currentUser} 
            onSuccess={() => setShowCreateCourse(false)} 
            recordAction={recordAction}
          />
        </Modal>
      )}

      {selectedCourseForContent && (
        <Modal 
          title={`Aulas: ${selectedCourseForContent.name}`} 
          onClose={() => setSelectedCourseForContent(null)}
          maxWidth="max-w-[95vw]"
          fullHeight
        >
          <CourseContentView 
            course={selectedCourseForContent} 
            currentUser={currentUser}
            purchaseRecord={purchasedCourses.find(p => p.courseId === selectedCourseForContent.id)}
            isProfessor={selectedCourseForContent.professorId === currentUser.id}
            onUpdate={() => setSelectedCourseForContent(null)}
            recordAction={recordAction}
          />
        </Modal>
      )}
    </div>
  );
}

function CourseCard({ course, onBuy, onAccess, isOwned, isProfessor }: { course: Course, onBuy?: () => void, onAccess?: () => void, isOwned: boolean, isProfessor?: boolean, key?: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-[#1E293B] border border-[#334155] rounded-3xl overflow-hidden shadow-xl group"
    >
      <div className="p-1 h-48 bg-gradient-to-br from-[#3B82F6]/20 to-transparent relative">
        <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-20 transition-opacity">
          <BookOpen size={120} className="text-[#3B82F6]" />
        </div>
        <div className="absolute top-6 left-6 flex flex-col gap-1">
          <span className="px-3 py-1 bg-[#10B981]/20 text-[#10B981] text-[8px] font-black uppercase tracking-[0.2em] rounded-full border border-[#10B981]/30">Duração: {course.duration}</span>
          {isProfessor && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-[0.2em] rounded-full border border-amber-500/30">Seu Curso</span>}
        </div>
      </div>
      
      <div className="p-8 space-y-6">
        <div className="space-y-2">
          <h4 className="text-xl font-black text-[#F8FAFC] leading-tight tracking-tight group-hover:text-[#3B82F6] transition-colors">{course.name}</h4>
          <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">{course.professorName}</p>
        </div>
        
        <p className="text-sm text-[#94A3B8] line-clamp-3 leading-relaxed font-medium">
          {course.description}
        </p>
        
        <div className="pt-6 border-t border-[#334155] flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-[#334155] uppercase tracking-widest">Valor do Investimento</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#F8FAFC]">IM {course.price.toLocaleString()}</span>
            </div>
          </div>
          
          {isOwned ? (
            <button 
              onClick={onAccess}
              className="px-6 py-3 bg-[#10B981] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#059669] transition-all flex items-center gap-2"
            >
              <PlayCircle size={16} /> Acessar Aula
            </button>
          ) : (
            <button 
              onClick={onBuy}
              disabled={isProfessor}
              className="px-6 py-3 bg-[#3B82F6] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#2563EB] transition-all disabled:opacity-50"
            >
              Comprar
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function InstructorDashboard({ currentUser, allCourses, allPurchases, onManageContent }: { currentUser: UserAccount, allCourses: Course[], allPurchases: PurchasedCourse[], onManageContent: (course: Course) => void }) {
  const [purchases, setPurchases] = useState<PurchasedCourse[]>([]);
  
  useEffect(() => {
    const qPurchases = query(collection(db, 'purchased_courses')); 
    const unsubscribe = onSnapshot(qPurchases, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchasedCourse));
      setPurchases(data);
    });
    return () => unsubscribe();
  }, []);

  const myCourses = allCourses.filter(c => c.professorId === currentUser.id);
  
  const getEnrollmentsCount = (courseId: string) => {
    return purchases.filter(p => p.courseId === courseId).length;
  };

  const getTotalRevenue = (courseId: string) => {
    return purchases
      .filter(p => p.courseId === courseId)
      .reduce((sum, p) => sum + (p.pricePaid * 0.95), 0);
  };

  if (myCourses.length === 0) {
    return (
      <div className="py-20 text-center bg-[#1E293B] rounded-3xl border-2 border-dashed border-[#334155]">
        <UsersIcon className="w-12 h-12 text-[#334155] mx-auto mb-4 opacity-20" />
        <p className="text-sm font-bold text-[#334155] uppercase tracking-widest">Você ainda não criou nenhum curso</p>
        <p className="text-xs text-[#334155] font-bold mt-2">Torne-se um professor imperial hoje!</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1E293B] rounded-3xl border border-[#334155] overflow-hidden shadow-2xl">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#0F172A]/50 border-b border-[#334155]">
            <th className="px-8 py-6 text-left text-[10px] font-bold text-[#334155] uppercase tracking-widest">Curso</th>
            <th className="px-8 py-6 text-left text-[10px] font-bold text-[#334155] uppercase tracking-widest">Alunos</th>
            <th className="px-8 py-6 text-left text-[10px] font-bold text-[#334155] uppercase tracking-widest">Preço Individual</th>
            <th className="px-8 py-6 text-right text-[10px] font-bold text-[#334155] uppercase tracking-widest">Total Líquido Recebido</th>
            <th className="px-8 py-6 text-right text-[10px] font-bold text-[#334155] uppercase tracking-widest">Gerenciar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#334155]">
          {myCourses.map(course => (
            <tr key={course.id} className="hover:bg-[#334155]/20 transition-colors group">
              <td className="px-8 py-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg">
                    <BookOpen size={16} />
                  </div>
                  <span className="font-black text-[#F8FAFC] group-hover:text-[#3B82F6] transition-colors uppercase tracking-tight">{course.name}</span>
                </div>
              </td>
              <td className="px-8 py-6">
                <span className="px-4 py-1 bg-[#1E293B] border border-[#334155] rounded-full text-[10px] font-black text-[#F8FAFC]">
                  {getEnrollmentsCount(course.id)} ALUNOS
                </span>
              </td>
              <td className="px-8 py-6">
                <span className="text-xs font-black text-[#94A3B8]">IM {course.price.toLocaleString()}</span>
              </td>
              <td className="px-8 py-6 text-right">
                <span className="text-lg font-black text-[#10B981]">IM {getTotalRevenue(course.id).toLocaleString()}</span>
              </td>
              <td className="px-8 py-6 text-right">
                <button 
                  onClick={() => onManageContent(course)}
                  className="p-2 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg hover:bg-[#3B82F6] hover:text-white transition-all"
                >
                  <Edit size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CourseContentView({ 
  course, 
  currentUser, 
  purchaseRecord, 
  isProfessor, 
  onUpdate,
  recordAction
}: { 
  course: Course, 
  currentUser: UserAccount,
  purchaseRecord?: PurchasedCourse,
  isProfessor: boolean, 
  onUpdate: () => void,
  recordAction: (userId: string, type: any) => Promise<void>
}) {
  const [editing, setEditing] = useState(false);
  const [newStructure, setNewStructure] = useState<Module[]>(course.structure || []);
  const [activeLesson, setActiveLesson] = useState<{ mIdx: number, lIdx: number }>({ mIdx: 0, lIdx: 0 });
  const [saving, setSaving] = useState(false);
  const [showDiploma, setShowDiploma] = useState(false);

  // Auto-save logic could go here, but we'll use a manual save for stability
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'courses', course.id), {
        structure: newStructure
      });
      alert("Curso atualizado com sucesso!");
      setEditing(false);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar curso.");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!purchaseRecord) return;
    if (purchaseRecord.completed) {
      setShowDiploma(true);
      return;
    }
    if (!confirm("Confirmar conclusão de curso? Você receberá seu Diploma Imperial e será promovido a Nobre!")) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'purchased_courses', purchaseRecord.id), {
        completed: true,
        completionDate: serverTimestamp()
      });
      if (currentUser.rank !== 'nobre' && currentUser.rank !== 'imperador') {
        await updateDoc(doc(db, 'users', currentUser.id), { rank: 'nobre' });
      }

      // Progression: Record Course Completion
      recordAction(currentUser.id, 'course_completed');

      setShowDiploma(true);
    } catch (err) {
      console.error(err);
      alert("Erro ao finalizar curso.");
    } finally {
      setSaving(false);
    }
  };

  const renderContent = (content: string) => {
    if (!content) return null;
    return content.split('\n').map((line, i) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return <br key={i} />;
      const ytMatch = trimmedLine.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (ytMatch) {
        return (
          <div key={i} className="my-4 aspect-video rounded-xl overflow-hidden border border-[#334155] bg-black shadow-2xl">
            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${ytMatch[1]}`} title="YouTube" frameBorder="0" allowFullScreen></iframe>
          </div>
        );
      }
      const imgMatch = trimmedLine.match(/(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|svg))/i);
      if (imgMatch) {
        return (
          <div key={i} className="my-4 rounded-xl overflow-hidden border border-[#334155] shadow-xl">
            <img src={imgMatch[0]} alt="Aula" className="w-full h-auto" />
          </div>
        );
      }
      return <p key={i} className="mb-3 text-sm text-[#94A3B8] leading-relaxed">{line}</p>;
    });
  };

  if (showDiploma) {
    return (
      <div className="p-10 border-8 border-double border-[#3B82F6] bg-[#0F172A] rounded-3xl text-center space-y-8 relative overflow-hidden">
        <Award size={80} className="text-[#3B82F6] mx-auto animate-bounce" />
        <h2 className="text-4xl font-black uppercase text-[#F8FAFC]">Diploma de Excelência</h2>
        <div className="py-6 border-y border-[#334155]/30">
          <p className="text-lg font-medium text-[#94A3B8]">Certificamos que</p>
          <p className="text-2xl font-black text-[#F8FAFC] my-2 uppercase">{currentUser.name}</p>
          <p className="text-lg font-medium text-[#94A3B8]">concluiu o curso</p>
          <p className="text-xl font-black text-[#3B82F6] uppercase">{course.name}</p>
        </div>
        <button onClick={() => setShowDiploma(false)} className="w-full py-4 bg-[#3B82F6] text-white rounded-xl font-black uppercase text-xs">Fechar</button>
      </div>
    );
  }

  const currentLesson = editing ? 
    newStructure[activeLesson.mIdx]?.lessons[activeLesson.lIdx] : 
    course.structure?.[activeLesson.mIdx]?.lessons[activeLesson.lIdx];

  return (
    <div className="h-full flex flex-col bg-[#1E293B] rounded-3xl overflow-hidden border border-[#334155]">
      {/* Header */}
      <div className="px-8 py-4 bg-[#0F172A] border-b border-[#334155] flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#3B82F6]/10 rounded-lg">
            <Layout size={20} className="text-[#3B82F6]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#F8FAFC] uppercase tracking-tight">{course.name}</h3>
            <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest">
              {editing ? 'Modo: Arquiteto Imperial' : `Professor: ${course.professorName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isProfessor && (
            <button 
              onClick={() => editing ? handleSave() : setEditing(true)}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editing ? 'bg-[#10B981] hover:bg-[#059669]' : 'bg-[#3B82F6] hover:bg-[#2563EB]'} text-white shadow-lg`}
            >
              {editing ? <><Save size={14} /> Consolidar Estrutura</> : <><Edit size={14} /> Editar Curso</>}
            </button>
          )}
          {!isProfessor && purchaseRecord && (
            <button 
              onClick={handleComplete}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all ${purchaseRecord.completed ? 'bg-[#10B981]' : 'bg-[#3B82F6]'}`}
            >
              {purchaseRecord.completed ? <><Award size={14} /> Ver Diploma</> : <><Award size={14} /> Finalizar Curso</>}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar: Hierarchy */}
        <div className="w-full md:w-72 bg-[#0F172A]/50 border-b md:border-b-0 md:border-r border-[#334155] overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4 md:space-y-8 h-48 md:h-auto shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-[#334155] uppercase tracking-[0.2em]">Painel de Navegação</p>
            {editing && (
              <button 
                onClick={() => {
                  const newer = [...newStructure];
                  newer.push({ id: `mod-${Date.now()}`, title: `Novo Módulo ${newer.length + 1}`, lessons: [{ id: `l-${Date.now()}`, title: 'Nova Aula', content: '', videoUrl: '', extras: '', activity: '' }] });
                  setNewStructure(newer);
                }}
                className="p-1 hover:bg-[#3B82F6]/10 rounded text-[#3B82F6] transition-colors"
                title="Adicionar Módulo"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
          
          <div className="space-y-6">
            {(editing ? newStructure : (course.structure || [])).map((module, mIdx) => (
              <div key={module.id} className="space-y-3">
                <div className="flex items-center justify-between group">
                  {editing ? (
                    <input 
                      type="text"
                      value={module.title}
                      onChange={(e) => {
                        const newer = [...newStructure];
                        newer[mIdx].title = e.target.value;
                        setNewStructure(newer);
                      }}
                      className="bg-transparent border-b border-[#334155] focus:border-[#3B82F6] outline-none text-[10px] font-black text-[#F8FAFC] uppercase tracking-wider pb-1 w-full mr-2"
                    />
                  ) : (
                    <h4 className="text-[10px] font-black text-[#475569] uppercase tracking-widest">{module.title}</h4>
                  )}
                  {editing && (
                    <button 
                      onClick={() => setNewStructure(newStructure.filter((_, i) => i !== mIdx))}
                      className="opacity-0 group-hover:opacity-100 text-[#EF4444] transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                
                <div className="space-y-1 pl-2">
                  {module.lessons.map((lesson, lIdx) => (
                    <div key={lesson.id} className="flex flex-col gap-1">
                      <button
                        onClick={() => setActiveLesson({ mIdx, lIdx })}
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeLesson.mIdx === mIdx && activeLesson.lIdx === lIdx ? 'bg-[#3B82F6] text-white shadow-md' : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="opacity-50">{lIdx + 1}.</span>
                          <span className="truncate">{lesson.title}</span>
                        </div>
                      </button>
                    </div>
                  ))}
                  {editing && (
                    <button 
                      onClick={() => {
                        const newer = [...newStructure];
                        newer[mIdx].lessons.push({ id: `l-${Date.now()}`, title: 'Nova Aula', content: '', videoUrl: '', extras: '', activity: '' });
                        setNewStructure(newer);
                      }}
                      className="w-full py-2 border border-dashed border-[#334155] rounded-lg text-[8px] font-black text-[#475569] uppercase tracking-widest hover:border-[#3B82F6] hover:text-[#3B82F6] transition-all"
                    >
                      + Aula
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Editor / Viewer */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0F172A] p-6 md:p-10">
          {currentLesson ? (
            <div className="max-w-4xl mx-auto">
              {editing ? (
                /* The Editor Area */
                <div className="grid grid-cols-1 gap-10">
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest">Título da Aula</label>
                      <input 
                        type="text"
                        value={currentLesson.title}
                        onChange={(e) => {
                          const newer = [...newStructure];
                          newer[activeLesson.mIdx].lessons[activeLesson.lIdx].title = e.target.value;
                          setNewStructure(newer);
                        }}
                        className="w-full bg-transparent text-3xl font-black text-[#F8FAFC] border-b-2 border-[#334155] focus:border-[#3B82F6] outline-none pb-2 transition-all uppercase tracking-tight"
                        placeholder="Título Impenetrável"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest">Link do Vídeo (YouTube)</label>
                      <input 
                        type="text"
                        value={currentLesson.videoUrl || ''}
                        onChange={(e) => {
                          const newer = [...newStructure];
                          newer[activeLesson.mIdx].lessons[activeLesson.lIdx].videoUrl = e.target.value;
                          setNewStructure(newer);
                        }}
                        className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-sm font-bold text-[#F8FAFC] focus:border-[#3B82F6] outline-none transition-all"
                        placeholder="https://youtube.com/watch?v=..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest">Conteúdo da Aula</label>
                      <textarea 
                        value={currentLesson.content}
                        onChange={(e) => {
                          const newer = [...newStructure];
                          newer[activeLesson.mIdx].lessons[activeLesson.lIdx].content = e.target.value;
                          setNewStructure(newer);
                        }}
                        className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-6 py-4 text-sm font-medium text-[#F8FAFC] focus:border-[#3B82F6] outline-none transition-all min-h-[300px] leading-relaxed"
                        placeholder="Escreva o conhecimento profundo aqui..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest">Materiais Extras</label>
                        <textarea 
                          value={currentLesson.extras || ''}
                          onChange={(e) => {
                            const newer = [...newStructure];
                            newer[activeLesson.mIdx].lessons[activeLesson.lIdx].extras = e.target.value;
                            setNewStructure(newer);
                          }}
                          className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[10px] font-bold text-[#F8FAFC] focus:border-[#3B82F6] outline-none transition-all min-h-[100px]"
                          placeholder="Links para PDFs, planilhas..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest">Atividade Final</label>
                        <textarea 
                          value={currentLesson.activity || ''}
                          onChange={(e) => {
                            const newer = [...newStructure];
                            newer[activeLesson.mIdx].lessons[activeLesson.lIdx].activity = e.target.value;
                            setNewStructure(newer);
                          }}
                          className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[10px] font-bold text-[#F8FAFC] focus:border-[#3B82F6] outline-none transition-all min-h-[100px]"
                          placeholder="Desafie seu aluno..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Real-time Preview Area */}
                  <div className="mt-10 pt-10 border-t border-[#334155]/30">
                    <div className="flex items-center gap-2 mb-6">
                      <Eye size={12} className="text-[#10B981]" />
                      <p className="text-[10px] font-black text-[#10B981] uppercase tracking-widest">Pré-visualização do Aluno</p>
                    </div>
                    <div className="p-8 bg-[#0F172A] border border-[#334155] rounded-3xl opacity-60">
                      <h4 className="text-2xl font-black text-[#F8FAFC] mb-6 uppercase">{currentLesson.title || 'Título da Aula'}</h4>
                      {currentLesson.videoUrl && renderContent(currentLesson.videoUrl)}
                      <div className="text-sm text-[#94A3B8] leading-relaxed whitespace-pre-wrap">{currentLesson.content || 'O conteúdo aparecerá aqui.'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* The Viewer Area */
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div className="space-y-4">
                      <p className="text-[10px] font-black text-[#3B82F6] uppercase tracking-[0.4em]">Módulo {activeLesson.mIdx + 1} • Aula {activeLesson.lIdx + 1}</p>
                      <h2 className="text-4xl font-black text-[#F8FAFC] uppercase tracking-tighter leading-none">{currentLesson.title}</h2>
                   </div>
                   
                   {currentLesson.videoUrl && (
                     <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <PlayCircle size={14} className="text-[#3B82F6]" />
                           <p className="text-[10px] font-black text-[#F8FAFC] uppercase tracking-widest">Videoaula Principal</p>
                        </div>
                        {renderContent(currentLesson.videoUrl)}
                     </div>
                   )}

                   <div className="bg-[#1E293B]/30 p-8 rounded-3xl border border-[#334155]/50 prose prose-invert max-w-none shadow-inner">
                      <div className="text-base text-[#94A3B8] leading-relaxed whitespace-pre-wrap font-medium">
                        {currentLesson.content}
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {currentLesson.extras && (
                        <div className="p-6 bg-[#0F172A] border border-[#3B82F6]/20 rounded-2xl space-y-4">
                           <div className="flex items-center gap-2">
                              <Star size={14} className="text-[#3B82F6]" />
                              <p className="text-[10px] font-black text-[#F8FAFC] uppercase tracking-widest text-[#3B82F6]">Materiais de Apoio</p>
                           </div>
                           <p className="text-[10px] text-[#94A3B8] font-bold leading-relaxed whitespace-pre-wrap">{currentLesson.extras}</p>
                        </div>
                      )}
                      {currentLesson.activity && (
                        <div className="p-6 bg-[#10B981]/5 border border-[#10B981]/20 rounded-2xl space-y-4">
                           <div className="flex items-center gap-2">
                              <Award size={14} className="text-[#10B981]" />
                              <p className="text-[10px] font-black text-[#F8FAFC] uppercase tracking-widest text-[#10B981]">Desafio Prático</p>
                           </div>
                           <p className="text-[10px] text-[#94A3B8] font-bold leading-relaxed whitespace-pre-wrap">{currentLesson.activity}</p>
                        </div>
                      )}
                   </div>

                   <div className="pt-10 border-t border-[#334155]/20 flex justify-center">
                      <button 
                        onClick={() => {
                          recordAction(currentUser.id, 'lesson_completed');
                          alert("Parabéns! Você completou esta lição e ganhou pontos de conhecimento.");
                        }}
                        className="px-10 py-4 bg-[#10B981] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg shadow-[#10B981]/20"
                      >
                         Marcar como Concluída
                      </button>
                   </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <Layout size={40} className="text-[#334155] mx-auto opacity-20" />
                <p className="text-[10px] font-black text-[#334155] uppercase tracking-widest">Nenhuma aula selecionada</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateCourseForm({ 
  currentUser, 
  onSuccess,
  recordAction
}: { 
  currentUser: UserAccount, 
  onSuccess: () => void,
  recordAction: (userId: string, type: any) => Promise<void>
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);

  const defaultStructure: Module[] = [
    {
      id: "mod1",
      title: "Módulo 01: Primeiros Passos",
      lessons: [
        { id: "l1", title: "Introdução ao Caminho Imperial", content: "Bem-vindo ao curso. Neste vídeo e texto abaixo, entenderemos as bases do seu sucesso.", videoUrl: "", extras: "", activity: "Olá Império! Escreva o que você espera deste curso." },
        { id: "l2", title: "A Mentalidade Nobre", content: "O aprendizado exige foco absoluto.", videoUrl: "", extras: "", activity: "Pratique o silêncio por 5 minutos." }
      ]
    }
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !description || !price || !duration) {
      alert("Preencha todos os campos fundamentais.");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'courses'), {
        name,
        description,
        template: 'imperial_structured',
        structure: defaultStructure,
        price: parseFloat(price),
        duration,
        professorId: currentUser.id,
        professorName: currentUser.name,
        isActive: true,
        createdAt: serverTimestamp()
      });

      // Progression: Record Course Creation
      recordAction(currentUser.id, 'course_created');

      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Erro ao criar curso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar px-1">
        <div className="bg-[#3B82F6]/10 p-6 rounded-2xl border border-[#3B82F6]/20 mb-6">
          <p className="text-[10px] font-black text-[#3B82F6] uppercase tracking-widest mb-1">Guia Imperial:</p>
          <p className="text-xs text-[#94A3B8] font-bold">Você está criando um curso estruturado no Padrão Imperial. O sistema gerará automaticamente o primeiro módulo com placeholders para você preencher no painel de gerenciamento.</p>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest ml-1">Nome do Curso</label>
          <input 
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-6 py-4 bg-[#0F172A] border border-[#334155] rounded-xl focus:border-[#3B82F6] transition-all text-sm font-bold text-[#F8FAFC]"
            placeholder="Ex: Mestres do Ouro Digital"
            required
          />
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest ml-1">Descrição Curta</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-6 py-4 bg-[#0F172A] border border-[#334155] rounded-xl focus:border-[#3B82F6] transition-all text-sm font-bold text-[#F8FAFC] min-h-[100px]"
            placeholder="O que os alunos aprenderão neste curso?"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest ml-1">Preço (IM)</label>
            <input 
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-6 py-4 bg-[#0F172A] border border-[#334155] rounded-xl focus:border-[#3B82F6] transition-all text-sm font-bold text-[#F8FAFC]"
              placeholder="0.00"
              required
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-[#334155] uppercase tracking-widest ml-1">Duração Estimada</label>
            <input 
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-6 py-4 bg-[#0F172A] border border-[#334155] rounded-xl focus:border-[#3B82F6] transition-all text-sm font-bold text-[#F8FAFC]"
              placeholder="Ex: 20 Horas"
              required
            />
          </div>
        </div>
      </div>

      <button 
        type="submit"
        disabled={loading}
        className="w-full py-5 bg-[#3B82F6] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#2563EB] transition-all disabled:opacity-50 shadow-lg shadow-[#3B82F6]/20"
      >
        {loading ? 'Preparando Sala...' : 'Fundar Curso Imperial'}
      </button>
    </form>
  );
}
