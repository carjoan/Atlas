/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useMemo, useCallback, useReducer, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BudgetView } from './BudgetView';
import { WishlistView } from './WishlistView';
import { TodoView } from './TodoView';
import { HomeView } from './HomeView';
import { FinancesView } from './FinancesView';
import type {
    Holiday, Trip, Activity, EventCategory, PlannerEvent,
    Entry, EntryType, AppData,
    TodoTask, TodoProject, TodoData,
    BudgetCategory, BudgetEntry, WishlistData, WishlistItem,
    FinanceData,
    ModalState, HandleSave, NavItemSetting, Goal, GoogleEvent
} from './types';
import { PlannerView } from './PlannerView';
import { VacationGuideView } from './VacationGuideView';
import { initialGoalCategories } from './types';
import { initGoogleClient, handleSignIn, handleSignOut } from './api';


// --- UTILITY FUNCTIONS ---
const getDaysUntil = (dateStr: string) => {
  if (!dateStr) return 0;
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const targetDate = new Date(`${dateStr}T00:00:00Z`);
  const diffTime = targetDate.getTime() - todayUTC.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const hexToRgba = (hex: string, alpha = 0.3) => {
    if (!hex || hex.length < 4) return `rgba(187, 134, 252, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const addMonths = (date: Date, months: number) => {
    const newDate = new Date(date);
    newDate.setUTCMonth(newDate.getUTCMonth() + months);
    return newDate;
};

// --- STATE MANAGEMENT (REDUCER) ---

type AppAction =
    | { type: 'SAVE_ENTRY'; payload: { entry: Entry; entryType: EntryType } }
    | { type: 'DELETE_ENTRY'; payload: { id: string; entryType: EntryType } }
    | { type: 'TOGGLE_GOAL_COMPLETION'; payload: { id: string; isCompleted: boolean } };

function appReducer(state: AppData, action: AppAction): AppData {
    switch (action.type) {
        case 'SAVE_ENTRY': {
            const { entry, entryType } = action.payload;

            if (entryType === 'goal') {
                const collection = state.goals;
                const existingIndex = entry.id ? collection.findIndex(item => item.id === entry.id) : -1;
                if (existingIndex > -1) { // Edit Goal
                    const newCollection = [...collection];
                    newCollection[existingIndex] = entry as Goal;
                    return { ...state, goals: newCollection };
                } else { // Add Goal
                    const newGoalWithId: Goal = {
                        ...(entry as Partial<Goal>),
                        id: `goal-${crypto.randomUUID()}`,
                        isCompleted: false,
                    } as Goal;
                    return { ...state, goals: [...collection, newGoalWithId] };
                }
            }

            if (entryType === 'event') {
                const collection = state.events;
                const existingIndex = collection.findIndex(item => item.id === entry.id);
                 if (existingIndex > -1) {
                    const newCollection = [...collection];
                    newCollection[existingIndex] = entry as PlannerEvent;
                    return { ...state, events: newCollection };
                } else {
                    return { ...state, events: [...collection, entry as PlannerEvent] };
                }
            }

            const collectionKey = entryType === 'activity' ? 'activities' : `${entryType}s` as keyof AppData;
            const collection = state[collectionKey] as Entry[];
            const existingIndex = collection.findIndex(item => item.id === entry.id);

            if (existingIndex > -1) { // Edit mode
                const newCollection = [...collection];
                newCollection[existingIndex] = entry;
                return { ...state, [collectionKey]: newCollection };
            } else { // Add mode
                return { ...state, [collectionKey]: [...collection, entry] };
            }
        }
        case 'DELETE_ENTRY': {
            const { id, entryType } = action.payload;

            if (entryType === 'goal') {
                return { ...state, goals: state.goals.filter(g => g.id !== id) };
            }

            if (entryType === 'event') {
                return { ...state, events: state.events.filter(e => e.id !== id) };
            }

            if (entryType === 'holiday') {
                const associatedTripIds = state.trips.filter(t => t.holidayId === id).map(t => t.id);
                return {
                    ...state,
                    holidays: state.holidays.filter(h => h.id !== id),
                    trips: state.trips.filter(t => t.holidayId !== id),
                    activities: state.activities.filter(a => !associatedTripIds.includes(a.tripId)),
                };
            }
            if (entryType === 'trip') {
                return {
                    ...state,
                    trips: state.trips.filter(t => t.id !== id),
                    activities: state.activities.filter(a => a.tripId !== id),
                };
            }
            if (entryType === 'activity') {
                return {
                    ...state,
                    activities: state.activities.filter(a => a.id !== id),
                };
            }
            return state;
        }
        case 'TOGGLE_GOAL_COMPLETION': {
            const { id, isCompleted } = action.payload;
            return {
                ...state,
                goals: state.goals.map(goal =>
                    goal.id === id
                        ? {
                            ...goal,
                            isCompleted,
                            completionDate: isCompleted ? new Date().toISOString().split('T')[0] : undefined,
                          }
                        : goal
                ),
            };
        }
        default:
            return state;
    }
}

const createPlannerInitialState = (): AppData => {
    try {
        return {
            holidays: JSON.parse(localStorage.getItem('holidays') || '[]'),
            trips: JSON.parse(localStorage.getItem('trips') || '[]'),
            activities: JSON.parse(localStorage.getItem('activities') || '[]'),
            events: JSON.parse(localStorage.getItem('events') || '[]'),
            goals: JSON.parse(localStorage.getItem('goals') || '[]'),
        };
    } catch (e) {
        console.error("Failed to parse planner data from localStorage", e);
        return { holidays: [], trips: [], activities: [], events: [], goals: [] };
    }
};

const createWishlistInitialState = (): WishlistData => {
    try {
        const data = JSON.parse(localStorage.getItem('wishlistData') || '{"lists": [], "items": []}');
        // Add a default "Gifts" list if it doesn't exist
        if (!data.lists.some((list: any) => list.name === 'Gifts')) {
            data.lists.push({ id: `wishlist-default-gifts`, name: 'Gifts' });
        }
        return data;
    } catch (e) {
        console.error("Failed to parse wishlist data from localStorage", e);
        return { lists: [{ id: `wishlist-default-gifts`, name: 'Gifts' }], items: [] };
    }
}

const createTodoInitialState = (): TodoData => {
    try {
        return JSON.parse(localStorage.getItem('todoData') || '{"projects": [], "tasks": []}');
    } catch (e) {
        console.error("Failed to parse todo data from localStorage", e);
        return { projects: [], tasks: [] };
    }
};

const createBudgetInitialState = (): BudgetEntry[] => {
    try {
        return JSON.parse(localStorage.getItem('budgetEntries') || '[]')
    } catch {
        return [];
    }
};

const createFinanceInitialState = (): FinanceData => {
    try {
        const stored = localStorage.getItem('financeData');
        if (stored) return JSON.parse(stored);
    } catch (e) { console.error("Failed to parse finance data from localStorage", e); }
    // Mock data if nothing is stored
    return {
        accounts: [
            { id: 'acc1', type: 'checking', provider: 'Main Bank', currency: 'USD', balance: 12540.32 },
            { id: 'acc2', type: 'savings', provider: 'High-Yield Savings', currency: 'USD', balance: 55000.00 },
            { id: 'acc3', type: 'credit-card', provider: 'Visa Rewards', currency: 'USD', balance: -1234.56 },
            { id: 'acc4', type: 'crypto-exchange', provider: 'Coinbase', currency: 'USD', balance: 500.00, riskTier: 'high' },
            { id: 'acc5', type: 'self-custody-wallet', provider: 'Ledger', currency: 'USD', balance: 0, riskTier: 'low' },
        ],
        holdings: [
            { id: 'h1', accountId: 'acc4', symbol: 'BTC', quantity: 0.1, averageCostBasis: 65000 },
            { id: 'h2', accountId: 'acc4', symbol: 'ETH', quantity: 1.5, averageCostBasis: 3500 },
            { id: 'h3', accountId: 'acc5', symbol: 'BTC', quantity: 1.0, averageCostBasis: 30000 },
        ],
        goals: [
            { id: 'g1', name: 'Emergency Fund', targetAmount: 30000, currentAmount: 25000, priority: 'high' },
            { id: 'g2', name: 'House Down Payment', targetAmount: 100000, currentAmount: 55000, priority: 'high', targetDate: '2026-12-31' },
            { id: 'g3', name: 'Dream Vacation to Japan', targetAmount: 8000, currentAmount: 1500, priority: 'medium', targetDate: '2025-09-01' },
        ],
        transactions: [],
    };
};


// --- ICONS ---
const IconAtlasLogo = () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="atlas-logo-svg">
      <path d="M18 3L3 18L18 33L33 18L18 3Z" stroke="url(#paint0_linear_logo)" strokeWidth="3" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="paint0_linear_logo" x1="18" y1="3" x2="18" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#BB86FC"/>
          <stop offset="1" stopColor="#8E44AD"/>
        </linearGradient>
      </defs>
    </svg>
  );
const IconHome = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/></svg>;
const IconPlanner = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Z"/></svg>;
const IconTodo = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>;
const IconBudget = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M453-240h60v-80h40q21 0 35.5-14.5T603-370v-220q0-21-14.5-35.5T553-640h-40v-80h-60v80h-40q-21 0-35.5 14.5T323-570v220q0 21 14.5 35.5T373-300h40v60Zm-40-140v-220h40v220h-40Zm100 0v-220h40v220h-40ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>;
const IconFinances = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M453-240h60v-80h40q21 0 35.5-14.5T603-370v-220q0-21-14.5-35.5T553-640h-40v-80h-60v80h-40q-21 0-35.5 14.5T323-570v220q0 21 14.5 35.5T373-300h40v60Zm-40-140v-220h40v220h-40Zm100 0v-220h40v220h-40ZM200-80v-800h560v800H200Zm80-80h400v-640H280v640Zm-80 80h560-560Z"/></svg>;
const IconWishlist = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="m480-120-58-52q-101-91-167-157T150-447q-54-62-87-124.5T30-692q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 69-33 131.5T705-447q-66 66-132 132t-167 157l-56 52Zm0-89q96-86 158-147.5T747-480q52-56 82.5-110.5T860-692q0-69-50.5-119.5T690-862q-47 0-88 23t-70 62h-44q-29-39-70-62T330-862q-69 0-119.5 50.5T160-692q0 56 30.5 110.5T273-480q62 61 124 122.5T480-209Zm0-271Z"/></svg>;
const IconSubCategory = () => <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M480-360 280-559h400L480-360Z"/></svg>;
const IconCollapseLeft = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Zm-240 0L80-480l240-240 56 56-184 184 184 184-56 56Z"/></svg>;
const IconCollapseRight = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M400-240 344-296l184-184-184-184 56-56 240 240-240 240Zm240 0L584-296l184-184-184-184 56-56 240 240-240 240Z"/></svg>;
const IconBack = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z"/></svg>;
const IconMenu = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>;
const IconGear = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="m382-120-42-90-93-24q-22-9-43.5-22t-40.5-28l-88 44-96-166 70-62q-2-14-3-28t-1-28q0-14 1-28t3-28l-70-62 96-166 88 44q19-15 40.5-28t43.5-22l93-24 42-90h196l42 90 93 24q22 9 43.5-22t40.5 28l88-44 96 166-70 62q2 14 3 28t1 28q0 14-1 28t-3 28l70 62-96 166-88-44q-19 15-40.5 28T612-234l-93 24-42 90H382Zm98-220q75 0 127.5-52.5T660-520q0-75-52.5-127.5T480-700q-75 0-127.5 52.5T300-520q0 75 52.5 127.5T480-340Z"/></svg>;
const IconDragHandle = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M360-160v-80h240v80H360Zm0-200v-80h240v80H360Zm0-200v-80h240v80H360Zm0-200v-80h240v80H360Z"/></svg>;
const IconReset = () => <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T744-804l-56 56q-37-34-81-54t-97-20q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h-106v-80h180v180h-80q-43 100-131 165T480-160Z"/></svg>;


// --- HOOKS ---
const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

    useEffect(() => {
        const media = window.matchMedia(query);
        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [query]);

    return matches;
};

// --- NAVIGATION CONFIG ---
const ICONS = {
    home: <IconHome />,
    planner: <IconPlanner />,
    todo: <IconTodo />,
    budget: <IconBudget />,
    finances: <IconFinances />,
    wishlist: <IconWishlist />,
    subCategory: <IconSubCategory />
};

const DEFAULT_NAV_CONFIG = [
  { id: 'home', label: 'Home', iconId: 'home' },
  { id: 'planner', label: 'Planner', iconId: 'planner', subItems: [
    { id: 'holidays', label: 'Holidays', iconId: 'subCategory' },
    { id: 'trips', label: 'Trips', iconId: 'subCategory' },
    { id: 'activities', label: 'Activities', iconId: 'subCategory' },
  ]},
  { id: 'todo', label: 'Todo', iconId: 'todo' },
  { id: 'budget', label: 'Budget', iconId: 'budget' },
  { id: 'finances', label: 'Finances', iconId: 'finances' },
  { id: 'wishlist', label: 'Wishlist', iconId: 'wishlist' },
];

const createNavSettingsInitialState = (): NavItemSetting[] => {
    try {
        const storedSettings = localStorage.getItem('navSettings');
        if (storedSettings) {
            const parsed = JSON.parse(storedSettings);
            // Basic validation
            if (Array.isArray(parsed) && parsed.every(item => 'id' in item && 'isVisible' in item)) {
                 // Sync with default config to add new items if they exist
                 const defaultIds = new Set(DEFAULT_NAV_CONFIG.map(i => i.id));
                 const storedIds = new Set(parsed.map(i => i.id));
                 const newItems = DEFAULT_NAV_CONFIG.filter(i => !storedIds.has(i.id)).map(i => ({id: i.id, isVisible: true}));
                 const syncedSettings = parsed.filter(i => defaultIds.has(i.id));

                return [...syncedSettings, ...newItems];
            }
        }
    } catch (e) {
        console.error("Failed to parse nav settings from localStorage", e);
    }
    // Default state if nothing in localStorage or if data is invalid
    return DEFAULT_NAV_CONFIG.map(item => ({ id: item.id, isVisible: true }));
};

// --- COMPONENTS ---
const NavSettingsModal = ({ currentSettings, onSave, onCancel, onResetToDefault }: {
    currentSettings: NavItemSetting[];
    onSave: (settings: NavItemSetting[]) => void;
    onCancel: () => void;
    onResetToDefault: () => void;
}) => {
  const [settings, setSettings] = useState(currentSettings);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleVisibilityChange = (id: string) => {
    setSettings(prev =>
      prev.map(item =>
        item.id === id ? { ...item, isVisible: !item.isVisible } : item
      )
    );
  };
  
  const handleReset = () => {
      const defaultSettings = DEFAULT_NAV_CONFIG.map(item => ({ id: item.id, isVisible: true }));
      setSettings(defaultSettings);
  }

  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newSettings = [...settings];
    const draggedItemContent = newSettings.splice(dragItem.current, 1)[0];
    newSettings.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(false);
    setSettings(newSettings);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content nav-settings-modal" onClick={e => e.stopPropagation()}>
        <h2>Customize Navigation</h2>
        <p>Check items to show them in the sidebar. Drag to reorder.</p>
        <ul className="nav-settings-list">
          {settings.map((item, index) => {
            const config = DEFAULT_NAV_CONFIG.find(c => c.id === item.id);
            if (!config) return null;
            return (
              <li
                key={item.id}
                draggable
                onDragStart={() => {
                    dragItem.current = index;
                    setDragging(true);
                }}
                onDragEnter={() => (dragOverItem.current = index)}
                onDragEnd={handleDragSort}
                onDragOver={(e) => e.preventDefault()}
                className={`nav-settings-item ${dragging && dragItem.current === index ? 'dragging' : ''}`}
              >
                <div className="drag-handle"><IconDragHandle /></div>
                <label className="nav-settings-label">
                  <input
                    type="checkbox"
                    checked={item.isVisible}
                    onChange={() => handleVisibilityChange(item.id)}
                  />
                  <span>{config.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="form-actions">
          <button type="button" onClick={handleReset} className="btn-secondary">
            <IconReset /> Reset
          </button>
          <div className="form-actions-main">
            <button type="button" onClick={onCancel} className="btn-cancel">Cancel</button>
            <button type="button" onClick={() => onSave(settings)} className="btn-save">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};


const Sidebar = ({ 
    isCollapsed, 
    onToggleCollapse, 
    onClose,
    activeNavId, 
    onNavigate,
    navItems,
    onOpenSettings,
}: {
    isCollapsed: boolean, 
    onToggleCollapse: () => void,
    onClose: () => void,
    activeNavId: string,
    onNavigate: (view: string) => void,
    navItems: NavItemSetting[],
    onOpenSettings: () => void,
}) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    const visibleNavConfigs = useMemo(() => {
        return navItems
            .filter(item => item.isVisible)
            .map(item => DEFAULT_NAV_CONFIG.find(config => config.id === item.id))
            .filter(Boolean); // Filter out any nulls if a config isn't found
    }, [navItems]);

    const activeParent = useMemo(() => {
        for (const item of visibleNavConfigs) {
            if (item!.subItems?.some(sub => sub.id === activeNavId)) {
                return item;
            }
        }
        return null;
    }, [visibleNavConfigs, activeNavId]);

    const handleItemClick = (item: typeof DEFAULT_NAV_CONFIG[0] | typeof DEFAULT_NAV_CONFIG[0]['subItems'][0]) => {
        const config = DEFAULT_NAV_CONFIG.find(c => c.id === item.id);
        if (config && config.subItems) {
            onNavigate(item.id); // Navigate to parent first to show sub-menu
        } else {
            onNavigate(item.id);
        }
    };

    const handleBackClick = () => {
        onNavigate(activeParent!.id);
    };

    const handleToggleButtonClick = isMobile ? onClose : onToggleCollapse;

    const itemsToRender = activeParent ? activeParent.subItems! : visibleNavConfigs;
    const headerTitle = activeParent ? activeParent.label : "Atlas";
    const isSubView = activeParent !== null;

    const getIcon = (iconId: string) => {
        return ICONS[iconId as keyof typeof ICONS] || null;
    }

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <div>
                <div className="sidebar-header">
                    <div className="sidebar-header-content">
                        {isSubView && !isCollapsed ? (
                            <>
                                <button type="button" onClick={handleBackClick} className="sidebar-btn back-btn" aria-label="Go Back">
                                    <IconBack />
                                </button>
                                <h1 className="sub-title">{headerTitle}</h1>
                            </>
                        ) : (
                            <>
                                <IconAtlasLogo />
                                {!isCollapsed && <h1>{headerTitle}</h1>}
                            </>
                        )}
                    </div>
                    <button type="button" onClick={handleToggleButtonClick} className="sidebar-btn collapse-btn" aria-label="Toggle Sidebar">
                        {isCollapsed && !isMobile ? <IconCollapseRight /> : <IconCollapseLeft />}
                    </button>
                </div>
                <nav className="sidebar-nav">
                    <ul>
                        {itemsToRender.map(item => {
                            if (!item) return null;
                            const config = DEFAULT_NAV_CONFIG.find(c => c.id === item.id);
                            const hasSubItems = config && !!config.subItems;

                            return (
                                <li 
                                key={item.id} 
                                onClick={() => handleItemClick(item)} 
                                className={activeNavId === item.id ? 'active' : ''}>
                                    <div className="nav-item-icon">{getIcon(item.iconId)}</div>
                                    {!isCollapsed && <span className="nav-item-label">{item.label}</span>}
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </div>
            <div className="sidebar-footer">
                <button type="button" onClick={onOpenSettings} className={`sidebar-btn settings-btn ${isCollapsed ? 'collapsed' : ''}`} aria-label="Open Settings">
                    <div className="nav-item-icon"><IconGear /></div>
                    {!isCollapsed && <span className="nav-item-label">Settings</span>}
                </button>
            </div>
        </aside>
    );
};


export const MiniCalendar = ({ holidays, trips, activities, events, goals, googleEvents, activeFilter }: { holidays: Holiday[], trips: Trip[], activities: Activity[], events: PlannerEvent[], goals: Goal[], googleEvents: GoogleEvent[], activeFilter: string }) => {
    const [viewDate, setViewDate] = useState(() => {
        const d = new Date();
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    });
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const handlePrev = () => {
        const monthsToMove = isExpanded ? -12 : -1;
        setViewDate(prev => addMonths(prev, monthsToMove));
    };

    const handleNext = () => {
        const monthsToMove = isExpanded ? 12 : 1;
        setViewDate(prev => addMonths(prev, monthsToMove));
    };

    const toggleExpandedView = () => {
        setIsExpanded(prev => !prev);
    };
    
    const handleDayClick = useCallback((date: Date) => {
        setSelectedDate(prev => {
            if (prev && prev.getTime() === date.getTime()) {
                return null;
            }
            return date;
        });
    }, []);

    const today = useMemo(() => {
        const d = new Date();
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }, []);

    const parseUTCDate = useCallback((dateStr: string) => new Date(dateStr + 'T00:00:00Z'), []);
    
    const getGoogleEventDate = (eventDate: GoogleEvent['start'] | GoogleEvent['end']): Date => {
      const dateStr = eventDate.dateTime || eventDate.date!;
      // For all-day events, the 'date' property doesn't have a time zone.
      // We parse it as UTC to keep everything consistent.
      return eventDate.date ? parseUTCDate(dateStr) : new Date(dateStr);
    };

    const getEventInfoForDate = useCallback((date: Date) => {
        const dateString = date.toISOString().split('T')[0];
        const backgroundInfos: { color: string | null, tooltip: string }[] = [];
        const dotInfos: { color: string | null, tooltip: string }[] = [];
        let seasonIcon: string | null = null;
        let isBirthday = false;
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth();
        const day = date.getUTCDate();

        // Start of seasons
        if (month === 2 && day === 1) { seasonIcon = '🌸'; dotInfos.push({ color: null, tooltip: 'Start of Spring' }); }
        if (month === 5 && day === 1) { seasonIcon = '☀️'; dotInfos.push({ color: null, tooltip: 'Start of Summer' }); }
        if (month === 8 && day === 1) { seasonIcon = '🍂'; dotInfos.push({ color: null, tooltip: 'Start of Autumn' }); }
        if (month === 11 && day === 1) { seasonIcon = '❄️'; dotInfos.push({ color: null, tooltip: 'Start of Winter' }); }

        // Completed goals (dots)
        goals
            .filter(g => g.isCompleted && g.completionDate === dateString)
            .forEach(g => {
                const category = initialGoalCategories.find(cat => cat.id === g.categoryId);
                dotInfos.push({ color: category?.color || '#888888', tooltip: `Goal: ${g.title}` });
            });
        
        // Google Calendar Events
        if (activeFilter === 'everything' || activeFilter === 'google') {
            googleEvents.forEach(gEvent => {
                const gStart = getGoogleEventDate(gEvent.start);
                const gEnd = getGoogleEventDate(gEvent.end);
                
                if (gEvent.start.date) { // All-day event
                    // Google's end date for all-day events is exclusive, so we subtract one day.
                    const inclusiveEnd = new Date(gEnd.getTime() - (1000 * 3600 * 24));
                    if (date >= gStart && date <= inclusiveEnd) {
                        backgroundInfos.push({ color: '#4285F4', tooltip: `Google: ${gEvent.summary}` });
                    }
                } else { // Timed event
                    // Check if the date is the same, ignoring time
                     if (gStart.toISOString().split('T')[0] === dateString) {
                         dotInfos.push({ color: '#4285F4', tooltip: `Google: ${gEvent.summary}` });
                     }
                }
            });
        }

        const categoryMap = {
            'school': 'school', 'birthdays': 'birthday', 'work': 'work',
            'appointments': 'appointment', 'events': 'event',
        };
        const mappedCategory = categoryMap[activeFilter as keyof typeof categoryMap];
        
        // Background events
        if (activeFilter === 'everything' || activeFilter === 'holidays') {
            holidays
                .filter(h => date >= parseUTCDate(h.startDate) && date <= parseUTCDate(h.endDate))
                .forEach(h => backgroundInfos.push({ color: h.color, tooltip: `Holiday: ${h.name}` }));
        }
        if (activeFilter === 'everything' || activeFilter === 'trips') {
            trips
                .filter(t => date >= parseUTCDate(t.startDate) && date <= parseUTCDate(t.endDate))
                .forEach(t => backgroundInfos.push({ color: t.color, tooltip: `Trip: ${t.name}` }));
        }
        if (activeFilter === 'everything' || mappedCategory) {
            events
                .filter(e => {
                    if (e.category === 'birthday') {
                        const birthDate = parseUTCDate(e.startDate);
                        const isBirthdayOnThisDay = birthDate.getUTCMonth() === month && birthDate.getUTCDate() === day;
                        if (isBirthdayOnThisDay) {
                           isBirthday = true;
                           backgroundInfos.push({ color: e.color, tooltip: `Birthday: ${e.name}` });
                        }
                        // Birthdays only show up on the specific day, not as a range
                        return false; 
                    }

                    const categoryMatch = !mappedCategory || e.category === mappedCategory;
                    const dateMatch = date >= parseUTCDate(e.startDate) && date <= parseUTCDate(e.endDate);
                    return categoryMatch && dateMatch;
                })
                .forEach(e => {
                    const categoryName = e.category.charAt(0).toUpperCase() + e.category.slice(1);
                    backgroundInfos.push({ color: e.color, tooltip: `${categoryName}: ${e.name}` });
                });
        }
        
        // Highlight weekends adjacent to holidays
        const allVacations = [ ...holidays, ...events.filter(e => e.category === 'school') ];
        const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (isWeekend) {
            const mondayAfter = new Date(date);
            mondayAfter.setUTCDate(date.getUTCDate() + (dayOfWeek === 6 ? 2 : 1));
            const mondayAfterStr = mondayAfter.toISOString().split('T')[0];
            const startingHoliday = allVacations.find(v => v.startDate === mondayAfterStr);
            if (startingHoliday) {
                backgroundInfos.push({ color: startingHoliday.color, tooltip: `Start of ${startingHoliday.name}` });
            }

            const fridayBefore = new Date(date);
            fridayBefore.setUTCDate(date.getUTCDate() - (dayOfWeek === 6 ? 1 : 2));
            const fridayBeforeStr = fridayBefore.toISOString().split('T')[0];
            const endingHoliday = allVacations.find(v => v.endDate === fridayBeforeStr);
            if (endingHoliday) {
                backgroundInfos.push({ color: endingHoliday.color, tooltip: `End of ${endingHoliday.name}` });
            }
        }


        // Dot events
        if (activeFilter === 'everything' || activeFilter === 'activities') {
            activities
                .filter(a => a.date === dateString)
                .forEach(a => {
                    const tripColor = trips.find(t => t.id === a.tripId)?.color || '#888888';
                    dotInfos.push({ color: tripColor, tooltip: `Activity: ${a.name}` });
                });
        }
        
        const backgroundColors = backgroundInfos.map(i => i.color).filter((c): c is string => c !== null);
        const dotColors = dotInfos.map(i => i.color).filter((c): c is string => c !== null);
        const tooltipText = [...backgroundInfos, ...dotInfos].map(i => i.tooltip).filter(Boolean).join('\n');

        return { backgroundColors, dotColors, tooltip: tooltipText, icon: seasonIcon, isBirthday };
    }, [holidays, trips, activities, events, goals, googleEvents, activeFilter, parseUTCDate]);

    
    const getDetailedEventsForDate = useCallback((date: Date) => {
        if (!date) return [];
        const dateString = date.toISOString().split('T')[0];
        const detailedEvents: { type: string, name: string, color: string }[] = [];
        const month = date.getUTCMonth();
        const day = date.getUTCDate();

        // Google Calendar Events
        googleEvents.forEach(gEvent => {
            const gStart = getGoogleEventDate(gEvent.start);
            const gEnd = getGoogleEventDate(gEvent.end);
            
            if (gEvent.start.date) { // All-day event
                const inclusiveEnd = new Date(gEnd.getTime() - (1000 * 3600 * 24));
                if (date >= gStart && date <= inclusiveEnd) {
                    detailedEvents.push({ type: 'Google Calendar', name: gEvent.summary, color: '#4285F4' });
                }
            } else { // Timed event
                 if (gStart.toISOString().split('T')[0] === dateString) {
                     detailedEvents.push({ type: 'Google Calendar', name: gEvent.summary, color: '#4285F4' });
                 }
            }
        });

        // Completed goals
        goals
            .filter(g => g.isCompleted && g.completionDate === dateString)
            .forEach(g => {
                const category = initialGoalCategories.find(cat => cat.id === g.categoryId);
                detailedEvents.push({ type: 'Goal Completed', name: g.title, color: category?.color || '#888888' });
            });

        // Holidays
        holidays
            .filter(h => date >= parseUTCDate(h.startDate) && date <= parseUTCDate(h.endDate))
            .forEach(h => detailedEvents.push({ type: 'Holiday', name: h.name, color: h.color }));
        
        // Trips
        trips
            .filter(t => date >= parseUTCDate(t.startDate) && date <= parseUTCDate(t.endDate))
            .forEach(t => detailedEvents.push({ type: 'Trip', name: t.name, color: t.color }));

        // Activities
        activities
            .filter(a => a.date === dateString)
            .forEach(a => {
                const tripColor = trips.find(t => t.id === a.tripId)?.color || '#888888';
                detailedEvents.push({ type: 'Activity', name: a.name, color: tripColor });
            });

        // Other Planner Events
        events
            .filter(e => {
                if (e.category === 'birthday') {
                    const birthDate = parseUTCDate(e.startDate);
                    return birthDate.getUTCMonth() === month && birthDate.getUTCDate() === day;
                }
                return date >= parseUTCDate(e.startDate) && date <= parseUTCDate(e.endDate);
            })
            .forEach(e => {
                const categoryName = e.category.charAt(0).toUpperCase() + e.category.slice(1);
                detailedEvents.push({ type: categoryName, name: e.name, color: e.color });
            });
            
        // Check for adjacent weekends to holidays
        const allVacations = [ ...holidays, ...events.filter(e => e.category === 'school') ];
        const dayOfWeek = date.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (isWeekend) {
            const mondayAfter = new Date(date);
            mondayAfter.setUTCDate(date.getUTCDate() + (dayOfWeek === 6 ? 2 : 1));
            const mondayAfterStr = mondayAfter.toISOString().split('T')[0];
            const startingHoliday = allVacations.find(v => v.startDate === mondayAfterStr);
            if (startingHoliday) {
                detailedEvents.push({ type: 'Holiday Weekend', name: `Leads into ${startingHoliday.name}`, color: startingHoliday.color });
            }

            const fridayBefore = new Date(date);
            fridayBefore.setUTCDate(date.getUTCDate() - (dayOfWeek === 6 ? 1 : 2));
            const fridayBeforeStr = fridayBefore.toISOString().split('T')[0];
            const endingHoliday = allVacations.find(v => v.endDate === fridayBeforeStr);
            if (endingHoliday) {
                detailedEvents.push({ type: 'Holiday Weekend', name: `Follows ${endingHoliday.name}`, color: endingHoliday.color });
            }
        }

        // Season starts
        if (month === 2 && day === 1) detailedEvents.push({ type: 'Season', name: 'Start of Spring', color: '#ffc0cb' });
        if (month === 5 && day === 1) detailedEvents.push({ type: 'Season', name: 'Start of Summer', color: '#f1c40f' });
        if (month === 8 && day === 1) detailedEvents.push({ type: 'Season', name: 'Start of Autumn', color: '#e67e22' });
        if (month === 11 && day === 1) detailedEvents.push({ type: 'Season', name: 'Start of Winter', color: '#3498db' });
        
        return detailedEvents;
    }, [holidays, trips, activities, events, goals, googleEvents, parseUTCDate]);


    const renderMonth = (dateToRender: Date) => {
        const year = dateToRender.getUTCFullYear();
        const month = dateToRender.getUTCMonth();

        const firstDay = new Date(Date.UTC(year, month, 1));
        const lastDay = new Date(Date.UTC(year, month + 1, 0));
        const daysInMonth = lastDay.getUTCDate();
        const startDayOfWeek = firstDay.getUTCDay();

        const days = [];
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(<div key={`empty-start-${i}`} className="day-cell empty"></div>);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const currentDate = new Date(Date.UTC(year, month, i));
            const dayOfWeek = currentDate.getUTCDay(); // 0 is Sunday, 6 is Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isToday = currentDate.getTime() === today.getTime();
            const { backgroundColors, dotColors, tooltip, icon, isBirthday } = getEventInfoForDate(currentDate);
            
            const isSelected = selectedDate ? selectedDate.getTime() === currentDate.getTime() : false;

            const backgroundStyle = backgroundColors.length > 0
                ? { backgroundImage: `linear-gradient(to bottom right, ${backgroundColors.map(c => hexToRgba(c, 0.4)).join(', ')})` }
                : {};


            days.push(
                <div 
                    key={i} 
                    className={`day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isWeekend ? 'weekend-day' : ''} ${isBirthday ? 'birthday-date' : ''}`}
                    title={tooltip} 
                    onClick={() => handleDayClick(currentDate)}
                    style={backgroundStyle}
                >
                    <span className="day-number">{i}</span>
                    {isBirthday && <span className="birthday-icon">🎉</span>}
                    {icon && !isBirthday && <span className="season-icon">{icon}</span>}
                    {dotColors.length > 0 && (
                        <div className="event-dots">
                            {dotColors.slice(0, 4).map((c, idx) => (
                                <div key={idx} className="event-dot" style={{ backgroundColor: c }}></div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="month">
                <h4 className="month-header">{dateToRender.toLocaleString(undefined, { month: 'long', year: isExpanded ? 'numeric' : '2-digit', timeZone: 'UTC' })}</h4>
                <div className="calendar-grid">
                    {'SUN,MON,TUE,WED,THU,FRI,SAT'.split(',').map(day => <div key={day} className="day-name">{day.slice(0,1)}</div>)}
                    {days}
                </div>
            </div>
        );
    };

    const monthsToDisplay = useMemo(() => {
        if (isExpanded) return [];
        return [viewDate, addMonths(viewDate, 1), addMonths(viewDate, 2)];
    }, [isExpanded, viewDate]);
    
    const detailedEvents = useMemo(() => {
        if (!selectedDate) return [];
        return getDetailedEventsForDate(selectedDate);
    }, [selectedDate, getDetailedEventsForDate]);

    return (
        <section className="mini-calendar">
            <div className="calendar-header">
                <h3>Mini Calendar</h3>
                <div className="calendar-controls-group">
                    <button
                      type="button"
                      className="toggle-view-btn"
                      onClick={toggleExpandedView}
                    >
                      {isExpanded ? (
                        <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16"><path d="M480-120v-360L120-840v360l360 360Zm0 80L80-400v-440l400 360 400-360v440L480-40Z"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16"><path d="M120-120v-360l360-360 360 360v360L480-480 120-120Zm80-80h560L480-560 200-200Zm280-280Z"/></svg>
                      )}
                      <span>{isExpanded ? 'Show 3 Months' : 'Show Full Year'}</span>
                    </button>
                    <div className="calendar-nav-controls">
                        <button type="button" onClick={handlePrev} aria-label="Previous Period">&lt;</button>
                        <button type="button" onClick={handleNext} aria-label="Next Period">&gt;</button>
                    </div>
                </div>
            </div>
            <div className={`months-container ${isExpanded ? 'expanded' : ''}`}>
                 {isExpanded ? (
                    <div className="year-view-container">
                        <div className="year-group">
                            <h4 className="year-header">{viewDate.getUTCFullYear()}</h4>
                            <div className="year-grid">
                                {Array.from({ length: 12 }, (_, i) => renderMonth(new Date(Date.UTC(viewDate.getUTCFullYear(), i, 1))))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="three-month-grid">
                        {monthsToDisplay.map((date, i) => <div key={i}>{renderMonth(date)}</div>)}
                    </div>
                )}
            </div>
            {selectedDate && (
                <div className="date-details-panel">
                    <h4>Details for {selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</h4>
                    {detailedEvents.length > 0 ? (
                        <ul className="date-details-list">
                            {detailedEvents.map((event, index) => (
                                <li key={index} className="date-detail-item">
                                    <span className="event-color-dot" style={{ backgroundColor: event.color }}></span>
                                    <span className="event-type">{event.type}:</span>
                                    <span className="event-name">{event.name}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="no-items-text">No events for this day.</p>
                    )}
                </div>
            )}
        </section>
    );
};

export const Countdown = ({ startDate, endDate }: { startDate: string, endDate: string }) => {
    const today = useMemo(() => {
        const d = new Date();
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }, []);

    const start = useMemo(() => new Date(`${startDate}T00:00:00Z`), [startDate]);
    const end = useMemo(() => new Date(`${endDate}T00:00:00Z`), [endDate]);

    let text: string | number;
    let label: string;

    if (today < start) {
        const daysUntil = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        text = daysUntil > 0 ? daysUntil : '🎉';
        label = daysUntil > 0 ? `day${daysUntil !== 1 ? 's' : ''} to go` : "It's happening!";
    } else if (today >= start && today <= end) {
        const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const dayOf = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        text = `${dayOf} / ${duration}`;
        label = 'days';
    } else {
        const daysAgo = Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
        text = `✅`;
        label = `Ended ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`;
    }

    return (
        <div className="countdown">
            <span className="time-left">{text}</span>
            <span className="label">{label}</span>
        </div>
    );
};

export const EntryFormModal = ({ modalState, onSave, onCancel }: { modalState: ModalState, onSave: HandleSave, onCancel: () => void }) => {
  const { mode, type, data, parentId } = modalState;

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [date, setDate] = useState('');
  const [color, setColor] = useState('#bb86fc');
  const [category, setCategory] = useState<EventCategory>('event');
  // Birthday specific state
  const [giftIdeas, setGiftIdeas] = useState('');
  const [giftPrice, setGiftPrice] = useState('');
  const [description, setDescription] = useState('');


  useEffect(() => {
    const eventData = data as PlannerEvent;
    const holidayData = data as Holiday;
    if (mode === 'edit' && data) {
      if ('name' in data) setName(data.name);
      if ('title' in data && typeof data.title === 'string') setName(data.title);
      if ('startDate' in data) setStartDate(data.startDate);
      if ('endDate' in data) setEndDate(data.endDate);
      if ('date' in data) setDate(data.date);
      if ('color' in data && data.color) setColor(data.color);
      if (type === 'holiday' && holidayData.description) {
          setDescription(holidayData.description);
      }
      if (type === 'event' && 'category' in data) {
          setCategory(data.category);
          if(data.category === 'birthday') {
              setGiftIdeas(eventData.giftIdeas || '');
              setGiftPrice(eventData.giftPrice?.toString() || '');
          }
      }
    } else {
        // Reset for 'add' mode
        setName('');
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
        setDate(today);
        setColor('#bb86fc');
        setCategory('event');
        setGiftIdeas('');
        setGiftPrice('');
        setDescription('');
    }
  }, [modalState]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'goal') return; // Goals are handled separately

    if (type === 'activity') {
        if (!name || !date) { alert('Please fill all fields.'); return; }
        const tripId = mode === 'edit' ? (data as Activity).tripId : parentId!;
        onSave({ tripId, name, date }, 'activity', data?.id);
    } else {
        if (!name || !startDate) { alert('Please fill all fields.'); return; }
        
        if (type === 'event' && category === 'birthday') {
            onSave({ 
                name, 
                startDate, 
                endDate: startDate, 
                color, 
                category, 
                giftIdeas: giftIdeas || undefined,
                giftPrice: giftPrice ? parseFloat(giftPrice) : undefined,
            }, 'event', data?.id);
            return;
        }

        if (!endDate) { alert('Please fill all fields.'); return; }
        if (new Date(startDate) > new Date(endDate)) { alert('Start date cannot be after end date.'); return; }
        
        if (type === 'holiday') {
            onSave({ name, startDate, endDate, color, description: description || undefined }, 'holiday', data?.id);
        } else if (type === 'trip') {
            const holidayId = mode === 'edit' ? (data as Trip).holidayId : parentId!;
            onSave({ holidayId, name, startDate, endDate, color }, 'trip', data?.id);
        } else if (type === 'event') {
            onSave({ name, startDate, endDate, color, category }, 'event', data?.id);
        }
    }
  };
  
  const title = `${mode === 'edit' ? 'Edit' : 'Add'} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  const isBirthdayEvent = type === 'event' && category === 'birthday';

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">{isBirthdayEvent ? 'Person\'s Name' : `${type.charAt(0).toUpperCase() + type.slice(1)} Name`}</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {type === 'activity' && (
              <div className="form-group">
                <label htmlFor="date">Date</label>
                <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
          )}

          {type !== 'activity' && (
              <>
                {type === 'event' && (
                    <div className="form-group">
                        <label htmlFor="category">Category</label>
                        <select id="category" value={category} onChange={e => setCategory(e.target.value as EventCategory)} required>
                            <option value="school">School</option>
                            <option value="birthday">Birthday</option>
                            <option value="work">Work/Project</option>
                            <option value="appointment">Appointment</option>
                            <option value="event">General Event</option>
                        </select>
                    </div>
                )}

                {isBirthdayEvent ? (
                    <>
                        <div className="form-group">
                            <label htmlFor="birthdayDate">Date of Birth</label>
                            <input id="birthdayDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="giftIdeas">Gift Ideas (Optional)</label>
                            <textarea id="giftIdeas" value={giftIdeas} onChange={e => setGiftIdeas(e.target.value)} rows={3}></textarea>
                        </div>
                        <div className="form-group">
                            <label htmlFor="giftPrice">Gift Price (Optional)</label>
                            <input id="giftPrice" type="number" value={giftPrice} onChange={e => setGiftPrice(e.target.value)} step="0.01" min="0" placeholder="0.00" />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="form-group">
                            <label htmlFor="startDate">Start Date</label>
                            <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="endDate">End Date</label>
                            <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                        </div>
                    </>
                )}
                 
                <div className="form-group">
                    <label htmlFor="color">Color</label>
                    <input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="color-picker" />
                </div>
                {type === 'holiday' && (
                    <div className="form-group">
                        <label htmlFor="description">Description (Optional)</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="e.g., A relaxing beach vacation with some hiking. This will help the AI guide."></textarea>
                    </div>
                )}
              </>
          )}

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-cancel">Cancel</button>
            <button type="submit" className="btn-save">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};


