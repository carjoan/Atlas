/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import type { FinanceData, BudgetEntry, FinanceGoal, Account, Holding } from './types';
import { initialCategories } from './types';

// --- HELPER FUNCTIONS ---
const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

// --- ICONS ---
const IconRiskHigh = () => <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="var(--error-color)"><path d="m40-120 440-760 440 760H40Zm104-80h672L480-720 144-200Zm336-80q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-120h80v-200h-80v200Z"/></svg>;
const IconRiskLow = () => <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="var(--success-color)"><path d="M480-80 200-260V-500l280-180 280 180v240L480-80Zm0-214 160-103v-143l-160-103-160 103v143l160 103Z"/></svg>;
const IconInfo = () => <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor"><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Z"/></svg>;


// --- SUB-COMPONENTS for TABS ---

const FinanceHome = ({ financeData }: { financeData: FinanceData }) => {
    // Mock prices for crypto holdings. In a real app, this would come from an API.
    const MOCK_PRICES: { [key: string]: number } = { BTC: 68000, ETH: 3800 };

    const totalAssetValue = useMemo(() => {
        const accountAssets = financeData.accounts
            .filter(a => a.balance > 0)
            .reduce((sum, acc) => sum + acc.balance, 0);
        
        const cryptoValue = financeData.holdings.reduce((sum, holding) => {
            return sum + holding.quantity * (MOCK_PRICES[holding.symbol] || 0);
        }, 0);
        
        return accountAssets + cryptoValue;
    }, [financeData, MOCK_PRICES]);

    const totalDebt = useMemo(() => {
         return financeData.accounts
            .filter(a => a.balance < 0)
            .reduce((sum, acc) => sum + acc.balance, 0); // balance is already negative
    }, [financeData.accounts]);
    
    const netWorth = useMemo(() => {
        return totalAssetValue + totalDebt;
    }, [totalAssetValue, totalDebt]);

    const getRiskIcon = (account: Account) => {
        if (account.riskTier === 'high') return <IconRiskHigh />;
        if (account.riskTier === 'low') return <IconRiskLow />;
        return null;
    }
    
    return (
        <div className="finance-grid">
            <div className="finance-card">
                <h3>Net Worth</h3>
                <p className="net-worth-display">{formatCurrency(netWorth)}</p>
                <p className="finance-sub-value">Assets: {formatCurrency(totalAssetValue)}</p>
                <p className="finance-sub-value">Debt: {formatCurrency(Math.abs(totalDebt))}</p>
            </div>

            <div className="finance-card">
                <h3>Accounts</h3>
                <ul className="finance-list">
                    {financeData.accounts.map(acc => (
                        <li key={acc.id}>
                            <div className="finance-list-item">
                                <span>{acc.provider} ({acc.type.replace('-', ' ')})</span>
                                <span className="finance-list-item-balance">{formatCurrency(acc.balance, acc.currency)}</span>
                            </div>
                            <div className="finance-list-item-sub">
                                {getRiskIcon(acc)}
                                {acc.riskTier && <span className="risk-tier">{acc.riskTier} risk</span>}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="finance-card">
                <h3>Holdings</h3>
                <ul className="finance-list">
                    {financeData.holdings.map(h => {
                        const account = financeData.accounts.find(a => a.id === h.accountId);
                        const currentValue = h.quantity * (MOCK_PRICES[h.symbol] || 0);
                        return (
                        <li key={h.id}>
                             <div className="finance-list-item">
                                <span>{h.quantity} {h.symbol}</span>
                                <span className="finance-list-item-balance">{formatCurrency(currentValue)}</span>
                            </div>
                             <div className="finance-list-item-sub">
                                <span>in {account?.provider}</span>
                            </div>
                        </li>
                    )})}
                </ul>
                 <div className="tooltip-container info-tooltip">
                    <IconInfo />
                    <span className="tooltip-text">Crypto prices are simulated and not live.</span>
                </div>
            </div>

             <div className="finance-card">
                <h3>Goals</h3>
                <ul className="finance-list">
                    {financeData.goals.map(g => {
                        const progress = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
                        return (
                            <li key={g.id}>
                                <div className="finance-list-item">
                                    <span>{g.name}</span>
                                    <span>{formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)}</span>
                                </div>
                                <div className="progress-bar-container small">
                                    <div className="progress-bar" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    );
};

const FinanceGoals = ({ goals }: { goals: FinanceGoal[] }) => {
    return (
        <div className="finance-grid">
            {goals.map(goal => {
                const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                return (
                    <div className="finance-card goal-card" key={goal.id}>
                        <h3>{goal.name}</h3>
                        <p className="goal-target">{formatCurrency(goal.targetAmount)}</p>
                        <div className="goal-progress-info">
                             <span>{formatCurrency(goal.currentAmount)}</span>
                             <span>{progress.toFixed(1)}%</span>
                        </div>
                        <div className="progress-bar-container">
                            <div className="progress-bar" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                        </div>
                        {goal.targetDate && <p className="goal-date">Target: {new Date(goal.targetDate+'T00:00:00Z').toLocaleDateString(undefined, {year: 'numeric', month: 'long', timeZone: 'UTC'})}</p>}
                    </div>
                )
            })}
             {goals.length === 0 && <p className="no-items-text">No financial goals set up yet.</p>}
        </div>
    )
};

const FinanceTransactions = ({ budgetEntries }: { budgetEntries: BudgetEntry[] }) => {
    const transactions = useMemo(() => {
        return budgetEntries
            .map(entry => {
                const category = initialCategories.find(c => c.id === entry.categoryId);
                return {
                    id: entry.id,
                    date: entry.date,
                    amount: -entry.amount, // budget entries are expenses
                    merchant: entry.name,
                    category: category?.name || 'Misc',
                    categoryColor: category?.color || '#95a5a6'
                }
            })
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [budgetEntries]);

    return (
        <div className="finance-card">
            <h3>Recent Transactions</h3>
            <p className="card-subtext">Derived from your budget entries.</p>
            <table className="transactions-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th className="amount-col">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map(tx => (
                        <tr key={tx.id}>
                            <td>{new Date(tx.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'})}</td>
                            <td>{tx.merchant}</td>
                            <td><span className="category-tag" style={{backgroundColor: tx.categoryColor}}>{tx.category}</span></td>
                            <td className="amount-col">{formatCurrency(tx.amount)}</td>
                        </tr>
                    ))}
                    {transactions.length === 0 && (
                        <tr>
                            <td colSpan={4} className="no-items-text">No transactions found. Add some in the Budget tab.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
};


export const FinancesView = ({ financeData, setFinanceData, budgetEntries }: { 
    financeData: FinanceData, 
    setFinanceData: React.Dispatch<React.SetStateAction<FinanceData>>,
    budgetEntries: BudgetEntry[],
}) => {
    const [activeTab, setActiveTab] = useState('home');

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return <FinanceHome financeData={financeData} />;
            case 'goals':
                return <FinanceGoals goals={financeData.goals} />;
            case 'transactions':
                return <FinanceTransactions budgetEntries={budgetEntries} />;
            default:
                return <FinanceHome financeData={financeData} />;
        }
    }

    return (
        <>
            <header>
                <h2>Finances</h2>
                {/* Add button can be added here later for adding accounts/goals */}
            </header>
            <main>
                <div className="finance-tabs">
                    <button onClick={() => setActiveTab('home')} className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`}>Overview</button>
                    <button onClick={() => setActiveTab('goals')} className={`tab-btn ${activeTab === 'goals' ? 'active' : ''}`}>Goals</button>
                    <button onClick={() => setActiveTab('transactions')} className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}>Transactions</button>
                </div>
                <div className="finance-tab-content">
                    {renderContent()}
                </div>
            </main>
        </>
    )
};
