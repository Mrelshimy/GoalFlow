
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Task, TaskList, Goal } from '../types';
import { Plus, Check, Trash2, ChevronDown, ChevronUp, Calendar, AlignLeft, List, Target, Link as LinkIcon, X, Upload, FileJson, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../App';

const Tasks: React.FC = () => {
  const { user } = useAuth();
  
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [activeListId, setActiveListId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  
  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importStats, setImportStats] = useState({ lists: 0, tasks: 0 });

  useEffect(() => {
    const init = async () => {
        const [lists, g] = await Promise.all([db.getTaskLists(), db.getGoals()]);
        setTaskLists(lists);
        setGoals(g);
        if (lists.length > 0) setActiveListId(lists[0].id);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeListId) refreshTasks();
  }, [activeListId]);

  const refreshTasks = async () => {
      const allTasks = await db.getTasks();
      const listTasks = allTasks.filter(t => t.listId === activeListId);
      setTasks(listTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    const newList: TaskList = {
        id: crypto.randomUUID(),
        userId: user?.id || '',
        title: newListName,
    };
    await db.saveTaskList(newList);
    const lists = await db.getTaskLists();
    setTaskLists(lists);
    setActiveListId(newList.id);
    setNewListName('');
    setIsCreatingList(false);
  };

  const handleDeleteList = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await db.deleteTaskList(id);
      const remaining = await db.getTaskLists();
      setTaskLists(remaining);
      if (remaining.length > 0) setActiveListId(remaining[0].id);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeListId) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      userId: user?.id || '',
      listId: activeListId,
      title: newTaskTitle,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await db.saveTask(newTask);
    setNewTaskTitle('');
    refreshTasks();
  };

  const handleToggleStatus = async (task: Task) => {
    const updatedTask: Task = {
      ...task,
      status: task.status === 'pending' ? 'completed' : 'pending',
      completedAt: task.status === 'pending' ? new Date().toISOString() : undefined
    };
    await db.saveTask(updatedTask);
    refreshTasks();
  };

  const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.deleteTask(id);
    refreshTasks();
    if (activeTaskId === id) setActiveTaskId(null);
  };

  const handleUpdateTask = async (updatedTask: Task) => {
      await db.saveTask(updatedTask);
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const resetImportState = () => {
      setIsImportModalOpen(true);
      setIsImporting(false);
      setImportProgress(0);
      setImportStatus('');
      setImportSuccess(false);
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Reading file...');
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const content = event.target?.result as string;
            setImportStatus('Parsing JSON...');
            
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (e) {
                throw new Error("Invalid JSON file");
            }

            // --- Robust Parsing Logic ---
            // Google Takeout JSON structure can vary.
            // Case 1: Root object with "items" array (standard API-like response)
            // Case 2: Root array of TaskList objects
            // Case 3: Root array of Task objects (single list export)
            
            let rawLists = [];
            if (Array.isArray(parsed)) {
                rawLists = parsed;
            } else if (parsed.items && Array.isArray(parsed.items)) {
                rawLists = parsed.items;
            } else {
                // If it's a single object, wrap it
                rawLists = [parsed];
            }

            // Determine if these are Lists or Tasks
            // A List usually has 'kind': 'tasks#taskList' OR contains 'items' array
            // A Task usually has 'kind': 'tasks#task' OR 'status'
            const isCollectionOfLists = rawLists.some((item: any) => 
                (item.items && Array.isArray(item.items)) || 
                item.kind === 'tasks#taskList'
            );

            let listsToProcess: any[] = [];
            let totalTasksToImport = 0;

            if (isCollectionOfLists) {
                listsToProcess = rawLists;
            } else {
                // Treat as a single list of tasks
                const listName = file.name.replace(/\.json$/i, '') || 'Imported Tasks';
                listsToProcess = [{
                    title: listName,
                    items: rawLists // The raw array is the tasks
                }];
            }

            // Pre-calculate total for progress bar
            listsToProcess.forEach(l => {
                if (l.items && Array.isArray(l.items)) {
                    totalTasksToImport += l.items.length;
                }
            });

            if (listsToProcess.length === 0 && totalTasksToImport === 0) {
                 throw new Error("No valid lists or tasks found to import.");
            }

            setImportStatus(`Found ${listsToProcess.length} lists and ${totalTasksToImport} tasks...`);

            let processedTasks = 0;
            let processedLists = 0;

            for (const listData of listsToProcess) {
                // Valid list should usually have a title or we give it one
                const title = listData.title || `Imported List ${processedLists + 1}`;
                
                // Create List in DB
                const newList = { id: crypto.randomUUID(), userId: user?.id || '', title: title };
                await db.saveTaskList(newList);
                processedLists++;

                // Import Tasks for this list
                if (listData.items && Array.isArray(listData.items)) {
                    for (const t of listData.items) {
                        await importSingleTask(t, newList.id);
                        processedTasks++;
                        
                        // Update Progress
                        const currentProgress = totalTasksToImport > 0 
                            ? Math.round((processedTasks / totalTasksToImport) * 100) 
                            : 100;
                        
                        setImportProgress(currentProgress);
                        setImportStatus(`Importing ${title} (${processedTasks}/${totalTasksToImport})...`);
                    }
                }
            }

            setImportStats({ lists: processedLists, tasks: processedTasks });
            setImportSuccess(true);
            setImportStatus('Import Complete!');
            
            // Refresh Data
            const updatedLists = await db.getTaskLists();
            setTaskLists(updatedLists);
            refreshTasks();
            if (!activeListId && updatedLists.length > 0) setActiveListId(updatedLists[0].id);

        } catch (error: any) {
            console.error(error);
            setImportStatus(`Error: ${error.message || 'Failed to parse file'}`);
            setIsImporting(false); 
        }
    };
    reader.readAsText(file);
  };

  const importSingleTask = async (t: any, listId: string) => {
      // Basic validation: needs a title
      if (!t.title) return;
      
      const isCompleted = t.status === 'completed';
      const newTask: Task = {
          id: crypto.randomUUID(),
          userId: user?.id || '',
          listId: listId,
          title: t.title,
          details: t.notes || '',
          dueDate: t.due ? new Date(t.due).toISOString().split('T')[0] : undefined,
          status: isCompleted ? 'completed' : 'pending',
          completedAt: isCompleted ? (t.completed ? new Date(t.completed).toISOString() : new Date().toISOString()) : undefined,
          createdAt: t.updated ? new Date(t.updated).toISOString() : new Date().toISOString()
      };
      await db.saveTask(newTask);
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const activeList = taskLists.find(l => l.id === activeListId);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] gap-6 pb-20 md:pb-0">
        <div className="w-full md:w-64 flex-shrink-0 bg-white md:bg-transparent rounded-xl md:rounded-none border md:border-none p-4 md:p-0">
            <div className="flex justify-between items-center mb-4 px-2">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-gray-700">My Lists</h2>
                    <button onClick={resetImportState} className="text-gray-400 hover:text-primary p-1 rounded transition-colors" title="Import Google Tasks JSON"><Upload size={16} /></button>
                </div>
                <button onClick={() => setIsCreatingList(!isCreatingList)} className="text-primary hover:bg-blue-50 p-1 rounded transition-colors"><Plus size={18} /></button>
            </div>

            {isCreatingList && (
                <form onSubmit={handleCreateList} className="mb-4 px-2">
                    <input autoFocus type="text" value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="List name..." className="w-full border rounded px-2 py-1 text-sm mb-1" />
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setIsCreatingList(false)} className="text-xs text-gray-500">Cancel</button>
                        <button type="submit" className="text-xs text-primary font-medium">Create</button>
                    </div>
                </form>
            )}

            <ul className="space-y-1">
                {taskLists.map(list => (
                    <li key={list.id} className="group flex items-center justify-between">
                        <button onClick={() => setActiveListId(list.id)} className={`flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeListId === list.id ? 'bg-white text-primary shadow-sm border border-gray-100' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <List size={16} />
                            {list.title}
                        </button>
                        {!list.isDefault && (
                             <button onClick={(e) => handleDeleteList(list.id, e)} type="button" className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                        )}
                    </li>
                ))}
            </ul>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden h-full relative">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-800">{activeList?.title || 'Tasks'}</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <form onSubmit={handleAddTask} className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-50 text-primary rounded-full"><Plus size={20} /></div>
                    <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Add a task..." className="flex-1 outline-none text-gray-700 placeholder-gray-400 bg-transparent text-lg" />
                    {newTaskTitle && <button type="submit" className="text-sm font-medium text-primary hover:text-blue-700">Add</button>}
                </form>

                <div className="space-y-1">
                    {pendingTasks.map(task => (
                        <TaskItem key={task.id} task={task} goals={goals} isActive={activeTaskId === task.id} onToggle={() => handleToggleStatus(task)} onClick={() => setActiveTaskId(activeTaskId === task.id ? null : task.id)} onDelete={(e) => handleDeleteTask(task.id, e)} onUpdate={handleUpdateTask} />
                    ))}
                </div>

                {completedTasks.length > 0 && (
                    <div className="mt-8">
                        <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-2 text-gray-500 font-medium hover:text-gray-700 mb-4">
                            {showCompleted ? <ChevronUp size={18} /> : <ChevronDown size={18} />} Completed ({completedTasks.length})
                        </button>
                        {showCompleted && (
                            <div className="space-y-1 animate-fade-in">
                                {completedTasks.map(task => (
                                    <TaskItem key={task.id} task={task} goals={goals} isActive={activeTaskId === task.id} onToggle={() => handleToggleStatus(task)} onClick={() => setActiveTaskId(activeTaskId === task.id ? null : task.id)} onDelete={(e) => handleDeleteTask(task.id, e)} onUpdate={handleUpdateTask} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isImportModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-gray-800">Import Google Tasks</h3>
                            {!isImporting && !importSuccess && <button onClick={() => setIsImportModalOpen(false)}><X size={20} /></button>}
                        </div>
                        
                        {importSuccess ? (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle size={32} />
                                </div>
                                <h4 className="text-xl font-bold text-gray-800 mb-2">Import Successful!</h4>
                                <p className="text-gray-600 mb-6">Successfully imported {importStats.lists} lists and {importStats.tasks} tasks.</p>
                                <button onClick={() => setIsImportModalOpen(false)} className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600">Done</button>
                            </div>
                        ) : isImporting ? (
                            <div className="py-6">
                                <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                                    <span>Processing...</span>
                                    <span>{importProgress}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4">
                                    <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                                </div>
                                <p className="text-xs text-center text-gray-500">{importStatus}</p>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer relative mb-4 hover:bg-gray-50 transition-colors">
                                <input type="file" accept=".json" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="text-primary" size={32} />
                                    <span className="text-sm text-gray-700 font-medium">Click to upload JSON</span>
                                    <span className="text-xs text-gray-400">Supports Google Takeout Export</span>
                                </div>
                            </div>
                        )}
                        
                        {!importSuccess && !isImporting && (
                             <p className="text-xs text-gray-400 mt-4 text-center">
                                 Upload the 'Tasks.json' file from your Google Takeout export.
                             </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

// ... TaskItem (same as before)
const TaskItem: React.FC<{
    task: Task;
    goals: Goal[];
    isActive: boolean;
    onToggle: () => void;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
    onUpdate: (task: Task) => void;
}> = ({ task, goals, isActive, onToggle, onClick, onDelete, onUpdate }) => {
    const isCompleted = task.status === 'completed';

    const [title, setTitle] = useState(task.title);
    const [details, setDetails] = useState(task.details || '');
    const [date, setDate] = useState(task.dueDate || '');
    const [linkedGoalId, setLinkedGoalId] = useState(task.linkedGoalId || '');

    useEffect(() => {
        setTitle(task.title);
        setDetails(task.details || '');
        setDate(task.dueDate || '');
        setLinkedGoalId(task.linkedGoalId || '');
    }, [task]);

    const handleSave = () => {
        if (
            title !== task.title || 
            details !== (task.details || '') || 
            date !== (task.dueDate || '') ||
            linkedGoalId !== (task.linkedGoalId || '')
        ) {
            onUpdate({ ...task, title, details, dueDate: date, linkedGoalId: linkedGoalId || undefined });
        }
    };

    const linkedGoal = goals.find(g => g.id === task.linkedGoalId);

    return (
        <div 
            className={`bg-white rounded-lg border transition-all duration-200 overflow-hidden group
                ${isActive ? 'shadow-md border-blue-200 ring-1 ring-blue-50 my-2' : 'border-transparent hover:border-gray-200 hover:shadow-sm'}
            `}
        >
            <div className="flex items-start p-2 cursor-pointer" onClick={onClick}>
                <div className="pt-1 pr-3" onClick={(e) => e.stopPropagation()}>
                    <button 
                        onClick={onToggle}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors
                            ${isCompleted 
                                ? 'bg-primary border-primary text-white' 
                                : 'bg-white border-gray-400 hover:border-primary'}
                        `}
                    >
                        {isCompleted && <Check size={12} strokeWidth={3} />}
                    </button>
                </div>

                <div className="flex-1 min-w-0">
                    <div className={`text-gray-800 ${isCompleted ? 'line-through text-gray-400' : ''}`}>
                         {isActive ? (
                            <input 
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={handleSave}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-transparent outline-none font-medium"
                            />
                         ) : (
                             <div className="flex flex-col">
                                <span className="font-medium text-sm">{task.title}</span>
                                <div className="flex gap-2 items-center mt-0.5">
                                     {task.dueDate && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">{task.dueDate}</span>}
                                     {linkedGoal && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1"><LinkIcon size={8} /> {linkedGoal.title}</span>}
                                </div>
                             </div>
                         )}
                    </div>
                </div>

                <div className="pl-2 flex items-center">
                    <button 
                        onClick={onDelete} 
                        type="button" 
                        className="text-gray-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {isActive && (
                <div className="px-10 pb-4 pt-0 animate-fade-in space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <AlignLeft size={14} />
                            <textarea 
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                onBlur={handleSave}
                                placeholder="Add details..."
                                rows={2}
                                className="flex-1 text-sm text-gray-700 bg-transparent placeholder-gray-400 outline-none resize-none"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 rounded-full px-3 py-1.5 border border-gray-200 transition-colors w-fit">
                            <Calendar size={14} className="text-gray-500" />
                            <input 
                                type="date"
                                value={date}
                                onChange={(e) => { setDate(e.target.value); handleSave(); }} 
                                onBlur={handleSave}
                                className="text-xs text-gray-700 bg-transparent outline-none w-24"
                            />
                        </div>

                        <div className="relative group/goal flex items-center gap-2 bg-gray-50 hover:bg-gray-100 rounded-full px-3 py-1.5 border border-gray-200 transition-colors w-fit max-w-[200px]">
                            <Target size={14} className="text-gray-500 shrink-0" />
                            <select 
                                value={linkedGoalId}
                                onChange={(e) => { setLinkedGoalId(e.target.value); handleSave(); }}
                                onBlur={handleSave}
                                className="text-xs text-gray-700 bg-transparent outline-none appearance-none w-full truncate pr-4 cursor-pointer"
                            >
                                <option value="">Link to Goal...</option>
                                {goals.map(g => (
                                    <option key={g.id} value={g.id}>{g.title}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tasks;