const PlaceholderView = ({ title }: { title: string }) => (
    <div className="placeholder-view">
        <h1>{title}</h1>
        <p>This feature is coming soon!</p>
    </div>
);

const App = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNavId, setActiveNavId] = useState('home');
  
  const [plannerData, dispatchPlanner] = useReducer(appReducer, undefined, createPlannerInitialState);
  const [wishlistData, setWishlistData] = useState<WishlistData>(createWishlistInitialState);
  const [todoData, setTodoData] = useState<TodoData>(createTodoInitialState);
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>(createBudgetInitialState);
  const [financeData, setFinanceData] = useState<FinanceData>(createFinanceInitialState);
  const [navSettings, setNavSettings] = useState<NavItemSetting[]>(createNavSettingsInitialState);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // State for Google Calendar Integration
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [isGoogleApiReady, setIsGoogleApiReady] = useState(false);
  const [isGoogleConfigured, setIsGoogleConfigured] = useState(true);

  // State for Vacation Guide View
  const [guideHoliday, setGuideHoliday] = useState<Holiday | null>(null);

  useEffect(() => {
    localStorage.setItem('holidays', JSON.stringify([...plannerData.holidays].sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())));
    localStorage.setItem('trips', JSON.stringify(plannerData.trips));
    localStorage.setItem('activities', JSON.stringify(plannerData.activities));
    localStorage.setItem('events', JSON.stringify(plannerData.events));
    localStorage.setItem('goals', JSON.stringify(plannerData.goals));
  }, [plannerData]);

  useEffect(() => {
    localStorage.setItem('wishlistData', JSON.stringify(wishlistData));
  }, [wishlistData]);
  
  useEffect(() => {
    localStorage.setItem('todoData', JSON.stringify(todoData));
  }, [todoData]);

  useEffect(() => {
    localStorage.setItem('budgetEntries', JSON.stringify(budgetEntries));
  }, [budgetEntries]);
  
  useEffect(() => {
    localStorage.setItem('financeData', JSON.stringify(financeData));
  }, [financeData]);

  useEffect(() => {
    localStorage.setItem('navSettings', JSON.stringify(navSettings));
  }, [navSettings]);
  
  useEffect(() => {
    const configured = initGoogleClient({
        updateSigninStatus: setIsGoogleSignedIn,
        updateEvents: setGoogleEvents,
        updateUser: setGoogleUser,
        onReady: () => setIsGoogleApiReady(true),
    });
    if (!configured) {
        setIsGoogleConfigured(false);
    }
  }, []);


  const handleSaveSettings = (newSettings: NavItemSetting[]) => {
    setNavSettings(newSettings);
    setIsSettingsModalOpen(false);
  };
  
  const handleResetSettings = () => {
      const defaultSettings = DEFAULT_NAV_CONFIG.map(item => ({ id: item.id, isVisible: true }));
      setNavSettings(defaultSettings);
      setIsSettingsModalOpen(false);
  };

  const handleViewGuide = (holiday: Holiday) => {
    setGuideHoliday(holiday);
    setActiveNavId('planner'); // Ensure the sidebar shows the correct section
  };

  const handleCloseGuide = () => {
    setGuideHoliday(null);
  };

  // This is the key change: a single variable to represent the visual state on desktop
  const isEffectivelyCollapsed = !isMobile && isSidebarCollapsed;

  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  const handleNavigate = useCallback((navId: string) => {
      const targetNav = DEFAULT_NAV_CONFIG.find(item => item.id === navId);
      const isParent = targetNav && !!targetNav.subItems;

      if (isParent) {
           const currentActiveParent = DEFAULT_NAV_CONFIG.find(item => item.subItems?.some(sub => sub.id === activeNavId));
           // If we click the same parent again, or a different parent, we should handle sub-menu logic.
           // For now, we just set the active ID, and the sidebar will figure out if it's a parent.
           setActiveNavId(navId);
      } else {
           setActiveNavId(navId);
      }
      
      if (isMobile) {
          closeSidebar();
      }
  }, [isMobile, closeSidebar, activeNavId]);

  const toggleDesktopSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const activeView = useMemo(() => {
      if (activeNavId === 'home') return 'home';
      const plannerConfig = DEFAULT_NAV_CONFIG.find(i => i.id === 'planner');
      const plannerSubItems = plannerConfig?.subItems?.map(s => s.id) || [];
      if (plannerSubItems.includes(activeNavId) || activeNavId === 'planner') {
          return 'planner';
      }
      if (activeNavId === 'finances') return 'finances';
      return activeNavId;
  }, [activeNavId]);

  const renderView = () => {
      if (guideHoliday) {
        return <VacationGuideView holiday={guideHoliday} onBack={handleCloseGuide} />;
      }

      switch(activeView) {
          case 'home':
              return <HomeView 
                plannerData={plannerData}
                todoData={todoData}
                budgetEntries={budgetEntries}
                onNavigate={handleNavigate}
              />;
          case 'planner':
              return <PlannerView 
                  plannerData={plannerData} 
                  dispatch={dispatchPlanner} 
                  wishlistData={wishlistData} 
                  setWishlistData={setWishlistData}
                  isGoogleSignedIn={isGoogleSignedIn}
                  googleUser={googleUser}
                  googleEvents={googleEvents}
                  onGoogleSignIn={handleSignIn}
                  onGoogleSignOut={handleSignOut}
                  isGoogleApiReady={isGoogleApiReady}
                  isGoogleConfigured={isGoogleConfigured}
                  onViewGuide={handleViewGuide}
                />;
          case 'todo':
              return <TodoView todoData={todoData} setTodoData={setTodoData} plannerData={plannerData} googleEvents={googleEvents} />;
          case 'budget':
              return <BudgetView plannerData={plannerData} wishlistData={wishlistData} budgetEntries={budgetEntries} setBudgetEntries={setBudgetEntries} />;
          case 'finances':
              return <FinancesView financeData={financeData} setFinanceData={setFinanceData} budgetEntries={budgetEntries} />;
          case 'wishlist':
              return <WishlistView wishlistData={wishlistData} setWishlistData={setWishlistData} budgetEntries={budgetEntries} setBudgetEntries={setBudgetEntries} />;
          default:
              const navItem = DEFAULT_NAV_CONFIG.find(item => item.id === activeView);
              return <PlaceholderView title={navItem ? navItem.label : 'Not Found'} />;
      }
  };

  return (
    <div className={`app-container ${isEffectivelyCollapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'mobile-layout' : ''} ${isMobile && isSidebarOpen ? 'mobile-sidebar-open' : ''}`}>
      {isMobile && isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

      <Sidebar 
          isCollapsed={isEffectivelyCollapsed} 
          onToggleCollapse={toggleDesktopSidebar} 
          onClose={closeSidebar}
          activeNavId={activeNavId}
          onNavigate={handleNavigate}
          navItems={navSettings}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
      />
      <div className="main-content">
        {isMobile && !guideHoliday && (
            <button className="hamburger-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
                <IconMenu />
            </button>
        )}
        {renderView()}
      </div>
       {isSettingsModalOpen && (
        <NavSettingsModal 
            currentSettings={navSettings}
            onSave={handleSaveSettings}
            onCancel={() => setIsSettingsModalOpen(false)}
            onResetToDefault={handleResetSettings}
        />
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
