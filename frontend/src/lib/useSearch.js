import { useState, useEffect, useRef } from 'react';
import { api } from './api';

// Global search hook — searches customers and payments
export function useGlobalSearch() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults(null); setOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [customers, payments] = await Promise.all([
          api.getCustomers(query),
          api.getPayments({ search: query }).catch(() => []),
        ]);
        setResults({ customers: customers.slice(0,5), payments: [] });
        setOpen(true);
      } catch {}
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const clear = () => { setQuery(''); setResults(null); setOpen(false); };
  return { query, setQuery, results, loading, open, setOpen, clear };
}
