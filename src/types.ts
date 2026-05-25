export type TransactionType = 'transfer_out' | 'transfer_in' | 'payment' | 'deposit' | 'fine' | 'tax' | 'salary' | 'course_purchase';

export type UserRank = 'cidadão' | 'conselheiro' | 'nobre' | 'imperador';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  recipient?: string;
  sender?: string;
  category: string;
}

export interface Bill {
  id: string;
  userId: string;
  type: 'tax' | 'fine' | 'fee';
  amount: number;
  description: string;
  status: 'pending' | 'paid';
  createdAt: any;
}

export interface MarketListing {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  price: number;
  createdAt: any;
  active: boolean;
}

export interface MarketOrder {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  title: string;
  amount: number;
  status: 'pending' | 'concluded' | 'problem';
  createdAt: any;
  updatedAt: any;
  disputeNotes?: string;
}

export interface Loan {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  totalToPay: number;
  remainingAmount: number;
  interestRate: number;
  status: 'active' | 'paid' | 'overdue';
  createdAt: any;
  updatedAt: any;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  description: string;
  balance: number;
  accountNumber: string;
  rank: UserRank;
  isBanned?: boolean;
  bannedUntil?: string;
  salary?: number;
  lastSalaryDate?: string;
  economicLevel: number;
  knowledgePoints: number;
  knowledgeLevel: number;
  stats?: {
    transactionsCount: number;
    salesCount: number;
    purchasesCount: number;
    coursesCreatedCount: number;
    coursesCompletedCount: number;
  };
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  videoUrl?: string;
  extras?: string;
  activity?: string;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  name: string;
  description: string;
  professorId: string;
  professorName: string;
  price: number;
  duration: string;
  content?: string;
  structure?: Module[];
  template?: 'freeform' | 'imperial_structured';
  createdAt: any;
  isActive: boolean;
}

export interface PurchasedCourse {
  id: string;
  courseId: string;
  userId: string;
  purchaseDate: any;
  pricePaid: number;
  completed?: boolean;
  completionDate?: any;
}
