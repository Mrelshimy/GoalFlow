
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db } from '../services/db';
import { User } from '../types';
import { Plus, Users, Mail, UserPlus, Loader2, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Team: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if not department head
  useEffect(() => {
    if (user && user.role !== 'department_head') {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user?.department) {
      fetchEmployees();
    } else {
        setIsLoading(false);
    }
  }, [user]);

  const fetchEmployees = async () => {
    if (!user?.department) return;
    try {
        const data = await db.getEmployees(user.department);
        setEmployees(data);
    } catch (e) {
        console.error("Failed to fetch employees", e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!user?.department) {
        setError('You must belong to a department to add employees.');
        return;
    }

    setIsAdding(true);
    try {
        await db.addEmployeeToDepartment(addEmail, user.department);
        setSuccess(`Successfully added ${addEmail} to ${user.department}`);
        setAddEmail('');
        fetchEmployees();
    } catch (err: any) {
        console.error(err);
        setError('Failed to add employee. Verify the email exists in the system.');
    } finally {
        setIsAdding(false);
    }
  };

  if (!user || user.role !== 'department_head') return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Team Management</h1>
            <p className="text-gray-500">Manage members of <span className="font-semibold text-primary">{user.department || 'Your Department'}</span></p>
        </div>
      </div>

      {!user.department ? (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-yellow-800">
              <h3 className="font-bold mb-2">No Department Assigned</h3>
              <p>Please update your profile to set your department name before adding employees.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Add Employee Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <UserPlus size={20} className="text-primary" /> Add Member
                </h2>
                <form onSubmit={handleAddEmployee} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Employee Email</label>
                        <input 
                            type="email" 
                            required 
                            value={addEmail} 
                            onChange={e => setAddEmail(e.target.value)}
                            className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none" 
                            placeholder="colleague@company.com"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">User must already have an account.</p>
                    </div>
                    
                    {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</p>}
                    {success && <p className="text-xs text-green-600 bg-green-50 p-2 rounded">{success}</p>}

                    <button 
                        type="submit" 
                        disabled={isAdding || !addEmail}
                        className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isAdding ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                        Add to Team
                    </button>
                </form>
            </div>

            {/* Employee List */}
            <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <Users size={20} className="text-gray-600" /> Department Members
                    </h2>
                    <span className="bg-blue-50 text-primary text-xs font-bold px-2 py-1 rounded-full">{employees.length} Members</span>
                </div>

                {isLoading ? (
                    <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : employees.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <Users size={48} className="mx-auto mb-3 opacity-20" />
                        <p>No employees in this department yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {employees.map(emp => (
                            <div key={emp.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                                        {emp.avatar ? <img src={emp.avatar} className="w-full h-full rounded-full object-cover"/> : emp.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1"><Mail size={10} /> {emp.email}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex items-center gap-1 w-fit ml-auto">
                                        <Briefcase size={10} /> {emp.title || 'No Title'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
      )}
    </div>
  );
};

export default Team;