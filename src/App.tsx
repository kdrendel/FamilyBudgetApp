import React, { useState, useEffect } from 'react';
import { PlusCircle, Wallet, ArrowUpCircle, ArrowDownCircle, PieChart, Link } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { Category, Transaction } from './types';
import { format } from 'date-fns';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { usePlaidLink } from 'react-plaid-link';

ChartJS.register(ArcElement, Tooltip, Legend);

const DEFAULT_CATEGORIES = [
  { name: 'Housing', budget_limit: 2000, color: '#FF6B6B' },
  { name: 'Utilities', budget_limit: 300, color: '#4ECDC4' },
  { name: 'Groceries', budget_limit: 800, color: '#45B7D1' },
  { name: 'Transportation', budget_limit: 400, color: '#96CEB4' },
  { name: 'Healthcare', budget_limit: 300, color: '#FFEEAD' },
  { name: 'Entertainment', budget_limit: 200, color: '#D4A5A5' },
  { name: 'Education', budget_limit: 200, color: '#9B5DE5' },
  { name: 'Savings', budget_limit: 500, color: '#00BBF9' },
  { name: 'Debt Payment', budget_limit: 500, color: '#00F5D4' },
  { name: 'Miscellaneous', budget_limit: 200, color: '#738290' }
];

interface PlaidLinkToken {
  link_token: string;
}

