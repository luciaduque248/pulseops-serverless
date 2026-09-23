import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { confirmSignUp, signUp } from 'aws-amplify/auth';
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from './api';
import { useAuth } from './auth';
import type { DashboardSummary, Incident, IncidentComment, IncidentPriority, IncidentStatus, PaginatedIncidents } from './types';

const priorities: IncidentPriority[] = ['low', 'medium', 'high', 'critical'];
const statuses: IncidentStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

function LoadingScreen() {
  return <div className="center-screen"><div className="loader" /><p>Loading PulseOps…</p></div>;
}

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/"><span className="brand-mark">P</span><span>PulseOps</span></Link>
        <nav>
          <NavLink to="/" end>Overview</NavLink>
          <NavLink to="/incidents">Incidents</NavLink>
          <NavLink to="/incidents/new">New incident</NavLink>
        </nav>
        <div className="sidebar-footer">
          <span className="eyebrow">SIGNED IN</span>
          <strong>{user?.username}</strong>
          <button className="link-button" onClick={onLogout}>Sign out</button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="brand light"><span className="brand-mark">P</span><span>PulseOps</span></div>
        <div>
          <span className="eyebrow">SERVERLESS INCIDENT OPERATIONS</span>
          <h1>Resolve work before it becomes noise.</h1>
          <p>Track service incidents, collaborate with your team and keep operational work visible from request to resolution.</p>
        </div>
        <div className="architecture-note">React · Cognito · API Gateway · Lambda · DynamoDB</div>
      </section>
      <section className="auth-panel"><div className="auth-card"><span className="eyebrow">PULSEOPS</span><h2>{title}</h2><p>{subtitle}</p>{children}</div></section>
    </div>
  );
}

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await login(email, password); navigate('/'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in'); }
    finally { setBusy(false); }
  };

  return <AuthLayout title="Welcome back" subtitle="Sign in to your operations workspace.">
    <form onSubmit={submit} className="stack">
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required minLength={8} /></label>
      {error && <div className="alert error">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="auth-switch">New to PulseOps? <Link to="/register">Create an account</Link></p>
    </form>
  </AuthLayout>;
}

function RegisterPage() {
  const [step, setStep] = useState<'register' | 'confirm'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const register = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await signUp({ username: email, password, options: { userAttributes: { email, name } } });
      if (result.nextStep.signUpStep === 'DONE') navigate('/login'); else setStep('confirm');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create account'); }
    finally { setBusy(false); }
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await confirmSignUp({ username: email, confirmationCode: code }); navigate('/login'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to confirm account'); }
    finally { setBusy(false); }
  };

  return <AuthLayout title={step === 'register' ? 'Create your workspace account' : 'Verify your email'} subtitle={step === 'register' ? 'Use your work email to get started.' : `We sent a confirmation code to ${email}.`}>
    {step === 'register' ? <form onSubmit={register} className="stack">
      <label>Name<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} /></label>
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /><small>At least 8 characters, with upper/lowercase, number and symbol.</small></label>
      {error && <div className="alert error">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
    </form> : <form onSubmit={confirm} className="stack">
      <label>Confirmation code<input inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} required /></label>
      {error && <div className="alert error">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify account'}</button>
    </form>}
  </AuthLayout>;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}

function StatusPill({ status }: { status: IncidentStatus }) {
  return <span className={`pill status-${status}`}>{status.replace('_', ' ')}</span>;
}

function PriorityPill({ priority }: { priority: IncidentPriority }) {
  return <span className={`pill priority-${priority}`}>{priority}</span>;
}

function IncidentTable({ incidents }: { incidents: Incident[] }) {
  if (!incidents.length) return <div className="empty"><h3>No incidents yet</h3><p>Create the first request to start tracking operational work.</p><Link className="primary button-link" to="/incidents/new">Create incident</Link></div>;
  return <div className="table-wrap"><table><thead><tr><th>Incident</th><th>Category</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead><tbody>{incidents.map(incident => <tr key={incident.id}><td><Link className="incident-link" to={`/incidents/${incident.id}`}>{incident.title}</Link><small>#{incident.id.slice(0, 8)}</small></td><td>{incident.category}</td><td><PriorityPill priority={incident.priority} /></td><td><StatusPill status={incident.status} /></td><td>{new Date(incident.updatedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>;
}

function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { apiRequest<DashboardSummary>('/dashboard').then(setData).catch(err => setError(err instanceof Error ? err.message : 'Unable to load dashboard')); }, []);
  if (error) return <Page><div className="alert error">{error}</div></Page>;
  if (!data) return <Page><LoadingScreen /></Page>;
  return <Page title="Operations overview" description="A live view of your incident workload." action={<Link className="primary button-link" to="/incidents/new">+ New incident</Link>}>
    <section className="stats-grid"><StatCard label="Open" value={data.open} hint="Needs attention" /><StatCard label="In progress" value={data.inProgress} hint="Being worked" /><StatCard label="Resolved" value={data.resolved} hint="Completed work" /><StatCard label="Critical" value={data.critical} hint="Highest priority" /></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Latest incidents</h2></div><Link to="/incidents">View all</Link></div><IncidentTable incidents={data.recent} /></section>
  </Page>;
}

