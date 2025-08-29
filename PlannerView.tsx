/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import type { AppData, Holiday, Trip, Activity, EventCategory, PlannerEvent, Entry, EntryType, ModalState, HandleSave, Goal, GoalCategory, WishlistData, WishlistItem, GoogleEvent, VacationRecommendation, BudgetCategory, PackingData, PackingItem } from './types';
import { MiniCalendar, Countdown, EntryFormModal } from './index';
import { initialGoalCategories, initialCategories } from './types';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const formatGoogleDate = (gDate: GoogleEvent['start'] | GoogleEvent['end']) => {
    if (gDate.date) { // All-day event
        return formatDate(gDate.date);
    }
    if (gDate.dateTime) {
        return new Date(gDate.dateTime).toLocaleString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    }
    return 'N/A';
};

const CardActions = ({ onEdit, onDelete }: {onEdit: () => void, onDelete: () => void}) => (
    <div className="card-actions">
        <button type="button" onClick={onEdit} className="action-btn" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M200-200h56l345-345-56-56-345 345v56Zm572-403L602-771l56-56q23-23 56.5-23t56.5 23l56 56q23 23 23 56.5T829-663l-57 56Z"/></svg></button>
        <button type="button" onClick={onDelete} className="action-btn" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg></button>
    </div>
);