function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', budget_limit: 0, color: '#6366f1' });
  const [newTransaction, setNewTransaction] = useState({
    category_id: '',
    amount: 0,
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });
  const [user, setUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<string[]>([]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchCategories();
      fetchTransactions();
    }
  }, [user]);

  useEffect(() => {
    if (user && !linkToken) {
      const getLinkToken = async () => {
        const { data, error } = await supabase.functions.invoke('create-plaid-link-token', {
          body: { user_id: user.id }
        });

        if (error) {
          console.error('Error getting link token:', error);
          return;
        }

        setLinkToken((data as PlaidLinkToken).link_token);
      };

      getLinkToken();
    }
  }, [user]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = authMode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function initializeDefaultCategories() {
    if (!user) return;
    
    for (const category of DEFAULT_CATEGORIES) {
      const { error } = await supabase
        .from('categories')
        .insert([{ ...category, user_id: user.id }]);
      
      if (error) {
        console.error('Error adding default category:', error);
      }
    }
    
    fetchCategories();
  }

  async function fetchCategories() {
    if (!user) return;

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }
    
    if (data.length === 0) {
      await initializeDefaultCategories();
    } else {
      setCategories(data);
    }
  }

  async function fetchTransactions() {
    if (!user) return;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }
    
    setTransactions(data || []);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase
      .from('categories')
      .insert([{ ...newCategory, user_id: user.id }]);

    if (error) {
      console.error('Error adding category:', error);
      return;
    }

    setShowAddCategory(false);
    setNewCategory({ name: '', budget_limit: 0, color: '#6366f1' });
    fetchCategories();
  }

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase
      .from('transactions')
      .insert([{ ...newTransaction, user_id: user.id }]);

    if (error) {
      console.error('Error adding transaction:', error);
      return;
    }

    setShowAddTransaction(false);
    setNewTransaction({
      category_id: '',
      amount: 0,
      description: '',
      date: format(new Date(), 'yyyy-MM-dd')
    });
    fetchTransactions();
  }

  function getCategoryName(categoryId: string) {
    return categories.find(cat => cat.id === categoryId)?.name || 'Unknown';
  }

  function getCategoryColor(categoryId: string) {
    return categories.find(cat => cat.id === categoryId)?.color || '#6366f1';
  }

  function calculateCategorySpending(categoryId: string) {
    return transactions
      .filter(t => t.category_id === categoryId)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  function calculateTotalBudget() {
    return categories.reduce((sum, cat) => sum + cat.budget_limit, 0);
  }

  function calculateTotalSpent() {
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  const chartData = {
    labels: categories.map(cat => cat.name),
    datasets: [
      {
        data: categories.map(cat => calculateCategorySpending(cat.id)),
        backgroundColor: categories.map(cat => cat.color),
        borderWidth: 1,
      },
    ],
  };

  const onPlaidSuccess = async (publicToken: string, metadata: any) => {
    if (!user) return;

    const { error } = await supabase.functions.invoke('exchange-plaid-token', {
      body: { public_token: publicToken, user_id: user.id }
    });

    if (error) {
      console.error('Error exchanging Plaid token:', error);
      return;
    }

    fetchTransactions();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <Wallet className="h-8 w-8 text-indigo-600" />
            <h1 className="ml-3 text-2xl font-bold">Alexander Budget Tracker</h1>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Loading...' : authMode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {authMode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Wallet className="h-8 w-8 text-indigo-600" />
              <h1 className="ml-3 text-3xl font-bold text-gray-900">Alexander Budget Tracker</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowAddCategory(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Category
              </button>
              <button
                onClick={() => setShowAddTransaction(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Transaction
              </button>
              <button
                onClick={() => open()}
                disabled={!ready}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
              >
                <Link className="h-4 w-4 mr-2" />
                Connect Bank
              </button>
              <button
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Budget Overview */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Budget Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900">Total Budget</h3>
              <p className="text-3xl font-bold text-indigo-600">${calculateTotalBudget().toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900">Total Spent</h3>
              <p className="text-3xl font-bold text-green-600">${calculateTotalSpent().toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900">Remaining</h3>
              <p className="text-3xl font-bold text-blue-600">
                ${(calculateTotalBudget() - calculateTotalSpent()).toFixed(2)}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Spending Distribution</h3>
            <div className="h-80">
              <Pie data={chartData} options={{ maintainAspectRatio: false }} />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Budget Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(category => {
              const spent = calculateCategorySpending(category.id);
              const remaining = category.budget_limit - spent;
              return (
                <div
                  key={category.id}
                  className="bg-white rounded-lg shadow p-6"
                  style={{ borderLeft: `4px solid ${category.color}` }}
                >
                  <h3 className="text-lg font-semibold">{category.name}</h3>
                  <div className="mt-2">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Budget</span>
                      <span>${category.budget_limit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Spent</span>
                      <span>${spent.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium mt-1">
                      <span>Remaining</span>
                      <span className={remaining >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ${remaining.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min((spent / category.budget_limit) * 100, 100)}%`,
                        backgroundColor: category.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transactions */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Recent Transactions</h2>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {/* For larger screens */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map(transaction => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(transaction.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className="h-2 w-2 rounded-full mr-2"
                            style={{ backgroundColor: getCategoryColor(transaction.category_id) }}
                          />
                          <span className="text-sm text-gray-900">{getCategoryName(transaction.category_id)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${Math.abs(transaction.amount).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* For mobile screens */}
            <div className="block md:hidden">
              <div className="divide-y divide-gray-200">
                {transactions.map(transaction => (
                  <div key={transaction.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: getCategoryColor(transaction.category_id) }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {getCategoryName(transaction.category_id)}
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(transaction.date), 'MMM d, yyyy')}
                    </div>
                    <div className="text-sm text-gray-700 break-words">
                      {transaction.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Add New Category</h3>
            <form onSubmit={addCategory}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={newCategory.name}
                    onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Budget Limit</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={newCategory.budget_limit}
                    onChange={e => setNewCategory({ ...newCategory, budget_limit: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Color</label>
                  <input
                    type="color"
                    className="mt-1 block w-full"
                    value={newCategory.color}
                    onChange={e => setNewCategory({ ...newCategory, color: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Add New Transaction</h3>
            <form onSubmit={addTransaction}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={newTransaction.category_id}
                    onChange={e => setNewTransaction({ ...newTransaction, category_id: e.target.value })}
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={newTransaction.amount}
                    onChange={e => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={newTransaction.description}
                    onChange={e => setNewTransaction({ ...newTransaction, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={newTransaction.date}
                    onChange={e => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddTransaction(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;