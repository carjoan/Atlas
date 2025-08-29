/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { BudgetCategory, Wishlist, WishlistItem, WishlistData, BudgetEntry } from './types';
import { initialCategories } from './types';

interface WishlistModalState {
    mode: 'addList' | 'addItem' | 'editItem' | 'completeItem';
    listId?: string; // for adding items
    item?: WishlistItem;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// --- ICON ---
const IconWishlistPlaceholder = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="48" viewBox="0 -960 960 960" width="48"><path d="m480-120-58-52q-101-91-167-157T150-447q-54-62-87-124.5T30-692q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 69-33 131.5T705-447q-66 66-132 132t-167 157l-56 52Zm0-89q96-86 158-147.5T747-480q52-56 82.5-110.5T860-692q0-69-50.5-119.5T690-862q-47 0-88 23t-70 62h-44q-29-39-70-62T330-862q-69 0-119.5 50.5T160-692q0 56 30.5 110.5T273-480q62 61 124 122.5T480-209Zm0-271Z"/></svg>
);
const IconCompleted = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>;
const IconChevronDown = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
        <path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z"/>
    </svg>
);


// --- MODAL COMPONENTS ---
const WishlistFormModal = ({ modalState, onSave, onCancel }: {
    modalState: WishlistModalState,
    onCancel: () => void,
    onSave: (data: any) => void,
}) => {
    const [name, setName] = useState('');
    const [priority, setPriority] = useState<WishlistItem['priority']>('medium');
    const [estimatedCost, setEstimatedCost] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [finalCost, setFinalCost] = useState('');
    const [categoryId, setCategoryId] = useState<BudgetCategory['id']>('leisure');
    const [description, setDescription] = useState('');

    React.useEffect(() => {
        if (modalState.mode === 'editItem' && modalState.item) {
            setName(modalState.item.name);
            setPriority(modalState.item.priority);
            setCategoryId(modalState.item.categoryId);
            setEstimatedCost(String(modalState.item.estimatedCost || ''));
            setImageUrl(modalState.item.imageUrl || '');
            setDescription(modalState.item.description || '');
        } else if (modalState.mode === 'completeItem' && modalState.item) {
            setFinalCost(String(modalState.item.estimatedCost || ''));
        } else if (modalState.mode === 'addList') {
            setName('');
        }
        else {
            setName('');
            setPriority('medium');
            setEstimatedCost('');
            setImageUrl('');
            setFinalCost('');
            setCategoryId('leisure');
            setDescription('');
        }
    }, [modalState]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (modalState.mode === 'addList') {
            onSave({ name });
            return;
        }
        onSave({ name, priority, estimatedCost, imageUrl, finalCost, categoryId, description });
    };

    const titleMap = {
        addList: 'Create New Wishlist',
        addItem: 'Add New Wish',
        editItem: 'Edit Wish',
        completeItem: 'Complete Wish'
    }

    if (modalState.mode === 'addList') {
        return (
            <div className="modal-overlay" onClick={onCancel}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <h2>{titleMap[modalState.mode]}</h2>
                    <form onSubmit={handleSubmit}>
                         <div className="form-group">
                            <label htmlFor="listName">Wishlist Name</label>
                            <input id="listName" type="text" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div className="form-actions">
                            <button type="button" onClick={onCancel} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save">Create</button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    if (modalState.mode === 'completeItem') {
         return (
            <div className="modal-overlay" onClick={onCancel}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <h2>{titleMap[modalState.mode]}</h2>
                    <p>Enter the final cost for <strong>{modalState.item?.name}</strong>.</p>
                    <form onSubmit={handleSubmit}>
                         <div className="form-group">
                            <label htmlFor="finalCost">Final Cost</label>
                            <input id="finalCost" type="number" value={finalCost} onChange={e => setFinalCost(e.target.value)} required step="0.01" min="0" />
                        </div>
                        <div className="form-actions">
                            <button type="button" onClick={onCancel} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save">Complete</button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    return (
         <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{titleMap[modalState.mode]}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="wishName">Wish Name</label>
                        <input id="wishName" type="text" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                     <div className="form-group">
                        <label htmlFor="wishPriority">Priority</label>
                        <select id="wishPriority" value={priority} onChange={e => setPriority(e.target.value as any)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="wishCategory">Category</label>
                        <select id="wishCategory" value={categoryId} onChange={e => setCategoryId(e.target.value as any)} required>
                            {initialCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                     <div className="form-group">
                        <label htmlFor="wishCost">Estimated Cost (Optional)</label>
                        <input id="wishCost" type="number" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} step="0.01" min="0" />
                    </div>
                     <div className="form-group">
                        <label htmlFor="wishImage">Image URL (Optional)</label>
                        <input id="wishImage" type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
                    </div>
                     <div className="form-group">
                        <label htmlFor="wishDescription">Description (Optional)</label>
                        <textarea id="wishDescription" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="e.g., Specific things to see, what this item is for..."></textarea>
                    </div>
                     <div className="form-actions">
                        <button type="button" onClick={onCancel} className="btn-cancel">Cancel</button>
                        <button type="submit" className="btn-save">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const WishlistItemCard = ({ item, category, budgetInfo, onEdit, onComplete, onDelete, onToggleHold }: {
    item: WishlistItem,
    category?: BudgetCategory,
    budgetInfo?: {
        categoryMonthlyRemaining: number;
        categoryYearlyRemaining: number;
        totalMonthlyRemaining: number;
    },
    onEdit: () => void,
    onComplete: () => void,
    onDelete: () => void,
    onToggleHold: () => void
}) => {
    const affordabilityStatus = useMemo(() => {
        if (!item.estimatedCost || !budgetInfo) {
            return null;
        }
        const { categoryMonthlyRemaining, totalMonthlyRemaining } = budgetInfo;
        const canAffordCategory = categoryMonthlyRemaining >= item.estimatedCost;
        const canAffordMonth = totalMonthlyRemaining >= item.estimatedCost;

        if (canAffordCategory && canAffordMonth) {
            return {
                className: 'affordable',
                statusText: '✅ In Budget',
            };
        } else if (canAffordCategory && !canAffordMonth) {
            return {
                className: 'unaffordable',
                statusText: '⚠️ Over Month Budget',
            };
        } else { // !canAffordCategory
            return {
                className: 'unaffordable',
                statusText: '❌ Over Cat. Budget',
            };
        }
    }, [item.estimatedCost, budgetInfo]);

    return (
        <div className={`wishlist-item-card ${item.status === 'on-hold' ? 'on-hold' : ''}`}>
            <div className="wishlist-item-image" style={{ backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : 'none' }}>
                {!item.imageUrl && <IconWishlistPlaceholder />}
            </div>
            <div className="wishlist-item-content">
                <div className="wishlist-item-header">
                    <h4>{item.name}</h4>
                    <span className={`priority-badge ${item.priority}`}>{item.priority}</span>
                </div>
                <div className="wishlist-item-details">
                    {item.estimatedCost ? (
                        <span className="cost">Est: {formatCurrency(item.estimatedCost)}</span>
                    ) : (
                        <span className="cost">No cost</span>
                    )}
                    {category && <span className="item-category-badge" style={{backgroundColor: category.color}}>{category.name}</span>}
                </div>

                {affordabilityStatus && (item.status === 'active' || item.status === 'on-hold') && (
                     <div className={`item-budget-info ${affordabilityStatus.className}`}>
                        <div className="item-budget-details">
                            <p>Month Left: {formatCurrency(budgetInfo.categoryMonthlyRemaining)}</p>
                            <p>Year Left: {formatCurrency(budgetInfo.categoryYearlyRemaining)}</p>
                        </div>
                        <span className="affordability-text">{affordabilityStatus.statusText}</span>
                    </div>
                )}
                
                {item.status === 'active' ? (
                    <div className="wishlist-item-actions">
                        <div className="list-actions">
                            <button onClick={onEdit} className="action-btn-sm">Edit</button>
                            <button onClick={onToggleHold} className="action-btn-sm">Hold</button>
                            <button onClick={onDelete} className="action-btn-sm">Del</button>
                        </div>
                        <button onClick={onComplete} className="btn-complete">Complete</button>
                    </div>
                ) : item.status === 'on-hold' ? (
                    <div className="wishlist-item-actions">
                        <div className="list-actions">
                            <button onClick={onEdit} className="action-btn-sm">Edit</button>
                            <button onClick={onDelete} className="action-btn-sm">Del</button>
                        </div>
                        <button onClick={onToggleHold} className="btn-complete" style={{backgroundColor: 'var(--planned-color)'}}>Resume</button>
                    </div>
                ) : item.status === 'completed' ? (
                    <div className="completed-item-overlay">
                        <IconCompleted />
                        <span>Completed!</span>
                         {item.finalCost && <small>Final Cost: {formatCurrency(item.finalCost)}</small>}
                    </div>
                ) : null }
            </div>
        </div>
    );
};

export const WishlistView = ({ wishlistData, setWishlistData, budgetEntries, setBudgetEntries }: {
    wishlistData: WishlistData,
    setWishlistData: React.Dispatch<React.SetStateAction<WishlistData>>,
    budgetEntries: BudgetEntry[],
    setBudgetEntries: React.Dispatch<React.SetStateAction<BudgetEntry[]>>
}) => {
    const [modalState, setModalState] = useState<WishlistModalState | null>(null);
    const [filter, setFilter] = useState<'active' | 'completed'>('active');
    const [sort, setSort] = useState<'priority' | 'cost'>('priority');
    const [collapsedLists, setCollapsedLists] = useState<Record<string, boolean>>(() => {
        try {
            const stored = sessionStorage.getItem('collapsedWishlists');
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    });

    useEffect(() => {
        sessionStorage.setItem('collapsedWishlists', JSON.stringify(collapsedLists));
    }, [collapsedLists]);

    const handleToggleCollapse = useCallback((listId: string) => {
        setCollapsedLists(prev => ({
            ...prev,
            [listId]: !prev[listId]
        }));
    }, []);

    const budgetOverview = useMemo(() => {
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentMonth = now.getUTCMonth();

        const totalMonthlyBudget = initialCategories.reduce((sum, cat) => sum + cat.budget, 0);
        const totalYearlyBudget = totalMonthlyBudget * 12;

        let totalYearlySpent = 0;
        let totalMonthlySpent = 0;
        
        budgetEntries.forEach(entry => {
            const entryDate = new Date(`${entry.date}T00:00:00Z`);
            const entryYear = entryDate.getUTCFullYear();
            const entryMonth = entryDate.getUTCMonth();

            if (entry.isRecurring) {
                if (entryYear < currentYear) {
                    totalYearlySpent += entry.amount * 12;
                    totalMonthlySpent += entry.amount;
                } else if (entryYear === currentYear) {
                    const monthsAppliedInYear = 12 - entryMonth;
                    totalYearlySpent += entry.amount * monthsAppliedInYear;
                    if (entryMonth <= currentMonth) {
                        totalMonthlySpent += entry.amount;
                    }
                }
            } else {
                if (entryYear === currentYear) {
                    totalYearlySpent += entry.amount;
                    if (entryMonth === currentMonth) {
                        totalMonthlySpent += entry.amount;
                    }
                }
            }
        });

        return {
            remainingYearly: totalYearlyBudget - totalYearlySpent,
            remainingMonthly: totalMonthlyBudget - totalMonthlySpent,
        };
    }, [budgetEntries]);

    const handleSave = useCallback((data: any) => {
        if (!modalState) return;

        if (modalState.mode === 'addList') {
            const newList: Wishlist = { id: `wishlist-${crypto.randomUUID()}`, name: data.name };
            setWishlistData(prev => ({ ...prev, lists: [...prev.lists, newList] }));
        }
        if (modalState.mode === 'addItem' && modalState.listId) {
            const newItem: WishlistItem = {
                id: `wishitem-${crypto.randomUUID()}`,
                listId: modalState.listId,
                name: data.name,
                priority: data.priority,
                categoryId: data.categoryId,
                estimatedCost: data.estimatedCost ? parseFloat(data.estimatedCost) : undefined,
                imageUrl: data.imageUrl,
                description: data.description || undefined,
                status: 'active'
            };
            setWishlistData(prev => ({ ...prev, items: [...prev.items, newItem] }));
        }
        if (modalState.mode === 'editItem' && modalState.item) {
             setWishlistData(prev => ({
                ...prev,
                items: prev.items.map(i => i.id === modalState.item!.id ? {
                    ...i,
                    name: data.name,
                    priority: data.priority,
                    categoryId: data.categoryId,
                    estimatedCost: data.estimatedCost ? parseFloat(data.estimatedCost) : undefined,
                    imageUrl: data.imageUrl,
                    description: data.description || undefined,
                } : i)
             }));
        }
        if (modalState.mode === 'completeItem' && modalState.item) {
            const finalCost = data.finalCost ? parseFloat(data.finalCost) : undefined;
            
            setWishlistData(prev => ({
                ...prev,
                items: prev.items.map(i => i.id === modalState.item!.id ? {
                    ...i,
                    status: 'completed',
                    finalCost: finalCost,
                    completedDate: new Date().toISOString()
                } : i)
            }));

            if (finalCost && modalState.item) {
                const newBudgetEntry: BudgetEntry = {
                    id: `budget-${crypto.randomUUID()}`,
                    name: `Wish: ${modalState.item.name}`,
                    amount: finalCost,
                    date: new Date().toISOString().split('T')[0],
                    categoryId: modalState.item.categoryId,
                    isRecurring: false,
                    notes: `Completed from wishlist.`
                };
                setBudgetEntries(prev => [...prev, newBudgetEntry]);
            }
        }

        setModalState(null);
    }, [modalState, setWishlistData, setBudgetEntries]);
    
    const handleDeleteItem = (itemId: string) => {
        if(window.confirm('Are you sure you want to delete this wish?')) {
            setWishlistData(prev => ({...prev, items: prev.items.filter(i => i.id !== itemId)}));
        }
    }

    const handleDeleteList = useCallback((listId: string) => {
        if (window.confirm('Are you sure you want to delete this wishlist and all of its items? This action cannot be undone.')) {
            setWishlistData(prev => ({
                lists: prev.lists.filter(l => l.id !== listId),
                items: prev.items.filter(i => i.listId !== listId)
            }));
        }
    }, [setWishlistData]);

    const handleToggleHoldStatus = useCallback((itemId: string) => {
        setWishlistData(prev => ({
            ...prev,
            items: prev.items.map(i => {
                if (i.id === itemId) {
                    return { ...i, status: i.status === 'active' ? 'on-hold' : 'active' };
                }
                return i;
            })
        }));
    }, [setWishlistData]);

    const sortedAndFilteredItems = useMemo(() => {
        return wishlistData.items
            .filter(item => {
                if (filter === 'active') { // Show active and on-hold items in the "Active" view
                    return item.status === 'active' || item.status === 'on-hold';
                }
                return item.status === filter; // Show completed items in "Completed" view
            })
            .sort((a, b) => {
                if (filter === 'active') {
                    // In active view, sort on-hold items to the bottom
                    if (a.status === 'on-hold' && b.status !== 'on-hold') return 1;
                    if (a.status !== 'on-hold' && b.status === 'on-hold') return -1;
                }
                // Then sort by user's preference
                if (sort === 'cost') {
                    return (b.estimatedCost || 0) - (a.estimatedCost || 0);
                }
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });
    }, [wishlistData.items, filter, sort]);
    
    const getCategory = useCallback((id: BudgetCategory['id']) => {
        return initialCategories.find(c => c.id === id);
    }, []);

    const categoryBudgetInfo = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getUTCMonth();
        const currentYear = now.getUTCFullYear();

        const info: { [key: string]: { monthlyRemaining: number; yearlyRemaining: number; } } = {};

        initialCategories.forEach(cat => {
            const monthlyBudget = cat.budget;
            const yearlyBudget = cat.budget * 12;

            let spentThisMonth = 0;
            let spentThisYear = 0;

            budgetEntries.forEach(entry => {
                if (entry.categoryId === cat.id) {
                    const entryDate = new Date(`${entry.date}T00:00:00Z`);
                    const entryYear = entryDate.getUTCFullYear();
                    const entryMonth = entryDate.getUTCMonth();

                    if (entry.isRecurring) {
                        if (entryYear < currentYear) {
                            spentThisYear += entry.amount * 12;
                            spentThisMonth += entry.amount;
                        } else if (entryYear === currentYear) {
                            spentThisYear += entry.amount * (12 - entryMonth);
                            if (entryMonth <= currentMonth) {
                                spentThisMonth += entry.amount;
                            }
                        }
                    } else { // One-time entry
                        if (entryYear === currentYear) {
                            spentThisYear += entry.amount;
                            if (entryMonth === currentMonth) {
                                spentThisMonth += entry.amount;
                            }
                        }
                    }
                }
            });

            info[cat.id] = {
                monthlyRemaining: monthlyBudget - spentThisMonth,
                yearlyRemaining: yearlyBudget - spentThisYear
            };
        });

        return info;
    }, [budgetEntries]);

    return (
        <>
            <header>
                <h2>Wishlist</h2>
                <button className="add-holiday-btn" onClick={() => setModalState({ mode: 'addList' })}>+ Add Wishlist</button>
            </header>
            <main>
                 <div className="wishlist-budget-overview">
                    <div className="summary-card">
                        <h4>Yearly Budget Left</h4>
                        <p className={budgetOverview.remainingYearly >= 0 ? 'remaining' : 'overspent'}>
                            {formatCurrency(budgetOverview.remainingYearly)}
                        </p>
                    </div>
                    <div className="summary-card">
                        <h4>Monthly Budget Left</h4>
                        <p className={budgetOverview.remainingMonthly >= 0 ? 'remaining' : 'overspent'}>
                            {formatCurrency(budgetOverview.remainingMonthly)}
                        </p>
                    </div>
                </div>

                <div className="wishlist-controls">
                    <div className="filter-sort-controls">
                        <div className="control-group">
                             <label>Show:</label>
                             <select value={filter} onChange={e => setFilter(e.target.value as any)}>
                                 <option value="active">Active</option>
                                 <option value="completed">Completed</option>
                             </select>
                        </div>
                        <div className="control-group">
                            <label>Sort by:</label>
                            <select value={sort} onChange={e => setSort(e.target.value as any)}>
                                <option value="priority">Priority</option>
                                <option value="cost">Cost</option>
                            </select>
                        </div>
                    </div>
                </div>

                {wishlistData.lists.length === 0 && <p className="no-items-text">Create your first wishlist to get started!</p>}

                {wishlistData.lists.map(list => {
                    const itemsForList = sortedAndFilteredItems.filter(item => item.listId === list.id);
                    const isCollapsed = collapsedLists[list.id] || false;
                    return (
                        <div key={list.id} className="wishlist-group">
                            <div className="wishlist-group-header" onClick={() => handleToggleCollapse(list.id)}>
                                <div className="wishlist-header-main">
                                    <h3>
                                        <IconChevronDown className={`collapse-chevron ${isCollapsed ? 'collapsed' : ''}`} />
                                        {list.name}
                                    </h3>
                                </div>
                                <div className="wishlist-header-actions" onClick={e => e.stopPropagation()}>
                                    {filter === 'active' && <button className="add-item-btn" onClick={() => setModalState({ mode: 'addItem', listId: list.id })}>+ Add Wish</button>}
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteList(list.id)}
                                        className="action-btn"
                                        aria-label="Delete Wishlist"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                                    </button>
                                </div>
                            </div>
                            {!isCollapsed && (itemsForList.length > 0 ? (
                                <div className="wishlist-items-grid">
                                    {itemsForList.map(item => {
                                        const category = getCategory(item.categoryId);
                                        const budgetInfoForCat = categoryBudgetInfo[item.categoryId];
                                        const budgetInfoProp = budgetInfoForCat ? {
                                            categoryMonthlyRemaining: budgetInfoForCat.monthlyRemaining,
                                            categoryYearlyRemaining: budgetInfoForCat.yearlyRemaining,
                                            totalMonthlyRemaining: budgetOverview.remainingMonthly
                                        } : undefined;

                                        return (
                                            <WishlistItemCard
                                                key={item.id}
                                                item={item}
                                                category={category}
                                                budgetInfo={budgetInfoProp}
                                                onEdit={() => setModalState({ mode: 'editItem', item })}
                                                onComplete={() => setModalState({ mode: 'completeItem', item })}
                                                onDelete={() => handleDeleteItem(item.id)}
                                                onToggleHold={() => handleToggleHoldStatus(item.id)}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="no-items-text">No {filter} wishes in this list.</p>
                            ))}
                        </div>
                    );
                })}
            </main>
            {modalState && (
                <WishlistFormModal 
                    modalState={modalState}
                    onSave={handleSave}
                    onCancel={() => setModalState(null)}
                />
            )}
        </>
    );
};