import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000/api/v1';
const API_KEY = 'dev-admin-key';


interface Token {
  id: string;
  address: string;
  symbol: string;
  decimals: number;
  balance: string;
}

interface Wallet {
  id: string;
  address: string;
  label: string;
  createdAt: string;
  balance?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'wallets' | 'simulate' | 'policy' | 'decode' | 'audit' | 'webhooks'>('wallets');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(false);

  // Simulation Form State
  const [simTo, setSimTo] = useState('');
  const [simValue, setSimValue] = useState('');
  const [simData, setSimData] = useState('');
  const [checkPolicy, setCheckPolicy] = useState(true);
  const [simResult, setSimResult] = useState<any>(null);

  // Decoder Form State
  const [decodeData, setDecodeData] = useState('');
  const [decodeResult, setDecodeResult] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'wallets') fetchWallets();
  }, [activeTab]);

  /* Audit State */
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  /* Webhook State */
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState('');
  const [newWebhookSecret, setNewWebhookSecret] = useState('');

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/audit-logs?limit=50`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();
      setAuditLogs(data);
    } catch (e) {
      console.error('Failed to fetch audit logs', e);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`${API_URL}/webhooks`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();
      setWebhooks(data);
    } catch (e) {
      console.error('Failed to fetch webhooks', e);
    }
  };

  const createWebhook = async () => {
    if (!newWebhookUrl || !newWebhookEvents) {
      alert('URL and Events are required');
      return;
    }

    try {
      const events = newWebhookEvents.split(',').map(e => e.trim()).filter(Boolean);
      const res = await fetch(`${API_URL}/webhooks`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: newWebhookUrl,
          events,
          secret: newWebhookSecret || undefined
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create webhook');
      }

      setNewWebhookUrl('');
      setNewWebhookEvents('');
      setNewWebhookSecret('');
      fetchWebhooks();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      await fetch(`${API_URL}/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': API_KEY }
      });
      fetchWebhooks();
    } catch (e) {
      alert('Failed to delete webhook');
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'webhooks') fetchWebhooks();
  }, [activeTab]);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/wallets`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setWallets(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Wallet Form State
  const [newWalletLabel, setNewWalletLabel] = useState('');
  const [importMode, setImportMode] = useState(false);
  const [importType, setImportType] = useState<'privateKey' | 'mnemonic'>('privateKey');
  const [importValue, setImportValue] = useState('');

  // Token Management State
  const [walletTokens, setWalletTokens] = useState<Record<string, Token[]>>({});
  const [expandingWalletId, setExpandingWalletId] = useState<string | null>(null);
  const [newTokenAddress, setNewTokenAddress] = useState('');

  const createWallet = async () => {
    if (!newWalletLabel) {
      alert("Please enter a label for the wallet.");
      return;
    }
    if (importMode && !importValue) {
      alert("Please enter a Private Key or Mnemonic to import.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/wallets`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          label: newWalletLabel,
          privateKey: (importMode && importType === 'privateKey') ? importValue : undefined,
          mnemonic: (importMode && importType === 'mnemonic') ? importValue : undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to create/import wallet');
      }

      setNewWalletLabel('');
      setImportValue('');
      setImportMode(false);
      fetchWallets();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const runSimulation = async () => {
    try {
      const res = await fetch(`${API_URL}/simulate`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: simTo,
          value: simValue || '0',
          data: simData || undefined,
          checkPolicy
        })
      });
      const data = await res.json();
      setSimResult(data);
    } catch (err) {
      alert("Simulation failed");
    }
  };

  const runDecode = async () => {
    try {
      const res = await fetch(`${API_URL}/decode`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: decodeData })
      });
      const data = await res.json();
      setDecodeResult(data);
    } catch (err) {
      alert("Decoding failed");
    }
  };

  const fetchTokens = async (walletId: string) => {
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/tokens`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();
      setWalletTokens(prev => ({ ...prev, [walletId]: data }));
    } catch (e) {
      console.error(e);
    }
  };

  const addToken = async (walletId: string) => {
    if (!newTokenAddress) return;
    try {
      const res = await fetch(`${API_URL}/wallets/${walletId}/tokens`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tokenAddress: newTokenAddress })
      });
      if (!res.ok) throw new Error('Failed to add token');

      setNewTokenAddress('');
      fetchTokens(walletId);
    } catch (e) {
      alert('Failed to add token. Check address.');
    }
  };

  const removeToken = async (walletId: string, tokenAddress: string) => {
    if (!confirm('Stop watching this token?')) return;
    try {
      await fetch(`${API_URL}/wallets/${walletId}/tokens/${tokenAddress}`, {
        method: 'DELETE',
        headers: { 'x-api-key': API_KEY }
      });
      fetchTokens(walletId);
    } catch (e) {
      alert('Failed to remove token');
    }
  };

  const toggleAssets = (walletId: string) => {
    if (expandingWalletId === walletId) {
      setExpandingWalletId(null);
    } else {
      setExpandingWalletId(walletId);
      fetchTokens(walletId);
    }
  };

  // Policy Management State
  const [policies, setPolicies] = useState<any[]>([]);
  const [policyType, setPolicyType] = useState('TRANSACTION_LIMIT');
  const [policyScope, setPolicyScope] = useState('GLOBAL');
  const [policyEntityId, setPolicyEntityId] = useState('');
  // Config inputs
  const [policyLimitAmount, setPolicyLimitAmount] = useState('');
  const [policyWhitelistAddresses, setPolicyWhitelistAddresses] = useState('');

  const fetchPolicies = async () => {
    try {
      const res = await fetch(`${API_URL}/policies`, {
        headers: { 'x-api-key': API_KEY }
      });
      const data = await res.json();
      setPolicies(data);
    } catch (e) {
      console.error('Failed to fetch policies', e);
    }
  };

  const createPolicy = async () => {
    try {
      let config = {};
      if (policyType === 'TRANSACTION_LIMIT') {
        config = { maxAmount: policyLimitAmount };
      } else if (policyType === 'WHITELIST') {
        config = { addresses: policyWhitelistAddresses.split(',').map(a => a.trim()).filter(Boolean) };
      }

      const payload = {
        type: policyType,
        scope: policyScope,
        entityId: policyScope === 'WALLET' ? policyEntityId : undefined,
        config
      };

      const res = await fetch(`${API_URL}/policies`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create policy');
      }

      // Reset form
      setPolicyLimitAmount('');
      setPolicyWhitelistAddresses('');
      fetchPolicies();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const deletePolicy = async (id: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    try {
      await fetch(`${API_URL}/policies/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': API_KEY }
      });
      fetchPolicies();
    } catch (e) {
      alert('Failed to delete policy');
    }
  };

  useEffect(() => {
    if (activeTab === 'policy') fetchPolicies();
  }, [activeTab]);

  return (
    <div className="container">
      <header className="header">
        <div className="logo">EVM<span>//</span>MIDDLEWARE</div>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.9em' }}>Connected: ADMIN</div>
      </header>

      <div className="tabs">
        <button className={`tab ${activeTab === 'wallets' ? 'active' : ''}`} onClick={() => setActiveTab('wallets')}>Wallets</button>
        <button className={`tab ${activeTab === 'policy' ? 'active' : ''}`} onClick={() => setActiveTab('policy')}>Policies</button>
        <button className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Audit</button>
        <button className={`tab ${activeTab === 'webhooks' ? 'active' : ''}`} onClick={() => setActiveTab('webhooks')}>Webhooks</button>
        <button className={`tab ${activeTab === 'simulate' ? 'active' : ''}`} onClick={() => setActiveTab('simulate')}>Simulation</button>
        <button className={`tab ${activeTab === 'decode' ? 'active' : ''}`} onClick={() => setActiveTab('decode')}>Decoder</button>
      </div>

      <main>
        {activeTab === 'wallets' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Managed Wallets</h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1rem' }}>
                    <input type="checkbox" checked={importMode} onChange={e => setImportMode(e.target.checked)} id="chkImport" />
                    <label htmlFor="chkImport" style={{ fontSize: '0.9em', cursor: 'pointer' }}>Import Existing</label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <input
                  value={newWalletLabel}
                  onChange={e => setNewWalletLabel(e.target.value)}
                  placeholder="New Wallet Label"
                  style={{ minWidth: '200px', margin: 0 }}
                />

                {importMode && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <label><input type="radio" checked={importType === 'privateKey'} onChange={() => setImportType('privateKey')} /> Private Key</label>
                      <label><input type="radio" checked={importType === 'mnemonic'} onChange={() => setImportType('mnemonic')} /> Mnemonic</label>
                    </div>
                    <input
                      type={importType === 'privateKey' ? "password" : "text"}
                      value={importValue}
                      onChange={e => setImportValue(e.target.value)}
                      placeholder={importType === 'privateKey' ? "0x..." : "12 words..."}
                      style={{ minWidth: '350px', margin: 0 }}
                    />
                  </div>
                )}

                <button className="primary" onClick={createWallet}>
                  {importMode ? 'Import' : '+ Create'}
                </button>
              </div>
            </div>


            {loading ? <p>Loading...</p> : (
              <div className="grid">
                {wallets.map(w => (
                  <div key={w.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ marginTop: 0 }}>{w.label || 'Untitled Wallet'}</h3>
                      {w.balance && parseFloat(w.balance) < 0.1 && (
                        <span className="status-badge status-danger" style={{ fontSize: '0.8em' }}>⚠️ Low Gas</span>
                      )}
                    </div>
                    <code style={{ display: 'block', marginBottom: '0.5rem', wordBreak: 'break-all' }}>{w.address}</code>
                    <div style={{ fontSize: '0.9em', color: 'var(--text-dim)', marginBottom: '1rem' }}>
                      Native Balance: {w.balance} ETH
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button onClick={() => alert(`ID: ${w.id}`)}>Details</button>
                      <button className="secondary" onClick={() => toggleAssets(w.id)}>
                        {expandingWalletId === w.id ? 'Hide Assets' : 'Manage Assets'}
                      </button>
                    </div>

                    {expandingWalletId === w.id && (
                      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                        <h4>Watched Assets</h4>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          <input
                            placeholder="Token Address (0x...)"
                            value={newTokenAddress}
                            onChange={e => setNewTokenAddress(e.target.value)}
                            style={{ margin: 0, flex: 1 }}
                          />
                          <button onClick={() => addToken(w.id)} disabled={!newTokenAddress}>+ Watch</button>
                        </div>

                        {walletTokens[w.id]?.length > 0 ? (
                          <table style={{ width: '100%', fontSize: '0.9em', textAlign: 'left' }}>
                            <thead>
                              <tr>
                                <th>Symbol</th>
                                <th>Balance</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {walletTokens[w.id].map(t => (
                                <tr key={t.id}>
                                  <td>{t.symbol}</td>
                                  <td>{t.balance}</td>
                                  <td>
                                    <button
                                      style={{ padding: '2px 6px', fontSize: '0.8em', backgroundColor: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                                      onClick={() => removeToken(w.id, t.address)}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p style={{ fontSize: '0.9em', color: 'var(--text-dim)' }}>No tokens watched.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {wallets.length === 0 && !loading && <p style={{ color: 'var(--text-dim)' }}>No wallets found.</p>}
          </div>
        )}

        {activeTab === 'policy' && (
          <div>
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h2>Create Policy</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Type</label>
                  <select value={policyType} onChange={e => setPolicyType(e.target.value)} style={{ width: '100%', marginTop: '0.5rem' }}>
                    <option value="TRANSACTION_LIMIT">Transaction Limit</option>
                    <option value="WHITELIST">Whitelist</option>
                  </select>
                </div>
                <div>
                  <label>Scope</label>
                  <select value={policyScope} onChange={e => setPolicyScope(e.target.value)} style={{ width: '100%', marginTop: '0.5rem' }}>
                    <option value="GLOBAL">Global</option>
                    <option value="WALLET">Wallet Specific</option>
                  </select>
                </div>
              </div>

              {policyScope === 'WALLET' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label>Wallet ID</label>
                  <input
                    value={policyEntityId}
                    onChange={e => setPolicyEntityId(e.target.value)}
                    placeholder="Enter Wallet UUID..."
                    style={{ width: '100%', marginTop: '0.5rem' }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-sub)', borderRadius: '4px' }}>
                {policyType === 'TRANSACTION_LIMIT' && (
                  <div>
                    <label>Max Amount (ETH)</label>
                    <input
                      value={policyLimitAmount}
                      onChange={e => setPolicyLimitAmount(e.target.value)}
                      placeholder="1.5"
                      style={{ marginTop: '0.5rem' }}
                    />
                  </div>
                )}
                {policyType === 'WHITELIST' && (
                  <div>
                    <label>Allowed Addresses (comma separated)</label>
                    <textarea
                      value={policyWhitelistAddresses}
                      onChange={e => setPolicyWhitelistAddresses(e.target.value)}
                      placeholder="0x123..., 0xabc..."
                      rows={3}
                      style={{ marginTop: '0.5rem' }}
                    />
                  </div>
                )}
              </div>

              <button className="primary" onClick={createPolicy}>Create Policy</button>
            </div>

            <div className="grid">
              <div style={{ gridColumn: '1 / -1' }}><h3>Active Policies</h3></div>
              {policies.map(p => (
                <div key={p.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span className="status-badge status-success">{p.type}</span>
                    <span className="status-badge" style={{ background: '#333' }}>{p.scope}</span>
                  </div>
                  {p.scope === 'WALLET' && <div style={{ fontSize: '0.8em', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Wallet: {p.entityId}</div>}

                  <pre style={{ background: '#000', padding: '0.5rem', fontSize: '0.8em', overflowX: 'auto' }}>
                    {JSON.stringify(JSON.parse(p.config), null, 2)}
                  </pre>

                  <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => deletePolicy(p.id)}
                      style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', fontSize: '0.8em', padding: '4px 8px' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {policies.length === 0 && <p style={{ color: 'var(--text-dim)' }}>No active policies.</p>}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div>
            <h2>Audit Logs</h2>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.5rem' }}>Time</th>
                    <th style={{ padding: '0.5rem' }}>Action</th>
                    <th style={{ padding: '0.5rem' }}>Entity</th>
                    <th style={{ padding: '0.5rem' }}>Entity ID</th>
                    <th style={{ padding: '0.5rem' }}>Actor</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem', fontSize: '0.9em', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '0.5rem' }}>{log.action}</td>
                      <td style={{ padding: '0.5rem' }}><span className="status-badge" style={{ background: '#333' }}>{log.entity}</span></td>
                      <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8em' }}>{log.entityId}</td>
                      <td style={{ padding: '0.5rem', fontSize: '0.9em' }}>{log.actor}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span className={`status-badge ${log.status === 'SUCCESS' ? 'status-success' : 'status-danger'}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-dim)' }}>No logs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div>
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h2>Register Webhook</h2>
              <div style={{ marginBottom: '1rem' }}>
                <label>Callback URL</label>
                <input
                  value={newWebhookUrl}
                  onChange={e => setNewWebhookUrl(e.target.value)}
                  placeholder="https://api.example.com/webhook"
                  style={{ marginTop: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label>Events (comma separated)</label>
                <input
                  value={newWebhookEvents}
                  onChange={e => setNewWebhookEvents(e.target.value)}
                  placeholder="WALLET_CREATED, TRANSACTION_SENT"
                  style={{ marginTop: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label>Secret (Optional)</label>
                <input
                  type="password"
                  value={newWebhookSecret}
                  onChange={e => setNewWebhookSecret(e.target.value)}
                  placeholder="Signing secret"
                  style={{ marginTop: '0.5rem' }}
                />
              </div>
              <button className="primary" onClick={createWebhook}>Register Webhook</button>
            </div>

            <h3>Active Webhooks</h3>
            <div className="grid">
              {webhooks.map(wh => (
                <div key={wh.id} className="card">
                  <div style={{ wordBreak: 'break-all', fontWeight: 'bold', marginBottom: '0.5rem' }}>{wh.url}</div>
                  <div style={{ marginBottom: '1rem' }}>
                    {wh.events.map((ev: string) => (
                      <span key={ev} className="status-badge" style={{ marginRight: '0.5rem' }}>{ev}</span>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => deleteWebhook(wh.id)}
                      style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', fontSize: '0.8em', padding: '4px 8px' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {webhooks.length === 0 && <p style={{ color: 'var(--text-dim)' }}>No active webhooks.</p>}
            </div>
          </div>
        )}

        {activeTab === 'simulate' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div className="card">
              <h2>Transaction Simulation</h2>
              <p style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>Dry-run transactions against a forked chain state.</p>

              <div style={{ marginBottom: '1rem' }}>
                <label>To Address</label>
                <input value={simTo} onChange={e => setSimTo(e.target.value)} placeholder="0x..." style={{ marginTop: '0.5rem' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label>Value (ETH)</label>
                <input value={simValue} onChange={e => setSimValue(e.target.value)} placeholder="0.0" style={{ marginTop: '0.5rem' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label>Data (Hex)</label>
                <textarea value={simData} onChange={e => setSimData(e.target.value)} placeholder="0x..." rows={3} style={{ marginTop: '0.5rem' }} />
              </div>

              <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={checkPolicy} onChange={e => setCheckPolicy(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                <label>Check Policies</label>
              </div>

              <button className="primary" onClick={runSimulation}>Run Simulation</button>
            </div>

            {simResult && (
              <div className="card">
                <h3>Result</h3>
                <div style={{ marginBottom: '1rem' }}>
                  <span className={`status-badge ${simResult.success ? 'status-success' : 'status-danger'}`}>
                    {simResult.success ? 'Success' : 'Reverted'}
                  </span>
                </div>

                {simResult.policyStatus && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>Policy:</strong> <span className={`status-badge ${simResult.policyStatus === 'APPROVED' ? 'status-success' : 'status-danger'}`}>{simResult.policyStatus}</span>
                    {simResult.policyError && <div style={{ color: 'var(--danger)', fontSize: '0.9em', marginTop: '0.5rem' }}>{simResult.policyError}</div>}
                  </div>
                )}

                <pre>{JSON.stringify(simResult, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'decode' && (
          <div className="card" style={{ maxWidth: '800px' }}>
            <h2>Calldata Decoder</h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: '1rem' }}>Parse hex data into human-readable format.</p>

            <div style={{ marginBottom: '1rem' }}>
              <label>Calldata</label>
              <textarea value={decodeData} onChange={e => setDecodeData(e.target.value)} placeholder="0xa9059cbb..." rows={4} style={{ marginTop: '0.5rem' }} />
            </div>

            <button className="primary" onClick={runDecode} style={{ marginBottom: '2rem' }}>Decode</button>

            {decodeResult && (
              <div>
                <h3>Decoded Output</h3>
                {decodeResult.found ? (
                  <div style={{ background: '#000', padding: '1rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>function <strong>{decodeResult.name}</strong></div>
                    {decodeResult.args && Object.entries(decodeResult.args).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: '1rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-dim)', minWidth: '30px' }}>{k}:</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="status-badge status-danger">Unknown Function Signature</div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App;