function IncidentsPage() {
  const [data, setData] = useState<PaginatedIncidents | null>(null);
  const [status, setStatus] = useState<IncidentStatus | ''>('');
  const [error, setError] = useState('');
  useEffect(() => {
    const query = status ? `?status=${status}` : '';
    apiRequest<PaginatedIncidents>(`/incidents${query}`).then(setData).catch(err => setError(err instanceof Error ? err.message : 'Unable to load incidents'));
  }, [status]);
  return <Page title="Incidents" description="Review and manage operational requests." action={<Link className="primary button-link" to="/incidents/new">+ New incident</Link>}>
    <section className="panel"><div className="toolbar"><label>Status<select value={status} onChange={e => setStatus(e.target.value as IncidentStatus | '')}><option value="">All statuses</option>{statuses.map(item => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select></label></div>{error ? <div className="alert error">{error}</div> : data ? <IncidentTable incidents={data.items} /> : <LoadingScreen />}</section>
  </Page>;
}

function NewIncidentPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', category: 'Software', priority: 'medium' as IncidentPriority });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await apiRequest<Incident>('/incidents', { method: 'POST', body: JSON.stringify(form) }); navigate(`/incidents/${result.id}`); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to create incident'); }
    finally { setBusy(false); }
  };
  return <Page title="Create incident" description="Capture enough context for the team to act quickly."><section className="panel form-panel"><form onSubmit={submit} className="stack">
    <label>Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required minLength={4} maxLength={120} placeholder="Customer portal returns 500 after login" /></label>
    <label>Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required minLength={10} maxLength={3000} rows={7} placeholder="What happened, who is affected, and what have you tried?" /></label>
    <div className="form-grid"><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option>Software</option><option>Network</option><option>Access</option><option>Hardware</option><option>Data</option><option>Other</option></select></label><label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as IncidentPriority })}>{priorities.map(item => <option key={item}>{item}</option>)}</select></label></div>
    {error && <div className="alert error">{error}</div>}<div className="form-actions"><Link className="secondary button-link" to="/incidents">Cancel</Link><button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create incident'}</button></div>
  </form></section></Page>;
}

function IncidentDetailPage() {
  const { id } = useParams();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [comments, setComments] = useState<IncidentComment[]>([]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const [item, discussion] = await Promise.all([apiRequest<Incident>(`/incidents/${id}`), apiRequest<{ items: IncidentComment[] }>(`/incidents/${id}/comments`)]);
      setIncident(item); setComments(discussion.items);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load incident'); }
  };
  useEffect(() => { void load(); }, [id]);

  const updateStatus = async (next: IncidentStatus) => {
    if (!id) return;
    const updated = await apiRequest<Incident>(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
    setIncident(updated);
  };

  const addComment = async (event: FormEvent) => {
    event.preventDefault(); if (!id || !comment.trim()) return;
    const created = await apiRequest<IncidentComment>(`/incidents/${id}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) });
    setComments(prev => [...prev, created]); setComment('');
  };

  const uploadFile = async (file: File) => {
    if (!id) return; setUploading(true);
    try {
      const presign = await apiRequest<{ uploadUrl: string; key: string }>(`/incidents/${id}/attachments/presign`, { method: 'POST', body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream' }) });
      const response = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!response.ok) throw new Error('Upload failed');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to upload attachment'); }
    finally { setUploading(false); }
  };

  if (error && !incident) return <Page><div className="alert error">{error}</div></Page>;
  if (!incident) return <Page><LoadingScreen /></Page>;
  return <Page title={incident.title} description={`Incident #${incident.id.slice(0, 8)}`} action={<PriorityPill priority={incident.priority} />}>
    {error && <div className="alert error">{error}</div>}
    <div className="detail-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">DESCRIPTION</span><h2>Incident context</h2></div><StatusPill status={incident.status} /></div><p className="description-copy">{incident.description}</p><dl className="metadata"><div><dt>Category</dt><dd>{incident.category}</dd></div><div><dt>Created</dt><dd>{new Date(incident.createdAt).toLocaleString()}</dd></div><div><dt>Last update</dt><dd>{new Date(incident.updatedAt).toLocaleString()}</dd></div></dl></section>
      <aside className="panel"><span className="eyebrow">WORKFLOW</span><h2>Update status</h2><div className="status-actions">{statuses.map(item => <button key={item} className={incident.status === item ? 'active-status' : 'secondary'} onClick={() => updateStatus(item)}>{item.replace('_', ' ')}</button>)}</div><hr /><label className="upload-control">Attachment<input type="file" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadFile(file); }} disabled={uploading} /><small>{uploading ? 'Uploading…' : 'Files are uploaded directly to private S3 using a presigned URL.'}</small></label></aside>
    </div>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">COLLABORATION</span><h2>Comments</h2></div><span>{comments.length}</span></div><div className="comments">{comments.length ? comments.map(item => <article className="comment" key={item.id}><div><strong>{item.authorId.slice(0, 8)}</strong><time>{new Date(item.createdAt).toLocaleString()}</time></div><p>{item.body}</p></article>) : <p className="muted">No comments yet.</p>}</div><form onSubmit={addComment} className="comment-form"><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add investigation notes or an update…" minLength={2} maxLength={1500} required /><button className="primary">Add comment</button></form></section>
  </Page>;
}

function Page({ title, description, action, children }: { title?: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <AppShell><div className="page"><header className="page-header"><div>{title && <h1>{title}</h1>}{description && <p>{description}</p>}</div>{action}</header>{children}</div></AppShell>;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/" element={<Protected><DashboardPage /></Protected>} />
    <Route path="/incidents" element={<Protected><IncidentsPage /></Protected>} />
    <Route path="/incidents/new" element={<Protected><NewIncidentPage /></Protected>} />
    <Route path="/incidents/:id" element={<Protected><IncidentDetailPage /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