const TripCard = ({ trip, activities, onModalOpen, onDelete }: { trip: Trip, activities: Activity[], onModalOpen: (state: ModalState) => void, onDelete: (id: string, type: EntryType) => void }) => (
    <div className="trip-card" style={{ borderLeftColor: trip.color }}>
        <div className="card-header">
            <div>
                <h3>{trip.name}</h3>
                <p className="dates">{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</p>
            </div>
             <CardActions 
                onEdit={() => onModalOpen({ mode: 'edit', type: 'trip', data: trip })} 
                onDelete={() => onDelete(trip.id, 'trip')}
             />
        </div>
        <Countdown startDate={trip.startDate} endDate={trip.endDate} />
        <div className="activity-section">
            <h4>Activities</h4>
            {activities.length > 0 ? (
                <ul className="activity-list">
                {activities.map(activity => (
                    <li key={activity.id}>
                        <span>{activity.name} ({formatDate(activity.date)})</span>
                        <div className="activity-actions">
                            <button type="button" onClick={() => onModalOpen({ mode: 'edit', type: 'activity', data: activity })} className="action-btn-sm" aria-label="Edit Activity"><svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor"><path d="M200-200h56l345-345-56-56-345 345v56Zm572-403L602-771l56-56q23-23 56.5-23t56.5 23l56 56q23 23 23 56.5T829-663l-57 56Z"/></svg></button>
                             <button type="button" onClick={() => onDelete(activity.id, 'activity')} className="action-btn-sm" aria-label="Delete Activity"><svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520Z"/></svg></button>
                        </div>
                    </li>
                ))}
                </ul>
            ) : <p className="no-items-text">No activities planned for this trip.</p>}
            <button className="add-item-btn" onClick={() => onModalOpen({ mode: 'add', type: 'activity', parentId: trip.id })}>+ Add Activity</button>
        </div>
    </div>
);

const PackingAssistant = ({ holiday }: { holiday: Holiday }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [packingData, setPackingData] = useState<PackingData | null>(null);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [includeActivities, setIncludeActivities] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sources, setSources] = useState<any[]>([]);

    const generateList = async () => {
        setIsLoading(true);
        setError(null);
        setPackingData(null);
        setCheckedItems({});
        setSources([]);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            let prompt = `Create a detailed, structured JSON packing list for a trip to ${holiday.name} from ${formatDate(holiday.startDate)} to ${formatDate(holiday.endDate)}.
You MUST use Google Search to find the specific expected weather (temperature range, precipitation) for this location and time.
Based on the weather, generate a highly specific clothing list. For example, if it's hot and sunny, include "sunglasses", "sunscreen", "shorts", and "sandals". If it's cold and rainy, include "waterproof jacket", "warm sweater", and "boots". Be very specific.
Categorize items into "essentials" (e.g., passport, tickets), "carryOn" (e.g., headphones, book), and "checkedLuggage" (most clothing and toiletries).
Assign a single, relevant emoji for each packing item. Each category must have at least a few items.
Return ONLY a valid JSON object that can be parsed directly. The JSON must conform to the TypeScript interface:
interface PackingData {
    essentials: { name: string; emoji: string; }[];
    carryOn: { name: string; emoji: string; }[];
    checkedLuggage: { name: string; emoji: string; }[];
    suggestedActivities?: { name: string; description: string; }[];
}
Do not wrap the JSON in markdown code fences.`;

            if (includeActivities) {
                prompt += `\nIn the JSON, also populate the 'suggestedActivities' field with 3-5 potential activities suitable for the trip and weather.`;
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            // Robust JSON parsing
            let jsonText = response.text.trim();
            const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
                jsonText = jsonMatch[1];
            }
            
            const parsedData = JSON.parse(jsonText) as PackingData;
            setPackingData(parsedData);

            // Handle sources
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                const uniqueSources = groundingChunks
                    .map((chunk: any) => chunk.web)
                    .filter((web: any) => web && web.uri)
                    .reduce((acc: any[], current: any) => {
                        if (!acc.find((item) => item.uri === current.uri)) {
                            acc.push(current);
                        }
                        return acc;
                    }, []);
                setSources(uniqueSources);
            }

        } catch (err) {
            console.error("Error generating packing list:", err);
            setError("Failed to generate a weather-specific packing list. The AI may have returned an unexpected format or there was a network error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckItem = (itemName: string) => {
        setCheckedItems(prev => ({ ...prev, [itemName]: !prev[itemName] }));
    };

    const PackingCategoryDisplay = ({ title, icon, items }: { title: string, icon: string, items: PackingItem[] }) => {
        if (!items || items.length === 0) return null;
        return (
            <div className="packing-category">
                <h3>{icon} {title}</h3>
                <ul className="packing-list">
                    {items.map(item => (
                        <li key={item.name}>
                            <input type="checkbox" id={`${holiday.id}-${item.name}`} checked={!!checkedItems[item.name]} onChange={() => handleCheckItem(item.name)} />
                            <label htmlFor={`${holiday.id}-${item.name}`}>
                                <span className="packing-item-emoji">{item.emoji}</span>
                                {item.name}
                            </label>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <div className="ai-feature-section packing-assistant">
            <h4 className="ai-feature-header" onClick={() => setIsCollapsed(p => !p)}>
                🤖 AI Packing Assistant
                <span className={`collapse-chevron ${isCollapsed ? 'collapsed' : ''}`}>&#9660;</span>
            </h4>
            {!isCollapsed && (
                <div className="ai-feature-content">
                    <div className="form-group-checkbox">
                        <input type="checkbox" id={`activities-${holiday.id}`} checked={includeActivities} onChange={e => setIncludeActivities(e.target.checked)} disabled={isLoading} />
                        <label htmlFor={`activities-${holiday.id}`}>Include activity ideas</label>
                    </div>
                    <button className="add-item-btn" onClick={generateList} disabled={isLoading}>
                        {isLoading ? 'Generating...' : 'Generate Packing List'}
                    </button>
                    {isLoading && <div className="loading-spinner"></div>}
                    {error && <p className="error-message">{error}</p>}
                    {packingData && (
                        <div className="packing-list-container">
                            <PackingCategoryDisplay title="Documents & Essentials" icon="📄" items={packingData.essentials} />
                            <PackingCategoryDisplay title="Carry-On" icon="🎒" items={packingData.carryOn} />
                            <PackingCategoryDisplay title="Checked Luggage" icon="🧳" items={packingData.checkedLuggage} />

                            {packingData.suggestedActivities && packingData.suggestedActivities.length > 0 && (
                                <div className="packing-category">
                                    <h3>🚀 Suggested Activities</h3>
                                    <ul className="activities-list">
                                        {packingData.suggestedActivities.map(activity => (
                                            <li key={activity.name}>
                                                <strong>{activity.name}:</strong> {activity.description}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {sources.length > 0 && (
                                <div className="packing-sources-section">
                                    <h3>Sources</h3>
                                    <ul className="sources-list">
                                        {sources.map(source => (
                                            <li key={source.uri}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer">
                                                    {source.title || source.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


const HolidayCard = ({ holiday, trips, activities, onModalOpen, onDelete, onViewGuide }: { holiday: Holiday, trips: Trip[], activities: Activity[], onModalOpen: (state: ModalState) => void, onDelete: (id: string, type: EntryType) => void, onViewGuide: (holiday: Holiday) => void }) => {
  const holidayTrips = useMemo(() => trips.filter(t => t.holidayId === holiday.id), [trips, holiday.id]);
  
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation(); // Prevent card click when clicking on buttons
    action();
  };

  return (
    <div className="holiday-card-wrapper" onClick={() => onViewGuide(holiday)} title={`View guide for ${holiday.name}`}>
        <div className="holiday-card" style={{ borderLeftColor: holiday.color }}>
          <div className="card-header">
            <div>
                <h2>{holiday.name}</h2>
                <p className="dates">{formatDate(holiday.startDate)} - {formatDate(holiday.endDate)}</p>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
                <CardActions 
                    onEdit={() => onModalOpen({ mode: 'edit', type: 'holiday', data: holiday })} 
                    onDelete={() => onDelete(holiday.id, 'holiday')}
                />
            </div>
          </div>

          <Countdown startDate={holiday.startDate} endDate={holiday.endDate} />
          
          <div className="trip-section">
            <h3>Trips</h3>
            {holidayTrips.length > 0 ? (
                holidayTrips.map(trip => (
                    <TripCard 
                        key={trip.id} 
                        trip={trip}
                        activities={activities.filter(a => a.tripId === trip.id)}
                        onModalOpen={onModalOpen}
                        onDelete={onDelete}
                    />
                ))
            ) : <p className="no-items-text">No trips planned for this holiday.</p>}
            <button className="add-item-btn" onClick={(e) => handleActionClick(e, () => onModalOpen({ mode: 'add', type: 'trip', parentId: holiday.id }))}>+ Add Trip</button>
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <PackingAssistant holiday={holiday} />
          </div>
        </div>
    </div>
  );
};

const EventCard = ({ event, onModalOpen, onDelete }: { event: PlannerEvent, onModalOpen: (state: ModalState) => void, onDelete: (id: string, type: EntryType) => void }) => (
    <div className="event-card" style={{ borderLeftColor: event.color }}>
        <div className="card-header">
            <div>
                <h2>{event.name}</h2>
                <p className="dates">{formatDate(event.startDate)} - {formatDate(event.endDate)}</p>
            </div>
             <div className="card-header-right">
                <span className="event-category-badge">{event.category}</span>
                <CardActions 
                    onEdit={() => onModalOpen({ mode: 'edit', type: 'event', data: event })} 
                    onDelete={() => onDelete(event.id, 'event')}
                />
            </div>
        </div>
        <Countdown startDate={event.startDate} endDate={event.endDate} />
    </div>
);

const BirthdayCard = ({ event, onModalOpen, onDelete }: { event: PlannerEvent, onModalOpen: (state: ModalState) => void, onDelete: (id: string, type: EntryType) => void }) => {
    const { age, daysUntil, nextBirthday } = useMemo(() => {
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        
        const birthDate = new Date(event.startDate + 'T00:00:00Z');
        if (isNaN(birthDate.getTime())) return { age: null, daysUntil: null, nextBirthday: null };

        let upcomingAge = todayUTC.getUTCFullYear() - birthDate.getUTCFullYear();
        
        const nextBirthdayDate = new Date(Date.UTC(todayUTC.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate()));
        
        if (nextBirthdayDate < todayUTC) {
            nextBirthdayDate.setUTCFullYear(todayUTC.getUTCFullYear() + 1);
        } else {
            upcomingAge--;
        }
        
        const diffTime = nextBirthdayDate.getTime() - todayUTC.getTime();
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return { age: upcomingAge + 1, daysUntil: days, nextBirthday: nextBirthdayDate };
    }, [event.startDate]);


    return (
        <div className="birthday-card" style={{ borderLeftColor: event.color }}>
            <div className="card-header">
                <div>
                    <h2>{event.name}'s Birthday</h2>
                    <p className="dates">{formatDate(event.startDate)}</p>
                </div>
                 <CardActions 
                    onEdit={() => onModalOpen({ mode: 'edit', type: 'event', data: event })} 
                    onDelete={() => onDelete(event.id, 'event')}
                />
            </div>
            <div className="birthday-card-content">
                <div className="birthday-age-display">
                    {age !== null && (
                        <>
                            <span className="age-number">{age}</span>
                            <span className="age-label">years old</span>
                        </>
                    )}
                </div>
                <div className="countdown">
                    {daysUntil !== null ? (
                        <>
                            <span className="time-left">{daysUntil === 0 ? '🎉' : daysUntil}</span>
                            <span className="label">{daysUntil === 0 ? "Happy Birthday!" : `day${daysUntil !== 1 ? 's' : ''} to go`}</span>
                        </>
                    ) : <span className="label">Invalid Date</span>}
                </div>
            </div>
            {(event.giftIdeas || event.giftPrice) && (
                <div className="birthday-details">
                    <h4>Gift Ideas & Budget</h4>
                    <p>
                        {event.giftIdeas || 'No ideas yet.'}
                        {event.giftPrice && <strong> (Budget: ${event.giftPrice})</strong>}
                    </p>
                </div>
            )}
        </div>
    )
};

const ActivityCard = ({ activity, trip, holiday, onModalOpen, onDelete }: {
    activity: Activity,
    trip?: Trip,
    holiday?: Holiday,
    onModalOpen: (state: ModalState) => void,
    onDelete: (id: string, type: EntryType) => void
}) => (
    <div className="activity-card" style={{ borderLeftColor: trip?.color || '#888' }}>
        <div className="card-header">
            <div>
                <h4>{activity.name}</h4>
                <p className="dates">{formatDate(activity.date)}</p>
            </div>
            <CardActions
                onEdit={() => onModalOpen({ mode: 'edit', type: 'activity', data: activity })}
                onDelete={() => onDelete(activity.id, 'activity')}
            />
        </div>
        <div className="activity-card-context">
            {trip && <p><strong>Trip:</strong> {trip.name}</p>}
            {holiday && <p><strong>Holiday:</strong> {holiday.name}</p>}
        </div>
    </div>
);

const GoogleEventCard = ({ event }: { event: GoogleEvent }) => (
    <div className="google-event-card">
        <div className="google-event-card-header">
            <div>
                <h3>{event.summary}</h3>
                <p className="dates">{formatGoogleDate(event.start)}</p>
            </div>
            <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="action-btn">
                <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm280-280L400-480l280-280h-160v-80h240v240h-80v-160L480-400Z"/></svg>
            </a>
        </div>
        {event.description && <p className="card-description">{event.description}</p>}
    </div>
);

const GoogleAuthButton = ({ isSignedIn, user, onSignIn, onSignOut, disabled }: {
    isSignedIn: boolean,
    user: any | null,
    onSignIn: () => void,
    onSignOut: () => void,
    disabled: boolean,
}) => {
    if (isSignedIn && user) {
        return (
            <button onClick={onSignOut} className="google-auth-btn signed-in" title="Click to disconnect">
                <img src={user.picture} alt="Google user avatar" className="google-user-avatar" />
                <span>{user.email}</span>
            </button>
        );
    }

    return (
        <button onClick={onSignIn} className="google-auth-btn" disabled={disabled}>
            <svg enableBackground="new 0 0 48 48" height="24" viewBox="0 0 48 48" width="24" xmlns="http://www.w3.org/2000/svg"><g><path d="m43.611 20.083h-1.611v-.083h-18v8h11.303c-1.657 5.277-6.461 9-12.303 9-7.183 0-13-5.817-13-13s5.817-13 13-13c3.108 0 5.922 1.096 8.169 2.895l6.036-6.036c-3.433-3.137-7.98-5.052-13.205-5.052-11.706 0-21.282 9.576-21.282 21.282s9.576 21.282 21.282 21.282c11.199 0 20.37-8.875 21.222-19.917h.06v-1.365z" fill="#fbc02d"/></g><g><path d="m6.306 14.691c-2.344 3.469-3.71 7.699-3.71 12.309s1.366 8.84 3.71 12.309l7.343-5.698c-.65-1.92-1.033-4.032-1.033-6.28s.383-4.36 1.033-6.28l-7.343-5.698z" fill="#e53935"/></g><g><path d="m24 48c5.215 0 9.889-1.858 13.56-4.966l-6.84-6.84c-2.072 1.258-4.593 2.004-7.442 2.004-5.22 0-9.623-2.943-11.303-7h-7.343c2.731 5.421 8.261 9 14.625 9z" fill="#4caf50"/></g><g><path d="m44.389 28h-11.303c-1.657 5.277-6.461 9-12.303 9-2.849 0-5.37-0.746-7.442-2.004l-6.84 6.84c3.671 3.108 8.345 4.966 13.56 4.966 5.864 0 11.224-2.583 14.935-6.886z" fill="#1565c0"/></g></svg>
            <span>Connect Google Calendar</span>
        </button>
    );
};


const PLANNER_CATEGORIES = [
    {id: 'everything', label: 'Everything'},
    {id: 'holidays', label: 'Holidays'},
    {id: 'trips', label: 'Trips'},
    {id: 'activities', label: 'Activities'},
    {id: 'school', label: 'School'},
    {id: 'birthdays', label: 'Birthdays'},
    {id: 'work', label: 'Work/Projects'},
    {id: 'appointments', label: 'Appointments'},
    {id: 'events', label: 'Events'},
    {id: 'google', label: 'Google Calendar'},
];

const GoalsTracker = ({ goals, dispatch }: { goals: Goal[], dispatch: React.Dispatch<any>}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
    
    // State for the "Add Goal" form
    const [newGoalTitle, setNewGoalTitle] = useState('');
    const [newGoalCategory, setNewGoalCategory] = useState<GoalCategory['id']>('personal');

    const handleAddGoal = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGoalTitle.trim()) return;

        const newGoal: Partial<Goal> = {
            title: newGoalTitle.trim(),
            categoryId: newGoalCategory,
            isCompleted: false,
        };
        
        dispatch({
            type: 'SAVE_ENTRY',
            payload: { entry: newGoal, entryType: 'goal' }
        });

        setNewGoalTitle('');
    };
    
    const handleToggleCompletion = (id: string, currentStatus: boolean) => {
        dispatch({ type: 'TOGGLE_GOAL_COMPLETION', payload: { id, isCompleted: !currentStatus }});
    }

    const activeGoals = useMemo(() => goals.filter(g => !g.isCompleted), [goals]);
    
    // For the completed view
    const [completedYear, setCompletedYear] = useState(new Date().getFullYear());
    const completedGoals = useMemo(() => goals.filter(g => g.isCompleted && new Date(g.completionDate!).getUTCFullYear() === completedYear), [goals, completedYear]);
    
    // Summary data for achievement view
    const achievementSummary = useMemo(() => {
        const categoryCounts: Record<string, number> = {};
        initialGoalCategories.forEach(c => categoryCounts[c.id] = 0);
        
        completedGoals.forEach(g => {
            if (categoryCounts[g.categoryId] !== undefined) {
                categoryCounts[g.categoryId]++;
            }
        });

        const sortedCategories = Object.entries(categoryCounts)
            .map(([id, count]) => ({ id, name: initialGoalCategories.find(c => c.id === id)?.name, count }))
            .filter(c => c.count > 0)
            .sort((a,b) => b.count - a.count);

        return {
            total: completedGoals.length,
            byCategory: sortedCategories,
        };
    }, [completedGoals]);

    return (
        <section className="goals-tracker">
            <header className="goals-header" onClick={() => setIsCollapsed(!isCollapsed)}>
                <h3>Goals Tracker</h3>
                <span className={`collapse-chevron ${isCollapsed ? 'collapsed' : ''}`}>&#9660;</span>
            </header>
            {!isCollapsed && (
                <div className="goals-content">
                    <div className="goals-tabs">
                        <button onClick={() => setActiveTab('active')} className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}>Active</button>
                        <button onClick={() => setActiveTab('completed')} className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}>Completed</button>
                    </div>

                    {activeTab === 'active' && (
                        <div className="goals-view">
                            <form onSubmit={handleAddGoal} className="add-goal-form">
                                <input 
                                    type="text" 
                                    value={newGoalTitle}
                                    onChange={e => setNewGoalTitle(e.target.value)}
                                    placeholder="Add a new goal..."
                                    className="add-goal-input"
                                />
                                <select value={newGoalCategory} onChange={e => setNewGoalCategory(e.target.value as any)} className="add-goal-select">
                                    {initialGoalCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button type="submit" className="add-goal-btn">Add</button>
                            </form>
                            <ul className="goals-list">
                                {activeGoals.map(goal => (
                                    <li key={goal.id} className="goal-item">
                                        <input type="checkbox" id={`goal-${goal.id}`} checked={goal.isCompleted} onChange={() => handleToggleCompletion(goal.id, goal.isCompleted)} />
                                        <label htmlFor={`goal-${goal.id}`}>{goal.title}</label>
                                    </li>
                                ))}
                                {activeGoals.length === 0 && <p className="no-items-text">No active goals. Add one!</p>}
                            </ul>
                        </div>
                    )}
                    
                    {activeTab === 'completed' && (
                        <div className="goals-view">
                            <div className="completed-controls">
                                 <button onClick={() => setCompletedYear(y => y - 1)}>&lt;</button>
                                 <h4>Achievements for {completedYear}</h4>
                                 <button onClick={() => setCompletedYear(y => y + 1)}>&gt;</button>
                            </div>
                            <div className="achievements-summary">
                                <strong>Total Completed: {achievementSummary.total}</strong>
                                <div className="achievements-by-category">
                                    {achievementSummary.byCategory.map(cat => cat.count > 0 && (
                                        <span key={cat.id}>{cat.name}: {cat.count}</span>
                                    ))}
                                </div>
                            </div>
                            <ul className="goals-list">
                                {completedGoals.map(goal => (
                                     <li key={goal.id} className="goal-item completed">
                                         <input type="checkbox" checked={goal.isCompleted} onChange={() => handleToggleCompletion(goal.id, goal.isCompleted)} />
                                         <label>{goal.title}</label>
                                         <span className="goal-completion-date">{formatDate(goal.completionDate)}</span>
                                     </li>
                                ))}
                                 {completedGoals.length === 0 && <p className="no-items-text">No goals completed in {completedYear}.</p>}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

const VacationRecommender = ({ wishlistData }: { wishlistData: WishlistData }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [recommendations, setRecommendations] = useState<VacationRecommendation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<BudgetCategory['id']>('travel');

    const fetchRecommendations = async () => {
        setIsLoading(true);
        setError(null);
        setRecommendations([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const relevantItems = wishlistData.items.filter(
                item => item.categoryId === selectedCategory && item.status === 'active'
            );
            const categoryName = initialCategories.find(c => c.id === selectedCategory)?.name || 'your wishlist';

            let prompt: string;

            if (relevantItems.length > 0) {
                const destinations = relevantItems.map(item => item.name).join(', ');
                prompt = `I have a wishlist of ${categoryName} items: ${destinations}.
For each of these locations/items, please provide a brief, compelling description and the ideal time to visit/do it.
If an item is not a real place, you can ignore it.
Keep the response focused on the provided list.`;
            } else {
                const currentMonth = new Date().toLocaleString('default', { month: 'long' });
                let fallbackPromptType = 'vacation destinations';
                if (selectedCategory !== 'travel') {
                    fallbackPromptType = `ideas related to ${categoryName}`;
                }
                prompt = `Based on the current time of year (it is currently ${currentMonth}), recommend 3 ${fallbackPromptType} suitable for someone in Central Europe.`;
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        description: "A list of vacation recommendations.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                location: { type: Type.STRING, description: "The name of the vacation spot." },
                                description: { type: Type.STRING, description: "A brief, compelling description." },
                                bestTimeToVisit: { type: Type.STRING, description: "The ideal time to visit this location." },
                            },
                            required: ['location', 'description', 'bestTimeToVisit']
                        }
                    }
                }
            });

            const parsedResponse = JSON.parse(response.text);
            setRecommendations(parsedResponse);

        } catch (err) {
            console.error("Error fetching vacation recommendations:", err);
            setError("Failed to fetch recommendations. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const categoryName = useMemo(() => 
        initialCategories.find(c => c.id === selectedCategory)?.name || 'Destinations', 
    [selectedCategory]);

    return (
        <section className="ai-feature-section">
            <h3 className="ai-feature-header" onClick={() => setIsCollapsed(p => !p)}>
                ✨ AI Recommender
                <span className={`collapse-chevron ${isCollapsed ? 'collapsed' : ''}`}>&#9660;</span>
            </h3>
            {!isCollapsed && (
                <div className="ai-feature-content">
                    <p>Get AI-powered suggestions based on your active wishlist items!</p>
                    <div className="ai-recommender-controls">
                        <label htmlFor="recommender-category">Category:</label>
                        <select
                            id="recommender-category"
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value as BudgetCategory['id'])}
                            disabled={isLoading}
                        >
                            {initialCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <button className="add-holiday-btn" onClick={fetchRecommendations} disabled={isLoading}>
                        {isLoading ? 'Thinking...' : `Suggest ${categoryName} Ideas`}
                    </button>
                    {isLoading && <div className="loading-spinner"></div>}
                    {error && <p className="error-message">{error}</p>}
                    {recommendations.length > 0 && (
                        <div className="recommendation-grid">
                            {recommendations.map((rec, index) => (
                                <div key={index} className="recommendation-card">
                                    <h4>{rec.location}</h4>
                                    <p>{rec.description}</p>
                                    <p><strong>Best time to visit:</strong> {rec.bestTimeToVisit}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};


export const PlannerView = ({ plannerData, dispatch, wishlistData, setWishlistData, isGoogleSignedIn, googleUser, googleEvents, onGoogleSignIn, onGoogleSignOut, isGoogleApiReady, isGoogleConfigured, onViewGuide }: { 
    plannerData: AppData, 
    dispatch: React.Dispatch<any>, 
    wishlistData: WishlistData, 
    setWishlistData: React.Dispatch<React.SetStateAction<WishlistData>>,
    isGoogleSignedIn: boolean,
    googleUser: any | null,
    googleEvents: GoogleEvent[],
    onGoogleSignIn: () => void,
    onGoogleSignOut: () => void,
    isGoogleApiReady: boolean,
    isGoogleConfigured: boolean,
    onViewGuide: (holiday: Holiday) => void,
}) => {
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [activeFilter, setActiveFilter] = useState('everything');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addBtnRef = useRef<HTMLDivElement>(null);
  const [isFetchingHolidays, setIsFetchingHolidays] = useState(false);

  const fetchHolidays = useCallback(async () => {
    setIsFetchingHolidays(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currentYear = new Date().getFullYear();
      
      const prompt = `Using Google Search, find the official school holidays (Schulferien) for Kanton Zug, Switzerland.
You must use the official dates published by the canton's education authority.
Provide the data for the entire calendar years from January 1st to December 31st for the following years: ${currentYear}, ${currentYear + 1}, and ${currentYear + 2}.
Ensure you include all holidays within these full calendar years, even those that have already passed in the current year.

Return ONLY a valid JSON array that can be parsed directly. Each object in the array must contain these three properties:
- "name": The German name of the holiday (e.g., 'Frühlingsferien').
- "startDate": The first day of the holiday in "YYYY-MM-DD" format.
- "endDate": The last day of the holiday in "YYYY-MM-DD" format.

Example of a valid response:
[
  {
    "name": "Sportferien 2025",
    "startDate": "2025-02-24",
    "endDate": "2025-03-07"
  }
]
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        }
      });

      let jsonText = response.text.trim();
      
      const jsonMatch = jsonText.match(/\`\`\`json\n(.+?)\n\`\`\`/s);
      if (jsonMatch && jsonMatch[1]) {
          jsonText = jsonMatch[1];
      }
      
      const holidays = JSON.parse(jsonText);

      if (!Array.isArray(holidays)) {
        throw new Error("Invalid response format from AI. Expected an array.");
      }

      let addedCount = 0;
      holidays.forEach(holiday => {
        if (holiday.name && holiday.startDate && holiday.endDate && /^\d{4}-\d{2}-\d{2}$/.test(holiday.startDate)) {
          const newEvent: Omit<PlannerEvent, 'id'> = {
              name: holiday.name,
              startDate: holiday.startDate,
              endDate: holiday.endDate,
              category: 'school',
              color: '#f1c40f', // Yellow for school
          };

          const isDuplicate = plannerData.events.some(e => e.name === newEvent.name && e.startDate === newEvent.startDate);

          if (!isDuplicate) {
              addedCount++;
              dispatch({
                  type: 'SAVE_ENTRY',
                  payload: { entry: { ...newEvent, id: `event-ai-${crypto.randomUUID()}` }, entryType: 'event' }
              });
          }
        }
      });
      
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      let sourcesText = "";
      if (groundingMetadata?.groundingChunks) {
          const uris = groundingMetadata.groundingChunks
              .map((chunk: any) => chunk.web?.uri)
              .filter(Boolean);
          if (uris.length > 0) {
              sourcesText = `\n\nSources:\n${[...new Set(uris)].join('\n')}`;
          }
      }

      alert(`Successfully added ${addedCount} new school holidays.${sourcesText}`);
    } catch (error) {
      console.error("Error fetching school holidays:", error);
      alert("Failed to fetch or parse school holidays. The AI may have returned an unexpected format. Please check the console for details.");
    } finally {
      setIsFetchingHolidays(false);
    }
  }, [dispatch, plannerData.events]);


  const handleSave: HandleSave = useCallback((entryData, type, id) => {
    // Birthday gift side-effect
    if (type === 'event' && 'category' in entryData && entryData.category === 'birthday' && 'giftPrice' in entryData && entryData.giftPrice && entryData.giftPrice > 0) {
        setWishlistData(prev => {
            let giftsList = prev.lists.find(l => l.name === 'Gifts');
            if (!giftsList) {
                // This case should be handled by the initial state creator, but as a fallback:
                giftsList = { id: `wishlist-default-gifts`, name: 'Gifts' };
            }
            
            const newWishlistItem: WishlistItem = {
                id: `wishitem-gift-${crypto.randomUUID()}`,
                listId: giftsList.id,
                name: (entryData as PlannerEvent).giftIdeas || `Gift for ${entryData.name}`,
                priority: 'medium',
                categoryId: 'gifts',
                estimatedCost: (entryData as PlannerEvent).giftPrice,
                status: 'active'
            };

            // Avoid adding duplicates if editing
            if(id && prev.items.some(item => item.name === newWishlistItem.name)) {
                return prev;
            }

            return {
                ...prev,
                items: [...prev.items, newWishlistItem]
            };
        });
    }

    const entry = {
        ...entryData,
        id: id || `${type}-${crypto.randomUUID()}`
    };
    dispatch({ type: 'SAVE_ENTRY', payload: { entry: entry as Entry, entryType: type } });
    setModalState(null);
  }, [dispatch, setWishlistData]);
  
  const handleDelete = useCallback((id: string, type: EntryType) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
        dispatch({ type: 'DELETE_ENTRY', payload: { id, entryType: type } });
    }
  }, [dispatch]);

  const handleAddItem = (type: 'holiday' | 'event') => {
      setModalState({ mode: 'add', type });
      setIsAddMenuOpen(false);
  };

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (addBtnRef.current && !addBtnRef.current.contains(event.target as Node)) {
              setIsAddMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderFilteredContent = () => {
      const { holidays, trips, activities, events } = plannerData;

      switch(activeFilter) {
          case 'holidays':
              const sortedHolidays = [...holidays].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
              return sortedHolidays.length > 0 ? (
                  sortedHolidays.map(holiday => <HolidayCard key={holiday.id} holiday={holiday} trips={trips} activities={activities} onModalOpen={setModalState} onDelete={handleDelete} onViewGuide={onViewGuide} />)
              ) : <p className="no-items-text">No holidays planned.</p>;
          
          case 'trips':
              const sortedTrips = [...trips].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
              return sortedTrips.length > 0 ? (
                  <div className="card-list">
                      {sortedTrips.map(trip => <TripCard key={trip.id} trip={trip} activities={activities.filter(a => a.tripId === trip.id)} onModalOpen={setModalState} onDelete={handleDelete} />)}
                  </div>
              ) : <p className="no-items-text">No trips planned.</p>;
          
          case 'activities':
              const sortedActivities = [...activities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              return sortedActivities.length > 0 ? (
                  <div className="card-list">
                      {sortedActivities.map(activity => {
                          const trip = trips.find(t => t.id === activity.tripId);
                          const holiday = holidays.find(h => h.id === trip?.holidayId);
                          return <ActivityCard key={activity.id} activity={activity} trip={trip} holiday={holiday} onModalOpen={setModalState} onDelete={handleDelete} />;
                      })}
                  </div>
              ) : <p className="no-items-text">No activities planned.</p>;

          case 'school':
          case 'work':
          case 'appointments':
          case 'events':
              const categoryMapEvents = {
                  'school': 'school', 'work': 'work', 'appointments': 'appointment', 'events': 'event',
              };
              const mappedCategoryEvents = categoryMapEvents[activeFilter as keyof typeof categoryMapEvents];

              const filteredRegularEvents = events.filter(e => e.category === mappedCategoryEvents).sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
              return filteredRegularEvents.length > 0 ? (
                  <div className="card-list">
                      {filteredRegularEvents.map(event => <EventCard key={event.id} event={event} onModalOpen={setModalState} onDelete={handleDelete} />)}
                  </div>
              ) : <p className="no-items-text">No items found for this category.</p>;

            case 'birthdays':
                const birthdayEvents = events.filter(e => e.category === 'birthday').sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
                return birthdayEvents.length > 0 ? (
                    <div className="card-list">
                        {birthdayEvents.map(event => <BirthdayCard key={event.id} event={event} onModalOpen={setModalState} onDelete={handleDelete} />)}
                    </div>
                ) : <p className="no-items-text">No birthdays saved.</p>;

            case 'google':
                 return googleEvents.length > 0 ? (
                    <div className="card-list">
                        {googleEvents.map(event => <GoogleEventCard key={event.id} event={event} />)}
                    </div>
                ) : <p className="no-items-text">No upcoming Google Calendar events found.</p>;


          case 'everything':
          default:
              const allItems = [
                  ...holidays.map(h => ({ ...h, type: 'holiday' as const, date: h.startDate })),
                  ...events.map(e => ({ ...e, type: 'event' as const, date: e.startDate })),
                  ...googleEvents.map(g => ({ ...g, type: 'google' as const, date: g.start.dateTime || g.start.date! }))
              ].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

              return allItems.length > 0 ? (
                  <div className="card-list">
                      {allItems.map(item => {
                          if (item.type === 'holiday') {
                               return <HolidayCard key={item.id} holiday={item} trips={trips} activities={activities} onModalOpen={setModalState} onDelete={handleDelete} onViewGuide={onViewGuide} />;
                          }
                          if (item.type === 'event') {
                               if (item.category === 'birthday') {
                                   return <BirthdayCard key={item.id} event={item} onModalOpen={setModalState} onDelete={handleDelete} />;
                               }
                               return <EventCard key={item.id} event={item} onModalOpen={setModalState} onDelete={handleDelete} />;
                          }
                          if (item.type === 'google') {
                              return <GoogleEventCard key={item.id} event={item} />;
                          }
                          return null;
                      })}
                  </div>
              ) : (
                  <div className="no-holidays">
                      <h2>No events planned yet.</h2>
                      <p>Click the "+ Add Item" button to get started!</p>
                  </div>
              );
      }
  }

  return (
    <>
      <header>
        <h2>Planner</h2>
        <div className="header-actions-group">
            {isGoogleConfigured && <GoogleAuthButton isSignedIn={isGoogleSignedIn} user={googleUser} onSignIn={onGoogleSignIn} onSignOut={onGoogleSignOut} disabled={!isGoogleApiReady} />}
            <button
              className="add-holiday-btn"
              onClick={fetchHolidays}
              disabled={isFetchingHolidays}
              aria-live="polite"
            >
                {isFetchingHolidays ? 'Fetching...' : '✨ AI Fetch School Holidays'}
            </button>
            <div className="add-item-dropdown" ref={addBtnRef}>
                <button className="add-holiday-btn" onClick={() => setIsAddMenuOpen(p => !p)}>
                  + Add Item &#9662;
                </button>
                {isAddMenuOpen && (
                    <div className="add-item-menu">
                        <button onClick={() => handleAddItem('holiday')}>Holiday</button>
                        <button onClick={() => handleAddItem('event')}>Other Event</button>
                    </div>
                )}
            </div>
        </div>
      </header>

      <VacationRecommender wishlistData={wishlistData} />

      <div className="planner-filter-bar">
          {PLANNER_CATEGORIES.map(cat => (
              (cat.id !== 'google' || isGoogleConfigured) && (
                <button key={cat.id} className={`filter-btn ${activeFilter === cat.id ? 'active' : ''}`} onClick={() => setActiveFilter(cat.id)}>
                    {cat.label}
                </button>
              )
          ))}
      </div>

       <MiniCalendar 
            holidays={plannerData.holidays} 
            trips={plannerData.trips} 
            activities={plannerData.activities} 
            events={plannerData.events} 
            goals={plannerData.goals}
            googleEvents={googleEvents}
            activeFilter={activeFilter} 
        />

       <GoalsTracker goals={plannerData.goals} dispatch={dispatch} />
      
      <main>
          {renderFilteredContent()}
      </main>

      {modalState && (
        <EntryFormModal
          modalState={modalState}
          onSave={handleSave}
          onCancel={() => setModalState(null)}
        />
      )}
    </>
  );
}