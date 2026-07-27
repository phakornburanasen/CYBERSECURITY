import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell } from 'recharts'
import * as XLSX from 'xlsx'
import './HomePage.css'

const API_URL = `http://${window.location.hostname}:8000/api/CyberSecurity`;

function ThreatIntel({ user, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const navigate = useNavigate()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [availableDates, setAvailableDates] = useState([])

  const [summaryData, setSummaryData] = useState([])
  const [viewType, setViewType] = useState('overview')
  const [intelData, setIntelData] = useState([])
  const [suspiciousData, setSuspiciousData] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!user || !token) {
      navigate('/login')
    } else {
      fetchAvailableDates()
    }
  }, [user, navigate])

  useEffect(() => {
    const dateStr = selectedDate ? selectedDate.toLocaleDateString('en-CA') : ''
    if (dateStr) {
      fetchSummaryData(dateStr)
    }
  }, [selectedDate])

  useEffect(() => {
    const dateStr = selectedDate ? selectedDate.toLocaleDateString('en-CA') : ''
    if (dateStr) {
      if (viewType === 'suspicious') {
        generateSuspiciousIps(dateStr)
      } else {
        fetchIntelData(dateStr, viewType)
      }
      setCurrentPage(1)
      setSearchTerm('')
    }
  }, [selectedDate, viewType])

  const fetchAvailableDates = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/logs_dates`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.success && data.dates) {
        const dates = data.dates.map(d => {
          const [year, month, day] = d.split('-').map(Number)
          return new Date(year, month - 1, day)
        })
        setAvailableDates(dates)
      }
    } catch (error) {
      console.error('Error fetching available dates:', error)
    }
  }

  const fetchSummaryData = async (date) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/threat_intel_summary?date=${date}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setSummaryData(data.data)
      }
    } catch (error) {
      console.error('Error fetching summary:', error)
    }
  }

  const fetchIntelData = async (date, type) => {
    setIsLoading(true)
    setMessage('')
    setIntelData([])
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/threat_intel_data?date=${date}&type=${type}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setIntelData(data.data)
      } else {
        setMessage('Failed to fetch data: ' + data.message)
      }
    } catch (error) {
      setMessage('Error fetching data')
    } finally {
      setIsLoading(false)
    }
  }

  const generateSuspiciousIps = async (date) => {
    setIsLoading(true)
    setMessage('')
    setSuspiciousData([])
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/generate_suspicious_ips`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date })
      })
      const data = await response.json()
      if (data.success) {
        setSuspiciousData(data.data)
      } else {
        setMessage('Failed to generate suspicious IPs: ' + data.message)
      }
    } catch (error) {
      setMessage('Error generating suspicious IPs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportExcel = () => {
    const dataToExport = viewType === 'suspicious' ? suspiciousData : intelData
    if (dataToExport.length === 0) return

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Threat Intel")
    const dateStr = selectedDate ? selectedDate.toLocaleDateString('en-CA') : 'data'
    XLSX.writeFile(wb, `threat_intel_${viewType}_${dateStr}.xlsx`)
  }

  const handleChartClick = (data) => {
    let clickedKey = null;

    if (data && data.activePayload && data.activePayload.length > 0) {
      clickedKey = data.activePayload[0].payload.key; // Chart container click
    } else if (data && data.activeLabel) {
      const clickedItem = summaryData.find(item => item.name === data.activeLabel);
      if (clickedItem) clickedKey = clickedItem.key;
    } else if (data && data.payload && data.payload.key) {
      clickedKey = data.payload.key; // Direct Bar click
    } else if (data && data.name) {
      const clickedItem = summaryData.find(item => item.name === data.name);
      if (clickedItem) clickedKey = clickedItem.key;
    } else if (data && data.value) {
      const clickedItem = summaryData.find(item => item.name === data.value);
      if (clickedItem) clickedKey = clickedItem.key;
    }

    if (clickedKey && clickedKey !== viewType) {
      setViewType(clickedKey)
    }
  }

  const handleYAxisClick = (tickData) => {
    if (tickData && tickData.value) {
      const clickedItem = summaryData.find(item => item.name === tickData.value)
      if (clickedItem && clickedItem.key !== viewType) {
        setViewType(clickedItem.key)
      }
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    onLogout()
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const filteredData = useMemo(() => {
    const dataToFilter = viewType === 'suspicious' ? suspiciousData : intelData
    if (!searchTerm) return dataToFilter

    const lowerSearch = searchTerm.toLowerCase()
    return dataToFilter.filter(item => {
      return Object.values(item).some(val =>
        String(val).toLowerCase().includes(lowerSearch)
      )
    })
  }, [intelData, suspiciousData, viewType, searchTerm])

  const filteredCount = useMemo(() => {
    if (viewType === 'suspicious') {
      return filteredData.length
    }
    return filteredData.reduce((sum, item) => sum + (item.count || 0), 0)
  }, [filteredData, viewType])

  const topFlows = useMemo(() => {
    if (viewType === 'suspicious') return []
    return filteredData.slice(0, 10)
  }, [filteredData, viewType])

  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1
  const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const viewTypeTitle = summaryData.find(d => d.key === viewType)?.name || viewType

  return (
    <div className="home-layout">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <div className="navbar-left">
          <button className="menu-btn" onClick={toggleSidebar}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="brand">
            <div className="brand-logo">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 7V12C4 16.5 7.5 20.7 12 22C16.5 20.7 20 16.5 20 12V7L12 2Z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 12L11 14L15 10"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>Cyber Security</h2>
          </div>
        </div>

        <div className="navbar-right">
          <div className="user-profile">
            <div className="avatar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 21V19C20 17.9391 19.5786 16.9216 18.5 16C17.4214 15.0784 16 15 15 15H9C8 15 6.57857 15.0784 5.5 16C4.42143 16.9216 4 17.9391 4 19V21M15 7C15 9.20914 13.2091 11 11 11C8.79086 11 7 9.20914 7 7C7 4.79086 8.79086 3 11 3C13.2091 3 15 4.79086 15 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="username">{user?.display_name || user?.username || 'Administrator'}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="main-wrapper">
        {/* Sidebar */}
        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <ul className="sidebar-menu">
            <li>
              <Link to="/homepage">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>Dashboard</span>
              </Link>
            </li>
            <li className="active">
              <Link to="/threat-intel">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>Threat Intel</span>
              </Link>
            </li>
            <li>
              <Link to="/analytics">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>Analytics</span>
              </Link>
            </li>
            <li>
              <Link to="/settings">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>Settings</span>
              </Link>
            </li>
          </ul>
        </aside>

        {/* Content Area */}
        <div className="content-container">
          <main className="main-content-area">
            <div className="dashboard-header">
              <div className="welcome-section">
                <h1>Threat Intel</h1>
                <p>Advanced Threat Analytics and Intelligence</p>
              </div>
              <div className="controls-group" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="date-picker-container">
                  <label htmlFor="logDate">Select Date: </label>
                  <DatePicker
                    id="logDate"
                    selected={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    className="date-input"
                    dateFormat="dd/MM/yyyy"
                    dayClassName={(date) => {
                      const isAvailable = availableDates.some(
                        (d) =>
                          d.getDate() === date.getDate() &&
                          d.getMonth() === date.getMonth() &&
                          d.getFullYear() === date.getFullYear()
                      );
                      return isAvailable ? 'react-datepicker__day--highlighted-custom' : 'react-datepicker__day--no-data';
                    }}
                    placeholderText="Select a date"
                  />
                </div>
              </div>
            </div>

            {/* Summary Bar Chart */}
            <div className="chart-card" style={{ marginBottom: '2rem' }}>
              <h3>Threat Intelligence Overview (Click bar to view details)</h3>
              <div className="overview-container" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', minHeight: '300px' }}>
                <div className="chart-wrapper" style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summaryData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      onClick={handleChartClick}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" />
                      <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} stroke="#64748b" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        tick={{ fontSize: 12, fill: '#64748b', cursor: 'pointer' }}
                        onClick={handleYAxisClick}
                      />
                      <RechartsTooltip formatter={(value) => value.toLocaleString()} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' }} />
                      <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                        minPointSize={5}
                        label={{ position: 'right', formatter: (value) => value.toLocaleString(), fill: '#64748b', fontSize: 12 }}
                        onClick={handleChartClick}
                      >
                        {summaryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.key === viewType ? '#0ea5e9' : '#38bdf8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="top-ips-card">
                  <h4>
                    <span className="title-accent">Top 10 IP Flows <span style={{ fontWeight: 'normal', color: '#64748b' }}>({viewTypeTitle})</span></span>
                    <span className="subtitle-text">Sorted by count</span>
                  </h4>
                  <div className="top-ips-scroll">
                    {topFlows.length > 0 ? (
                      <table className="top-flows-table">
                        <thead>
                          <tr>
                            <th style={{ width: '30px' }}>#</th>
                            <th>Source IP</th>
                            <th style={{ width: '25px', textAlign: 'center' }}></th>
                            <th>Destination IP</th>
                            <th style={{ textAlign: 'right', width: '70px' }}>Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topFlows.map((flow, index) => (
                            <tr
                              key={index}
                              title={`Source IP: ${flow.source_ip}\nSeverity: ${flow.severity || 'N/A'}\nThreat Subtype: ${flow.threat_subtype || 'N/A'}\nDestination IP: ${flow.destination_ip}\nCount: ${flow.count.toLocaleString()}\nDate Attack : ${flow.created_at || 'N/A'}`}
                              style={{ cursor: 'help' }}
                            >
                              <td className="flow-index">{index + 1}</td>
                              <td>
                                <span className="ip-badge source">{flow.source_ip}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="flow-arrow">→</span>
                              </td>
                              <td>
                                <span className="ip-badge dest">{flow.destination_ip}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="flow-count">{flow.count.toLocaleString()}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="top-flows-empty">
                        No flow data available for this view.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {message && (
              <div className="alert-message" style={{ padding: '1rem', backgroundColor: '#064e3b', color: '#34d399', borderRadius: '4px', marginBottom: '1rem' }}>
                {message}
              </div>
            )}

            {/* Data Table */}
            <div className="table-card">
              <div className="table-header-row">
                <h3>
                  {viewTypeTitle} Details ({filteredCount.toLocaleString()})
                  {selectedDate && ` - ${selectedDate.toLocaleDateString('en-GB')}`}
                </h3>
                <div className="table-actions">
                  <div className="search-container">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="search-input"
                    />
                    {searchTerm && (
                      <button
                        className="clear-search-btn"
                        onClick={() => setSearchTerm('')}
                        title="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="rows-select">
                    <option value={10}>10 rows</option>
                    <option value={20}>20 rows</option>
                    <option value={50}>50 rows</option>
                  </select>
                  <button onClick={handleExportExcel} className="export-btn" disabled={filteredData.length === 0}>
                    Export to Excel
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="cyber-loader-container">
                  <div className="cyber-pulse">
                    <div className="cyber-pulse-core"></div>
                  </div>
                  <div className="loading-text">Processing...</div>
                </div>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="cyber-table">
                      <thead>
                        {viewType === 'suspicious' ? (
                          <tr>
                            <th>#</th>
                            <th>Suspicious IP</th>
                            <th>Created At</th>
                          </tr>
                        ) : (
                          <tr>
                            <th>#</th>
                            <th>Source IP</th>
                            <th>Severity</th>
                            <th>Threat Subtype</th>
                            <th>Destination IP</th>
                            <th>Count</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {paginatedData.length > 0 ? paginatedData.map((item, index) => {
                          const realIndex = (currentPage - 1) * rowsPerPage + index + 1
                          if (viewType === 'suspicious') {
                            return (
                              <tr key={index}>
                                <td>{realIndex}</td>
                                <td><span className="ip-badge source">{item.suspic_ip}</span></td>
                                <td>{item.created_at}</td>
                              </tr>
                            )
                          } else {
                            const severityColors = {
                              'Critical': '#ff0000',
                              'High': '#ff4500',
                              'Medium': '#ffd700',
                              'Low': '#90ee90'
                            }
                            return (
                              <tr key={index}>
                                <td>{realIndex}</td>
                                <td><span className="ip-badge source">{item.source_ip}</span></td>
                                <td>
                                  <span className="severity-badge" style={{ backgroundColor: severityColors[item.severity] || '#ccc' }}>
                                    {item.severity}
                                  </span>
                                </td>
                                <td>{item.threat_subtype}</td>
                                <td><span className="ip-badge dest">{item.destination_ip}</span></td>
                                <td><strong>{item.count}</strong></td>
                              </tr>
                            )
                          }
                        }) : (
                          <tr>
                            <td colSpan={viewType === 'suspicious' ? 3 : 6} className="text-center py-4">No data available for this selection.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="pagination-container">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="page-btn"
                      >
                        Previous
                      </button>
                      <span className="page-info">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="page-btn"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>

          {/* Footer */}
          <footer className="bottom-footer">
            <div className="footer-content">
              <div className="footer-left">
                <p>&copy; 2026 Cyber Security Platform. All rights reserved.</p>
              </div>
              <div className="footer-right">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Support</a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default ThreatIntel
