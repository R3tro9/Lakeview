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
      const { data, error } = await sb
        .from('connector_credentials').select('credentials, sync_data')
        .eq('org_id', org_id).eq('connector_id', 'jamf').single()
      if (error) throw error
      return data
    }

    async function jamfToken(creds: any): Promise<string> {
      const res = await fetch(`${creds.url}/api/v1/auth/token`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + btoa(`${creds.username}:${creds.password}`), 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`Jamf auth error: ${res.status}`)
      return (await res.json()).token
    }

    function jamfFetch(baseUrl: string, token: string, path: string, method = 'GET', body?: unknown) {
      return fetch(`${baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const now = Date.now()
      const groups = [
        { id:'sg1', name:'All Managed Macs',       type:'smart',  criteria:'All', device_count:87 },
        { id:'sg2', name:'All Managed iPads',       type:'smart',  criteria:'All', device_count:246 },
        { id:'sg3', name:'Staff MacBooks',          type:'smart',  criteria:'Department = Staff', device_count:42 },
        { id:'sg4', name:'Student iPads - Grade 6', type:'smart',  criteria:'Grade = 6', device_count:58 },
        { id:'sg5', name:'Student iPads - Grade 7', type:'smart',  criteria:'Grade = 7', device_count:61 },
        { id:'sg6', name:'Student iPads - Grade 8', type:'smart',  criteria:'Grade = 8', device_count:55 },
        { id:'sg7', name:'Repair Pool',             type:'static', criteria:'',   device_count:12 },
        { id:'sg8', name:'End of Life',             type:'static', criteria:'',   device_count:19 },
      ]

      const computers = [
        { id:'c001', serial:'C02XL1234ABC', asset_tag:'MAC-001', name:'Lincoln-Staff-001', model:'MacBook Pro 13" 2020', ou_id:'sg3', group_name:'Staff MacBooks', assigned_user:'dlee@district.edu', managed:true, supervised:false, os_version:'13.5.1', last_check_in:new Date(now-1800000).toISOString(), enrolled:new Date('2022-01-10').toISOString(), location:'Lincoln High School', department:'IT', building:'Main', room:'B-201', ip:'10.1.1.45',  mac:'a4:83:e7:11:22:33', storage_gb:256, storage_used_gb:89,  battery_pct:87, filevault:true,  gatekeeper:true,  sip:true  },
        { id:'c002', serial:'C02XL5678DEF', asset_tag:'MAC-002', name:'Lincoln-Staff-002', model:'MacBook Air 13" M1',  ou_id:'sg3', group_name:'Staff MacBooks', assigned_user:'sbrown@district.edu', managed:true, supervised:false, os_version:'13.5.2', last_check_in:new Date(now-3600000).toISOString(), enrolled:new Date('2022-08-01').toISOString(), location:'Jefferson Middle',   department:'Math',device:'Main', room:'C-105', ip:'10.1.2.18',  mac:'a4:83:e7:44:55:66', storage_gb:256, storage_used_gb:62,  battery_pct:95, filevault:true,  gatekeeper:true,  sip:true  },
        { id:'c003', serial:'C02XL9012GHI', asset_tag:'MAC-003', name:'District-Admin-001', model:'MacBook Pro 14" M2', ou_id:'sg3', group_name:'Staff MacBooks', assigned_user:'admin@district.edu', managed:true, supervised:false, os_version:'13.5.2', last_check_in:new Date(now-600000).toISOString(),  enrolled:new Date('2023-01-15').toISOString(), location:'District Office',    department:'IT', building:'Admin', room:'A-101', ip:'10.0.1.10',  mac:'a4:83:e7:77:88:99', storage_gb:512, storage_used_gb:201, battery_pct:100, filevault:true,  gatekeeper:true,  sip:true  },
        { id:'c004', serial:'C02XL3456JKL', asset_tag:'MAC-004', name:'Lincoln-Staff-003', model:'MacBook Air 13" M1',  ou_id:'sg3', group_name:'Staff MacBooks', assigned_user:'mrodriguez@district.edu', managed:true, supervised:false, os_version:'12.7.0', last_check_in:new Date(now-86400000).toISOString(), enrolled:new Date('2021-08-15').toISOString(), location:'Lincoln High School', department:'English', building:'Main', room:'A-204', ip:'10.1.1.88',  mac:'a4:83:e7:aa:bb:cc', storage_gb:256, storage_used_gb:110, battery_pct:76, filevault:true,  gatekeeper:true,  sip:false },
      ]

      const mobile_devices = [
        { id:'m001', serial:'F2LXN1234ABC', asset_tag:'IPD-001', name:'iPad-G6-001', model:'iPad 9th Gen',   ou_id:'sg4', group_name:'Student iPads - Grade 6', assigned_user:'jsmith@district.edu',  managed:true, supervised:true,  os_version:'16.6', last_check_in:new Date(now-3600000).toISOString(),  enrolled:new Date('2022-08-20').toISOString(), location:'Jefferson Middle', department:'Grade 6', capacity_gb:64, available_gb:41, battery_pct:82, mdm_profile:true, passcode_present:true },
        { id:'m002', serial:'F2LXN5678DEF', asset_tag:'IPD-002', name:'iPad-G6-002', model:'iPad 9th Gen',   ou_id:'sg4', group_name:'Student iPads - Grade 6', assigned_user:'mwilliams@district.edu', managed:true, supervised:true, os_version:'16.6', last_check_in:new Date(now-7200000).toISOString(),  enrolled:new Date('2022-08-20').toISOString(), location:'Jefferson Middle', department:'Grade 6', capacity_gb:64, available_gb:28, battery_pct:55, mdm_profile:true, passcode_present:true },
        { id:'m003', serial:'F2LXN9012GHI', asset_tag:'IPD-003', name:'iPad-G7-001', model:'iPad 10th Gen',  ou_id:'sg5', group_name:'Student iPads - Grade 7', assigned_user:'rgarcia@district.edu', managed:true, supervised:true,  os_version:'16.6', last_check_in:new Date(now-900000).toISOString(),   enrolled:new Date('2023-08-20').toISOString(), location:'Jefferson Middle', department:'Grade 7', capacity_gb:64, available_gb:51, battery_pct:91, mdm_profile:true, passcode_present:true },
        { id:'m004', serial:'F2LXN3456JKL', asset_tag:'IPD-004', name:'iPad-G8-001', model:'iPad Air 5th Gen', ou_id:'sg6', group_name:'Student iPads - Grade 8', assigned_user:'tchen@district.edu', managed:true, supervised:true, os_version:'16.6.1', last_check_in:new Date(now-1800000).toISOString(), enrolled:new Date('2023-08-20').toISOString(), location:'Jefferson Middle', department:'Grade 8', capacity_gb:64, available_gb:39, battery_pct:68, mdm_profile:true, passcode_present:true },
        { id:'m005', serial:'F2LXN7890MNO', asset_tag:'IPD-099', name:'iPad-Repair-01', model:'iPad 9th Gen', ou_id:'sg7', group_name:'Repair Pool', assigned_user:'',                  managed:true, supervised:true,  os_version:'16.1', last_check_in:new Date(now-604800000).toISOString(), enrolled:new Date('2022-08-20').toISOString(), location:'', department:'', capacity_gb:64, available_gb:60, battery_pct:12, mdm_profile:true, passcode_present:false },
      ]

      const policies = [
        { id:'pol1', name:'Software Update - macOS Ventura', scope:'All Managed Macs', trigger:'CHECKIN', category:'Maintenance', enabled:true, last_run:new Date(now-3600000).toISOString() },
        { id:'pol2', name:'Install Chrome - Staff',          scope:'Staff MacBooks',   trigger:'SELF_SERVICE', category:'Software', enabled:true, last_run:new Date(now-86400000).toISOString() },
        { id:'pol3', name:'Printer Setup - District',        scope:'All Managed Macs', trigger:'CHECKIN', category:'Network', enabled:true, last_run:new Date(now-43200000).toISOString() },
        { id:'pol4', name:'FileVault Enforcement',           scope:'All Managed Macs', trigger:'CHECKIN', category:'Security', enabled:true, last_run:new Date(now-3600000).toISOString() },
      ]

      const profiles = [
        { id:'pr1', name:'Wi-Fi - District Network',       scope:'All', type:'Configuration', payload_type:'com.apple.wifi.managed',          deployed:true },
        { id:'pr2', name:'Web Content Filter - Students',  scope:'Student iPads - Grade 6,7,8', type:'Configuration', payload_type:'com.apple.webcontent-filter', deployed:true },
        { id:'pr3', name:'Restrictions - Student iPads',   scope:'Student iPads - Grade 6,7,8', type:'Configuration', payload_type:'com.apple.applicationaccess', deployed:true },
        { id:'pr4', name:'VPN - Staff',                    scope:'Staff MacBooks',   type:'Configuration', payload_type:'com.apple.vpn.managed',           deployed:true },
        { id:'pr5', name:'Security Passcode Policy',       scope:'All',              type:'Configuration', payload_type:'com.apple.mobiledevice.passwordpolicy', deployed:true },
      ]

      const sync_data = { groups, computers, mobile_devices, policies, profiles, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'jamf', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    // ── SAVE ──────────────────────────────────────────────────────────────────
    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'jamf', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }

    // ── SYNC ──────────────────────────────────────────────────────────────────
    if (action === 'sync') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') throw new Error('Mock credentials — use real Jamf URL and credentials')
      const token = await jamfToken(creds)

      const [cgRes, mgRes, compRes, mobRes] = await Promise.all([
        jamfFetch(creds.url, token, '/api/v1/computer-groups?page-size=500'),
        jamfFetch(creds.url, token, '/api/v1/mobile-device-groups?page-size=500'),
        jamfFetch(creds.url, token, '/api/v2/computers-preview?page-size=500'),
        jamfFetch(creds.url, token, '/api/v2/mobile-devices?page-size=500'),
      ])

      const [cgData, mgData, compData, mobData] = await Promise.all([
        cgRes.ok ? cgRes.json() : { results: [] },
        mgRes.ok ? mgRes.json() : { results: [] },
        compRes.ok ? compRes.json() : { results: [] },
        mobRes.ok ? mobRes.json() : { results: [] },
      ])

      const groups = [
        ...(cgData.results || []).map((g: any) => ({ id:'cg-'+g.id, name:g.name, type:g.isSmart?'smart':'static', device_count:0 })),
        ...(mgData.results || []).map((g: any) => ({ id:'mg-'+g.id, name:g.name, type:g.isSmart?'smart':'static', device_count:0 })),
      ]
      const computers = (compData.results || []).map((c: any) => ({ id:'c-'+c.id, serial:c.serialNumber, name:c.name, model:c.model, assigned_user:c.username || '', managed:c.managed, os_version:c.operatingSystemVersion, last_check_in:c.lastContactTime }))
      const mobile_devices = (mobData.results || []).map((m: any) => ({ id:'m-'+m.id, serial:m.serialNumber, name:m.name, model:m.model, assigned_user:m.username || '', managed:m.managed, os_version:m.osVersion, last_check_in:m.lastInventoryUpdate }))

      const sync_data = { groups, computers, mobile_devices, policies: [], profiles: [], synced_at: new Date().toISOString() }
      await sb.from('connector_credentials').update({ sync_data, last_sync: new Date().toISOString() }).eq('org_id', org_id).eq('connector_id', 'jamf')
      return respond({ ok:true, counts: { computers: computers.length, mobile_devices: mobile_devices.length } })
    }

    // ── LOAD ──────────────────────────────────────────────────────────────────
    if (action === 'load') {
      const { data, error } = await sb.from('connector_credentials').select('sync_data, last_sync').eq('org_id', org_id).eq('connector_id', 'jamf').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    // ── DEVICE ACTIONS ────────────────────────────────────────────────────────
    if (action === 'lock' || action === 'wipe' || action === 'update_inventory') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:`Mock: ${action} sent to device ${device_id}` })
      const token = await jamfToken(creds)
      const endpoint = action === 'lock' ? 'DeviceLock' : action === 'wipe' ? 'EraseDevice' : 'UpdateInventory'
      const res = await jamfFetch(creds.url, token, `/api/v1/mobile-device-management-commands`, 'POST', { commandType: endpoint, managementIds: [device_id] })
      if (!res.ok) throw new Error(`Jamf ${action} error: ${res.status}`)
      return respond({ ok:true })
    }

    throw new Error('Unknown action: ' + action)
  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
