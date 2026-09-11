import { useEffect, useMemo, useState } from 'react'
import { CreditCard, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function EnrollmentFinancePanel({ enrollmentId }: { enrollmentId: string }) {
  const [enrollment, setEnrollment] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    const [{ data: e, error: ee }, { data: p, error: pe }] = await Promise.all([
      supabase.from('enrollments').select('id,payment_amount,payment_status,contract_type').eq('id', enrollmentId).single(),
      supabase.from('enrollment_payments').select('*').eq('enrollment_id', enrollmentId).order('created_at', { ascending: false }),
    ])
    if (ee) setError(ee.message)
    if (pe) setError(pe.message)
    setEnrollment(e)
    setPayments(p || [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [enrollmentId])

  const paid = useMemo(() => payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0), [payments])
  const total = Number(enrollment?.payment_amount || 0)

  return <section className="panel enrollment-finance-panel">
    <div className="panel-head"><div><h3><CreditCard size={17}/> Enrollment payment</h3><p className="panel-subtitle">Payment is attached to the enrollment, not to individual lessons.</p></div><button className="btn small" onClick={() => void load()}><RefreshCw size={14}/> Refresh</button></div>
    {loading ? <div className="empty-state">Loading payment history...</div> : <>
      <div className="finance-summary"><div><span>Contract amount</span><strong>₱{total.toLocaleString()}</strong></div><div><span>Paid</span><strong>₱{paid.toLocaleString()}</strong></div><div><span>Status</span><strong className="capitalize">{enrollment?.payment_status || 'pending'}</strong></div></div>
      {payments.length ? <div className="payment-list">{payments.map(p => <div className="payment-row" key={p.id}><div><strong>₱{Number(p.amount).toLocaleString()}</strong><small>{new Date(p.created_at).toLocaleDateString()} · {p.notes || 'Enrollment payment'}</small></div><span className={`status ${p.status === 'paid' ? 'success' : p.status === 'refunded' ? 'danger' : 'warning'}`}>{p.status}</span></div>)}</div> : <div className="empty-state finance-empty">No payment record yet.</div>}
    </>}
    {error && <div className="form-error">{error}</div>}
  </section>
}
