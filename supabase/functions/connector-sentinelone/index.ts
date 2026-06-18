import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const payload = await req.json()
    const { action, org_id, device_id } = payload

    async function getCreds() {
      const { data, error } = await sb.from('connector_credentials').select('credentials, sync_data').eq('org_id', org_id).eq('connector_id', 'sentinelone').single()
      if (error) throw error
      return data
    }

    function s1Fetch(creds: any, path: string, method = 'GET', body?: unknown) {
      return fetch(`${creds.url}/web/api/v2.1${path}`, {
        method,
        headers: { Authorization: `ApiToken ${creds.token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const now = Date.now()
      const groups = [
        { id:'sg1', name:'Default Group',         site:'district.edu', endpoint_count:58,  policy:'Windows Recommended' },
        { id:'sg2', name:'Staff Workstations',    site:'district.edu', endpoint_count:86,  policy:'Staff Security Policy' },
        { id:'sg3', name:'Servers',               site:'district.edu', endpoint_count:12,  policy:'Server Hardened Policy' },
        { id:'sg4', name:'Guest / Lab Machines',  site:'district.edu', endpoint_count:24,  policy:'Lab Policy - Permissive' },
      ]
      const endpoints = [
        { id:'ep001', name:'DISTRICT-ADMIN-01', serial:'PF1234ABC', group_id:'sg2', group_name:'Staff Workstations', os:'Windows 11 22H2', os_version:'10.0.22621', agent_version:'23.2.3.389', status:'online',  health:'healthy', threat_count:0,  last_check_in:new Date(now-300000).toISOString(),   enrolled:new Date('2023-01-10').toISOString(), ip:'10.0.1.10', mac:'a4:83:e7:11:22:33', user:'admin@district.edu',      isolation_status:'not_isolated', policy:'Staff Security Policy',     scan_status:'finished', last_scan:new Date(now-86400000).toISOString()  },
        { id:'ep002', name:'LHS-STAFF-DLEE',    serial:'PF5678DEF', group_id:'sg2', group_name:'Staff Workstations', os:'Windows 11 22H2', os_version:'10.0.22621', agent_version:'23.2.3.389', status:'online',  health:'healthy', threat_count:0,  last_check_in:new Date(now-600000).toISOString(),   enrolled:new Date('2022-08-01').toISOString(), ip:'10.1.1.45', mac:'a4:83:e7:44:55:66', user:'dlee@district.edu',       isolation_status:'not_isolated', policy:'Staff Security Policy',     scan_status:'finished', last_scan:new Date(now-86400000).toISOString()  },
        { id:'ep003', name:'JMS-STAFF-SBROWN',  serial:'MXL2001GHI', group_id:'sg2', group_name:'Staff Workstations', os:'Windows 10 22H2', os_version:'10.0.19045', agent_version:'23.1.5.337', status:'online',  health:'suspect', threat_count:1,  last_check_in:new Date(now-900000).toISOString(),   enrolled:new Date('2021-09-15').toISOString(), ip:'10.1.2.18', mac:'a4:83:e7:77:88:99', user:'sbrown@district.edu',     isolation_status:'not_isolated', policy:'Staff Security Policy',     scan_status:'finished', last_scan:new Date(now-172800000).toISOString() },
        { id:'ep004', name:'FES-STAFF-LTORRES', serial:'MXL4567PQR', group_id:'sg2', group_name:'Staff Workstations', os:'Windows 11 22H2', os_version:'10.0.22621', agent_version:'23.2.3.389', status:'online',  health:'healthy', threat_count:0,  last_check_in:new Date(now-1800000).toISOString(),  enrolled:new Date('2022-08-20').toISOString(), ip:'10.1.3.18', mac:'a4:83:e7:aa:bb:cc', user:'ltorres@district.edu',    isolation_status:'not_isolated', policy:'Staff Security Policy',     scan_status:'finished', last_scan:new Date(now-86400000).toISOString()  },
        { id:'ep005', name:'LAB-01',            serial:'LAB000001',  group_id:'sg4', group_name:'Guest / Lab Machines', os:'Windows 10 21H2', os_version:'10.0.19044', agent_version:'22.3.6.211', status:'online',  health:'healthy', threat_count:0,  last_check_in:new Date(now-3600000).toISOString(),  enrolled:new Date('2021-01-10').toISOString(), ip:'10.1.1.100', mac:'a4:83:e7:dd:ee:ff', user:'',                   isolation_status:'not_isolated', policy:'Lab Policy - Permissive',  scan_status:'finished', last_scan:new Date(now-604800000).toISOString() },
        { id:'ep006', name:'SRV-PRINT-01',      serial:'SRV000001',  group_id:'sg3', group_name:'Servers',             os:'Windows Server 2019', os_version:'10.0.17763', agent_version:'23.2.3.389', status:'online', health:'healthy', threat_count:0, last_check_in:new Date(now-120000).toISOString(), enrolled:new Date('2022-01-01').toISOString(), ip:'10.0.0.10', mac:'00:0c:29:11:22:33', user:'',                    isolation_status:'not_isolated', policy:'Server Hardened Policy',   scan_status:'finished', last_scan:new Date(now-86400000).toISOString() },
        { id:'ep007', name:'WIN11-PILOT-01',    serial:'PF9012MNO',  group_id:'sg1', group_name:'Default Group',       os:'Windows 11 23H2', os_version:'10.0.22631', agent_version:'23.2.3.389', status:'offline', health:'unknown', threat_count:0,  last_check_in:new Date(now-86400000).toISOString(), enrolled:new Date('2023-06-01').toISOString(), ip:'',          mac:'a4:83:e7:00:11:22', user:'mrodriguez@district.edu', isolation_status:'not_isolated', policy:'Windows Recommended',      scan_status:'aborted', last_scan:null },
      ]
      const threats = [
        { id:'th001', name:'Trojan.GenericKD',      endpoint_id:'ep003', endpoint_name:'JMS-STAFF-SBROWN', classification:'Trojan',     severity:'medium', status:'Mitigated', mitigation:'quarantined', path:'C:\\Users\\sbrown\\Downloads\\invoice_2024.exe', detected:new Date(now-172800000).toISOString(), resolved:new Date(now-170000000).toISOString() },
        { id:'th002', name:'PUA.Optional.Bundler',  endpoint_id:'ep005', endpoint_name:'LAB-01',           classification:'PUA',        severity:'low',    status:'Resolved',  mitigation:'killed',      path:'C:\\temp\\setup_helper.exe',                     detected:new Date(now-604800000).toISOString(), resolved:new Date(now-600000000).toISOString() },
      ]
      const policies = [
        { id:'pol1', name:'Windows Recommended',    scope:'Default Group',          detection_mode:'Protect', prevention_mode:'Protect', threat_intelligence:true },
        { id:'pol2', name:'Staff Security Policy',  scope:'Staff Workstations',     detection_mode:'Protect', prevention_mode:'Protect', threat_intelligence:true },
        { id:'pol3', name:'Server Hardened Policy', scope:'Servers',                detection_mode:'Protect', prevention_mode:'Protect', threat_intelligence:true },
        { id:'pol4', name:'Lab Policy - Permissive',scope:'Guest / Lab Machines',   detection_mode:'Detect',  prevention_mode:'Detect',  threat_intelligence:false },
      ]
      const summary = { total_endpoints:180, online:162, healthy:174, threats_active:1, threats_total:2, isolated:0, outdated_agents:6 }
      const sync_data = { groups, endpoints, threats, policies, summary, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'sentinelone', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'sentinelone', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }
    if (action === 'load') {
      const { data, error } = await sb.from('connector_credentials').select('sync_data, last_sync').eq('org_id', org_id).eq('connector_id', 'sentinelone').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    if (action === 'sync') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') throw new Error('Mock mode — use real SentinelOne URL and API token')
      const [agRes, thRes, grRes] = await Promise.all([
        s1Fetch(creds, '/agents?limit=500'),
        s1Fetch(creds, '/threats?limit=200&resolved=false'),
        s1Fetch(creds, '/groups?limit=100'),
      ])
      const [agData, thData, grData] = await Promise.all([agRes.json(), thRes.json(), grRes.json()])
      const endpoints = (agData.data || []).map((a: any) => ({
        id: a.id, name: a.computerName, serial: a.serialNumber, group_id: a.groupId, group_name: a.groupName,
        os: a.osName, os_version: a.osRevision, agent_version: a.agentVersion,
        status: a.networkStatus, health: a.infected ? 'suspect' : a.isActive ? 'healthy' : 'unknown',
        threat_count: a.threatCount, last_check_in: a.lastActiveDate, ip: a.lastIpToMgmt,
        user: a.lastLoggedInUserName, isolation_status: a.networkStatus,
      }))
      const threats = (thData.data || []).map((t: any) => ({
        id: t.id, name: t.threatInfo?.threatName, endpoint_id: t.agentRealtimeInfo?.agentId,
        endpoint_name: t.agentRealtimeInfo?.agentComputerName, classification: t.threatInfo?.classification,
        severity: t.riskScore < 30 ? 'low' : t.riskScore < 70 ? 'medium' : 'high',
        status: t.threatInfo?.mitigationStatus, path: t.threatInfo?.filePath, detected: t.createdAt,
      }))
      const groups = (grData.data || []).map((g: any) => ({
        id: g.id, name: g.name, site: g.siteId, endpoint_count: g.totalAgentsCount, policy: g.policyName || '',
      }))
      const sync_data = { groups, endpoints, threats, policies: [], summary: { total_endpoints: endpoints.length, threats_active: threats.length }, synced_at: new Date().toISOString() }
      await sb.from('connector_credentials').update({ sync_data, last_sync: new Date().toISOString() }).eq('org_id', org_id).eq('connector_id', 'sentinelone')
      return respond({ ok:true, counts: { endpoints: endpoints.length, threats: threats.length } })
    }

    if (action === 'isolate') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: endpoint isolated' })
      const res = await s1Fetch(creds, '/agents/actions/disconnect', 'POST', { filter:{ ids:[device_id] } })
      if (!res.ok) throw new Error(`Isolate error: ${res.status}`)
      return respond({ ok:true })
    }

    if (action === 'unisolate') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: endpoint reconnected' })
      const res = await s1Fetch(creds, '/agents/actions/connect', 'POST', { filter:{ ids:[device_id] } })
      if (!res.ok) throw new Error(`Unisolate error: ${res.status}`)
      return respond({ ok:true })
    }

    if (action === 'scan') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: full disk scan initiated' })
      const res = await s1Fetch(creds, '/agents/actions/initiate-scan', 'POST', { filter:{ ids:[device_id] } })
      if (!res.ok) throw new Error(`Scan error: ${res.status}`)
      return respond({ ok:true })
    }

    throw new Error('Unknown action: ' + action)
  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
