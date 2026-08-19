import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from 'recharts'
import * as XLSX from 'xlsx'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './HomePage.css'
const API_URL = `http://${window.location.hostname}:8000/api/CyberSecurity`;

// --- Sub-component: Node Flow Map Visualizer (Top 30 Flows) ---
function NodeFlowVisualizer({ filteredLogs, activeFilter }) {
  const [hoveredNode, setHoveredNode] = useState(null); // { ip: string, type: 'source' | 'target' }
  const [hoveredFlow, setHoveredFlow] = useState(null); // { source: string, target: string }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [pinnedNode, setPinnedNode] = useState(null); // { ip: string, type: 'source' | 'target', x: number, y: number }
  const [flowLimit, setFlowLimit] = useState(30); // 10, 30, 50, 100

  useEffect(() => {
    if (!pinnedNode) return;

    const handleOutsideClick = (e) => {
      if (e.target.closest('.node-flow-tooltip')) {
        return;
      }
      setPinnedNode(null);
    };

    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [pinnedNode]);

  const handleMouseMove = (e) => {
    // Only track mouse position if there is no pinned node
    if (!pinnedNode) {
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const nodeFlows = useMemo(() => {
    const flows = {};
    filteredLogs.forEach(log => {
      const src = log.source_ip || 'Unknown';
      const dest = log.destination_ip || 'Unknown';
      const severity = log.severity || 'Medium';
      const type = log.threat_type || 'Unknown';
      const subtype = log.threat_subtype || 'Unknown';
      const key = `${src}->${dest}`;
      if (!flows[key]) {
        flows[key] = {
          source: src,
          target: dest,
          count: 0,
          severity: severity,
          severities: new Set(),
          threat_types: new Set(),
          threat_subtypes: new Set(),
        };
      }
      flows[key].count += 1;
      flows[key].severities.add(severity);
      flows[key].threat_types.add(type);
      flows[key].threat_subtypes.add(subtype);
    });

    return Object.values(flows)
      .sort((a, b) => b.count - a.count)
      .slice(0, flowLimit)
      .map(flow => ({
        ...flow,
        severities: Array.from(flow.severities),
        threat_types: Array.from(flow.threat_types),
        threat_subtypes: Array.from(flow.threat_subtypes),
      }));
  }, [filteredLogs, flowLimit]);

  const uniqueSources = useMemo(() => {
    return Array.from(new Set(nodeFlows.map(f => f.source))).sort();
  }, [nodeFlows]);

  const uniqueTargets = useMemo(() => {
    return Array.from(new Set(nodeFlows.map(f => f.target))).sort();
  }, [nodeFlows]);

  const maxNodes = Math.max(uniqueSources.length, uniqueTargets.length);
  const H = Math.max(350, maxNodes * 45 + 50);

  const srcPositions = useMemo(() => {
    const pos = {};
    const len = uniqueSources.length;
    uniqueSources.forEach((src, idx) => {
      const y = len > 1 ? 40 + idx * (H - 80) / (len - 1) : H / 2;
      pos[src] = y;
    });
    return pos;
  }, [uniqueSources, H]);

  const destPositions = useMemo(() => {
    const pos = {};
    const len = uniqueTargets.length;
    uniqueTargets.forEach((dest, idx) => {
      const y = len > 1 ? 40 + idx * (H - 80) / (len - 1) : H / 2;
      pos[dest] = y;
    });
    return pos;
  }, [uniqueTargets, H]);

  // Check if a specific flow is active/hovered
  const getFlowHighlightState = (flow) => {
    if (!pinnedNode && !hoveredNode && !hoveredFlow) return 'default';

    if (pinnedNode) {
      if (pinnedNode.type === 'source' && pinnedNode.ip === flow.source) {
        return 'active';
      }
      if (pinnedNode.type === 'target' && pinnedNode.ip === flow.target) {
        return 'active';
      }
      return 'faded';
    }

    if (hoveredFlow) {
      if (hoveredFlow.source === flow.source && hoveredFlow.target === flow.target) {
        return 'active';
      }
      return 'faded';
    }

    if (hoveredNode) {
      if (hoveredNode.type === 'source' && hoveredNode.ip === flow.source) {
        return 'active';
      }
      if (hoveredNode.type === 'target' && hoveredNode.ip === flow.target) {
        return 'active';
      }
      return 'faded';
    }

    return 'default';
  };

  const getSeverityColor = (sev) => {
    const colors = {
      'Critical': '#ef4444',
      'High': '#f97316',
      'Medium': '#eab308',
      'Low': '#3b82f6'
    };
    return colors[sev] || '#64748b';
  };

  // Find info of hovered item to display in the card detail header
  const renderHoverInfo = () => {
    if (hoveredFlow) {
      return (
        <div className="flow-hover-info-detail" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', padding: '0.2rem 0' }}>
          <span>เส้นทางเชื่อมต่อ: </span>
          <strong className="ip-badge source">{hoveredFlow.source}</strong>
          <span className="arrow-text"> → </span>
          <strong className="ip-badge dest">{hoveredFlow.target}</strong>
          <span className="stat-divider" style={{ color: '#cbd5e1' }}>|</span>

          <span>ความรุนแรง: </span>
          <div style={{ display: 'inline-flex', gap: '4px' }}>
            {hoveredFlow.severities.map(sev => (
              <span key={sev} className="severity-badge" style={{ backgroundColor: getSeverityColor(sev), fontSize: '11px', padding: '2px 8px' }}>
                {sev}
              </span>
            ))}
          </div>
          <span className="stat-divider" style={{ color: '#cbd5e1' }}>|</span>

          <span>ประเภทภัยคุกคาม (Threat Type): </span>
          <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
            {hoveredFlow.threat_types.map(t => (
              <span key={t} style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '500', border: '1px solid #e2e8f0' }}>
                {t}
              </span>
            ))}
          </div>
          <span className="stat-divider" style={{ color: '#cbd5e1' }}>|</span>

          <span>ประเภทย่อย (Subtype): </span>
          <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
            {hoveredFlow.threat_subtypes.map(st => (
              <span key={st} style={{ backgroundColor: '#f8fafc', color: '#64748b', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '500', border: '1px solid #f1f5f9' }}>
                {st}
              </span>
            ))}
          </div>
          <span className="stat-divider" style={{ color: '#cbd5e1' }}>|</span>

          <span>จำนวนการโจมตี: </span>
          <span className="stat-count" style={{ fontWeight: '700', color: '#ef4444', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>{hoveredFlow.count.toLocaleString()} ครั้ง</span>
        </div>
      );
    }
    if (hoveredNode) {
      const connections = nodeFlows.filter(f =>
        hoveredNode.type === 'source' ? f.source === hoveredNode.ip : f.target === hoveredNode.ip
      );

      const allSeverities = Array.from(new Set(connections.flatMap(c => c.severities)));
      const allThreatTypes = Array.from(new Set(connections.flatMap(c => c.threat_types)));
      const allThreatSubtypes = Array.from(new Set(connections.flatMap(c => c.threat_subtypes)));
      const totalCount = connections.reduce((sum, f) => sum + f.count, 0);

      return (
        <div className="flow-hover-info-detail" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', padding: '0.2rem 0' }}>
          <span>IP ที่ชี้: </span>
          <strong className={`ip-badge ${hoveredNode.type}`} style={{ fontSize: '0.9rem', padding: '4px 10px' }}>
            {hoveredNode.ip} ({hoveredNode.type === 'source' ? 'Source' : 'Destination'})
          </strong>
          <span className="stat-divider" style={{ color: '#cbd5e1' }}>|</span>

          <span>เส้นทางเชื่อมต่อ: </span>
          <strong style={{ color: '#0f172a', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>{connections.length.toLocaleString()} เส้นทาง</strong>
          <span className="stat-divider" style={{ color: '#cbd5e1' }}>|</span>

          <span>ความรุนแรง (Severity): </span>
          <div style={{ display: 'inline-flex', gap: '4px' }}>
            {allSeverities.map(sev => (
              <span key={sev} className="severity-badge" style={{ backgroundColor: getSeverityColor(sev), fontSize: '11px', padding: '2px 8px' }}>
                {sev}
              </span>
            ))}
          </div>
          <span className="stat-divider" style={{ color: '#cbd5e1' }}>|</span>

          <span>ประเภทภัยคุกคาม (Threat Type): </span>
          <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
            {allThreatTypes.map(t => (
              <span key={t} style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '500', border: '1px solid #e2e8f0' }}>
                {t}
              </span>
            ))}
          </div>
          <span className="stat-divider" style={{ color: '#cbd5e1' }}>|</span>

          <span>ประเภทย่อย (Subtype): </span>
          <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
            {allThreatSubtypes.map(st => (
              <span key={st} style={{ backgroundColor: '#f8fafc', color: '#64748b', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '500', border: '1px solid #f1f5f9' }}>
                {st}
              </span>
            ))}
          </div>
          <span className="stat-divider" style={{ color: '#cbd5e1' }}>|</span>

          <span>จำนวน Log รวม: </span>
          <span className="stat-count" style={{ fontWeight: '700', color: '#ef4444', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>{totalCount.toLocaleString()} ครั้ง</span>
        </div>
      );
    }
    return <span className="hover-tip-placeholder" style={{ fontStyle: 'italic', color: '#94a3b8' }}>ชี้ที่ Node หรือเส้นเชื่อมต่อ (Bezier Link) เพื่อแสดงรายละเอียดข้อมูลการเชื่อมต่อแบบเรียลไทม์</span>;
  };

  const isPinned = !!pinnedNode;
  const displayNode = pinnedNode || hoveredNode;
  const displayFlow = isPinned ? null : hoveredFlow;

  const tooltipX = isPinned ? pinnedNode.x : mousePos.x;
  const tooltipY = isPinned ? pinnedNode.y : mousePos.y;

  return (
    <div className="table-card node-flow-card" style={{ marginTop: '2rem', position: 'relative' }} onMouseMove={handleMouseMove}>
      <div className="table-header-row" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <h3>
          Threat Connection Map (Top {flowLimit} Flows)
          {activeFilter.type ? (
            <span className="active-filter-badge" style={{ fontSize: '0.8rem' }}>
              Filtered by {activeFilter.value}
            </span>
          ) : (
            <span className="active-filter-badge" style={{ fontSize: '0.8rem', backgroundColor: '#f1f5f9', color: '#64748b' }}>
              ทั้งหมด (All Logs)
            </span>
          )}
        </h3>
        <div className="table-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select
            value={flowLimit}
            onChange={(e) => setFlowLimit(Number(e.target.value))}
            className="rows-select"
            style={{ cursor: 'pointer' }}
          >
            <option value={10}>Top 10 Flows</option>
            <option value={30}>Top 30 Flows</option>
            <option value={50}>Top 50 Flows</option>
            <option value={100}>Top 100 Flows</option>
          </select>
          <div className="node-flow-legend" style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span> Critical
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f97316' }}></span> High
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308' }}></span> Medium
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span> Low
            </span>
          </div>
        </div>
      </div>

      {/* Hover Info bar */}
      <div className="node-flow-info-bar" style={{
        background: '#f8fafc',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        marginBottom: '1rem',
        fontSize: '0.9rem',
        border: '1px solid #e2e8f0',
        minHeight: '40px',
        display: 'flex',
        alignItems: 'center',
        color: '#475569'
      }}>
        {renderHoverInfo()}
      </div>

      {nodeFlows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          ไม่พบข้อมูลเส้นทางเชื่อมโยงสำหรับตัวกรองนี้
        </div>
      ) : (
        <div className="node-flow-wrapper" style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '8px', padding: '1rem 0' }}>
          <svg viewBox={`0 0 900 ${H}`} width="100%" height={H} style={{ display: 'block', margin: '0 auto', maxWidth: '900px' }}>
            {/* Draw lines (Bezier paths) in background */}
            <g>
              {nodeFlows.map((flow, index) => {
                const y1 = srcPositions[flow.source];
                const y2 = destPositions[flow.target];
                const state = getFlowHighlightState(flow);

                let strokeWidth = 2;
                let opacity = 0.5;
                if (state === 'active') {
                  strokeWidth = 5.5; // Thicker active path
                  opacity = 0.95;
                } else if (state === 'faded') {
                  strokeWidth = 0.75;
                  opacity = 0.08;
                }

                const color = getSeverityColor(flow.severity);
                const isActive = state === 'active';

                return (
                  <g key={`flow-group-${index}`}>
                    {/* Laser glow background path */}
                    <path
                      d={`M 200 ${y1} C 450 ${y1}, 450 ${y2}, 700 ${y2}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      opacity={opacity}
                      style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                      onMouseEnter={() => {
                        if (!pinnedNode) setHoveredFlow(flow);
                      }}
                      onMouseLeave={() => {
                        if (!pinnedNode) setHoveredFlow(null);
                      }}
                    />
                    {/* Glowing white laser core overlay */}
                    {isActive && (
                      <path
                        d={`M 200 ${y1} C 450 ${y1}, 450 ${y2}, 700 ${y2}`}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        opacity="0.9"
                        style={{ pointerEvents: 'none', transition: 'all 0.2s ease' }}
                      />
                    )}
                  </g>
                );
              })}
            </g>

            {/* Draw Source Nodes (Left) */}
            <g>
              {uniqueSources.map((src, index) => {
                const y = srcPositions[src];
                const isHovered = (pinnedNode && pinnedNode.type === 'source' && pinnedNode.ip === src) ||
                  (!pinnedNode && hoveredNode && hoveredNode.type === 'source' && hoveredNode.ip === src);
                const isFaded = (pinnedNode && (pinnedNode.type !== 'source' || pinnedNode.ip !== src)) ||
                  (!pinnedNode && hoveredNode && (hoveredNode.type !== 'source' || hoveredNode.ip !== src));

                let rectStroke = '#bfdbfe';
                let rectFill = '#eff6ff';
                let textFill = '#1d4ed8';

                if (isHovered) {
                  rectStroke = '#1d4ed8';
                  rectFill = '#dbeafe';
                }

                return (
                  <g
                    key={`src-${index}`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => {
                      if (!pinnedNode) setHoveredNode({ ip: src, type: 'source' });
                    }}
                    onMouseLeave={() => {
                      if (!pinnedNode) setHoveredNode(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPinnedNode({ ip: src, type: 'source', x: e.clientX, y: e.clientY });
                      setHoveredNode(null);
                    }}
                  >
                    {/* Main Node Card */}
                    <rect
                      x="20"
                      y={y - 16}
                      width="180"
                      height="32"
                      rx="4"
                      fill={rectFill}
                      stroke={rectStroke}
                      strokeWidth={isHovered ? 1.8 : 1.2}
                      opacity={isFaded ? 0.35 : 1}
                      style={{ transition: 'all 0.15s ease' }}
                    />
                    {/* High-tech vertical status strip indicator */}
                    <path
                      d={`M 20 ${y - 10} L 20 ${y + 10}`}
                      stroke={isHovered ? '#1d4ed8' : '#3b82f6'}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      opacity={isFaded ? 0.35 : 1}
                      style={{ transition: 'all 0.15s ease' }}
                    />
                    {/* Computer monitor/workstation cyber icon */}
                    <rect
                      x="28"
                      y={y - 7}
                      width="14"
                      height="10"
                      rx="1"
                      fill="none"
                      stroke={textFill}
                      strokeWidth="1.2"
                      opacity={isFaded ? 0.35 : 1}
                      style={{ transition: 'all 0.15s ease' }}
                    />
                    <path
                      d={`M 31 ${y + 3} L 39 ${y + 3} M 35 ${y + 3} L 35 ${y + 6}`}
                      fill="none"
                      stroke={textFill}
                      strokeWidth="1.2"
                      opacity={isFaded ? 0.35 : 1}
                      style={{ transition: 'all 0.15s ease' }}
                    />
                    {/* Source IP Address */}
                    <text
                      x="116"
                      y={y + 4}
                      textAnchor="middle"
                      fill={textFill}
                      fontSize="11"
                      fontWeight={isHovered ? "800" : "600"}
                      fontFamily="ui-monospace, Consolas, monospace"
                      opacity={isFaded ? 0.35 : 1}
                      style={{ transition: 'all 0.15s ease' }}
                    >
                      {src}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Draw Destination Nodes (Right) */}
            <g>
              {uniqueTargets.map((dest, index) => {
                const y = destPositions[dest];
                const isHovered = (pinnedNode && pinnedNode.type === 'target' && pinnedNode.ip === dest) ||
                  (!pinnedNode && hoveredNode && hoveredNode.type === 'target' && hoveredNode.ip === dest);
                const isFaded = (pinnedNode && (pinnedNode.type !== 'target' || pinnedNode.ip !== dest)) ||
                  (!pinnedNode && hoveredNode && (hoveredNode.type !== 'target' || hoveredNode.ip !== dest));

                let rectStroke = '#bbf7d0';
                let rectFill = '#f0fdf4';
                let textFill = '#15803d';

                if (isHovered) {
                  rectStroke = '#15803d';
                  rectFill = '#dcfce7';
                }

                return (
                  <g
                    key={`dest-${index}`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => {
                      if (!pinnedNode) setHoveredNode({ ip: dest, type: 'target' });
                    }}
                    onMouseLeave={() => {
                      if (!pinnedNode) setHoveredNode(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPinnedNode({ ip: dest, type: 'target', x: e.clientX, y: e.clientY });
                      setHoveredNode(null);
                    }}
                  >
                    {/* Main Node Card */}
                    <rect
                      x="700"
                      y={y - 16}
                      width="180"
                      height="32"
                      rx="4"
                      fill={rectFill}
                      stroke={rectStroke}
                      strokeWidth={isHovered ? 1.8 : 1.2}
                      opacity={isFaded ? 0.35 : 1}
                      style={{ transition: 'all 0.15s ease' }}
                    />
                    {/* High-tech vertical status strip indicator */}
                    <path
                      d={`M 880 ${y - 10} L 880 ${y + 10}`}
                      stroke={isHovered ? '#15803d' : '#10b981'}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      opacity={isFaded ? 0.35 : 1}
                      style={{ transition: 'all 0.15s ease' }}
                    />
                    {/* Computer monitor/workstation cyber icon */}
                    <rect
                      x="708"
                      y={y - 7}
                      width="14"
                      height="10"
                      rx="1"
                      fill="none"
                      stroke={textFill}
                      strokeWidth="1.2"
                      opacity={isFaded ? 0.35 : 1}
                      style={{ transition: 'all 0.15s ease' }}
                    />
                    <path
                      d={`M 711 ${y + 3} L 719 ${y + 3} M 715 ${y + 3} L 715 ${y + 6}`}
                      fill="none"
                      stroke={textFill}
                      strokeWidth="1.2"
                      opacity={isFaded ? 0.35 : 1}
                      style={{ transition: 'all 0.15s ease' }}
                    />
                    {/* Destination IP Address */}
                    <text
                      x="796"
                      y={y + 4}
                      textAnchor="middle"
                      fill={textFill}
                      fontSize="11"
                      fontWeight={isHovered ? "800" : "600"}
                      fontFamily="ui-monospace, Consolas, monospace"
                      opacity={isFaded ? 0.35 : 1}
                      style={{ transition: 'all 0.15s ease' }}
                    >
                      {dest}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}

      {(displayFlow || displayNode) && (() => {
        const estimatedWidth = 400;
        const estimatedHeight = displayNode ? 385 : 225;

        let leftPos = tooltipX + 15;
        let topPos = tooltipY + 15;

        // If it goes off-screen horizontally, render it to the left side of the cursor
        if (leftPos + estimatedWidth > window.innerWidth) {
          leftPos = tooltipX - estimatedWidth - 15;
        }

        // If it goes off-screen vertically, render it above the cursor
        if (topPos + estimatedHeight > window.innerHeight) {
          topPos = tooltipY - estimatedHeight - 15;
        }

        // Safeguard to ensure it stays inside the viewport bounds
        leftPos = Math.max(10, Math.min(leftPos, window.innerWidth - estimatedWidth - 10));
        topPos = Math.max(10, Math.min(topPos, window.innerHeight - estimatedHeight - 10));

        const tooltipStyle = {
          position: 'fixed',
          left: `${leftPos}px`,
          top: `${topPos}px`,
          zIndex: 9999,
          pointerEvents: isPinned ? 'auto' : 'none',
          backgroundColor: '#ffffff',
          border: isPinned ? '2px solid #3b82f6' : '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: isPinned
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 2px rgba(59, 130, 246, 0.1)'
            : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          padding: '1.2rem',
          width: `${estimatedWidth}px`,
          fontSize: '0.85rem',
          color: '#334155',
          lineHeight: '1.5',
          fontFamily: 'Inter, system-ui, sans-serif',
        };

        return (
          <div className="node-flow-tooltip" style={tooltipStyle}>
            {displayFlow && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.9rem' }}>🛡️ เส้นทางการเชื่อมต่อ (Attack Flow Path)</span>
                  <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: '700', fontSize: '10px', padding: '2px 8px', borderRadius: '12px' }}>
                    Top {flowLimit} Flow
                  </span>
                </div>

                <div style={{ marginBottom: '0.75rem', backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>SOURCE IP (เครื่องต้นทาง):</span>
                    <strong style={{ fontFamily: 'monospace', color: '#1d4ed8', fontSize: '0.85rem' }}>{displayFlow.source}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px 0' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '11px' }}>↓ (เชื่อมต่อไปยัง)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>DESTINATION IP (เครื่องปลายทาง):</span>
                    <strong style={{ fontFamily: 'monospace', color: '#15803d', fontSize: '0.85rem' }}>{displayFlow.target}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', rowGap: '6px', fontSize: '11px', color: '#475569' }}>
                  <span style={{ fontWeight: '600' }}>ระดับความรุนแรง:</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {displayFlow.severities.map(sev => (
                      <span key={sev} style={{ backgroundColor: getSeverityColor(sev), color: '#ffffff', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                        {sev}
                      </span>
                    ))}
                  </div>

                  <span style={{ fontWeight: '600' }}>ประเภทภัยคุกคาม:</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {displayFlow.threat_types.map(t => (
                      <span key={t} style={{ backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                        {t}
                      </span>
                    ))}
                  </div>

                  <span style={{ fontWeight: '600' }}>ประเภทย่อย:</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {displayFlow.threat_subtypes.map(st => (
                      <span key={st} style={{ backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', fontSize: '10px', padding: '1px 6px', borderRadius: '4px' }}>
                        {st}
                      </span>
                    ))}
                  </div>

                  <span style={{ fontWeight: '600' }}>จำนวนครั้งที่พบ:</span>
                  <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>{displayFlow.count.toLocaleString()} ครั้ง</strong>
                </div>
              </div>
            )}

            {displayNode && (() => {
              const connections = nodeFlows.filter(f =>
                displayNode.type === 'source' ? f.source === displayNode.ip : f.target === displayNode.ip
              );
              const allSeverities = Array.from(new Set(connections.flatMap(c => c.severities)));
              const allThreatTypes = Array.from(new Set(connections.flatMap(c => c.threat_types)));
              const allThreatSubtypes = Array.from(new Set(connections.flatMap(c => c.threat_subtypes)));
              const totalCount = connections.reduce((sum, f) => sum + f.count, 0);

              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isPinned ? '📌 ' : '🔍 '}รายละเอียด Node IP (IP Details)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ backgroundColor: displayNode.type === 'source' ? '#eff6ff' : '#f0fdf4', color: displayNode.type === 'source' ? '#1d4ed8' : '#15803d', fontWeight: '700', fontSize: '10px', padding: '2px 8px', borderRadius: '12px' }}>
                        {displayNode.type === 'source' ? 'Source Node' : 'Destination Node'}
                      </span>
                      {isPinned && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinnedNode(null);
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            e.currentTarget.style.color = '#ef4444';
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            marginLeft: '8px',
                            transition: 'all 0.2s ease',
                          }}
                          title="ปิดป้ายข้อมูล"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: '0.75rem', backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>IP ADDRESS:</span>
                      <strong style={{ fontFamily: 'monospace', color: displayNode.type === 'source' ? '#1d4ed8' : '#15803d', fontSize: '0.95rem' }}>{displayNode.ip}</strong>
                    </div>
                  </div>

                  {/* List of active flow connections showing both Source & Dest completely! */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>การสื่อสารที่เชื่อมโยง ({connections.length.toLocaleString()} เส้นทาง):</span>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#ffffff' }}>
                      {connections.map((c, i) => {
                        return (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: '6px 8px', borderBottom: i < connections.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: '10px', gap: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontFamily: 'monospace', color: '#334155' }}>
                                <span style={{ color: '#1d4ed8' }}>{c.source}</span> ➔ <span style={{ color: '#15803d' }}>{c.target}</span>
                              </span>
                              <strong style={{ color: '#ef4444' }}>{c.count.toLocaleString()} ครั้ง</strong>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              <span style={{ backgroundColor: getSeverityColor(c.severity), color: '#ffffff', fontSize: '8px', padding: '0.5px 4px', borderRadius: '3px', fontWeight: '700' }}>{c.severity}</span>
                              {c.threat_types.map(t => (
                                <span key={t} style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '8px', padding: '0.5px 4px', borderRadius: '3px' }}>{t}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', rowGap: '6px', fontSize: '11px', color: '#475569' }}>
                    <span style={{ fontWeight: '600' }}>ความรุนแรงทั้งหมด:</span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {allSeverities.map(sev => (
                        <span key={sev} style={{ backgroundColor: getSeverityColor(sev), color: '#ffffff', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          {sev}
                        </span>
                      ))}
                    </div>

                    <span style={{ fontWeight: '600' }}>ประเภทภัยทั้งหมด:</span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {allThreatTypes.map(t => (
                        <span key={t} style={{ backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                          {t}
                        </span>
                      ))}
                    </div>

                    <span style={{ fontWeight: '600' }}>ประเภทย่อยทั้งหมด:</span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {allThreatSubtypes.map(st => (
                        <span key={st} style={{ backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', fontSize: '10px', padding: '1px 6px', borderRadius: '4px' }}>
                          {st}
                        </span>
                      ))}
                    </div>

                    <span style={{ fontWeight: '600' }}>จำนวน Log รวม:</span>
                    <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>{totalCount.toLocaleString()} ครั้ง</strong>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}
    </div>
  );
}

function HomePage({ user, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Default to today
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [availableDates, setAvailableDates] = useState([])

  // Filtering and Pagination state
  const [activeFilter, setActiveFilter] = useState({ type: null, value: null })
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  useEffect(() => {
    setCurrentPage(1)
  }, [logs, activeFilter, searchTerm, rowsPerPage])

  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!user || !token) {
      navigate('/login')
    }
  }, [user, navigate])

  useEffect(() => {
    fetchAvailableDates()
  }, [])

  useEffect(() => {
    // Convert local Date object to YYYY-MM-DD for API call
    const dateStr = selectedDate ? selectedDate.toLocaleDateString('en-CA') : ''
    if (dateStr) fetchLogs(dateStr)
  }, [selectedDate])

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
        // Convert 'YYYY-MM-DD' strings to Date objects for react-datepicker
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

  const fetchLogs = async (date) => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/logs_cyber?date=${date}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setLogs(data.data)
      } else {
        console.error('Failed to fetch logs:', data.message)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setIsLoading(false)
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

  // --- Data Processing for Charts ---

  // 1. Severity Pie Chart
  const severityColors = {
    'Critical': '#ff0000',
    'High': '#ff4500',
    'Medium': '#ffd700',
    'Low': '#90ee90'
  }

  const severityCounts = logs.reduce((acc, log) => {
    const sev = log.severity || 'Unknown'
    acc[sev] = (acc[sev] || 0) + 1
    return acc
  }, {})

  const pieData = Object.keys(severityCounts).map(key => ({
    name: key,
    value: severityCounts[key]
  }))

  // 2. Threat Types Bar Chart
  const typeCounts = logs.reduce((acc, log) => {
    const type = log.threat_type || 'Unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  const threatTypeData = Object.keys(typeCounts).map(key => ({
    name: key,
    count: typeCounts[key]
  })).sort((a, b) => b.count - a.count).slice(0, 5) // Top 5

  // 3. Threat Subtypes Bar Chart
  const subtypeCounts = logs.reduce((acc, log) => {
    const subtype = log.threat_subtype || 'Unknown'
    acc[subtype] = (acc[subtype] || 0) + 1
    return acc
  }, {})

  const threatSubtypeData = Object.keys(subtypeCounts).map(key => ({
    name: key,
    count: subtypeCounts[key]
  })).sort((a, b) => b.count - a.count).slice(0, 5) // Top 5

  // 4. IP Check Logic
  const internalPrefixes = ['10.0.220.', '10.0.40.', '10.0.44.', '10.0.58.', '10.0.34.', '10.0.56.', '10.0.32.', '10.115.2.', '10.115.1.']

  const checkIpType = (ip) => {
    if (!ip) return 'Unknown'
    const isInternal = internalPrefixes.some(prefix => ip.startsWith(prefix))
    return isInternal ? 'IP ภายใน' : 'IP ภายนอก'
  }

  // Formatting date for timeline
  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A'
    try {
      const date = new Date(timeStr)
      return date.toLocaleTimeString('th-TH')
    } catch {
      return timeStr
    }
  }

  // 5. 24-hour Timeline (Stock-like chart)
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i.toString().padStart(2, '0')}:00`,
    attacks: 0
  }))

  logs.forEach(log => {
    if (log.attack_start_time) {
      try {
        const date = new Date(log.attack_start_time)
        const hour = date.getHours()
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          hourlyData[hour].attacks += 1
        }
      } catch (e) {
        // ignore invalid dates
      }
    }
  })

  // --- Filter & Pagination Logic ---
  const filteredLogs = useMemo(() => {
    let result = logs
    if (activeFilter.type) {
      result = result.filter(log => log[activeFilter.type] === activeFilter.value)
    }
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      result = result.filter(log =>
        (log.threat_name && log.threat_name.toLowerCase().includes(lowerTerm)) ||
        (log.threat_type && log.threat_type.toLowerCase().includes(lowerTerm)) ||
        (log.threat_subtype && log.threat_subtype.toLowerCase().includes(lowerTerm)) ||
        (log.source_ip && log.source_ip.includes(lowerTerm)) ||
        (log.destination_ip && log.destination_ip.includes(lowerTerm)) ||
        (log.severity && log.severity.toLowerCase().includes(lowerTerm))
      )
    }
    return result
  }, [logs, activeFilter, searchTerm])

  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const handleChartClick = (data, type) => {
    let filterValue = null;

    // Extract the filter value based on the Recharts event structure
    if (data && data.name) {
      filterValue = data.name; // From Pie click or direct Bar click
    } else if (data && data.activeLabel) {
      filterValue = data.activeLabel; // From BarChart container click
    } else if (data && data.activePayload && data.activePayload.length > 0) {
      filterValue = data.activePayload[0].payload.name;
    }

    if (!filterValue) return;

    setActiveFilter(prev => {
      if (prev.type === type && prev.value === filterValue) {
        return { type: null, value: null } // toggle off
      }
      return { type, value: filterValue }
    })
  }

  const exportToExcel = () => {
    if (filteredLogs.length === 0) return
    const exportData = filteredLogs.map((log, index) => ({
      'No.': index + 1,
      'Threat Name': log.threat_name,
      'Severity': log.severity,
      'Threat Type': log.threat_type,
      'Threat Subtype': log.threat_subtype,
      'Source IP': log.source_ip,
      'Source Port': log.source_port,
      'Destination IP': log.destination_ip,
      'Destination Port': log.destination_port,
      'Start Time': formatTime(log.attack_start_time),
      'End Time': formatTime(log.attack_end_time)
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Cyber Logs")
    const dateStr = selectedDate ? selectedDate.toLocaleDateString('en-CA') : ''
    XLSX.writeFile(wb, `Cyber_Logs_${dateStr}.xlsx`)
  }

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
            {/* Show display_name instead of username */}
            <span className="username">{user?.display_name || user?.username || 'Administrator'}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="main-wrapper">
        {/* Sidebar */}
        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <ul className="sidebar-menu">
            <li className="active">
              <Link to="/homepage">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
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
                <h1>Dashboard</h1>
                <p>Real-time cyber log analytics and monitoring</p>
              </div>

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

            {isLoading ? (
              <div className="cyber-loader-container">
                <div className="cyber-pulse">
                  <div className="cyber-pulse-core"></div>
                </div>
                <div className="loading-text">Scanning Logs...</div>
              </div>
            ) : logs.length === 0 ? (
              <div className="no-data-card">
                <div className="no-data-icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 7V10L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3>No Logs Found</h3>
                <p>We couldn't find any cyber logs for the selected date. Please try selecting a different date from the date picker above.</p>
              </div>
            ) : (
              <>
                <div className="charts-grid">
                  {/* Timeline (Stock-like Horizontal 24h Chart) */}
                  <div className="chart-card timeline-card">
                    <h3>24-Hour Attack Timeline ({selectedDate ? selectedDate.toLocaleDateString('en-GB') : 'Unknown'})</h3>
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorAttacks" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <RechartsTooltip />
                          <Area type="monotone" dataKey="attacks" stroke="#ef4444" fillOpacity={1} fill="url(#colorAttacks)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Severity Pie Chart */}
                  <div className="chart-card">
                    <h3>Severity Distribution</h3>
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent, value }) => `${name} ${value.toLocaleString()} (${(percent * 100).toFixed(0)}%)`}
                            onClick={(data) => handleChartClick(data, 'severity')}
                            style={{ cursor: 'pointer' }}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={severityColors[entry.name] || '#ccc'} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Threat Type Bar Chart */}
                  <div className="chart-card">
                    <h3>Top Threat Types</h3>
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={threatTypeData}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                          onClick={(state) => handleChartClick(state, 'threat_type')}
                          style={{ cursor: 'pointer' }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
                          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, cursor: 'pointer' }} />
                          <RechartsTooltip formatter={(value) => value.toLocaleString()} />
                          <Bar
                            dataKey="count"
                            fill="#0ea5e9"
                            radius={[0, 4, 4, 0]}
                            minPointSize={5}
                            label={{ position: 'right', formatter: (value) => value.toLocaleString(), fill: '#64748b', fontSize: 12 }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Threat Subtype Bar Chart */}
                  <div className="chart-card">
                    <h3>Top Threat Subtypes</h3>
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={threatSubtypeData}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                          onClick={(state) => handleChartClick(state, 'threat_subtype')}
                          style={{ cursor: 'pointer' }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
                          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, cursor: 'pointer' }} />
                          <RechartsTooltip formatter={(value) => value.toLocaleString()} />
                          <Bar
                            dataKey="count"
                            fill="#10b981"
                            radius={[0, 4, 4, 0]}
                            minPointSize={5}
                            label={{ position: 'right', formatter: (value) => value.toLocaleString(), fill: '#64748b', fontSize: 12 }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Cyber Log Table */}
                <div className="table-card">
                  <div className="table-header-row">
                    <h3>
                      Cyber Log Details
                      {activeFilter.type && (
                        <span className="active-filter-badge">
                          Filtered by {activeFilter.value}
                          <button onClick={() => setActiveFilter({ type: null, value: null })}>×</button>
                        </span>
                      )}
                    </h3>
                    <div className="table-actions">
                      <div className="search-container">
                        <input
                          type="text"
                          placeholder="Search logs..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
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
                      <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))} className="rows-select">
                        <option value={10}>10 rows</option>
                        <option value={20}>20 rows</option>
                        <option value={50}>50 rows</option>
                      </select>
                      <button onClick={exportToExcel} className="export-btn" disabled={filteredLogs.length === 0}>
                        Export to Excel
                      </button>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="cyber-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Threat Name</th>
                          <th>Severity</th>
                          <th>Threat Type</th>
                          <th>Threat Subtype</th>
                          <th>Source IP / Port</th>
                          <th>Destination IP / Port</th>
                          <th>Start Time</th>
                          <th>End Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLogs.length > 0 ? paginatedLogs.map((log, index) => (
                          <tr key={log.id}>
                            <td>{(currentPage - 1) * rowsPerPage + index + 1}</td>
                            <td className="threat-name-cell"><strong>{log.threat_name}</strong></td>
                            <td>
                              <span className="severity-badge" style={{ backgroundColor: severityColors[log.severity] || '#ccc' }}>
                                {log.severity}
                              </span>
                            </td>
                            <td>{log.threat_type}</td>
                            <td>{log.threat_subtype}</td>
                            <td>
                              <div className="ip-info-group">
                                <span className="ip-badge source tooltip">
                                  {log.source_ip}
                                  <span className="tooltip-text">{checkIpType(log.source_ip)}</span>
                                </span>
                                <span className="port-text">:{log.source_port}</span>
                              </div>
                            </td>
                            <td>
                              <div className="ip-info-group">
                                <span className="ip-badge dest tooltip">
                                  {log.destination_ip}
                                  <span className="tooltip-text">{checkIpType(log.destination_ip)}</span>
                                </span>
                                <span className="port-text">:{log.destination_port}</span>
                              </div>
                            </td>
                            <td>{formatTime(log.attack_start_time)}</td>
                            <td>{formatTime(log.attack_end_time)}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="9" className="text-center py-4">No logs match the current filter.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="pagination-container">
                      <button
                        className="page-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      >
                        Previous
                      </button>
                      <span className="page-info">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        className="page-btn"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>

                {/* Node Flow Visualizer */}
                <NodeFlowVisualizer filteredLogs={filteredLogs} activeFilter={activeFilter} />
              </>
            )}
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

export default HomePage