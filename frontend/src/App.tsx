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
  const [activeTab, setActiveTab] = useState<'wallets' | 'simulate' | 'policy' | 'decode'>('wallets');
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

  return (
    <div className="container">
      <header className="header">
        <div className="logo">EVM<span>//</span>MIDDLEWARE</div>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.9em' }}>Connected: ADMIN</div>
      </header>

      <div className="tabs">
        <button className={`tab ${activeTab === 'wallets' ? 'active' : ''}`} onClick={() => setActiveTab('wallets')}>Wallets</button>
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
