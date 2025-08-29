/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo, useState } from 'react';
import type { AppData, TodoData, BudgetEntry } from './types';
import { initialCategories } from './types';

// --- HELPER FUNCTIONS ---
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};
const formatDateShort = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    });
};
const getDaysUntil = (dateStr: string) => {
  if (!dateStr) return 0;
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const targetDate = new Date(`${dateStr}T00:00:00Z`);
  const diffTime = targetDate.getTime() - todayUTC.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Calculates the ISO week of the year for a given Date object.
 * @param date The date for which to calculate the ISO week.
 * @returns The ISO week number (1-53).
 */
const getISOWeek = (date: Date): number => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};


/**
 * Calculates the visual start week of a meteorological season, adjusted to the following Monday.
 * @param year The year of the season.
 * @param month The meteorological start month (1-12).
 * @param day The meteorological start day.
 * @returns The ISO week number (1-53) of the season's visual start.
 */
const getSeasonStartWeek = (year: number, month: number, day: number): number => {
    // Get meteorological start date
    const d = new Date(Date.UTC(year, month - 1, day));
    
    // Adjust to the following Monday if the start date isn't a Monday
    const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (dayOfWeek !== 1) {
        // Days to add to get to the next Monday
        const daysToAdd = (1 - dayOfWeek + 7) % 7;
        d.setUTCDate(d.getUTCDate() + daysToAdd);
    }
    return getISOWeek(d);
};


// --- ICON ---
const IconChevronDown = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
        <path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z"/>
    </svg>
);


// --- DASHBOARD CARD COMPONENTS ---

const LifeSummaryCard = ({ calendarData }: { calendarData: any }) => {
    if (!calendarData) {
        return (
             <div className="dashboard-card life-summary-card">
                <p>Set your birthdate in the Life Calendar to see your summary.</p>
            </div>
        )
    };

    return (
        <div className="dashboard-card life-summary-card">
            <p>
                Each square is a week.
                You’ve already lived <strong>{calendarData.weeksLived.toLocaleString()}</strong> of them ({calendarData.yearsLived.toFixed(1)} years).
                If you’re average, you have <strong>{calendarData.weeksRemaining.toLocaleString()}</strong> left ({calendarData.yearsRemaining.toFixed(1)} years).
                Make them count.
            </p>
        </div>
    );
};

const UpcomingEventCard = ({ plannerData, onNavigate }: { plannerData: AppData, onNavigate: (id: string) => void }) => {
    const upcomingEvent = useMemo(() => {
        const now = new Date();
        now.setHours(0,0,0,0);
        const futureEvents = [...plannerData.holidays, ...plannerData.trips]
            .filter(event => new Date(event.endDate) >= now)
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        return futureEvents[0];
    }, [plannerData]);

    return (
        <div className="dashboard-card">
            <h3 className="card-title">Next Adventure</h3>
            <div className="card-content">
                {upcomingEvent ? (
                    <>
                        <h4>{upcomingEvent.name}</h4>
                        <p className="card-subtext">{formatDateShort(upcomingEvent.startDate)} - {formatDateShort(upcomingEvent.endDate)}</p>
                        <div className="countdown-mini">
                            <span className="time-left-mini">{getDaysUntil(upcomingEvent.startDate) > 0 ? getDaysUntil(upcomingEvent.startDate) : '🎉'}</span>
                            <span className="label-mini">{getDaysUntil(upcomingEvent.startDate) > 0 ? 'days to go!' : 'It\'s happening!'}</span>
                        </div>
                        <button className="card-link" onClick={() => onNavigate('planner')}>View Planner</button>
                    </>
                ) : (
                    <p className="no-items-text">No upcoming events. Time to plan one!</p>
                )}
            </div>
        </div>
    );
};

