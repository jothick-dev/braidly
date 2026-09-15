import { useState, useEffect } from 'react'
import { Upload, Play, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react'
import { getBriefs, getSubmissions, uploadFiles, submitModule, runIntegration } from './lib/api'

const PERSON_COLORS = ['#F2B84B', '#6C8EF5', '#4ADE80', '#F87171', '#A78BFA', '#FB923C']

function StatusBadge({ status }) {
  const styles = {
    submitted: 'bg-green/15 text-green border-green/30',
    'in-progress': 'bg-amber/15 text-amber border-amber/30',
    'not-started': 'bg-surface text-text-dim border-border',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[status] || styles['not-started']}`}>
      {status === 'submitted' && <CheckCircle size={9} />}
      {status === 'in-progress' && <Clock size={9} />}
      {status === 'not-started' && <AlertCircle size={9} />}
      {status === 'submitted' ? 'Submitted' : status === 'in-progress' ? 'In Progress' : 'Not Started'}
    </span>
  )
}

export default function ModuleSubmissionView({ userName }) {
  const [briefs, setBriefs] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [integrating, setIntegrating] = useState(false)
  const [integrationReport, setIntegrationReport] = useState(null)
  const [uploadingModule, setUploadingModule] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [briefsData, subsData] = await Promise.all([getBriefs(), getSubmissions()])
      if (briefsData.analysis) setBriefs(briefsData)
      if (subsData.submissions) setSubmissions(subsData.submissions)
    } catch {} finally { setLoading(false) }
  }

  const modules = briefs?.briefs?.map((b, i) => {
    const sub = submissions.find(s => s.module === b.module || s.module === b.module?.replace(/\s+/g, '-'))
    return {
      name: b.module,
      owner: b.owner || 'Unassigned',
      role: `Module ${i + 1}`,
      status: sub ? 'submitted' : 'not-started',
      files: sub?.files || [],
      color: PERSON_COLORS[i % PERSON_COLORS.length],
    }
  }) || []

  const submittedCount = modules.filter(m => m.status === 'submitted').length
  const allSubmitted = modules.length > 0 && submittedCount === modules.length

  const handleFileUpload = async (moduleName, fileList) => {
    setUploadingModule(moduleName)
    try {
      await uploadFiles(moduleName, userName, fileList)
      await loadData()
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally { setUploadingModule(null) }
  }

  const handleIntegrate = async () => {
    setIntegrating(true)
    try {
      const report = await runIntegration()
      setIntegrationReport(report)
    } catch (err) {
      alert('Integration failed: ' + err.message)
    } finally { setIntegrating(false) }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-dim text-sm animate-pulse">Loading modules…</div>
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2">📋</div>
          <p className="text-sm text-text-dim">No modules yet.</p>
          <p className="text-[11px] text-text-dim/60 mt-1">Finalize the discussion in Team Chat to generate modules.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* Main table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-base font-bold text-text mb-1">Module Submission</h2>
          <p className="text-[11px] text-text-dim mb-4">Submit code files for each assigned module.</p>

          {/* Table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[10px] font-semibold text-text-dim uppercase tracking-wider px-4 py-3">Person Name</th>
                  <th className="text-left text-[10px] font-semibold text-text-dim uppercase tracking-wider px-4 py-3">Tech Role</th>
                  <th className="text-left text-[10px] font-semibold text-text-dim uppercase tracking-wider px-4 py-3">Module Name</th>
                  <th className="text-left text-[10px] font-semibold text-text-dim uppercase tracking-wider px-4 py-3">Submission</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                        <span className="text-xs text-text font-medium">{m.owner}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono text-text-dim">{m.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-accent">{m.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={m.status} />
                        {m.status === 'submitted' && m.files.length > 0 && (
                          <span className="text-[9px] text-text-dim">{m.files.length} files</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* File upload per module */}
          <div className="mt-4 space-y-2">
            {modules.map((m, i) => (
              <div key={i} className="flex items-center gap-3 bg-surface border border-border rounded-lg p-3">
                <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                <span className="text-xs font-mono text-text flex-shrink-0 w-32 truncate">{m.name}</span>
                <label className="flex-1 flex items-center gap-2 px-3 py-1.5 border border-dashed border-border rounded-lg hover:border-accent/30 cursor-pointer transition-colors">
                  <Upload size={12} className="text-text-dim" />
                  <span className="text-[10px] text-text-dim">
                    {uploadingModule === m.name ? 'Uploading…' : 'Drop files or click'}
                  </span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files.length) handleFileUpload(m.name, Array.from(e.target.files)) }}
                  />
                </label>
                {m.status === 'submitted' && <CheckCircle size={14} className="text-green" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integration panel */}
      <div className="w-72 border-l border-border bg-ink/50 p-4 flex flex-col flex-shrink-0">
        <h3 className="text-[11px] font-semibold text-text-dim uppercase tracking-wider mb-3">Integration</h3>
        <div className="bg-surface border border-border rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-text">{submittedCount} of {modules.length}</p>
          <p className="text-[10px] text-text-dim mt-0.5">modules submitted</p>
          <div className="mt-3 h-1.5 bg-ink rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${modules.length > 0 ? (submittedCount / modules.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        <button
          onClick={handleIntegrate}
          disabled={!allSubmitted || integrating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-ink font-semibold text-xs rounded-lg hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {integrating ? (
            <>Running…</>
          ) : (
            <><Play size={12} /> Run Integration</>
          )}
        </button>
        {!allSubmitted && modules.length > 0 && (
          <p className="text-[9px] text-text-dim/50 mt-2 text-center">All modules must be submitted to run integration.</p>
        )}

        {/* Integration report */}
        {integrationReport && (
          <div className="mt-4 bg-surface border border-border rounded-xl p-4 max-h-[60vh] overflow-y-auto">
            <h4 className="text-[10px] font-semibold text-text-dim uppercase mb-2">Report</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-dim">Status:</span>
                <span className={`text-[10px] font-medium ${integrationReport.overall_status === 'success' ? 'text-green' : integrationReport.overall_status === 'failure' ? 'text-red' : 'text-amber'}`}>
                  {integrationReport.overall_status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
              {integrationReport.summary && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-dim">Passed:</span>
                    <span className="text-[10px] text-green">{integrationReport.summary.passed}</span>
                    {integrationReport.summary.fixed > 0 && (
                      <span className="text-[10px] text-amber">+{integrationReport.summary.fixed} fixed</span>
                    )}
                    <span className="text-[10px] text-text-dim">/</span>
                    <span className="text-[10px] text-text-dim">{integrationReport.summary.total}</span>
                  </div>
                  {integrationReport.summary.failed > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-dim">Failed:</span>
                      <span className="text-[10px] text-red">{integrationReport.summary.failed}</span>
                    </div>
                  )}
                  {integrationReport.summary.warnings > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-dim">Warnings:</span>
                      <span className="text-[10px] text-amber">{integrationReport.summary.warnings}</span>
                    </div>
                  )}
                </div>
              )}
              {/* App name */}
              {integrationReport.app_name && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                  <span className="text-[10px] text-text-dim">App:</span>
                  <span className="text-[10px] text-accent font-medium">{integrationReport.app_name}</span>
                </div>
              )}
              {/* Per-module issues */}
              {integrationReport.modules?.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border/50 space-y-2">
                  {integrationReport.modules.map((mod, i) => {
                    const modWarnings = mod.issues?.filter(iss => iss.severity === 'warning') || []
                    const modCritical = mod.issues?.filter(iss => iss.severity === 'critical') || []
                    if (modWarnings.length === 0 && modCritical.length === 0) return null
                    return (
                      <div key={i} className="text-[9px]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono text-accent">{mod.module}</span>
                          <span className={`px-1 py-0.5 rounded text-[8px] font-medium ${
                            mod.status === 'pass' ? 'bg-green/15 text-green' :
                            mod.status === 'fail' ? 'bg-red/15 text-red' :
                            'bg-amber/15 text-amber'
                          }`}>{mod.status?.toUpperCase()}</span>
                        </div>
                        <ul className="space-y-0.5 pl-2">
                          {modCritical.map((iss, j) => (
                            <li key={j} className="flex items-start gap-1">
                              <span className="text-red">•</span>
                              <span className="text-text-dim"><span className="text-red font-mono">[{iss.rule}]</span> {iss.desc}</span>
                            </li>
                          ))}
                          {modWarnings.map((iss, j) => (
                            <li key={j} className="flex items-start gap-1">
                              <span className="text-amber">•</span>
                              <span className="text-text-dim"><span className="text-amber font-mono">[{iss.rule}]</span> {iss.desc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
