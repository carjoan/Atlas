/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useCallback } from 'react';
import type { AppData, TodoData, TodoProject, TodoTask, Holiday, Trip, GoogleEvent } from './types';
import { MiniCalendar } from './index';

// --- TYPE DEFINITIONS ---
type FilterStatus = 'all' | 'not-started' | 'in-progress' | 'completed';
type FilterPriority = 'all' | 'low' | 'medium' | 'high';
type SortKey = 'priority' | 'deadline';

interface TodoModalState {
    mode: 'addProject' | 'editProject' | 'addTask';
    project?: TodoProject;
    projectId?: string; // for adding tasks
}

// --- HELPER FUNCTIONS ---
const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    });
};

const getEventName = (id: string, plannerData: AppData) => {
    const event = [...plannerData.holidays, ...plannerData.trips].find(e => e.id === id);
    return event ? `🔗 ${event.name}` : 'No Linked Event';
};


// --- MODAL COMPONENT ---
const TodoFormModal = ({ modalState, onSave, onCancel, plannerData }: {
    modalState: TodoModalState;
    onSave: (data: any) => void;
    onCancel: () => void;
    plannerData: AppData;
}) => {
    const [name, setName] = useState('');
    const [status, setStatus] = useState<TodoProject['status']>('not-started');
    const [priority, setPriority] = useState<TodoProject['priority']>('medium');
    const [deadline, setDeadline] = useState('');
    const [linkedEventId, setLinkedEventId] = useState('');
    const [dueDate, setDueDate] = useState('');

    React.useEffect(() => {
        if (modalState.mode === 'editProject' && modalState.project) {
            const { project } = modalState;
            setName(project.name);
            setStatus(project.status);
            setPriority(project.priority);
            setDeadline(project.deadline || '');
            setLinkedEventId(project.linkedEventId || '');
        } else {
            setName('');
            setStatus('not-started');
            setPriority('medium');
            setDeadline('');
            setLinkedEventId('');
            setDueDate('');
        }
    }, [modalState]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (modalState.mode === 'addTask') {
            onSave({ name, dueDate: dueDate || undefined });
        } else {
            onSave({ name, status, priority, deadline: deadline || undefined, linkedEventId: linkedEventId || undefined });
        }
    };
    
    const title = modalState.mode === 'addTask' ? 'Add New Task' : modalState.mode === 'editProject' ? 'Edit Project' : 'Add New Project';
    
    const linkedEvents = useMemo(() => {
        const holidays: (Holiday | Trip)[] = plannerData.holidays;
        const trips: (Holiday | Trip)[] = plannerData.trips;
        return [...holidays, ...trips].sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [plannerData]);

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{title}</h2>
                <form onSubmit={handleSubmit}>
                    {modalState.mode === 'addTask' ? (
                         <>
                            <div className="form-group">
                                <label htmlFor="taskName">Task Name</label>
                                <input id="taskName" type="text" value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                             <div className="form-group">
                                <label htmlFor="taskDueDate">Due Date (Optional)</label>
                                <input id="taskDueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-group">
                                <label htmlFor="projectName">Project Name</label>
                                <input id="projectName" type="text" value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                             <div className="form-group">
                                <label htmlFor="projectStatus">Status</label>
                                <select id="projectStatus" value={status} onChange={e => setStatus(e.target.value as any)}>
                                    <option value="not-started">Not Started</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="projectPriority">Priority</label>
                                <select id="projectPriority" value={priority} onChange={e => setPriority(e.target.value as any)}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                             <div className="form-group">
                                <label htmlFor="projectDeadline">Deadline (Optional)</label>
                                <input id="projectDeadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="projectLinkedEvent">Linked Event (Optional)</label>
                                <select id="projectLinkedEvent" value={linkedEventId} onChange={e => setLinkedEventId(e.target.value)}>
                                    <option value="">None</option>
                                    {linkedEvents.map(event => (
                                        <option key={event.id} value={event.id}>
                                            {event.name} ({'holidayId' in event ? 'Trip' : 'Holiday'})
                                        </option>
                                    ))}
                                </select>
                            </div>
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


// --- PROJECT & TASK COMPONENTS ---
const ProjectCard = ({ project, tasks, onUpdate, onDelete, onModalOpen, plannerData }: {
    project: TodoProject,
    tasks: TodoTask[],
    onUpdate: (data: any, type: 'project' | 'task', id: string) => void,
    onDelete: (id: string, type: 'project' | 'task') => void,
    onModalOpen: (state: TodoModalState) => void,
    plannerData: AppData,
}) => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const handleToggleTask = (task: TodoTask) => {
        onUpdate({ ...task, completed: !task.completed }, 'task', task.id);
    };
    
    return (
        <div className="project-card">
            <div className="project-card-header">
                <div>
                    <h3>{project.name}</h3>
                     <div className="project-tags">
                        <span className={`project-tag status-${project.status}`}>{project.status.replace('-', ' ')}</span>
                        <span className={`project-tag priority-${project.priority}`}>{project.priority}</span>
                    </div>
                </div>
                <div className="card-actions">
                    <button type="button" onClick={() => onModalOpen({ mode: 'editProject', project })} className="action-btn-sm" aria-label="Edit Project">
                        <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor"><path d="M200-200h56l345-345-56-56-345 345v56Zm572-403L602-771l56-56q23-23 56.5-23t56.5 23l56 56q23 23 23 56.5T829-663l-57 56Z"/></svg>
                    </button>
                    <button type="button" onClick={() => onDelete(project.id, 'project')} className="action-btn-sm" aria-label="Delete Project">
                         <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520Z"/></svg>
                    </button>
                </div>
            </div>
            
            <div className="project-details">
                <p>Deadline: {formatDate(project.deadline)}</p>
                <p>{getEventName(project.linkedEventId || '', plannerData)}</p>
            </div>

            <div className="project-progress">
                <label>Progress ({completedTasks}/{totalTasks})</label>
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progress}%`, backgroundColor: 'var(--secondary-color)' }}></div>
                </div>
            </div>

            <div className="project-tasks">
                <h4>Tasks</h4>
                {tasks.length > 0 ? (
                    <ul className="task-list">
                        {tasks.map(task => (
                            <li key={task.id} className="task-item">
                                <input type="checkbox" id={`task-${task.id}`} checked={task.completed} onChange={() => handleToggleTask(task)} />
                                <label htmlFor={`task-${task.id}`} className={task.completed ? 'completed' : ''}>{task.name}</label>
                                <span className="task-due-date">{formatDate(task.dueDate)}</span>
                            </li>
                        ))}
                    </ul>
                ) : <p className="no-items-text">No tasks yet.</p>}
                 <button className="add-item-btn" onClick={() => onModalOpen({ mode: 'addTask', projectId: project.id })}>+ Add Task</button>
            </div>
        </div>
    );
};

// --- MAIN VIEW COMPONENT ---
export const TodoView = ({ todoData, setTodoData, plannerData, googleEvents }: {
    todoData: TodoData,
    setTodoData: React.Dispatch<React.SetStateAction<TodoData>>,
    plannerData: AppData,
    googleEvents: GoogleEvent[]
}) => {
    const [modalState, setModalState] = useState<TodoModalState | null>(null);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
    const [sort, setSort] = useState<SortKey>('priority');

    const handleSave = useCallback((data: any) => {
        if (!modalState) return;

        if (modalState.mode === 'addProject') {
            const newProject: TodoProject = { ...data, id: `proj-${crypto.randomUUID()}`};
            setTodoData(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
        }
        else if (modalState.mode === 'editProject' && modalState.project) {
            setTodoData(prev => ({
                ...prev,
                projects: prev.projects.map(p => p.id === modalState.project!.id ? { ...p, ...data } : p)
            }));
        }
        else if (modalState.mode === 'addTask' && modalState.projectId) {
            const newTask: TodoTask = { ...data, id: `task-${crypto.randomUUID()}`, projectId: modalState.projectId, completed: false };
            setTodoData(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
        }

        setModalState(null);
    }, [modalState, setTodoData]);

    const handleUpdate = useCallback((data: any, type: 'project' | 'task', id: string) => {
        setTodoData(prev => {
            if (type === 'project') {
                return { ...prev, projects: prev.projects.map(p => p.id === id ? data : p) };
            }
            return { ...prev, tasks: prev.tasks.map(t => t.id === id ? data : t) };
        });
    }, [setTodoData]);

    const handleDelete = useCallback((id: string, type: 'project' | 'task') => {
        if (type === 'project') {
             if (window.confirm('Are you sure you want to delete this project and all its tasks?')) {
                setTodoData(prev => ({
                    projects: prev.projects.filter(p => p.id !== id),
                    tasks: prev.tasks.filter(t => t.projectId !== id)
                }));
             }
        } else {
            setTodoData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
        }
    }, [setTodoData]);

    const sortedAndFilteredProjects = useMemo(() => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return todoData.projects
            .filter(p => filterStatus === 'all' || p.status === filterStatus)
            .filter(p => filterPriority === 'all' || p.priority === filterPriority)
            .sort((a, b) => {
                if (sort === 'deadline') {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                }
                // Default to priority sort
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });
    }, [todoData.projects, filterStatus, filterPriority, sort]);

    return (
        <>
            <header>
                <h2>Todo List</h2>
                <button className="add-holiday-btn" onClick={() => setModalState({ mode: 'addProject' })}>+ Add Project</button>
            </header>
            <MiniCalendar
                holidays={plannerData.holidays}
                trips={plannerData.trips}
                activities={plannerData.activities}
                events={plannerData.events}
                goals={plannerData.goals}
                googleEvents={googleEvents}
                activeFilter={'everything'}
            />
            <main>
                <div className="todo-controls">
                    <div className="filter-sort-controls">
                        <div className="control-group">
                            <label>Status:</label>
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                                <option value="all">All</option>
                                <option value="not-started">Not Started</option>
                                <option value="in-progress">In Progress</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        <div className="control-group">
                            <label>Priority:</label>
                             <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as any)}>
                                <option value="all">All</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div className="control-group">
                            <label>Sort by:</label>
                            <select value={sort} onChange={e => setSort(e.target.value as any)}>
                                <option value="priority">Priority</option>
                                <option value="deadline">Deadline</option>
                            </select>
                        </div>
                    </div>
                </div>

                {todoData.projects.length > 0 ? (
                    <div className="projects-grid">
                        {sortedAndFilteredProjects.map(project => (
                            <ProjectCard 
                                key={project.id}
                                project={project}
                                tasks={todoData.tasks.filter(t => t.projectId === project.id)}
                                onUpdate={handleUpdate}
                                onDelete={handleDelete}
                                onModalOpen={setModalState}
                                plannerData={plannerData}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="no-holidays"> {/* Reusing style */}
                        <h2>No projects created yet.</h2>
                        <p>Click "+ Add Project" to get started.</p>
                    </div>
                )}
            </main>
            {modalState && (
                <TodoFormModal 
                    modalState={modalState}
                    onSave={handleSave}
                    onCancel={() => setModalState(null)}
                    plannerData={plannerData}
                />
            )}
        </>
    )
};