const PriorityTasksCard = ({ todoData, onNavigate }: { todoData: TodoData, onNavigate: (id: string) => void }) => {
    const highPriorityTasks = useMemo(() => {
        return todoData.tasks
            .filter(task => !task.completed && todoData.projects.find(p => p.id === task.projectId)?.priority === 'high')
            .slice(0, 4);
    }, [todoData]);
     const getProjectName = (projectId: string) => {
        return todoData.projects.find(p => p.id === projectId)?.name || '';
    }

    return (
        <div className="dashboard-card">
            <h3 className="card-title">High-Priority Tasks</h3>
            <div className="card-content">
                {highPriorityTasks.length > 0 ? (
                    <ul className="dashboard-list">
                        {highPriorityTasks.map(task => (
                            <li key={task.id}>
                                <span>{task.name}</span>
                                <small>({getProjectName(task.projectId)})</small>
                            </li>
                        ))}
                    </ul>
                ) : (
                     <p className="no-items-text">No high-priority tasks. Great job!</p>
                )}
                <button className="card-link" onClick={() => onNavigate('todo')}>View All Tasks</button>
            </div>
        </div>
    );
};

const BudgetSnapshotCard = ({ budgetEntries, onNavigate }: { budgetEntries: BudgetEntry[], onNavigate: (id: string) => void }) => {
    const budgetSnapshot = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getUTCMonth();
        const currentYear = now.getUTCFullYear();
        const monthlyBudget = initialCategories.reduce((sum, cat) => sum + cat.budget, 0);

        const spentThisMonth = budgetEntries.reduce((total, entry) => {
            const entryDate = new Date(`${entry.date}T00:00:00Z`);
            const entryYear = entryDate.getUTCFullYear();
            const entryMonth = entryDate.getUTCMonth();

            if (entry.isRecurring) {
                if (entryYear < currentYear || (entryYear === currentYear && entryMonth <= currentMonth)) {
                    return total + entry.amount;
                }
            } else {
                if (entryYear === currentYear && entryMonth === currentMonth) {
                    return total + entry.amount;
                }
            }
            return total;
        }, 0);
        
        return { monthlyBudget, spentThisMonth };
    }, [budgetEntries]);

    const spent = budgetSnapshot.spentThisMonth;
    const budget = budgetSnapshot.monthlyBudget;
    const percentage = budget > 0 ? (spent / budget) * 100 : 0;

    return (
        <div className="dashboard-card">
            <h3 className="card-title">Monthly Budget</h3>
            <div className="card-content">
                <p className="budget-numbers">
                    <span className="spent">{formatCurrency(spent)}</span>
                    <span className="budget-separator">/</span>
                    <span>{formatCurrency(budget)}</span>
                </p>
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                </div>
                 <p className="card-subtext">
                    {percentage > 100 ? 
                    <span className="overspent">{formatCurrency(spent - budget)} over budget</span> : 
                    <span className="remaining">{formatCurrency(budget - spent)} remaining</span>}
                </p>
                <button className="card-link" onClick={() => onNavigate('budget')}>View Budget</button>
            </div>
        </div>
    );
};

const QuickLinksCard = ({ onNavigate }: { onNavigate: (id: string) => void }) => {
    return (
        <div className="dashboard-card">
            <h3 className="card-title">Quick Links</h3>
            <div className="card-content quick-links">
                <button onClick={() => onNavigate('planner')}>📅 Planner</button>
                <button onClick={() => onNavigate('todo')}>✔️ Todo List</button>
                <button onClick={() => onNavigate('budget')}>💰 Budget</button>
                <button onClick={() => onNavigate('finances')}>💸 Finances</button>
                <button onClick={() => onNavigate('wishlist')}>💖 Wishlist</button>
            </div>
        </div>
    )
}

