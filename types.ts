/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- PLANNER TYPES ---
export interface Holiday {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    color: string;
    description?: string;
}

export interface Trip {
    id:string;
    holidayId: string;
    name: string;
    startDate: string;
    endDate: string;
    color: string;
}

export interface Activity {
    id:string;
    tripId: string;
    name: string;
    date: string;
}

export type EventCategory = 'school' | 'birthday' | 'work' | 'appointment' | 'event';

export interface PlannerEvent {
    id: string;
    name: string;
    category: EventCategory;
    startDate: string;
    endDate: string;
    color: string;
    giftIdeas?: string;
    giftPrice?: number;
}

// --- GOOGLE CALENDAR TYPES ---
export interface GoogleEvent {
    id: string;
    summary: string;
    description?: string;
    start: {
        date?: string; // All-day events
        dateTime?: string; // Timed events
    };
    end: {
        date?: string;
        dateTime?: string;
    };
    htmlLink: string;
    colorId?: string;
}

// --- GOAL TYPES (NEW) ---
export interface GoalCategory {
    id: 'holiday' | 'skill' | 'social' | 'health' | 'personal' | 'work';
    name: string;
    color: string;
}

export interface Goal {
    id: string;
    title: string;
    categoryId: GoalCategory['id'];
    plannedDate?: string;
    notes?: string;
    isCompleted: boolean;
    completionDate?: string;
}

export type Entry = Holiday | Trip | Activity | PlannerEvent | Goal;
export type EntryType = 'holiday' | 'trip' | 'activity' | 'event' | 'goal';

export interface AppData {
    holidays: Holiday[];
    trips: Trip[];
    activities: Activity[];
    events: PlannerEvent[];
    goals: Goal[];
}

// --- TODO TYPES ---
export interface TodoTask {
    id: string;
    projectId: string;
    name: string;
    completed: boolean;
    dueDate?: string;
}

export interface TodoProject {
    id: string;
    name: string;
    status: 'not-started' | 'in-progress' | 'completed';
    priority: 'low' | 'medium' | 'high';
    deadline?: string;
    linkedEventId?: string;
}

export interface TodoData {
    projects: TodoProject[];
    tasks: TodoTask[];
}

// --- BUDGET TYPES ---
export interface BudgetCategory {
    id: 'travel' | 'living' | 'leisure' | 'savings' | 'health' | 'education' | 'gifts' | 'misc' | 'crypto';
    name: 'Travel' | 'Living' | 'Leisure' | 'Savings' | 'Health & Fitness' | 'Education & Learning' | 'Gifts & Giving' | 'Miscellaneous' | 'Crypto';
    description: string;
    budget: number;
    color: string;
}
export interface BudgetEntry {
    id:string;
    name: string;
    date: string; // Start date for recurring entries
    amount: number; // always positive
    categoryId: BudgetCategory['id'];
    isRecurring?: boolean;
    linkedEventId?: string; // holidayId or tripId
    notes?: string;
}

// --- WISHLIST TYPES ---
export interface Wishlist {
    id: string;
    name: string;
}

export interface WishlistItem {
    id: string;
    listId: string;
    name: string;
    priority: 'low' | 'medium' | 'high';
    categoryId: BudgetCategory['id'];
    estimatedCost?: number;
    imageUrl?: string;
    description?: string;
    status: 'active' | 'completed' | 'on-hold';
    // For completed items
    finalCost?: number;
    completedDate?: string;
}

export interface WishlistData {
    lists: Wishlist[];
    items: WishlistItem[];
}

// --- FINANCE TYPES ---
export interface Account {
    id: string;
    type: 'checking' | 'savings' | 'credit-card' | 'investment' | 'crypto-exchange' | 'self-custody-wallet' | 'loan';
    provider: string; // e.g., 'Chase Bank', 'Coinbase', 'Ledger Nano S'
    currency: string; // ISO 4217 code, e.g., 'USD', 'EUR'
    balance: number; // For fiat/investment accounts. Negative for debt like credit cards.
    riskTier?: 'low' | 'medium' | 'high'; // For crypto, e.g., self-custody vs exchange
}

export interface Holding {
    id: string;
    accountId: string;
    symbol: string; // e.g., 'BTC', 'ETH', 'VOO'
    quantity: number;
    averageCostBasis?: number; // Price per unit at time of acquisition
}

