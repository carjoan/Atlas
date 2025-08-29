/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { AppData, Holiday, Trip, BudgetEntry, BudgetCategory, WishlistData } from './types';
import { initialCategories } from './types';


// --- ICONS ---
const IconHelp = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor">
        <path d="M480-240q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-160h80v-240h-80v240Zm40 400q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
    </svg>
);
const IconRecurring = () => (
    <svg className="recurring-icon" xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" width="14"><path d="M480-80q-106 0-192-55T144-272l-44 44-56-56 160-160 160 160-56 56-52-52q21 34 49.5 60.5T400-184q65 39 140 39 117 0 198.5-81.5T820-424h80q-26 141-137.5 231.5T480-80Zm280-280q-26-141-137.5-231.5T340-782H260q-20 40-34 79.5T212-624h80q16-65 59-112t99-47q65-39 140-39 117 0 198.5 81.5T820-536l52 52 56-56-160-160-160 160 56 56 44-44q27 41 43 85.5T708-360Z"/></svg>
);


// --- TYPE DEFINITIONS ---
interface BudgetModalState {
    isOpen: boolean;
    data?: BudgetEntry;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// --- CHART COMPONENTS ---
const DonutChartSlice = ({ cx, cy, radius, innerRadius, startAngle, endAngle, color, onMouseOver, onMouseOut }: any) => {
    const startOuter = { x: cx + radius * Math.cos(startAngle), y: cy + radius * Math.sin(startAngle) };
    const endOuter = { x: cx + radius * Math.cos(endAngle), y: cy + radius * Math.sin(endAngle) };
    const startInner = { x: cx + innerRadius * Math.cos(startAngle), y: cy + innerRadius * Math.sin(startAngle) };
    const endInner = { x: cx + innerRadius * Math.cos(endAngle), y: cy + innerRadius * Math.sin(endAngle) };
    const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

    const d = [
        "M", startOuter.x, startOuter.y,
        "A", radius, radius, 0, largeArcFlag, 1, endOuter.x, endOuter.y,
        "L", endInner.x, endInner.y,
        "A", innerRadius, innerRadius, 0, largeArcFlag, 0, startInner.x, startInner.y,
        "Z"
    ].join(" ");

    return <path d={d} fill={color} onMouseOver={onMouseOver} onMouseOut={onMouseOut} />;
};

const CategoryPieChart = ({ categoryData, year }: { categoryData: any[], year: number }) => {
    const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
    let cumulativeAngle = -Math.PI / 2;

    const total = categoryData.reduce((acc, slice) => acc + slice.value, 0);

    return (
        <div className="chart-container pie-chart-container">
            <h3>Category Distribution</h3>
            <div className="pie-chart-content">
                {categoryData.length > 0 ? (
                    <>
                        <svg viewBox="0 0 200 200" role="img" aria-label={`Pie chart showing category spending distribution for ${year}`}>
                             <text x="100" y="95" textAnchor="middle" dy=".3em" className="axis-label" fontSize="10">Total</text>
                             <text x="100" y="115" textAnchor="middle" dy=".3em" fontWeight="bold" fill="#fff">{formatCurrency(total)}</text>
                            {categoryData.map(slice => {
                                const sliceAngle = (slice.percentage / 100) * 2 * Math.PI;
                                const startAngle = cumulativeAngle;
                                cumulativeAngle += sliceAngle;
                                const endAngle = cumulativeAngle;
                                return (
                                    <DonutChartSlice
                                        key={slice.id}
                                        cx={100} cy={100} radius={95} innerRadius={60}
                                        startAngle={startAngle}
                                        endAngle={endAngle}
                                        color={slice.color}
                                        onMouseOver={() => setHoveredSlice(slice.id)}
                                        onMouseOut={() => setHoveredSlice(null)}
                                    />
                                );
                            })}
                        </svg>
                        <div className="pie-legend">
                            {categoryData.map(slice => (
                                <div key={slice.id} className={`legend-item ${hoveredSlice === slice.id ? 'highlighted' : ''}`}>
                                    <div className="legend-color-box" style={{ backgroundColor: slice.color }}></div>
                                    <span className="legend-label">{slice.name}</span>
                                    <span className="legend-percent">{slice.percentage.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="no-chart-data">No spending data for this year.</p>
                )}
            </div>
        </div>
    );
};


// --- UI COMPONENTS ---

const BudgetEntryModal = ({
    modalState,
    onClose,
    onSave,
    plannerData
}: {
    modalState: BudgetModalState,
    onClose: () => void,
    onSave: (entry: Omit<BudgetEntry, 'id'>, id?: string) => void,
    plannerData: AppData
}) => {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [categoryId, setCategoryId] = useState<BudgetCategory['id']>('travel');
    const [isRecurring, setIsRecurring] = useState(false);
    const [linkedEventId, setLinkedEventId] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (modalState.data) {
            const { data } = modalState;
            setName(data.name);
            setAmount(String(data.amount));
            setDate(data.date);
            setCategoryId(data.categoryId);
            setIsRecurring(data.isRecurring || false);
            setLinkedEventId(data.linkedEventId || '');
            setNotes(data.notes || '');
        } else {
             setName('');
             setAmount('');
             setDate(new Date().toISOString().split('T')[0]);
             setCategoryId('travel');
             setIsRecurring(false);
             setLinkedEventId('');
             setNotes('');
        }
    }, [modalState]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        if (!name || isNaN(numericAmount) || numericAmount <= 0) {
            alert('Please provide a valid name and positive amount.');
            return;
        }
        onSave({
            name,
            amount: numericAmount,
            date,
            categoryId,
            isRecurring,
            linkedEventId: linkedEventId || undefined,
            notes
        }, modalState.data?.id);
    };

    const linkedEvents = useMemo(() => {
        const holidays: (Holiday | Trip)[] = plannerData.holidays;
        const trips: (Holiday | Trip)[] = plannerData.trips;
        return [...holidays, ...trips].sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [plannerData]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{modalState.data ? 'Edit' : 'Add'} Budget Entry</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="budgetName">Name</label>
                        <input id="budgetName" type="text" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                     <div className="form-group">
                        <label htmlFor="budgetAmount">Amount</label>
                        <input id="budgetAmount" type="number" value={amount} onChange={e => setAmount(e.target.value)} required step="0.01" min="0" />
                    </div>
                     <div className="form-group">
                        <label htmlFor="budgetDate">Date</label>
                        <input id="budgetDate" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    </div>
                     <div className="form-group">
                        <label htmlFor="budgetCategory">Category</label>
                        <select id="budgetCategory" value={categoryId} onChange={e => setCategoryId(e.target.value as BudgetCategory['id'])}>
                            {initialCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group form-group-checkbox">
                        <input id="budgetRecurring" type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
                        <label htmlFor="budgetRecurring">Recurring monthly (for this year)</label>
                    </div>
                     <div className="form-group">
                        <label htmlFor="budgetLinkedEvent">Linked Event (Optional)</label>
                        <select id="budgetLinkedEvent" value={linkedEventId} onChange={e => setLinkedEventId(e.target.value)}>
                            <option value="">None</option>
                            {linkedEvents.map(event => (
                                <option key={event.id} value={event.id}>
                                    {event.name} ({'holidayId' in event ? 'Trip' : 'Holiday'})
                                </option>
                            ))}
                        </select>
                    </div>
                     <div className="form-group">
                        <label htmlFor="budgetNotes">Notes</label>
                        <textarea id="budgetNotes" value={notes} onChange={e => setNotes(e.target.value)} rows={3}></textarea>
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                        <button type="submit" className="btn-save">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const BudgetHeader = ({ year, setYear, totalBudget, totalSpent, totalPlannedWishes }: { year: number, setYear: (year: number) => void, totalBudget: number, totalSpent: number, totalPlannedWishes: number }) => (
    <div className="budget-header">
        <div className="budget-header-nav">
            <button onClick={() => setYear(year - 1)} aria-label="Previous year">&lt;</button>
            <h2>{year} Overview</h2>
            <button onClick={() => setYear(year + 1)} aria-label="Next year">&gt;</button>
        </div>
        <div className="budget-summary-cards">
            <div className="summary-card">
                <h4>Total Budget</h4>
                <p>{formatCurrency(totalBudget)}</p>
            </div>
            <div className="summary-card">
                <h4>Total Spent</h4>
                <p className="spent">{formatCurrency(totalSpent)}</p>
            </div>
             <div className="summary-card">
                <h4>Planned (Wishes)</h4>
                <p className="planned">{formatCurrency(totalPlannedWishes)}</p>
            </div>
            <div className="summary-card">
                <h4>Remaining</h4>
                <p className={totalBudget - totalSpent >= 0 ? 'remaining' : 'overspent'}>
                    {formatCurrency(totalBudget - totalSpent)}
                </p>
            </div>
        </div>
    </div>
);

const BudgetPeriodNav = ({ selectedPeriod, onSelectPeriod }: { selectedPeriod: 'year' | number, onSelectPeriod: (period: 'year' | number) => void }) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return (
        <nav className="budget-period-nav">
            <button
                className={`period-btn ${selectedPeriod === 'year' ? 'active' : ''}`}
                onClick={() => onSelectPeriod('year')}
            >
                Year
            </button>
            <div className="month-buttons">
                {months.map((month, index) => (
                    <button
                        key={index}
                        className={`period-btn ${selectedPeriod === index ? 'active' : ''}`}
                        onClick={() => onSelectPeriod(index)}
                    >
                        {month}
                    </button>
                ))}
            </div>
        </nav>
    );
};

const CategoryProgressList = ({ categoryProgressData, selectedPeriod }: { categoryProgressData: any[], selectedPeriod: 'year' | number }) => {

    const totalPeriodBudget = useMemo(() => {
        return categoryProgressData.reduce((acc, cat) => acc + cat.budget, 0);
    }, [categoryProgressData]);
    
    const titleText = selectedPeriod === 'year' ? `Category Budgets (${formatCurrency(totalPeriodBudget)}/year)` : `Monthly Budgets (${formatCurrency(totalPeriodBudget)}/month)`;

    return (
        <div className="category-progress-section">
            <h3>{titleText}</h3>
            <div className="category-progress-grid">
                {categoryProgressData.map(cat => {
                    const percentage = cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0;
                    
                    return (
                        <div key={cat.id} className="category-progress-card">
                            <div className="category-progress-header">
                                <div className="category-name-wrapper">
                                    <span>{cat.name}</span>
                                    <div className="tooltip-container">
                                        <IconHelp />
                                        <span className="tooltip-text">{cat.description}</span>
                                    </div>
                                </div>
                                <span>{formatCurrency(cat.spent)} / {formatCurrency(cat.budget)}</span>
                            </div>
                            <div className="progress-bar-container">
                                <div className="progress-bar" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: cat.color }}></div>
                            </div>
                            {selectedPeriod !== 'year' && cat.rollover > 0 && (
                                <p className="rollover-info">
                                    Includes {formatCurrency(cat.rollover)} rolled over
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const BudgetEntryCard = ({ entry, onEdit, onDelete, getCategory, getEventName }: {
    entry: BudgetEntry;
    onEdit: (entry: BudgetEntry) => void;
    onDelete: (id: string) => void;
    getCategory: (id: BudgetCategory['id']) => BudgetCategory | undefined;
    getEventName: (id: string) => string;
}) => {
    const category = getCategory(entry.categoryId);
    const cardStyle = { borderLeftColor: category?.color || '#888' };
    const categoryStyle = { backgroundColor: category?.color || '#888', color: '#fff' };

    return (
        <div className="budget-entry-card" style={cardStyle}>
            <div className="budget-entry-card-header">
                <span className="entry-name">
                    {entry.name}
                    {entry.isRecurring && <IconRecurring />}
                </span>
                <span className="entry-amount">{formatCurrency(entry.amount)}</span>
            </div>
            <div className="budget-entry-card-body">
                <span>{new Date(entry.date).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="entry-category-badge" style={categoryStyle}>{category?.name || 'N/A'}</span>
            </div>
            {(entry.notes || entry.linkedEventId) && (
                <div className="budget-entry-card-footer">
                    <span>{entry.linkedEventId ? getEventName(entry.linkedEventId) : (entry.notes || ' ')}</span>
                    <div className="list-actions">
                        <button onClick={() => onEdit(entry)} className="action-btn-sm">Edit</button>
                        <button onClick={() => onDelete(entry.id)} className="action-btn-sm">Del</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const BudgetEntryList = ({ entries, onDelete, onEdit, plannerData }: { entries: BudgetEntry[], onDelete: (id: string) => void, onEdit: (entry: BudgetEntry) => void, plannerData: AppData }) => {
    const getEventName = useCallback((id: string) => {
        const event = [...plannerData.holidays, ...plannerData.trips].find(e => e.id === id);
        return event ? event.name : 'N/A';
    }, [plannerData]);

    const getCategory = useCallback((id: BudgetCategory['id']) => {
        return initialCategories.find(c => c.id === id);
    }, []);

    const sortedEntries = useMemo(() => entries
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [entries]);

    return (
        <div className="budget-entry-list">
            <h3>Entries</h3>
            {sortedEntries.length > 0 ? (
                 <div className="budget-entry-grid">
                     {sortedEntries.map(entry => (
                         <BudgetEntryCard 
                            key={entry.id}
                            entry={entry}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            getCategory={getCategory}
                            getEventName={getEventName}
                         />
                     ))}
                 </div>
            ) : (
                <p className="no-items-text">No budget entries for this period.</p>
            )}
        </div>
    );
};


export const BudgetView = ({ plannerData, wishlistData, budgetEntries, setBudgetEntries }: { plannerData: AppData, wishlistData: WishlistData, budgetEntries: BudgetEntry[], setBudgetEntries: React.Dispatch<React.SetStateAction<BudgetEntry[]>> }) => {
    const [year, setYear] = useState(new Date().getUTCFullYear());
    const [selectedPeriod, setSelectedPeriod] = useState<'year' | number>('year'); // 'year' or 0-11
    const [categories] = useState<BudgetCategory[]>(initialCategories);
    const [modalState, setModalState] = useState<BudgetModalState>({ isOpen: false });

    useEffect(() => {
        setSelectedPeriod('year');
    }, [year]);

    const handleSave = useCallback((entryData: Omit<BudgetEntry, 'id'>, id?: string) => {
        if (id) { // Edit mode
            setBudgetEntries(prev => prev.map(e => e.id === id ? { ...e, ...entryData, id } : e));
        } else { // Add mode
            const newEntry = { ...entryData, id: `budget-${crypto.randomUUID()}`};
            setBudgetEntries(prev => [...prev, newEntry]);
        }
        setModalState({ isOpen: false });
    }, [setBudgetEntries]);

    const handleDelete = useCallback((id: string) => {
        if (window.confirm('Are you sure you want to delete this entry?')) {
            setBudgetEntries(prev => prev.filter(e => e.id !== id));
        }
    }, [setBudgetEntries]);
    
    const handleEdit = useCallback((entry: BudgetEntry) => {
        setModalState({ isOpen: true, data: entry });
    }, []);

    const monthlyBreakdown = useMemo(() => {
        const breakdown = Array(12).fill(0).map(() => {
            const monthData: { [key: string]: number } = {};
            categories.forEach(c => (monthData[c.id] = 0));
            return monthData;
        });

        budgetEntries.forEach(entry => {
            const entryDate = new Date(`${entry.date}T00:00:00Z`);
            const entryYear = entryDate.getUTCFullYear();
            const entryStartMonth = entryDate.getUTCMonth();
            
            if (entry.isRecurring) {
                if (entryYear < year) {
                    for (let m = 0; m < 12; m++) {
                        breakdown[m][entry.categoryId] += entry.amount;
                    }
                } else if (entryYear === year) {
                    for (let m = entryStartMonth; m < 12; m++) {
                        breakdown[m][entry.categoryId] += entry.amount;
                    }
                }
            } else { // One-time entry
                if (entryYear === year) {
                    if (breakdown[entryStartMonth]) {
                       breakdown[entryStartMonth][entry.categoryId] += entry.amount;
                    }
                }
            }
        });

        return breakdown;
    }, [budgetEntries, year, categories]);
    
    const entriesForPeriod = useMemo(() => {
        return budgetEntries.filter(entry => {
            const entryDate = new Date(`${entry.date}T00:00:00Z`);
            const entryYear = entryDate.getUTCFullYear();
            const entryMonth = entryDate.getUTCMonth();

            if (selectedPeriod === 'year') {
                if (entry.isRecurring) {
                    return entryYear <= year;
                } else {
                    return entryYear === year;
                }
            } else { // month view
                if (entry.isRecurring) {
                    return entryYear < year || (entryYear === year && entryMonth <= selectedPeriod);
                } else {
                    return entryYear === year && entryMonth === selectedPeriod;
                }
            }
        });
    }, [budgetEntries, year, selectedPeriod]);

    const totalSpent = useMemo(() => {
        if(selectedPeriod === 'year') {
            return monthlyBreakdown.reduce((total, month) => total + Object.values(month).reduce((acc, v) => acc + v, 0), 0);
        }
        return Object.values(monthlyBreakdown[selectedPeriod]).reduce((acc, v) => acc + v, 0);
    }, [monthlyBreakdown, selectedPeriod]);

    const totalBudget = useMemo(() => {
        const monthlyBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
        return selectedPeriod === 'year' ? monthlyBudget * 12 : monthlyBudget;
    }, [categories, selectedPeriod]);

    const totalPlannedWishes = useMemo(() => {
        return wishlistData.items
            .filter(item => item.status === 'active' && item.estimatedCost)
            .reduce((sum, item) => sum + item.estimatedCost!, 0);
    }, [wishlistData]);

    const categoryProgressData = useMemo(() => {
        if (selectedPeriod === 'year') {
            const yearlySpending = categories.map(cat => ({
                ...cat,
                spent: monthlyBreakdown.reduce((sum, month) => sum + month[cat.id], 0),
                budget: cat.budget * 12,
                rollover: 0
            }));
            return yearlySpending;
        }

        const rollovers: { [key: string]: number } = {};
        categories.forEach(c => rollovers[c.id] = 0);

        for (let month = 0; month < selectedPeriod; month++) {
            categories.forEach(cat => {
                const spentThisMonth = monthlyBreakdown[month][cat.id];
                const effectiveSpending = spentThisMonth + rollovers[cat.id];
                const deficit = effectiveSpending - cat.budget;
                rollovers[cat.id] = deficit > 0 ? deficit : 0;
            });
        }
        
        return categories.map(cat => {
            const spentInSelectedMonth = monthlyBreakdown[selectedPeriod][cat.id];
            const rolloverAmount = rollovers[cat.id] || 0;
            const effectiveSpending = spentInSelectedMonth + rolloverAmount;
            
            return { ...cat, spent: effectiveSpending, budget: cat.budget, rollover: rolloverAmount };
        });

    }, [categories, monthlyBreakdown, selectedPeriod]);

    const categorySpendingDataForChart = useMemo(() => {
        const yearlyCategorySpending: { [key: string]: number } = {};
        categories.forEach(c => yearlyCategorySpending[c.id] = 0);

        monthlyBreakdown.forEach(month => {
            for (const categoryId in month) {
                yearlyCategorySpending[categoryId] += month[categoryId];
            }
        });
        
        const totalSpent = Object.values(yearlyCategorySpending).reduce((a, b) => a + b, 0);
        if (totalSpent === 0) return [];

        return categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            value: yearlyCategorySpending[cat.id],
            percentage: (yearlyCategorySpending[cat.id] / totalSpent) * 100,
            color: cat.color,
        })).filter(d => d.value > 0);
    }, [monthlyBreakdown, categories]);


    return (
        <>
            <header>
                <h2>Budget</h2>
                <button className="add-holiday-btn" onClick={() => setModalState({ isOpen: true })}>
                    + Add Entry
                </button>
            </header>
            <main>
                <BudgetHeader
                    year={year}
                    setYear={setYear}
                    totalBudget={totalBudget}
                    totalSpent={totalSpent}
                    totalPlannedWishes={totalPlannedWishes}
                />
                <BudgetPeriodNav selectedPeriod={selectedPeriod} onSelectPeriod={setSelectedPeriod} />
                
                {selectedPeriod === 'year' && (
                     <div className="budget-charts-grid">
                        <CategoryPieChart categoryData={categorySpendingDataForChart} year={year} />
                    </div>
                )}
               
                <CategoryProgressList categoryProgressData={categoryProgressData} selectedPeriod={selectedPeriod} />

                <BudgetEntryList entries={entriesForPeriod} onDelete={handleDelete} onEdit={handleEdit} plannerData={plannerData} />
            </main>
            {modalState.isOpen && (
                <BudgetEntryModal 
                    modalState={modalState}
                    onClose={() => setModalState({ isOpen: false })}
                    onSave={handleSave}
                    plannerData={plannerData}
                />
            )}
        </>
    );
};