const LifeCalendarCard = ({
    isCollapsed,
    setIsCollapsed,
    birthdateStr,
    setBirthdateStr,
    sex,
    setSex,
    maleExpectancy,
    setMaleExpectancy,
    femaleExpectancy,
    setFemaleExpectancy,
    calendarData
}: {
    isCollapsed: boolean,
    setIsCollapsed: (value: React.SetStateAction<boolean>) => void,
    birthdateStr: string,
    setBirthdateStr: (value: React.SetStateAction<string>) => void,
    sex: 'male' | 'female' | 'both',
    setSex: (value: React.SetStateAction<'male' | 'female' | 'both'>) => void,
    maleExpectancy: string,
    setMaleExpectancy: (value: React.SetStateAction<string>) => void,
    femaleExpectancy: string,
    setFemaleExpectancy: (value: React.SetStateAction<string>) => void,
    calendarData: any
}) => {
    return (
        <div className="dashboard-card life-calendar-card">
            <div className="card-title" onClick={() => setIsCollapsed(!isCollapsed)}>
                <span>Life Calendar</span>
                <IconChevronDown className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`} />
            </div>
            {!isCollapsed && (
                <div className="card-content">
                    <div className="life-calendar-controls">
                        <div className="life-control-group">
                            <label htmlFor="birthdate">Birthdate</label>
                            <input type="date" id="birthdate" value={birthdateStr} onChange={e => setBirthdateStr(e.target.value)} />
                        </div>
                        <div className="life-control-group">
                            <label htmlFor="sex">Sex</label>
                            <select id="sex" value={sex} onChange={e => setSex(e.target.value as any)}>
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                                <option value="both">Show Both</option>
                            </select>
                        </div>
                        <div className="life-control-group">
                            <label htmlFor="maleExp">Male Expectancy (yrs)</label>
                            <input type="number" id="maleExp" value={maleExpectancy} onChange={e => setMaleExpectancy(e.target.value)} step="0.1" />
                        </div>
                        <div className="life-control-group">
                            <label htmlFor="femaleExp">Female Expectancy (yrs)</label>
                            <input type="number" id="femaleExp" value={femaleExpectancy} onChange={e => setFemaleExpectancy(e.target.value)} step="0.1" />
                        </div>
                    </div>

                    {calendarData ? (
                        <>
                            <div className="life-narrative">
                                Each square is a week. 
                                You’ve already lived {calendarData.weeksLived.toLocaleString()} of them ({calendarData.yearsLived.toFixed(1)} years).
                                If you’re average, you have {calendarData.weeksRemaining.toLocaleString()} left ({calendarData.yearsRemaining.toFixed(1)} years).
                                Make them count.
                            </div>
                            <div className="life-percentage">
                                {calendarData.percentageLived.toFixed(1)}% of expected life lived
                            </div>
                            <div className="life-calendar-grid-container" role="grid" aria-label="Life calendar grid">
                                 <div className="season-header-row">
                                    <div className="season-headers">
                                        <span className="season-label">Winter</span>
                                        <span className="season-label">Spring</span>
                                        <span className="season-label">Summer</span>
                                        <span className="season-label">Autumn</span>
                                    </div>
                                </div>
                                {Array.from({ length: calendarData.totalYears }).map((_, yearIndex) => {
                                    const isMilestoneYear = [18, 30, 50, 65].includes(yearIndex);
                                    const displayYear = calendarData.birthYear + yearIndex;
                                    return (
                                    <div className={`year-row ${isMilestoneYear ? 'milestone-year' : ''}`} key={yearIndex} role="row">
                                        <span className="year-label" role="rowheader">Age {yearIndex} ({displayYear})</span>
                                        <div className="weeks-in-year">
                                        {Array.from({ length: 52 }).map((_, weekInYearIndex) => {
                                            const weekNumber = yearIndex * 52 + weekInYearIndex;
                                            
                                            let status = 'future';
                                            if (weekNumber < calendarData.weeksLived) status = 'lived';
                                            if (weekNumber === calendarData.weeksLived) status = 'current';

                                            let classes = `week-box ${status}`;
                                            
                                            if ((sex === 'male' || sex === 'both') && weekNumber === calendarData.maleExpectancyWeek) classes += ' marker-male';
                                            if ((sex === 'female' || sex === 'both') && weekNumber === calendarData.femaleExpectancyWeek) classes += ' marker-female';
                                            if (weekNumber / 52 > calendarData.gridExpectancy) classes += ' beyond-expectancy';
                                            if (calendarData.seasonDividers.includes(weekInYearIndex)) {
                                                classes += ' season-divider';
                                            }

                                            return <div key={weekInYearIndex} className={classes} title={`Age ${yearIndex}, Week ${weekInYearIndex+1}`} role="gridcell" />;
                                        })}
                                        </div>
                                    </div>
                                    )
                                })}
                            </div>
                        </>
                    ) : (
                        <p className="no-items-text">Please enter a valid birthdate.</p>
                    )}
                </div>
            )}
        </div>
    );
};


// --- MAIN HOME VIEW ---
export const HomeView = ({ plannerData, todoData, budgetEntries, onNavigate }: {
    plannerData: AppData,
    todoData: TodoData,
    budgetEntries: BudgetEntry[],
    onNavigate: (id: string) => void,
}) => {
    const [isLifeCalendarCollapsed, setIsLifeCalendarCollapsed] = useState(true);
    const [birthdateStr, setBirthdateStr] = useState('2003-04-29');
    const [sex, setSex] = useState<'male' | 'female' | 'both'>('female');
    const [maleExpectancy, setMaleExpectancy] = useState('81.9');
    const [femaleExpectancy, setFemaleExpectancy] = useState('85.6');
    
    const calendarData = useMemo(() => {
        const birthDate = new Date(birthdateStr + 'T00:00:00Z');
        if (isNaN(birthDate.getTime())) return null;

        const birthYear = birthDate.getUTCFullYear();
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        
        const weeksLived = Math.floor((todayUTC.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const yearsLived = (weeksLived / 52.1775);

        const maleExp = parseFloat(maleExpectancy) || 81.9;
        const femaleExp = parseFloat(femaleExpectancy) || 85.6;

        let gridExpectancy = 0;
        let displayExpectancy = 0;

        if (sex === 'male') {
            gridExpectancy = displayExpectancy = maleExp;
        } else if (sex === 'female') {
            gridExpectancy = displayExpectancy = femaleExp;
        } else { // 'both'
            gridExpectancy = Math.max(maleExp, femaleExp);
            displayExpectancy = femaleExp; 
        }
        
        const totalYears = Math.ceil(gridExpectancy);
        
        const maleExpectancyWeek = Math.floor(maleExp * 52);
        const femaleExpectancyWeek = Math.floor(femaleExp * 52);

        const totalExpectedWeeks = Math.floor(displayExpectancy * 52);
        const weeksRemaining = Math.max(0, totalExpectedWeeks - weeksLived);
        const yearsRemaining = Math.max(0, displayExpectancy - yearsLived);

        const percentageLived = totalExpectedWeeks > 0 ? (weeksLived / totalExpectedWeeks) * 100 : 0;
        
        // Season calculation
        const birthWeek = getISOWeek(birthDate);
        const yearForSeasons = birthDate.getUTCFullYear();
        
        const seasonWeeks = {
            spring: getSeasonStartWeek(yearForSeasons, 3, 1),
            summer: getSeasonStartWeek(yearForSeasons, 6, 1),
            autumn: getSeasonStartWeek(yearForSeasons, 9, 1),
            winter: getSeasonStartWeek(yearForSeasons, 12, 1),
        };

        const seasonDividers = Object.values(seasonWeeks).map(
            seasonWeek => (seasonWeek - birthWeek + 52) % 52
        );

        return {
            birthYear,
            totalYears, 
            weeksLived, 
            yearsLived,
            weeksRemaining,
            yearsRemaining,
            percentageLived,
            maleExpectancyWeek, 
            femaleExpectancyWeek,
            gridExpectancy,
            seasonDividers,
        };
    }, [birthdateStr, sex, maleExpectancy, femaleExpectancy]);

    return (
        <>
            <div className="home-hero">
                <div className="hero-content">
                    <h1>The world is a book and those who do not travel read only one page.</h1>
                    <p>– Saint Augustine</p>
                </div>
            </div>

            <div className="dashboard-grid">
                <LifeSummaryCard calendarData={calendarData} />
                <UpcomingEventCard plannerData={plannerData} onNavigate={onNavigate} />
                <PriorityTasksCard todoData={todoData} onNavigate={onNavigate} />
                <BudgetSnapshotCard budgetEntries={budgetEntries} onNavigate={onNavigate} />
                <QuickLinksCard onNavigate={onNavigate} />
                <LifeCalendarCard
                    isCollapsed={isLifeCalendarCollapsed}
                    setIsCollapsed={setIsLifeCalendarCollapsed}
                    birthdateStr={birthdateStr}
                    setBirthdateStr={setBirthdateStr}
                    sex={sex}
                    setSex={setSex}
                    maleExpectancy={maleExpectancy}
                    setMaleExpectancy={setMaleExpectancy}
                    femaleExpectancy={femaleExpectancy}
                    setFemaleExpectancy={setFemaleExpectancy}
                    calendarData={calendarData}
                />
            </div>
        </>
    );
};