export interface FinanceTransaction {
    id: string;
    accountId: string;
    date: string;
    amount: number; // positive for income, negative for expense
    merchant: string;
    category: BudgetCategory['id'];
    isPending: boolean;
}

export interface FinanceGoal {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: string;
    priority: 'low' | 'medium' | 'high';
}

export interface FinanceData {
    accounts: Account[];
    holdings: Holding[];
    goals: FinanceGoal[];
    transactions: FinanceTransaction[]; // Will be derived from budget entries for now
}


// --- UI / MODAL STATE TYPES ---
export interface ModalState {
    mode: 'add' | 'edit';
    type: EntryType;
    data?: Entry;
    parentId?: string;
}

export type HandleSave = {
  (entryData: Omit<Holiday, 'id'>, type: 'holiday', id?: string): void;
  (entryData: Omit<Trip, 'id'>, type: 'trip', id?: string): void;
  (entryData: Omit<Activity, 'id'>, type: 'activity', id?: string): void;
  (entryData: Omit<PlannerEvent, 'id'>, type: 'event', id?: string): void;
};

// --- NAVIGATION SETTINGS TYPES ---
export interface NavItemSetting {
    id: string;
    isVisible: boolean;
}

// --- AI FEATURE TYPES ---
export interface VacationRecommendation {
    location: string;
    description: string;
    bestTimeToVisit: string;
}

export interface PackingItem {
    name: string;
    emoji: string;
}

export interface PackingData {
    essentials: PackingItem[];
    carryOn: PackingItem[];
    checkedLuggage: PackingItem[];
    suggestedActivities?: {
        name: string;
        description: string;
    }[];
}


export interface VacationGuideData {
    quickInfo: {
        budget: string;
        dangerLevel: 'low' | 'medium' | 'high';
        language: string;
        currency: string;
        bestTime: string;
        visa: string;
        weather: string;
    };
    attractions: {
        landmarks: { name: string; description: string; }[];
        seasonalEvents: { name: string; description: string; }[];
        options: { name: string; description: string; type: 'Adventure' | 'Relaxation' | 'Cultural'; }[];
    };
    food: {
        signatureDishes: { name: string; description: string; }[];
        streetFoodSafety: string;
        restaurantPrices: string;
    };
    packing: {
        clothing: string[];
        gear: string[];
        specialItems: string[];
    };
    tailoredSuggestions?: string;
}


// --- SHARED DATA CONSTANTS ---
export const initialCategories: BudgetCategory[] = [
    { id: 'travel', name: 'Travel', description: 'Holidays, weekend getaways, flights, hotels, tours, transportation for trips.', budget: 1000, color: '#3498db' },
    { id: 'living', name: 'Living', description: 'Day-to-day essential expenses for running your life/home (e.g., Rent, Utilities, Groceries).', budget: 2000, color: '#e74c3c' },
    { id: 'leisure', name: 'Leisure', description: 'Fun, hobbies, and non-essential enjoyment spending (e.g., Dining Out, Entertainment).', budget: 500, color: '#2ecc71' },
    { id: 'savings', name: 'Savings', description: 'Long-term savings, investments.', budget: 500, color: '#f1c40f' },
    { id: 'health', name: 'Health & Fitness', description: 'Staying healthy and fit (e.g., Medical, Gym, Sports Gear).', budget: 200, color: '#1abc9c' },
    { id: 'education', name: 'Education & Learning', description: 'Self-improvement and skill-building (e.g., Courses, Books).', budget: 200, color: '#e67e22' },
    { id: 'gifts', name: 'Gifts & Giving', description: 'Money spent on others or donations (e.g., Birthdays, Weddings).', budget: 200, color: '#9b59b6' },
    { id: 'crypto', name: 'Crypto', description: 'Buying cryptocurrencies like Bitcoin, Ethereum, etc.', budget: 100, color: '#f39c12' },
    { id: 'misc', name: 'Miscellaneous', description: 'Anything that doesn’t fit in other categories (e.g., random purchases, unexpected expenses).', budget: 100, color: '#95a5a6' },
];

export const initialGoalCategories: GoalCategory[] = [
    { id: 'holiday', name: 'Holiday', color: '#3498db' },
    { id: 'skill', name: 'Skill', color: '#9b59b6' },
    { id: 'social', name: 'Social', color: '#e67e22' },
    { id: 'health', name: 'Health', color: '#2ecc71' },
    { id: 'personal', name: 'Personal', color: '#f1c40f' },
    { id: 'work', name: 'Work', color: '#e74c3c' },
];